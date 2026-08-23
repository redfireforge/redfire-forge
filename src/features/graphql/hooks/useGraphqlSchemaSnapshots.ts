/**
 * useGraphqlSchemaSnapshots — manages schema snapshot CRUD + diff modal + change detection.
 *
 * Phase 3D: Schema version control, diff visualization, change acknowledgement,
 * deprecated field scanning.
 *
 * Extracted from GraphqlStudioPage.tsx to reduce its line count.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { GraphqlSchemaSnapshot, GraphqlSchemaDiffResult, GraphqlOperation } from '@shared/types/graphql';
import type { DeprecatedFieldUsage } from '../utils/deprecatedFieldScanner';
import { scanDeprecatedFieldUsages } from '../utils/deprecatedFieldScanner';
import { computeSchemaDiff } from '../utils/schemaDiff';
import { saveSnapshot, loadSnapshots, deleteSnapshot } from '../utils/schemaSnapshot';
import { buildDefaultSnapshotLabel, resolveSnapshotTypesCount, isGenericSnapshotLabel } from '../utils/changelogPanelUtils';
import { getAcks, addAck, deleteAck, ackId } from '../utils/schemaDiffAck';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SchemaInfo {
  sdl: string;
  types: unknown[];
  fetchedAt?: number;
}

interface CollectionTree {
  items: Array<{ id: string; name: string; operation: GraphqlOperation }>;
}

export interface DiffModalState {
  result: GraphqlSchemaDiffResult;
  oldSdl: string;
  newSdl: string;
  oldLabel: string;
  newLabel: string;
  snapshotId?: string;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UseGraphqlSchemaSnapshotsResult {
  snapshots: GraphqlSchemaSnapshot[];
  deprecatedUsages: DeprecatedFieldUsage[];
  diffModal: DiffModalState | null;
  setDiffModal: React.Dispatch<React.SetStateAction<DiffModalState | null>>;
  schemaDiffToast: boolean;
  setSchemaDiffToast: (v: boolean) => void;
  /** Ref to the snapshot pinned at detection time for "View diff →" link. */
  toastBaselineSnapshotIdRef: React.RefObject<string | null>;
  handleSaveSnapshot: () => Promise<void>;
  handleDeleteSnapshot: (id: string) => Promise<void>;
  /** Delete all snapshots except the N newest (default: keep latest only). */
  handleClearOlderSnapshots: (keepCount?: number) => Promise<number>;
  handleOpenDiff: (snapshot: GraphqlSchemaSnapshot, compareToId?: string) => Promise<void>;
  handleAcknowledge: (changePath: string, note: string) => Promise<void>;
  handleUnacknowledge: (changePath: string) => Promise<void>;
}

export function useGraphqlSchemaSnapshots(
  connectionId: string | null,
  schemaInfo: SchemaInfo | null,
  schemaStatus: string,
  rawIntrospection: unknown,
  collectionTrees: CollectionTree[],
): UseGraphqlSchemaSnapshotsResult {
  const [snapshots, setSnapshots] = useState<GraphqlSchemaSnapshot[]>([]);
  const [deprecatedUsages, setDeprecatedUsages] = useState<DeprecatedFieldUsage[]>([]);
  const [diffModal, setDiffModal] = useState<DiffModalState | null>(null);
  const [schemaDiffToast, setSchemaDiffToast] = useState(false);
  const prevSchemaHashRef = useRef<string | null>(null);
  const toastBaselineSnapshotIdRef = useRef<string | null>(null);
  // Keep a ref to snapshots so the schema-change detection effect can read the
  // latest snapshot list without adding `snapshots` to its deps (which would
  // spuriously re-run on every snapshot save/delete).
  const snapshotsRef = useRef<GraphqlSchemaSnapshot[]>(snapshots);
  snapshotsRef.current = snapshots;

  // Auto-dismiss schema-change toast after 8 s
  useEffect(() => {
    if (!schemaDiffToast) return;
    const t = setTimeout(() => setSchemaDiffToast(false), 8000);
    return () => clearTimeout(t);
  }, [schemaDiffToast]);

  // Load snapshots when the connection changes
  useEffect(() => {
    // Reset schema-change detection when switching connections so the first schema
    // load for the new connection never triggers a spurious "Schema changed" toast.
    prevSchemaHashRef.current = null;
    setSchemaDiffToast(false);
    if (!connectionId) return;
    loadSnapshots(connectionId)
      .then(setSnapshots)
      .catch(() => {});
  }, [connectionId]);

  // Allow external callers (e.g. demo lesson re-seed) to refresh the changelog list.
  useEffect(() => {
    if (!connectionId) return;
    const reload = () => {
      loadSnapshots(connectionId).then(setSnapshots).catch(() => {});
    };
    window.addEventListener('rf-gql-snapshots-changed', reload);
    return () => window.removeEventListener('rf-gql-snapshots-changed', reload);
  }, [connectionId]);

  // Detect schema changes between introspections and show a toast.
  // Uses snapshotsRef (kept in sync above) instead of the `snapshots` state
  // value to avoid re-running the effect on every snapshot save/delete while
  // still reading the latest snapshot list at the moment a change is detected.
  useEffect(() => {
    if (schemaStatus !== 'loaded' || !schemaInfo?.sdl) return;

    const prev = prevSchemaHashRef.current;
    prevSchemaHashRef.current = schemaInfo.sdl;
    if (prev !== null && prev !== schemaInfo.sdl) {
      toastBaselineSnapshotIdRef.current = snapshotsRef.current[0]?.id ?? null;
      setSchemaDiffToast(true);
    }
  }, [schemaStatus, schemaInfo?.fetchedAt, schemaInfo?.sdl]);

  // Scan collection items for deprecated field usage on schema or collection change
  useEffect(() => {
    if (!rawIntrospection) { setDeprecatedUsages([]); return; }
    const allItems = collectionTrees.flatMap((t) =>
      t.items.map((item) => ({ id: item.id, name: item.name, operation: item.operation })),
    );
    try {
      const usages = scanDeprecatedFieldUsages(rawIntrospection, allItems);
      setDeprecatedUsages(usages);
    } catch { setDeprecatedUsages([]); }
  }, [rawIntrospection, collectionTrees]);

  const handleSaveSnapshot = useCallback(async () => {
    if (!schemaInfo?.sdl || !connectionId) return;
    const latest = snapshotsRef.current[0];
    if (latest?.sdl === schemaInfo.sdl) return;

    const capturedAt = Date.now();
    const snapshot: GraphqlSchemaSnapshot = {
      id: crypto.randomUUID(),
      connectionId,
      sdl: schemaInfo.sdl,
      typesCount: resolveSnapshotTypesCount(
        schemaInfo.sdl,
        (schemaInfo.types as unknown[] | undefined)?.length ?? 0,
      ),
      capturedAt,
      label: buildDefaultSnapshotLabel(capturedAt),
    };
    await saveSnapshot(snapshot);
    setSnapshots(await loadSnapshots(connectionId));
  }, [schemaInfo, connectionId]);

  const handleDeleteSnapshot = useCallback(async (id: string) => {
    await deleteSnapshot(id);
    if (connectionId) setSnapshots(await loadSnapshots(connectionId));
  }, [connectionId]);

  const handleClearOlderSnapshots = useCallback(async (keepCount = 1) => {
    if (!connectionId || keepCount < 1) return 0;
    const sorted = [...snapshotsRef.current].sort((a, b) => b.capturedAt - a.capturedAt);
    const keepIds = new Set<string>();
    for (const snap of sorted.slice(0, keepCount)) {
      keepIds.add(snap.id);
    }
    // Preserve named snapshots (e.g. demo baselines, release tags).
    for (const snap of sorted) {
      if (!isGenericSnapshotLabel(snap.label)) keepIds.add(snap.id);
    }
    const toDelete = sorted.filter((snap) => !keepIds.has(snap.id));
    if (toDelete.length === 0) return 0;
    for (const snap of toDelete) {
      await deleteSnapshot(snap.id);
    }
    setSnapshots(await loadSnapshots(connectionId));
    return toDelete.length;
  }, [connectionId]);

  const handleOpenDiff = useCallback(async (
    snapshot: GraphqlSchemaSnapshot,
    compareToId?: string,
  ) => {
    let oldSdl   = snapshot.sdl;
    let oldLabel = snapshot.label ?? new Date(snapshot.capturedAt).toLocaleDateString();

    let newSdl: string;
    let newLabel: string;
    let activeSnapshotId: string | undefined;

    if (compareToId) {
      const other = snapshots.find((s) => s.id === compareToId);
      if (!other) return;
      if (snapshot.capturedAt <= other.capturedAt) {
        newSdl   = other.sdl;
        newLabel = other.label ?? new Date(other.capturedAt).toLocaleDateString();
      } else {
        oldSdl   = other.sdl;
        oldLabel = other.label ?? new Date(other.capturedAt).toLocaleDateString();
        newSdl   = snapshot.sdl;
        newLabel = snapshot.label ?? new Date(snapshot.capturedAt).toLocaleDateString();
      }
      activeSnapshotId = undefined;
    } else {
      if (!schemaInfo?.sdl) return;
      newSdl = schemaInfo.sdl;
      newLabel = 'Current schema';
      activeSnapshotId = snapshot.id;
    }

    const acks = activeSnapshotId && connectionId
      ? await getAcks(connectionId, activeSnapshotId)
      : [];

    try {
      const result = computeSchemaDiff(oldSdl, newSdl, acks);
      setDiffModal({ result, oldSdl, newSdl, oldLabel, newLabel, snapshotId: activeSnapshotId });
    } catch (err) {
      console.error('[Phase 3D] Failed to compute schema diff:', err instanceof Error ? err.message : String(err));
      setDiffModal({
        result: { changes: [], breakingCount: 0, dangerousCount: 0, safeCount: 0, deprecatedCount: 0 },
        oldSdl,
        newSdl,
        oldLabel: `${oldLabel} (parse error)`,
        newLabel,
        snapshotId: activeSnapshotId,
      });
    }
  }, [schemaInfo, snapshots, connectionId]);

  const handleAcknowledge = useCallback(async (changePath: string, note: string) => {
    if (!diffModal?.snapshotId || !connectionId) return;
    await addAck(connectionId, diffModal.snapshotId, changePath, note);
    const acks = await getAcks(connectionId, diffModal.snapshotId);
    try {
      const result = computeSchemaDiff(diffModal.oldSdl, diffModal.newSdl, acks);
      setDiffModal((prev) => prev ? { ...prev, result } : null);
    } catch { /* ignore */ }
  }, [diffModal, connectionId]);

  const handleUnacknowledge = useCallback(async (changePath: string) => {
    if (!diffModal?.snapshotId || !connectionId) return;
    await deleteAck(ackId(connectionId, diffModal.snapshotId, changePath));
    const acks = await getAcks(connectionId, diffModal.snapshotId);
    try {
      const result = computeSchemaDiff(diffModal.oldSdl, diffModal.newSdl, acks);
      setDiffModal((prev) => prev ? { ...prev, result } : null);
    } catch { /* ignore */ }
  }, [diffModal, connectionId]);

  return {
    snapshots,
    deprecatedUsages,
    diffModal,
    setDiffModal,
    schemaDiffToast,
    setSchemaDiffToast,
    toastBaselineSnapshotIdRef,
    handleSaveSnapshot,
    handleDeleteSnapshot,
    handleClearOlderSnapshots,
    handleOpenDiff,
    handleAcknowledge,
    handleUnacknowledge,
  };
}
