/**
 * API Mock Studio — side-effect-free simulation engine (Phase 1F + Phase 7 preview).
 * Mirrors live selection / render / delay / fault / virtual state without sockets or journal.
 */
import type {
  ApiMockCapturedResponseV1,
  ApiMockRouteV1,
  ApiMockServerSettingsV1,
  ApiMockSimulationPreviewV1,
  ApiMockSimulationResultV1,
  ApiMockSimulationSampleV1,
  ApiMockVariableV1,
} from './contracts';
import { selectRoute } from './routeSelector';
import { DEFAULT_SETTINGS } from './defaults';
import { renderFallbackBody } from './fallbackBody';
import {
  createSequenceState,
  isVariantEligible,
  selectResponseForRoute,
  type SequenceState,
} from './responseSelector';
import {
  applyTransition,
  createInitialState,
  getState,
  type ScenarioState,
} from './scenarioRuntime';
import { renderResponseVariant, toCapturedHeaders } from './responseRenderer';
import { computeVirtualDelayMs, previewFaultDelivery } from './faultPreview';
import { buildClosestMatchDebugBody } from './closestMatchDebug';

const DEFAULT_STATE_KEY = 'default';

export interface SimulationRuntimeContext {
  scenario?: ScenarioState;
  sequence?: SequenceState;
  variantMatchCounts?: Record<string, number>;
}

export interface SimulationInput {
  routes: ApiMockRouteV1[];
  settings?: Partial<ApiMockServerSettingsV1>;
  basePath?: string;
  generation?: number;
  variables?: ApiMockVariableV1[];
  /** Seed for weighted selection + jitter (reproducible traces). */
  seed?: string;
  /** Frozen clock for expiry / template `now`. */
  now?: string;
  /** Initial runtime snapshot (cloned; never mutated in place). */
  runtime?: SimulationRuntimeContext;
  /**
   * When true (default for batch), advance cloned scenario/sequence/match counts
   * across samples so multi-step state/sequence flows can be previewed.
   */
  sequentialBatch?: boolean;
}

export function simulateSingle(
  sample: ApiMockSimulationSampleV1,
  input: SimulationInput,
  /** Mutable working context for sequential batch runs (cloned once by caller). */
  working?: SimulationRuntimeContext,
): ApiMockSimulationResultV1 {
  const settings = mergeSettings(input.settings);
  const basePath = input.basePath ?? '';
  const result = selectRoute(input.routes, sample.request, settings, basePath);
  const ctx = working ?? cloneRuntime(input.runtime);
  const seed = input.seed ?? `${sample.request.receivedAt}:${sample.id}`;
  const nowIso = input.now ?? new Date().toISOString();
  const now = new Date(nowIso);

  let outcome = result.outcome;
  let renderedResponse: ApiMockCapturedResponseV1 | undefined;
  let preview: ApiMockSimulationPreviewV1 | undefined;

  if (outcome === 'matched' && result.selectedRouteId) {
    const route = input.routes.find(r => r.id === result.selectedRouteId);
    if (route) {
      const selection = selectVariantForPreview(route, sample.request, ctx, {
        basePath,
        stateKey: DEFAULT_STATE_KEY,
        seed: `${seed}:${route.id}:${sample.request.path}`,
        now,
      });
      const variant = selection.variant;
      if (variant) {
        ctx.variantMatchCounts![variant.id] = (ctx.variantMatchCounts![variant.id] ?? 0) + 1;
      }

      const stateBefore = getState(ctx.scenario!, DEFAULT_STATE_KEY);
      const rendered = renderResponseVariant({
        variant,
        request: sample.request,
        route,
        basePath,
        scenario: ctx.scenario!,
        variables: input.variables ?? [],
        seed: `${seed}:${route.id}`,
        maxResponseBodyBytes: settings.limits.maxResponseBodyBytes,
        now: nowIso,
      });
      const delay = computeVirtualDelayMs(variant, settings.limits.maxDelayMs, `${seed}:delay`);
      const faultPreview = previewFaultDelivery(
        variant?.behavior.fault,
        variant?.behavior ?? { delayMs: 0, jitterMs: 0 },
        { status: rendered.status, body: rendered.body },
        settings.limits.longRunningMaxMs,
      );

      let transitionApplied = false;
      if (variant?.transition) {
        const tr = applyTransition(ctx.scenario!, DEFAULT_STATE_KEY, variant.transition);
        transitionApplied = tr.applied;
      }

      outcome = faultPreview.deliveryOutcome;
      result.selectedResponseId = variant?.id;
      result.explanation.policyDecision.selectedResponseId = variant?.id;

      const headers = toCapturedHeaders(rendered.headers);
      renderedResponse = {
        status: faultPreview.effectiveStatus,
        headers,
        cookies: variant?.cookies ?? [],
        body: faultPreview.httpCompleted ? faultPreview.effectiveBody : null,
        bodyTruncated: false,
        contentType: headers['content-type']?.[0],
        durationMs: delay.totalMs,
        generationAtResponse: typeof input.generation === 'number' ? input.generation : 0,
      };

      const enabled = route.responses.filter(r => r.enabled);
      const sequenceIndex = route.responseMode === 'sequence'
        ? Math.max(0, (ctx.sequence!.positions[route.id] ?? 1) - 1)
        : undefined;

      preview = {
        responseMode: route.responseMode,
        selectedResponseId: variant?.id,
        selectedResponseName: variant?.name,
        eligibilityFallback: selection.fallbackUsed,
        eligibilityReason: selection.eligibilityReason,
        sequenceIndex,
        virtualDelayMs: delay.totalMs,
        baseDelayMs: delay.baseMs,
        jitterAppliedMs: delay.jitterMs,
        fault: faultPreview.fault,
        faultTimeline: faultPreview.timeline,
        httpCompleted: faultPreview.httpCompleted,
        stateKey: DEFAULT_STATE_KEY,
        stateBefore,
        stateAfter: getState(ctx.scenario!, DEFAULT_STATE_KEY),
        transitionApplied,
        countersAfter: { ...ctx.scenario!.counters },
      };

      // Annotate sequence hint with position among enabled variants
      if (sequenceIndex != null && enabled.length > 0) {
        preview.sequenceIndex = sequenceIndex % enabled.length;
      }
    }
  } else if (outcome === 'ambiguous') {
    const amb = settings.selection.ambiguityResponse;
    const body = renderFallbackBody(amb.body, {
      requestId: sample.id,
      competingRuleCount: result.explanation?.candidates?.length ?? 0,
    });
    renderedResponse = staticCaptured(amb.status, amb.contentType, body, input.generation);
    preview = emptyPreview();
  } else if (outcome === 'unmatched') {
    const fb = settings.fallback.unmatchedResponse;
    if (settings.fallback.mode === 'closest_match_debug') {
      const debug = buildClosestMatchDebugBody(result.explanation, fb);
      renderedResponse = staticCaptured(debug.status, debug.contentType, debug.body, input.generation);
    } else {
      const body = renderFallbackBody(fb.body, { requestId: sample.id });
      renderedResponse = staticCaptured(fb.status, fb.contentType, body, input.generation);
    }
    preview = emptyPreview();
  }

  const passed = sample.expected
    ? checkExpectations(sample.expected, result, outcome, renderedResponse)
    : undefined;

  return {
    sampleId: sample.id,
    generation: input.generation ?? 'draft',
    passed,
    outcome,
    renderedResponse,
    preview,
    trace: result.explanation,
  };
}

export function simulateBatch(
  samples: ApiMockSimulationSampleV1[],
  input: SimulationInput,
): ApiMockSimulationResultV1[] {
  const sequential = input.sequentialBatch !== false;
  if (!sequential) {
    return samples.map(s => simulateSingle(s, input));
  }
  const working = cloneRuntime(input.runtime);
  return samples.map(s => simulateSingle(s, input, working));
}

function selectVariantForPreview(
  route: ApiMockRouteV1,
  request: Parameters<typeof selectResponseForRoute>[1],
  ctx: SimulationRuntimeContext,
  opts: { basePath: string; stateKey: string; seed: string; now: Date },
): {
  variant?: ReturnType<typeof selectResponseForRoute>;
  fallbackUsed: boolean;
  eligibilityReason?: string;
} {
  ensureRuntime(ctx);
  const selected = selectResponseForRoute(route, request, ctx.scenario!, ctx.sequence!, {
    basePath: opts.basePath,
    stateKey: opts.stateKey,
    seed: opts.seed,
  });
  if (!selected) return { variant: undefined, fallbackUsed: false };

  const probabilityRoll = hashUnit(`${opts.seed}:prob`);
  const count = ctx.variantMatchCounts![selected.id] ?? 0;
  const eligibility = isVariantEligible(selected, count, opts.now, probabilityRoll);
  if (eligibility.eligible) {
    return { variant: selected, fallbackUsed: false };
  }

  const fallback = route.responses.find(v => (
    v.enabled
    && v.id !== selected.id
    && isVariantEligible(
      v,
      ctx.variantMatchCounts![v.id] ?? 0,
      opts.now,
      hashUnit(`${opts.seed}:prob:${v.id}`),
    ).eligible
  ));
  return {
    variant: fallback ?? selected,
    fallbackUsed: Boolean(fallback),
    eligibilityReason: eligibility.reason,
  };
}

function checkExpectations(
  expected: NonNullable<ApiMockSimulationSampleV1['expected']>,
  result: ReturnType<typeof selectRoute>,
  outcome: ApiMockSimulationResultV1['outcome'],
  rendered?: ApiMockCapturedResponseV1,
): boolean {
  if (expected.outcome && expected.outcome !== outcome) return false;
  if (expected.routeId && expected.routeId !== result.selectedRouteId) return false;
  if (expected.responseId && expected.responseId !== result.selectedResponseId) return false;
  if (expected.status != null) {
    const actualStatus = rendered?.status
      ?? (outcome === 'ambiguous' ? 409 : outcome === 'unmatched' ? 404 : undefined);
    if (actualStatus != null && actualStatus !== expected.status) return false;
  }
  if (expected.bodyContains != null) {
    if (!rendered?.body?.includes(expected.bodyContains)) return false;
  }
  if (expected.bodyExact != null) {
    if ((rendered?.body ?? null) !== expected.bodyExact) return false;
  }
  return true;
}

function staticCaptured(
  status: number,
  contentType: string,
  body: string,
  generation: number | undefined,
): ApiMockCapturedResponseV1 {
  return {
    status,
    headers: { 'content-type': [contentType] },
    cookies: [],
    body,
    bodyTruncated: false,
    contentType,
    durationMs: 0,
    generationAtResponse: typeof generation === 'number' ? generation : 0,
  };
}

function emptyPreview(): ApiMockSimulationPreviewV1 {
  return {
    virtualDelayMs: 0,
    baseDelayMs: 0,
    jitterAppliedMs: 0,
    fault: 'none',
    faultTimeline: [],
    httpCompleted: true,
  };
}

function cloneRuntime(runtime?: SimulationRuntimeContext): SimulationRuntimeContext {
  return {
    scenario: runtime?.scenario
      ? { states: { ...runtime.scenario.states }, counters: { ...runtime.scenario.counters } }
      : createInitialState(),
    sequence: runtime?.sequence
      ? { positions: { ...runtime.sequence.positions } }
      : createSequenceState(),
    variantMatchCounts: { ...(runtime?.variantMatchCounts ?? {}) },
  };
}

function ensureRuntime(ctx: SimulationRuntimeContext): void {
  if (!ctx.scenario) ctx.scenario = createInitialState();
  if (!ctx.sequence) ctx.sequence = createSequenceState();
  if (!ctx.variantMatchCounts) ctx.variantMatchCounts = {};
}

function hashUnit(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  return (hash & 0x7fffffff) / 0x80000000;
}

function mergeSettings(partial?: Partial<ApiMockServerSettingsV1>): ApiMockServerSettingsV1 {
  if (!partial) return DEFAULT_SETTINGS;
  return {
    selection: partial.selection ?? DEFAULT_SETTINGS.selection,
    fallback: partial.fallback ?? DEFAULT_SETTINGS.fallback,
    cors: partial.cors ?? DEFAULT_SETTINGS.cors,
    limits: partial.limits ?? DEFAULT_SETTINGS.limits,
    journal: partial.journal ?? DEFAULT_SETTINGS.journal,
    redaction: partial.redaction ?? DEFAULT_SETTINGS.redaction,
    proxy: partial.proxy ?? DEFAULT_SETTINGS.proxy,
    callbacks: partial.callbacks ?? DEFAULT_SETTINGS.callbacks,
  };
}
