import { useEffect, useRef, useState, useCallback, useId } from 'react';
import { createPortal } from 'react-dom';

const CUSTOM_SELECT_OPEN_EVENT = 'custom-select:open';
/** Demo / automation: set value without opening the menu (avoids flicker). */
export const CUSTOM_SELECT_SET_VALUE_EVENT = 'custom-select:set-value';

export interface CustomSelectOption {
  value: string;
  label: string;
  detail?: string;
  disabled?: boolean;
}

export interface CustomSelectGroup {
  label: string;
  options: CustomSelectOption[];
}

export type CustomSelectItems = CustomSelectOption[] | CustomSelectGroup[];

function isGrouped(items: CustomSelectItems): items is CustomSelectGroup[] {
  return items.length > 0 && 'options' in items[0];
}

function flattenItems(items: CustomSelectItems): CustomSelectOption[] {
  if (isGrouped(items)) return items.flatMap(g => g.options);
  return items;
}

/** True when the trigger (and ancestors) are not display:none / visibility:hidden. */
function isSelectTriggerLaidOut(el: HTMLElement): boolean {
  let cur: HTMLElement | null = el;
  while (cur) {
    const style = window.getComputedStyle(cur);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    cur = cur.parentElement;
  }
  return true;
}

export interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: CustomSelectItems;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  'data-testid'?: string;
  'aria-label'?: string;
  size?: 'default' | 'sm';
  /**
   * Echo the selected option's `detail` next to the label in the closed trigger.
   * Only enable when `detail` is a short glyph (an operator symbol like `≥`).
   * Most callers use `detail` for a sentence-long description that belongs in
   * the menu only — rendering that in the trigger would overflow it.
   */
  showDetailInTrigger?: boolean;
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  className,
  size = 'default',
  showDetailInTrigger = false,
  ...rest
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selectId = useId();

  const testId = rest['data-testid'];
  const ariaLabel = rest['aria-label'];

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      // The menu is portaled to document.body, so it's no longer a DOM
      // descendant of wrapperRef — it must be checked separately or every
      // click on an option would be treated as an "outside click" and close
      // the menu before the option's onClick can fire.
      const inWrapper = wrapperRef.current && wrapperRef.current.contains(target);
      const inMenu = menuRef.current && menuRef.current.contains(target);
      if (!inWrapper && !inMenu) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    const closeIfAnotherSelectOpened = (event: Event) => {
      const customEvent = event as CustomEvent<{ id?: string }>;
      if (customEvent.detail?.id !== selectId) {
        setOpen(false);
      }
    };
    document.addEventListener(CUSTOM_SELECT_OPEN_EVENT, closeIfAnotherSelectOpened as EventListener);
    return () => {
      document.removeEventListener(CUSTOM_SELECT_OPEN_EVENT, closeIfAnotherSelectOpened as EventListener);
    };
  }, [selectId]);

  const [openUp, setOpenUp] = useState(false);
  // Menu is rendered via a portal into document.body and positioned with
  // `position: fixed` so it can never be clipped by an ancestor's
  // `overflow: hidden`/`auto` (e.g. a scrollable modal body or a table
  // wrapper with rounded corners). These are viewport-relative coordinates
  // computed from the trigger's rect.
  const [menuPos, setMenuPos] = useState<{
    left?: number;
    right?: number;
    minWidth: number;
    top?: number;
    bottom?: number;
  } | null>(null);

  const recomputeMenuPos = useCallback(() => {
    const anchor = triggerRef.current ?? wrapperRef.current;
    if (!anchor) return;
    // Inactive WS / studio tabs keep chrome mounted with display:none. Opening
    // those selects portals a menu with a zero/garbage anchor → corner ghost menu.
    if (!isSelectTriggerLaidOut(anchor)) {
      setMenuPos(null);
      setOpen(false);
      return;
    }
    const rect = anchor.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const up = spaceBelow < 200;
    // When the trigger centre is in the right half of the viewport, anchor the
    // menu to the trigger's right edge so it opens leftward and never clips.
    const rightHalf = rect.left + rect.width / 2 > window.innerWidth / 2;
    const hPos = rightHalf
      ? { right: window.innerWidth - rect.right }
      : { left: rect.left };
    const vPos = up
      ? { bottom: window.innerHeight - rect.top + 3 }
      : { top: rect.bottom + 3 };
    const next: { left?: number; right?: number; minWidth: number; top?: number; bottom?: number } = {
      ...hPos, minWidth: rect.width, ...vPos,
    };
    setOpenUp(up);
    setMenuPos((prev) => {
      if (
        prev
        && prev.left === next.left
        && prev.right === next.right
        && prev.minWidth === next.minWidth
        && prev.top === next.top
        && prev.bottom === next.bottom
      ) {
        return prev;
      }
      return next;
    });
  }, []); 

  useEffect(() => {
    if (!open) { setMenuPos(null); return; }
    recomputeMenuPos();
    // Keep the menu anchored to the trigger if the page (or any scrollable
    // ancestor, e.g. a modal body) scrolls or the window resizes while open.
    // Ignore scrolls that originate inside the menu itself — otherwise
    // recompute → setMenuPos → scrollIntoView(active) fights the user and
    // snaps the list back to the selected item on every wheel tick.
    const onScrollOrResize = (event?: Event) => {
      if (event?.type === 'scroll') {
        const target = event.target;
        if (
          target instanceof Node
          && menuRef.current
          && (target === menuRef.current || menuRef.current.contains(target))
        ) {
          return;
        }
      }
      recomputeMenuPos();
    };
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [open, recomputeMenuPos]);

  // Scroll the selected option into view once when the menu opens — not on
  // every menuPos recompute (that would yank the list while the user scrolls).
  const didInitialScrollRef = useRef(false);
  useEffect(() => {
    if (!open) {
      didInitialScrollRef.current = false;
      return;
    }
    if (!menuPos || !menuRef.current || didInitialScrollRef.current) return;
    didInitialScrollRef.current = true;
    const active = menuRef.current.querySelector('.cs-item.active');
    if (active && typeof active.scrollIntoView === 'function') {
      active.scrollIntoView({ block: 'nearest' });
    }
  }, [open, menuPos]);

  const announceOpen = useCallback(() => {
    document.dispatchEvent(new CustomEvent(CUSTOM_SELECT_OPEN_EVENT, { detail: { id: selectId } }));
  }, [selectId]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const nextOpen = !open;
      if (nextOpen) announceOpen();
      setOpen(nextOpen);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }, [announceOpen, disabled, open]);

  const flat = flattenItems(options);
  const selected = flat.find(o => o.value === value);
  const displayText = selected?.label ?? placeholder ?? '';
  const isPlaceholder = !selected;

  const handleSelect = (val: string) => {
    onChange(val);
    setOpen(false);
  };

  // Quiet programmatic set (demo Preparing / skip-recovery) — no menu open/close flash.
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const onDemoSetValue = (event: Event) => {
      if (disabled) return;
      const next = (event as CustomEvent<{ value?: string }>).detail?.value;
      if (next === undefined || next === value) return;
      const opt = flattenItems(options).find((o) => o.value === next);
      if (!opt || opt.disabled) return;
      onChange(next);
      setOpen(false);
    };
    wrapper.addEventListener(CUSTOM_SELECT_SET_VALUE_EVENT, onDemoSetValue);
    return () => wrapper.removeEventListener(CUSTOM_SELECT_SET_VALUE_EVENT, onDemoSetValue);
  }, [disabled, onChange, options, value]);

  const renderOption = (o: CustomSelectOption) => (
    <button
      key={o.value}
      type="button"
      role="option"
      data-value={o.value}
      aria-selected={value === o.value}
      className={`cs-item${value === o.value ? ' active' : ''}${o.disabled ? ' disabled' : ''}`}
      onClick={() => { if (!o.disabled) handleSelect(o.value); }}
      disabled={o.disabled}
    >
      <span className="cs-item-label">{o.label}</span>
      {o.detail && <span className="cs-item-detail">{o.detail}</span>}
      {value === o.value && <span className="cs-check">✓</span>}
    </button>
  );

  return (
    <div
      className={`cs-wrapper${className ? ` ${className}` : ''}${size === 'sm' ? ' cs-sm' : ''}`}
      ref={wrapperRef}
      data-testid={testId}
      data-value={value}
    >
      <button
        type="button"
        ref={triggerRef}
        className={`cs-trigger${isPlaceholder ? ' cs-placeholder' : ''}${disabled ? ' cs-disabled' : ''}`}
        onClick={() => {
          if (disabled) return;
          const nextOpen = !open;
          if (nextOpen) {
            const anchor = triggerRef.current ?? wrapperRef.current;
            if (!anchor || !isSelectTriggerLaidOut(anchor)) return;
            announceOpen();
          }
          setOpen(nextOpen);
        }}
        onKeyDown={handleKeyDown}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        disabled={disabled}
      >
        <span className="cs-text">
          {displayText}
          {showDetailInTrigger && selected?.detail
            ? <span className="cs-text-detail"> ({selected.detail})</span>
            : null}
        </span>
        <span className="cs-arrow">{open ? '▲' : '▼'}</span>
      </button>
      {open && menuPos && createPortal(
        <div
          className={`cs-menu${openUp ? ' cs-menu-up' : ''}`}
          role="listbox"
          ref={menuRef}
          style={{
            position: 'fixed',
            // .cs-menu (base.css) hardcodes `left: 0; right: auto;` as its
            // default (non-portaled) position. We must explicitly set BOTH
            // left and right here — even to 'auto' — otherwise the CSS
            // class's `left: 0` wins the over-constrained left/right/width
            // resolution and the menu renders pinned to the viewport's left
            // edge regardless of where the trigger actually is.
            left: menuPos.left !== undefined ? menuPos.left : 'auto',
            right: menuPos.right !== undefined ? menuPos.right : 'auto',
            minWidth: menuPos.minWidth,
            ...(menuPos.top !== undefined ? { top: menuPos.top } : {}),
            ...(menuPos.bottom !== undefined ? { bottom: menuPos.bottom } : {}),
          }}
        >
          {isGrouped(options)
            ? options.map(g => (
                <div key={g.label} className="cs-group">
                  <div className="cs-group-label">{g.label}</div>
                  {g.options.map(renderOption)}
                </div>
              ))
            : options.map(renderOption)
          }
        </div>,
        document.body
      )}
    </div>
  );
}
