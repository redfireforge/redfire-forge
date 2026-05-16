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
import { useTargetNodeDnD } from './hooks/useTargetNodeDnD';

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
  const [showOperatorPicker, setShowOperatorPicker] = useState(false);
  const [operatorSearch, setOperatorSearch] = useState('');
  const [editingOperatorValue, setEditingOperatorValue] = useState(false);
  const [localOperatorValue, setLocalOperatorValue] = useState('');
  const [pickerPos, setPickerPos] = useState<{ top: number; left: number; openUp: boolean }>({ top: 0, left: 0, openUp: false });
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const operatorPillRef = useRef<HTMLButtonElement>(null);
  const operatorValueRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
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

  const currentOp = mapping?.operator
    ?? (mapping?.isAutoMapped ? capabilities?.autoMapDefaultOperator : undefined)
    ?? 'equals';
  const currentOpMeta = OPERATOR_REGISTRY[currentOp] ?? OPERATOR_REGISTRY['equals'];
  const showOperators = capabilities?.operators && !!mapping && !!onUpdateMappingOperator;

  const handleOperatorSelect = useCallback((op: FieldOperator) => {
    if (!mapping || !onUpdateMappingOperator) return;
    const meta = OPERATOR_REGISTRY[op];
    if (meta.needsValue) {
      const existingValue = mapping.operatorValue ?? '';
      onUpdateMappingOperator(mapping.id, op, existingValue);
      setLocalOperatorValue(existingValue);
      if (!existingValue) {
        setEditingOperatorValue(true);
      }
    } else {
      onUpdateMappingOperator(mapping.id, op, undefined);
      setEditingOperatorValue(false);
      setLocalOperatorValue('');
    }
    setShowOperatorPicker(false);
    setOperatorSearch('');
  }, [mapping, onUpdateMappingOperator]);

  const isRangeOperator = currentOp === 'between' || currentOp === 'close_to';
  const rangeSecondRef = useRef<HTMLInputElement>(null);
  const typeSelectRef = useRef<HTMLSelectElement>(null);

  const toggleOperatorPicker = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!showOperatorPicker && operatorPillRef.current) {
      const rect = operatorPillRef.current.getBoundingClientRect();
      const dmBody = operatorPillRef.current.closest('.dm-body');
      const sourcePanel = dmBody?.querySelector('.dm-panel-wrapper');
      const sourcePanelRect = sourcePanel?.getBoundingClientRect();
      const pickerWidth = 240;
      const pickerHeight = 400;
      let left: number;
      if (sourcePanelRect) {
        const fitWidth = Math.min(pickerWidth, sourcePanelRect.width - 16);
        left = sourcePanelRect.left + 8;
        if (fitWidth < pickerWidth) {
          left = sourcePanelRect.left + 4;
        }
      } else {
        left = 8;
      }
      const spaceBelow = window.innerHeight - rect.top;
      const openUp = spaceBelow < pickerHeight && rect.top > spaceBelow;
      setPickerPos({
        top: openUp ? Math.max(8, rect.top - pickerHeight + 30) : rect.top,
        left: Math.max(8, left),
        openUp,
      });
    }
    setShowOperatorPicker(prev => !prev);
  }, [showOperatorPicker]);

  const handleOperatorValueCommit = useCallback(() => {
    if (!mapping || !onUpdateMappingOperator) return;
    onUpdateMappingOperator(mapping.id, mapping.operator, localOperatorValue);
    setEditingOperatorValue(false);
  }, [mapping, onUpdateMappingOperator, localOperatorValue]);

  const handleRangeCommit = useCallback((part1: string, part2: string) => {
    if (!mapping || !onUpdateMappingOperator) return;
    const combined = `${part1.trim()}, ${part2.trim()}`;
    onUpdateMappingOperator(mapping.id, mapping.operator, combined);
    setEditingOperatorValue(false);
  }, [mapping, onUpdateMappingOperator]);

  const handleOperatorValueKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleOperatorValueCommit(); }
    else if (e.key === 'Escape') { e.preventDefault(); setEditingOperatorValue(false); }
  }, [handleOperatorValueCommit]);

  const startEditOperatorValue = useCallback(() => {
    if (!mapping) return;
    setLocalOperatorValue(mapping.operatorValue ?? '');
    setEditingOperatorValue(true);
  }, [mapping]);

  useEffect(() => {
    if (editingOperatorValue) {
      if (currentOp === 'is_type') {
        typeSelectRef.current?.focus();
      } else {
        operatorValueRef.current?.focus();
      }
    }
  }, [editingOperatorValue, currentOp]);

  useEffect(() => {
    if (!showOperatorPicker) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node) &&
          operatorPillRef.current && !operatorPillRef.current.contains(e.target as Node)) {
        setShowOperatorPicker(false);
        setOperatorSearch('');
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showOperatorPicker]);

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
                {showOperators && isRangeOperator ? (
                  editingOperatorValue ? (
                    <span className="dm-range-inputs" onClick={(e) => e.stopPropagation()}>
                      <input
                        ref={rangeSecondRef}
                        className="dm-operator-value-input dm-range-input"
                        defaultValue={(localOperatorValue.split(',')[1] ?? '').trim()}
                        placeholder={currentOp === 'between' ? 'max' : 'tolerance'}
                        type="number"
                        aria-label={currentOp === 'between' ? 'max' : 'tolerance'}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const tol = rangeSecondRef.current?.value ?? '';
                            onUpdateMappingOperator?.(mapping.id, mapping.operator, `, ${tol.trim()}`);
                            setEditingOperatorValue(false);
                          } else if (e.key === 'Escape') { e.preventDefault(); setEditingOperatorValue(false); }
                        }}
                        onBlur={() => {
                          const tol = rangeSecondRef.current?.value ?? '';
                          onUpdateMappingOperator?.(mapping.id, mapping.operator, `, ${tol.trim()}`);
                          setEditingOperatorValue(false);
                        }}
                      />
                    </span>
                  ) : (
                    <span
                      className="dm-operator-value-display"
                      title="Click to set tolerance"
                      onClick={(e) => { e.stopPropagation(); startEditOperatorValue(); }}
                    >
                      {(() => {
                        const parts = (mapping.operatorValue ?? '').split(',');
                        const tol = (parts[1] ?? '').trim();
                        return tol ? `± ${tol}` : 'set tolerance…';
                      })()}
                    </span>
                  )
                ) : showOperators && currentOpMeta.needsValue && !isRangeOperator ? (
                  editingOperatorValue ? (
                    <input
                      ref={operatorValueRef}
                      className="dm-operator-value-input"
                      value={localOperatorValue}
                      onChange={(e) => setLocalOperatorValue(e.target.value)}
                      onKeyDown={handleOperatorValueKeyDown}
                      onBlur={handleOperatorValueCommit}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="Enter value"
                      aria-label="Operator comparison value"
                    />
                  ) : (
                    <span
                      className="dm-operator-value-display"
                      title="Click to edit value"
                      onClick={(e) => { e.stopPropagation(); startEditOperatorValue(); }}
                    >
                      {mapping.operatorValue || 'set value…'}
                    </span>
                  )
                ) : null}
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
                {showOperators && currentOpMeta.needsValue ? (
                  editingOperatorValue ? (
                    currentOp === 'is_type' ? (
                      <select
                        ref={typeSelectRef}
                        className="dm-operator-value-input dm-type-select"
                        value={localOperatorValue}
                        onChange={(e) => {
                          const v = e.target.value;
                          setLocalOperatorValue(v);
                          if (mapping && onUpdateMappingOperator) {
                            onUpdateMappingOperator(mapping.id, mapping.operator, v);
                          }
                          setEditingOperatorValue(false);
                        }}
                        onBlur={handleOperatorValueCommit}
                        onClick={(e) => e.stopPropagation()}
                        aria-label="Select expected type"
                      >
                        <option value="">select type…</option>
                        <option value="string">string</option>
                        <option value="number">number</option>
                        <option value="boolean">boolean</option>
                        <option value="object">object</option>
                        <option value="array">array</option>
                        <option value="null">null</option>
                      </select>
                    ) :
                    isRangeOperator ? (() => {
                      const parts = localOperatorValue.split(',').map(s => s.trim());
                      const val1 = parts[0] ?? '';
                      const val2 = parts[1] ?? '';
                      const label1 = currentOp === 'between' ? 'min' : 'value';
                      const label2 = currentOp === 'between' ? 'max' : 'tolerance';
                      return (
                        <span className="dm-range-inputs" onClick={(e) => e.stopPropagation()}>
                          <input
                            ref={operatorValueRef}
                            className="dm-operator-value-input dm-range-input"
                            defaultValue={val1}
                            placeholder={label1}
                            type="number"
                            aria-label={label1}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                rangeSecondRef.current?.focus();
                              } else if (e.key === 'Escape') { e.preventDefault(); setEditingOperatorValue(false); }
                            }}
                          />
                          <span className="dm-range-separator">–</span>
                          <input
                            ref={rangeSecondRef}
                            className="dm-operator-value-input dm-range-input"
                            defaultValue={val2}
                            placeholder={label2}
                            type="number"
                            aria-label={label2}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleRangeCommit(
                                  operatorValueRef.current?.value ?? '',
                                  rangeSecondRef.current?.value ?? '',
                                );
                              } else if (e.key === 'Escape') { e.preventDefault(); setEditingOperatorValue(false); }
                            }}
                            onBlur={() => {
                              handleRangeCommit(
                                operatorValueRef.current?.value ?? '',
                                rangeSecondRef.current?.value ?? '',
                              );
                            }}
                          />
                        </span>
                      );
                    })()
                  : (
                    <input
                      ref={operatorValueRef}
                      className="dm-operator-value-input"
                      value={localOperatorValue}
                      onChange={(e) => setLocalOperatorValue(e.target.value)}
                      onKeyDown={handleOperatorValueKeyDown}
                      onBlur={handleOperatorValueCommit}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="Enter value"
                      aria-label="Operator comparison value"
                    />
                  )) : (
                    <span
                      className="dm-operator-value-display"
                      title="Click to edit value"
                      onClick={(e) => { e.stopPropagation(); startEditOperatorValue(); }}
                    >
                      {mapping.operatorValue || mapping.sourcePath}
                    </span>
                  )
                ) : !showOperators ? (
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
