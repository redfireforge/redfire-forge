import { useEffect, useRef, useState, useCallback, useId } from 'react';
import { createPortal } from 'react-dom';
import {
  filterSelectItems,
  flattenSelectItems,
  isGroupedSelectItems,
  shouldShowSelectSearch,
} from './customSelectFilter';
import { computeSelectMenuPos, type CustomSelectMenuAlign, type CustomSelectMenuPlacement } from './customSelectMenuPos';
import type { CustomSelectOption, CustomSelectItems } from './customSelectTypes';

export type { CustomSelectGroup, CustomSelectItems, CustomSelectOption } from './customSelectTypes';

/** Alias kept so HMR never evaluates a body that still calls the old name. */
function flattenItems(items: CustomSelectItems): CustomSelectOption[] {
  return flattenSelectItems(items);
}

const CUSTOM_SELECT_OPEN_EVENT = 'custom-select:open';
/** Demo / automation: set value without opening the menu (avoids flicker). */
export const CUSTOM_SELECT_SET_VALUE_EVENT = 'custom-select:set-value';

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
  /**
   * Minimum width (px) for the portaled menu. Useful when options include long
   * `detail` descriptions but the closed trigger stays compact.
   */
  menuMinWidth?: number;
  /**
   * When true, the open menu width matches the trigger (no content growth).
   * Long option labels ellipsis inside the menu. Overrides CSS `width: max-content`.
   */
  menuMatchTriggerWidth?: boolean;
  /**
   * Cap the open menu width (px). Ignored when `menuMatchTriggerWidth` is set.
   */
  menuMaxWidth?: number;
  /**
   * Show a filter field in the open menu. `'auto'` (default) turns it on when
   * there are 8+ options — long operator/source lists stay scannable.
   */
  searchable?: boolean | 'auto';
  /**
   * `below` (default) drops under the trigger. `end` opens a wider panel to
   * the right of the trigger (or the left if the viewport is tight).
   */
  menuPlacement?: CustomSelectMenuPlacement;
  /**
   * Horizontal alignment for `below` menus. `start` pins to the trigger's
   * left edge (flips only if the menu would overflow). `auto` (default) uses
   * the right-half heuristic.
   */
  menuAlign?: CustomSelectMenuAlign;
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
  menuMinWidth,
  menuMatchTriggerWidth = false,
  menuMaxWidth,
  searchable = 'auto',
  menuPlacement = 'below',
  menuAlign = 'auto',
  ...rest
}: CustomSelectProps) {
  const showSearch = shouldShowSelectSearch(searchable, options);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
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
    width?: number;
    maxWidth?: number;
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
    const next = computeSelectMenuPos({
      rect,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      placement: menuPlacement,
      menuAlign,
      menuMinWidth,
      menuMaxWidth,
      menuMatchTriggerWidth,
      searchable: shouldShowSelectSearch(searchable, options),
    });
    setOpenUp(next.openUp);
    setMenuPos((prev) => {
      if (
        prev
        && prev.left === next.left
        && prev.right === next.right
        && prev.minWidth === next.minWidth
        && prev.width === next.width
        && prev.maxWidth === next.maxWidth
        && prev.top === next.top
        && prev.bottom === next.bottom
      ) {
        return prev;
      }
      const { openUp: _openUp, ...pos } = next;
      return pos;
    });
  }, [menuAlign, menuMatchTriggerWidth, menuMaxWidth, menuMinWidth, menuPlacement, options, searchable]);

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

  const flat = flattenItems(options);
  const selected = flat.find(o => o.value === value);
  const displayText = selected?.label ?? placeholder ?? '';
  const isPlaceholder = !selected;
  const visibleItems = filterSelectItems(options, query);
  const visibleFlat = flattenItems(visibleItems);

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    if (!showSearch) return;
    const frame = window.requestAnimationFrame(() => searchRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open, showSearch]);

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
      className={`cs-item${value === o.value ? ' active' : ''}${o.disabled ? ' disabled' : ''}${o.swatch ? ' cs-item--swatch' : ''}`}
      onClick={() => { if (!o.disabled) handleSelect(o.value); }}
      disabled={o.disabled}
    >
      {o.swatch && <span className="cs-swatch" style={{ background: o.swatch }} aria-hidden />}
      <span
        className={`cs-item-label${o.swatch ? ' cs-item-label--method' : ''}`}
        style={o.swatch ? { color: o.swatch } : undefined}
      >{o.label}</span>
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
        {selected?.swatch && <span className="cs-swatch" style={{ background: selected.swatch }} aria-hidden />}
        <span className="cs-text" style={selected?.swatch ? { color: selected.swatch, fontWeight: 700 } : undefined}>
          {displayText}
          {showDetailInTrigger && selected?.detail
            ? <span className="cs-text-detail"> ({selected.detail})</span>
            : null}
        </span>
        <span className="cs-arrow">{open ? '▲' : '▼'}</span>
      </button>
      {open && menuPos && createPortal(
        <div
          className={`cs-menu${openUp ? ' cs-menu-up' : ''}${showSearch ? ' cs-menu--searchable' : ''}${menuPlacement === 'end' ? ' cs-menu--end' : ''}`}
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
            ...(menuPos.width !== undefined ? { width: menuPos.width } : {}),
            ...(menuPos.maxWidth !== undefined ? { maxWidth: menuPos.maxWidth } : {}),
            ...(menuPos.top !== undefined ? { top: menuPos.top } : {}),
            ...(menuPos.bottom !== undefined ? { bottom: menuPos.bottom } : {}),
          }}
        >
          {showSearch && (
            <div className="cs-search-wrap">
              <input
                ref={searchRef}
                className="cs-search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => {
                  e.stopPropagation();
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    if (query) setQuery('');
                    else setOpen(false);
                    return;
                  }
                  if (e.key !== 'Enter') return;
                  e.preventDefault();
                  const first = visibleFlat.find(o => !o.disabled);
                  if (first) handleSelect(first.value);
                }}
                placeholder="Filter…"
                aria-label="Filter options"
                data-testid={testId ? `${testId}-search` : 'cs-search'}
              />
            </div>
          )}
          {visibleFlat.length === 0 ? (
            <div className="cs-empty" data-testid="cs-empty">No matching options</div>
          ) : isGroupedSelectItems(visibleItems)
            ? visibleItems.map(g => (
                <div
                  key={g.label}
                  className={`cs-group${g.options.some(o => o.value === value) ? ' cs-group--selected' : ''}`}
                >
                  <div className="cs-group-label">{g.label}</div>
                  {g.options.map(renderOption)}
                </div>
              ))
            : visibleItems.map(renderOption)
          }
        </div>,
        document.body
      )}
    </div>
  );
}
