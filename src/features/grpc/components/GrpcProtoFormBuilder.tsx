import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GrpcFieldSchema, GrpcMessageSchema } from '../../../shared/grpc/contracts';
import { buildGrpcMessageSchemaIndex } from '../utils/grpcBodyComposer';
import {
  coerceGrpcFieldValue,
  groupMessageFields,
  setGrpcBodyField,
  setGrpcOneofMember,
} from '../utils/grpcProtoFormValues';
import { GrpcProtoFieldRow } from './protoFormBuilder/GrpcProtoFieldRow';
import { GrpcProtoOneofGroupRow } from './protoFormBuilder/GrpcProtoOneofGroupRow';

export interface GrpcProtoFormBuilderProps {
  schema: GrpcMessageSchema;
  messageTypes?: GrpcMessageSchema[];
  body: Record<string, unknown>;
  onChange: (body: Record<string, unknown>) => void;
  onValidityChange?: (valid: boolean) => void;
  disabled?: boolean;
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
  const bodyRef = useRef(body);
  bodyRef.current = body;

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

  const updateField = useCallback((field: GrpcFieldSchema, raw: unknown) => {
    const next = setGrpcBodyField(
      bodyRef.current,
      field.name,
      coerceGrpcFieldValue(field, raw),
    );
    bodyRef.current = next;
    onChange(next);
  }, [onChange]);

  const updateOneofMember = useCallback((
    members: GrpcFieldSchema[],
    member: GrpcFieldSchema,
    raw: unknown,
  ) => {
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
    const next = setGrpcOneofMember(
      bodyRef.current,
      members,
      member.name,
      coerceGrpcFieldValue(member, raw),
    );
    bodyRef.current = next;
    onChange(next);
  }, [onChange]);

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
        <GrpcProtoOneofGroupRow
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
