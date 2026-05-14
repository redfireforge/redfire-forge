import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { JsonTreeNode } from '../../utils/jsonTreeModel';
import type { Mapping, TargetField, TargetFieldOrigin, AdapterCapabilities, FieldOperator } from './types';
import type { TypeMismatch } from './utils/typeMismatch';
import { normalizeMapperPath } from './utils/pathNormalization';
import { OPERATOR_REGISTRY, OPERATOR_CATEGORIES } from './utils/operatorRegistry';
import type { OperatorMeta } from './utils/operatorRegistry';
export { OPERATOR_REGISTRY, OPERATOR_CATEGORIES, type OperatorMeta };
const SOURCE_TEXT_PREFIX = 'mapper-source:';
const TARGET_FIELD_TEXT_PREFIX = 'mapper-target-field:';

const TYPE_LABELS: Record<string, string> = {
  object: 'obj',
  array: 'arr',
  string: 'str',
  number: 'num',
  boolean: 'bool',
  null: 'null',
};

import type { TraceValueOverlay } from './types';

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
  highlightedPaths?: Set<string> | null;
}

function matchesSearchTerm(node: JsonTreeNode, lower: string): boolean {
  if (!lower) return true;
  if (node.key.toLowerCase().includes(lower)) return true;
  if (node.path.toLowerCase().includes(lower)) return true;
  if (node.type !== 'object' && node.type !== 'array' && String(node.value ?? '').toLowerCase().includes(lower)) return true;
  return false;
}

function matchesFilter(path: string, mappingFilter: 'all' | 'mapped' | 'unmapped', mappedTargetPaths?: Set<string>): boolean {
  if (mappingFilter === 'all') return true;
  const normalizedPath = normalizeMapperPath(path);
  const isMapped = mappedTargetPaths?.has(normalizedPath) ?? false;
  return mappingFilter === 'mapped' ? isMapped : !isMapped;
}

function matchesNodeVisibility(
  node: JsonTreeNode,
  search: string,
  mappingFilter: 'all' | 'mapped' | 'unmapped',
  mappedTargetPaths?: Set<string>,
): boolean {
  const hasChildren = (node.children?.length ?? 0) > 0;
  const lower = search.toLowerCase();
  const searchMatch = matchesSearchTerm(node, lower);

  if (!hasChildren) {
    return searchMatch && matchesFilter(node.path, mappingFilter, mappedTargetPaths);
  }

  const childMatch = node.children!.some((child) => matchesNodeVisibility(child, search, mappingFilter, mappedTargetPaths));
  if (mappingFilter === 'all') {
    return searchMatch || childMatch;
  }
  return childMatch;
}

function formatNodeDisplayKey(node: JsonTreeNode): string {
  const raw = node.key || '(root)';
  if (!/^\[(\d+|\*)\]$/.test(raw)) return raw;
  const normalizedPath = normalizeMapperPath(node.path);
  const match = normalizedPath.match(/(?:^|\.)([^.[\]]+\[(?:\d+|\*)\])$/);
  return match?.[1] ?? raw;
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
    if (renaming) renameInputRef.current?.focus();
  }, [renaming]);

  const handleStartRename = useCallback(() => {
    if (!isCustomOrFetched || !onUpdateCustomField) return;
    setRenameValue(node.path);
    setRenaming(true);
  }, [isCustomOrFetched, onUpdateCustomField, node.path]);

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
    } else if (isCustomOrFetched && !mapping && onUpdateCustomField) {
      handleStartRename();
    }
  }, [mapping, onEditExpression, isCustomOrFetched, onUpdateCustomField, handleStartRename]);

  const currentOp = mapping?.operator ?? capabilities?.autoMapDefaultOperator ?? 'equals';
  const currentOpMeta = OPERATOR_REGISTRY[currentOp] ?? OPERATOR_REGISTRY['equals'];
  const showOperators = capabilities?.operators && !!mapping && !!onUpdateMappingOperator;

  const handleOperatorSelect = useCallback((op: FieldOperator) => {
    if (!mapping || !onUpdateMappingOperator) return;
    const meta = OPERATOR_REGISTRY[op];
    if (meta.needsValue) {
      onUpdateMappingOperator(mapping.id, op, mapping.operatorValue ?? '');
    } else {
      onUpdateMappingOperator(mapping.id, op === 'equals' ? undefined : op, undefined);
    }
    setShowOperatorPicker(false);
    setOperatorSearch('');
    setEditingOperatorValue(false);
    setLocalOperatorValue(meta.needsValue ? (mapping.operatorValue ?? '') : '');
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

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (!capabilities?.operators) return;
    e.preventDefault();
    e.stopPropagation();
    setContextMenuPos({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  }, [capabilities]);

  const filteredOperators = useMemo(() => {
    const lower = operatorSearch.toLowerCase();
    if (!lower) return Object.entries(OPERATOR_REGISTRY) as [FieldOperator, OperatorMeta][];
    return (Object.entries(OPERATOR_REGISTRY) as [FieldOperator, OperatorMeta][]).filter(
      ([key, meta]) => meta.label.includes(lower) || key.includes(lower) || meta.category.includes(lower),
    );
  }, [operatorSearch]);

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
        <div
          ref={pickerRef}
          className={`dm-operator-picker ${pickerPos.openUp ? 'dm-operator-picker--up' : ''}`}
          style={{ position: 'fixed', top: pickerPos.top, left: pickerPos.left, zIndex: 10000 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="dm-op-picker-header">
            <div className="dm-op-picker-title">Select Operator</div>
            <input
              className="dm-op-picker-search"
              placeholder="Search operators..."
              value={operatorSearch}
              onChange={(e) => setOperatorSearch(e.target.value)}
              autoFocus
            />
          </div>
          {onToggleMappingNegate && mapping && (
            <div className="dm-op-picker-negate-row">
              <button
                type="button"
                className={`dm-op-picker-negate-btn${mapping.negate ? ' dm-op-picker-negate-btn--active' : ''}`}
                onClick={() => onToggleMappingNegate(mapping.id)}
                aria-label="Toggle negation"
              >
                <span className="dm-op-picker-negate-icon">¬</span>
                <span className="dm-op-picker-negate-label">Negate (NOT)</span>
                {mapping.negate && <span className="dm-op-picker-negate-check">✓</span>}
              </button>
            </div>
          )}
          <div className="dm-op-picker-list" role="listbox" aria-label="Operators">
            {OPERATOR_CATEGORIES.map(cat => {
              const ops = filteredOperators.filter(([, m]) => m.category === cat.key);
              if (ops.length === 0) return null;
              return (
                <div key={cat.key} className="dm-op-picker-category">
                  <div className="dm-op-picker-category-label">{cat.label}</div>
                  {ops.map(([opKey, meta]) => (
                    <button
                      key={opKey}
                      type="button"
                      role="option"
                      aria-selected={opKey === currentOp}
                      className={`dm-op-picker-item ${opKey === currentOp ? 'dm-op-picker-item--active' : ''}`}
                      onClick={() => handleOperatorSelect(opKey)}
                    >
                      <span className={`dm-op-picker-icon dm-operator-pill--${meta.cssClass}`}>{meta.icon}</span>
                      <span className="dm-op-picker-label">{meta.label}</span>
                      {meta.needsValue && <span className="dm-op-picker-hint">value</span>}
                    </button>
                  ))}
                </div>
              );
            })}
            {filteredOperators.length === 0 && (
              <div className="dm-op-picker-empty">No matching operators</div>
            )}
          </div>
        </div>
      )}
      {showContextMenu && capabilities?.operators && (
        <div
          ref={contextMenuRef}
          className="dm-context-menu"
          style={{ position: 'fixed', top: contextMenuPos.y, left: contextMenuPos.x, zIndex: 10001 }}
          onClick={(e) => e.stopPropagation()}
        >
          {isMapped && mapping && (
            <>
              <button
                type="button"
                className="dm-context-menu-item"
                onClick={() => {
                  setShowContextMenu(false);
                  if (operatorPillRef.current) {
                    const rect = operatorPillRef.current.getBoundingClientRect();
                    setPickerPos({ top: rect.bottom + 4, left: rect.left, openUp: false });
                  } else {
                    setPickerPos({ top: contextMenuPos.y, left: contextMenuPos.x, openUp: false });
                  }
                  setShowOperatorPicker(true);
                }}
              >
                Set operator…
              </button>
              {onToggleMappingNegate && (
                <button
                  type="button"
                  className={`dm-context-menu-item${mapping.negate ? ' dm-context-menu-item--active' : ''}`}
                  onClick={() => { setShowContextMenu(false); onToggleMappingNegate(mapping.id); }}
                >
                  {mapping.negate ? '✓ Negated (NOT)' : 'Negate (NOT)'}
                </button>
              )}
              {onEditExpression && (
                <button
                  type="button"
                  className="dm-context-menu-item"
                  onClick={() => { setShowContextMenu(false); onEditExpression(mapping.id); }}
                >
                  Edit expression…
                </button>
              )}
              {onRemoveMapping && (
                <button
                  type="button"
                  className="dm-context-menu-item dm-context-menu-item--danger"
                  onClick={() => { setShowContextMenu(false); onRemoveMapping(mapping.id); }}
                >
                  Remove mapping
                </button>
              )}
            </>
          )}
          {node.type === 'array' && capabilities.arrayAssertions && (
            <>
              {isMapped && mapping && <div className="dm-context-menu-divider" />}
              <div className="dm-context-menu-label">Array Assertions</div>
              <button
                type="button"
                className="dm-context-menu-item"
                disabled={!onAddArrayAssertion}
                onClick={() => { setShowContextMenu(false); onAddArrayAssertion?.(node.path, 'length'); }}
              >
                Add length assertion
              </button>
              <button
                type="button"
                className="dm-context-menu-item"
                disabled={!onAddArrayAssertion}
                onClick={() => { setShowContextMenu(false); onAddArrayAssertion?.(node.path, 'contains'); }}
              >
                Add contains assertion
              </button>
              <button
                type="button"
                className="dm-context-menu-item"
                disabled={!onAddArrayAssertion}
                onClick={() => { setShowContextMenu(false); onAddArrayAssertion?.(node.path, 'each'); }}
              >
                Add each assertion
              </button>
              <button
                type="button"
                className="dm-context-menu-item"
                disabled={!onAddArrayAssertion}
                onClick={() => { setShowContextMenu(false); onAddArrayAssertion?.(node.path, 'subset'); }}
              >
                Add subset assertion
              </button>
            </>
          )}
        </div>
      )}
      {node.type === 'array' && isExpanded && capabilities?.arrayAssertions && (
        <div className="dm-array-assertion-rows" style={{ paddingLeft: (depth + 1) * 16 + 4 }}>
          <div className="dm-array-assertion-hint">
            <span className="dm-array-assertion-hint-icon">+</span>
            <span className="dm-array-assertion-hint-text">Add array assertion (use Assertions panel)</span>
          </div>
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
              highlightedPaths={highlightedPaths}
            />
          ))}
        </div>
      )}
    </div>
  );
}
