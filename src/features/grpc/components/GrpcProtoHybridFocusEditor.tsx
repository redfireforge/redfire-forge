import { useEffect, useMemo, useState } from 'react';
import type { Ref } from 'react';
import type { GrpcMessageSchema } from '@shared/grpc/contracts';
import { GrpcProtoFieldRow } from './protoFormBuilder/GrpcProtoFieldRow';
import { GrpcProtoOneofGroupRow } from './protoFormBuilder/GrpcProtoOneofGroupRow';
import { buildGrpcMessageSchemaIndex } from '../utils/grpcBodyComposer';
import {
  coerceGrpcFieldValue,
  groupMessageFields,
  setGrpcBodyField,
  setGrpcOneofMember,
} from '../utils/grpcProtoFormValues';

interface GrpcProtoHybridFocusEditorProps {
  schema: GrpcMessageSchema;
  body: Record<string, unknown>;
  selectedPath: string | null;
  messageTypes?: GrpcMessageSchema[];
  disabled?: boolean;
  bodyRef?: Ref<HTMLDivElement>;
  onPatchBody: (nextBody: Record<string, unknown>) => void;
  onValidityChange: (valid: boolean) => void;
}

export function GrpcProtoHybridFocusEditor({
  schema,
  body,
  selectedPath,
  messageTypes,
  disabled = false,
  bodyRef,
  onPatchBody,
  onValidityChange,
}: GrpcProtoHybridFocusEditorProps) {
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({});

  const messageIndex = useMemo(() => buildGrpcMessageSchemaIndex(messageTypes), [messageTypes]);
  const { regular, oneofGroups } = useMemo(() => groupMessageFields(schema.fields), [schema.fields]);
  const regularMap = useMemo(() => new Map(regular.map((field) => [field.name, field])), [regular]);

  useEffect(() => {
    setFieldErrors({});
  }, [selectedPath]);

  useEffect(() => {
    const hasInvalid = Object.values(fieldErrors).some(Boolean);
    onValidityChange(!hasInvalid);
  }, [fieldErrors, onValidityChange]);

  const onFieldError = (fieldName: string, hasError: boolean) => {
    setFieldErrors((current) => {
      if (current[fieldName] === hasError) {
        return current;
      }
      return {
        ...current,
        [fieldName]: hasError,
      };
    });
  };

  if (!selectedPath) {
    return (
      <section className="grpc-hybrid-focus" data-testid="grpc-hybrid-focus-editor">
        <div className="grpc-hybrid-focus__empty">Select a field from the navigator to edit.</div>
      </section>
    );
  }

  if (selectedPath.startsWith('field:')) {
    const fieldName = selectedPath.slice('field:'.length);
    const field = regularMap.get(fieldName);

    if (!field) {
      return (
        <section className="grpc-hybrid-focus" data-testid="grpc-hybrid-focus-editor">
          <div className="grpc-hybrid-focus__empty">Selected field is no longer available in this schema.</div>
        </section>
      );
    }

    return (
      <section className="grpc-hybrid-focus" data-testid="grpc-hybrid-focus-editor">
        <h4 className="grpc-hybrid-focus__title">{field.name}</h4>
        <div className="grpc-hybrid-focus__body" ref={bodyRef} data-testid="grpc-hybrid-focus-body">
          <GrpcProtoFieldRow
            field={field}
            value={body[field.name]}
            messageIndex={messageIndex}
            disabled={disabled}
            onChange={(nextValue) => {
              const coerced = coerceGrpcFieldValue(field, nextValue);
              onPatchBody(setGrpcBodyField(body, field.name, coerced));
            }}
            onFieldError={(hasError) => onFieldError(field.name, hasError)}
          />
        </div>
      </section>
    );
  }

  if (selectedPath.startsWith('oneof:')) {
    const groupName = selectedPath.slice('oneof:'.length);
    const members = oneofGroups.get(groupName);

    if (!members?.length) {
      return (
        <section className="grpc-hybrid-focus" data-testid="grpc-hybrid-focus-editor">
          <div className="grpc-hybrid-focus__empty">Selected oneof group is no longer available in this schema.</div>
        </section>
      );
    }

    return (
      <section className="grpc-hybrid-focus" data-testid="grpc-hybrid-focus-editor">
        <h4 className="grpc-hybrid-focus__title">{groupName}</h4>
        <div className="grpc-hybrid-focus__body" ref={bodyRef} data-testid="grpc-hybrid-focus-body">
          <GrpcProtoOneofGroupRow
            oneofName={groupName}
            members={members}
            body={body}
            messageIndex={messageIndex}
            disabled={disabled}
            onSelectMember={(member, nextValue) => {
              const coerced = coerceGrpcFieldValue(member, nextValue);
              onPatchBody(setGrpcOneofMember(body, members, member.name, coerced));
            }}
            onFieldError={(memberName, hasError) => onFieldError(`${groupName}.${memberName}`, hasError)}
          />
        </div>
      </section>
    );
  }

  return (
    <section className="grpc-hybrid-focus" data-testid="grpc-hybrid-focus-editor">
      <div className="grpc-hybrid-focus__empty">Unknown selection path.</div>
    </section>
  );
}
