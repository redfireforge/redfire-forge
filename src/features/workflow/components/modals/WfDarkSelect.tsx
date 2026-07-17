import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type WfDarkSelectOption = { value: string; label: string };

interface Props {
  value: string;
  options: WfDarkSelectOption[];
  onChange: (value: string) => void;
  'aria-label'?: string;
  className?: string;
  testId?: string;
}

type MenuCoords = { top: number; left: number; width: number };

/**
 * Dark-theme select for workflow modals.
 * Native &lt;select&gt; option menus stay system-styled on macOS (light popup);
 * this keeps both the trigger and the open list on design tokens.
 * Menu is portaled + fixed so it opens downward without modal overflow clipping.
 */
export default function WfDarkSelect({
  value,
  options,
  onChange,
  'aria-label': ariaLabel,
  className,
  testId = 'wf-dark-select',
}: Props) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<MenuCoords | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const selected = options.find((o) => o.value === value) ?? options[0];

  const updateCoords = () => {
    const trigger = rootRef.current?.querySelector<HTMLElement>('.wf-dark-select__trigger');
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    setCoords({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    });
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

  const menu =
    open && coords
      ? createPortal(
          <ul
            ref={menuRef}
            id={listId}
            className="wf-dark-select__menu wf-dark-select__menu--portal"
            role="listbox"
            aria-label={ariaLabel}
            style={{ top: coords.top, left: coords.left, width: coords.width }}
          >
            {options.map((opt) => {
              const isActive = opt.value === value;
              return (
                <li key={opt.value} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    className={`wf-dark-select__option${isActive ? ' is-active' : ''}`}
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                  >
                    <span className="wf-dark-select__check" aria-hidden>
                      {isActive ? '✓' : ''}
                    </span>
                    <span>{opt.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>,
          document.body,
        )
      : null;

  return (
    <div
      ref={rootRef}
      className={['wf-dark-select', className].filter(Boolean).join(' ')}
      data-testid={testId}
    >
      <button
        type="button"
        className="wf-dark-select__trigger wf-defaults-select"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="wf-dark-select__value">{selected?.label ?? ''}</span>
      </button>
      {menu}
    </div>
  );
}
