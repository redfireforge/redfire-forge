/**
 * Phase 9C — deterministic env-map precedence merge for gRPC interpolation.
 *
 * Merge order (lowest → highest; later layers override earlier keys):
 *   workspaceDefaults → activeEnvironment → profileVariables → tabOverrides
 *
 * Connection *target* precedence (tab → profile → page default) remains in
 * `resolveGrpcTabConnection.ts` — this module covers env *variable* maps only.
 */

export interface GrpcInterpolationEnvLayers {
  /** Header / workspace context vars (lowest precedence). */
  workspaceDefaults?: Readonly<Record<string, string>>;
  /** Active environment selection from env manager. */
  activeEnvironment?: Readonly<Record<string, string>>;
  /** Optional vars bound to a linked connection profile. */
  profileVariables?: Readonly<Record<string, string>>;
  /** Optional per-tab env overrides (highest precedence). */
  tabOverrides?: Readonly<Record<string, string>>;
}

const LAYER_ORDER = [
  'workspaceDefaults',
  'activeEnvironment',
  'profileVariables',
  'tabOverrides',
] as const satisfies readonly (keyof GrpcInterpolationEnvLayers)[];

function copyLayer(
  layer: Readonly<Record<string, string>> | undefined,
): Record<string, string> {
  if (!layer) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(layer)) {
    const trimmedKey = key.trim();
    if (!trimmedKey) continue;
    out[trimmedKey] = value;
  }
  return out;
}

/** Normalize flat env maps (trim keys, drop empty) — matches layer merge semantics. */
export function normalizeGrpcInterpolationEnvMap(
  env: Readonly<Record<string, string>>,
): Record<string, string> {
  return copyLayer(env);
}

/** Merge env layers with deterministic override semantics. */
export function mergeGrpcInterpolationEnvLayers(
  layers: GrpcInterpolationEnvLayers,
): Record<string, string> {
  const merged: Record<string, string> = {};
  for (const layerKey of LAYER_ORDER) {
    const layer = copyLayer(layers[layerKey]);
    Object.assign(merged, layer);
  }
  return merged;
}

/** Stable fingerprint for a flat env map (sorted keys). */
export function computeGrpcInterpolationEnvFingerprint(
  env: Readonly<Record<string, string>>,
): string {
  const keys = Object.keys(env).sort();
  if (keys.length === 0) return '';
  return keys.map((key) => `${key}=${env[key] ?? ''}`).join('\n');
}

/** Fingerprint each layer independently — useful for change detection tests. */
export function computeGrpcInterpolationEnvLayerFingerprints(
  layers: GrpcInterpolationEnvLayers,
): Record<keyof GrpcInterpolationEnvLayers, string> {
  return {
    workspaceDefaults: computeGrpcInterpolationEnvFingerprint(
      layers.workspaceDefaults ?? {},
    ),
    activeEnvironment: computeGrpcInterpolationEnvFingerprint(
      layers.activeEnvironment ?? {},
    ),
    profileVariables: computeGrpcInterpolationEnvFingerprint(
      layers.profileVariables ?? {},
    ),
    tabOverrides: computeGrpcInterpolationEnvFingerprint(
      layers.tabOverrides ?? {},
    ),
  };
}

export interface BuildGrpcStudioInterpolationEnvLayersInput {
  workspaceDefaults?: Record<string, string>;
  activeEnvironment?: Record<string, string>;
  profileVariables?: Record<string, string>;
  tabOverrides?: Record<string, string>;
}

/** Build Studio env layers from runtime context fields. */
export function buildGrpcStudioInterpolationEnvLayers(
  input: BuildGrpcStudioInterpolationEnvLayersInput,
): GrpcInterpolationEnvLayers {
  return {
    workspaceDefaults: input.workspaceDefaults ?? {},
    activeEnvironment: input.activeEnvironment ?? {},
    profileVariables: input.profileVariables ?? {},
    tabOverrides: input.tabOverrides ?? {},
  };
}

export interface ResolveGrpcTabInterpolationEnvInput {
  workspaceDefaults?: Record<string, string>;
  activeEnvironment: Record<string, string>;
  profiles: ReadonlyArray<{ id: string; variables?: Record<string, string> }>;
  connectionId?: string;
  tabOverrides?: Record<string, string>;
}

/** Resolve env layers for a tab/scenario/node using linked profile + tab overrides. */
export function resolveGrpcTabInterpolationEnvLayers(
  input: ResolveGrpcTabInterpolationEnvInput,
): GrpcInterpolationEnvLayers {
  const linkedProfile = input.profiles.find((entry) => entry.id === input.connectionId);
  return buildGrpcStudioInterpolationEnvLayers({
    workspaceDefaults: input.workspaceDefaults,
    activeEnvironment: input.activeEnvironment,
    profileVariables: linkedProfile?.variables,
    tabOverrides: input.tabOverrides,
  });
}

/** Merged flat env map for a tab/scenario/node (Studio live UI + execute paths). */
export function mergeGrpcTabInterpolationEnv(
  input: ResolveGrpcTabInterpolationEnvInput,
): Record<string, string> {
  return mergeGrpcInterpolationEnvLayers(resolveGrpcTabInterpolationEnvLayers(input));
}
