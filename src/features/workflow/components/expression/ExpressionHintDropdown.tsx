import { useRef, useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { HintItem } from '../../hooks/useExpressionHints';
import type { ExpressionFunction } from '../../utils/expressionFunctions';

interface Props {
  open: boolean;
  items: HintItem[];
  selectedIndex: number;
  onSelect: (item: HintItem) => void;
  anchorRef: React.RefObject<HTMLElement | null>;
}

/**
 * Floating autocomplete dropdown for expression fields.
 * Rendered via portal to escape overflow:hidden containers.
 */
export default function ExpressionHintDropdown({ open, items, selectedIndex, onSelect, anchorRef }: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || items.length === 0) { setPos(null); return; }  
    const el = anchorRef.current;
    if (!el) { setPos(null); return; }
    const rect = el.getBoundingClientRect();
    const dropdownHeight = Math.min(items.length * 32 + 8, 268);
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const top = spaceBelow >= dropdownHeight || spaceBelow >= spaceAbove
      ? rect.bottom + 2
      : rect.top - dropdownHeight - 2;
    setPos({ top, left: rect.left, width: Math.max(rect.width, 240) });
  }, [open, items, anchorRef]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.children[selectedIndex] as HTMLElement | undefined;
    el?.scrollIntoView?.({ block: 'nearest' });
  }, [open, selectedIndex]);

  if (!open || items.length === 0 || !pos) return null;

  const style: React.CSSProperties = {
    position: 'fixed',
    top: pos.top,
    left: pos.left,
    minWidth: pos.width,
    maxWidth: 420,
    maxHeight: 260,
    overflowY: 'auto',
    zIndex: 10100,
    background: '#1e1e2e',
    border: '1px solid #3a3a5c',
    borderRadius: 6,
    boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
    padding: '4px 0',
    fontSize: '0.8rem',
  };

  return createPortal(
    <div className="expr-hint-dropdown" style={style} ref={listRef} role="listbox">
      {items.map((item, i) => {
        const fn = item.kind === 'function' ? item.meta as ExpressionFunction : null;
        return (
          <div
            key={`${item.kind}-${item.label}`}
            className={`expr-hint-item ${i === selectedIndex ? 'expr-hint-item-active' : ''}`}
            role="option"
            aria-selected={i === selectedIndex}
            onMouseDown={(e) => { e.preventDefault(); onSelect(item); }}
          >
            <span className={`expr-hint-icon ${item.kind === 'function' ? 'expr-hint-icon-fn' : 'expr-hint-icon-var'}`}>
              {item.kind === 'function' ? 'ƒ' : '𝑥'}
            </span>
            <span className="expr-hint-label">{item.label}</span>
            <span className="expr-hint-detail">
              {fn ? fn.signature : item.detail}
            </span>
          </div>
        );
      })}
    </div>,
    document.body,
  );
}
