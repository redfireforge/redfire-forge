import { useEffect, useRef, useState } from 'react';
import { isValidWideIntegralString } from '../../utils/grpcProtoFormValues';
import {
  isNumericScalarField,
  isWideIntegralScalarField,
} from '../../utils/grpcProtoFormFieldLabels';
import type { GrpcProtoFieldRowProps } from './grpcProtoFormBuilderTypes';
import { CustomSelect } from '@shared/components/CustomSelect';

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
  const onFieldErrorRef = useRef(onFieldError);
  const lastReportedErrorRef = useRef<boolean | null>(null);

  onFieldErrorRef.current = onFieldError;

  useEffect(() => {
    setNumericDraft(null);
    lastReportedErrorRef.current = null;
  }, [field.name, field.type]);

  const reportNumericValidity = (raw: string | null) => {
    const report = onFieldErrorRef.current;
    if (!report) return;

    let hasError: boolean;
    if (wideIntegralField) {
      hasError = raw === null
        ? !isValidWideIntegralString(String(value ?? ''), field.type)
        : !isValidWideIntegralString(raw, field.type);
    } else if (numericField) {
      if (raw === null) {
        hasError = typeof value === 'number' && !Number.isFinite(value);
      } else if (raw === '') {
        hasError = false;
      } else {
        hasError = !Number.isFinite(Number(raw));
      }
    } else {
      return;
    }

    if (lastReportedErrorRef.current === hasError) return;
    lastReportedErrorRef.current = hasError;
    report(hasError);
  };

  useEffect(() => {
    reportNumericValidity(numericDraft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numericDraft, numericField, wideIntegralField, value, field.type]);

  if (field.type === 'bool') {
    return (
      <CustomSelect
        className="grpc-proto-input"
        data-testid={controlTestId}
        value={value === true ? 'true' : 'false'}
        disabled={disabled}
        onChange={(v) => onChange(v === 'true')}
        options={[
          { value: 'false', label: 'false' },
          { value: 'true', label: 'true' },
        ]}
      />
    );
  }

  if (field.type === 'enum' && field.enumValues?.length) {
    return (
      <CustomSelect
        className="grpc-proto-input"
        data-testid={controlTestId}
        value={String(value ?? field.enumValues[0]!.number)}
        disabled={disabled}
        onChange={(v) => onChange(Number(v))}
        options={field.enumValues.map((entry) => ({
          value: String(entry.number),
          label: entry.name,
        }))}
      />
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
