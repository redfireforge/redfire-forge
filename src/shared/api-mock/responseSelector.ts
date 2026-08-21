/**
 * API Mock Studio — advanced response selection (Phase 7B-7C).
 * Handles sequence, weighted, and state-gated response modes.
 */
import type { ApiMockCapturedRequestV1, ApiMockRouteV1, ApiMockResponseVariantV1 } from './contracts';
import type { ScenarioState } from './scenarioRuntime';
import { getState } from './scenarioRuntime';
import { evaluatePredicateGroup } from './predicateEvaluator';
import { matchPath } from './pathMatcher';
import { stripBasePath } from './predicateEvaluatorHelpers';

export interface SequenceState {
  positions: Record<string, number>;
}

export function createSequenceState(): SequenceState {
  return { positions: {} };
}

/** Select the next response in sequence for the given route. */
export function selectSequenceResponse(
  route: ApiMockRouteV1,
  seqState: SequenceState,
  exhaustionPolicy: 'cycle' | 'hold_last' = 'cycle',
): ApiMockResponseVariantV1 | undefined {
  const enabled = route.responses.filter(r => r.enabled);
  if (enabled.length === 0) return undefined;

  const pos = seqState.positions[route.id] ?? 0;
  const idx = exhaustionPolicy === 'cycle' ? pos % enabled.length : Math.min(pos, enabled.length - 1);
  seqState.positions[route.id] = pos + 1;
  return enabled[idx];
}

/** Reset sequence position for a specific route or all routes. */
export function resetSequence(seqState: SequenceState, routeId?: string): void {
  if (routeId) delete seqState.positions[routeId];
  else seqState.positions = {};
}

/** Select a response using weighted probability. */
export function selectWeightedResponse(
  route: ApiMockRouteV1,
  seed?: string,
): ApiMockResponseVariantV1 | undefined {
  const eligible = route.responses.filter(r => r.enabled && (r.weight ?? 0) > 0);
  if (eligible.length === 0) return undefined;

  const totalWeight = eligible.reduce((sum, r) => sum + (r.weight ?? 0), 0);
  if (totalWeight <= 0) return eligible[0];

  const roll = seed ? seededRandom(seed, 0, totalWeight - 1) : Math.floor(Math.random() * totalWeight);
  let cumulative = 0;
  for (const variant of eligible) {
    cumulative += variant.weight ?? 0;
    if (roll < cumulative) return variant;
  }
  return eligible[eligible.length - 1];
}

/** Select a response based on scenario state guards. */
export function selectStateResponse(
  route: ApiMockRouteV1,
  scenario: ScenarioState,
  stateKey: string,
): ApiMockResponseVariantV1 | undefined {
  const current = getState(scenario, stateKey);
  const enabled = route.responses.filter(r => r.enabled);
  if (enabled.length === 0) return undefined;
  const guarded = enabled.find(r => r.transition?.currentState === current);
  if (guarded) return guarded;
  const unguarded = enabled.find(r => !r.transition?.currentState);
  if (unguarded) return unguarded;
  // No recorded state yet, and every variant names a required state: the first
  // card is the start of the machine (e.g. EMPTY → HAS_ITEMS).
  if (current === '') return enabled[0];
  return undefined;
}

/**
 * Rules-mode selection: first enabled variant whose conditions match, else default.
 */
export function selectRulesResponse(
  route: ApiMockRouteV1,
  request: ApiMockCapturedRequestV1,
  basePath = '',
): ApiMockResponseVariantV1 | undefined {
  const enabled = route.responses.filter(r => r.enabled);
  if (enabled.length === 0) return undefined;
  const fullPath = stripBasePath(request.path, basePath);
  const pathParams = matchPath(route.path, fullPath).params;
  const conditional = enabled.find(v => (
    !v.isDefault
    && v.conditions
    && v.conditions.children.length > 0
    && evaluatePredicateGroup(v.conditions, request, pathParams)
  ));
  if (conditional) return conditional;
  return enabled.find(v => v.isDefault) ?? enabled[0];
}

/** Unified mode-aware selection used by the network listener. */
export function selectResponseForRoute(
  route: ApiMockRouteV1,
  request: ApiMockCapturedRequestV1,
  scenario: ScenarioState,
  sequence: SequenceState,
  opts?: { basePath?: string; stateKey?: string; seed?: string },
): ApiMockResponseVariantV1 | undefined {
  switch (route.responseMode) {
    case 'sequence':
      return selectSequenceResponse(route, sequence);
    case 'weighted':
      return selectWeightedResponse(route, opts?.seed);
    case 'state':
      return selectStateResponse(route, scenario, opts?.stateKey ?? 'default');
    default:
      return selectRulesResponse(route, request, opts?.basePath ?? '');
  }
}

/** Check if a variant is eligible based on match count and expiry limits. */
export function isVariantEligible(
  variant: ApiMockResponseVariantV1,
  matchCount: number,
  now: Date = new Date(),
  /** Optional fixed roll in [0,1) for deterministic simulation. */
  probabilityRoll?: number,
): { eligible: boolean; reason?: string } {
  if (variant.behavior.maxMatches != null && matchCount >= variant.behavior.maxMatches) {
    return { eligible: false, reason: `Match limit ${variant.behavior.maxMatches} reached` };
  }
  if (variant.behavior.expiresAt) {
    const expiry = new Date(variant.behavior.expiresAt);
    if (now >= expiry) {
      return { eligible: false, reason: `Expired at ${variant.behavior.expiresAt}` };
    }
  }
  if (variant.behavior.probability != null && variant.behavior.probability < 1) {
    const roll = probabilityRoll ?? Math.random();
    if (roll > variant.behavior.probability) {
      return { eligible: false, reason: `Probability ${variant.behavior.probability} not met (rolled ${roll.toFixed(3)})` };
    }
  }
  return { eligible: true };
}

export interface ResolveEligibleVariantResult {
  variant: ApiMockResponseVariantV1;
  fallbackUsed: boolean;
  eligibilityReason?: string;
}

/**
 * Apply match-count / expiry / probability gates after a variant is selected.
 *
 * Probability on a *conditional* rules variant gates its fault, not its
 * identity: a `$.sku == FLAKY` 503 with a 0.5 timeout must not fall through
 * to the default 201 (or unmatched 404). Exhaustion and expiry still fall
 * back to a sibling.
 */
export function resolveEligibleVariant(
  route: ApiMockRouteV1,
  selected: ApiMockResponseVariantV1,
  opts: {
    matchCount: number;
    now?: Date;
    probabilityRoll?: number;
    siblingMatchCount: (id: string) => number;
    siblingProbabilityRoll?: (id: string) => number;
  },
): ResolveEligibleVariantResult {
  const eligibility = isVariantEligible(selected, opts.matchCount, opts.now, opts.probabilityRoll);
  if (eligibility.eligible) {
    return { variant: selected, fallbackUsed: false };
  }

  const probabilityMiss = Boolean(eligibility.reason?.startsWith('Probability'));
  const selectedByCondition = !selected.isDefault && Boolean(selected.conditions?.children.length);
  if (probabilityMiss && selectedByCondition) {
    return {
      variant: stripVariantFault(selected),
      fallbackUsed: false,
      eligibilityReason: eligibility.reason,
    };
  }

  const fallback = route.responses.find(v => (
    v.enabled
    && v.id !== selected.id
    && isVariantEligible(
      v,
      opts.siblingMatchCount(v.id),
      opts.now,
      opts.siblingProbabilityRoll?.(v.id),
    ).eligible
  ));
  return {
    variant: fallback ?? selected,
    fallbackUsed: Boolean(fallback),
    eligibilityReason: eligibility.reason,
  };
}

function stripVariantFault(variant: ApiMockResponseVariantV1): ApiMockResponseVariantV1 {
  if (!variant.behavior.fault || variant.behavior.fault === 'none') return variant;
  return { ...variant, behavior: { ...variant.behavior, fault: undefined } };
}

function seededRandom(seed: string, min: number, max: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  return min + ((hash & 0x7fffffff) % (max - min + 1));
}
