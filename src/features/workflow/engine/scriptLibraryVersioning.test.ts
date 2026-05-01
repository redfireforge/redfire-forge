import { describe, it, expect, vi } from 'vitest';
import {
  createSnapshot,
  computeSnapshotFingerprint,
  hasChanged,
  generateChangeSummary,
  autoSaveVersion,
  restoreFromVersion,
  deleteVersion,
  renameVersion,
  computeSnapshotDiff,
  findLibraryUsages,
  stripLibraryVersions,
  countLibraryVersions,
  hasLibraryVersions,
  MAX_VERSIONS,
} from './scriptLibraryVersioning';
import type { ScriptLibrary, ScriptLibraryVersion, ScriptLibrarySnapshot } from './scriptLibraries';

vi.mock('uuid', () => ({ v4: () => 'test-uuid' }));

function makeLib(overrides?: Partial<ScriptLibrary>): ScriptLibrary {
  return {
    id: 'lib-1',
    name: 'Helpers',
    description: 'Shared utility functions',
    code: 'function add(a, b) { return a + b; }',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeVersion(overrides?: Partial<ScriptLibraryVersion>): ScriptLibraryVersion {
  return {
    id: 'v1',
    timestamp: 1000,
    snapshot: {
      name: 'Helpers',
      description: 'Shared utility functions',
      code: 'function add(a, b) { return a + b; }',
    },
    ...overrides,
  };
}

describe('scriptLibraryVersioning', () => {

  describe('createSnapshot', () => {
    it('extracts name, description, and code', () => {
      const lib = makeLib();
      const snap = createSnapshot(lib);
      expect(snap).toEqual({
        name: 'Helpers',
        description: 'Shared utility functions',
        code: 'function add(a, b) { return a + b; }',
      });
    });

    it('excludes id, createdAt, updatedAt, versions', () => {
      const lib = makeLib({ versions: [makeVersion()] });
      const snap = createSnapshot(lib);
      expect(snap).not.toHaveProperty('id');
      expect(snap).not.toHaveProperty('createdAt');
      expect(snap).not.toHaveProperty('updatedAt');
      expect(snap).not.toHaveProperty('versions');
    });
  });

  describe('computeSnapshotFingerprint', () => {
    it('returns same fingerprint for identical snapshots', () => {
      const a: ScriptLibrarySnapshot = { name: 'A', description: 'D', code: 'x' };
      const b: ScriptLibrarySnapshot = { name: 'A', description: 'D', code: 'x' };
      expect(computeSnapshotFingerprint(a)).toBe(computeSnapshotFingerprint(b));
    });

    it('returns different fingerprint for different snapshots', () => {
      const a: ScriptLibrarySnapshot = { name: 'A', description: 'D', code: 'x' };
      const b: ScriptLibrarySnapshot = { name: 'A', description: 'D', code: 'y' };
      expect(computeSnapshotFingerprint(a)).not.toBe(computeSnapshotFingerprint(b));
    });
  });

  describe('hasChanged', () => {
    it('returns true when no versions exist', () => {
      expect(hasChanged(makeLib())).toBe(true);
    });

    it('returns false when latest version matches current state', () => {
      const lib = makeLib({ versions: [makeVersion()] });
      expect(hasChanged(lib)).toBe(false);
    });

    it('returns true when code has changed', () => {
      const lib = makeLib({
        code: 'function mul(a, b) { return a * b; }',
        versions: [makeVersion()],
      });
      expect(hasChanged(lib)).toBe(true);
    });

    it('returns true when name has changed', () => {
      const lib = makeLib({ name: 'New Name', versions: [makeVersion()] });
      expect(hasChanged(lib)).toBe(true);
    });
  });

  describe('generateChangeSummary', () => {
    it('returns "no changes" for identical snapshots', () => {
      const snap: ScriptLibrarySnapshot = { name: 'A', description: '', code: 'x' };
      expect(generateChangeSummary(snap, snap)).toBe('no changes');
    });

    it('reports name changed', () => {
      const old: ScriptLibrarySnapshot = { name: 'A', description: '', code: 'x' };
      const updated: ScriptLibrarySnapshot = { name: 'B', description: '', code: 'x' };
      expect(generateChangeSummary(old, updated)).toBe('name changed');
    });

    it('reports description changed', () => {
      const old: ScriptLibrarySnapshot = { name: 'A', description: 'old', code: 'x' };
      const updated: ScriptLibrarySnapshot = { name: 'A', description: 'new', code: 'x' };
      expect(generateChangeSummary(old, updated)).toBe('description changed');
    });

    it('reports code changed with line diff', () => {
      const old: ScriptLibrarySnapshot = { name: 'A', description: '', code: 'line1\nline2' };
      const updated: ScriptLibrarySnapshot = { name: 'A', description: '', code: 'line1\nline2\nline3\nline4' };
      expect(generateChangeSummary(old, updated)).toBe('code changed (+2 lines)');
    });

    it('reports code changed with negative line diff', () => {
      const old: ScriptLibrarySnapshot = { name: 'A', description: '', code: 'line1\nline2\nline3' };
      const updated: ScriptLibrarySnapshot = { name: 'A', description: '', code: 'line1' };
      expect(generateChangeSummary(old, updated)).toBe('code changed (-2 lines)');
    });

    it('reports code changed with same line count', () => {
      const old: ScriptLibrarySnapshot = { name: 'A', description: '', code: 'aaa' };
      const updated: ScriptLibrarySnapshot = { name: 'A', description: '', code: 'bbb' };
      expect(generateChangeSummary(old, updated)).toBe('code changed');
    });

    it('reports multiple changes', () => {
      const old: ScriptLibrarySnapshot = { name: 'A', description: 'old', code: 'x' };
      const updated: ScriptLibrarySnapshot = { name: 'B', description: 'new', code: 'y' };
      expect(generateChangeSummary(old, updated)).toBe('name changed, description changed, code changed');
    });
  });

  describe('autoSaveVersion', () => {
    it('creates initial version', () => {
      const lib = makeLib();
      const result = autoSaveVersion(lib);
      expect(result.versions).toHaveLength(1);
      expect(result.versions![0].changeSummary).toBe('initial version');
      expect(result.versions![0].snapshot.code).toBe(lib.code);
    });

    it('skips save when no changes', () => {
      const lib = makeLib({ versions: [makeVersion()] });
      const result = autoSaveVersion(lib);
      expect(result).toBe(lib); // same reference — no-op
    });

    it('saves when code changed', () => {
      const lib = makeLib({
        code: 'function sub(a, b) { return a - b; }',
        versions: [makeVersion()],
      });
      const result = autoSaveVersion(lib);
      expect(result.versions).toHaveLength(2);
      expect(result.versions![0].snapshot.code).toBe('function sub(a, b) { return a - b; }');
      expect(result.versions![0].changeSummary).toContain('code changed');
    });

    it('caps at MAX_VERSIONS', () => {
      const versions: ScriptLibraryVersion[] = Array.from({ length: MAX_VERSIONS }, (_, i) => ({
        id: `v${i}`,
        timestamp: i * 1000,
        snapshot: { name: 'H', description: '', code: `v${i}` },
      }));
      const lib = makeLib({ code: 'new code', versions });
      const result = autoSaveVersion(lib);
      expect(result.versions).toHaveLength(MAX_VERSIONS);
      expect(result.versions![0].snapshot.code).toBe('new code');
    });

    it('prepends newest version first', () => {
      const lib = makeLib({
        code: 'new',
        versions: [makeVersion({ id: 'old', timestamp: 1 })],
      });
      const result = autoSaveVersion(lib);
      expect(result.versions![0].id).toBe('test-uuid');
      expect(result.versions![1].id).toBe('old');
    });
  });

  describe('restoreFromVersion', () => {
    it('restores name, description, code from version', () => {
      const version = makeVersion({
        snapshot: { name: 'OldName', description: 'OldDesc', code: 'oldCode' },
      });
      const lib = makeLib({ name: 'Current', versions: [version] });
      const restored = restoreFromVersion(lib, version.id);
      expect(restored.name).toBe('OldName');
      expect(restored.description).toBe('OldDesc');
      expect(restored.code).toBe('oldCode');
    });

    it('returns unchanged lib when version not found', () => {
      const lib = makeLib();
      expect(restoreFromVersion(lib, 'nonexistent')).toBe(lib);
    });

    it('updates updatedAt timestamp', () => {
      const version = makeVersion();
      const lib = makeLib({ versions: [version], updatedAt: '2020-01-01T00:00:00Z' });
      const restored = restoreFromVersion(lib, version.id);
      expect(restored.updatedAt).not.toBe('2020-01-01T00:00:00Z');
    });
  });

  describe('deleteVersion', () => {
    it('removes specified version', () => {
      const lib = makeLib({ versions: [makeVersion({ id: 'a' }), makeVersion({ id: 'b' })] });
      const result = deleteVersion(lib, 'a');
      expect(result.versions).toHaveLength(1);
      expect(result.versions![0].id).toBe('b');
    });

    it('returns unchanged when version not found', () => {
      const lib = makeLib({ versions: [makeVersion()] });
      const result = deleteVersion(lib, 'nonexistent');
      expect(result.versions).toHaveLength(1);
    });
  });

  describe('renameVersion', () => {
    it('sets label on specified version', () => {
      const lib = makeLib({ versions: [makeVersion({ id: 'v1' })] });
      const result = renameVersion(lib, 'v1', 'My Label');
      expect(result.versions![0].label).toBe('My Label');
    });

    it('clears label when empty string', () => {
      const lib = makeLib({ versions: [makeVersion({ id: 'v1', label: 'Old' })] });
      const result = renameVersion(lib, 'v1', '');
      expect(result.versions![0].label).toBeUndefined();
    });

    it('trims whitespace', () => {
      const lib = makeLib({ versions: [makeVersion({ id: 'v1' })] });
      const result = renameVersion(lib, 'v1', '  Trimmed  ');
      expect(result.versions![0].label).toBe('Trimmed');
    });
  });

  describe('computeSnapshotDiff', () => {
    it('detects name change', () => {
      const diff = computeSnapshotDiff(
        { name: 'A', description: '', code: 'x' },
        { name: 'B', description: '', code: 'x' },
      );
      expect(diff.nameChanged).toBe(true);
      expect(diff.oldName).toBe('A');
      expect(diff.newName).toBe('B');
    });

    it('detects description change', () => {
      const diff = computeSnapshotDiff(
        { name: 'A', description: 'old', code: 'x' },
        { name: 'A', description: 'new', code: 'x' },
      );
      expect(diff.descriptionChanged).toBe(true);
    });

    it('detects code change', () => {
      const diff = computeSnapshotDiff(
        { name: 'A', description: '', code: 'old code' },
        { name: 'A', description: '', code: 'new code' },
      );
      expect(diff.codeChanged).toBe(true);
      expect(diff.oldCode).toBe('old code');
      expect(diff.newCode).toBe('new code');
    });

    it('reports no changes for identical snapshots', () => {
      const snap: ScriptLibrarySnapshot = { name: 'A', description: 'D', code: 'x' };
      const diff = computeSnapshotDiff(snap, snap);
      expect(diff.nameChanged).toBe(false);
      expect(diff.descriptionChanged).toBe(false);
      expect(diff.codeChanged).toBe(false);
    });
  });

  describe('findLibraryUsages', () => {
    it('finds workflow nodes that reference a library', () => {
      const workflows = [
        {
          id: 'wf1', name: 'Workflow 1',
          nodes: [
            { id: 'n1', type: 'script', data: { label: 'MyScript', libraryIds: ['lib-1', 'lib-2'] } },
            { id: 'n2', type: 'http', data: { label: 'HTTP' } },
          ],
        },
        {
          id: 'wf2', name: 'Workflow 2',
          nodes: [
            { id: 'n3', type: 'script', data: { label: 'Other', libraryIds: ['lib-3'] } },
          ],
        },
      ];
      const usages = findLibraryUsages(workflows, 'lib-1');
      expect(usages).toHaveLength(1);
      expect(usages[0]).toEqual({
        workflowId: 'wf1',
        workflowName: 'Workflow 1',
        nodeId: 'n1',
        nodeLabel: 'MyScript',
      });
    });

    it('returns empty array when no usages found', () => {
      const workflows = [
        { id: 'wf1', name: 'W', nodes: [{ id: 'n1', type: 'script', data: { label: 'S', libraryIds: ['other'] } }] },
      ];
      expect(findLibraryUsages(workflows, 'lib-1')).toEqual([]);
    });

    it('finds usages across multiple workflows', () => {
      const workflows = [
        { id: 'wf1', name: 'W1', nodes: [{ id: 'n1', type: 'script', data: { label: 'S1', libraryIds: ['lib-1'] } }] },
        { id: 'wf2', name: 'W2', nodes: [{ id: 'n2', type: 'script', data: { label: 'S2', libraryIds: ['lib-1'] } }] },
      ];
      const usages = findLibraryUsages(workflows, 'lib-1');
      expect(usages).toHaveLength(2);
    });

    it('uses fallback label for script nodes without label', () => {
      const workflows = [
        { id: 'wf1', name: 'W', nodes: [{ id: 'n1', type: 'script', data: { libraryIds: ['lib-1'] } }] },
      ];
      const usages = findLibraryUsages(workflows, 'lib-1');
      expect(usages[0].nodeLabel).toBe('Script');
    });
  });

  describe('stripLibraryVersions', () => {
    it('removes versions from all libraries', () => {
      const libs = [
        makeLib({ id: 'a', versions: [makeVersion()] }),
        makeLib({ id: 'b', versions: [makeVersion(), makeVersion({ id: 'v2' })] }),
      ];
      const stripped = stripLibraryVersions(libs);
      expect(stripped[0]).not.toHaveProperty('versions');
      expect(stripped[1]).not.toHaveProperty('versions');
      expect(stripped[0].name).toBe('Helpers');
    });
  });

  describe('countLibraryVersions', () => {
    it('sums versions across libraries', () => {
      const libs = [
        makeLib({ versions: [makeVersion()] }),
        makeLib({ versions: [makeVersion(), makeVersion({ id: 'v2' })] }),
      ];
      expect(countLibraryVersions(libs)).toBe(3);
    });

    it('returns 0 when no versions', () => {
      expect(countLibraryVersions([makeLib()])).toBe(0);
    });
  });

  describe('hasLibraryVersions', () => {
    it('returns true when any library has versions', () => {
      expect(hasLibraryVersions([makeLib(), makeLib({ versions: [makeVersion()] })])).toBe(true);
    });

    it('returns false when no library has versions', () => {
      expect(hasLibraryVersions([makeLib(), makeLib()])).toBe(false);
    });
  });
});
