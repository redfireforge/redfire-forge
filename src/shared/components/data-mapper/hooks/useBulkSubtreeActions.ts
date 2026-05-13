import { useCallback } from 'react';
import type { JsonTreeNode } from '../../../utils/jsonTreeModel';
import type { Mapping } from '../types';
import { isMapperPathWithin } from '../utils/pathNormalization';
import {
  findNodeByPath,
  collectLeafPathsFromNode,
  getArrayParentPath,
  buildRelativePairs,
  applyDropPairs,
  buildDropSummary,
  type PathPair,
} from '../utils/subtreeMapping';

interface PrepareSubtreeDropPlanResult {
  pairs: PathPair[];
  usedArraySiblingExpansion: boolean;
  canExpandAcrossSiblings: boolean;
}

export function prepareSubtreeDropPlanPure(
  sourceTree: JsonTreeNode | null,
  targetTree: JsonTreeNode | null,
  sourcePath: string,
  targetPath: string,
  options?: { expandArraySiblings?: boolean },
): PrepareSubtreeDropPlanResult {
  const sourceNode = sourceTree ? findNodeByPath(sourceTree, sourcePath) : null;
  const targetNode = targetTree ? findNodeByPath(targetTree, targetPath) : null;
  if (!sourceNode || !targetNode) {
    return { pairs: [], usedArraySiblingExpansion: false, canExpandAcrossSiblings: false };
  }

  let sourceBaseNode = sourceNode;
  let targetBaseNode = targetNode;
  let sourceBasePath = sourcePath;
  let targetBasePath = targetPath;
  let canExpandAcrossSiblings = false;
  let usedArraySiblingExpansion = false;

  const sourceArrayParentPath = getArrayParentPath(sourcePath);
  const targetArrayParentPath = getArrayParentPath(targetPath);
  if (sourceArrayParentPath && targetArrayParentPath && sourceTree && targetTree) {
    const sourceArrayNode = findNodeByPath(sourceTree, sourceArrayParentPath);
    const targetArrayNode = findNodeByPath(targetTree, targetArrayParentPath);
    canExpandAcrossSiblings = !!(
      sourceArrayNode?.children?.length
      && targetArrayNode?.children?.length
    );
    if (options?.expandArraySiblings && canExpandAcrossSiblings) {
      sourceBaseNode = sourceArrayNode!;
      targetBaseNode = targetArrayNode!;
      sourceBasePath = sourceArrayParentPath;
      targetBasePath = targetArrayParentPath;
      usedArraySiblingExpansion = true;
    }
  }

  const pairs = buildRelativePairs(
    collectLeafPathsFromNode(sourceBaseNode),
    collectLeafPathsFromNode(targetBaseNode),
    sourceBasePath,
    targetBasePath,
  );

  return { pairs, usedArraySiblingExpansion, canExpandAcrossSiblings };
}

interface UseBulkSubtreeActionsParams {
  bulkSourcePath: string | null;
  bulkSourceId: string | null;
  bulkTargetPath: string | null;
  sourceTree: JsonTreeNode | null;
  targetTree: JsonTreeNode | null;
  mappings: Mapping[];
  suggestDropExpression: (sourcePath: string, sourceId: string, targetPath: string) => string | undefined;
  setMappings: (m: Mapping[]) => void;
  setToast: (msg: string | null) => void;
}

export function useBulkSubtreeActions({
  bulkSourcePath,
  bulkSourceId,
  bulkTargetPath,
  sourceTree,
  targetTree,
  mappings,
  suggestDropExpression,
  setMappings,
  setToast,
}: UseBulkSubtreeActionsParams) {
  const prepareSubtreeDropPlan = useCallback(
    (
      sourcePath: string,
      targetPath: string,
      options?: { expandArraySiblings?: boolean },
    ) => prepareSubtreeDropPlanPure(sourceTree, targetTree, sourcePath, targetPath, options),
    [sourceTree, targetTree],
  );

  const handleMapSubtree = useCallback(() => {
    if (!bulkSourcePath || !bulkTargetPath || !bulkSourceId) {
      setToast('Select source and target nodes first');
      return;
    }
    const { pairs } = prepareSubtreeDropPlan(bulkSourcePath, bulkTargetPath);
    if (pairs.length === 0) {
      setToast('No matching child fields found for selected subtree');
      return;
    }
    const { nextMappings, insertedCount, updatedCount, unchangedCount } = applyDropPairs(
      mappings, pairs, bulkSourceId, suggestDropExpression,
    );
    const changedCount = insertedCount + updatedCount;
    if (changedCount > 0) {
      setMappings(nextMappings);
      setToast(buildDropSummary(changedCount, insertedCount, updatedCount));
      return;
    }
    if (unchangedCount > 0) {
      setToast('No changes - matching targets already mapped');
    }
  }, [bulkSourcePath, bulkTargetPath, bulkSourceId, prepareSubtreeDropPlan, mappings, suggestDropExpression, setMappings, setToast]);

  const handleMapSiblingSubtrees = useCallback(() => {
    if (!bulkSourcePath || !bulkTargetPath || !bulkSourceId) {
      setToast('Select source and target nodes first');
      return;
    }
    const plan = prepareSubtreeDropPlan(bulkSourcePath, bulkTargetPath, { expandArraySiblings: true });
    if (!plan.canExpandAcrossSiblings) {
      setToast('Select matching array index nodes to map siblings');
      return;
    }
    if (plan.pairs.length === 0) {
      setToast('No matching sibling fields found');
      return;
    }
    const { nextMappings, insertedCount, updatedCount, unchangedCount } = applyDropPairs(
      mappings, plan.pairs, bulkSourceId, suggestDropExpression,
    );
    const changedCount = insertedCount + updatedCount;
    if (changedCount > 0) {
      setMappings(nextMappings);
      setToast(
        buildDropSummary(changedCount, insertedCount, updatedCount, {
          scopeSuffix: 'across array siblings',
        }),
      );
      return;
    }
    if (unchangedCount > 0) {
      setToast('No changes - matching targets already mapped');
    }
  }, [bulkSourcePath, bulkTargetPath, bulkSourceId, prepareSubtreeDropPlan, mappings, suggestDropExpression, setMappings, setToast]);

  const handleClearTargetSubtree = useCallback(() => {
    if (!bulkTargetPath) {
      setToast('Select a target node to clear');
      return;
    }
    const nextMappings = mappings.filter((m) => !isMapperPathWithin(m.targetPath, bulkTargetPath));
    const clearedCount = mappings.length - nextMappings.length;
    if (clearedCount === 0) {
      setToast('No mappings found in selected target subtree');
      return;
    }
    setMappings(nextMappings);
    setToast(`Cleared ${clearedCount} mapping${clearedCount !== 1 ? 's' : ''} in target subtree`);
  }, [bulkTargetPath, mappings, setMappings, setToast]);

  const handleReplaceTargetSubtree = useCallback(() => {
    if (!bulkSourcePath || !bulkTargetPath || !bulkSourceId) {
      setToast('Select source and target nodes first');
      return;
    }
    const { pairs } = prepareSubtreeDropPlan(bulkSourcePath, bulkTargetPath);
    if (pairs.length === 0) {
      setToast('No matching child fields found for selected subtree');
      return;
    }
    const remainingMappings = mappings.filter((m) => !isMapperPathWithin(m.targetPath, bulkTargetPath));
    const clearedCount = mappings.length - remainingMappings.length;
    const { nextMappings, insertedCount, updatedCount } = applyDropPairs(
      remainingMappings, pairs, bulkSourceId, suggestDropExpression,
    );
    const changedCount = insertedCount + updatedCount;
    if (changedCount === 0 && clearedCount === 0) {
      setToast('No changes - selected subtree already matches');
      return;
    }
    setMappings(nextMappings);
    setToast(
      `Replaced subtree with ${changedCount} mapping${changedCount !== 1 ? 's' : ''} (${clearedCount} cleared)`,
    );
  }, [bulkSourcePath, bulkTargetPath, bulkSourceId, prepareSubtreeDropPlan, mappings, suggestDropExpression, setMappings, setToast]);

  return {
    prepareSubtreeDropPlan,
    handleMapSubtree,
    handleMapSiblingSubtrees,
    handleClearTargetSubtree,
    handleReplaceTargetSubtree,
  };
}
