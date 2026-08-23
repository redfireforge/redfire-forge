import type { GraphqlEnvironment } from '@shared/types/graphql';
import type { ConnectionProfile } from './connectionProfileStorage';
import type { GqlStudioTab } from './tabPersistence';
import { resolveVars } from './envUtils';
import { deriveEndpointHostnameBadge, normalizeGraphqlEndpoint } from './graphqlEndpointUtils';
import { resolveTabRawEndpoint } from './tabConnectionResolution';

export { resolveTabRawEndpoint };

export interface BatchEndpointGroup {
  /** Normalized resolved endpoint — stable group key. */
  key: string;
  /** Fully resolved endpoint URL shared by every tab in the group. */
  resolvedEndpoint: string;
  /** Short host:port label for the group picker. */
  displayLabel: string;
  tabIds: string[];
}

export interface BuildBatchGroupsOptions {
  /** When set, only tabs for this demo lesson appear in batch groups (§11.0). */
  demoLessonId?: string | null;
}

/**
 * Resolve + normalize the endpoint a tab would use for batch execution.
 * Normalization (localhost ↔ 127.0.0.1, trim, strip BOM) keeps env-var tabs and
 * literal overrides in the same group when they target the same server.
 */
export function resolveTabBatchEndpoint(
  tab: GqlStudioTab,
  pageDefaultEndpoint: string,
  activeEnvironment: GraphqlEnvironment | null,
  globalEnvMap: Record<string, string> | undefined,
  profiles: ConnectionProfile[],
): string {
  const raw = resolveTabRawEndpoint(tab, profiles, pageDefaultEndpoint);
  const resolved = resolveVars(raw, activeEnvironment, globalEnvMap).trim();
  // Keep unresolved templates as-is so they don't falsely merge with literals.
  if (!resolved || /\{\{[^}]+\}\}/.test(resolved)) return resolved;
  return normalizeGraphqlEndpoint(resolved);
}

/**
 * Phase 6G — group non-subscription tabs by resolved endpoint for batch scope.
 * Demo mode passes demoLessonId so user tabs never enter the group list.
 */
export function buildBatchGroups(
  tabs: GqlStudioTab[],
  pageDefaultEndpoint: string,
  activeEnvironment: GraphqlEnvironment | null,
  globalEnvMap: Record<string, string> | undefined,
  profiles: ConnectionProfile[] = [],
  options: BuildBatchGroupsOptions = {},
): BatchEndpointGroup[] {
  const { demoLessonId = null } = options;
  const eligible = tabs.filter((tab) => {
    if (tab.operationType === 'subscription') return false;
    if (demoLessonId && tab.demoLessonId !== demoLessonId) return false;
    return true;
  });

  const byKey = new Map<string, { resolvedEndpoint: string; tabIds: string[] }>();

  for (const tab of eligible) {
    const resolvedEndpoint = resolveTabBatchEndpoint(
      tab,
      pageDefaultEndpoint,
      activeEnvironment,
      globalEnvMap,
      profiles,
    );
    const key = resolvedEndpoint || '__blank__';
    const existing = byKey.get(key);
    if (existing) {
      existing.tabIds.push(tab.id);
    } else {
      byKey.set(key, { resolvedEndpoint, tabIds: [tab.id] });
    }
  }

  return Array.from(byKey.entries())
    .map(([key, { resolvedEndpoint, tabIds }]) => {
      const displayLabel = key === '__blank__'
        ? '(no endpoint)'
        : (deriveEndpointHostnameBadge(resolvedEndpoint) ?? resolvedEndpoint);
      return { key, resolvedEndpoint, displayLabel, tabIds };
    })
    .sort((a, b) => a.displayLabel.localeCompare(b.displayLabel));
}

export interface BatchEndpointParityResult {
  /** True when every batched tab resolves to the same non-empty endpoint. */
  hasParity: boolean;
  /** Shared resolved endpoint when hasParity; null when tabs differ or endpoint is blank. */
  commonResolvedEndpoint: string | null;
  /** True when two or more batched tabs resolve to different endpoints. */
  mismatch: boolean;
}

/**
 * Phase 6A-8 — verify checked batch tabs share one resolved endpoint.
 * Batch HTTP requests require a single server URL; mixed endpoints must be blocked.
 */
export function evaluateBatchEndpointParity(
  batchedTabs: GqlStudioTab[],
  pageDefaultEndpoint: string,
  activeEnvironment: GraphqlEnvironment | null,
  globalEnvMap?: Record<string, string>,
  profiles: ConnectionProfile[] = [],
): BatchEndpointParityResult {
  if (batchedTabs.length < 2) {
    return { hasParity: true, commonResolvedEndpoint: null, mismatch: false };
  }

  const resolved = batchedTabs.map((tab) =>
    resolveTabBatchEndpoint(tab, pageDefaultEndpoint, activeEnvironment, globalEnvMap, profiles),
  );

  const first = resolved[0];
  const hasParity = Boolean(first?.length) && resolved.every((ep) => ep === first);

  return {
    hasParity,
    commonResolvedEndpoint: hasParity ? first : null,
    mismatch: !hasParity,
  };
}
