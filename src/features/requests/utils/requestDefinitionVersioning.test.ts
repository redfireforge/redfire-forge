import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createSnapshot,
  computeSnapshotFingerprint,
  hasChanged,
  generateChangeSummary,
  createRequestDefinitionVersion,
  addVersionToList,
  autoSaveVersion,
  computeSnapshotDiff,
  countRequestDefinitionVersions,
  stripRequestDefinitionVersions,
  hasRequestDefinitionVersions,
  restoreFromVersion,
  deleteVersion,
  renameVersion,
} from './requestDefinitionVersioning';
import type { RequestItem, RequestDefinitionVersion, RequestDefinitionSnapshot } from '../../../shared/types';

const baseRequest: RequestItem = {
  id: 'req-1',
  name: 'Get Users',
  url: 'https://api.example.com/users',
  method: 'GET',
  headers: [{ key: 'Accept', value: 'application/json' }],
  body: '',
  auth: { type: 'none' },
  savedQueryParams: [],
};

const mkRequest = (overrides?: Partial<RequestItem>): RequestItem => ({ ...baseRequest, ...overrides });

describe('createSnapshot', () => {
  it('creates a snapshot with the correct fields', () => {
    const snap = createSnapshot(baseRequest);
    expect(snap.name).toBe('Get Users');
    expect(snap.url).toBe('https://api.example.com/users');
    expect(snap.method).toBe('GET');
    expect(snap.headers).toEqual([{ key: 'Accept', value: 'application/json' }]);
    expect(snap.body).toBe('');
    expect(snap.auth).toEqual({ type: 'none' });
  });

  it('excludes id, savedQueryParams, and catalogMeta', () => {
    const snap = createSnapshot(baseRequest) as Record<string, unknown>;
    expect(snap.id).toBeUndefined();
    expect(snap.savedQueryParams).toBeUndefined();
    expect(snap.catalogMeta).toBeUndefined();
  });

  it('filters out empty-key headers', () => {
    const req = mkRequest({ headers: [{ key: 'X-Foo', value: 'bar' }, { key: '', value: '' }] });
    const snap = createSnapshot(req);
    expect(snap.headers).toEqual([{ key: 'X-Foo', value: 'bar' }]);
  });
});

describe('computeSnapshotFingerprint', () => {
  it('returns same fingerprint for same data', () => {
    const snap1 = createSnapshot(baseRequest);
    const snap2 = createSnapshot(mkRequest());
    expect(computeSnapshotFingerprint(snap1)).toBe(computeSnapshotFingerprint(snap2));
  });

  it('returns different fingerprint for different data', () => {
    const snap1 = createSnapshot(baseRequest);
    const snap2 = createSnapshot(mkRequest({ url: 'https://api.example.com/posts' }));
    expect(computeSnapshotFingerprint(snap1)).not.toBe(computeSnapshotFingerprint(snap2));
  });

  it('is order-independent for object keys', () => {
    const snap1: RequestDefinitionSnapshot = {
      name: 'A', url: 'u', method: 'GET', headers: [], body: '', auth: { type: 'none' },
    };
    const snap2: RequestDefinitionSnapshot = {
      auth: { type: 'none' }, body: '', headers: [], method: 'GET', name: 'A', url: 'u',
    };
    expect(computeSnapshotFingerprint(snap1)).toBe(computeSnapshotFingerprint(snap2));
  });
});

describe('hasChanged', () => {
  it('returns true when no versions exist', () => {
    expect(hasChanged(baseRequest, [])).toBe(true);
  });

  it('returns false when latest version matches', () => {
    const snap = createSnapshot(baseRequest);
    const version: RequestDefinitionVersion = { id: 'v1', timestamp: Date.now(), snapshot: snap };
    expect(hasChanged(baseRequest, [version])).toBe(false);
  });

  it('returns true when request has changed from latest version', () => {
    const snap = createSnapshot(baseRequest);
    const version: RequestDefinitionVersion = { id: 'v1', timestamp: Date.now(), snapshot: snap };
    const updated = mkRequest({ url: 'https://api.example.com/posts' });
    expect(hasChanged(updated, [version])).toBe(true);
  });
});

describe('generateChangeSummary', () => {
  const oldSnap = createSnapshot(baseRequest);

  it('detects URL change', () => {
    const newSnap = createSnapshot(mkRequest({ url: 'https://new.api.com' }));
    expect(generateChangeSummary(oldSnap, newSnap)).toContain('URL changed');
  });

  it('detects method change', () => {
    const newSnap = createSnapshot(mkRequest({ method: 'POST' }));
    expect(generateChangeSummary(oldSnap, newSnap)).toContain('method → POST');
  });

  it('detects header additions', () => {
    const newSnap = createSnapshot(mkRequest({
      headers: [{ key: 'Accept', value: 'application/json' }, { key: 'X-New', value: '1' }],
    }));
    expect(generateChangeSummary(oldSnap, newSnap)).toContain('1 header added');
  });

  it('detects body change', () => {
    const newSnap = createSnapshot(mkRequest({ body: '{"data":true}' }));
    expect(generateChangeSummary(oldSnap, newSnap)).toContain('body modified');
  });

  it('detects auth change', () => {
    const newSnap = createSnapshot(mkRequest({ auth: { type: 'bearer', token: 'abc' } }));
    expect(generateChangeSummary(oldSnap, newSnap)).toContain('auth');
  });

  it('detects plural header removals', () => {
    const wideOld = createSnapshot(mkRequest({
      headers: [{ key: 'A', value: '1' }, { key: 'B', value: '2' }],
    }));
    const wideNew = createSnapshot(mkRequest({ headers: [] }));
    expect(generateChangeSummary(wideOld, wideNew)).toContain('2 headers removed');
  });

  it('detects header modifications when counts match', () => {
    const newSnap = createSnapshot(mkRequest({
      headers: [{ key: 'Accept', value: 'text/plain' }],
    }));
    expect(generateChangeSummary(oldSnap, newSnap)).toContain('headers modified');
  });

  it('detects form data change', () => {
    const a = createSnapshot(mkRequest({
      bodyForm: [{ key: 'f', value: '1', type: 'text' }],
    }));
    const b = createSnapshot(mkRequest({
      bodyForm: [{ key: 'f', value: '2', type: 'text' }],
    }));
    expect(generateChangeSummary(a, b)).toContain('form data modified');
  });

  it('detects body type cleared', () => {
    const withType = createSnapshot(mkRequest({ bodyType: 'json' }));
    const cleared = createSnapshot(mkRequest({ bodyType: undefined }));
    expect(generateChangeSummary(withType, cleared)).toContain('body type → none');
  });

  it('detects name change in summary', () => {
    const a = createSnapshot(mkRequest({ name: 'A' }));
    const b = createSnapshot(mkRequest({ name: 'B' }));
    expect(generateChangeSummary(a, b)).toContain('name changed');
  });

  it('uses plural wording for multiple new headers', () => {
    const oldSnap = createSnapshot(baseRequest);
    const newSnap = createSnapshot(mkRequest({
      headers: [
        { key: 'Accept', value: 'application/json' },
        { key: 'X-1', value: '1' },
        { key: 'X-2', value: '2' },
      ],
    }));
    expect(generateChangeSummary(oldSnap, newSnap)).toContain('2 headers added');
  });

  it('returns no changes when snapshots are identical', () => {
    expect(generateChangeSummary(oldSnap, oldSnap)).toBe('no changes detected');
  });
});

describe('addVersionToList', () => {
  it('prepends new version', () => {
    const v1: RequestDefinitionVersion = { id: 'v1', timestamp: 100, snapshot: createSnapshot(baseRequest) };
    const v2: RequestDefinitionVersion = { id: 'v2', timestamp: 200, snapshot: createSnapshot(baseRequest) };
    const result = addVersionToList([v1], v2);
    expect(result[0].id).toBe('v2');
    expect(result[1].id).toBe('v1');
  });

  it('caps at maxVersions', () => {
    const versions = Array.from({ length: 15 }, (_, i) => ({
      id: `v${i}`, timestamp: i * 100, snapshot: createSnapshot(baseRequest),
    }));
    const newV: RequestDefinitionVersion = { id: 'vNew', timestamp: 9999, snapshot: createSnapshot(baseRequest) };
    const result = addVersionToList(versions, newV, 15);
    expect(result).toHaveLength(15);
    expect(result[0].id).toBe('vNew');
  });
});

describe('autoSaveVersion', () => {
  it('creates a version when request has no versions', () => {
    const result = autoSaveVersion(baseRequest);
    expect(result).toBeTruthy();
    expect(result!).toHaveLength(1);
    expect(result![0].changeSummary).toBe('initial version');
  });

  it('returns null when nothing changed', () => {
    const snap = createSnapshot(baseRequest);
    const req = mkRequest({
      definitionVersions: [{ id: 'v1', timestamp: Date.now(), snapshot: snap }],
    });
    const result = autoSaveVersion(req);
    expect(result).toBeNull();
  });

  it('creates a version when request changed', () => {
    const snap = createSnapshot(baseRequest);
    const modified = mkRequest({
      url: 'https://changed.api.com',
      definitionVersions: [{ id: 'v1', timestamp: Date.now(), snapshot: snap }],
    });
    const result = autoSaveVersion(modified);
    expect(result).toBeTruthy();
    expect(result!).toHaveLength(2);
    expect(result![0].changeSummary).toContain('URL changed');
  });
});

describe('computeSnapshotDiff', () => {
  const oldSnap = createSnapshot(baseRequest);

  it('detects URL and method changes', () => {
    const newSnap = createSnapshot(mkRequest({ url: 'https://new.com', method: 'POST' }));
    const diff = computeSnapshotDiff(oldSnap, newSnap);
    expect(diff.urlChanged).toBe(true);
    expect(diff.methodChanged).toBe(true);
    expect(diff.nameChanged).toBe(false);
  });

  it('detects added headers', () => {
    const newSnap = createSnapshot(mkRequest({
      headers: [{ key: 'Accept', value: 'application/json' }, { key: 'X-New', value: 'yes' }],
    }));
    const diff = computeSnapshotDiff(oldSnap, newSnap);
    expect(diff.headersAdded).toEqual([{ key: 'X-New', value: 'yes' }]);
  });

  it('detects removed headers', () => {
    const newSnap = createSnapshot(mkRequest({ headers: [] }));
    const diff = computeSnapshotDiff(oldSnap, newSnap);
    expect(diff.headersRemoved).toEqual([{ key: 'Accept', value: 'application/json' }]);
  });

  it('detects body change', () => {
    const newSnap = createSnapshot(mkRequest({ body: '{"x":1}' }));
    const diff = computeSnapshotDiff(oldSnap, newSnap);
    expect(diff.bodyChanged).toBe(true);
  });

  it('detects modified headers', () => {
    const newSnap = createSnapshot(mkRequest({
      headers: [{ key: 'Accept', value: 'text/plain' }],
    }));
    const diff = computeSnapshotDiff(oldSnap, newSnap);
    expect(diff.headersModified).toHaveLength(1);
  });

  it('detects form data change', () => {
    const a = createSnapshot(mkRequest({ bodyForm: [{ key: 'k', value: '1', type: 'text' }] }));
    const b = createSnapshot(mkRequest({ bodyForm: [{ key: 'k', value: '2', type: 'text' }] }));
    expect(computeSnapshotDiff(a, b).formDataChanged).toBe(true);
  });
});

describe('restoreFromVersion', () => {
  it('returns a patch matching the snapshot', () => {
    const snap = createSnapshot(mkRequest({ url: 'https://restored.com', method: 'PUT' }));
    const version: RequestDefinitionVersion = { id: 'v1', timestamp: Date.now(), snapshot: snap };
    const patch = restoreFromVersion(version);
    expect(patch.url).toBe('https://restored.com');
    expect(patch.method).toBe('PUT');
    expect(patch.name).toBe('Get Users');
  });

  it('provides a default empty header if snapshot has none', () => {
    const snap: RequestDefinitionSnapshot = {
      name: 'A', url: 'u', method: 'GET', headers: [], body: '', auth: { type: 'none' },
    };
    const version: RequestDefinitionVersion = { id: 'v1', timestamp: Date.now(), snapshot: snap };
    const patch = restoreFromVersion(version);
    expect(patch.headers).toEqual([{ key: '', value: '' }]);
  });
});

describe('deleteVersion', () => {
  it('removes the version with the given id', () => {
    const versions: RequestDefinitionVersion[] = [
      { id: 'v1', timestamp: 100, snapshot: createSnapshot(baseRequest) },
      { id: 'v2', timestamp: 200, snapshot: createSnapshot(baseRequest) },
    ];
    expect(deleteVersion(versions, 'v1')).toHaveLength(1);
    expect(deleteVersion(versions, 'v1')[0].id).toBe('v2');
  });
});

describe('renameVersion', () => {
  it('renames the matching version', () => {
    const versions: RequestDefinitionVersion[] = [
      { id: 'v1', timestamp: 100, snapshot: createSnapshot(baseRequest) },
    ];
    const result = renameVersion(versions, 'v1', 'My Label');
    expect(result[0].label).toBe('My Label');
  });

  it('leaves list unchanged when id not found', () => {
    const versions: RequestDefinitionVersion[] = [
      { id: 'v1', timestamp: 100, snapshot: createSnapshot(baseRequest) },
    ];
    expect(renameVersion(versions, 'ghost', 'L')).toEqual(versions);
  });
});

describe('export/import helpers', () => {
  it('countRequestDefinitionVersions returns 0 for no versions', () => {
    expect(countRequestDefinitionVersions(baseRequest)).toBe(0);
  });

  it('countRequestDefinitionVersions counts versions', () => {
    const req = mkRequest({
      definitionVersions: [{ id: 'v1', timestamp: 100, snapshot: createSnapshot(baseRequest) }],
    });
    expect(countRequestDefinitionVersions(req)).toBe(1);
  });

  it('stripRequestDefinitionVersions removes versions', () => {
    const req = mkRequest({
      definitionVersions: [{ id: 'v1', timestamp: 100, snapshot: createSnapshot(baseRequest) }],
    });
    const stripped = stripRequestDefinitionVersions(req);
    expect(stripped.definitionVersions).toBeUndefined();
  });

  it('hasRequestDefinitionVersions checks correctly', () => {
    expect(hasRequestDefinitionVersions(baseRequest)).toBe(false);
    const req = mkRequest({
      definitionVersions: [{ id: 'v1', timestamp: 100, snapshot: createSnapshot(baseRequest) }],
    });
    expect(hasRequestDefinitionVersions(req)).toBe(true);
  });
});
