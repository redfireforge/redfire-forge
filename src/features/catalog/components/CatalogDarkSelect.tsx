import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface CatalogDarkSelectOption {
  value: string;
  label: string;
}

interface Props {
  value: string;
  options: CatalogDarkSelectOption[];
  onChange: (value: string) => void;
  id?: string;
  'aria-label'?: string;
  testId?: string;
}

type MenuCoords = { top: number; left: number; width: number };

/**
 * Dark-themed dropdown for the Catalog Edit modal.
 * Native <select> menus render with the OS light popup on macOS/Windows;
 * this keeps both the trigger and the open list on the app's design tokens.
 * Menu is portaled + fixed-positioned so it isn't clipped by the modal's
 * scrollable body.
 */
export default function CatalogDarkSelect({
  value,
  options,
  onChange,
  id,
  'aria-label': ariaLabel,
  testId = 'cat-dark-select',
}: Props) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<MenuCoords | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const selected = options.find(o => o.value === value) ?? options[0];

  const updateCoords = () => {
    const trigger = rootRef.current?.querySelector<HTMLElement>('.cat-dark-select__trigger');
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    setCoords({ top: rect.bottom + 4, left: rect.left, width: rect.width });
  };

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    updateCoords();
    const onReposition = () => updateCoords();
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const menu = open && coords
    ? createPortal(
      <ul
        ref={menuRef}
        className="cat-dark-select__menu"
        role="listbox"
        aria-label={ariaLabel}
        style={{ top: coords.top, left: coords.left, width: coords.width }}
      >
        {options.map(opt => {
          const isActive = opt.value === selected?.value;
          return (
            <li key={opt.value || '__none__'} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={isActive}
                className={`cat-dark-select__option${isActive ? ' is-active' : ''}`}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
              >
                <span className="cat-dark-select__check" aria-hidden="true">{isActive ? '✓' : ''}</span>
                <span className="cat-dark-select__option-label">{opt.label}</span>
              </button>
            </li>
          );
        })}
      </ul>,
      document.body,
    )
    : null;

  return (
    <div ref={rootRef} className="cat-dark-select" data-testid={testId}>
      <button
        type="button"
        id={id}
        className="cat-dark-select__trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
      >
        <span className="cat-dark-select__value">{selected?.label ?? ''}</span>
        <span className="cat-dark-select__chevron" aria-hidden="true">▾</span>
      </button>
      {menu}
    </div>
  );
}
