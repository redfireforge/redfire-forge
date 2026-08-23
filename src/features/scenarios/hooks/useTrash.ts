import { useState, useEffect, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type {
  TrashItem, TrashEntityType, TrashSettings,
  FeatureGroup, TestScenario, Scenario, SharedDataSource,
} from '@shared/types';
import {
  loadTrash, addToTrash as storageAddToTrash,
  removeFromTrash as storageRemoveFromTrash, emptyTrash as storageEmptyTrash,
  loadTrashSettings, saveTrashSettings,
} from '@shared/utils/trashStorage';
import { logItemRestored } from '../utils/structureChangeLog';
import {
  DEFAULT_TRASH_SETTINGS,
  RESTORED_ITEMS_FG_NAME, RESTORED_TESTS_SC_NAME, RESTORED_SUFFIX,
  computeExpiresAt,
} from '@shared/utils/trashConstants';

// ── Public types ──

export interface MoveToTrashFn {
  (
    entityType: TrashEntityType,
    data: FeatureGroup | TestScenario | Scenario | SharedDataSource,
    entityName: string,
    parentPath: string,
    parentIds: {
      parentFeatureGroupId?: string;
      parentScenarioId?: string;
      environmentId?: string;
      microserviceId?: string;
    },
  ): void;
}

export interface UseTrashParams {
  featureGroups: FeatureGroup[];
  setFeatureGroups: React.Dispatch<React.SetStateAction<FeatureGroup[]>>;
  sharedDataSources: SharedDataSource[];
  setSharedDataSources: React.Dispatch<React.SetStateAction<SharedDataSource[]>>;
  environments: Array<{ id: string }>;
  microservices: Array<{ id: string }>;
}

export interface UseTrashReturn {
  trashItems: TrashItem[];
  loading: boolean;
  trashCount: number;
  lastDeleted: TrashItem | null;
  clearLastDeleted: () => void;
  trashSettings: TrashSettings;
  updateTrashSettings: (partial: Partial<TrashSettings>) => Promise<void>;
  moveToTrash: MoveToTrashFn;
  restoreItem: (trashId: string) => Promise<void>;
  permanentlyDelete: (trashId: string) => Promise<void>;
  emptyAllTrash: () => Promise<void>;
  undoLastDelete: () => Promise<void>;
}

// ── Hook ──

export function useTrash({
  featureGroups: _featureGroups, setFeatureGroups,
  sharedDataSources: _sharedDataSources, setSharedDataSources,
  environments, microservices,
}: UseTrashParams): UseTrashReturn {
  const [trashItems, setTrashItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastDeleted, setLastDeleted] = useState<TrashItem | null>(null);
  const [trashSettings, setTrashSettings] = useState<TrashSettings>({ ...DEFAULT_TRASH_SETTINGS });

  const envsRef = useRef(environments);
  envsRef.current = environments;
  const svcsRef = useRef(microservices);
  svcsRef.current = microservices;
  const trashRef = useRef(trashItems);
  trashRef.current = trashItems;

  useEffect(() => {
    const trashP = loadTrash().catch(() => [] as TrashItem[]);
    const settingsP = loadTrashSettings().catch(() => ({ ...DEFAULT_TRASH_SETTINGS }) as TrashSettings);
    Promise.all([trashP, settingsP]).then(([items, settings]) => {
      setTrashItems(items);
      setTrashSettings(settings);
      setLoading(false);
    });
  }, []);

  const settingsRef = useRef(trashSettings);
  settingsRef.current = trashSettings;

  const updateTrashSettings = useCallback(async (partial: Partial<TrashSettings>) => {
    const next = { ...settingsRef.current, ...partial };
    settingsRef.current = next;
    setTrashSettings(next);
    try {
      await saveTrashSettings(next);
    } catch (err) {
      console.error('[Trash] Failed to persist settings:', err);
    }
  }, []);

  const moveToTrash: MoveToTrashFn = useCallback((entityType, data, entityName, parentPath, parentIds) => {
    (async () => {
      const { retentionDays, maxItems } = settingsRef.current;
      const now = Date.now();
      const item: TrashItem = {
        id: uuidv4(),
        deletedAt: now,
        expiresAt: computeExpiresAt(now, retentionDays),
        entityType,
        entityName,
        parentPath,
        parentFeatureGroupId: parentIds.parentFeatureGroupId,
        parentScenarioId: parentIds.parentScenarioId,
        environmentId: parentIds.environmentId,
        microserviceId: parentIds.microserviceId,
        childCounts: computeChildCounts(entityType, data),
        data: structuredClone(data),
      };
      setTrashItems(prev => {
        const next = [item, ...prev];
        if (next.length > maxItems) {
          return next.slice(0, maxItems);
        }
        return next;
      });
      setLastDeleted(item);
      try {
        await storageAddToTrash(item);
      } catch (err) {
        console.error('[Trash] Failed to persist trash item:', err);
      }
    })();
  }, []);

  const restoreItem = useCallback(async (trashId: string) => {
    const item = trashRef.current.find(i => i.id === trashId);
    if (!item) return;

    switch (item.entityType) {
      case 'featureGroup':
        restoreFeatureGroup(item, setFeatureGroups, envsRef.current, svcsRef.current);
        break;
      case 'scenario':
        restoreScenario(item, setFeatureGroups);
        break;
      case 'test':
        restoreTest(item, setFeatureGroups);
        break;
      case 'sharedDataSource':
        restoreSharedDataSource(item, setSharedDataSources);
        break;
    }

    setTrashItems(prev => prev.filter(i => i.id !== trashId));
    try {
      await storageRemoveFromTrash(trashId);
    } catch (err) {
      console.error('[Trash] Failed to remove restored item from storage:', err);
    }
  }, [setFeatureGroups, setSharedDataSources]);

  const permanentlyDelete = useCallback(async (trashId: string) => {
    setTrashItems(prev => prev.filter(i => i.id !== trashId));
    try {
      await storageRemoveFromTrash(trashId);
    } catch (err) {
      console.error('[Trash] Failed to permanently delete from storage:', err);
    }
  }, []);

  const emptyAllTrash = useCallback(async () => {
    setTrashItems([]);
    try {
      await storageEmptyTrash();
    } catch (err) {
      console.error('[Trash] Failed to empty trash storage:', err);
    }
  }, []);

  const undoLastDelete = useCallback(async () => {
    if (!lastDeleted) return;
    await restoreItem(lastDeleted.id);
    setLastDeleted(null);
  }, [lastDeleted, restoreItem]);

  const clearLastDeleted = useCallback(() => setLastDeleted(null), []);

  return {
    trashItems, loading, trashCount: trashItems.length,
    lastDeleted, clearLastDeleted,
    trashSettings, updateTrashSettings,
    moveToTrash, restoreItem, permanentlyDelete, emptyAllTrash, undoLastDelete,
  };
}

// ── Restore helpers ──

function restoreFeatureGroup(
  item: TrashItem,
  setFgs: React.Dispatch<React.SetStateAction<FeatureGroup[]>>,
  envs: Array<{ id: string }>,
  svcs: Array<{ id: string }>,
) {
  const fg = item.data as FeatureGroup;
  setFgs(prev => {
    let restored = ensureUniqueIds(fg, prev);
    const envValid = !restored.environmentId || envs.some(e => e.id === restored.environmentId);
    const svcValid = !restored.microserviceId || svcs.some(s => s.id === restored.microserviceId);
    if (!envValid || !svcValid) {
      restored = { ...restored, ...(!envValid && { environmentId: undefined }), ...(!svcValid && { microserviceId: undefined }) };
    }
    restored = logItemRestored(restored, restored.name);
    return [...prev, restored];
  });
}

function restoreScenario(
  item: TrashItem,
  setFgs: React.Dispatch<React.SetStateAction<FeatureGroup[]>>,
) {
  const scenario = item.data as TestScenario;
  const parentFgId = item.parentFeatureGroupId;

  setFgs(prev => {
    const parentFg = parentFgId ? prev.find(f => f.id === parentFgId) : undefined;
    if (parentFg) {
      const restored = ensureUniqueScenarioIds(scenario, parentFg.scenarios);
      return prev.map(fg =>
        fg.id === parentFg.id
          ? logItemRestored({ ...fg, scenarios: [...fg.scenarios, restored] }, restored.name)
          : fg
      );
    }
    const allExistingScs = prev.flatMap(f => f.scenarios);
    const restored = ensureUniqueScenarioIds(scenario, allExistingScs);
    const restoredFg: FeatureGroup = {
      id: uuidv4(),
      name: RESTORED_ITEMS_FG_NAME,
      scenarios: [restored],
    };
    return [...prev, logItemRestored(restoredFg, restored.name)];
  });
}

function restoreTest(
  item: TrashItem,
  setFgs: React.Dispatch<React.SetStateAction<FeatureGroup[]>>,
) {
  const test = item.data as Scenario;
  const parentFgId = item.parentFeatureGroupId;
  const parentScId = item.parentScenarioId;

  setFgs(prev => {
    const parentFg = parentFgId ? prev.find(f => f.id === parentFgId) : undefined;
    const parentSc = parentFg?.scenarios.find(s => s.id === parentScId);

    if (parentFg && parentSc) {
      const restored = resolveTestIdCollision(test, new Set(parentSc.tests.map(t => t.id)));
      return prev.map(fg =>
        fg.id === parentFg.id
          ? logItemRestored({
              ...fg,
              scenarios: fg.scenarios.map(sc =>
                sc.id === parentSc.id ? { ...sc, tests: [...sc.tests, restored] } : sc
              ),
            }, restored.name ?? 'test', parentSc.name)
          : fg
      );
    }
    if (parentFg) {
      const allTestIds = new Set(parentFg.scenarios.flatMap(s => s.tests.map(t => t.id)));
      const restoredTest = resolveTestIdCollision(test, allTestIds);
      const newSc: TestScenario = { id: uuidv4(), name: RESTORED_TESTS_SC_NAME, kind: 'standard', tests: [restoredTest] };
      return prev.map(fg =>
        fg.id === parentFg.id
          ? logItemRestored({ ...fg, scenarios: [...fg.scenarios, newSc] }, restoredTest.name ?? 'test')
          : fg
      );
    }
    const allTestIds = new Set(prev.flatMap(f => f.scenarios.flatMap(s => s.tests.map(t => t.id))));
    const restoredTest = resolveTestIdCollision(test, allTestIds);
    const newSc: TestScenario = { id: uuidv4(), name: RESTORED_TESTS_SC_NAME, kind: 'standard', tests: [restoredTest] };
    const newFg: FeatureGroup = { id: uuidv4(), name: RESTORED_ITEMS_FG_NAME, scenarios: [newSc] };
    return [...prev, logItemRestored(newFg, restoredTest.name ?? 'test')];
  });
}

function restoreSharedDataSource(
  item: TrashItem,
  setDs: React.Dispatch<React.SetStateAction<SharedDataSource[]>>,
) {
  const ds = item.data as SharedDataSource;
  setDs(prev => {
    const hasCollision = prev.some(d => d.id === ds.id);
    const restored = hasCollision
      ? { ...ds, id: uuidv4(), name: `${ds.name}${RESTORED_SUFFIX}` }
      : ds;
    return [...prev, restored];
  });
}

// ── ID collision helpers ──

function resolveTestIdCollision(test: Scenario, existingIds: Set<string>): Scenario {
  return existingIds.has(test.id) ? { ...test, id: uuidv4() } : test;
}

function ensureUniqueIds(fg: FeatureGroup, existingFgs: FeatureGroup[]): FeatureGroup {
  const existingFgIds = new Set(existingFgs.map(f => f.id));
  const existingScIds = new Set(existingFgs.flatMap(f => f.scenarios.map(s => s.id)));
  const existingTestIds = new Set(existingFgs.flatMap(f => f.scenarios.flatMap(s => s.tests.map(t => t.id))));

  const needsNewFgId = existingFgIds.has(fg.id);
  return {
    ...fg,
    id: needsNewFgId ? uuidv4() : fg.id,
    name: needsNewFgId ? `${fg.name}${RESTORED_SUFFIX}` : fg.name,
    scenarios: fg.scenarios.map(sc => {
      const needsNewScId = existingScIds.has(sc.id);
      return {
        ...sc,
        id: needsNewScId ? uuidv4() : sc.id,
        tests: sc.tests.map(t => ({
          ...t,
          id: existingTestIds.has(t.id) ? uuidv4() : t.id,
        })),
      };
    }),
  };
}

function ensureUniqueScenarioIds(sc: TestScenario, existingScs: TestScenario[]): TestScenario {
  const existingIds = new Set(existingScs.map(s => s.id));
  const existingTestIds = new Set(existingScs.flatMap(s => s.tests.map(t => t.id)));
  const needsNewId = existingIds.has(sc.id);
  return {
    ...sc,
    id: needsNewId ? uuidv4() : sc.id,
    tests: sc.tests.map(t => ({
      ...t,
      id: existingTestIds.has(t.id) ? uuidv4() : t.id,
    })),
  };
}

function computeChildCounts(
  entityType: TrashEntityType,
  data: FeatureGroup | TestScenario | Scenario | SharedDataSource,
): TrashItem['childCounts'] {
  if (entityType === 'featureGroup') {
    const fg = data as FeatureGroup;
    return {
      scenarios: fg.scenarios.length,
      tests: fg.scenarios.reduce((sum, sc) => sum + sc.tests.length, 0),
    };
  }
  if (entityType === 'scenario') {
    const sc = data as TestScenario;
    return { tests: sc.tests.length };
  }
  return undefined;
}
