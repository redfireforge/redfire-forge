/**
 * envUtils.ts — Phase 1E
 *
 * Pure utilities for resolving {{var}} placeholders against a GraphQL environment.
 * No React dependency — safe to call from any execution context.
 *
 * Resolution rules:
 *   • Single-pass only — nested vars are NOT recursively resolved
 *   • Only `enabled: true` variables are used
 *   • Unresolved references are left as-is (the literal "{{key}}" string remains)
 */

import type { GraphqlEnvironment } from '../../../shared/types/graphql';

/**
 * Builds a lookup map from an environment's enabled variables.
 */
function buildLocalVarMap(env: GraphqlEnvironment | null | undefined): Record<string, string> {
  if (!env) return {};
  const map: Record<string, string> = {};
  for (const v of env.variables) {
    if (v.enabled && v.key.trim()) {
      map[v.key.trim()] = v.value;
    }
  }
  return map;
}

/** Merge global header-context vars with local GraphQL tab vars (local overrides global). */
function mergeVarMaps(
  globalMap: Record<string, string> | undefined,
  env: GraphqlEnvironment | null | undefined,
): Record<string, string> {
  return { ...(globalMap ?? {}), ...buildLocalVarMap(env) };
}

/**
 * Replaces `{{key}}` placeholders in `str` with values from the active environment.
 * Keys are trimmed before lookup. Unresolved references remain unchanged.
 *
 * @example
 *   resolveVars('https://{{host}}/graphql', env)
 *   // → 'https://api.staging.example.com/graphql'
 */
export function resolveVars(
  str: string,
  env: GraphqlEnvironment | null | undefined,
  globalMap?: Record<string, string>,
): string {
  if (!str) return str;
  const vars = mergeVarMaps(globalMap, env);
  if (Object.keys(vars).length === 0) return str;
  return str.replace(/\{\{([^}]+)\}\}/g, (match, key: string) => vars[key.trim()] ?? match);
}

/**
 * Returns the names of all `{{key}}` placeholders in `str` that cannot be resolved
 * against the active environment (either no active env, variable disabled, or key not found).
 *
 * The list is de-duplicated. Returns an empty array when all refs are resolved.
 */
export function findUnresolvedVars(
  str: string,
  env: GraphqlEnvironment | null | undefined,
  globalMap?: Record<string, string>,
): string[] {
  if (!str) return [];
  const vars = mergeVarMaps(globalMap, env);
  const unresolved = new Set<string>();
  str.replace(/\{\{([^}]+)\}\}/g, (_, key: string) => {
    const trimmed = key.trim();
    if (!(trimmed in vars)) unresolved.add(trimmed);
    return '';
  });
  return [...unresolved];
}

/**
 * Returns true if `str` contains at least one `{{key}}` placeholder that cannot be
 * resolved against the active environment.
 */
export function hasUnresolvedVars(
  str: string,
  env: GraphqlEnvironment | null | undefined,
  globalMap?: Record<string, string>,
): boolean {
  return findUnresolvedVars(str, env, globalMap).length > 0;
}
