import { useState, useCallback, useRef, useEffect } from 'react';
import { CustomSelect } from '../CustomSelect';
import type { TargetField, TargetFieldLocation } from './types';
import { extractDragPayload } from './utils/targetTreeHelpers';
const FIELD_TYPES = ['string', 'number', 'boolean', 'object', 'array'] as const;

interface AddFieldRowProps {
  existingPaths: Set<string>;
  onAdd: (field: TargetField) => void;
  location?: TargetFieldLocation;
  onDrop?: (targetPath: string, sourcePath: string, sourceId: string) => void;
  getDraggedSource?: () => { path: string; sourceId: string } | null;
}

export default function AddFieldRow({ existingPaths, onAdd, location, onDrop, getDraggedSource }: AddFieldRowProps) {
  const [editing, setEditing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [name, setName] = useState('');
  const [fieldType, setFieldType] = useState<string>('string');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const extractSource = useCallback(
    (e: React.DragEvent): { path: string; sourceId: string; type?: string } | null =>
      extractDragPayload(e) ?? getDraggedSource?.() ?? null,
    [getDraggedSource],
  );

  const createUniquePath = useCallback((basePath: string): string => {
    const segments = basePath.split('.');
    const base = segments[segments.length - 1] || 'field';
    if (!existingPaths.has(base)) return base;
    let index = 2;
    let candidate = `${base}_${index}`;
    while (existingPaths.has(candidate)) { index += 1; candidate = `${base}_${index}`; }
    return candidate;
  }, [existingPaths]);

  const handleRowDragOver = useCallback((e: React.DragEvent) => {
    if (!onDrop) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'link';
    setDragOver(true);
  }, [onDrop]);

  const handleRowDragLeave = useCallback(() => { setDragOver(false); }, []);

  const handleRowDrop = useCallback((e: React.DragEvent) => {
    setDragOver(false);
    if (!onDrop) return;
    const source = extractSource(e);
    if (!source) return;
    e.preventDefault();
    const targetPath = createUniquePath(source.path);
    onAdd({
      path: targetPath,
      label: targetPath.includes('.') ? targetPath.split('.').pop()! : targetPath,
      type: source.type ?? 'string',
      origin: 'custom',
      ...(location ? { location } : {}),
    });
    onDrop(targetPath, source.path, source.sourceId);
  }, [onDrop, extractSource, createUniquePath, onAdd, location]);

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
        className={`dm-add-field-btn${dragOver ? ' dm-add-field-btn--drag-over' : ''}`}
        onClick={() => setEditing(true)}
        onDragOver={handleRowDragOver}
        onDragEnter={handleRowDragOver}
        onDragLeave={handleRowDragLeave}
        onDrop={handleRowDrop}
        aria-label="Add custom field"
      >
        {dragOver ? 'Drop to create field & map' : '+ Add Field'}
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
      <CustomSelect
        className="dm-add-field-type"
        value={fieldType}
        onChange={setFieldType}
        options={FIELD_TYPES.map((t) => ({ value: t, label: t }))}
        aria-label="Field type"
      />
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
