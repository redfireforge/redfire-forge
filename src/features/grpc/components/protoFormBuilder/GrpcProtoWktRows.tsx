import { useEffect, useMemo } from 'react';
import type { GrpcMessageSchema } from '@shared/grpc/contracts';
import {
  isGrpcWrapperWkt,
  isValidWideIntegralString,
} from '../../utils/grpcProtoFormValues';
import {
  fieldNoteLabel,
  fieldTypeBadgeLabel,
  parseGrpcAnyTypeName,
  toGrpcAnyTypeUrl,
} from '../../utils/grpcProtoFormFieldLabels';
import { GrpcProtoJsonObjectEditor } from './GrpcProtoJsonObjectEditor';
import type { GrpcProtoFieldRowProps } from './grpcProtoFormBuilderTypes';
import { CustomSelect } from '@shared/components/CustomSelect';

export function GrpcProtoWktScalarFieldRow({
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
          <CustomSelect
            className="grpc-proto-input"
            data-testid={`grpc-proto-field-input-${field.name}`}
            value={displayValue === 'true' ? 'true' : 'false'}
            disabled={disabled}
            onChange={(v) => handleChange(v)}
            options={[
              { value: 'false', label: 'false' },
              { value: 'true', label: 'true' },
            ]}
          />
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

export function GrpcProtoAnyFieldRow({
  field,
  value,
  disabled,
  messageIndex,
  onChange,
  onFieldError,
}: GrpcProtoFieldRowProps) {
  const anyTypeOptions = useMemo(() => {
    if (!messageIndex || messageIndex.size === 0) {
      return [] as string[];
    }
    return [...messageIndex.keys()]
      .filter((typeName) => typeName !== 'google.protobuf.Any')
      .sort((left, right) => left.localeCompare(right));
  }, [messageIndex]);

  const selectedTypeName = useMemo(() => parseGrpcAnyTypeName(value), [value]);
  const selectedTypeSupported = selectedTypeName
    ? anyTypeOptions.includes(selectedTypeName)
    : false;

  const handleAnyTypeSelect = (nextTypeName: string) => {
    if (!nextTypeName.trim()) {
      return;
    }
    const nextValue = value && typeof value === 'object' && !Array.isArray(value)
      ? { ...(value as Record<string, unknown>) }
      : {};
    nextValue['@type'] = toGrpcAnyTypeUrl(nextTypeName);
    onChange(nextValue);
    onFieldError?.(false);
  };

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
      {anyTypeOptions.length > 0 && (
        <div className="grpc-proto-field-control">
          <label className="grpc-proto-field-note" htmlFor={`grpc-proto-any-type-${field.name}`}>
            Message type
          </label>
          <CustomSelect
            className="grpc-proto-input"
            data-testid={`grpc-proto-any-type-select-${field.name}`}
            value={selectedTypeSupported ? selectedTypeName : ''}
            disabled={disabled}
            placeholder="Select message type…"
            onChange={(v) => handleAnyTypeSelect(v)}
            options={[
              { value: '', label: 'Select message type…' },
              ...anyTypeOptions.map((typeName) => ({
                value: typeName,
                label: typeName,
              })),
            ]}
          />
          {selectedTypeName && !selectedTypeSupported && (
            <p
              className="grpc-proto-field-note"
              data-testid={`grpc-proto-any-type-unsupported-${field.name}`}
            >
              Current @type is custom: {selectedTypeName}
            </p>
          )}
        </div>
      )}
      <GrpcProtoJsonObjectEditor
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

export function GrpcProtoWktJsonFieldRow({
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
      <GrpcProtoJsonObjectEditor
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

export function GrpcProtoNestedMessageFieldRow({
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
      <GrpcProtoJsonObjectEditor
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
