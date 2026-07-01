/**
 * Phase 5C — replay binding: saved request / history → execute snapshot + drift.
 *
 * Wraps the Phase 4H resolver with schema drift analysis and optional safe
 * body fallback. Does not mutate the source tab.
 */
import type { GrpcDescriptor } from '../../../shared/grpc/contracts';
import type { GrpcCallHistoryEntryV1 } from '../../../shared/grpc/grpcPersistenceSchema';
import { containsGrpcInterpolationToken } from '../../../shared/grpc/grpcInterpolationGrammar';
import {
  createGrpcSavedRequestFromSnapshot,
  type GrpcSavedRequest,
} from '../../../shared/grpc/grpcSavedRequest';
import type { GrpcSavedRequestTabContext } from '../../../shared/grpc/grpcReplayTemplateCompatibility';
import type { GrpcTabDescriptorState } from '../grpcStudioTypes';
import {
  analyzeGrpcSchemaDrift,
  analyzeWarningDriftWithBaseline,
  pruneGrpcBodyToSchema,
  suggestGrpcSchemaRebinds,
  type GrpcSchemaDriftAnalysis,
} from './grpcSchemaDrift';
import { findGrpcMethod } from './grpcExplorerUtils';
import {
  resolveGrpcSavedRequestReplay,
  type GrpcReplayResolverInput,
} from './grpcReplayResolver';
import type { GrpcTabExecuteSnapshot } from '../../../shared/grpc/contracts';
import { resolveDescriptorSourceFingerprint } from '../../../shared/grpc/descriptorSourcePolicy';

export interface GrpcReplayBindingInput extends GrpcReplayResolverInput {
  /** Loaded descriptor on the active tab — required for drift analysis. */
  currentDescriptor?: GrpcDescriptor;
  /** Descriptor at save/capture time — must match `saved.descriptorKey` when provided. */
  baselineDescriptor?: GrpcDescriptor;
  /** When `baselineDescriptor` is omitted, resolved via `resolveBaselineDescriptorForReplay`. */
  tabDescriptorState?: GrpcTabDescriptorState;
  /** When true and drift is warning-only, prune body to current schema before execute. */
  applySafeFallback?: boolean;
}

export interface GrpcReplayBindingResult {
  snapshot: GrpcTabExecuteSnapshot;
  drift: GrpcSchemaDriftAnalysis;
  body: Record<string, unknown>;
  safeFallbackApplied: boolean;
  /** Set when replay source is a history row whose body was truncated at capture. */
  historyBodyTruncated?: boolean;
}

export interface GrpcHistoryReplayBindingInput extends Omit<GrpcReplayBindingInput, 'saved'> {
  entry: GrpcCallHistoryEntryV1;
}

/** Pick baseline descriptor from tab state when descriptor keys align. */
export function resolveBaselineDescriptorForReplay(
  tabDescriptorState: GrpcTabDescriptorState | undefined,
  descriptorKey: string,
): GrpcDescriptor | undefined {
  if (!tabDescriptorState) return undefined;
  if (tabDescriptorState.lastKnownGoodDescriptor?.key === descriptorKey) {
    return tabDescriptorState.lastKnownGoodDescriptor;
  }
  if (tabDescriptorState.descriptor?.key === descriptorKey) {
    return tabDescriptorState.descriptor;
  }
  return undefined;
}

/** Resolve baseline descriptor for drift — explicit baseline wins when keys match, else tab state. */
export function resolveEffectiveReplayBaseline(input: {
  descriptorKey: string;
  baselineDescriptor?: GrpcDescriptor;
  tabDescriptorState?: GrpcTabDescriptorState;
}): GrpcDescriptor | undefined {
  if (input.baselineDescriptor?.key === input.descriptorKey) {
    return input.baselineDescriptor;
  }
  if (input.tabDescriptorState) {
    return resolveBaselineDescriptorForReplay(input.tabDescriptorState, input.descriptorKey);
  }
  return undefined;
}

const HISTORY_BODY_TRUNCATED_REPLAY_MESSAGE =
  'History body was truncated at capture; replay body may be incomplete.';

const DESCRIPTOR_MISSING_REPLAY_MESSAGE = 'Load a schema before replaying this request.';

/** Blocking drift when the tab has no loaded descriptor for replay/import. */
export function buildDescriptorMissingDrift(
  service: string,
  method: string,
): GrpcSchemaDriftAnalysis {
  return {
    state: 'blocking',
    message: `${DESCRIPTOR_MISSING_REPLAY_MESSAGE} (${service}/${method})`,
    issues: [{
      kind: 'method_missing',
      message: 'No descriptor loaded on the active tab',
    }],
    suggestedRebinds: [],
  };
}

function buildDescriptorKeyMismatchDrift(
  savedDescriptorKey: string,
  loadedDescriptorKey: string,
): GrpcSchemaDriftAnalysis {
  return {
    state: 'blocking',
    message:
      `Saved request targets descriptor "${savedDescriptorKey}" `
      + `but the active tab loaded "${loadedDescriptorKey}". Reload the matching schema before replay.`,
    issues: [{
      kind: 'method_missing',
      message: `Descriptor key mismatch (saved: ${savedDescriptorKey}, loaded: ${loadedDescriptorKey})`,
    }],
    suggestedRebinds: [],
  };
}

function mergeHistoryBodyTruncationDrift(
  drift: GrpcSchemaDriftAnalysis,
  bodyTruncated?: boolean,
): GrpcSchemaDriftAnalysis {
  if (!bodyTruncated || drift.state === 'blocking') {
    return drift;
  }
  const truncationIssue = {
    kind: 'field_removed' as const,
    message: HISTORY_BODY_TRUNCATED_REPLAY_MESSAGE,
  };
  if (drift.state === 'none') {
    return {
      state: 'blocking',
      message: HISTORY_BODY_TRUNCATED_REPLAY_MESSAGE,
      issues: [truncationIssue],
      suggestedRebinds: [],
    };
  }
  return {
    ...drift,
    state: 'blocking',
    message: drift.message
      ? `${drift.message} ${HISTORY_BODY_TRUNCATED_REPLAY_MESSAGE}`
      : HISTORY_BODY_TRUNCATED_REPLAY_MESSAGE,
    issues: [...drift.issues, truncationIssue],
  };
}

/** Analyze schema drift for a replay candidate against the tab's loaded descriptor. */
export function analyzeReplaySchemaDrift(input: {
  currentDescriptor: GrpcDescriptor;
  baselineDescriptor?: GrpcDescriptor;
  service: string;
  method: string;
  body: Record<string, unknown>;
}): GrpcSchemaDriftAnalysis {
  const { currentDescriptor, baselineDescriptor, service, method, body } = input;

  const effectiveBaseline = baselineDescriptor?.key === currentDescriptor.key
    ? baselineDescriptor
    : undefined;

  if (effectiveBaseline) {
    return analyzeGrpcSchemaDrift({
      previousDescriptor: effectiveBaseline,
      nextDescriptor: currentDescriptor,
      service,
      method,
      body,
    });
  }

  const currentMethod = findGrpcMethod(currentDescriptor, service, method);
  if (!currentMethod) {
    return {
      state: 'blocking',
      message: `${service}/${method} is no longer available in the loaded schema.`,
      issues: [{
        kind: 'method_missing',
        message: `Method ${service}/${method} was removed or renamed`,
      }],
      suggestedRebinds: suggestGrpcSchemaRebinds(
        currentDescriptor,
        undefined,
        service,
        method,
      ),
    };
  }

  return analyzeWarningDriftWithBaseline(
    body,
    { typeName: currentMethod.requestSchema.typeName, fields: [] },
    currentMethod,
  );
}

/** Prune replay body to current schema when drift is warning-only (explicit opt-in). */
export function applyGrpcReplaySafeFallbackBody(
  body: Record<string, unknown>,
  drift: GrpcSchemaDriftAnalysis,
  currentDescriptor: GrpcDescriptor,
  service: string,
  method: string,
): Record<string, unknown> {
  if (drift.state !== 'warning') {
    return structuredClone(body);
  }
  const currentMethod = findGrpcMethod(currentDescriptor, service, method);
  if (!currentMethod) {
    return structuredClone(body);
  }
  return pruneGrpcBodyToSchema(body, currentMethod.requestSchema);
}

function bodiesEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** True when replay may proceed (warning/none drift). Blocking drift must gate execute in 5H UI. */
export function isGrpcReplayExecutable(drift: GrpcSchemaDriftAnalysis): boolean {
  return drift.state !== 'blocking';
}

/** True when Send/Start must stay disabled (blocking drift only — warnings allow execute). */
export function isGrpcExecuteBlockedByDrift(driftState: GrpcSchemaDriftAnalysis['state'] | undefined): boolean {
  return driftState === 'blocking';
}

function toReplayResolverInput(
  input: GrpcReplayBindingInput,
  saved: GrpcSavedRequest,
): GrpcReplayResolverInput {
  const {
    currentDescriptor: _currentDescriptor,
    baselineDescriptor: _baselineDescriptor,
    tabDescriptorState: _tabDescriptorState,
    applySafeFallback: _applySafeFallback,
    saved: _saved,
    ...resolverInput
  } = input;
  return { ...resolverInput, saved };
}

/** Saved request or history-derived saved shape → execute snapshot + drift metadata. */
export function resolveGrpcReplayBinding(input: GrpcReplayBindingInput): GrpcReplayBindingResult {
  const baselineDescriptor = resolveEffectiveReplayBaseline({
    descriptorKey: input.saved.descriptorKey,
    baselineDescriptor: input.baselineDescriptor,
    tabDescriptorState: input.tabDescriptorState,
  });

  let drift: GrpcSchemaDriftAnalysis;
  if (
    input.currentDescriptor
    && input.currentDescriptor.key !== input.saved.descriptorKey
  ) {
    drift = buildDescriptorKeyMismatchDrift(
      input.saved.descriptorKey,
      input.currentDescriptor.key,
    );
  } else if (input.currentDescriptor) {
    drift = analyzeReplaySchemaDrift({
      currentDescriptor: input.currentDescriptor,
      baselineDescriptor,
      service: input.saved.service,
      method: input.saved.method,
      body: input.saved.body,
    });
  } else if (input.saved.service?.trim() && input.saved.method?.trim()) {
    drift = buildDescriptorMissingDrift(input.saved.service, input.saved.method);
  } else {
    drift = {
      state: 'none',
      message: '',
      issues: [],
      suggestedRebinds: [],
    };
  }

  let body = structuredClone(input.saved.body);
  let safeFallbackApplied = false;

  if (
    input.applySafeFallback
    && input.currentDescriptor
    && drift.state === 'warning'
  ) {
    const pruned = applyGrpcReplaySafeFallbackBody(
      body,
      drift,
      input.currentDescriptor,
      input.saved.service,
      input.saved.method,
    );
    safeFallbackApplied = !bodiesEqual(body, pruned);
    body = pruned;
  }

  const savedForReplay = bodiesEqual(body, input.saved.body)
    ? input.saved
    : { ...input.saved, body };

  const snapshot = resolveGrpcSavedRequestReplay(
    toReplayResolverInput({
      ...input,
      sourceFingerprint: input.sourceFingerprint
        ?? resolveDescriptorSourceFingerprint(
          input.currentDescriptor,
          input.tabDescriptorState?.sourceFingerprint,
        ),
    }, savedForReplay),
  );

  return {
    snapshot,
    drift,
    body,
    safeFallbackApplied,
  };
}

/** Build a replay-compatible saved-request shape from a persisted history row. */
export function createReplaySavedRequestFromHistoryEntry(
  entry: GrpcCallHistoryEntryV1,
): GrpcSavedRequest {
  const snapshot = entry.record.snapshot;
  const rawTarget = snapshot.target.address?.trim();
  const tabContext: GrpcSavedRequestTabContext | undefined = rawTarget
    && containsGrpcInterpolationToken(rawTarget)
    ? { rawTarget }
    : undefined;
  return createGrpcSavedRequestFromSnapshot(
    snapshot,
    {
      id: entry.id,
      revisionId: entry.id,
      createdAt: entry.capturedAt,
      updatedAt: entry.capturedAt,
    },
    tabContext,
  );
}

/** History entry → execute snapshot via the shared replay binding path. */
export function resolveGrpcHistoryEntryReplay(
  input: GrpcHistoryReplayBindingInput,
): GrpcReplayBindingResult {
  const { entry, ...bindingInput } = input;
  const saved = createReplaySavedRequestFromHistoryEntry(entry);
  const binding = resolveGrpcReplayBinding({
    ...bindingInput,
    saved,
    sourceFingerprint: bindingInput.sourceFingerprint
      ?? resolveDescriptorSourceFingerprint(
        bindingInput.currentDescriptor,
        bindingInput.tabDescriptorState?.sourceFingerprint,
      )
      ?? entry.record.snapshot.sourceFingerprint,
  });
  return {
    ...binding,
    drift: mergeHistoryBodyTruncationDrift(binding.drift, entry.bodyTruncated),
    historyBodyTruncated: entry.bodyTruncated || undefined,
  };
}
