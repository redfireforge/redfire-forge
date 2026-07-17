import { describe, it, expect, vi } from 'vitest';
import {
  computeSnapshotFingerprint,
  generateHttpChangeSummary,
  computeHttpSnapshotDiff,
  createVersionEntry,
  addVersionToList,
  deleteVersionById,
  renameVersionById,
  type HttpDefinitionSnapshotBase,
} from './definitionVersioning';

vi.mock('uuid', () => ({ v4: () => 'test-uuid-1234' }));

const makeSnapshot = (overrides: Partial<HttpDefinitionSnapshotBase> = {}): HttpDefinitionSnapshotBase => ({
  name: 'Test',
  url: '/api/test',
  method: 'GET',
  headers: [{ key: 'Content-Type', value: 'application/json' }],
  body: '{}',
  bodyType: 'json',
  bodyForm: [],
  auth: { type: 'none' } as HttpDefinitionSnapshotBase['auth'],
  ...overrides,
});

describe('computeSnapshotFingerprint', () => {
  it('returns consistent fingerprint for same data', () => {
    const snap = makeSnapshot();
    expect(computeSnapshotFingerprint(snap)).toBe(computeSnapshotFingerprint({ ...snap }));
  });

  it('returns different fingerprint for different data', () => {
    const a = makeSnapshot({ name: 'A' });
    const b = makeSnapshot({ name: 'B' });
    expect(computeSnapshotFingerprint(a)).not.toBe(computeSnapshotFingerprint(b));
  });
});

describe('generateHttpChangeSummary', () => {
  it('detects name change', () => {
    const result = generateHttpChangeSummary(makeSnapshot({ name: 'A' }), makeSnapshot({ name: 'B' }));
    expect(result).toContain('name changed');
  });

  it('detects URL change', () => {
    const result = generateHttpChangeSummary(makeSnapshot({ url: '/old' }), makeSnapshot({ url: '/new' }));
    expect(result).toContain('URL changed');
  });

  it('detects method change', () => {
    const result = generateHttpChangeSummary(makeSnapshot({ method: 'GET' }), makeSnapshot({ method: 'POST' }));
    expect(result).toContain('method → POST');
  });

  it('detects headers added', () => {
    const old = makeSnapshot({ headers: [] });
    const now = makeSnapshot({ headers: [{ key: 'X-New', value: '1' }] });
    const result = generateHttpChangeSummary(old, now);
    expect(result).toContain('1 header added');
  });

  it('detects headers removed', () => {
    const old = makeSnapshot({ headers: [{ key: 'X-Old', value: '1' }] });
    const now = makeSnapshot({ headers: [] });
    const result = generateHttpChangeSummary(old, now);
    expect(result).toContain('1 header removed');
  });

  it('uses plural labels when multiple headers change', () => {
    const old = makeSnapshot({ headers: [] });
    const now = makeSnapshot({
      headers: [
        { key: 'X-A', value: '1' },
        { key: 'X-B', value: '2' },
      ],
    });
    expect(generateHttpChangeSummary(old, now)).toContain('2 headers added');

    const removed = generateHttpChangeSummary(now, old);
    expect(removed).toContain('2 headers removed');
  });

  it('reports body type none when bodyType is cleared', () => {
    const result = generateHttpChangeSummary(
      makeSnapshot({ bodyType: 'json' }),
      makeSnapshot({ bodyType: undefined }),
    );
    expect(result).toContain('body type → none');
  });

  it('detects headers modified', () => {
    const old = makeSnapshot({ headers: [{ key: 'X-H', value: '1' }] });
    const now = makeSnapshot({ headers: [{ key: 'X-H', value: '2' }] });
    const result = generateHttpChangeSummary(old, now);
    expect(result).toContain('headers modified');
  });

  it('detects body change', () => {
    const result = generateHttpChangeSummary(makeSnapshot({ body: 'old' }), makeSnapshot({ body: 'new' }));
    expect(result).toContain('body modified');
  });

  it('detects body type change', () => {
    const result = generateHttpChangeSummary(makeSnapshot({ bodyType: 'json' }), makeSnapshot({ bodyType: 'raw' }));
    expect(result).toContain('body type → raw');
  });

  it('detects form data change', () => {
    const old = makeSnapshot({ bodyForm: [{ key: 'a', value: '1' }] });
    const now = makeSnapshot({ bodyForm: [{ key: 'a', value: '2' }] });
    const result = generateHttpChangeSummary(old, now);
    expect(result).toContain('form data modified');
  });

  it('detects form data when bodyForm is introduced', () => {
    const old = makeSnapshot({ bodyForm: undefined });
    const now = makeSnapshot({ bodyForm: [{ key: 'field', value: '1' }] });
    expect(generateHttpChangeSummary(old, now)).toContain('form data modified');
  });

  it('detects auth change', () => {
    const old = makeSnapshot({ auth: { type: 'none' } as HttpDefinitionSnapshotBase['auth'] });
    const now = makeSnapshot({ auth: { type: 'bearer', token: 'x' } as unknown as HttpDefinitionSnapshotBase['auth'] });
    const result = generateHttpChangeSummary(old, now);
    expect(result).toContain('auth none → bearer');
  });

  it('returns empty array when no changes', () => {
    const snap = makeSnapshot();
    expect(generateHttpChangeSummary(snap, snap)).toHaveLength(0);
  });
});

describe('computeHttpSnapshotDiff', () => {
  it('detects all field changes', () => {
    const old = makeSnapshot();
    const now = makeSnapshot({ name: 'New', url: '/new', method: 'POST', body: 'x', bodyType: 'raw' });
    const diff = computeHttpSnapshotDiff(old, now);
    expect(diff.nameChanged).toBe(true);
    expect(diff.urlChanged).toBe(true);
    expect(diff.methodChanged).toBe(true);
    expect(diff.bodyChanged).toBe(true);
    expect(diff.bodyTypeChanged).toBe(true);
  });

  it('reports no changes for identical snapshots', () => {
    const snap = makeSnapshot();
    const diff = computeHttpSnapshotDiff(snap, snap);
    expect(diff.nameChanged).toBe(false);
    expect(diff.urlChanged).toBe(false);
    expect(diff.methodChanged).toBe(false);
    expect(diff.bodyChanged).toBe(false);
    expect(diff.headersAdded).toHaveLength(0);
    expect(diff.headersRemoved).toHaveLength(0);
    expect(diff.headersModified).toHaveLength(0);
  });

  it('detects added headers', () => {
    const old = makeSnapshot({ headers: [] });
    const now = makeSnapshot({ headers: [{ key: 'X-New', value: '1' }] });
    const diff = computeHttpSnapshotDiff(old, now);
    expect(diff.headersAdded).toHaveLength(1);
    expect(diff.headersAdded[0].key).toBe('X-New');
  });

  it('detects form data change', () => {
    const old = makeSnapshot({ bodyForm: [{ key: 'a', value: '1' }] });
    const now = makeSnapshot({ bodyForm: [{ key: 'a', value: '2' }] });
    const diff = computeHttpSnapshotDiff(old, now);
    expect(diff.formDataChanged).toBe(true);
  });

  it('detects form data when bodyForm is added to a snapshot', () => {
    const old = makeSnapshot({ bodyForm: undefined });
    const now = makeSnapshot({ bodyForm: [{ key: 'field', value: '1' }] });
    expect(computeHttpSnapshotDiff(old, now).formDataChanged).toBe(true);
  });

  it('detects modified headers and auth changes', () => {
    const old = makeSnapshot({
      headers: [{ key: 'X-H', value: '1' }],
      auth: { type: 'none' } as HttpDefinitionSnapshotBase['auth'],
    });
    const now = makeSnapshot({
      headers: [{ key: 'X-H', value: '2' }],
      auth: { type: 'bearer', token: 'x' } as unknown as HttpDefinitionSnapshotBase['auth'],
    });
    const diff = computeHttpSnapshotDiff(old, now);
    expect(diff.headersModified).toEqual([{ key: 'X-H', oldValue: '1', newValue: '2' }]);
    expect(diff.authChanged).toBe(true);
  });
});

describe('createVersionEntry', () => {
  it('creates a version with uuid, timestamp, and snapshot', () => {
    const snap = makeSnapshot();
    const version = createVersionEntry(snap, 'test change');
    expect(version.id).toBe('test-uuid-1234');
    expect(version.timestamp).toBeGreaterThan(0);
    expect(version.changeSummary).toBe('test change');
    expect(version.snapshot).toBe(snap);
  });
});

describe('addVersionToList', () => {
  it('prepends version and caps at max', () => {
    const v1 = { id: '1' };
    const v2 = { id: '2' };
    const v3 = { id: '3' };
    const result = addVersionToList([v1, v2], v3, 2);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe(v3);
    expect(result[1]).toBe(v1);
  });
});

describe('deleteVersionById', () => {
  it('removes version by id', () => {
    const versions = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const result = deleteVersionById(versions, 'b');
    expect(result).toHaveLength(2);
    expect(result.map(v => v.id)).toEqual(['a', 'c']);
  });
});

describe('renameVersionById', () => {
  it('renames version by id', () => {
    const versions = [{ id: 'a', label: 'old' }, { id: 'b' }];
    const result = renameVersionById(versions, 'a', 'new');
    expect(result[0].label).toBe('new');
    expect(result[1].label).toBeUndefined();
  });
});
