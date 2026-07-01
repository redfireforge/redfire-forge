import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GrpcFieldSchema, GrpcMessageSchema } from '../../../shared/grpc/contracts';
import { buildGrpcMessageSchemaIndex, findWideIntegralJsonViolations, resolveNestedMessageSchema } from '../utils/grpcBodyComposer';
import {
  coerceGrpcFieldValue,
  defaultValueForGrpcField,
  groupMessageFields,
  GRPC_MAP_PENDING_KEY_PREFIX,
  isGrpcMapPendingKey,
  isGrpcWellKnownFieldType,
  isGrpcWrapperWkt,
  isValidWideIntegralString,
  isWideIntegralFieldType,
  resolveActiveOneofMember,
  setGrpcBodyField,
  setGrpcOneofMember,
  wktFieldBadgeLabel,
} from '../utils/grpcProtoFormValues';

export interface GrpcProtoFormBuilderProps {
  schema: GrpcMessageSchema;
  messageTypes?: GrpcMessageSchema[];
  body: Record<string, unknown>;
  onChange: (body: Record<string, unknown>) => void;
  onValidityChange?: (valid: boolean) => void;
  disabled?: boolean;
}

function fieldTypeBadgeLabel(field: GrpcFieldSchema): string {
  if (field.isMap) {
    const keyType = field.mapKeyType ?? 'string';
    if (field.type === 'message' && field.messageTypeName) {
      return `map<${keyType}, ${field.messageTypeName}>`;
    }
    if (field.type === 'enum' && field.enumTypeName) {
      return `map<${keyType}, ${field.enumTypeName}>`;
    }
    return `map<${keyType}, ${field.type}>`;
  }
  if (field.label === 'repeated') {
    return `repeated ${field.type}`;
  }
  if (field.type === 'enum' && field.enumTypeName) {
    return 'enum';
  }
  if (isGrpcWellKnownFieldType(field.type)) {
    return wktFieldBadgeLabel(field.type);
  }
  return field.type;
}

function fieldNoteLabel(field: GrpcFieldSchema): string {
  return `#${field.number} ${field.label}`;
}

function isNumericScalarField(field: GrpcFieldSchema): boolean {
  if (isWideIntegralFieldType(field.type)) {
    return false;
  }
  return field.type !== 'string'
    && field.type !== 'bytes'
    && field.type !== 'bool'
    && field.type !== 'enum'
    && field.type !== 'message';
}

function isWideIntegralScalarField(field: GrpcFieldSchema): boolean {
  return isWideIntegralFieldType(field.type);
}

export function GrpcProtoFormBuilder({
  schema,
  messageTypes,
  body,
  onChange,
  onValidityChange,
  disabled = false,
}: GrpcProtoFormBuilderProps) {
  const messageIndex = useMemo(
    () => buildGrpcMessageSchemaIndex(messageTypes),
    [messageTypes],
  );
  const { regular, oneofGroups } = groupMessageFields(schema.fields);
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setFieldErrors({});
  }, [schema.typeName]);

  const reportFieldError = useCallback((fieldKey: string, hasError: boolean) => {
    setFieldErrors((previous) => {
      if (hasError) {
        if (previous[fieldKey]) return previous;
        return { ...previous, [fieldKey]: true };
      }
      if (!previous[fieldKey]) return previous;
      const next = { ...previous };
      delete next[fieldKey];
      return next;
    });
  }, []);

  useEffect(() => {
    onValidityChange?.(Object.keys(fieldErrors).length === 0);
  }, [fieldErrors, onValidityChange, schema.typeName]);

  const updateField = (field: GrpcFieldSchema, raw: unknown) => {
    onChange(setGrpcBodyField(body, field.name, coerceGrpcFieldValue(field, raw)));
  };

  const updateOneofMember = (members: GrpcFieldSchema[], member: GrpcFieldSchema, raw: unknown) => {
    setFieldErrors((previous) => {
      let changed = false;
      const next = { ...previous };
      for (const sibling of members) {
        if (next[sibling.name]) {
          delete next[sibling.name];
          changed = true;
        }
      }
      return changed ? next : previous;
    });
    onChange(setGrpcOneofMember(
      body,
      members,
      member.name,
      coerceGrpcFieldValue(member, raw),
    ));
  };

  if (regular.length === 0 && oneofGroups.size === 0) {
    return (
      <p className="grpc-proto-form-empty" data-testid="grpc-proto-form-empty">
        No request fields in schema.
      </p>
    );
  }

  return (
    <div className="grpc-proto-form" data-testid="grpc-proto-form">
      {regular.map((field) => (
        <GrpcProtoFieldRow
          key={field.name}
          field={field}
          value={body[field.name]}
          disabled={disabled}
          messageIndex={messageIndex}
          onChange={(raw) => updateField(field, raw)}
          onFieldError={(hasError) => reportFieldError(field.name, hasError)}
        />
      ))}
      {[...oneofGroups.entries()].map(([oneofName, members]) => (
        <OneofGroupRow
          key={oneofName}
          oneofName={oneofName}
          members={members}
          body={body}
          disabled={disabled}
          messageIndex={messageIndex}
          onSelectMember={(member, raw) => updateOneofMember(members, member, raw)}
          onFieldError={reportFieldError}
        />
      ))}
    </div>
  );
}

interface GrpcProtoFieldRowProps {
  field: GrpcFieldSchema;
  value: unknown;
  disabled?: boolean;
  messageIndex?: Map<string, GrpcMessageSchema>;
  onChange: (value: unknown) => void;
  onFieldError?: (hasError: boolean) => void;
  fieldErrorKey?: string;
  inputTestId?: string;
}

function GrpcProtoFieldRow({
  field,
  value,
  disabled,
  messageIndex,
  onChange,
  onFieldError,
  fieldErrorKey,
}: GrpcProtoFieldRowProps) {
  if (field.isMap) {
    return (
      <MapFieldRow
        field={field}
        value={value}
        disabled={disabled}
        messageIndex={messageIndex}
        onChange={onChange}
        onFieldError={onFieldError}
      />
    );
  }

  if (field.label === 'repeated') {
    return (
      <RepeatedFieldRow
        field={field}
        value={value}
        disabled={disabled}
        messageIndex={messageIndex}
        onChange={onChange}
        onFieldError={onFieldError}
        fieldErrorKey={fieldErrorKey ?? field.name}
      />
    );
  }

  if (field.type === 'message') {
    return (
      <NestedMessageFieldRow
        field={field}
        value={value}
        disabled={disabled}
        messageSchema={resolveNestedMessageSchema(field, messageIndex)}
        messageIndex={messageIndex}
        onChange={onChange}
        onFieldError={onFieldError}
      />
    );
  }

  if (field.type === 'google.protobuf.Any') {
    return (
      <AnyFieldRow
        field={field}
        value={value}
        disabled={disabled}
        onChange={onChange}
        onFieldError={onFieldError}
      />
    );
  }

  if (isGrpcWellKnownFieldType(field.type)
    && (field.type === 'google.protobuf.Struct'
      || field.type === 'google.protobuf.Value')) {
    return (
      <WktJsonFieldRow
        field={field}
        value={value}
        disabled={disabled}
        onChange={onChange}
        onFieldError={onFieldError}
      />
    );
  }

  if (isGrpcWellKnownFieldType(field.type)) {
    return (
      <WktScalarFieldRow
        field={field}
        value={value}
        disabled={disabled}
        onChange={onChange}
        onFieldError={onFieldError}
      />
    );
  }

  return (
    <div className="grpc-proto-field-row" data-testid={`grpc-proto-field-${field.name}`}>
      <div className="grpc-proto-field-name">
        {field.name}
        <span className={`grpc-proto-type-badge grpc-proto-type-badge--${field.type}`}>
          {fieldTypeBadgeLabel(field)}
        </span>
      </div>
      <div className="grpc-proto-field-control">
        <ScalarFieldControl
          field={field}
          value={value}
          disabled={disabled}
          onChange={onChange}
          onFieldError={onFieldError}
        />
      </div>
      {fieldNoteLabel(field) ? (
        <span className="grpc-proto-field-note">{fieldNoteLabel(field)}</span>
      ) : null}
    </div>
  );
}

function WktScalarFieldRow({
  field,
  value,
  disabled,
  onChange,
  onFieldError,
}: GrpcProtoFieldRowProps) {
  const isTimestamp = field.type === 'google.protobuf.Timestamp';
  const isDuration = field.type === 'google.protobuf.Duration';
  const isInt64Wrapper = field.type === 'google.protobuf.Int64Value';
  const wrapper = isGrpcWrapperWkt(field.type);
  const displayValue = wrapper
    ? String((value as { value?: unknown } | undefined)?.value ?? '')
    : String(value ?? '');

  const reportInt64WrapperValidity = (raw: string) => {
    if (!isInt64Wrapper || !onFieldError) return;
    onFieldError(!isValidWideIntegralString(raw, 'int64'));
  };

  const handleChange = (raw: string) => {
    if (wrapper) {
      if (field.type === 'google.protobuf.BoolValue') {
        onChange({ value: raw === 'true' });
        return;
      }
      if (field.type === 'google.protobuf.Int32Value') {
        const num = Number(raw);
        onChange({ value: Number.isFinite(num) ? num : 0 });
        return;
      }
      if (field.type === 'google.protobuf.Int64Value') {
        reportInt64WrapperValidity(raw);
        onChange({ value: raw.trim() === '' ? '0' : raw.trim() });
        return;
      }
      onChange({ value: raw });
      return;
    }
    onChange(raw);
  };

  useEffect(() => {
    if (isInt64Wrapper) {
      reportInt64WrapperValidity(displayValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- validate when wrapper value changes
  }, [displayValue, isInt64Wrapper]);

  return (
    <div className="grpc-proto-field-row" data-testid={`grpc-proto-field-${field.name}`}>
      <div className="grpc-proto-field-name">
        {field.name}
        <span className={`grpc-proto-type-badge grpc-proto-type-badge--wkt grpc-proto-type-badge--${field.type.replace(/\./g, '-')}`}>
          {fieldTypeBadgeLabel(field)}
        </span>
      </div>
      <div className="grpc-proto-field-control">
        {field.type === 'google.protobuf.BoolValue' ? (
          <select
            className="grpc-proto-input"
            data-testid={`grpc-proto-field-input-${field.name}`}
            value={displayValue === 'true' ? 'true' : 'false'}
            disabled={disabled}
            onChange={(event) => handleChange(event.target.value)}
          >
            <option value="false">false</option>
            <option value="true">true</option>
          </select>
        ) : (
          <input
            type="text"
            className="grpc-proto-input"
            data-testid={`grpc-proto-field-input-${field.name}`}
            value={displayValue}
            placeholder={
              isTimestamp
                ? 'RFC3339 / ISO8601'
                : isDuration
                  ? 'e.g. 1.5s'
                  : isInt64Wrapper
                    ? 'Decimal string (preserves 64-bit precision)'
                    : `Enter ${field.name}…`
            }
            disabled={disabled}
            onChange={(event) => handleChange(event.target.value)}
          />
        )}
      </div>
      <span className="grpc-proto-field-note">{fieldNoteLabel(field)} WKT</span>
    </div>
  );
}

function AnyFieldRow({
  field,
  value,
  disabled,
  onChange,
  onFieldError,
}: GrpcProtoFieldRowProps) {
  return (
    <div className="grpc-proto-field-row grpc-proto-field-row--nested" data-testid={`grpc-proto-field-${field.name}`}>
      <div className="grpc-proto-field-header">
        <div className="grpc-proto-field-name">
          {field.name}
          <span className="grpc-proto-type-badge grpc-proto-type-badge--wkt">
            {fieldTypeBadgeLabel(field)}
          </span>
        </div>
        <span className="grpc-proto-field-note">{fieldNoteLabel(field)} WKT</span>
      </div>
      <p className="grpc-proto-any-hint" data-testid="grpc-proto-any-hint">
        Pack as JSON with <code>@type</code> (e.g. <code>type.googleapis.com/package.MessageName</code>) plus message fields.
      </p>
      <ProtoJsonObjectEditor
        testId={`grpc-proto-field-input-${field.name}`}
        value={value}
        disabled={disabled}
        onChange={onChange}
        onErrorChange={onFieldError}
        rows={5}
        placeholder={'{\n  "@type": "type.googleapis.com/package.MessageName",\n  "field": "value"\n}'}
      />
    </div>
  );
}

function WktJsonFieldRow({
  field,
  value,
  disabled,
  onChange,
  onFieldError,
}: GrpcProtoFieldRowProps) {
  return (
    <div className="grpc-proto-field-row grpc-proto-field-row--nested" data-testid={`grpc-proto-field-${field.name}`}>
      <div className="grpc-proto-field-header">
        <div className="grpc-proto-field-name">
          {field.name}
          <span className="grpc-proto-type-badge grpc-proto-type-badge--wkt">
            {fieldTypeBadgeLabel(field)}
          </span>
        </div>
        <span className="grpc-proto-field-note">{fieldNoteLabel(field)} WKT</span>
      </div>
      <ProtoJsonObjectEditor
        testId={`grpc-proto-field-input-${field.name}`}
        value={value}
        disabled={disabled}
        onChange={onChange}
        onErrorChange={onFieldError}
        rows={4}
      />
    </div>
  );
}

function NestedMessageFieldRow({
  field,
  value,
  disabled,
  messageSchema,
  messageIndex,
  onChange,
  onFieldError,
}: GrpcProtoFieldRowProps & { messageSchema?: GrpcMessageSchema }) {
  return (
    <div className="grpc-proto-field-row grpc-proto-field-row--nested" data-testid={`grpc-proto-field-${field.name}`}>
      <div className="grpc-proto-field-header">
        <div className="grpc-proto-field-name">
          {field.name}
          <span className="grpc-proto-type-badge grpc-proto-type-badge--message">
            {field.messageTypeName ?? 'message'}
          </span>
        </div>
        <span className="grpc-proto-field-note">{fieldNoteLabel(field)}</span>
      </div>
      <ProtoJsonObjectEditor
        testId={`grpc-proto-field-input-${field.name}`}
        value={value}
        disabled={disabled}
        messageSchema={messageSchema}
        messageIndex={messageIndex}
        onChange={onChange}
        onErrorChange={onFieldError}
        rows={4}
      />
    </div>
  );
}

interface ProtoJsonObjectEditorProps {
  testId: string;
  value: unknown;
  disabled?: boolean;
  messageSchema?: GrpcMessageSchema;
  messageIndex?: Map<string, GrpcMessageSchema>;
  onChange: (value: Record<string, unknown>) => void;
  onErrorChange?: (hasError: boolean) => void;
  rows?: number;
  placeholder?: string;
}

function ProtoJsonObjectEditor({
  testId,
  value,
  disabled,
  messageSchema,
  messageIndex,
  onChange,
  onErrorChange,
  rows = 4,
  placeholder,
}: ProtoJsonObjectEditorProps) {
  const [draft, setDraft] = useState(() => JSON.stringify(value ?? {}, null, 2));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(JSON.stringify(value ?? {}, null, 2));
    setError(null);
    onErrorChange?.(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset draft when canonical value changes
  }, [value]);

  const handleChange = (text: string) => {
    setDraft(text);
    try {
      const parsed = JSON.parse(text) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        const message = 'Nested message must be a JSON object';
        setError(message);
        onErrorChange?.(true);
        return;
      }
      if (messageSchema) {
        const wideIntegralViolation = findWideIntegralJsonViolations(
          parsed as Record<string, unknown>,
          messageSchema,
          messageIndex,
        );
        if (wideIntegralViolation) {
          setError(wideIntegralViolation);
          onErrorChange?.(true);
          return;
        }
      }
      setError(null);
      onErrorChange?.(false);
      onChange(parsed as Record<string, unknown>);
    } catch (parseError) {
      const message = parseError instanceof Error ? parseError.message : 'Invalid JSON';
      setError(message);
      onErrorChange?.(true);
    }
  };

  return (
    <>
      <textarea
        className="grpc-proto-nested-json"
        data-testid={testId}
        value={draft}
        placeholder={placeholder}
        onChange={(event) => handleChange(event.target.value)}
        disabled={disabled}
        spellCheck={false}
        rows={rows}
      />
      {error && (
        <p className="grpc-proto-nested-error" data-testid={`${testId}-error`} role="alert">
          {error}
        </p>
      )}
    </>
  );
}

function ScalarFieldControl({
  field,
  value,
  disabled,
  onChange,
  onFieldError,
  inputTestId,
}: GrpcProtoFieldRowProps) {
  const controlTestId = inputTestId ?? `grpc-proto-field-input-${field.name}`;
  const numericField = isNumericScalarField(field);
  const wideIntegralField = isWideIntegralScalarField(field);
  const [numericDraft, setNumericDraft] = useState<string | null>(null);

  useEffect(() => {
    setNumericDraft(null);
  }, [field.name, field.type]);

  const reportNumericValidity = useCallback((raw: string | null) => {
    if (wideIntegralField) {
      if (!onFieldError) return;
      if (raw === null) {
        onFieldError(!isValidWideIntegralString(String(value ?? ''), field.type));
        return;
      }
      onFieldError(!isValidWideIntegralString(raw, field.type));
      return;
    }
    if (!numericField || !onFieldError) return;
    if (raw === null) {
      onFieldError(typeof value === 'number' && !Number.isFinite(value));
      return;
    }
    if (raw === '') {
      onFieldError(false);
      return;
    }
    onFieldError(!Number.isFinite(Number(raw)));
  }, [field.type, numericField, onFieldError, value, wideIntegralField]);

  useEffect(() => {
    reportNumericValidity(numericDraft);
  }, [numericDraft, reportNumericValidity]);

  if (field.type === 'bool') {
    return (
      <select
        className="grpc-proto-input"
        data-testid={controlTestId}
        value={value === true ? 'true' : 'false'}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value === 'true')}
      >
        <option value="false">false</option>
        <option value="true">true</option>
      </select>
    );
  }

  if (field.type === 'enum' && field.enumValues?.length) {
    return (
      <select
        className="grpc-proto-input"
        data-testid={controlTestId}
        value={String(value ?? field.enumValues[0]!.number)}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {field.enumValues.map((entry) => (
          <option key={entry.number} value={entry.number}>{entry.name}</option>
        ))}
      </select>
    );
  }

  const inputMode = wideIntegralField || numericField ? 'decimal' : undefined;
  const displayValue = (wideIntegralField || numericField) && numericDraft !== null
    ? numericDraft
    : (value == null ? '' : String(value));

  return (
    <input
      type="text"
      inputMode={inputMode}
      className="grpc-proto-input"
      data-testid={controlTestId}
      value={displayValue}
      placeholder={
        wideIntegralField
          ? 'Decimal string (preserves 64-bit precision)'
          : field.type === 'bytes'
            ? 'base64 or text'
            : field.type === 'string'
              ? `Enter ${field.name}…`
              : field.type
      }
      disabled={disabled}
      onChange={(event) => {
        if (wideIntegralField) {
          const raw = event.target.value;
          setNumericDraft(raw);
          reportNumericValidity(raw);
          if (raw === '') {
            onChange('0');
            return;
          }
          if (isValidWideIntegralString(raw, field.type)) {
            setNumericDraft(null);
            onChange(raw.trim());
          }
          return;
        }
        if (numericField) {
          const raw = event.target.value;
          setNumericDraft(raw);
          reportNumericValidity(raw);
          if (raw === '') {
            onChange(0);
            return;
          }
          const parsed = Number(raw);
          if (Number.isFinite(parsed)) {
            setNumericDraft(null);
            onChange(parsed);
          }
          return;
        }
        onChange(event.target.value);
      }}
    />
  );
}

function RepeatedFieldRow({
  field,
  value,
  disabled,
  messageIndex,
  onChange,
  onFieldError,
  fieldErrorKey,
}: GrpcProtoFieldRowProps) {
  const items = Array.isArray(value) ? value : [];
  const scalarField: GrpcFieldSchema = { ...field, label: 'optional' };
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
              <ProtoJsonObjectEditor
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
              <ScalarFieldControl
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

function MapFieldRow({
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
  const valueField: GrpcFieldSchema = { ...field, isMap: false, label: 'optional' };
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
      const storageKey = trimmedKey
        || (isGrpcMapPendingKey(entryKey)
          ? entryKey
          : `${GRPC_MAP_PENDING_KEY_PREFIX}${Date.now()}_${index}`);
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
            <ScalarFieldControl
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

interface OneofGroupRowProps {
  oneofName: string;
  members: GrpcFieldSchema[];
  body: Record<string, unknown>;
  disabled?: boolean;
  messageIndex?: Map<string, GrpcMessageSchema>;
  onSelectMember: (member: GrpcFieldSchema, raw: unknown) => void;
  onFieldError: (fieldKey: string, hasError: boolean) => void;
}

function OneofGroupRow({
  oneofName,
  members,
  body,
  disabled,
  messageIndex,
  onSelectMember,
  onFieldError,
}: OneofGroupRowProps) {
  const activeName = resolveActiveOneofMember(members, body) ?? members[0]?.name ?? '';
  const activeMember = members.find((member) => member.name === activeName) ?? members[0];

  const handleMemberChange = (nextMemberName: string) => {
    const nextMember = members.find((member) => member.name === nextMemberName);
    if (!nextMember) return;
    onSelectMember(nextMember, defaultValueForGrpcField(nextMember));
  };

  if (!activeMember) {
    return null;
  }

  return (
    <div
      className="grpc-proto-field-row grpc-proto-field-row--oneof"
      data-testid={`grpc-proto-oneof-${oneofName}`}
    >
      <div className="grpc-proto-field-header">
        <div className="grpc-proto-field-name">
          {oneofName}
          <span className="grpc-proto-type-badge grpc-proto-type-badge--oneof">oneof</span>
        </div>
      </div>
      <div className="grpc-proto-oneof-controls">
        <div className="grpc-proto-oneof-radio-row" role="radiogroup" aria-label={`${oneofName} oneof`}>
          {members.map((member) => (
            <button
              key={member.name}
              type="button"
              role="radio"
              aria-checked={activeMember.name === member.name}
              className={`grpc-proto-oneof-radio${activeMember.name === member.name ? ' grpc-proto-oneof-radio--active' : ''}`}
              data-testid={`grpc-proto-oneof-radio-${oneofName}-${member.name}`}
              disabled={disabled}
              onClick={() => handleMemberChange(member.name)}
            >
              {member.name}
            </button>
          ))}
        </div>
        <label className="grpc-proto-oneof-label visually-hidden" htmlFor={`grpc-proto-oneof-select-${oneofName}`}>
          Active field
        </label>
        <select
          id={`grpc-proto-oneof-select-${oneofName}`}
          className="grpc-proto-oneof-select visually-hidden"
          data-testid={`grpc-proto-oneof-select-${oneofName}`}
          value={activeMember.name}
          disabled={disabled}
          onChange={(event) => handleMemberChange(event.target.value)}
          tabIndex={-1}
          aria-hidden="true"
        >
          {members.map((member) => (
            <option key={member.name} value={member.name}>
              {member.name}
            </option>
          ))}
        </select>
      </div>
      <GrpcProtoFieldRow
        key={activeMember.name}
        field={activeMember}
        value={body[activeMember.name]}
        disabled={disabled}
        messageIndex={messageIndex}
        onChange={(raw) => onSelectMember(activeMember, raw)}
        onFieldError={(hasError) => onFieldError(activeMember.name, hasError)}
        fieldErrorKey={`${oneofName}.${activeMember.name}`}
      />
    </div>
  );
}
