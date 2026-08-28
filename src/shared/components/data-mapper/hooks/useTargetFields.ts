import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { MapperAdapter, Mapping, MapperTarget, TargetField, FetchErrorDetail } from '../types';
import { MapperFetchError } from '../types';
import { inferType } from '../utils/typeMismatch';
import { resolveSourceValue } from '../utils/mapperParsing';

export interface UseTargetFieldsArgs<TOutput = unknown> {
  adapter: MapperAdapter<TOutput>;
  mappings: Mapping[];
  removeMappings: (ids: string[]) => void;
  updateMapping: (id: string, patch: Partial<Mapping>) => void;
}

export interface UseTargetFieldsReturn {
  effectiveTarget: MapperTarget;
  customTargetFields: TargetField[];
  fetchedTargetFields: TargetField[];
  targetFetchError: FetchErrorDetail | null;
  handleAddCustomField: (field: TargetField) => void;
  handleRemoveCustomField: (path: string) => void;
  handleUpdateCustomField: (oldPath: string, updated: TargetField) => void;
  handleFetchTargetSchema: () => Promise<void>;
  handlePasteTargetSample: (data: unknown) => void;
  handleReorderTargetField: (dragPath: string, dropPath: string) => void;
  draggedTargetFieldPathRef: React.MutableRefObject<string | null>;
  handleTargetFieldDragStart: (path: string) => void;
  handleTargetFieldDragEnd: () => void;
  getDraggedTargetFieldPath: () => string | null;
}

export function useTargetFields<TOutput = unknown>({
  adapter,
  mappings,
  removeMappings,
  updateMapping,
}: UseTargetFieldsArgs<TOutput>): UseTargetFieldsReturn {
  const [targetFieldOrder, setTargetFieldOrder] = useState<string[]>([]);
  const [customTargetFields, setCustomTargetFields] = useState<TargetField[]>([]);
  const [targetSampleOverride, setTargetSampleOverride] = useState<unknown>(undefined);
  const [fetchedTargetFields, setFetchedTargetFields] = useState<TargetField[]>([]);
  const [targetFetchError, setTargetFetchError] = useState<FetchErrorDetail | null>(null);
  const draggedTargetFieldPathRef = useRef<string | null>(null);

  const mappingTargetFields = useMemo<TargetField[]>(() => {
    const seen = new Set<string>();
    const fields: TargetField[] = [];
    for (const m of mappings) {
      const path = m.targetPath?.trim();
      if (!path || seen.has(path)) continue;
      seen.add(path);
      const sourceVal = resolveSourceValue(m, adapter.sources);
      const inferredType = sourceVal !== undefined ? inferType(sourceVal) : 'string';
      fields.push({
        path,
        label: path,
        type: inferredType,
        origin: 'adapter',
      });
    }
    return fields;
  }, [mappings, adapter.sources]);

  const effectiveTarget = useMemo(() => {
    const shouldHydrateFromMappings =
      adapter.target.sampleData == null
      && (adapter.target.fields?.length ?? 0) === 0
      && targetSampleOverride == null;

    const adapterFields = (adapter.target.fields ?? []).map((f) => ({
      ...f,
      origin: f.origin ?? 'adapter' as const,
    }));

    const fetchedWithOrigin = fetchedTargetFields.map((f) => ({
      ...f,
      origin: f.origin ?? 'fetched' as const,
    }));

    const seenPaths = new Set(adapterFields.map((f) => f.path));
    const dedupedFetched = fetchedWithOrigin.filter((f) => {
      if (seenPaths.has(f.path)) return false;
      seenPaths.add(f.path);
      return true;
    });
    const customPaths = new Set(customTargetFields.map((f) => f.path));
    const dedupedMapped = shouldHydrateFromMappings
      ? mappingTargetFields.filter((f) => {
        if (seenPaths.has(f.path) || customPaths.has(f.path)) return false;
        seenPaths.add(f.path);
        return true;
      })
      : [];
    const dedupedCustom = customTargetFields.filter((f) => {
      if (seenPaths.has(f.path)) return false;
      seenPaths.add(f.path);
      return true;
    });

    const mergedFields = [...adapterFields, ...dedupedFetched, ...dedupedMapped, ...dedupedCustom];
    const orderIndex = new Map(targetFieldOrder.map((path, idx) => [path, idx]));
    const orderedFields = targetFieldOrder.length === 0
      ? mergedFields
      : [...mergedFields].sort((a, b) => {
        const aIdx = orderIndex.get(a.path);
        const bIdx = orderIndex.get(b.path);
        if (aIdx == null && bIdx == null) return 0;
        if (aIdx == null) return 1;
        if (bIdx == null) return -1;
        return aIdx - bIdx;
      });

    const hasMergedContent = orderedFields.length > 0 || targetSampleOverride != null;

    if (!hasMergedContent && customTargetFields.length === 0 && fetchedTargetFields.length === 0 && targetSampleOverride == null) {
      return adapter.target;
    }

    return {
      ...adapter.target,
      ...(targetSampleOverride != null ? { sampleData: targetSampleOverride } : {}),
      ...(orderedFields.length > 0 ? { fields: orderedFields } : {}),
    };
  }, [adapter.target, customTargetFields, fetchedTargetFields, mappingTargetFields, targetSampleOverride, targetFieldOrder]);

  useEffect(() => {
    const currentPaths = effectiveTarget.fields?.map((f) => f.path) ?? [];
    setTargetFieldOrder((prev) => {
      if (currentPaths.length === 0) {
        return prev.length === 0 ? prev : [];
      }
      const pathSet = new Set(currentPaths);
      const kept = prev.filter((path) => pathSet.has(path));
      const seen = new Set(kept);
      const appended = currentPaths.filter((path) => !seen.has(path));
      const next = [...kept, ...appended];
      if (next.length === prev.length && next.every((path, idx) => path === prev[idx])) {
        return prev;
      }
      return next;
    });
  }, [effectiveTarget.fields]);

  const handleReorderTargetField = useCallback((dragPath: string, dropPath: string) => {
    if (!dragPath || !dropPath || dragPath === dropPath) return;
    draggedTargetFieldPathRef.current = null;
    setTargetFieldOrder((prev) => {
      const base = prev.length > 0
        ? [...prev]
        : (effectiveTarget.fields ?? []).map((f) => f.path);
      const fromIdx = base.indexOf(dragPath);
      const toIdx = base.indexOf(dropPath);
      if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return prev;
      const next = [...base];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  }, [effectiveTarget.fields]);

  const handleAddCustomField = useCallback((field: TargetField) => {
    setCustomTargetFields((prev) => {
      if (prev.some((f) => f.path === field.path)) return prev;
      return [...prev, { ...field, origin: 'custom' }];
    });
  }, []);

  const handleRemoveCustomField = useCallback((path: string) => {
    setCustomTargetFields((prev) => prev.filter((f) => f.path !== path));
    const mappingsToRemove = mappings.filter((m) => m.targetPath === path);
    if (mappingsToRemove.length > 0) {
      removeMappings(mappingsToRemove.map((m) => m.id));
    }
  }, [mappings, removeMappings]);

  const handleUpdateCustomField = useCallback((oldPath: string, updated: TargetField) => {
    setCustomTargetFields((prev) =>
      prev.map((f) => f.path === oldPath ? { ...updated, origin: 'custom' } : f),
    );
    if (oldPath !== updated.path) {
      const affectedMappings = mappings.filter((m) => m.targetPath === oldPath);
      for (const m of affectedMappings) {
        updateMapping(m.id, { targetPath: updated.path });
      }
    }
  }, [mappings, updateMapping]);

  const handleFetchTargetSchema = useCallback(async () => {
    if (!adapter.fetchTargetSchema) return;
    setTargetFetchError(null);
    try {
      const result = await adapter.fetchTargetSchema();
      if (result.sampleData != null) {
        setTargetSampleOverride(result.sampleData);
      }
      if (result.fields && result.fields.length > 0) {
        setFetchedTargetFields(result.fields.map((f) => ({
          ...f,
          origin: 'fetched' as const,
        })));
      }
    } catch (e) {
      if (e instanceof MapperFetchError) {
        setTargetFetchError(e.detail);
        throw e;
      }
      const msg = e instanceof Error ? e.message : 'Failed to fetch target schema';
      setTargetFetchError({ message: msg });
      throw new Error(msg, { cause: e });
    }
  }, [adapter]);

  const handlePasteTargetSample = useCallback((data: unknown) => {
    setTargetSampleOverride(data);
    setTargetFetchError(null);
  }, []);

  const handleTargetFieldDragStart = useCallback((path: string) => {
    draggedTargetFieldPathRef.current = path;
  }, []);

  const handleTargetFieldDragEnd = useCallback(() => {
    draggedTargetFieldPathRef.current = null;
  }, []);

  const getDraggedTargetFieldPath = useCallback(() => draggedTargetFieldPathRef.current, []);

  return {
    effectiveTarget,
    customTargetFields,
    fetchedTargetFields,
    targetFetchError,
    handleAddCustomField,
    handleRemoveCustomField,
    handleUpdateCustomField,
    handleFetchTargetSchema,
    handlePasteTargetSample,
    handleReorderTargetField,
    draggedTargetFieldPathRef,
    handleTargetFieldDragStart,
    handleTargetFieldDragEnd,
    getDraggedTargetFieldPath,
  };
}
