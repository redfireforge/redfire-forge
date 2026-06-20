/**
 * @vitest-environment jsdom
 *
 * Tests for useGraphqlSchemaSnapshots hook.
 *
 * IMPORTANT: pass stable (constant) references for collectionTrees/rawIntrospection
 * to avoid an infinite render loop in the deprecated-field-scanning useEffect.
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';

vi.mock('../utils/schemaSnapshot', () => ({
  saveSnapshot: vi.fn(async () => {}),
  loadSnapshots: vi.fn(async () => []),
  deleteSnapshot: vi.fn(async () => {}),
}));

vi.mock('../utils/schemaDiff', () => ({
  computeSchemaDiff: vi.fn(() => ({ changes: [], breakingCount: 0, dangerousCount: 0, safeCount: 0, deprecatedCount: 0 })),
}));

vi.mock('../utils/schemaDiffAck', () => ({
  getAcks: vi.fn(async () => []),
  addAck: vi.fn(async () => {}),
  deleteAck: vi.fn(async () => {}),
  ackId: vi.fn((connId: string, snapId: string, path: string) => `${connId}::${snapId}::${path}`),
}));

vi.mock('../utils/deprecatedFieldScanner', () => ({
  scanDeprecatedFieldUsages: vi.fn(() => []),
}));

import { useGraphqlSchemaSnapshots } from './useGraphqlSchemaSnapshots';
import { saveSnapshot, loadSnapshots, deleteSnapshot } from '../utils/schemaSnapshot';
import { computeSchemaDiff } from '../utils/schemaDiff';
import { addAck, deleteAck } from '../utils/schemaDiffAck';
import { scanDeprecatedFieldUsages } from '../utils/deprecatedFieldScanner';
import type { GraphqlSchemaSnapshot } from '../../../shared/types/graphql';

// ─── Stable references (MUST be outside renderHook callbacks) ────────────────
// Passing [] inline creates a new reference each render, causing an infinite
// loop in the deprecated-field-scanning useEffect.
const EMPTY_TREES: never[] = [];
const STABLE_INTROSPECTION = { __schema: {} } as unknown;

const makeSnapshot = (id: string, sdl = 'type Query { hello: String }', capturedAt = Date.now()): GraphqlSchemaSnapshot => ({
  id,
  connectionId: 'conn1',
  sdl,
  typesCount: 1,
  capturedAt,
});

const makeSchemaInfo = (sdl = 'type Query { hello: String }', fetchedAt = Date.now()) => ({
  sdl,
  types: [{ name: 'Query' }],
  fetchedAt,
});

describe('useGraphqlSchemaSnapshots', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadSnapshots).mockResolvedValue([]);
    vi.mocked(saveSnapshot).mockResolvedValue(undefined);
    vi.mocked(deleteSnapshot).mockResolvedValue(undefined);
    vi.mocked(computeSchemaDiff).mockReturnValue({ changes: [], breakingCount: 0, dangerousCount: 0, safeCount: 0, deprecatedCount: 0 });
    vi.mocked(addAck).mockResolvedValue(undefined);
    vi.mocked(deleteAck).mockResolvedValue(undefined);
    vi.mocked(scanDeprecatedFieldUsages).mockReturnValue([]);
  });

  describe('initial state', () => {
    it('initializes with empty snapshots', () => {
      const { result } = renderHook(() => useGraphqlSchemaSnapshots('conn1', null, 'none', null, EMPTY_TREES));
      expect(result.current.snapshots).toHaveLength(0);
    });

    it('initializes schemaDiffToast to false', () => {
      const { result } = renderHook(() => useGraphqlSchemaSnapshots('conn1', null, 'none', null, EMPTY_TREES));
      expect(result.current.schemaDiffToast).toBe(false);
    });

    it('initializes diffModal to null', () => {
      const { result } = renderHook(() => useGraphqlSchemaSnapshots('conn1', null, 'none', null, EMPTY_TREES));
      expect(result.current.diffModal).toBeNull();
    });

    it('initializes deprecatedUsages to empty array', () => {
      const { result } = renderHook(() => useGraphqlSchemaSnapshots('conn1', null, 'none', null, EMPTY_TREES));
      expect(result.current.deprecatedUsages).toHaveLength(0);
    });
  });

  describe('snapshot loading', () => {
    it('loads snapshots when connectionId is set', async () => {
      const snap = makeSnapshot('s1');
      vi.mocked(loadSnapshots).mockResolvedValue([snap]);
      const { result } = renderHook(() => useGraphqlSchemaSnapshots('conn1', null, 'none', null, EMPTY_TREES));
      await waitFor(() => {
        expect(result.current.snapshots).toHaveLength(1);
      });
      expect(loadSnapshots).toHaveBeenCalledWith('conn1');
    });

    it('does not load snapshots when connectionId is null', () => {
      renderHook(() => useGraphqlSchemaSnapshots(null, null, 'none', null, EMPTY_TREES));
      expect(loadSnapshots).not.toHaveBeenCalled();
    });

    it('swallows loadSnapshots rejection gracefully (.catch path)', async () => {
      vi.mocked(loadSnapshots).mockRejectedValue(new Error('IDB error'));
      // Should not throw; the .catch(() => {}) swallows the error
      const { result } = renderHook(() => useGraphqlSchemaSnapshots('conn1', null, 'none', null, EMPTY_TREES));
      await new Promise((r) => setTimeout(r, 50));
      expect(result.current.snapshots).toHaveLength(0);
    });
  });

  describe('deprecated field scanning', () => {
    it('scans collections for deprecated usages when rawIntrospection is provided', () => {
      const deprecatedResult = [{ itemId: 'i1', itemName: 'Query', field: 'deprecated', typeName: 'Query' }];
      vi.mocked(scanDeprecatedFieldUsages).mockReturnValue(deprecatedResult);
      const { result } = renderHook(() =>
        useGraphqlSchemaSnapshots('conn1', null, 'none', STABLE_INTROSPECTION, EMPTY_TREES),
      );
      expect(result.current.deprecatedUsages).toEqual(deprecatedResult);
    });

    it('maps collection tree items (covers flatMap/map callbacks)', () => {
      const TREES_WITH_ITEMS = [{
        items: [
          { id: 'op1', name: 'GetUser', operation: { query: '{ user { id } }' } as never },
          { id: 'op2', name: 'ListUsers', operation: { query: '{ users { id } }' } as never },
        ],
      }];
      renderHook(() =>
        useGraphqlSchemaSnapshots('conn1', null, 'none', STABLE_INTROSPECTION, TREES_WITH_ITEMS),
      );
      expect(scanDeprecatedFieldUsages).toHaveBeenCalledWith(
        STABLE_INTROSPECTION,
        expect.arrayContaining([
          expect.objectContaining({ id: 'op1', name: 'GetUser' }),
          expect.objectContaining({ id: 'op2', name: 'ListUsers' }),
        ]),
      );
    });

    it('clears deprecated usages when rawIntrospection is null', () => {
      const { result } = renderHook(() => useGraphqlSchemaSnapshots('conn1', null, 'none', null, EMPTY_TREES));
      expect(result.current.deprecatedUsages).toHaveLength(0);
      expect(scanDeprecatedFieldUsages).not.toHaveBeenCalled();
    });

    it('handles errors from scanDeprecatedFieldUsages gracefully', () => {
      vi.mocked(scanDeprecatedFieldUsages).mockImplementation(() => { throw new Error('scan error'); });
      const { result } = renderHook(() =>
        useGraphqlSchemaSnapshots('conn1', null, 'none', STABLE_INTROSPECTION, EMPTY_TREES),
      );
      expect(result.current.deprecatedUsages).toHaveLength(0);
    });
  });

  describe('schema change detection', () => {
    it('does not show toast on first schema load', () => {
      const info = makeSchemaInfo();
      const { result } = renderHook(() =>
        useGraphqlSchemaSnapshots('conn1', info, 'loaded', null, EMPTY_TREES),
      );
      expect(result.current.schemaDiffToast).toBe(false);
    });

    it('shows toast when schema changes between loads', () => {
      const info1 = makeSchemaInfo('type Query { v1: String }', 1000);
      let schemaInfo = info1;
      const { result, rerender } = renderHook(() =>
        useGraphqlSchemaSnapshots('conn1', schemaInfo, 'loaded', null, EMPTY_TREES),
      );
      expect(result.current.schemaDiffToast).toBe(false);
      // Simulate schema change
      schemaInfo = makeSchemaInfo('type Query { v2: String }', 2000);
      rerender();
      expect(result.current.schemaDiffToast).toBe(true);
    });

    it('does not show toast when schema stays the same between loads', () => {
      const info1 = makeSchemaInfo('type Query { same: String }', 1000);
      let schemaInfo = info1;
      const { result, rerender } = renderHook(() =>
        useGraphqlSchemaSnapshots('conn1', schemaInfo, 'loaded', null, EMPTY_TREES),
      );
      expect(result.current.schemaDiffToast).toBe(false);
      schemaInfo = makeSchemaInfo('type Query { same: String }', 2000); // same SDL, new fetchedAt
      rerender();
      expect(result.current.schemaDiffToast).toBe(false);
    });

    it('sets toastBaselineSnapshotIdRef.current to null when no snapshots exist on change', () => {
      vi.mocked(loadSnapshots).mockResolvedValue([]);
      const info1 = makeSchemaInfo('type Query { v1: String }', 1000);
      let schemaInfo = info1;
      const { result, rerender } = renderHook(() =>
        useGraphqlSchemaSnapshots('conn1', schemaInfo, 'loaded', null, EMPTY_TREES),
      );
      schemaInfo = makeSchemaInfo('type Query { v2: String }', 2000);
      rerender();
      expect(result.current.toastBaselineSnapshotIdRef.current).toBeNull();
    });

    it('sets toastBaselineSnapshotIdRef.current to first snapshot id when snapshots exist on change', async () => {
      const snap = makeSnapshot('baseline-snap');
      vi.mocked(loadSnapshots).mockResolvedValue([snap]);
      const info1 = makeSchemaInfo('type Query { v1: String }', 1000);
      let schemaInfo = info1;
      const { result, rerender } = renderHook(() =>
        useGraphqlSchemaSnapshots('conn1', schemaInfo, 'loaded', null, EMPTY_TREES),
      );
      await waitFor(() => expect(result.current.snapshots).toHaveLength(1));
      schemaInfo = makeSchemaInfo('type Query { v2: String }', 2000);
      rerender();
      expect(result.current.toastBaselineSnapshotIdRef.current).toBe('baseline-snap');
    });

    it('auto-dismisses schema diff toast after 8s', () => {
      vi.useFakeTimers();
      const { result } = renderHook(() => useGraphqlSchemaSnapshots('conn1', null, 'none', null, EMPTY_TREES));
      act(() => { result.current.setSchemaDiffToast(true); });
      expect(result.current.schemaDiffToast).toBe(true);
      act(() => { vi.advanceTimersByTime(8001); });
      expect(result.current.schemaDiffToast).toBe(false);
      vi.useRealTimers();
    });
  });

  describe('handleSaveSnapshot', () => {
    it('does not save when schemaInfo is null', async () => {
      const { result } = renderHook(() => useGraphqlSchemaSnapshots('conn1', null, 'none', null, EMPTY_TREES));
      await act(async () => { await result.current.handleSaveSnapshot(); });
      expect(saveSnapshot).not.toHaveBeenCalled();
    });

    it('does not save when connectionId is null', async () => {
      const info = makeSchemaInfo();
      const { result } = renderHook(() => useGraphqlSchemaSnapshots(null, info, 'loaded', null, EMPTY_TREES));
      await act(async () => { await result.current.handleSaveSnapshot(); });
      expect(saveSnapshot).not.toHaveBeenCalled();
    });

    it('saves snapshot with correct connectionId and sdl', async () => {
      const info = makeSchemaInfo('type Query { hello: String }');
      const { result } = renderHook(() => useGraphqlSchemaSnapshots('conn1', info, 'loaded', null, EMPTY_TREES));
      await act(async () => { await result.current.handleSaveSnapshot(); });
      expect(saveSnapshot).toHaveBeenCalledWith(
        expect.objectContaining({ connectionId: 'conn1', sdl: 'type Query { hello: String }' }),
      );
    });
  });

  describe('handleDeleteSnapshot', () => {
    it('calls deleteSnapshot', async () => {
      const { result } = renderHook(() => useGraphqlSchemaSnapshots('conn1', null, 'none', null, EMPTY_TREES));
      await act(async () => { await result.current.handleDeleteSnapshot('s1'); });
      expect(deleteSnapshot).toHaveBeenCalledWith('s1');
    });

    it('reloads snapshots after deletion', async () => {
      const { result } = renderHook(() => useGraphqlSchemaSnapshots('conn1', null, 'none', null, EMPTY_TREES));
      await act(async () => { await result.current.handleDeleteSnapshot('s1'); });
      expect(loadSnapshots).toHaveBeenCalledWith('conn1');
    });

    it('does not reload snapshots when connectionId is null', async () => {
      const { result } = renderHook(() => useGraphqlSchemaSnapshots(null, null, 'none', null, EMPTY_TREES));
      await act(async () => { await result.current.handleDeleteSnapshot('s1'); });
      expect(deleteSnapshot).toHaveBeenCalledWith('s1');
      expect(loadSnapshots).not.toHaveBeenCalled();
    });
  });

  describe('handleOpenDiff', () => {
    it('does nothing when schemaInfo is null and no compareToId', async () => {
      const snap = makeSnapshot('s1');
      const { result } = renderHook(() => useGraphqlSchemaSnapshots('conn1', null, 'none', null, EMPTY_TREES));
      await act(async () => { await result.current.handleOpenDiff(snap); });
      expect(result.current.diffModal).toBeNull();
    });

    it('calls computeSchemaDiff and sets diffModal when schemaInfo available', async () => {
      const snap = makeSnapshot('s1', 'type Query { old: String }');
      const info = makeSchemaInfo('type Query { new: String }');
      const { result } = renderHook(() =>
        useGraphqlSchemaSnapshots('conn1', info, 'loaded', null, EMPTY_TREES),
      );
      await act(async () => { await result.current.handleOpenDiff(snap); });
      expect(computeSchemaDiff).toHaveBeenCalledWith(
        'type Query { old: String }',
        'type Query { new: String }',
        [],
      );
      expect(result.current.diffModal).not.toBeNull();
      expect(result.current.diffModal?.newLabel).toBe('Current schema');
    });

    it('handles computeSchemaDiff error gracefully', async () => {
      vi.mocked(computeSchemaDiff).mockImplementation(() => { throw new Error('diff error'); });
      const snap = makeSnapshot('s1');
      const info = makeSchemaInfo();
      const { result } = renderHook(() => useGraphqlSchemaSnapshots('conn1', info, 'loaded', null, EMPTY_TREES));
      await act(async () => { await result.current.handleOpenDiff(snap); });
      expect(result.current.diffModal).not.toBeNull();
      expect(result.current.diffModal?.oldLabel).toContain('parse error');
    });

    it('sets snapshotId on diffModal', async () => {
      const snap = makeSnapshot('s1', 'type Query { old: String }');
      const info = makeSchemaInfo('type Query { new: String }');
      const { result } = renderHook(() =>
        useGraphqlSchemaSnapshots('conn1', info, 'loaded', null, EMPTY_TREES),
      );
      await act(async () => { await result.current.handleOpenDiff(snap); });
      expect(result.current.diffModal?.snapshotId).toBe('s1');
    });

    it('compareToId: does nothing when other snapshot not found', async () => {
      const snap = makeSnapshot('s1', 'type Query { a: String }');
      const { result } = renderHook(() => useGraphqlSchemaSnapshots('conn1', null, 'none', null, EMPTY_TREES));
      await act(async () => { await result.current.handleOpenDiff(snap, 'nonexistent'); });
      expect(result.current.diffModal).toBeNull();
    });

    it('uses snapshot.label when available (covers label ?? date fallback true branch)', async () => {
      const snap = makeSnapshot('s1', 'type Query { old: String }');
      (snap as GraphqlSchemaSnapshot & { label?: string }).label = 'My Snapshot';
      const info = makeSchemaInfo('type Query { new: String }');
      const { result } = renderHook(() =>
        useGraphqlSchemaSnapshots('conn1', info, 'loaded', null, EMPTY_TREES),
      );
      await act(async () => { await result.current.handleOpenDiff(snap); });
      expect(result.current.diffModal?.oldLabel).toBe('My Snapshot');
    });

    it('compareToId: uses snapshot labels when available', async () => {
      const older = makeSnapshot('s1', 'type Query { old: String }', 1000);
      const newer = makeSnapshot('s2', 'type Query { new: String }', 2000);
      (older as GraphqlSchemaSnapshot & { label?: string }).label = 'v1.0';
      (newer as GraphqlSchemaSnapshot & { label?: string }).label = 'v2.0';
      vi.mocked(loadSnapshots).mockResolvedValue([older, newer]);
      const { result } = renderHook(() => useGraphqlSchemaSnapshots('conn1', null, 'none', null, EMPTY_TREES));
      await waitFor(() => expect(result.current.snapshots).toHaveLength(2));
      await act(async () => { await result.current.handleOpenDiff(older, 's2'); });
      expect(result.current.diffModal?.oldLabel).toBe('v1.0');
      expect(result.current.diffModal?.newLabel).toBe('v2.0');
    });

    it('compareToId: compares two snapshots (older vs newer)', async () => {
      const older = makeSnapshot('s1', 'type Query { old: String }', 1000);
      const newer = makeSnapshot('s2', 'type Query { new: String }', 2000);
      vi.mocked(loadSnapshots).mockResolvedValue([older, newer]);
      const { result } = renderHook(() => useGraphqlSchemaSnapshots('conn1', null, 'none', null, EMPTY_TREES));
      await waitFor(() => expect(result.current.snapshots).toHaveLength(2));
      // Open diff between the older snapshot and the newer one
      await act(async () => { await result.current.handleOpenDiff(older, 's2'); });
      expect(computeSchemaDiff).toHaveBeenCalledWith(
        'type Query { old: String }',
        'type Query { new: String }',
        [],
      );
      expect(result.current.diffModal).not.toBeNull();
      expect(result.current.diffModal?.snapshotId).toBeUndefined();
    });

    it('compareToId: swaps oldSdl/newSdl when first snapshot is newer', async () => {
      const older = makeSnapshot('s1', 'type Query { old: String }', 1000);
      const newer = makeSnapshot('s2', 'type Query { new: String }', 2000);
      vi.mocked(loadSnapshots).mockResolvedValue([older, newer]);
      const { result } = renderHook(() => useGraphqlSchemaSnapshots('conn1', null, 'none', null, EMPTY_TREES));
      await waitFor(() => expect(result.current.snapshots).toHaveLength(2));
      // Open diff with newer as primary (should swap)
      await act(async () => { await result.current.handleOpenDiff(newer, 's1'); });
      expect(computeSchemaDiff).toHaveBeenCalledWith(
        'type Query { old: String }',
        'type Query { new: String }',
        [],
      );
    });
  });

  describe('handleAcknowledge and handleUnacknowledge', () => {
    it('does nothing when diffModal has no snapshotId', async () => {
      const { result } = renderHook(() => useGraphqlSchemaSnapshots('conn1', null, 'none', null, EMPTY_TREES));
      act(() => {
        result.current.setDiffModal({
          result: { changes: [], breakingCount: 0, dangerousCount: 0, safeCount: 0, deprecatedCount: 0 },
          oldSdl: '', newSdl: '', oldLabel: '', newLabel: '',
        });
      });
      await act(async () => { await result.current.handleAcknowledge('path', 'note'); });
      expect(addAck).not.toHaveBeenCalled();
    });

    it('handleAcknowledge: calls addAck when snapshotId exists', async () => {
      const snap = makeSnapshot('s1', 'type Query { old: String }');
      const info = makeSchemaInfo('type Query { new: String }');
      const { result } = renderHook(() => useGraphqlSchemaSnapshots('conn1', info, 'loaded', null, EMPTY_TREES));
      await act(async () => { await result.current.handleOpenDiff(snap); });
      expect(result.current.diffModal?.snapshotId).toBe('s1');
      await act(async () => { await result.current.handleAcknowledge('Query.old', 'note'); });
      expect(addAck).toHaveBeenCalledWith('conn1', 's1', 'Query.old', 'note');
    });

    it('handleUnacknowledge: calls deleteAck when snapshotId exists', async () => {
      const snap = makeSnapshot('s1', 'type Query { old: String }');
      const info = makeSchemaInfo('type Query { new: String }');
      const { result } = renderHook(() => useGraphqlSchemaSnapshots('conn1', info, 'loaded', null, EMPTY_TREES));
      await act(async () => { await result.current.handleOpenDiff(snap); });
      await act(async () => { await result.current.handleUnacknowledge('Query.old'); });
      expect(deleteAck).toHaveBeenCalled();
    });

    it('handleUnacknowledge: does nothing when diffModal has no snapshotId', async () => {
      const { result } = renderHook(() => useGraphqlSchemaSnapshots('conn1', null, 'none', null, EMPTY_TREES));
      act(() => {
        result.current.setDiffModal({
          result: { changes: [], breakingCount: 0, dangerousCount: 0, safeCount: 0, deprecatedCount: 0 },
          oldSdl: '', newSdl: '', oldLabel: '', newLabel: '',
        });
      });
      await act(async () => { await result.current.handleUnacknowledge('path'); });
      expect(deleteAck).not.toHaveBeenCalled();
    });
  });
});
