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
  /** Scroll + highlight a tree node; return false when path is not in the DOM. */
  focusNodeByPath?: (path: string, region: 'source' | 'target') => boolean;
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
  focusNodeByPath,
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
    setBulkTargetPath(issue.targetPath);

    const issueSourceId = issue.sourceId || activeSourceId;
    if (issueSourceId === activeSourceId) {
      setBulkSourceId(issueSourceId);
      setBulkSourcePath(issue.sourcePath);
    }

    // Prefer the panel that owns the problem; fall back so Open node still
    // lands somewhere useful when only one side exists in the tree.
    const attempts: Array<{ region: 'source' | 'target'; path: string }> =
      issue.kind === 'unresolved-path'
        ? [
            { region: 'source', path: issue.sourcePath },
            { region: 'target', path: issue.targetPath },
          ]
        : [
            { region: 'target', path: issue.targetPath },
            { region: 'source', path: issue.sourcePath },
          ];

    let opened: { region: 'source' | 'target'; path: string } | null = null;
    for (const attempt of attempts) {
      if (!attempt.path) continue;
      setFocusRegion(attempt.region);
      if (focusNodeByPath?.(attempt.path, attempt.region)) {
        opened = attempt;
        break;
      }
    }

    if (!opened) {
      setFocusRegion(attempts[0]?.region ?? 'target');
    }

    if (!showMappingLines && nodeFocusMode) {
      const linePath = opened?.path ?? issue.targetPath;
      const lineRegion = opened?.region ?? 'target';
      setLineFocusNode({ region: lineRegion, path: linePath });
    }

    const label = normalizeMapperPath(opened?.path ?? (issue.targetPath || issue.sourcePath));
    if (opened) {
      setToast(`Opened ${opened.region} node: ${label}`);
      return;
    }

    if (issue.kind === 'missing-target') {
      setToast(
        `${label} is not in the target tree — use Fix or Replace to remap (Open node only selects the mapping).`,
      );
      return;
    }
    if (issue.kind === 'unresolved-path') {
      setToast(
        `${normalizeMapperPath(issue.sourcePath)} is not in the source tree — use Fix or Replace to remap.`,
      );
      return;
    }
    setToast(`Selected mapping for ${label} (tree node not found — it may be collapsed or missing).`);
  }, [selectMapping, setSelectedIds, setFocusRegion, setBulkTargetPath, setBulkSourceId, setBulkSourcePath, activeSourceId, showMappingLines, nodeFocusMode, setLineFocusNode, setToast, focusNodeByPath]);

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
