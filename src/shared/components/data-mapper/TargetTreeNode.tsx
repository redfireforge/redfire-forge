import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { JsonTreeNode } from '../../utils/jsonTreeModel';
import type {
  Mapping,
  TargetField,
  TargetFieldOrigin,
  AdapterCapabilities,
  FieldOperator,
  TraceValueOverlay,
} from './types';
import type { TypeMismatch } from './utils/typeMismatch';
import type { Assertion } from '../../types';
import { normalizeMapperPath } from './utils/pathNormalization';
import { OPERATOR_REGISTRY, type OperatorMeta } from './utils/operatorRegistry';
import {
  SOURCE_TEXT_PREFIX,
  TARGET_FIELD_TEXT_PREFIX,
  TYPE_LABELS,
  matchesNodeVisibility,
  formatNodeDisplayKey,
} from './utils/targetTreeHelpers';
import InlineAssertionRow from './InlineAssertionRow';
import TargetNodeOperatorPicker from './TargetNodeOperatorPicker';
import TargetNodeContextMenu from './TargetNodeContextMenu';


interface TargetTreeNodeProps {
  node: JsonTreeNode;
  depth: number;
  search: string;
  mappingFilter?: 'all' | 'mapped' | 'unmapped';
  mappedTargetPaths?: Set<string>;
  onNodeSelect?: (path: string) => void;
  selectedNodePath?: string | null;
  mappings: Mapping[];
  onDrop: (targetPath: string, sourcePath: string, sourceId: string) => void;
  expandedPaths: Set<string>;
  onToggle: (path: string) => void;
  selectedMappingId: string | null;
  onSelectMapping: (id: string | null) => void;
  onEditExpression?: (mappingId: string) => void;
  typeMismatches?: TypeMismatch[];
  onQuickFix?: (mappingId: string, suggestedExpression: string) => void;
  onRemoveMapping?: (id: string) => void;
  focusedPath?: string | null;
  traceOverlay?: Map<string, TraceValueOverlay>;
  fieldOrigins?: Map<string, TargetFieldOrigin>;
  onRemoveCustomField?: (path: string) => void;
  onUpdateCustomField?: (oldPath: string, updated: TargetField) => void;
  onReorderField?: (dragPath: string, dropPath: string) => void;
  onTargetFieldDragStart?: (path: string) => void;
  onTargetFieldDragEnd?: () => void;
  getDraggedSource?: () => { path: string; sourceId: string } | null;
  getDraggedTargetFieldPath?: () => string | null;
  unorderedDefault?: boolean;
  onToggleUnorderedArray?: (arrayPath: string) => void;
  capabilities?: Required<AdapterCapabilities>;
  onUpdateMappingOperator?: (mappingId: string, operator: FieldOperator | undefined, operatorValue: string | undefined) => void;
  onToggleMappingNegate?: (mappingId: string) => void;
  verifyStatus?: 'pass' | 'fail';
  verifyActual?: string;
  verifyExpected?: string;
  nodeStatusMap?: Map<string, 'pass' | 'fail'>;
  fieldVerifyResults?: Map<string, { passed: boolean; actual?: string; expected?: string; matchContext?: string }>;
  onAddArrayAssertion?: (arrayPath: string, assertionType: 'length' | 'contains' | 'each' | 'subset') => void;
  onUpdateArrayAssertion?: (index: number, patch: Partial<Assertion>) => void;
  onRemoveArrayAssertion?: (index: number) => void;
  arrayAssertions?: Assertion[];
  highlightedPaths?: Set<string> | null;
}

export default function TargetTreeNode({
  node,
  depth,
  search,
  mappingFilter = 'all',
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
  highlightedPaths,
}: TargetTreeNodeProps) {
  const [dragOver, setDragOver] = useState(false);
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
  const isRenamableField = !!onUpdateCustomField && origin === 'custom';

  // Derive verify status from nodeStatusMap if not directly set
  const verifyStatus = verifyStatusProp ?? nodeStatusMap?.get(node.path) ?? nodeStatusMap?.get(`$.${node.path}`);
  const fieldResult = fieldVerifyResults?.get(node.path) ?? fieldVerifyResults?.get(`$.${node.path}`);
  const verifyActual = verifyActualProp ?? fieldResult?.actual;
  const verifyExpected = verifyExpectedProp ?? fieldResult?.expected;
  const verifyMatchContext = fieldResult?.matchContext;
  const normalizedNodePath = useMemo(() => normalizeMapperPath(node.path), [node.path]);

  const mapping = useMemo(
    () => mappings.find((m) => normalizeMapperPath(m.targetPath) === normalizedNodePath),
    [mappings, normalizedNodePath],
  );

  const mismatch = useMemo(
    () => mapping && typeMismatches
      ? typeMismatches.find((m) => m.mappingId === mapping.id) : undefined,
    [mapping, typeMismatches],
  );

  const isVisible = useMemo(
    () => matchesNodeVisibility(node, search, mappingFilter, mappedTargetPaths),
    [node, search, mappingFilter, mappedTargetPaths],
  );

  const handleFieldDragStart = useCallback((e: React.DragEvent) => {
    if (!isLeaf || !onReorderField || !node.path) return;
    onTargetFieldDragStart?.(node.path);
    e.dataTransfer.effectAllowed = 'move';
    const payload = JSON.stringify({ kind: 'target-field', path: node.path });
    if (typeof e.dataTransfer.setData === 'function') {
      e.dataTransfer.setData('application/mapper-target-field', payload);
      // Keep text fallback for WebKit drag/drop compatibility.
      e.dataTransfer.setData('text/plain', `${TARGET_FIELD_TEXT_PREFIX}${payload}`);
    }
  }, [isLeaf, onReorderField, node.path, onTargetFieldDragStart]);

  const handleFieldDragEnd = useCallback(() => {
    onTargetFieldDragEnd?.();
  }, [onTargetFieldDragEnd]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!node.path) return;
    e.preventDefault();
    const activeTargetPath = getDraggedTargetFieldPath?.();
    const hasSourceDrag = !!getDraggedSource?.();
    e.dataTransfer.dropEffect = activeTargetPath && isLeaf && !hasSourceDrag ? 'move' : 'link';
    setDragOver(true);
  }, [isLeaf, node.path, getDraggedTargetFieldPath, getDraggedSource]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    if (!node.path) return;
    e.preventDefault();
    setDragOver(true);
  }, [node.path]);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (!node.path) return;
      const getDragData = (type: string): string => {
        if (typeof e.dataTransfer.getData !== 'function') return '';
        try {
          return e.dataTransfer.getData(type) ?? '';
        } catch {
          return '';
        }
      };

      const parseJsonPayload = (raw: string): unknown => {
        if (!raw) return null;
        const cleaned = raw.startsWith(SOURCE_TEXT_PREFIX)
          ? raw.slice(SOURCE_TEXT_PREFIX.length)
          : raw.startsWith(TARGET_FIELD_TEXT_PREFIX)
            ? raw.slice(TARGET_FIELD_TEXT_PREFIX.length)
            : raw;
        try {
          return JSON.parse(cleaned);
        } catch {
          return null;
        }
      };

      try {
        const targetFieldRaw = getDragData('application/mapper-target-field') || getDragData('text/plain');
        const targetFieldData = parseJsonPayload(targetFieldRaw) as { kind?: string; path?: string } | null;
        const fallbackTargetPath = getDraggedSource?.() ? null : (getDraggedTargetFieldPath?.() ?? null);
        const dragPath = targetFieldData?.kind === 'target-field' && typeof targetFieldData.path === 'string'
          ? targetFieldData.path
          : fallbackTargetPath;
        if (
          isLeaf
          && !!onReorderField
          && typeof dragPath === 'string'
          && dragPath !== node.path
        ) {
          onReorderField?.(dragPath, node.path);
          onTargetFieldDragEnd?.();
          return;
        }
      } catch { /* not a target-field reorder drop */ }
      try {
        const sourceRaw = getDragData('application/mapper-source') || getDragData('text/plain');
        const data = parseJsonPayload(sourceRaw) as { path?: string; sourceId?: string } | null;
        const fallbackSource = getDraggedSource?.() ?? null;
        const dropSourcePath = typeof data?.path === 'string' ? data.path : fallbackSource?.path;
        const dropSourceId = typeof data?.sourceId === 'string' ? data.sourceId : fallbackSource?.sourceId;
        if (typeof dropSourcePath === 'string' && typeof dropSourceId === 'string') {
          onDrop(node.path, dropSourcePath, dropSourceId);
          onTargetFieldDragEnd?.();
        }
      } catch { /* ignore invalid drag data */ }
    },
    [node.path, onDrop, isLeaf, onReorderField, getDraggedSource, getDraggedTargetFieldPath, onTargetFieldDragEnd],
  );

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
      onUpdateMappingOperator(mapping.id, op === 'equals' ? undefined : op, undefined);
      setEditingOperatorValue(false);
      setLocalOperatorValue('');
    }
    setShowOperatorPicker(false);
    setOperatorSearch('');
  }, [mapping, onUpdateMappingOperator]);

  const handleOperatorValueCommit = useCallback(() => {
    if (!mapping || !onUpdateMappingOperator) return;
    onUpdateMappingOperator(mapping.id, mapping.operator, localOperatorValue);
    setEditingOperatorValue(false);
  }, [mapping, onUpdateMappingOperator, localOperatorValue]);

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
    if (editingOperatorValue) operatorValueRef.current?.focus();
  }, [editingOperatorValue]);

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

  const isMapped = !!mapping || (mappedTargetPaths?.has(normalizedNodePath) ?? false);
  const isSelected = mapping?.id === selectedMappingId && !!selectedMappingId;
  const isBulkSelected = selectedNodePath === node.path;
  const isFocused = focusedPath === node.path;
  const isHoverHighlighted = isLeaf && (highlightedPaths?.has(normalizedNodePath) ?? false);
  const traceVal = traceOverlay?.get(node.path);
  const displayKey = formatNodeDisplayKey(node);
  const nodePathTitle = normalizedNodePath ? `Path: ${normalizedNodePath}` : '(root)';

  return (
    <div className="dm-tree-node-group">
      <div
        className={`dm-tree-node dm-tree-node--target ${isLeaf ? 'dm-tree-node--leaf' : ''} ${isLeaf && onReorderField ? 'dm-tree-node--reorderable' : ''} ${isMapped ? 'dm-tree-node--mapped' : ''} ${dragOver ? 'dm-tree-node--drag-over' : ''} ${isSelected ? 'dm-tree-node--selected' : ''} ${isBulkSelected ? 'dm-tree-node--bulk-selected' : ''} ${isFocused ? 'dm-tree-node--focused' : ''} ${isCustomOrFetched ? 'dm-tree-node--custom' : ''} ${isHoverHighlighted ? 'dm-tree-node--hover-highlight' : ''}`}
        style={{ paddingLeft: depth * 16 + 4 }}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        draggable={isLeaf && !!onReorderField}
        onDragStart={isLeaf && onReorderField ? handleFieldDragStart : undefined}
        onDragEnd={isLeaf && onReorderField ? handleFieldDragEnd : undefined}
        onClick={() => {
          onNodeSelect?.(node.path);
          if (mapping) onSelectMapping(isSelected ? null : mapping.id);
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
          <span className="dm-node-key" title={nodePathTitle}>{displayKey}</span>
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
        {isMapped && (
          <span
            className="dm-mapped-badge"
            onDoubleClick={(e) => { e.stopPropagation(); if (mapping && onEditExpression) onEditExpression(mapping.id); }}
          >
            {mapping!.expression ? (
              <>
                <span className="dm-mapped-fx-pill">fx</span>
                <span className="dm-mapped-src-ref" title={mapping!.expression}>{mapping!.sourcePath}</span>
              </>
            ) : (
              <>
                <span className="dm-mapped-arrow">←</span>
                {showOperators && mapping?.negate && (
                  <button
                    type="button"
                    className="dm-negate-badge"
                    title="Negated — click to remove NOT"
                    onClick={(e) => { e.stopPropagation(); onToggleMappingNegate?.(mapping!.id); }}
                    aria-label="Remove negation"
                  >NOT</button>
                )}
                {showOperators && (
                  <button
                    ref={operatorPillRef}
                    type="button"
                    className={`dm-operator-pill dm-operator-pill--${currentOpMeta.cssClass}${mapping?.negate ? ' dm-operator-pill--negated' : ''}`}
                    title={`Operator: ${mapping?.negate ? 'NOT ' : ''}${currentOpMeta.label} (click to change)`}
                    onClick={(e) => {
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
                    }}
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
                      {mapping!.operatorValue || mapping!.sourcePath}
                    </span>
                  )
                ) : !showOperators ? (
                  <span className="dm-mapped-src-ref" title={mapping!.sourcePath}>{mapping!.sourcePath}</span>
                ) : null}
                {showOperators && !currentOpMeta.needsValue && (
                  <span className="dm-mapped-src-ref" title={mapping!.sourcePath}>{mapping!.sourcePath}</span>
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
          <span className="dm-node-count">{node.children!.length}</span>
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
          {nodeAssertions.map(({ assertion, globalIndex }) => (
            <InlineAssertionRow
              key={globalIndex}
              assertion={assertion}
              globalIndex={globalIndex}
              onUpdate={onUpdateArrayAssertion}
              onRemove={onRemoveArrayAssertion}
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
              node={child}
              depth={depth + 1}
              search={search}
              mappingFilter={mappingFilter}
              mappedTargetPaths={mappedTargetPaths}
              onNodeSelect={onNodeSelect}
              selectedNodePath={selectedNodePath}
              mappings={mappings}
              onDrop={onDrop}
              expandedPaths={expandedPaths}
              onToggle={onToggle}
              selectedMappingId={selectedMappingId}
              onSelectMapping={onSelectMapping}
              onEditExpression={onEditExpression}
              typeMismatches={typeMismatches}
              onQuickFix={onQuickFix}
              onRemoveMapping={onRemoveMapping}
              focusedPath={focusedPath}
              traceOverlay={traceOverlay}
              fieldOrigins={fieldOrigins}
              onRemoveCustomField={onRemoveCustomField}
              onUpdateCustomField={onUpdateCustomField}
              onReorderField={onReorderField}
              onTargetFieldDragStart={onTargetFieldDragStart}
              onTargetFieldDragEnd={onTargetFieldDragEnd}
              getDraggedSource={getDraggedSource}
              getDraggedTargetFieldPath={getDraggedTargetFieldPath}
              unorderedDefault={unorderedDefault}
              onToggleUnorderedArray={onToggleUnorderedArray}
              capabilities={capabilities}
              onUpdateMappingOperator={onUpdateMappingOperator}
              onToggleMappingNegate={onToggleMappingNegate}
              nodeStatusMap={nodeStatusMap}
              fieldVerifyResults={fieldVerifyResults}
              onAddArrayAssertion={onAddArrayAssertion}
              onUpdateArrayAssertion={onUpdateArrayAssertion}
              onRemoveArrayAssertion={onRemoveArrayAssertion}
              arrayAssertions={arrayAssertions}
              highlightedPaths={highlightedPaths}
            />
          ))}
        </div>
      )}
    </div>
  );
}
