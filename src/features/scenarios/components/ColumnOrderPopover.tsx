/**
 * ColumnOrderPopover — Popover for reordering ALL data source columns.
 *
 * Provides:
 * 1. Full drag-to-reorder list for every column
 * 2. Quick-sort buttons (By Index / By Field) shown only when indexed array columns exist
 *
 * Generic: works with any item that has a `mapping` and a display `name`.
 */
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';

export interface OrderableItem {
  mapping: string;
  name: string;
  type?: string;
  [key: string]: unknown;
}

interface Props<T extends OrderableItem> {
  items: T[];
  onApply: (reordered: T[]) => void;
  onClose: () => void;
  /** When true, call onApply after every reorder instead of requiring explicit Apply click */
  autoApply?: boolean;
}

/** Extract the field name from an indexed mapping like "offers[0].associatedOfferingCode" → "associatedOfferingCode" */
function extractFieldName(mapping: string): string {
  const match = mapping.match(/\[\d+\]\.(.+)$/);
  return match ? match[1] : mapping;
}

/** Extract the array index from an indexed mapping like "offers[0].foo" → 0 */
function extractIndex(mapping: string): number {
  const match = mapping.match(/\[(\d+)\]/);
  return match ? parseInt(match[1], 10) : 0;
}

const TYPE_LABELS: Record<string, string> = {
  name: 'Name',
  path: 'Path',
  param: 'Param',
  validate: 'Validate',
};

export default function ColumnOrderPopover<T extends OrderableItem>({ items, onApply, onClose, autoApply }: Props<T>) {
  const popoverRef = useRef<HTMLDivElement>(null);

  const [orderedItems, setOrderedItems] = useState<T[]>(() => [...items]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const initialRender = useRef(true);

  // Auto-apply on every reorder when enabled
  useEffect(() => {
    if (autoApply) {
      if (initialRender.current) { initialRender.current = false; return; }
      onApply(orderedItems);
    }
  }, [autoApply, orderedItems]); // intentionally omit onApply to avoid loops

  // Detect if indexed array columns exist (for quick-sort shortcuts)
  const hasIndexedCols = useMemo(
    () => orderedItems.some(c => /\[\d+\]/.test(c.mapping ?? '')),
    [orderedItems],
  );

  // Quick-sort: rearrange only the validate/indexed columns, keep non-validate in place
  const quickSort = useCallback((mode: 'by-index' | 'by-field') => {
    setOrderedItems(prev => {
      const nonValidate = prev.filter(d => d.type !== 'validate');
      const validate = [...prev.filter(d => d.type === 'validate')];

      validate.sort((a, b) => {
        const aField = extractFieldName(a.mapping ?? '');
        const bField = extractFieldName(b.mapping ?? '');
        const aIdx = extractIndex(a.mapping ?? '');
        const bIdx = extractIndex(b.mapping ?? '');

        if (mode === 'by-index') {
          if (aIdx !== bIdx) return aIdx - bIdx;
          return aField.localeCompare(bField);
        } else {
          if (aField !== bField) return aField.localeCompare(bField);
          return aIdx - bIdx;
        }
      });

      return [...nonValidate, ...validate];
    });
  }, []);

  // Drag handlers
  const handleDragStart = useCallback((idx: number, e: React.DragEvent) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((idx: number, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIdx !== idx) setDragOverIdx(idx);
  }, [dragOverIdx]);

  const handleDrop = useCallback((targetIdx: number, e: React.DragEvent) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === targetIdx) {
      setDragIdx(null);
      setDragOverIdx(null);
      return;
    }
    setOrderedItems(prev => {
      const next = [...prev];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(targetIdx, 0, moved);
      return next;
    });
    setDragIdx(null);
    setDragOverIdx(null);
  }, [dragIdx]);

  const handleDragEnd = useCallback(() => {
    setDragIdx(null);
    setDragOverIdx(null);
  }, []);

  const handleApply = useCallback(() => {
    onApply(orderedItems);
    onClose();
  }, [orderedItems, onApply, onClose]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div className="col-order-popover" ref={popoverRef}>
      <div className="col-order-header">
        <span className="col-order-title">Column Order</span>
        <button type="button" className="col-order-close" onClick={onClose}>×</button>
      </div>

      {/* Quick-sort shortcuts — only when indexed array columns exist */}
      {hasIndexedCols && (
        <div className="col-order-mode">
          <span className="col-order-mode-label">Quick sort:</span>
          <button
            type="button"
            className="col-order-mode-btn"
            onClick={() => quickSort('by-index')}
            title="Group by index: [0].code, [0].name, [1].code, [1].name"
          >
            By Index
          </button>
          <button
            type="button"
            className="col-order-mode-btn"
            onClick={() => quickSort('by-field')}
            title="Group by field: [0].code, [1].code, [0].name, [1].name"
          >
            By Field
          </button>
        </div>
      )}

      {/* Draggable column list */}
      <div className="col-order-fields">
        <span className="col-order-fields-label">Drag to reorder:</span>
        {orderedItems.map((item, i) => {
          const isIndexed = /\[\d+\]/.test(item.mapping ?? '');
          const idxClass = isIndexed ? `idx-${extractIndex(item.mapping ?? '') % 4}` : '';
          return (
            <div
              key={i}
              className={`col-order-field-item ${dragOverIdx === i ? 'drag-over' : ''} ${dragIdx === i ? 'dragging' : ''} ${idxClass}`}
              draggable
              onDragStart={(e) => handleDragStart(i, e)}
              onDragOver={(e) => handleDragOver(i, e)}
              onDrop={(e) => handleDrop(i, e)}
              onDragEnd={handleDragEnd}
            >
              <span className="col-order-field-grip">⠿</span>
              {item.type && (
                <span className={`col-order-type-badge col-order-type-${item.type}`}>
                  {TYPE_LABELS[item.type] ?? item.type}
                </span>
              )}
              <span className="col-order-field-name">{item.name}</span>
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="col-order-actions">
        <button type="button" className="btn btn-sm" onClick={onClose}>Cancel</button>
        <button type="button" className="btn btn-sm btn-primary" onClick={handleApply}>Apply</button>
      </div>
    </div>
  );
}
