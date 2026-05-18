import { useEffect, useRef } from 'react';

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

  useEffect(() => {
    if (isCreating && newInputRef.current) newInputRef.current.focus();
  }, [isCreating]);

  return (
    <div className="send-harness-cascade-field">
      <label className="send-harness-cascade-label">{label}</label>
      {settingsHint && options.length === 0 ? (
        <div className="send-harness-settings-hint">
          <span className="send-harness-settings-hint-icon">&#9432;</span>
          <span>{settingsHint}</span>
        </div>
      ) : (
        <>
          <select
            className="send-harness-cascade-select"
            value={value}
            onChange={e => onChange(e.target.value)}
          >
            <option value="">{placeholder}</option>
            {options.map(o => (
              <option key={o.id} value={o.id}>
                {o.name}{o.detail ? ` (${o.detail})` : ''}
              </option>
            ))}
            {onCreate && <option value="__new__">+ Create New</option>}
          </select>
          {isCreating && onNewValueChange && (
            <input
              ref={newInputRef}
              className="send-harness-cascade-input"
              placeholder={`New ${label.toLowerCase()} name...`}
              value={newValue ?? ''}
              onChange={e => onNewValueChange(e.target.value)}
            />
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
