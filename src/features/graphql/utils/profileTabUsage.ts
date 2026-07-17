/**
 * Maps connection profiles → workspace tabs that link via tab.connectionId.
 */
import type { ConnectionProfile } from './connectionProfileStorage';
import { findProfileById, resolveTabLabelEndpoint } from './tabConnectionResolution';
import { getTabPresentation } from './tabLabelUtils';
import type { GqlStudioTab } from './tabPersistence';

export type ProfileTabLinkRef = {
  tabId: string;
  label: string;
  isActive: boolean;
};

export type ProfileTabLinkSlice = Pick<GqlStudioTab, 'id' | 'label' | 'connectionId'>;

/** Tab slices with labels matching the tab bar (`getTabPresentation` title). */
export function buildStudioTabLinkSlices(
  tabs: ReadonlyArray<GqlStudioTab>,
  profiles: ReadonlyArray<ConnectionProfile>,
  pageDefaultEndpoint: string,
  pageDefaultEndpointResolved?: string,
): ProfileTabLinkSlice[] {
  const profileList = [...profiles];
  return tabs.map((tab) => {
    const profileName = findProfileById(profileList, tab.connectionId)?.name ?? null;
    const labelEndpoint = resolveTabLabelEndpoint(
      tab,
      profileList,
      pageDefaultEndpoint,
      pageDefaultEndpointResolved,
    );
    const { title } = getTabPresentation(tab, profileName, labelEndpoint);
    return {
      id: tab.id,
      label: title,
      connectionId: tab.connectionId,
    };
  });
}

/** Tabs whose connectionId matches the given profile. */
export function getProfileTabLinks(
  profileId: string,
  tabs: ReadonlyArray<ProfileTabLinkSlice>,
  activeTabId: string | null,
): ProfileTabLinkRef[] {
  return tabs
    .filter((tab) => tab.connectionId === profileId)
    .map((tab) => ({
      tabId: tab.id,
      label: tab.label.trim() || 'Untitled',
      isActive: tab.id === activeTabId,
    }));
}

export function buildProfileTabLinksByProfileId(
  tabs: ReadonlyArray<ProfileTabLinkSlice>,
  activeTabId: string | null,
): Map<string, ProfileTabLinkRef[]> {
  const map = new Map<string, ProfileTabLinkRef[]>();
  for (const tab of tabs) {
    const profileId = tab.connectionId;
    if (!profileId) continue;
    const label = tab.label.trim() || 'Untitled';
    const entry: ProfileTabLinkRef = {
      tabId: tab.id,
      label,
      isActive: tab.id === activeTabId,
    };
    const list = map.get(profileId);
    if (list) list.push(entry);
    else map.set(profileId, [entry]);
  }
  return map;
}

export type ProfileTabLinksDisplay = {
  visible: ProfileTabLinkRef[];
  overflowCount: number;
  /** Full list for tooltips / aria-label. */
  summary: string;
};

/** Active tab first, then original tab-bar order for the rest. */
export function orderProfileTabLinksForDisplay(links: ProfileTabLinkRef[]): ProfileTabLinkRef[] {
  if (links.length <= 1) return links;
  const activeIdx = links.findIndex((l) => l.isActive);
  if (activeIdx <= 0) return links;
  const rest = links.filter((_, i) => i !== activeIdx);
  return [links[activeIdx], ...rest];
}

/** Caps visible tab pills; overflow summarized as "+N more". */
export function formatProfileTabLinksDisplay(
  links: ProfileTabLinkRef[],
  maxVisible = 4,
): ProfileTabLinksDisplay {
  if (links.length === 0) {
    return { visible: [], overflowCount: 0, summary: 'Not linked to any tab' };
  }
  const ordered = orderProfileTabLinksForDisplay(links);
  const visible = ordered.slice(0, maxVisible);
  const overflowCount = Math.max(0, ordered.length - maxVisible);
  const names = ordered.map((l) => (l.isActive ? `${l.label} (active)` : l.label));
  const summary = overflowCount > 0
    ? `${names.join(', ')} (+${overflowCount} more)`
    : names.join(', ');
  return { visible, overflowCount, summary };
}
