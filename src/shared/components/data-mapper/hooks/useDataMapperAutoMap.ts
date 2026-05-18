import { useCallback, useMemo, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { MapperAdapter, Mapping } from '../types';
import type { AutoMapCandidate } from '../utils/autoMapAlgorithm';
import { computeAutoMapCandidates } from '../utils/autoMapAlgorithm';
import { buildJsonTree, getAllLeafPaths } from '../../../utils/jsonTreeModel';
import { savePattern, loadPattern, patternToSuggestions } from '../utils/mappingPatterns';
import type { PatternEntry } from '../utils/mappingPatterns';
import { buildTargetTree } from '../utils/mapperTreeBuilders';
import type { MapperTarget } from '../types';
import type { MapperGallerySample } from '../utils/gallerySamples';
import { applyProfileDelta } from '../utils/mappingProfiles';
import type { FieldOperator } from '../../../types';

export interface DataMapperAutoMapDeps {
  adapter: MapperAdapter;
  mappings: Mapping[];
  activeSourceId: string;
  setMappings: (mappings: Mapping[]) => void;
  setSelectedIds: (ids: Set<string>) => void;
  setSelectedSourcePaths: (paths: Set<string>) => void;
  setSourceSample: (sourceId: string, data: unknown) => void;
  setToast: (msg: string) => void;
  getEffectiveSourceData: (sourceId: string) => unknown;
  effectiveTarget: Pick<MapperTarget, 'sampleData' | 'fields'>;
  confidenceThreshold: number;
  autoMapDefaultOperator?: FieldOperator;
}

export function useDataMapperAutoMap(deps: DataMapperAutoMapDeps) {
  const {
    adapter,
    mappings,
    activeSourceId,
    setMappings,
    setSelectedIds,
    setSelectedSourcePaths,
    setSourceSample,
    setToast,
    getEffectiveSourceData,
    effectiveTarget,
    confidenceThreshold,
    autoMapDefaultOperator,
  } = deps;

  const autoMapScoresRef = useRef<Map<string, number>>(new Map());
  const patternMappingIdsRef = useRef<Set<string>>(new Set());

  const buildTargetTreeForAutoMap = useCallback(
    () => buildTargetTree(effectiveTarget),
    [effectiveTarget],
  );

  const autoMapCandidates = useMemo<AutoMapCandidate[]>(() => {
    const sourceData = getEffectiveSourceData(activeSourceId);
    if (sourceData == null) return [];
    try {
      const parsedSource = typeof sourceData === 'string' ? JSON.parse(sourceData) : sourceData;
      const srcTree = buildJsonTree(parsedSource, '', '');
      const { tree: tgtTree, targetData } = buildTargetTreeForAutoMap();
      if (!tgtTree) return [];
      return computeAutoMapCandidates(srcTree, tgtTree, mappings, {
        sourceData: parsedSource,
        targetData,
      });
    } catch {
      return [];
    }
  }, [getEffectiveSourceData, activeSourceId, mappings, buildTargetTreeForAutoMap]);

  const autoMapCandidateCount = useMemo(
    () => autoMapCandidates.filter((c) => c.score >= confidenceThreshold).length,
    [autoMapCandidates, confidenceThreshold],
  );

  const handleLoadGallerySample = useCallback((sample: MapperGallerySample) => {
    const adapterSourceIds = new Set(adapter.sources.map((s) => s.id));
    for (const sampleSrc of sample.sources) {
      if (sampleSrc.sampleData == null) continue;
      const targetId = adapterSourceIds.has(sampleSrc.id)
        ? sampleSrc.id
        : adapter.sources[0]?.id ?? activeSourceId;
      setSourceSample(targetId, sampleSrc.sampleData);
    }
    setMappings(sample.mappings);
    setSelectedIds(new Set());
    setSelectedSourcePaths(new Set());
    setToast(`Loaded sample: ${sample.name}`);
  }, [adapter.sources, activeSourceId, setSourceSample, setMappings, setSelectedIds, setSelectedSourcePaths, setToast]);

  const handleApplyProfileDelta = useCallback((profileMappings: Mapping[]) => {
    const result = applyProfileDelta(mappings, profileMappings, uuidv4);
    const changedCount = result.insertedCount + result.updatedCount;
    if (changedCount === 0) {
      setToast('Profile delta already up to date');
      return;
    }
    setMappings(result.mappings);
    setSelectedIds(new Set());
    setSelectedSourcePaths(new Set());
    setToast(
      `Applied profile delta (${result.insertedCount} new, ${result.updatedCount} updated, ${result.unchangedCount} unchanged)`,
    );
  }, [mappings, setMappings, setSelectedIds, setSelectedSourcePaths, setToast]);

  const handleAutoMap = useCallback(() => {
    const filtered = autoMapCandidates.filter((c) => c.score >= confidenceThreshold);
    const allNew: Mapping[] = [];

    try {
      const sourceData = getEffectiveSourceData(activeSourceId);
      if (sourceData != null && adapter.contextId) {
        const parsedSrc = typeof sourceData === 'string' ? JSON.parse(sourceData) : sourceData;
        const srcTree = buildJsonTree(parsedSrc, '', '');
        const { tree: tgtTree } = buildTargetTreeForAutoMap();
        if (tgtTree) {
          const srcPaths = getAllLeafPaths(srcTree);
          const tgtPaths = getAllLeafPaths(tgtTree);
          const pattern = loadPattern(adapter.contextId, srcPaths, tgtPaths);
          if (pattern) {
            const currentSrcPaths = new Set(srcPaths);
            const currentTgtPaths = new Set(tgtPaths);
            const combined = [...mappings, ...allNew];
            const suggestions: PatternEntry[] = patternToSuggestions(pattern, currentSrcPaths, currentTgtPaths, combined);
            const mappedTargets = new Set(combined.map((m) => m.targetPath));
            const mappedSources = new Set(combined.map((m) => m.sourcePath));
            const filteredTargets = new Set(filtered.map((c) => c.targetPath));
            for (const s of suggestions) {
              if (mappedTargets.has(s.targetPath) || filteredTargets.has(s.targetPath)) continue;
              if (mappedSources.has(s.sourcePath)) continue;
              const m: Mapping = {
                id: uuidv4(),
                sourcePath: s.sourcePath,
                sourceId: activeSourceId,
                targetPath: s.targetPath,
                isPending: true,
                ...(s.expression ? { expression: s.expression } : {}),
              };
              allNew.push(m);
              patternMappingIdsRef.current.add(m.id);
              autoMapScoresRef.current.set(m.id, 95);
              mappedTargets.add(s.targetPath);
              mappedSources.add(s.sourcePath);
            }
          }
        }
      }
    } catch { /* ignore pattern load errors */ }

    const patternTargets = new Set(allNew.map((m) => m.targetPath));
    for (let i = 0; i < filtered.length; i++) {
      if (patternTargets.has(filtered[i].targetPath)) continue;
      const m: Mapping = {
        id: uuidv4(),
        sourcePath: filtered[i].sourcePath,
        sourceId: activeSourceId,
        targetPath: filtered[i].targetPath,
        isAutoMapped: true,
        isPending: true,
        ...(autoMapDefaultOperator ? { operator: autoMapDefaultOperator } : {}),
      };
      allNew.push(m);
      autoMapScoresRef.current.set(m.id, filtered[i].score);
    }

    if (allNew.length === 0) return;
    setMappings([...mappings, ...allNew]);
    const patternCount = [...patternMappingIdsRef.current].filter((id) => allNew.some((m) => m.id === id)).length;
    const autoCount = allNew.length - patternCount;
    const parts: string[] = [];
    if (autoCount > 0) parts.push(`${autoCount} auto-mapped`);
    if (patternCount > 0) parts.push(`${patternCount} from patterns`);
    setToast(parts.join(', '));
  }, [autoMapCandidates, confidenceThreshold, activeSourceId, mappings, setMappings, getEffectiveSourceData, adapter.contextId, buildTargetTreeForAutoMap, setToast, autoMapDefaultOperator]);

  const handleSavePattern = useCallback(() => {
    if (!adapter.contextId) return;
    const sourceData = getEffectiveSourceData(activeSourceId);
    if (sourceData == null) return;
    try {
      const parsedSrc = typeof sourceData === 'string' ? JSON.parse(sourceData) : sourceData;
      const srcTree = buildJsonTree(parsedSrc, '', '');
      const { tree: tgtTree } = buildTargetTreeForAutoMap();
      if (!tgtTree) return;
      const srcPaths = getAllLeafPaths(srcTree);
      const tgtPaths = getAllLeafPaths(tgtTree);
      savePattern(adapter.contextId, srcPaths, tgtPaths, mappings);
    } catch { /* ignore */ }
  }, [adapter.contextId, activeSourceId, mappings, getEffectiveSourceData, buildTargetTreeForAutoMap]);

  return {
    autoMapCandidates,
    autoMapCandidateCount,
    autoMapScoresRef,
    patternMappingIdsRef,
    handleLoadGallerySample,
    handleApplyProfileDelta,
    handleAutoMap,
    handleSavePattern,
    buildTargetTreeForAutoMap,
  };
}
