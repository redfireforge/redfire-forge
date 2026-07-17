import { useEffect, useState } from 'react';
import type { GrpcMessageSchema } from '../../../../shared/grpc/contracts';
import { findWideIntegralJsonViolations } from '../../utils/grpcBodyComposer';

export interface GrpcProtoJsonObjectEditorProps {
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

export function GrpcProtoJsonObjectEditor({
  testId,
  value,
  disabled,
  messageSchema,
  messageIndex,
  onChange,
  onErrorChange,
  rows = 4,
  placeholder,
}: GrpcProtoJsonObjectEditorProps) {
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

  const autoRows = Math.max(rows ?? 4, draft.split('\n').length + 1);

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
        rows={autoRows}
      />
      {error && (
        <p className="grpc-proto-nested-error" data-testid={`${testId}-error`} role="alert">
          {error}
        </p>
      )}
    </>
  );
}
