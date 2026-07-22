import { useEffect, useRef, useState } from 'react';

export interface CascadeSelectProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (id: string) => void;
  options: { id: string; name: string; detail?: string }[];
  onCreate?: () => void;
  newValue?: string;
  onNewValueChange?: (v: string) => void;
  isCreating?: boolean;
  settingsHint?: string;
}

export function CascadeSelect({
  label,
  placeholder,
  value,
  onChange,
  options,
  onCreate,
  newValue,
  onNewValueChange,
  isCreating,
  settingsHint,
}: CascadeSelectProps) {
  const newInputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isCreating && newInputRef.current) newInputRef.current.focus();
  }, [isCreating]);

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

  const selectedOption = options.find(o => o.id === value);
  const displayText = selectedOption
    ? `${selectedOption.name}${selectedOption.detail ? ` (${selectedOption.detail})` : ''}`
    : placeholder;

  const handleSelect = (id: string) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <div className="send-harness-cascade-field" data-testid={`send-harness-cascade-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <label className="send-harness-cascade-label">{label}</label>
      {settingsHint && options.length === 0 ? (
        <div className="send-harness-settings-hint">
          <span className="send-harness-settings-hint-icon">&#9432;</span>
          <span>{settingsHint}</span>
        </div>
      ) : (
        <>
          {isCreating && onNewValueChange ? (
            <input
              ref={newInputRef}
              className="send-harness-cascade-input"
              placeholder={`New ${label.toLowerCase()} name...`}
              value={newValue ?? ''}
              onChange={e => onNewValueChange(e.target.value)}
            />
          ) : (
            <div className="cascade-dropdown-wrapper" ref={wrapperRef}>
              <button
                type="button"
                className={`cascade-dropdown-trigger${value ? '' : ' placeholder'}`}
                onClick={() => setOpen(o => !o)}
                aria-expanded={open}
                aria-haspopup="listbox"
                role="combobox"
              >
                <span className="cascade-dropdown-text">{displayText}</span>
                <span className="cascade-dropdown-arrow">{open ? '▲' : '▼'}</span>
              </button>
              {open && (
                <div className="cascade-dropdown-menu" role="listbox">
                  {options.map(o => (
                    <button
                      key={o.id}
                      type="button"
                      role="option"
                      aria-selected={value === o.id}
                      className={`cascade-dropdown-item${value === o.id ? ' active' : ''}`}
                      onClick={() => handleSelect(o.id)}
                    >
                      <span className="cascade-dropdown-item-name">{o.name}</span>
                      {o.detail && <span className="cascade-dropdown-item-detail">({o.detail})</span>}
                      {value === o.id && <span className="cascade-dropdown-check">✓</span>}
                    </button>
                  ))}
                  {onCreate && (
                    <button
                      type="button"
                      role="option"
                      aria-selected={false}
                      className="cascade-dropdown-item cascade-dropdown-create"
                      onClick={() => { onCreate(); setOpen(false); }}
                    >
                      + Create New
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
          {settingsHint && (
            <div className="send-harness-settings-hint-inline">
              <span className="send-harness-settings-hint-icon">&#9432;</span>
              <span>{settingsHint}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
