import { useEffect, useRef, useState } from 'react';
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
  const scalarField = { ...field, label: 'optional' as const };
  const nestedSchema = resolveNestedMessageSchema(field, messageIndex);
  const [itemErrors, setItemErrors] = useState<Record<number, boolean>>({});

  useEffect(() => {
    onFieldError?.(Object.values(itemErrors).some(Boolean));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- report when item error map changes
  }, [itemErrors]);

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
    onChange([...items, defaultValueForGrpcField(scalarField)]);
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

  return (
    <div className="grpc-proto-field-row grpc-proto-field-row--repeated" data-testid={`grpc-proto-field-${field.name}`}>
      <div className="grpc-proto-field-header">
        <div className="grpc-proto-field-name">
          {field.name}
          <span className="grpc-proto-type-badge grpc-proto-type-badge--repeated">
            {fieldTypeBadgeLabel(field)}
          </span>
        </div>
        <span className="grpc-proto-field-note">{fieldNoteLabel(field)}</span>
      </div>
      <div className="grpc-proto-repeated-list">
        {items.map((item, index) => (
          <div className="grpc-proto-repeated-item" key={`${field.name}-${index}`}>
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
        ))}
        <button
          type="button"
          className="grpc-proto-repeated-add"
          disabled={disabled}
          onClick={addItem}
        >
          + Add item
        </button>
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
        <span className="grpc-proto-field-note">{fieldNoteLabel(field)}</span>
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
        <button
          type="button"
          className="grpc-proto-repeated-add"
          disabled={disabled}
          onClick={addEntry}
        >
          + Add entry
        </button>
      </div>
    </div>
  );
}
