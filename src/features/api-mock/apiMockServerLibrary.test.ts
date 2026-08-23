import { describe, expect, it } from 'vitest';
import type { ApiMockServerDefinitionV1 } from '@shared/api-mock/contracts';
import { DEFAULT_SETTINGS } from '@shared/api-mock/defaults';
import {
  buildLibraryEntries,
  deleteServersFromLibrary,
  describeLibraryEntry,
  filterLibraryEntries,
  formatDeleteServersMessage,
  formatDeletedServersMessage,
  formatLibraryTimestamp,
  formatOpenedFromLibraryMessage,
  formatParkedMessage,
  formatRestoredServersMessage,
  isAtTabLimit,
  openServerTab,
  parkServerTabs,
  resolveActiveTabId,
  resolveOpenTabIds,
  restoreDeletedServers,
  selectOpenServers,
  selectParkedServers,
  snapshotDeletedServers,
} from './apiMockServerLibrary';

function makeServer(id: string, overrides: Partial<ApiMockServerDefinitionV1> = {}): ApiMockServerDefinitionV1 {
  return {
    id,
    name: id.toUpperCase(),
    enabled: true,
    host: '127.0.0.1',
    port: 4600,
    basePath: '',
    folders: [],
    routes: [],
    samples: [],
    variables: [],
    settings: { ...DEFAULT_SETTINGS },
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('resolveOpenTabIds', () => {
  it('opens every server for a pre-library workspace', () => {
    expect(resolveOpenTabIds([makeServer('a'), makeServer('b')], undefined)).toEqual(['a', 'b']);
  });

  it('honours an explicit empty list as "library only"', () => {
    expect(resolveOpenTabIds([makeServer('a')], [])).toEqual([]);
  });

  it('drops unknown and duplicate ids and clamps to the ceiling', () => {
    const servers = [makeServer('a'), makeServer('b'), makeServer('c')];
    expect(resolveOpenTabIds(servers, ['b', 'gone', 'b', 'a'])).toEqual(['b', 'a']);
    expect(resolveOpenTabIds(servers, ['a', 'b', 'c'], 2)).toEqual(['a', 'b']);
  });
});

describe('resolveActiveTabId', () => {
  it('keeps an open active tab and otherwise falls back to the first', () => {
    expect(resolveActiveTabId(['a', 'b'], 'b')).toBe('b');
    expect(resolveActiveTabId(['a', 'b'], 'parked')).toBe('a');
    expect(resolveActiveTabId([], 'a')).toBeUndefined();
  });
});

describe('library selection', () => {
  const a = makeServer('a', { updatedAt: '2026-08-01T00:00:00.000Z' });
  const b = makeServer('b', { updatedAt: '2026-08-03T00:00:00.000Z' });
  const c = makeServer('c', { updatedAt: '2026-08-02T00:00:00.000Z' });

  it('returns open servers in tab order and ignores missing ids', () => {
    expect(selectOpenServers([a, b, c], ['c', 'a', 'gone']).map(s => s.id)).toEqual(['c', 'a']);
  });

  it('sorts parked servers by most recently saved', () => {
    expect(selectParkedServers([a, b, c], ['a']).map(s => s.id)).toEqual(['b', 'c']);
  });

  it('lists open tabs first, then parked servers, with counts', () => {
    const withContent = makeServer('d', {
      routes: [{ id: 'r1' }, { id: 'r2' }] as ApiMockServerDefinitionV1['routes'],
      samples: [{ id: 's1' }] as ApiMockServerDefinitionV1['samples'],
    });
    const entries = buildLibraryEntries([a, withContent], ['a']);
    expect(entries.map(e => [e.server.id, e.open])).toEqual([['a', true], ['d', false]]);
    expect(entries[1].ruleCount).toBe(2);
    expect(entries[1].exampleCount).toBe(1);
  });
});

describe('filterLibraryEntries', () => {
  const entries = buildLibraryEntries(
    [
      makeServer('a', { name: 'Orders API', port: 4600 }),
      makeServer('b', {
        name: 'Users',
        port: 4611,
        routes: [{ id: 'r1', name: 'list', path: { kind: 'exact', value: '/accounts' } }] as ApiMockServerDefinitionV1['routes'],
      }),
    ],
    ['a', 'b'],
  );

  it('returns everything for a blank query', () => {
    expect(filterLibraryEntries(entries, '   ')).toHaveLength(2);
  });

  it('matches name, port, and rule path case-insensitively', () => {
    expect(filterLibraryEntries(entries, 'orders').map(e => e.server.id)).toEqual(['a']);
    expect(filterLibraryEntries(entries, '4611').map(e => e.server.id)).toEqual(['b']);
    expect(filterLibraryEntries(entries, '/ACCOUNTS').map(e => e.server.id)).toEqual(['b']);
    expect(filterLibraryEntries(entries, 'nothing')).toEqual([]);
  });
});

describe('library row copy', () => {
  it('describes rules and only mentions examples when present', () => {
    expect(describeLibraryEntry({ server: makeServer('a'), open: false, ruleCount: 1, exampleCount: 0 })).toBe('1 rule');
    expect(describeLibraryEntry({ server: makeServer('a'), open: false, ruleCount: 3, exampleCount: 2 })).toBe('3 rules · 2 examples');
    expect(describeLibraryEntry({ server: makeServer('a'), open: false, ruleCount: 0, exampleCount: 1 })).toBe('0 rules · 1 example');
  });

  it('formats relative save timestamps and degrades safely', () => {
    const now = Date.parse('2026-08-13T12:00:00.000Z');
    expect(formatLibraryTimestamp(undefined, now)).toBe('Saved');
    expect(formatLibraryTimestamp('not-a-date', now)).toBe('Saved');
    expect(formatLibraryTimestamp('2026-08-13T11:59:40.000Z', now)).toBe('Saved just now');
    expect(formatLibraryTimestamp('2026-08-13T11:30:00.000Z', now)).toBe('Saved 30m ago');
    expect(formatLibraryTimestamp('2026-08-13T06:00:00.000Z', now)).toBe('Saved 6h ago');
    expect(formatLibraryTimestamp('2026-08-08T12:00:00.000Z', now)).toBe('Saved 5d ago');
    expect(formatLibraryTimestamp('2025-08-13T12:00:00.000Z', now)).toMatch(/^Saved /);
  });
});

describe('parkServerTabs', () => {
  it('is a no-op when nothing closes', () => {
    expect(parkServerTabs(['a', 'b'], 'a', [])).toEqual({ openTabIds: ['a', 'b'], activeServerId: 'a' });
    expect(parkServerTabs(['a', 'b'], 'a', ['gone'])).toEqual({ openTabIds: ['a', 'b'], activeServerId: 'a' });
  });

  it('keeps the active tab when it stays open', () => {
    expect(parkServerTabs(['a', 'b'], 'b', ['a'])).toEqual({ openTabIds: ['b'], activeServerId: 'b' });
  });

  it('activates the nearest surviving tab', () => {
    expect(parkServerTabs(['a', 'b', 'c'], 'c', ['c'])).toEqual({ openTabIds: ['a', 'b'], activeServerId: 'b' });
    expect(parkServerTabs(['a', 'b', 'c'], 'a', ['a'])).toEqual({ openTabIds: ['b', 'c'], activeServerId: 'b' });
  });

  it('clears the selection when the last tab closes', () => {
    expect(parkServerTabs(['a'], 'a', ['a'])).toEqual({ openTabIds: [], activeServerId: undefined });
  });

  it('falls back to the first tab when the active id was never open', () => {
    expect(parkServerTabs(['a', 'b'], 'parked', ['b'])).toEqual({ openTabIds: ['a'], activeServerId: 'a' });
  });
});

describe('openServerTab', () => {
  it('activates an already-open tab without reordering', () => {
    const open = ['a', 'b'];
    expect(openServerTab(open, 'a')).toEqual({ openTabIds: open, activeServerId: 'a', atLimit: false });
  });

  it('appends a parked server', () => {
    expect(openServerTab(['a'], 'b')).toEqual({ openTabIds: ['a', 'b'], activeServerId: 'b', atLimit: false });
  });

  it('reports the ceiling instead of opening a ninth tab', () => {
    const full = ['1', '2'];
    expect(openServerTab(full, 'x', 2)).toEqual({ openTabIds: full, activeServerId: 'x', atLimit: true });
    expect(isAtTabLimit(full, 2)).toBe(true);
    expect(isAtTabLimit(full, 3)).toBe(false);
  });
});

describe('delete and undo', () => {
  const a = makeServer('a');
  const b = makeServer('b');
  const c = makeServer('c');

  it('removes servers from both the library and the tab bar', () => {
    expect(deleteServersFromLibrary([a, b, c], ['a', 'b'], 'a', ['a'])).toEqual({
      servers: [b, c],
      openTabIds: ['b'],
      activeServerId: 'b',
    });
  });

  it('is a no-op for an empty delete list', () => {
    expect(deleteServersFromLibrary([a], ['a'], 'a', [])).toEqual({
      servers: [a],
      openTabIds: ['a'],
      activeServerId: 'a',
    });
  });

  it('round-trips a deleted server back to its library and tab position', () => {
    const snapshot = snapshotDeletedServers([a, b, c], ['a', 'b'], 'a', ['b']);
    expect(snapshot.entries).toEqual([{ server: b, index: 1, tabIndex: 1 }]);
    const deleted = deleteServersFromLibrary([a, b, c], ['a', 'b'], 'a', ['b']);
    expect(restoreDeletedServers(deleted.servers, deleted.openTabIds, snapshot)).toEqual({
      servers: [a, b, c],
      openTabIds: ['a', 'b'],
      activeServerId: 'a',
    });
  });

  it('restores a parked server without giving it a tab', () => {
    const snapshot = snapshotDeletedServers([a, b], ['a'], 'a', ['b']);
    expect(snapshot.entries[0].tabIndex).toBe(-1);
    const restored = restoreDeletedServers([a], ['a'], snapshot);
    expect(restored.servers.map(s => s.id)).toEqual(['a', 'b']);
    expect(restored.openTabIds).toEqual(['a']);
    expect(restored.activeServerId).toBe('a');
  });

  it('skips servers that already came back and respects the tab ceiling', () => {
    const snapshot = snapshotDeletedServers([a, b], ['a', 'b'], 'b', ['b']);
    expect(restoreDeletedServers([a, b], ['a', 'b'], snapshot).servers).toHaveLength(2);
    // Tab bar already full: the definition returns to the library only.
    const restored = restoreDeletedServers([a], ['a'], snapshot, 1);
    expect(restored.openTabIds).toEqual(['a']);
    expect(restored.activeServerId).toBe('a');
  });
});

describe('library copy', () => {
  it('tells the user where closed rules went', () => {
    expect(formatParkedMessage(['Orders'])).toBe('Orders closed — still saved in Saved servers.');
    expect(formatParkedMessage(['Orders', 'Users'])).toBe('2 mock servers closed — still saved in Saved servers.');
    expect(formatOpenedFromLibraryMessage('Orders')).toBe('Orders opened from Saved servers.');
  });

  it('spells out what a delete removes', () => {
    expect(formatDeleteServersMessage([{ name: 'Orders', routes: [{}, {}] }]))
      .toBe('Delete "Orders" and its 2 rules? This removes it from Saved servers.');
    expect(formatDeleteServersMessage([{ name: 'Orders', routes: [{}] }])).toContain('its 1 rule?');
    expect(formatDeleteServersMessage([{ name: 'Orders' }])).toContain('its 0 rules?');
    expect(formatDeleteServersMessage([{ name: 'Orders' }, { name: 'Users' }]))
      .toBe('Delete 2 mock servers and all of their rules? This removes them from Saved servers.');
  });

  it('announces deletes and restores', () => {
    expect(formatDeletedServersMessage(['Orders'])).toBe('Orders deleted.');
    expect(formatDeletedServersMessage(['Orders', 'Users'])).toBe('2 mock servers deleted.');
    expect(formatRestoredServersMessage(['Orders'])).toBe('Orders restored.');
    expect(formatRestoredServersMessage(['Orders', 'Users'])).toBe('2 mock servers restored.');
  });
});

describe('sparse server definitions', () => {
  // Servers written by older builds (or hand-edited files) can omit optional
  // collections; every library read must survive that without throwing.
  const sparse = {
    ...makeServer('sparse'),
    basePath: undefined,
    routes: undefined,
    samples: undefined,
    updatedAt: undefined,
  } as unknown as ApiMockServerDefinitionV1;

  it('counts missing rule and example arrays as empty', () => {
    const [entry] = buildLibraryEntries([sparse], []);
    expect(entry).toMatchObject({ open: false, ruleCount: 0, exampleCount: 0 });
    expect(describeLibraryEntry(entry)).toBe('0 rules');
  });

  it('sorts and searches without optional fields', () => {
    expect(selectParkedServers([sparse, makeServer('later', { updatedAt: '2026-08-02T00:00:00.000Z' })], []))
      .toHaveLength(2);
    const entries = buildLibraryEntries([sparse], []);
    expect(filterLibraryEntries(entries, 'sparse')).toHaveLength(1);
    expect(filterLibraryEntries(entries, 'nope')).toHaveLength(0);
  });

  it('falls back to a neutral timestamp label', () => {
    expect(formatLibraryTimestamp(undefined)).toBe('Saved');
  });

  it('parks tabs when no server is active', () => {
    expect(parkServerTabs(['a', 'b'], undefined, ['a'])).toEqual({ openTabIds: ['b'], activeServerId: 'b' });
  });
});
