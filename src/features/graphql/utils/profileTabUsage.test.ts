/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import {
  buildProfileTabLinksByProfileId,
  buildStudioTabLinkSlices,
  formatProfileTabLinksDisplay,
  getProfileTabLinks,
  orderProfileTabLinksForDisplay,
} from './profileTabUsage';
import type { ProfileTabLinkSlice } from './profileTabUsage';
import type { GqlStudioTab } from './tabPersistence';
import type { ConnectionProfile } from './connectionProfileStorage';

const tabs: ProfileTabLinkSlice[] = [
  { id: 'tab-1', label: 'Staging', connectionId: 'prof-a' },
  { id: 'tab-2', label: 'Production', connectionId: 'prof-b' },
  { id: 'tab-3', label: 'Staging2', connectionId: 'prof-a' },
  { id: 'tab-4', label: 'Untitled', connectionId: undefined },
];

describe('profileTabUsage', () => {
  it('getProfileTabLinks returns all tabs linked to a profile', () => {
    const links = getProfileTabLinks('prof-a', tabs, 'tab-3');
    expect(links).toEqual([
      { tabId: 'tab-1', label: 'Staging', isActive: false },
      { tabId: 'tab-3', label: 'Staging2', isActive: true },
    ]);
  });

  it('getProfileTabLinks returns empty when no tabs link', () => {
    expect(getProfileTabLinks('missing', tabs, 'tab-1')).toEqual([]);
  });

  it('buildProfileTabLinksByProfileId indexes all profiles', () => {
    const map = buildProfileTabLinksByProfileId(tabs, 'tab-2');
    expect(map.get('prof-a')?.map((l) => l.label)).toEqual(['Staging', 'Staging2']);
    expect(map.get('prof-b')).toEqual([
      { tabId: 'tab-2', label: 'Production', isActive: true },
    ]);
  });

  it('formatProfileTabLinksDisplay summarizes overflow', () => {
    const links = Array.from({ length: 6 }, (_, i) => ({
      tabId: `t${i}`,
      label: `Tab ${i + 1}`,
      isActive: i === 0,
    }));
    const display = formatProfileTabLinksDisplay(links, 3);
    expect(display.visible).toHaveLength(3);
    expect(display.overflowCount).toBe(3);
    expect(display.summary).toContain('+3 more');
    expect(display.summary).toContain('Tab 1 (active)');
  });

  it('formatProfileTabLinksDisplay handles empty links', () => {
    expect(formatProfileTabLinksDisplay([]).summary).toBe('Not linked to any tab');
  });

  it('orderProfileTabLinksForDisplay moves active tab to the front', () => {
    const links = [
      { tabId: 't1', label: 'A', isActive: false },
      { tabId: 't2', label: 'B', isActive: true },
      { tabId: 't3', label: 'C', isActive: false },
    ];
    expect(orderProfileTabLinksForDisplay(links).map((l) => l.tabId)).toEqual(['t2', 't1', 't3']);
  });

  it('formatProfileTabLinksDisplay shows active tab first when capped', () => {
    const links = [
      { tabId: 't1', label: 'A', isActive: false },
      { tabId: 't2', label: 'B', isActive: true },
      { tabId: 't3', label: 'C', isActive: false },
    ];
    const display = formatProfileTabLinksDisplay(links, 2);
    expect(display.visible[0].label).toBe('B');
    expect(display.visible[1].label).toBe('A');
    expect(display.overflowCount).toBe(1);
  });

  it('buildStudioTabLinkSlices uses tab bar presentation labels', () => {
    const tabs: GqlStudioTab[] = [
      {
        id: 'tab-1',
        label: 'Staging',
        labelManual: true,
        query: '',
        variables: '',
        headers: [],
        connectionId: 'prof-staging',
      } as GqlStudioTab,
    ];
    const profiles: ConnectionProfile[] = [
      {
        id: 'prof-staging',
        name: 'GQL-14 Staging',
        endpoint: 'http://localhost:4010/graphql',
        auth: null,
        createdAt: 0,
      },
    ];
    const slices = buildStudioTabLinkSlices(tabs, profiles, 'http://localhost:4010/graphql');
    expect(slices[0].label).toBe('Staging');
  });
});
