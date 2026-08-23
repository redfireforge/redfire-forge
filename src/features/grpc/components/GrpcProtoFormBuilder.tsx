import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GrpcFieldSchema, GrpcMessageSchema } from '@shared/grpc/contracts';
import { buildGrpcMessageSchemaIndex } from '../utils/grpcBodyComposer';
import {
  coerceGrpcFieldValue,
  groupMessageFields,
  resolveActiveOneofMember,
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
  presentation?: 'plain' | 'guided-cards';
}

export function GrpcProtoFormBuilder({
  schema,
  messageTypes,
  body,
  onChange,
  onValidityChange,
  disabled = false,
  presentation = 'plain',
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

  const hasMeaningfulValue = useCallback((field: GrpcFieldSchema) => {
    const raw = body[field.name];
    if (raw === null || raw === undefined) return false;
    if (typeof raw === 'string') return raw.trim().length > 0;
    if (Array.isArray(raw)) return raw.length > 0;
    if (typeof raw === 'object') return Object.keys(raw as Record<string, unknown>).length > 0;
    return true;
  }, [body]);

  const renderFieldRow = useCallback((field: GrpcFieldSchema) => (
    <GrpcProtoFieldRow
      key={field.name}
      field={field}
      value={body[field.name]}
      disabled={disabled}
      messageIndex={messageIndex}
      onChange={(raw) => updateField(field, raw)}
      onFieldError={(hasError) => reportFieldError(field.name, hasError)}
    />
  ), [body, disabled, messageIndex, reportFieldError, updateField]);

  if (regular.length === 0 && oneofGroups.size === 0) {
    return (
      <p className="grpc-proto-form-empty" data-testid="grpc-proto-form-empty">
        No request fields in schema.
      </p>
    );
  }

  if (presentation === 'guided-cards') {
    const coreFields = regular.filter((field) => !field.isMap && field.label !== 'repeated');
    const mapFields = regular.filter((field) => field.isMap);
    const repeatedFields = regular.filter((field) => field.label === 'repeated');
    const oneofEntries = [...oneofGroups.entries()];

    const countFilled = (fields: GrpcFieldSchema[]) => fields.reduce((count, field) => (
      hasMeaningfulValue(field) ? count + 1 : count
    ), 0);

    const coreFilled = countFilled(coreFields);
    const mapFilled = countFilled(mapFields);
    const repeatedFilled = countFilled(repeatedFields);
    const firstOneof = oneofEntries[0];
    const firstOneofActive = firstOneof
      ? resolveActiveOneofMember(firstOneof[1], body) ?? firstOneof[1][0]?.name ?? null
      : null;

    const mapTitle = mapFields.length === 1 ? `${mapFields[0].name} map` : 'Attributes Map';

    return (
      <div className="grpc-proto-form grpc-proto-form--guided" data-testid="grpc-proto-form">
        <aside className="grpc-proto-guided-rail" data-testid="grpc-proto-guided-rail">
          <div className={`grpc-proto-guided-step${coreFields.length > 0 ? ' is-active' : ''}`}>
            <h4 className="grpc-proto-guided-step-title">1. Core Message</h4>
            <p className="grpc-proto-guided-step-copy">Top-level required and frequently used values.</p>
            <div className="grpc-proto-guided-step-chips">
              <span className={`grpc-proto-guided-chip ${coreFields.length > 0 && coreFilled === coreFields.length ? 'is-good' : 'is-warn'}`}>
                {coreFields.length > 0 && coreFilled === coreFields.length ? 'Complete' : 'Needs review'}
              </span>
              <span className="grpc-proto-guided-chip">{coreFields.length} fields</span>
            </div>
          </div>

          <div className={`grpc-proto-guided-step${mapFields.length > 0 ? ' is-active' : ''}`}>
            <h4 className="grpc-proto-guided-step-title">2. {mapTitle}</h4>
            <p className="grpc-proto-guided-step-copy">Key/value labels with duplicate-key checks.</p>
            {mapFields.length > 0 && (
              <div className="grpc-proto-guided-step-chips">
                <span className={`grpc-proto-guided-chip ${mapFilled === mapFields.length ? 'is-good' : 'is-warn'}`}>
                  {mapFilled === mapFields.length ? 'Ready' : 'Needs review'}
                </span>
                <span className="grpc-proto-guided-chip">{mapFields.length} map fields</span>
              </div>
            )}
          </div>

          <div className={`grpc-proto-guided-step${oneofEntries.length > 0 ? ' is-active' : ''}`}>
            <h4 className="grpc-proto-guided-step-title">3. Oneof Branch</h4>
            <p className="grpc-proto-guided-step-copy">Choose one branch and fill branch-specific payload.</p>
            {firstOneofActive && (
              <div className="grpc-proto-guided-step-chips">
                <span className="grpc-proto-guided-chip is-good">{firstOneofActive} selected</span>
              </div>
            )}
          </div>

          <div className="grpc-proto-guided-step">
            <h4 className="grpc-proto-guided-step-title">4. Validation & Preview</h4>
            <p className="grpc-proto-guided-step-copy">Request summary and payload preview before apply.</p>
            <div className="grpc-proto-guided-step-chips">
              <span className="grpc-proto-guided-chip">{Object.keys(fieldErrors).length} issues</span>
              <span className={`grpc-proto-guided-chip ${repeatedFilled > 0 ? 'is-good' : ''}`}>{repeatedFields.length} repeated</span>
            </div>
          </div>
        </aside>

        <div className="grpc-proto-guided-main" data-testid="grpc-proto-guided-main">
          {coreFields.length > 0 && (
            <section className="grpc-proto-guided-card" data-testid="grpc-proto-guided-card-core">
              <header className="grpc-proto-guided-card-header">
                <h4>Core Message</h4>
                <span className={`grpc-proto-guided-state ${coreFilled === coreFields.length ? 'is-ready' : ''}`}>
                  {coreFilled === coreFields.length ? 'Ready' : `${coreFilled}/${coreFields.length} complete`}
                </span>
              </header>
              <div className="grpc-proto-guided-card-body">
                {coreFields.map(renderFieldRow)}
              </div>
            </section>
          )}

          {mapFields.length > 0 && (
            <section className="grpc-proto-guided-card" data-testid="grpc-proto-guided-card-maps">
              <header className="grpc-proto-guided-card-header">
                <h4>{mapFields.length === 1 ? mapFields[0].name : 'Map Fields'}</h4>
                <span className="grpc-proto-guided-state">Map Editor</span>
              </header>
              <div className="grpc-proto-guided-card-body">
                {mapFields.map(renderFieldRow)}
              </div>
            </section>
          )}

          {repeatedFields.length > 0 && (
            <section className="grpc-proto-guided-card" data-testid="grpc-proto-guided-card-repeated">
              <header className="grpc-proto-guided-card-header">
                <h4>Collections</h4>
                <span className="grpc-proto-guided-state">Repeated Fields</span>
              </header>
              <div className="grpc-proto-guided-card-body">
                {repeatedFields.map(renderFieldRow)}
              </div>
            </section>
          )}

          {oneofEntries.map(([oneofName, members]) => {
            const active = resolveActiveOneofMember(members, body) ?? members[0]?.name ?? 'none';
            return (
              <section className="grpc-proto-guided-card" data-testid={`grpc-proto-guided-card-oneof-${oneofName}`} key={oneofName}>
                <header className="grpc-proto-guided-card-header">
                  <h4>{oneofName} (oneof)</h4>
                  <span className="grpc-proto-guided-state is-ready">Branch: {active}</span>
                </header>
                <div className="grpc-proto-guided-card-body">
                  <GrpcProtoOneofGroupRow
                    oneofName={oneofName}
                    members={members}
                    body={body}
                    displayMode="embedded"
                    disabled={disabled}
                    messageIndex={messageIndex}
                    onSelectMember={(member, raw) => updateOneofMember(members, member, raw)}
                    onFieldError={reportFieldError}
                  />
                </div>
              </section>
            );
          })}
        </div>
      </div>
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
