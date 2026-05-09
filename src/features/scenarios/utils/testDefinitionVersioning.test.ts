import { describe, it, expect } from 'vitest';
import {
  createSnapshot,
  computeSnapshotFingerprint,
  hasChanged,
  generateChangeSummary,
  createTestDefinitionVersion,
  addVersionToList,
  autoSaveVersion,
  computeSnapshotDiff,
  countDefinitionVersions,
  stripDefinitionVersions,
  hasDefinitionVersions,
} from './testDefinitionVersioning';
import type { Scenario, TestDefinitionVersion } from '../../../shared/types';

const baseScenario: Scenario = {
  id: 'test-1',
  name: 'Test API',
  url: 'https://api.example.com/users',
  method: 'GET',
  headers: [{ key: 'Accept', value: 'application/json', enabled: true }],
  body: '',
  auth: { type: 'none' },
  validation: { mode: 'none', statusCode: 200 },
};

const mkScenario = (overrides?: Partial<Scenario>): Scenario => ({ ...baseScenario, ...overrides });

describe('createSnapshot', () => {
  it('creates a snapshot with the correct fields', () => {
    const snap = createSnapshot(baseScenario);
    expect(snap.name).toBe('Test API');
    expect(snap.url).toBe('https://api.example.com/users');
    expect(snap.method).toBe('GET');
    expect(snap.headers).toEqual([{ key: 'Accept', value: 'application/json', enabled: true }]);
    expect(snap.body).toBe('');
    expect(snap.auth).toEqual({ type: 'none' });
  });

  it('excludes id, validation, and runtime fields', () => {
    const snap = createSnapshot(baseScenario) as Record<string, unknown>;
    expect(snap.id).toBeUndefined();
    expect(snap.validation).toBeUndefined();
    expect(snap.featureGroupName).toBeUndefined();
    expect(snap.groupName).toBeUndefined();
    expect(snap.fetchHostOverride).toBeUndefined();
    expect(snap.fetchHostEnabled).toBeUndefined();
  });

  it('includes optional fields when present', () => {
    const s = mkScenario({
      bodyType: 'json',
      bodyForm: [{ key: 'k', value: 'v', type: 'text', enabled: true }],
      extractions: [{ source: 'body', path: '$.id', variable: 'userId' }],
    });
    const snap = createSnapshot(s);
    expect(snap.bodyType).toBe('json');
    expect(snap.bodyForm).toHaveLength(1);
    expect(snap.extractions).toHaveLength(1);
  });

  it('prefers dataSource urlTemplate over scenario url', () => {
    const s = mkScenario({
      url: 'https://draft.example.com',
      dataSource: { urlTemplate: 'https://template.example.com/{{vin}}', columns: [], rows: [] },
    });
    expect(createSnapshot(s).url).toBe('https://template.example.com/{{vin}}');
  });
});

describe('computeSnapshotFingerprint', () => {
  it('returns a string', () => {
    const snap = createSnapshot(baseScenario);
    expect(typeof computeSnapshotFingerprint(snap)).toBe('string');
  });

  it('returns the same fingerprint for identical snapshots', () => {
    const snap1 = createSnapshot(baseScenario);
    const snap2 = createSnapshot(baseScenario);
    expect(computeSnapshotFingerprint(snap1)).toBe(computeSnapshotFingerprint(snap2));
  });

  it('returns different fingerprints for different snapshots', () => {
    const snap1 = createSnapshot(baseScenario);
    const snap2 = createSnapshot(mkScenario({ url: 'https://api.example.com/other' }));
    expect(computeSnapshotFingerprint(snap1)).not.toBe(computeSnapshotFingerprint(snap2));
  });
});

describe('hasChanged', () => {
  it('returns true when no versions exist', () => {
    expect(hasChanged(baseScenario, [])).toBe(true);
  });

  it('returns false when the latest version matches', () => {
    const snap = createSnapshot(baseScenario);
    const version: TestDefinitionVersion = {
      id: 'v1',
      timestamp: Date.now(),
      snapshot: snap,
    };
    expect(hasChanged(baseScenario, [version])).toBe(false);
  });

  it('returns true when the scenario differs from the latest version', () => {
    const snap = createSnapshot(baseScenario);
    const version: TestDefinitionVersion = {
      id: 'v1',
      timestamp: Date.now(),
      snapshot: snap,
    };
    const modified = mkScenario({ url: 'https://changed.com' });
    expect(hasChanged(modified, [version])).toBe(true);
  });
});

describe('generateChangeSummary', () => {
  it('detects URL change', () => {
    const oldSnap = createSnapshot(baseScenario);
    const newSnap = createSnapshot(mkScenario({ url: 'https://other.com' }));
    expect(generateChangeSummary(oldSnap, newSnap)).toContain('URL changed');
  });

  it('detects method change', () => {
    const oldSnap = createSnapshot(baseScenario);
    const newSnap = createSnapshot(mkScenario({ method: 'POST' }));
    expect(generateChangeSummary(oldSnap, newSnap)).toContain('method → POST');
  });

  it('detects header additions', () => {
    const oldSnap = createSnapshot(baseScenario);
    const newSnap = createSnapshot(mkScenario({
      headers: [...baseScenario.headers, { key: 'X-New', value: 'val', enabled: true }],
    }));
    expect(generateChangeSummary(oldSnap, newSnap)).toContain('1 header');
  });

  it('detects body change', () => {
    const oldSnap = createSnapshot(baseScenario);
    const newSnap = createSnapshot(mkScenario({ body: '{"data": true}' }));
    expect(generateChangeSummary(oldSnap, newSnap)).toContain('body modified');
  });

  it('returns empty string when nothing changed', () => {
    const snap = createSnapshot(baseScenario);
    expect(generateChangeSummary(snap, snap)).toBe('no changes detected');
  });

  it('detects name change', () => {
    const oldSnap = createSnapshot(baseScenario);
    const newSnap = createSnapshot(mkScenario({ name: 'Renamed' }));
    expect(generateChangeSummary(oldSnap, newSnap)).toContain('name changed');
  });

  it('detects bodyType change in summary', () => {
    const oldSnap = createSnapshot(baseScenario);
    const newSnap = createSnapshot(mkScenario({ bodyType: 'json' }));
    expect(generateChangeSummary(oldSnap, newSnap)).toContain('body type');
  });

  it('detects plural header additions', () => {
    const oldSnap = createSnapshot(baseScenario);
    const newSnap = createSnapshot(mkScenario({
      headers: [
        ...baseScenario.headers,
        { key: 'X-A', value: '1', enabled: true },
        { key: 'X-B', value: '2', enabled: true },
      ],
    }));
    expect(generateChangeSummary(oldSnap, newSnap)).toContain('2 headers added');
  });

  it('detects plural header removals', () => {
    const oldSnap = createSnapshot(mkScenario({
      headers: [
        { key: 'A', value: '1', enabled: true },
        { key: 'B', value: '2', enabled: true },
      ],
    }));
    const newSnap = createSnapshot(mkScenario({ headers: [] }));
    expect(generateChangeSummary(oldSnap, newSnap)).toContain('2 headers removed');
  });

  it('detects header value modifications when count unchanged', () => {
    const oldSnap = createSnapshot(baseScenario);
    const newSnap = createSnapshot(mkScenario({
      headers: [{ key: 'Accept', value: 'text/plain', enabled: true }],
    }));
    expect(generateChangeSummary(oldSnap, newSnap)).toContain('headers modified');
  });

  it('detects form data changes', () => {
    const oldSnap = createSnapshot(mkScenario({ bodyForm: [{ key: 'a', value: '1', type: 'text', enabled: true }] }));
    const newSnap = createSnapshot(mkScenario({ bodyForm: [{ key: 'a', value: '2', type: 'text', enabled: true }] }));
    expect(generateChangeSummary(oldSnap, newSnap)).toContain('form data modified');
  });

  it('detects auth type change in summary', () => {
    const oldSnap = createSnapshot(baseScenario);
    const newSnap = createSnapshot(mkScenario({ auth: { type: 'bearer', token: 't' } as Scenario['auth'] }));
    expect(generateChangeSummary(oldSnap, newSnap)).toMatch(/auth.*none.*bearer/);
  });

  it('detects plural extraction additions', () => {
    const oldSnap = createSnapshot(baseScenario);
    const newSnap = createSnapshot(mkScenario({
      extractions: [
        { source: 'body', path: '$.a', variable: 'a' },
        { source: 'body', path: '$.b', variable: 'b' },
      ],
    }));
    expect(generateChangeSummary(oldSnap, newSnap)).toContain('2 extractions added');
  });

  it('detects plural extraction removals', () => {
    const oldSnap = createSnapshot(mkScenario({
      extractions: [
        { source: 'body', path: '$.a', variable: 'a' },
        { source: 'body', path: '$.b', variable: 'b' },
      ],
    }));
    const newSnap = createSnapshot(baseScenario);
    expect(generateChangeSummary(oldSnap, newSnap)).toContain('2 extractions removed');
  });

  it('detects extraction modifications when length unchanged', () => {
    const oldSnap = createSnapshot(mkScenario({
      extractions: [{ source: 'body', path: '$.id', variable: 'x' }],
    }));
    const newSnap = createSnapshot(mkScenario({
      extractions: [{ source: 'body', path: '$.id', variable: 'y' }],
    }));
    expect(generateChangeSummary(oldSnap, newSnap)).toContain('extractions modified');
  });
});

describe('createTestDefinitionVersion', () => {
  it('creates a version with id, timestamp, and snapshot', () => {
    const version = createTestDefinitionVersion(baseScenario, []);
    expect(version.id).toBeTruthy();
    expect(version.timestamp).toBeLessThanOrEqual(Date.now());
    expect(version.snapshot.name).toBe(baseScenario.name);
  });

  it('includes change summary when previous versions exist', () => {
    const v1: TestDefinitionVersion = {
      id: 'v1',
      timestamp: Date.now() - 1000,
      snapshot: createSnapshot(baseScenario),
    };
    const modified = mkScenario({ url: 'https://changed.com' });
    const v2 = createTestDefinitionVersion(modified, [v1]);
    expect(v2.changeSummary).toContain('URL changed');
  });
});

describe('addVersionToList', () => {
  it('prepends a new version', () => {
    const v1: TestDefinitionVersion = { id: 'v1', timestamp: 1000, snapshot: createSnapshot(baseScenario) };
    const v2: TestDefinitionVersion = { id: 'v2', timestamp: 2000, snapshot: createSnapshot(baseScenario) };
    const result = addVersionToList([v1], v2);
    expect(result[0].id).toBe('v2');
    expect(result[1].id).toBe('v1');
  });

  it('trims to maxVersions', () => {
    const versions: TestDefinitionVersion[] = Array.from({ length: 20 }, (_, i) => ({
      id: `v${i}`,
      timestamp: i * 1000,
      snapshot: createSnapshot(baseScenario),
    }));
    const newVersion: TestDefinitionVersion = { id: 'vNew', timestamp: 99999, snapshot: createSnapshot(baseScenario) };
    const result = addVersionToList(versions, newVersion, 20);
    expect(result.length).toBe(20);
    expect(result[0].id).toBe('vNew');
  });
});

describe('autoSaveVersion', () => {
  it('returns versions when scenario has changed', () => {
    const result = autoSaveVersion(baseScenario);
    expect(result).not.toBeNull();
    expect(result!.length).toBe(1);
  });

  it('returns null when scenario has not changed', () => {
    const v: TestDefinitionVersion = {
      id: 'v1',
      timestamp: Date.now(),
      snapshot: createSnapshot(baseScenario),
    };
    const s = mkScenario({ definitionVersions: [v] });
    const result = autoSaveVersion(s);
    expect(result).toBeNull();
  });

  it('appends a version when scenario has changed from last version', () => {
    const v: TestDefinitionVersion = {
      id: 'v1',
      timestamp: Date.now() - 1000,
      snapshot: createSnapshot(baseScenario),
    };
    const modified = mkScenario({ url: 'https://changed.com', definitionVersions: [v] });
    const result = autoSaveVersion(modified);
    expect(result).not.toBeNull();
    expect(result!.length).toBe(2);
  });
});

describe('computeSnapshotDiff', () => {
  it('detects no changes for identical snapshots', () => {
    const snap = createSnapshot(baseScenario);
    const diff = computeSnapshotDiff(snap, snap);
    expect(diff.nameChanged).toBe(false);
    expect(diff.urlChanged).toBe(false);
    expect(diff.methodChanged).toBe(false);
    expect(diff.bodyChanged).toBe(false);
    expect(diff.headersAdded).toHaveLength(0);
    expect(diff.headersRemoved).toHaveLength(0);
    expect(diff.headersModified).toHaveLength(0);
  });

  it('detects name change', () => {
    const old = createSnapshot(baseScenario);
    const newer = createSnapshot(mkScenario({ name: 'New Name' }));
    expect(computeSnapshotDiff(old, newer).nameChanged).toBe(true);
  });

  it('detects URL change', () => {
    const old = createSnapshot(baseScenario);
    const newer = createSnapshot(mkScenario({ url: 'https://other.com' }));
    expect(computeSnapshotDiff(old, newer).urlChanged).toBe(true);
  });

  it('detects method change', () => {
    const old = createSnapshot(baseScenario);
    const newer = createSnapshot(mkScenario({ method: 'POST' }));
    expect(computeSnapshotDiff(old, newer).methodChanged).toBe(true);
  });

  it('detects added headers', () => {
    const old = createSnapshot(baseScenario);
    const newer = createSnapshot(mkScenario({
      headers: [...baseScenario.headers, { key: 'X-New', value: 'val', enabled: true }],
    }));
    const diff = computeSnapshotDiff(old, newer);
    expect(diff.headersAdded).toHaveLength(1);
    expect(diff.headersAdded[0].key).toBe('X-New');
  });

  it('detects removed headers', () => {
    const old = createSnapshot(mkScenario({
      headers: [{ key: 'Accept', value: 'application/json', enabled: true }, { key: 'X-Old', value: 'val', enabled: true }],
    }));
    const newer = createSnapshot(mkScenario({
      headers: [{ key: 'Accept', value: 'application/json', enabled: true }],
    }));
    const diff = computeSnapshotDiff(old, newer);
    expect(diff.headersRemoved).toHaveLength(1);
    expect(diff.headersRemoved[0].key).toBe('X-Old');
  });

  it('detects modified headers', () => {
    const old = createSnapshot(baseScenario);
    const newer = createSnapshot(mkScenario({
      headers: [{ key: 'Accept', value: 'text/plain', enabled: true }],
    }));
    const diff = computeSnapshotDiff(old, newer);
    expect(diff.headersModified).toHaveLength(1);
    expect(diff.headersModified[0].oldValue).toBe('application/json');
    expect(diff.headersModified[0].newValue).toBe('text/plain');
  });

  it('detects body change', () => {
    const old = createSnapshot(baseScenario);
    const newer = createSnapshot(mkScenario({ body: '{"new": true}' }));
    expect(computeSnapshotDiff(old, newer).bodyChanged).toBe(true);
  });

  it('detects auth change', () => {
    const old = createSnapshot(baseScenario);
    const newer = createSnapshot(mkScenario({ auth: { type: 'bearer', token: 'abc' } }));
    expect(computeSnapshotDiff(old, newer).authChanged).toBe(true);
  });

  it('detects bodyType change', () => {
    const old = createSnapshot(baseScenario);
    const newer = createSnapshot(mkScenario({ bodyType: 'json' }));
    expect(computeSnapshotDiff(old, newer).bodyTypeChanged).toBe(true);
  });
});

describe('countDefinitionVersions', () => {
  it('returns 0 when no versions exist', () => {
    expect(countDefinitionVersions(baseScenario)).toBe(0);
  });

  it('counts existing versions', () => {
    const s = mkScenario({
      definitionVersions: [
        { id: 'v1', timestamp: 1000, snapshot: createSnapshot(baseScenario) },
        { id: 'v2', timestamp: 2000, snapshot: createSnapshot(baseScenario) },
      ],
    });
    expect(countDefinitionVersions(s)).toBe(2);
  });
});

describe('stripDefinitionVersions', () => {
  it('returns same scenario when definitionVersions absent or empty', () => {
    expect(stripDefinitionVersions(baseScenario)).toBe(baseScenario);
    expect(stripDefinitionVersions(mkScenario({ definitionVersions: [] }))).toEqual(mkScenario({ definitionVersions: [] }));
  });

  it('removes definitionVersions from scenario', () => {
    const s = mkScenario({
      definitionVersions: [{ id: 'v1', timestamp: 1000, snapshot: createSnapshot(baseScenario) }],
    });
    const result = stripDefinitionVersions(s);
    expect(result.definitionVersions).toBeUndefined();
    expect(result.name).toBe(baseScenario.name);
  });
});

describe('hasDefinitionVersions', () => {
  it('returns false for scenario without versions', () => {
    expect(hasDefinitionVersions(baseScenario)).toBe(false);
  });

  it('returns false for empty array', () => {
    expect(hasDefinitionVersions(mkScenario({ definitionVersions: [] }))).toBe(false);
  });

  it('returns true when versions exist', () => {
    const s = mkScenario({
      definitionVersions: [{ id: 'v1', timestamp: 1000, snapshot: createSnapshot(baseScenario) }],
    });
    expect(hasDefinitionVersions(s)).toBe(true);
  });
});
