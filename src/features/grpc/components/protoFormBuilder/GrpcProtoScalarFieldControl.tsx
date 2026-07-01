import { useCallback, useEffect, useState } from 'react';
import { isValidWideIntegralString } from '../../utils/grpcProtoFormValues';
import {
  isNumericScalarField,
  isWideIntegralScalarField,
} from '../../utils/grpcProtoFormFieldLabels';
import type { GrpcProtoFieldRowProps } from './grpcProtoFormBuilderTypes';

export function GrpcProtoScalarFieldControl({
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
