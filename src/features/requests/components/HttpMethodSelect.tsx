import { useState, useRef, useEffect, useCallback } from 'react';
import type { HttpMethod } from '@shared/types';
import { METHOD_COLORS, METHOD_DESCRIPTIONS } from '@shared/constants/httpMethodColors';

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

interface Props {
  value: HttpMethod;
  onChange: (method: HttpMethod) => void;
}

export function HttpMethodSelect({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleToggle = useCallback(() => setOpen(o => !o), []);

  const handleSelect = useCallback((m: HttpMethod) => {
    onChange(m);
    setOpen(false);
  }, [onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') setOpen(false);
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen(o => !o);
    }
    if (open) {
      const idx = METHODS.indexOf(value);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = METHODS[(idx + 1) % METHODS.length];
        onChange(next);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = METHODS[(idx - 1 + METHODS.length) % METHODS.length];
        onChange(prev);
      }
    }
  }, [open, value, onChange]);

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

  useEffect(() => {
    if (!open || !dropdownRef.current) return;
    const rect = dropdownRef.current.getBoundingClientRect();
    if (rect.bottom > window.innerHeight - 8) {
      dropdownRef.current.style.top = 'auto';
      dropdownRef.current.style.bottom = '100%';
      dropdownRef.current.style.marginBottom = '4px';
    }
  }, [open]);

  const color = METHOD_COLORS[value] || '#94a3b8';

  return (
    <div
      className="req-method-select-wrapper"
      ref={wrapperRef}
      data-testid="req-method-select"
    >
      <button
        type="button"
        className="req-method-trigger"
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        style={{ color }}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="req-method-dot" style={{ background: color }} />
        <span className="req-method-label">{value}</span>
        <span className="req-method-chevron">{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className="req-method-dropdown" ref={dropdownRef} role="listbox">
          {METHODS.map((m) => {
            const mColor = METHOD_COLORS[m] || '#94a3b8';
            const isActive = m === value;
            return (
              <button
                key={m}
                type="button"
                role="option"
                aria-selected={isActive}
                className={`req-method-option ${isActive ? 'active' : ''}`}
                onClick={() => handleSelect(m)}
              >
                <span className="req-method-option-dot" style={{ background: mColor }} />
                <span className="req-method-option-label" style={{ color: mColor }}>
                  {m}
                </span>
                <span className="req-method-option-desc">
                  {METHOD_DESCRIPTIONS[m]}
                </span>
                {isActive && (
                  <span className="req-method-option-check">✓</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
