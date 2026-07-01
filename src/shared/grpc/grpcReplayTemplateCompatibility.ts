/**
 * Phase 9F — replay portability contract for template-based saved requests.
 */
import type { GrpcTabExecuteSnapshot } from './contracts';
import { containsGrpcInterpolationToken } from './grpcInterpolationGrammar';
import type { GrpcInterpolationEnvSnapshot } from './grpcInterpolationEnvSnapshot';
import { createGrpcInterpolationTemplateResolver } from './grpcInterpolationResolver';
import type { GrpcSavedRequest } from './grpcSavedRequest';
import type { GrpcInterpolationTemplateSource } from './grpcInterpolationPersistGuard';

/** Template fields captured alongside execute snapshot for history replay portability. */
export interface GrpcCallHistoryTemplateContext {
  rawTarget?: string;
  /** Resolved target for denormalized history filter UI — defaults to snapshot address. */
  filterTarget?: string;
}

export interface GrpcSavedRequestTabContext {
  connectionId?: string;
  rawTarget?: string;
  rawBody?: Record<string, unknown>;
  rawMetadata?: Record<string, string>;
  rawAuth?: GrpcSavedRequest['auth'];
  interpolationEnv?: Readonly<Record<string, string>>;
}

/** Build template source from Studio tab fields at save/replay time. */
export function buildGrpcSavedRequestTemplateSource(
  tabContext?: GrpcSavedRequestTabContext,
): GrpcInterpolationTemplateSource | undefined {
  if (!tabContext) return undefined;
  const hasSource = Boolean(
    tabContext.rawTarget?.trim()
    || tabContext.rawBody
    || tabContext.rawMetadata
    || tabContext.rawAuth
    || tabContext.connectionId?.trim(),
  );
  if (!hasSource) return undefined;
  return {
    connectionId: tabContext.connectionId,
    target: tabContext.rawTarget,
    body: tabContext.rawBody ? structuredClone(tabContext.rawBody) : undefined,
    metadata: tabContext.rawMetadata ? { ...tabContext.rawMetadata } : undefined,
    auth: tabContext.rawAuth ? structuredClone(tabContext.rawAuth) : undefined,
    interpolationEnv: tabContext.interpolationEnv
      ? { ...tabContext.interpolationEnv }
      : undefined,
  };
}

/** Saved requests must not embed runtime interpolation snapshots. */
export function assertGrpcSavedRequestPortable(saved: GrpcSavedRequest): void {
  const record = saved as GrpcSavedRequest & { interpolationEnv?: unknown };
  if (record.interpolationEnv !== undefined) {
    throw new Error('Saved requests must not persist interpolationEnv snapshots');
  }
}

/** Replay execute snapshots must bind a fresh env snapshot — not reuse a stale fingerprint. */
export function assertGrpcReplayUsesFreshInterpolationEnv(
  prior: GrpcInterpolationEnvSnapshot | undefined,
  next: GrpcInterpolationEnvSnapshot | undefined,
): void {
  if (!next) {
    throw new Error('Replay execute snapshot must include interpolationEnv');
  }
  if (
    prior
    && prior.fingerprint === next.fingerprint
    && prior.capturedAt === next.capturedAt
    && prior === next
  ) {
    throw new Error('Replay execute snapshot reused stale interpolationEnv object');
  }
}

/**
 * Store template target in persisted history snapshot while keeping resolved target
 * on the denormalized entry row for filter UI (Phase 9F).
 */
export function applyGrpcCallHistoryTemplateContext(
  snapshot: GrpcTabExecuteSnapshot,
  templateContext?: GrpcCallHistoryTemplateContext,
): { snapshot: GrpcTabExecuteSnapshot; filterTarget?: string } {
  const rawTarget = templateContext?.rawTarget?.trim();
  const filterTarget = templateContext?.filterTarget?.trim()
    ?? snapshot.target.address?.trim()
    ?? undefined;

  if (!rawTarget || !containsGrpcInterpolationToken(rawTarget)) {
    return { snapshot, filterTarget };
  }

  return {
    snapshot: {
      ...snapshot,
      target: {
        ...snapshot.target,
        address: rawTarget,
      },
    },
    filterTarget,
  };
}

/** Whether a replay snapshot resolved target using the bound env (not the persisted literal). */
export function grpcReplayTargetMatchesEnvResolution(input: {
  savedTarget?: string;
  replaySnapshot: GrpcTabExecuteSnapshot;
  envVarMap: Readonly<Record<string, string>>;
}): boolean {
  const template = input.savedTarget?.trim();
  if (!template) {
    return !input.replaySnapshot.target.address?.trim();
  }
  if (!containsGrpcInterpolationToken(template)) {
    return input.replaySnapshot.target.address === template;
  }
  const resolver = createGrpcInterpolationTemplateResolver(input.envVarMap);
  return input.replaySnapshot.target.address === resolver(template);
}
