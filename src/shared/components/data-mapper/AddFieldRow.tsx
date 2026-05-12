import { useState, useCallback, useRef, useEffect } from 'react';
import type { TargetField, TargetFieldLocation } from './types';

const FIELD_TYPES = ['string', 'number', 'boolean', 'object', 'array'] as const;

interface AddFieldRowProps {
  existingPaths: Set<string>;
  onAdd: (field: TargetField) => void;
  location?: TargetFieldLocation;
}

export default function AddFieldRow({ existingPaths, onAdd, location }: AddFieldRowProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [fieldType, setFieldType] = useState<string>('string');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const handleSubmit = useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Field name cannot be empty');
      return;
    }
    if (/\s/.test(trimmed)) {
      setError('Field name cannot contain spaces');
      return;
    }
    if (existingPaths.has(trimmed)) {
      setError('Field already exists');
      return;
    }
    onAdd({
      path: trimmed,
      label: trimmed.includes('.') ? trimmed.split('.').pop()! : trimmed,
      type: fieldType,
      origin: 'custom',
      ...(location ? { location } : {}),
    });
    setName('');
    setFieldType('string');
    setError(null);
    setEditing(false);
  }, [name, fieldType, existingPaths, onAdd, location]);

  const handleCancel = useCallback(() => {
    setName('');
    setFieldType('string');
    setError(null);
    setEditing(false);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  }, [handleSubmit, handleCancel]);

  if (!editing) {
    return (
      <button
        className="dm-add-field-btn"
        onClick={() => setEditing(true)}
        aria-label="Add custom field"
      >
        + Add Field
      </button>
    );
  }

  return (
    <div className="dm-add-field-row" role="form" aria-label="Add custom field">
      <input
        ref={inputRef}
        className={`dm-add-field-input ${error ? 'dm-add-field-input--error' : ''}`}
        type="text"
        value={name}
        onChange={(e) => { setName(e.target.value); setError(null); }}
        onKeyDown={handleKeyDown}
        placeholder="field.name"
        aria-label="Field name"
        aria-invalid={!!error}
      />
      <select
        className="dm-add-field-type"
        value={fieldType}
        onChange={(e) => setFieldType(e.target.value)}
        aria-label="Field type"
      >
        {FIELD_TYPES.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
      <button className="dm-add-field-confirm" onClick={handleSubmit} aria-label="Confirm add field">
        ✓
      </button>
      <button className="dm-add-field-cancel" onClick={handleCancel} aria-label="Cancel add field">
        ✕
      </button>
      {error && <span className="dm-add-field-error" role="alert">{error}</span>}
    </div>
  );
}
