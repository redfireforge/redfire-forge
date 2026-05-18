import { useCallback, useMemo, useState } from 'react';
import type { FieldOperator, Mapping } from '../types';
import type { MapperRepairIssue } from '../ValidationRepairPanel';
import type { MappingDiagnosticsResult } from './useMappingDiagnostics';
import { normalizeMapperPath, isSameMapperPath } from '../utils/pathNormalization';

interface UseMapperRepairActionsParams {
  diagnostics: MappingDiagnosticsResult;
  mappings: Mapping[];
  activeSourceId: string;
  bulkSourcePath: string | null;
  bulkSourceId: string | null;
  bulkTargetPath: string | null;
  showMappingLines: boolean;
  nodeFocusMode: boolean;
  setMappings: (m: Mapping[]) => void;
  updateMapping: (id: string, changes: Partial<Omit<Mapping, 'id'>>) => void;
  selectMapping: (id: string | null) => void;
  setSelectedIds: (ids: Set<string>) => void;
  setFocusRegion: (region: 'source' | 'target') => void;
  setBulkSourceId: (id: string) => void;
  setBulkSourcePath: (path: string) => void;
  setBulkTargetPath: (path: string) => void;
  setLineFocusNode: React.Dispatch<React.SetStateAction<{ region: 'source' | 'target'; path: string } | null>>;
  setToast: (msg: string | null) => void;
}

export function useMapperRepairActions({
  diagnostics,
  mappings,
  activeSourceId,
  bulkSourcePath,
  bulkSourceId,
  bulkTargetPath,
  showMappingLines,
  nodeFocusMode,
  setMappings,
  updateMapping,
  selectMapping,
  setSelectedIds,
  setFocusRegion,
  setBulkSourceId,
  setBulkSourcePath,
  setBulkTargetPath,
  setLineFocusNode,
  setToast,
}: UseMapperRepairActionsParams) {
  const [ignoredRepairIssueIds, setIgnoredRepairIssueIds] = useState<Set<string>>(new Set());

  const visibleRepairIssues = useMemo(
    () => diagnostics.issues.filter((issue) => !ignoredRepairIssueIds.has(issue.id)),
    [diagnostics.issues, ignoredRepairIssueIds],
  );

  const handleFixRepairIssue = useCallback((issue: MapperRepairIssue) => {
    if (issue.suggestedOperator) {
      updateMapping(issue.mappingId, { operator: issue.suggestedOperator as FieldOperator, operatorValue: undefined });
      setToast(`Changed operator to "${issue.suggestedOperator}"`);
      return;
    }
    if (!issue.suggestedFixExpression) {
      setToast('No automatic fix available for this issue');
      return;
    }
    updateMapping(issue.mappingId, { expression: issue.suggestedFixExpression });
    setToast('Applied suggested fix');
  }, [updateMapping, setToast]);

  const handleReplaceRepairIssue = useCallback((issue: MapperRepairIssue) => {
    const mapping = mappings.find((item) => item.id === issue.mappingId);
    if (!mapping) {
      setToast('Issue mapping is no longer available');
      return;
    }

    if (issue.kind === 'duplicate-target') {
      const normalizedTargetPath = normalizeMapperPath(mapping.targetPath);
      const nextMappings = mappings.filter(
        (item) => normalizeMapperPath(item.targetPath) !== normalizedTargetPath || item.id === mapping.id,
      );
      const removed = mappings.length - nextMappings.length;
      if (removed <= 0) {
        setToast('No duplicate mappings found to replace');
        return;
      }
      setMappings(nextMappings);
      setToast(`Replaced duplicate target mapping (${removed} removed)`);
      return;
    }

    const mappingSourceId = mapping.sourceId || activeSourceId;
    const sourceSelected = !!bulkSourcePath
      && !!bulkSourceId
      && (
        bulkSourceId !== mappingSourceId
        || !isSameMapperPath(bulkSourcePath, mapping.sourcePath)
      );
    const targetSelected = !!bulkTargetPath && !isSameMapperPath(bulkTargetPath, mapping.targetPath);

    if (!sourceSelected && !targetSelected) {
      setToast('Select source/target nodes first, then use Replace');
      return;
    }

    const changes: Partial<Omit<Mapping, 'id'>> = {};
    if (sourceSelected) {
      changes.sourcePath = bulkSourcePath!;
      changes.sourceId = bulkSourceId!;
      if (issue.kind === 'type-mismatch') {
        changes.expression = undefined;
      }
    }
    if (targetSelected) {
      changes.targetPath = bulkTargetPath!;
    }

    updateMapping(mapping.id, changes);
    setToast('Replaced mapping from current selection');
  }, [
    mappings,
    activeSourceId,
    bulkSourcePath,
    bulkSourceId,
    bulkTargetPath,
    setMappings,
    updateMapping,
    setToast,
  ]);

  const handleIgnoreRepairIssue = useCallback((issue: MapperRepairIssue) => {
    setIgnoredRepairIssueIds((prev) => {
      const next = new Set(prev);
      next.add(issue.id);
      return next;
    });
  }, []);

  const handleOpenRepairIssue = useCallback((issue: MapperRepairIssue) => {
    selectMapping(issue.mappingId);
    setSelectedIds(new Set([issue.mappingId]));
    setFocusRegion('target');
    setBulkTargetPath(issue.targetPath);

    const issueSourceId = issue.sourceId || activeSourceId;
    if (issueSourceId === activeSourceId) {
      setBulkSourceId(issueSourceId);
      setBulkSourcePath(issue.sourcePath);
    }

    if (!showMappingLines && nodeFocusMode) {
      setLineFocusNode({ region: 'target', path: issue.targetPath });
    }
    setToast(`Focused ${normalizeMapperPath(issue.targetPath)}`);
  }, [selectMapping, setSelectedIds, setFocusRegion, setBulkTargetPath, setBulkSourceId, setBulkSourcePath, activeSourceId, showMappingLines, nodeFocusMode, setLineFocusNode, setToast]);

  const clearIgnoredRepairIssues = useCallback(() => {
    setIgnoredRepairIssueIds(new Set());
  }, []);

  return {
    ignoredRepairIssueIds,
    visibleRepairIssues,
    handleFixRepairIssue,
    handleReplaceRepairIssue,
    handleIgnoreRepairIssue,
    handleOpenRepairIssue,
    clearIgnoredRepairIssues,
  };
}
