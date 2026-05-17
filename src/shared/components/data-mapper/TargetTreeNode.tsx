import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { TargetTreeNodeProps, FieldOperator } from './types';
import type { Assertion } from '../../types';
import type { OperatorMeta } from './utils/operatorRegistry';
import { normalizeMapperPath } from './utils/pathNormalization';
import { OPERATOR_REGISTRY } from './utils/operatorRegistry';
import {
  TYPE_LABELS,
  matchesNodeVisibility,
  formatNodeDisplayKey,
} from './utils/targetTreeHelpers';
import InlineAssertionRow from './InlineAssertionRow';
import TargetNodeOperatorPicker from './TargetNodeOperatorPicker';
import TargetNodeContextMenu from './TargetNodeContextMenu';
import OperatorValueEditor from './OperatorValueEditor';
import { useTargetNodeDnD } from './hooks/useTargetNodeDnD';
import { useOperatorEditing } from './hooks/useOperatorEditing';
const PARENT_NODE_ALLOWED_OPS = new Set([
  'is_empty', 'is_not_empty', 'is_type', 'is_null', 'is_not_null',
]);

export default function TargetTreeNode({
  node,
  depth,
  search,
  mappingFilter = 'all',
  verifyFilter = null,
  mappedTargetPaths,
  onNodeSelect,
  selectedNodePath,
  mappings,
  onDrop,
  expandedPaths,
  onToggle,
  selectedMappingId,
  onSelectMapping,
  onEditExpression,
  typeMismatches,
  onQuickFix,
  onRemoveMapping,
  focusedPath,
  traceOverlay,
  fieldOrigins,
  onRemoveCustomField,
  onUpdateCustomField,
  onReorderField,
  onTargetFieldDragStart,
  onTargetFieldDragEnd,
  getDraggedSource,
  getDraggedTargetFieldPath,
  unorderedDefault,
  onToggleUnorderedArray,
  capabilities,
  onUpdateMappingOperator,
  onToggleMappingNegate,
  verifyStatus: verifyStatusProp,
  verifyActual: verifyActualProp,
  verifyExpected: verifyExpectedProp,
  nodeStatusMap,
  fieldVerifyResults,
  onAddArrayAssertion,
  onUpdateArrayAssertion,
  onRemoveArrayAssertion,
  arrayAssertions,
  assertionVerifyMap,
  highlightedPaths,
  onRemapDrop,
  onRemapDragStart,
  onRemapDragEnd,
  getDraggedRemapId,
}: TargetTreeNodeProps) {
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const operatorPillRef = useRef<HTMLButtonElement>(null);
  const hasChildren = (node.children?.length ?? 0) > 0;
  const isExpanded = expandedPaths.has(node.path || '__root__');
  const isLeaf = !hasChildren;
  const origin = fieldOrigins?.get(node.path);
  const isCustomOrFetched = origin === 'custom' || origin === 'fetched';

  // Derive verify status from nodeStatusMap if not directly set
  const verifyStatus = verifyStatusProp ?? nodeStatusMap?.get(node.path) ?? nodeStatusMap?.get(`$.${node.path}`);
  const fieldResult = fieldVerifyResults?.get(node.path) ?? fieldVerifyResults?.get(`$.${node.path}`);
  const verifyActual = verifyActualProp ?? fieldResult?.actual;
  const verifyExpected = verifyExpectedProp ?? fieldResult?.expected;
  const verifyMatchContext = fieldResult?.matchContext;
  const normalizedNodePath = useMemo(() => normalizeMapperPath(node.path), [node.path]);

  const rawMapping = useMemo(
    () => mappings.find((m) => normalizeMapperPath(m.targetPath) === normalizedNodePath),
    [mappings, normalizedNodePath],
  );

  const mapping = useMemo(() => {
    if (!rawMapping) return undefined;
    if ((node.type === 'array' || node.type === 'object') && node.children && node.children.length > 0) {
      const op = rawMapping.operator as string | undefined;
      if (!op || !PARENT_NODE_ALLOWED_OPS.has(op)) return undefined;
    }
    return rawMapping;
  }, [rawMapping, node.type, node.children]);

  const isRenamableField = !!onUpdateCustomField && (origin === 'custom' || (isLeaf && !!mapping));

  const mismatch = useMemo(
    () => mapping && typeMismatches
      ? typeMismatches.find((m) => m.mappingId === mapping.id) : undefined,
    [mapping, typeMismatches],
  );

  const isVisible = useMemo(
    () => matchesNodeVisibility(node, search, mappingFilter, mappedTargetPaths),
    [node, search, mappingFilter, mappedTargetPaths],
  );

  const {
    dragOver, canRemapDrag,
    handleNodeDragStart, handleNodeDragEnd,
    handleDragOver, handleDragEnter, handleDragLeave, handleDrop,
  } = useTargetNodeDnD({
    nodePath: node.path,
    isLeaf,
    mappingId: mapping?.id,
    onDrop,
    onReorderField,
    onRemapDrop,
    onTargetFieldDragStart,
    onTargetFieldDragEnd,
    onRemapDragStart,
    onRemapDragEnd,
    getDraggedTargetFieldPath,
    getDraggedSource,
    getDraggedRemapId,
  });

  useEffect(() => {
    if (renaming) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [renaming]);

  const handleStartRename = useCallback(() => {
    if (!isRenamableField) return;
    setRenameValue(node.path);
    setRenaming(true);
  }, [isRenamableField, node.path]);

  const handleRenameSubmit = useCallback(() => {
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === node.path) {
      setRenaming(false);
      return;
    }
    onUpdateCustomField?.(node.path, {
      path: trimmed,
      label: trimmed.includes('.') ? trimmed.split('.').pop()! : trimmed,
      type: node.type,
      origin: origin ?? 'custom',
    });
    setRenaming(false);
  }, [renameValue, node.path, node.type, origin, onUpdateCustomField]);

  const handleRenameKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleRenameSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setRenaming(false);
    }
  }, [handleRenameSubmit]);

  const handleDoubleClick = useCallback(() => {
    if (mapping && onEditExpression) {
      onEditExpression(mapping.id);
    } else if (isRenamableField && !mapping) {
      handleStartRename();
    }
  }, [mapping, onEditExpression, isRenamableField, handleStartRename]);

  const {
    currentOp, currentOpMeta, showOperators, isRangeOperator,
    showOperatorPicker, operatorSearch, editingOperatorValue, localOperatorValue,
    pickerPos, rangeSecondRef, typeSelectRef, operatorValueRef, pickerRef,
    setPickerPos, setOperatorSearch, setShowOperatorPicker, setLocalOperatorValue, setEditingOperatorValue,
    handleOperatorSelect, toggleOperatorPicker, handleOperatorValueCommit,
    handleRangeCommit, handleOperatorValueKeyDown, startEditOperatorValue, handleTypeSelectChange,
  } = useOperatorEditing({ mapping, capabilities, onUpdateMappingOperator, operatorPillRef });

  useEffect(() => {
    if (!showContextMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setShowContextMenu(false);
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showContextMenu]);

  const canRename = isRenamableField;
  const hasContextMenu = !!((capabilities?.operators && mapping) || canRename || (node.type === 'array' && capabilities?.arrayAssertions));

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!hasContextMenu) return;
    setContextMenuPos({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  }, [hasContextMenu]);

  const filteredOperators = useMemo(() => {
    const lower = operatorSearch.toLowerCase();
    if (!lower) return Object.entries(OPERATOR_REGISTRY) as [FieldOperator, OperatorMeta][];
    return (Object.entries(OPERATOR_REGISTRY) as [FieldOperator, OperatorMeta][]).filter(
      ([key, meta]) => meta.label.includes(lower) || key.includes(lower) || meta.category.includes(lower),
    );
  }, [operatorSearch]);

  const nodeAssertions = useMemo(() => {
    if (node.type !== 'array' || !arrayAssertions || arrayAssertions.length === 0) return [];
    const nodePath = node.path.startsWith('$') ? node.path : `$.${node.path}`;
    const normalized = normalizeMapperPath(nodePath);
    const result: { assertion: Assertion; globalIndex: number }[] = [];
    for (let i = 0; i < arrayAssertions.length; i++) {
      const a = arrayAssertions[i];
      if (!('jsonPath' in a) || typeof a.jsonPath !== 'string') continue;
      const aPath = normalizeMapperPath(a.jsonPath);
      if (aPath === normalized || aPath === normalizeMapperPath(node.path)) {
        result.push({ assertion: a, globalIndex: i });
      }
    }
    return result;
  }, [node.type, node.path, arrayAssertions]);

  if (!isVisible) return null;

  const isMapped = !!mapping || !!rawMapping || (mappedTargetPaths?.has(normalizedNodePath) ?? false);
  const isSelected = ((mapping?.id ?? rawMapping?.id) === selectedMappingId) && !!selectedMappingId;
  const isBulkSelected = selectedNodePath === node.path;
  const isFocused = focusedPath === node.path;
  const isHoverHighlighted = isLeaf && (highlightedPaths?.has(normalizedNodePath) ?? false);
  const traceVal = traceOverlay?.get(node.path);
  const displayKey = formatNodeDisplayKey(node);
  const nodePathTitle = normalizedNodePath ? `Path: ${normalizedNodePath}` : '(root)';

  const childPassthroughProps: Omit<TargetTreeNodeProps, 'node' | 'depth'> = {
    search, mappingFilter, verifyFilter, mappedTargetPaths, onNodeSelect, selectedNodePath,
    mappings, onDrop, expandedPaths, onToggle, selectedMappingId, onSelectMapping,
    onEditExpression, typeMismatches, onQuickFix, onRemoveMapping, focusedPath,
    traceOverlay, fieldOrigins, onRemoveCustomField, onUpdateCustomField,
    onReorderField, onTargetFieldDragStart, onTargetFieldDragEnd, getDraggedSource,
    getDraggedTargetFieldPath, unorderedDefault, onToggleUnorderedArray, capabilities,
    onUpdateMappingOperator, onToggleMappingNegate, nodeStatusMap, fieldVerifyResults,
    onAddArrayAssertion, onUpdateArrayAssertion, onRemoveArrayAssertion,
    arrayAssertions, assertionVerifyMap, highlightedPaths, onRemapDrop, onRemapDragStart, onRemapDragEnd,
    getDraggedRemapId,
  };

  return (
    <div className="dm-tree-node-group">
      <div
        className={`dm-tree-node dm-tree-node--target ${isLeaf ? 'dm-tree-node--leaf' : ''} ${isLeaf && onReorderField ? 'dm-tree-node--reorderable' : ''} ${canRemapDrag ? 'dm-tree-node--remappable' : ''} ${isMapped ? 'dm-tree-node--mapped' : ''} ${dragOver ? 'dm-tree-node--drag-over' : ''} ${isSelected ? 'dm-tree-node--selected' : ''} ${isBulkSelected ? 'dm-tree-node--bulk-selected' : ''} ${isFocused ? 'dm-tree-node--focused' : ''} ${isCustomOrFetched ? 'dm-tree-node--custom' : ''} ${isHoverHighlighted ? 'dm-tree-node--hover-highlight' : ''}`}
        style={{ paddingLeft: depth * 16 + 4 }}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        draggable={(isLeaf && !!onReorderField) || canRemapDrag}
        onDragStart={(isLeaf && onReorderField) || canRemapDrag ? handleNodeDragStart : undefined}
        onDragEnd={(isLeaf && onReorderField) || canRemapDrag ? handleNodeDragEnd : undefined}
        onClick={() => {
          onNodeSelect?.(node.path);
          const selectableMapping = mapping ?? rawMapping;
          if (selectableMapping) onSelectMapping(isSelected ? null : selectableMapping.id);
        }}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        data-path={node.path}
      >
        {hasChildren ? (
          <button
            className="dm-tree-toggle"
            onClick={(e) => { e.stopPropagation(); onToggle(node.path || '__root__'); }}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
            aria-expanded={isExpanded}
          >
            <span className={`dm-chevron ${isExpanded ? 'dm-chevron--open' : ''}`}>▶</span>
          </button>
        ) : (
          <span className="dm-tree-toggle dm-tree-toggle--spacer" />
        )}
        <span className={`dm-type-pill dm-type-pill--${node.type}`}>{TYPE_LABELS[node.type] ?? '?'}</span>
        {renaming ? (
          <input
            ref={renameInputRef}
            className="dm-rename-input"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={handleRenameKeyDown}
            onBlur={handleRenameSubmit}
            aria-label="Rename field"
          />
        ) : (
          <span
            className={`dm-node-key${isRenamableField ? ' dm-node-key--editable' : ''}`}
            title={isRenamableField ? 'Click to rename' : nodePathTitle}
            onClick={isRenamableField ? (e) => { e.stopPropagation(); handleStartRename(); } : undefined}
          >{displayKey}</span>
        )}
        {!isMapped && !renaming && node.value != null && String(node.value) !== '' && (
          <span className="dm-default-value" title={`Default: ${String(node.value)}`}>
            = {String(node.value).length > 20 ? String(node.value).slice(0, 19) + '…' : String(node.value)}
          </span>
        )}
        {origin === 'custom' && !renaming && (
          <span className="dm-origin-badge dm-origin-badge--custom" title="Custom field">custom</span>
        )}
        {origin === 'fetched' && !renaming && (
          <span className="dm-origin-badge dm-origin-badge--fetched" title="Fetched from API">fetched</span>
        )}
        {isMapped && mapping && (
          <span
            className="dm-mapped-badge"
            onDoubleClick={(e) => { e.stopPropagation(); if (onEditExpression) onEditExpression(mapping.id); }}
          >
            {mapping.expression ? (
              <>
                <span className="dm-mapped-fx-pill">fx</span>
                {showOperators && mapping.negate && (
                  <button
                    type="button"
                    className="dm-negate-badge"
                    title="Negated — click to remove NOT"
                    onClick={(e) => { e.stopPropagation(); onToggleMappingNegate?.(mapping.id); }}
                    aria-label="Remove negation"
                  >NOT</button>
                )}
                {showOperators && (
                  <button
                    ref={operatorPillRef}
                    type="button"
                    className={`dm-operator-pill dm-operator-pill--${currentOpMeta.cssClass}${mapping.negate ? ' dm-operator-pill--negated' : ''}`}
                    title={`Operator: ${mapping.negate ? 'NOT ' : ''}${currentOpMeta.label} (click to change)`}
                    onClick={toggleOperatorPicker}
                    onDoubleClick={(e) => e.stopPropagation()}
                    aria-label={`Change operator from ${currentOpMeta.label}`}
                    aria-expanded={showOperatorPicker}
                    aria-haspopup="listbox"
                  >
                    <span className="dm-op-icon">{currentOpMeta.icon}</span> {currentOpMeta.label}
                  </button>
                )}
                {showOperators && (
                  <OperatorValueEditor
                    mapping={mapping}
                    currentOp={currentOp}
                    currentOpMeta={currentOpMeta}
                    isRangeOperator={isRangeOperator}
                    editingOperatorValue={editingOperatorValue}
                    localOperatorValue={localOperatorValue}
                    operatorValueRef={operatorValueRef}
                    rangeSecondRef={rangeSecondRef}
                    typeSelectRef={typeSelectRef}
                    setLocalOperatorValue={setLocalOperatorValue}
                    setEditingOperatorValue={setEditingOperatorValue}
                    handleTypeSelectChange={handleTypeSelectChange}
                    handleOperatorValueCommit={handleOperatorValueCommit}
                    handleOperatorValueKeyDown={handleOperatorValueKeyDown}
                    handleRangeCommit={handleRangeCommit}
                    startEditOperatorValue={startEditOperatorValue}
                  />
                )}
                <span className="dm-mapped-src-ref" title={mapping.expression}>{mapping.sourcePath}</span>
              </>
            ) : (
              <>
                <span className="dm-mapped-arrow">←</span>
                {showOperators && mapping.negate && (
                  <button
                    type="button"
                    className="dm-negate-badge"
                    title="Negated — click to remove NOT"
                    onClick={(e) => { e.stopPropagation(); onToggleMappingNegate?.(mapping.id); }}
                    aria-label="Remove negation"
                  >NOT</button>
                )}
                {showOperators && (
                  <button
                    ref={operatorPillRef}
                    type="button"
                    className={`dm-operator-pill dm-operator-pill--${currentOpMeta.cssClass}${mapping.negate ? ' dm-operator-pill--negated' : ''}`}
                    title={`Operator: ${mapping.negate ? 'NOT ' : ''}${currentOpMeta.label} (click to change)`}
                    onClick={toggleOperatorPicker}
                    onDoubleClick={(e) => e.stopPropagation()}
                    aria-label={`Change operator from ${currentOpMeta.label}`}
                    aria-expanded={showOperatorPicker}
                    aria-haspopup="listbox"
                  >
                    <span className="dm-op-icon">{currentOpMeta.icon}</span> {currentOpMeta.label}
                  </button>
                )}
                {showOperators && (
                  <OperatorValueEditor
                    mapping={mapping}
                    currentOp={currentOp}
                    currentOpMeta={currentOpMeta}
                    isRangeOperator={isRangeOperator}
                    editingOperatorValue={editingOperatorValue}
                    localOperatorValue={localOperatorValue}
                    operatorValueRef={operatorValueRef}
                    rangeSecondRef={rangeSecondRef}
                    typeSelectRef={typeSelectRef}
                    setLocalOperatorValue={setLocalOperatorValue}
                    setEditingOperatorValue={setEditingOperatorValue}
                    handleTypeSelectChange={handleTypeSelectChange}
                    handleOperatorValueCommit={handleOperatorValueCommit}
                    handleOperatorValueKeyDown={handleOperatorValueKeyDown}
                    handleRangeCommit={handleRangeCommit}
                    startEditOperatorValue={startEditOperatorValue}
                  />
                )}
                {!showOperators ? (
                  <span className="dm-mapped-src-ref" title={mapping.sourcePath}>{mapping.sourcePath}</span>
                ) : null}
                {showOperators && !currentOpMeta.needsValue && (
                  <span className="dm-mapped-src-ref" title={mapping.sourcePath}>{mapping.sourcePath}</span>
                )}
              </>
            )}
          </span>
        )}
        {verifyStatus && (
          <span
            className={`dm-verify-badge dm-verify-badge--${verifyStatus}`}
            title={verifyStatus === 'pass'
              ? 'Verification passed'
              : `Failed: expected ${verifyExpected ?? '?'}, got ${verifyActual ?? '?'}${verifyMatchContext ? `\n${verifyMatchContext}` : ''}`}
            aria-label={verifyStatus === 'pass' ? 'Passed' : 'Failed'}
          >
            {verifyStatus === 'pass' ? '✓' : '✗'}
          </span>
        )}
        {verifyStatus === 'fail' && verifyActual && (
          <span className="dm-verify-actual" title={`Actual: ${verifyActual}`}>
            Got: {verifyActual.length > 30 ? verifyActual.slice(0, 30) + '…' : verifyActual}
          </span>
        )}
        {node.type === 'array' && onToggleUnorderedArray && (() => {
          const isUnordered = unorderedDefault ?? false;
          return (
            <button
              type="button"
              className={`dm-order-badge ${isUnordered ? 'dm-order-badge--unordered' : 'dm-order-badge--ordered'}`}
              title={isUnordered ? 'Unordered: items matched by value (click for ordered)' : 'Ordered: items matched by index (click for unordered)'}
              onClick={(e) => { e.stopPropagation(); onToggleUnorderedArray(node.path); }}
            >
              {isUnordered ? '⟳ unordered' : '↕ ordered'}
            </button>
          );
        })()}
        {mismatch && (
          mismatch.suggestedFix && onQuickFix ? (
            <button
              type="button"
              className={`dm-mismatch-badge dm-mismatch--${mismatch.severity}`}
              aria-label={`${mismatch.message}. Click to apply fix.`}
              onClick={(e) => { e.stopPropagation(); onQuickFix(mismatch.mappingId, mismatch.suggestedFix!); }}
            >
              {mismatch.severity === 'warning' ? '⚠' : 'ℹ'}
            </button>
          ) : (
            <span
              className={`dm-mismatch-badge dm-mismatch--${mismatch.severity}`}
              title={mismatch.message}
              aria-label={mismatch.message}
            >
              {mismatch.severity === 'warning' ? '⚠' : 'ℹ'}
            </span>
          )
        )}
        {traceVal && (
          <span
            className={`dm-trace-value ${traceVal.isError ? 'dm-trace-value--error' : 'dm-trace-value--ok'}`}
            title={traceVal.value}
          >
            = {traceVal.value.length > 20 ? traceVal.value.slice(0, 19) + '…' : traceVal.value}
          </span>
        )}
        {isMapped && mapping && onRemoveMapping && (
          <button
            className="dm-inline-remove"
            aria-label={`Remove mapping for ${node.key}`}
            onClick={(e) => { e.stopPropagation(); onRemoveMapping(mapping.id); }}
          >
            ✕
          </button>
        )}
        {isCustomOrFetched && !isMapped && onRemoveCustomField && (
          <button
            className="dm-inline-remove dm-inline-remove--field"
            aria-label={`Remove custom field ${node.key}`}
            onClick={(e) => { e.stopPropagation(); onRemoveCustomField(node.path); }}
          >
            ✕
          </button>
        )}
        {isLeaf && !isMapped && !isCustomOrFetched && (
          <span className="dm-drop-zone-hint">Drop here</span>
        )}
        {isLeaf && !isMapped && isCustomOrFetched && !renaming && (
          <span className="dm-drop-zone-hint">Drop here</span>
        )}
        {hasChildren && !isExpanded && (
          <span className="dm-node-count">
            {node.type === 'array' && nodeAssertions.length > 0
              ? `${node.children!.length} items · ${nodeAssertions.length} assertion${nodeAssertions.length !== 1 ? 's' : ''}`
              : node.children!.length}
          </span>
        )}
        {node.type === 'array' && isExpanded && nodeAssertions.length > 0 && (
          <span className="dm-node-count dm-node-count--assertions">
            {node.children!.length} items · {nodeAssertions.length} assertion{nodeAssertions.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      {showOperatorPicker && showOperators && (
        <TargetNodeOperatorPicker
          ref={pickerRef}
          pickerPos={pickerPos}
          operatorSearch={operatorSearch}
          setOperatorSearch={setOperatorSearch}
          filteredOperators={filteredOperators}
          currentOp={currentOp}
          mapping={mapping}
          onToggleMappingNegate={onToggleMappingNegate}
          handleOperatorSelect={handleOperatorSelect}
        />
      )}
      {showContextMenu && hasContextMenu && (
        <TargetNodeContextMenu
          ref={contextMenuRef}
          position={contextMenuPos}
          node={node}
          capabilities={capabilities}
          isMapped={isMapped}
          mapping={mapping}
          isRenamable={canRename}
          onClose={() => setShowContextMenu(false)}
          onOpenOperatorPicker={() => {
            if (operatorPillRef.current) {
              const rect = operatorPillRef.current.getBoundingClientRect();
              setPickerPos({ top: rect.bottom + 4, left: rect.left, openUp: false });
            } else {
              setPickerPos({ top: contextMenuPos.y, left: contextMenuPos.x, openUp: false });
            }
            setShowOperatorPicker(true);
          }}
          onToggleMappingNegate={onToggleMappingNegate}
          onEditExpression={onEditExpression}
          onRemoveMapping={onRemoveMapping}
          onAddArrayAssertion={onAddArrayAssertion}
          onRename={canRename ? handleStartRename : undefined}
        />
      )}
      {node.type === 'array' && isExpanded && capabilities?.arrayAssertions && (
        <div className="dm-array-assertion-rows" style={{ paddingLeft: (depth + 1) * 16 + 4 }}>
          {nodeAssertions
            .filter(({ globalIndex }) => {
              if (!verifyFilter) return true;
              const vr = assertionVerifyMap?.get(globalIndex);
              if (!vr) return true;
              return verifyFilter === 'passed' ? vr.passed : !vr.passed;
            })
            .map(({ assertion, globalIndex }) => (
            <InlineAssertionRow
              key={globalIndex}
              assertion={assertion}
              globalIndex={globalIndex}
              onUpdate={onUpdateArrayAssertion}
              onRemove={onRemoveArrayAssertion}
              verifyResult={assertionVerifyMap?.get(globalIndex)}
            />
          ))}
          {onAddArrayAssertion && (
            <div
              className="dm-array-assertion-hint dm-array-assertion-hint--clickable"
              onClick={(e) => { e.stopPropagation(); onAddArrayAssertion(node.path, 'length'); }}
              title="Click to add a length assertion, or right-click the array node for more options"
            >
              <span className="dm-array-assertion-hint-icon">+</span>
              <span className="dm-array-assertion-hint-text">Add array assertion</span>
            </div>
          )}
          {!onAddArrayAssertion && nodeAssertions.length === 0 && (
            <div className="dm-array-assertion-hint">
              <span className="dm-array-assertion-hint-icon">+</span>
              <span className="dm-array-assertion-hint-text">Add array assertion (use Rules panel)</span>
            </div>
          )}
        </div>
      )}
      {hasChildren && isExpanded && (
        <div className="dm-tree-children">
          {node.children!.map((child) => (
            <TargetTreeNode
              key={child.path || child.key}
              {...childPassthroughProps}
              node={child}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
