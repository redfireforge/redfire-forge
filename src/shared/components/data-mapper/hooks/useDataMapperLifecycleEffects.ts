import { useEffect, useRef, type MutableRefObject } from 'react';
import type { MapperAdapter, Mapping } from '../types';

interface UseDataMapperLifecycleEffectsParams {
  repairTick?: number;
  repairedMappingsRef?: MutableRefObject<Mapping[] | null>;
  setMappings: (mappings: Mapping[]) => void;
  onChange?: (mappings: Mapping[]) => void;
  mappings: Mapping[];
  autoMapScoresRef: MutableRefObject<Map<string, number>>;
  patternMappingIdsRef: MutableRefObject<Set<string>>;
  adapter: MapperAdapter;
  activeSourceId: string;
  sourceSampleOverrides: Record<string, unknown>;
  setSourceSample: (sourceId: string, data: unknown) => void;
  clearIgnoredRepairIssues: () => void;
  toast: string | null;
  setToast: (toast: string | null) => void;
}

export function useDataMapperLifecycleEffects({
  repairTick,
  repairedMappingsRef,
  setMappings,
  onChange,
  mappings,
  autoMapScoresRef,
  patternMappingIdsRef,
  adapter,
  activeSourceId,
  sourceSampleOverrides,
  setSourceSample,
  clearIgnoredRepairIssues,
  toast,
  setToast,
}: UseDataMapperLifecycleEffectsParams): { skipNextOnChangeRef: MutableRefObject<boolean> } {
  const prevRepairTickRef = useRef(repairTick ?? 0);
  const skipNextOnChangeRef = useRef(false);

  useEffect(() => {
    const tick = repairTick ?? 0;
    if (tick !== prevRepairTickRef.current) {
      prevRepairTickRef.current = tick;
      if (repairedMappingsRef?.current) {
        const repaired = repairedMappingsRef.current;
        skipNextOnChangeRef.current = true;
        setMappings(repaired);
        onChange?.(repaired);
      }
      return;
    }
    if (skipNextOnChangeRef.current) {
      skipNextOnChangeRef.current = false;
      return;
    }
    onChange?.(mappings);
  }, [repairTick, repairedMappingsRef, setMappings, mappings, onChange]);

  useEffect(() => {
    const currentIds = new Set(mappings.map((m) => m.id));
    for (const id of autoMapScoresRef.current.keys()) {
      if (!currentIds.has(id)) autoMapScoresRef.current.delete(id);
    }
    for (const id of patternMappingIdsRef.current) {
      if (!currentIds.has(id)) patternMappingIdsRef.current.delete(id);
    }
  }, [mappings, autoMapScoresRef, patternMappingIdsRef]);

  const sourceAutoFetchRef = useRef(false);
  useEffect(() => {
    if (sourceAutoFetchRef.current) return;
    if (adapter.contextId !== 'validation') return;
    if (!adapter.fetchSampleData) return;
    const srcData = sourceSampleOverrides[activeSourceId] ?? adapter.sources[0]?.sampleData;
    if (srcData != null) return;
    if (mappings.length === 0) return;
    sourceAutoFetchRef.current = true;
    void (async () => {
      try {
        const data = await adapter.fetchSampleData!();
        if (data != null) setSourceSample(activeSourceId, data);
      } catch { /* best-effort */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    clearIgnoredRepairIssues();
  }, [mappings, clearIgnoredRepairIssues]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast, setToast]);

  return { skipNextOnChangeRef };
}
