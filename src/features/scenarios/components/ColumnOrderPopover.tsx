/**
 * ColumnOrderPopover — Popover for reordering ALL data source columns.
 *
 * Provides:
 * 1. Full drag-to-reorder list for every column
 * 2. Quick-sort buttons (By Index / By Field) shown only when indexed array columns exist
 * 3. Movable (drag header) + resizable (edge/corner handles) when used as a toolbar popover
 *
 * Toolbar usage portals a fixed-position panel so modal overflow does not clip
 * the list into empty-looking boxes. Inline (setup wizard) stays in-flow.
 */
import { useState, useCallback, useEffect, useLayoutEffect, useRef, useMemo, type CSSProperties, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useModalResize } from '@shared/hooks/useModalResize';
import ModalResizeHandles from '@shared/components/ModalResizeHandles';

export interface OrderableItem {
  mapping: string;
  name: string;
  type?: string;
}

interface Props<T extends OrderableItem> {
  items: T[];
  onApply: (reordered: T[]) => void;
  onClose: () => void;
  /** When true, call onApply after every reorder instead of requiring explicit Apply click */
  autoApply?: boolean;
  /**
   * `popover` (default) — fixed portal, clamped to the viewport (toolbar).
   * `inline` — in-flow panel for the setup wizard Column Order step.
   */
  variant?: 'popover' | 'inline';
  /** Anchor button used to position the fixed popover. */
  anchorRef?: RefObject<HTMLElement | null>;
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
  body: 'Body',
  header: 'Header',
  validate: 'Validate',
};

const POPOVER_WIDTH = 360;
const POPOVER_MIN_W = 280;
const POPOVER_MIN_H = 200;
const VIEWPORT_PAD = 12;

function clampToViewport(top: number, left: number, width: number, height: number): { top: number; left: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return {
    left: Math.min(Math.max(VIEWPORT_PAD, left), Math.max(VIEWPORT_PAD, vw - width - VIEWPORT_PAD)),
    top: Math.min(Math.max(VIEWPORT_PAD, top), Math.max(VIEWPORT_PAD, vh - height - VIEWPORT_PAD)),
  };
}

function initialPopoverPosition(anchor: DOMRect, popHeight: number, popWidth: number): { top: number; left: number } {
  let top = anchor.bottom + 6;
  if (top + popHeight > window.innerHeight - VIEWPORT_PAD) {
    top = Math.max(VIEWPORT_PAD, anchor.top - popHeight - 6);
  }
  const left = anchor.right - popWidth;
  return clampToViewport(top, left, popWidth, popHeight);
}

export default function ColumnOrderPopover<T extends OrderableItem>({
  items,
  onApply,
  onClose,
  autoApply,
  variant = 'popover',
  anchorRef,
}: Props<T>) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const isInline = variant === 'inline';
  const placedRef = useRef(false);
  const userMovedRef = useRef(false);

  const [orderedItems, setOrderedItems] = useState<T[]>(() => [...items]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const initialRender = useRef(true);

  const { resizeStyle, onRightEdge, onCorner, onBottomEdge } = useModalResize(POPOVER_MIN_W, POPOVER_MIN_H);

  // Auto-apply on every reorder when enabled
  useEffect(() => {
    if (autoApply) {
      if (initialRender.current) { initialRender.current = false; return; }
      onApply(orderedItems);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onApply omitted: unstable parent identity would retrigger; orderedItems is the intentional driver
  }, [autoApply, orderedItems]);

  const hasIndexedCols = useMemo(
    () => orderedItems.some(c => /\[\d+\]/.test(c.mapping ?? '')),
    [orderedItems],
  );

  const placeInitially = useCallback(() => {
    if (isInline || placedRef.current) return;
    const pop = popoverRef.current;
    if (!pop) return;
    const popRect = pop.getBoundingClientRect();
    const popHeight = popRect.height || 260;
    const popWidth = popRect.width || POPOVER_WIDTH;
    const anchor = anchorRef?.current;
    if (anchor) {
      setPosition(initialPopoverPosition(anchor.getBoundingClientRect(), popHeight, popWidth));
    } else {
      // No anchor (tests / edge cases): place near top-right of the viewport
      setPosition(clampToViewport(
        VIEWPORT_PAD + 40,
        window.innerWidth - popWidth - 40,
        popWidth,
        popHeight,
      ));
    }
    placedRef.current = true;
  }, [anchorRef, isInline]);

  useLayoutEffect(() => {
    placeInitially();
  }, [placeInitially, hasIndexedCols]);

  // Keep on-screen after window resize (without resetting a user-dragged position relative to anchor)
  useEffect(() => {
    if (isInline) return;
    const onWin = () => {
      const pop = popoverRef.current;
      if (!pop || !position) return;
      const rect = pop.getBoundingClientRect();
      setPosition(clampToViewport(position.top, position.left, rect.width, rect.height));
    };
    window.addEventListener('resize', onWin);
    return () => window.removeEventListener('resize', onWin);
  }, [isInline, position]);

  const onHeaderMouseDown = useCallback((e: React.MouseEvent) => {
    // Don't start move-drag from interactive children (none today, but safe)
    if ((e.target as HTMLElement).closest('button, input, a')) return;
    e.preventDefault();
    const pop = popoverRef.current;
    if (!pop || !position) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const origTop = position.top;
    const origLeft = position.left;
    setIsMoving(true);
    userMovedRef.current = true;

    const onMove = (ev: MouseEvent) => {
      const rect = pop.getBoundingClientRect();
      const next = clampToViewport(
        origTop + (ev.clientY - startY),
        origLeft + (ev.clientX - startX),
        rect.width,
        rect.height,
      );
      setPosition(next);
    };
    const onUp = () => {
      setIsMoving(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [position]);

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

  // Close on outside click / Escape
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popoverRef.current?.contains(t)) return;
      if (anchorRef?.current?.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose, anchorRef]);

  const fixedStyle: CSSProperties | undefined = isInline || !position
    ? undefined
    : {
        position: 'fixed',
        top: position.top,
        left: position.left,
        right: 'auto',
        bottom: 'auto',
        width: POPOVER_WIDTH,
        zIndex: 11000,
        ...resizeStyle,
      };

  const panel = (
    <div
      className={`col-order-popover${isInline ? ' col-order-popover--inline' : ' col-order-popover--fixed'}${isMoving ? ' col-order-popover--moving' : ''}`}
      ref={popoverRef}
      data-testid="col-order-popover"
      role="dialog"
      aria-label="Column Order"
      style={fixedStyle}
    >
      <div
        className="col-order-header"
        data-testid="col-order-header"
        onMouseDown={isInline ? undefined : onHeaderMouseDown}
        title={isInline ? undefined : 'Drag to move'}
      >
        <div className="col-order-header-text">
          <span className="col-order-title">Column Order</span>
          <span className="col-order-subtitle">{orderedItems.length} column{orderedItems.length !== 1 ? 's' : ''}</span>
        </div>
        {!isInline && (
          <span className="col-order-move-hint" aria-hidden="true">⠿</span>
        )}
      </div>

      {hasIndexedCols && (
        <div className="col-order-mode">
          <span className="col-order-mode-label">Quick sort</span>
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

      <div className="col-order-fields">
        <span className="col-order-fields-label">Drag to reorder</span>
        {orderedItems.map((item, i) => {
          const isIndexed = /\[\d+\]/.test(item.mapping ?? '');
          const idxClass = isIndexed ? `idx-${extractIndex(item.mapping ?? '') % 4}` : '';
          const showMapping = Boolean(item.mapping && item.mapping !== item.name);
          return (
            <div
              key={`${item.name}-${item.mapping}-${i}`}
              className={`col-order-field-item ${dragOverIdx === i ? 'drag-over' : ''} ${dragIdx === i ? 'dragging' : ''} ${idxClass}`}
              draggable
              onDragStart={(e) => handleDragStart(i, e)}
              onDragOver={(e) => handleDragOver(i, e)}
              onDrop={(e) => handleDrop(i, e)}
              onDragEnd={handleDragEnd}
            >
              <span className="col-order-field-grip" aria-hidden="true">⠿</span>
              <span className="col-order-field-index" aria-hidden="true">{i + 1}</span>
              {item.type && (
                <span className={`col-order-type-badge col-order-type-${item.type}`}>
                  {TYPE_LABELS[item.type] ?? item.type}
                </span>
              )}
              <span className="col-order-field-meta">
                <span className="col-order-field-name">{item.name || '(unnamed)'}</span>
                {showMapping && (
                  <span className="col-order-field-mapping">{item.mapping}</span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      <div className="col-order-actions">
        <button type="button" className="btn btn-sm" data-testid="col-order-close" onClick={onClose}>Cancel</button>
        <button type="button" className="btn btn-sm btn-primary" data-testid="col-order-apply" onClick={handleApply}>Apply</button>
      </div>

      {!isInline && (
        <ModalResizeHandles onRightEdge={onRightEdge} onCorner={onCorner} onBottomEdge={onBottomEdge} />
      )}
    </div>
  );

  if (isInline) return panel;
  return createPortal(panel, document.body);
}
