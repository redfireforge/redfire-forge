import { useCallback } from 'react';
import type { Mapping } from '../types';
import { normalizeMapperPath } from '../utils/pathNormalization';

interface UseSourcePathBulkMapHandlersParams {
  handleMapFilteredFields: (paths: string[], sourceId: string) => void;
  setSelectedSourcePaths: React.Dispatch<React.SetStateAction<Set<string>>>;
  mappings: Mapping[];
  removeMappings: (ids: string[]) => void;
}

export function useSourcePathBulkMapHandlers({
  handleMapFilteredFields,
  setSelectedSourcePaths,
  mappings,
  removeMappings,
}: UseSourcePathBulkMapHandlersParams) {
  const handleMapSelectedFields = useCallback(
    (paths: string[], sourceId: string) => {
      handleMapFilteredFields(paths, sourceId);
      setSelectedSourcePaths(new Set());
    },
    [handleMapFilteredFields, setSelectedSourcePaths],
  );

  const handleUnmapSelectedFields = useCallback(
    (paths: string[]) => {
      const normalizedPaths = new Set(paths.map((p) => normalizeMapperPath(p)));
      const idsToRemove = mappings
        .filter((m) => normalizedPaths.has(normalizeMapperPath(m.sourcePath)))
        .map((m) => m.id);
      if (idsToRemove.length > 0) {
        removeMappings(idsToRemove);
      }
      setSelectedSourcePaths(new Set());
    },
    [mappings, removeMappings, setSelectedSourcePaths],
  );

  return { handleMapSelectedFields, handleUnmapSelectedFields };
}
