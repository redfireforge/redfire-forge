import { useEffect, useRef, useState, useCallback } from 'react';

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
  const menuRef = useRef<HTMLDivElement>(null);

  const testId = rest['data-testid'];
  const ariaLabel = rest['aria-label'];

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const [openUp, setOpenUp] = useState(false);

  useEffect(() => {
    if (!open || !wrapperRef.current) { setOpenUp(false); return; }
    const rect = wrapperRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    setOpenUp(spaceBelow < 200);
  }, [open]);

  useEffect(() => {
    if (!open || !menuRef.current) return;
    const active = menuRef.current.querySelector('.cs-item.active');
    if (active && typeof active.scrollIntoView === 'function') active.scrollIntoView({ block: 'nearest' });
  }, [open]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen(o => !o);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }, [disabled]);

  const flat = flattenItems(options);
  const selected = flat.find(o => o.value === value);
  const displayText = selected?.label ?? placeholder ?? '';
  const isPlaceholder = !selected;

  const handleSelect = (val: string) => {
    onChange(val);
    setOpen(false);
  };

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
    >
      <button
        type="button"
        className={`cs-trigger${isPlaceholder ? ' cs-placeholder' : ''}${disabled ? ' cs-disabled' : ''}`}
        onClick={() => { if (!disabled) setOpen(o => !o); }}
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
      {open && (
        <div className={`cs-menu${openUp ? ' cs-menu-up' : ''}`} role="listbox" ref={menuRef}>
          {isGrouped(options)
            ? options.map(g => (
                <div key={g.label} className="cs-group">
                  <div className="cs-group-label">{g.label}</div>
                  {g.options.map(renderOption)}
                </div>
              ))
            : options.map(renderOption)
          }
        </div>
      )}
    </div>
  );
}
