import { deriveTabLabel } from './monacoGraphqlSetup';
import { deriveEndpointHostnameBadge } from './graphqlEndpointUtils';
import type { GqlStudioTab } from './tabPersistence';

/** True when the tab label may be derived from query, endpoint, or profile. */
export function isAutoLabelEligible(
  tab: Pick<GqlStudioTab, 'label' | 'labelManual'>,
): boolean {
  if (!tab.labelManual) return true;
  const trimmed = tab.label.trim();
  return trimmed === '' || trimmed === 'Untitled';
}

function effectiveEndpoint(
  tab: Pick<GqlStudioTab, 'endpoint'>,
  resolvedEndpoint?: string | null,
): string {
  if (tab.endpoint !== undefined) return tab.endpoint.trim();
  return resolvedEndpoint?.trim() || '';
}

/**
 * Derives the auto tab label from query text, per-tab endpoint, or linked profile.
 * Manual labels (labelManual) are preserved by the caller unless still "Untitled".
 */
export function computeAutoTabLabel(
  tab: Pick<GqlStudioTab, 'query' | 'endpoint' | 'connectionId'>,
  profileName?: string | null,
  resolvedEndpoint?: string | null,
): string {
  const fromQuery = deriveTabLabel(tab.query);
  if (fromQuery !== 'Untitled') return fromQuery;

  const endpoint = effectiveEndpoint(tab, resolvedEndpoint);
  if (endpoint) {
    const host = deriveEndpointHostnameBadge(endpoint);
    if (host) return host;
  }

  const trimmedProfile = profileName?.trim();
  if (trimmedProfile) return trimmedProfile;

  return 'Untitled';
}

export function withAutoTabLabel(
  tab: GqlStudioTab,
  profileName?: string | null,
  resolvedEndpoint?: string | null,
): GqlStudioTab {
  if (!isAutoLabelEligible(tab)) return tab;
  const label = computeAutoTabLabel(tab, profileName, resolvedEndpoint);
  return label === tab.label ? tab : { ...tab, label };
}

/** Resolved title + optional subtitle for tab bar rendering. */
export function getTabPresentation(
  tab: Pick<GqlStudioTab, 'label' | 'labelManual' | 'query' | 'endpoint' | 'connectionId'>,
  profileName?: string | null,
  resolvedEndpoint?: string | null,
): { title: string; subtitle: string | null } {
  const autoLabel = isAutoLabelEligible(tab);
  const title = autoLabel
    ? computeAutoTabLabel(tab, profileName, resolvedEndpoint)
    : (tab.label.trim() || 'Untitled');

  const profile = profileName?.trim() || null;
  const hasPerTabEndpointOverride = tab.endpoint !== undefined && Boolean(tab.endpoint.trim());
  const endpointHost = hasPerTabEndpointOverride
    ? deriveEndpointHostnameBadge(tab.endpoint!.trim())
    : null;
  const connectionHint = profile ?? endpointHost;
  const subtitle = connectionHint && connectionHint !== title ? connectionHint : null;

  return { title, subtitle };
}

export function normalizeTabLabels(
  tabs: GqlStudioTab[],
  profileNameForTab: (tab: GqlStudioTab) => string | null | undefined,
  resolvedEndpointForTab?: (tab: GqlStudioTab) => string | null | undefined,
): GqlStudioTab[] {
  let changed = false;
  const next = tabs.map((tab) => {
    const updated = withAutoTabLabel(
      tab,
      profileNameForTab(tab),
      resolvedEndpointForTab?.(tab),
    );
    if (updated !== tab) changed = true;
    return updated;
  });
  return changed ? next : tabs;
}
