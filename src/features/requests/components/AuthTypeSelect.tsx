import { useState, useRef, useEffect, useCallback, useMemo } from 'react';

interface AuthOption {
  value: string;
  label: string;
  description: string;
  icon: string;
}

const AUTH_OPTIONS: AuthOption[] = [
  { value: 'inherit', label: 'Inherit from Collection', description: 'Use parent auth config', icon: '↩' },
  { value: 'none', label: 'No Auth', description: 'No authentication', icon: '⊘' },
  { value: 'bearer', label: 'Bearer Token', description: 'Authorization: Bearer <token>', icon: '🔑' },
  { value: 'basic', label: 'Basic Auth', description: 'Base64 username:password', icon: '🔒' },
  { value: 'apikey', label: 'API Key', description: 'Custom header or query param', icon: '🏷' },
  { value: 'oauth2', label: 'OAuth2 Client Credentials', description: 'Client ID + Secret flow', icon: '🎫' },
];

interface Props {
  value: string;
  onChange: (value: string) => void;
  showGlobalProfile?: boolean;
}

export function AuthTypeSelect({ value, onChange, showGlobalProfile }: Props) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const options = useMemo(() => (
    showGlobalProfile
      ? [
          AUTH_OPTIONS[0],
          AUTH_OPTIONS[1],
          { value: 'global-profile', label: 'Global Auth Profile', description: 'Shared across requests', icon: '🌐' },
          ...AUTH_OPTIONS.slice(2),
        ]
      : AUTH_OPTIONS
  ), [showGlobalProfile]);

  const current = options.find(o => o.value === value) ?? options[0];

  const handleSelect = useCallback((val: string) => {
    onChange(val);
    setOpen(false);
  }, [onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') setOpen(false);
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen(o => !o);
    }
    if (open) {
      const idx = options.findIndex(o => o.value === value);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = options[(idx + 1) % options.length];
        onChange(next.value);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = options[(idx - 1 + options.length) % options.length];
        onChange(prev.value);
      }
    }
  }, [open, value, onChange, options]);

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

  return (
    <div
      className="req-auth-type-wrapper"
      ref={wrapperRef}
      data-testid="req-auth-type-select"
    >
      <button
        type="button"
        className="req-auth-type-trigger"
        onClick={() => setOpen(o => !o)}
        onKeyDown={handleKeyDown}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="req-auth-type-icon">{current.icon}</span>
        <span className="req-auth-type-label">{current.label}</span>
        <span className="req-auth-type-chevron">{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className="req-auth-type-dropdown" ref={dropdownRef} role="listbox">
          {options.map((opt) => {
            const isActive = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isActive}
                className={`req-auth-type-option ${isActive ? 'active' : ''}`}
                onClick={() => handleSelect(opt.value)}
              >
                <span className="req-auth-type-option-icon">{opt.icon}</span>
                <div className="req-auth-type-option-text">
                  <span className="req-auth-type-option-label">{opt.label}</span>
                  <span className="req-auth-type-option-desc">{opt.description}</span>
                </div>
                {isActive && (
                  <span className="req-auth-type-option-check">✓</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
