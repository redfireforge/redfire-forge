import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { resolveNestedMessageSchema } from '../../utils/grpcBodyComposer';
import {
  coerceGrpcFieldValue,
  defaultValueForGrpcField,
  GRPC_MAP_PENDING_KEY_PREFIX,
  isGrpcMapPendingKey,
} from '../../utils/grpcProtoFormValues';
import { fieldNoteLabel, fieldTypeBadgeLabel } from '../../utils/grpcProtoFormFieldLabels';
import { GrpcProtoJsonObjectEditor } from './GrpcProtoJsonObjectEditor';
import { GrpcProtoScalarFieldControl } from './GrpcProtoScalarFieldControl';
import type { GrpcProtoFieldRowProps } from './grpcProtoFormBuilderTypes';

export function GrpcProtoRepeatedFieldRow({
  field,
  value,
  disabled,
  messageIndex,
  onChange,
  onFieldError,
  fieldErrorKey,
}: GrpcProtoFieldRowProps) {
  const items = Array.isArray(value) ? value : [];
  const isMessageType = field.type === 'message';
  const isRepeatedString = !isMessageType && field.type === 'string';
  const scalarField = { ...field, label: 'optional' as const };
  const nestedSchema = resolveNestedMessageSchema(field, messageIndex);
  const [itemErrors, setItemErrors] = useState<Record<number, boolean>>({});
  const [tokenDraft, setTokenDraft] = useState('');
  const tokenInputRef = useRef<HTMLInputElement | null>(null);
  // collapsed: Set of item indices that are collapsed (default: all collapsed for message types)
  const [collapsed, setCollapsed] = useState<Set<number>>(() =>
    isMessageType ? new Set(items.map((_, i) => i)) : new Set<number>(),
  );

  // Keep collapsed set in sync when items are added/removed
  useEffect(() => {
    if (!isMessageType) return;
    setCollapsed((prev) => {
      const next = new Set<number>();
      for (let i = 0; i < items.length; i++) {
        if (prev.has(i)) next.add(i);
      }
      return next;
    });
     
  }, [items.length, isMessageType]);

  useEffect(() => {
    onFieldError?.(Object.values(itemErrors).some(Boolean));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- report when item error map changes
  }, [itemErrors]);

  const allCollapsed = isMessageType && items.length > 0 && collapsed.size === items.length;
  const allExpanded = isMessageType && items.length > 0 && collapsed.size === 0;

  const toggleItem = (index: number) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(index)) { next.delete(index); } else { next.add(index); }
      return next;
    });
  };

  const expandAll = () => setCollapsed(new Set());
  const collapseAll = () => setCollapsed(new Set(items.map((_, i) => i)));

  const updateItem = (index: number, nextValue: unknown) => {
    const next = [...items];
    next[index] = nextValue;
    onChange(next);
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
    setItemErrors((previous) => {
      const next: Record<number, boolean> = {};
      Object.entries(previous).forEach(([key, hasError]) => {
        const itemIndex = Number(key);
        if (itemIndex === index || !hasError) return;
        next[itemIndex > index ? itemIndex - 1 : itemIndex] = true;
      });
      return next;
    });
  };

  const addItem = () => {
    const newIndex = items.length;
    onChange([...items, defaultValueForGrpcField(scalarField)]);
    // Auto-expand the newly added item
    if (isMessageType) {
      setCollapsed((prev) => {
        const next = new Set(prev);
        next.delete(newIndex);
        return next;
      });
    }
  };

  const splitTokenValues = (raw: string): string[] => raw
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  const addTokenValues = (raw: string): boolean => {
    const nextValues = splitTokenValues(raw);
    if (nextValues.length === 0) {
      return false;
    }
    onChange([...items, ...nextValues]);
    return true;
  };

  const commitTokenDraft = () => {
    if (addTokenValues(tokenDraft)) {
      setTokenDraft('');
    }
  };

  const handleTokenKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      commitTokenDraft();
    }
  };

  const handleTokenPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData('text');
    if (!/[\n,]/.test(pasted)) {
      return;
    }
    event.preventDefault();
    if (addTokenValues(pasted)) {
      setTokenDraft('');
    }
  };

  const reportItemError = (index: number, hasError: boolean) => {
    setItemErrors((previous) => {
      if (hasError) {
        if (previous[index]) return previous;
        return { ...previous, [index]: true };
      }
      if (!previous[index]) return previous;
      const next = { ...previous };
      delete next[index];
      return next;
    });
  };

  // Build a short preview string for collapsed message items
  const getPreview = (item: unknown): string => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return '{}';
    const keys = Object.keys(item as Record<string, unknown>);
    if (keys.length === 0) return '{}';
    const first = keys[0];
    const firstVal = (item as Record<string, unknown>)[first];
    const preview = typeof firstVal === 'string' ? `"${firstVal}"` : String(firstVal);
    return keys.length === 1 ? `{ ${first}: ${preview} }` : `{ ${first}: ${preview}, +${keys.length - 1} }`;
  };

  return (
    <div className="grpc-proto-field-row grpc-proto-field-row--repeated" data-testid={`grpc-proto-field-${field.name}`}>
      <div className="grpc-proto-field-header">
        <div className="grpc-proto-field-name">
          {field.name}
          <span className="grpc-proto-type-badge grpc-proto-type-badge--repeated">
            {fieldTypeBadgeLabel(field)}
          </span>
        </div>
        <div className="grpc-proto-repeated-header-actions">
          {!isRepeatedString && (
            <button
              type="button"
              className="grpc-proto-repeated-add-inline"
              data-testid={`grpc-proto-repeated-add-${fieldErrorKey ?? field.name}`}
              disabled={disabled}
              onClick={addItem}
            >
              + Add item
            </button>
          )}
          {isMessageType && items.length > 0 && (
            <>
              {!allExpanded && (
                <button
                  type="button"
                  className="grpc-proto-repeated-toggle-all"
                  data-testid={`grpc-proto-repeated-expand-all-${field.name}`}
                  onClick={expandAll}
                >
                  Expand all
                </button>
              )}
              {!allCollapsed && (
                <button
                  type="button"
                  className="grpc-proto-repeated-toggle-all"
                  data-testid={`grpc-proto-repeated-collapse-all-${field.name}`}
                  onClick={collapseAll}
                >
                  Collapse all
                </button>
              )}
            </>
          )}
          <span className="grpc-proto-field-note">{fieldNoteLabel(field)}</span>
        </div>
      </div>
      <div className={`grpc-proto-repeated-list${isRepeatedString ? ' grpc-proto-repeated-list--tokens' : ''}`}>
        {isRepeatedString && (
          <>
            {items.map((item, index) => (
              <div
                className="grpc-proto-token"
                data-testid={`grpc-proto-field-input-${fieldErrorKey ?? field.name}-${index}`}
                key={`${field.name}-${index}`}
              >
                <span className="grpc-proto-token-text">{String(item ?? '') || '(empty)'}</span>
                <button
                  type="button"
                  className="grpc-proto-token-remove"
                  disabled={disabled}
                  aria-label={`Remove ${field.name} item ${index + 1}`}
                  onClick={() => removeItem(index)}
                >
                  ×
                </button>
              </div>
            ))}
            <div className="grpc-proto-token-input-wrap">
              <input
                ref={tokenInputRef}
                className="grpc-proto-token-input"
                data-testid={`grpc-proto-repeated-token-input-${fieldErrorKey ?? field.name}`}
                placeholder={`Enter ${field.name}...`}
                value={tokenDraft}
                disabled={disabled}
                onChange={(event) => setTokenDraft(event.target.value)}
                onKeyDown={handleTokenKeyDown}
                onPaste={handleTokenPaste}
                onBlur={commitTokenDraft}
              />
              <button
                type="button"
                className="grpc-proto-token-add"
                data-testid={`grpc-proto-repeated-add-${fieldErrorKey ?? field.name}`}
                disabled={disabled}
                onClick={() => {
                  if (tokenDraft.trim().length > 0) {
                    commitTokenDraft();
                    return;
                  }
                  tokenInputRef.current?.focus();
                }}
              >
                + Add item
              </button>
            </div>
          </>
        )}
        {!isRepeatedString && items.map((item, index) => {
          const isCollapsed = isMessageType && collapsed.has(index);
          return (
            <div
              className={`grpc-proto-repeated-item${isMessageType ? ' grpc-proto-repeated-item--message' : ''}${isCollapsed ? ' grpc-proto-repeated-item--collapsed' : ''}`}
              key={`${field.name}-${index}`}
            >
              {isMessageType && (
                <div className="grpc-proto-repeated-item-header">
                  <button
                    type="button"
                    className="grpc-proto-repeated-item-toggle"
                    aria-expanded={!isCollapsed}
                    data-testid={`grpc-proto-repeated-toggle-${field.name}-${index}`}
                    onClick={() => toggleItem(index)}
                  >
                    <span className="grpc-proto-repeated-item-chevron">{isCollapsed ? '▶' : '▼'}</span>
                    <span className="grpc-proto-repeated-item-label">Item {index + 1}</span>
                    {isCollapsed && (
                      <span className="grpc-proto-repeated-item-preview">{getPreview(item)}</span>
                    )}
                  </button>
                  <button
                    type="button"
                    className="grpc-proto-repeated-remove"
                    disabled={disabled}
                    aria-label={`Remove ${field.name} item ${index + 1}`}
                    onClick={() => removeItem(index)}
                  >
                    ×
                  </button>
                </div>
              )}
              {!isCollapsed && (
                <div className="grpc-proto-repeated-item-body">
                  {field.type === 'message' ? (
                    <GrpcProtoJsonObjectEditor
                      testId={`grpc-proto-field-input-${fieldErrorKey ?? field.name}-${index}`}
                      value={item}
                      disabled={disabled}
                      messageSchema={nestedSchema}
                      messageIndex={messageIndex}
                      onChange={(nextValue) => updateItem(index, nextValue)}
                      onErrorChange={(hasError) => reportItemError(index, hasError)}
                      rows={3}
                    />
                  ) : (
                    <GrpcProtoScalarFieldControl
                      field={scalarField}
                      value={item}
                      disabled={disabled}
                      onChange={(nextValue) => updateItem(index, nextValue)}
                      onFieldError={(hasError) => reportItemError(index, hasError)}
                      inputTestId={`grpc-proto-field-input-${fieldErrorKey ?? field.name}-${index}`}
                    />
                  )}
                </div>
              )}
              {!isMessageType && (
                <button
                  type="button"
                  className="grpc-proto-repeated-remove"
                  disabled={disabled}
                  aria-label={`Remove ${field.name} item ${index + 1}`}
                  onClick={() => removeItem(index)}
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function GrpcProtoMapFieldRow({
  field,
  value,
  disabled,
  onChange,
  onFieldError,
}: GrpcProtoFieldRowProps) {
  const mapValue = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const entries = Object.entries(mapValue);
  const valueField = { ...field, isMap: false, label: 'optional' as const };
  const [entryErrors, setEntryErrors] = useState<Record<number, boolean>>({});
  const pendingKeyCounterRef = useRef(0);

  useEffect(() => {
    onFieldError?.(Object.values(entryErrors).some(Boolean));
  }, [entryErrors, onFieldError]);

  const reportEntryError = (index: number, hasError: boolean) => {
    setEntryErrors((previous) => {
      if (hasError) {
        if (previous[index]) return previous;
        return { ...previous, [index]: true };
      }
      if (!previous[index]) return previous;
      const next = { ...previous };
      delete next[index];
      return next;
    });
  };

  const updateEntry = (index: number, keyInput: string, entryValue: unknown) => {
    const nextEntries = entries.map(([entryKey, entryVal], entryIndex) => {
      if (entryIndex !== index) return [entryKey, entryVal] as const;
      const trimmedKey = keyInput.trim();
      let storageKey = trimmedKey;
      if (!storageKey) {
        if (isGrpcMapPendingKey(entryKey)) {
          storageKey = entryKey;
        } else {
          pendingKeyCounterRef.current += 1;
          storageKey = `${GRPC_MAP_PENDING_KEY_PREFIX}${pendingKeyCounterRef.current}_${index}`;
        }
      }
      return [storageKey, entryValue] as const;
    });
    const next: Record<string, unknown> = {};
    for (const [entryKey, entryVal] of nextEntries) {
      if (isGrpcMapPendingKey(entryKey)) {
        next[entryKey] = coerceGrpcFieldValue(valueField, entryVal);
        continue;
      }
      if (!entryKey.trim()) continue;
      next[entryKey] = coerceGrpcFieldValue(valueField, entryVal);
    }
    onChange(next);
  };

  const removeEntry = (index: number) => {
    const nextEntries = entries.filter((_, i) => i !== index);
    onChange(Object.fromEntries(nextEntries));
    setEntryErrors((previous) => {
      const next: Record<number, boolean> = {};
      Object.entries(previous).forEach(([key, hasError]) => {
        const entryIndex = Number(key);
        if (entryIndex === index || !hasError) return;
        next[entryIndex > index ? entryIndex - 1 : entryIndex] = true;
      });
      return next;
    });
  };

  const addEntry = () => {
    pendingKeyCounterRef.current += 1;
    const pendingKey = `${GRPC_MAP_PENDING_KEY_PREFIX}${pendingKeyCounterRef.current}_${entries.length}`;
    onChange({
      ...mapValue,
      [pendingKey]: defaultValueForGrpcField(valueField),
    });
  };

  return (
    <div className="grpc-proto-field-row grpc-proto-field-row--map" data-testid={`grpc-proto-field-${field.name}`}>
      <div className="grpc-proto-field-header">
        <div className="grpc-proto-field-name">
          {field.name}
          <span className="grpc-proto-type-badge grpc-proto-type-badge--map">
            {fieldTypeBadgeLabel(field)}
          </span>
        </div>
        <div className="grpc-proto-map-header-actions">
          <button
            type="button"
            className="grpc-proto-map-add-inline"
            data-testid={`grpc-proto-map-add-${field.name}`}
            disabled={disabled}
            onClick={addEntry}
          >
            + Add entry
          </button>
          <span className="grpc-proto-field-note">{fieldNoteLabel(field)}</span>
        </div>
      </div>
      <div className="grpc-proto-map-list">
        {entries.map(([entryKey, entryValue], index) => (
          <div className="grpc-proto-map-item" key={`${field.name}-${index}`}>
            <input
              type="text"
              className="grpc-proto-input grpc-proto-map-key"
              data-testid={`grpc-proto-field-input-${field.name}-key-${index}`}
              value={isGrpcMapPendingKey(entryKey) ? '' : entryKey}
              placeholder="key"
              disabled={disabled}
              onChange={(event) => updateEntry(index, event.target.value, entryValue)}
            />
            <GrpcProtoScalarFieldControl
              field={valueField}
              value={entryValue}
              disabled={disabled}
              onChange={(nextValue) => updateEntry(index, entryKey, nextValue)}
              onFieldError={(hasError) => reportEntryError(index, hasError)}
              inputTestId={`grpc-proto-field-input-${field.name}-value-${index}`}
            />
            <button
              type="button"
              className="grpc-proto-repeated-remove"
              disabled={disabled}
              aria-label={`Remove ${field.name} entry ${index + 1}`}
              onClick={() => removeEntry(index)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
