/**
 * GraphqlMockResolversTab.tsx
 *
 * Per-type/field resolver override tab for the GraphQL Mock Panel.
 * Extracted from GraphqlMockPanel.tsx to keep that file within the 900-line limit.
 *
 * Exports:
 *   ResolversTab       — tab content component (internal, used by GraphqlMockPanel)
 *   FieldResolverRow   — exported for direct testing in GraphqlMockPanel.test.tsx
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { CustomSelect } from '@shared/components/CustomSelect';
import type { GraphqlMockConfig, GraphqlSchemaInfo, MockResolver } from '@shared/types/graphql';
import type { UseGraphqlMockServerResult } from '../hooks/useGraphqlMockServer';
import type { MockSchemaSource } from '../hooks/useGraphqlMockServer';
import { parseJsonOrRaw } from '@shared/utils/helpers';

// ─── ResolversTab ─────────────────────────────────────────────────────────────

interface ResolversTabProps {
  config:       GraphqlMockConfig;
  schemaInfo:   GraphqlSchemaInfo | null;
  mockServer:   UseGraphqlMockServerResult;
  schemaSource: MockSchemaSource;
}

export function ResolversTab({ config, schemaInfo, mockServer, schemaSource }: ResolversTabProps) {
  const types = useMemo(() =>
    (schemaInfo?.types ?? []).filter((t) => t.kind === 'OBJECT' || t.kind === 'INTERFACE'),
  [schemaInfo]);

  if (types.length === 0) {
    const emptyMsg = schemaInfo
      ? 'No Object types found in schema.'
      : schemaSource === 'custom'
        ? 'Field resolvers use the introspected schema type list. Switch to "Introspected schema" and introspect first, or keep using Random (default) for all fields.'
        : 'Introspect a schema to configure field resolver overrides.';
    return (
      <div className="gql-mock-empty" data-testid="gql-mock-empty">
        <div className="gql-mock-empty-icon" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M8 12h8M12 8v8" />
          </svg>
        </div>
        <div className="gql-mock-empty-title">No resolver types</div>
        <div className="gql-mock-empty-hint">{emptyMsg}</div>
      </div>
    );
  }

  return (
    <div className="gql-mock-resolvers-list" data-testid="gql-mock-resolvers-list">
      {types.map((type) => (
        <TypeResolverGroup
          key={type.name}
          typeName={type.name}
          fields={type.fields ?? []}
          typeResolvers={config.resolvers[type.name] ?? {}}
          mockServer={mockServer}
        />
      ))}
    </div>
  );
}

// ─── TypeResolverGroup ────────────────────────────────────────────────────────

interface TypeResolverGroupProps {
  typeName:     string;
  fields:       Array<{ name: string; type: string; description?: string | null }>;
  typeResolvers: Record<string, MockResolver>;
  mockServer:   UseGraphqlMockServerResult;
}

function TypeResolverGroup({ typeName, fields, typeResolvers, mockServer }: TypeResolverGroupProps) {
  const [expanded, setExpanded] = useState(false);
  const hasOverrides = Object.keys(typeResolvers).length > 0;

  return (
    <div className={`gql-mock-type-group${hasOverrides ? ' gql-mock-type-group--overridden' : ''}`} data-testid="gql-mock-type-group">
      <button
        type="button"
        className="gql-mock-type-header"
        onClick={() => setExpanded((v) => !v)}
        data-testid="gql-mock-type-header"
      >
        <span className="gql-mock-type-toggle">{expanded ? '▼' : '▶'}</span>
        <span className="gql-mock-type-name">{typeName}</span>
        {hasOverrides && (
          <span className="gql-mock-type-override-count">{Object.keys(typeResolvers).length} override{Object.keys(typeResolvers).length !== 1 ? 's' : ''}</span>
        )}
      </button>
      {expanded && fields.map((field) => (
        <FieldResolverRow
          key={`${field.name}-${JSON.stringify(typeResolvers[field.name] ?? { type: 'random' })}`}
          typeName={typeName}
          field={field}
          resolver={typeResolvers[field.name] ?? { type: 'random' }}
          mockServer={mockServer}
        />
      ))}
    </div>
  );
}

// ─── FieldResolverRow ─────────────────────────────────────────────────────────

export interface FieldResolverRowProps {
  typeName:  string;
  field:     { name: string; type: string; description?: string | null };
  resolver:  MockResolver;
  mockServer: UseGraphqlMockServerResult;
}

export function FieldResolverRow({ typeName, field, resolver, mockServer }: FieldResolverRowProps) {
  const [mode, setMode] = useState<'random' | 'fixed' | 'script' | 'error'>(resolver.type);
  const [fixedVal, setFixedVal] = useState(() => {
    if (resolver.type !== 'fixed') return '';
    const v = resolver.value;
    if (v === null || v === undefined) return String(v);
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  });
  const [scriptCode, setScriptCode] = useState(() => resolver.type === 'script' ? resolver.code : '');
  const [errorMsg, setErrorMsg]   = useState(() => resolver.type === 'error'  ? resolver.message : '');

  // Note: FieldResolverRow is keyed by JSON.stringify(resolver) at the call site,
  // so React re-mounts with fresh state whenever the resolver changes externally
  // (e.g. after importConfig). The useEffect below is a belt-and-suspenders guard
  // for cases where the key stays the same but resolver content shifts.
  // We use a stable JSON fingerprint to avoid false positives from the inline
  // `{ type: 'random' }` literal that creates a new object every parent render.
  const resolverKey = JSON.stringify(resolver);
  const prevResolverKeyRef = useRef(resolverKey);
  useEffect(() => {
    if (prevResolverKeyRef.current === resolverKey) return;
    prevResolverKeyRef.current = resolverKey;
    setMode(resolver.type);
    if (resolver.type === 'fixed') {
      const v = resolver.value;
      setFixedVal(v === null || v === undefined ? String(v) : typeof v === 'object' ? JSON.stringify(v) : String(v));
    } else if (resolver.type === 'script') {
      setScriptCode(resolver.code);
    } else if (resolver.type === 'error') {
      setErrorMsg(resolver.message);
    } else {
      setFixedVal('');
      setScriptCode('');
      setErrorMsg('');
    }
  // resolverKey changes whenever the resolver object changes (stable JSON fingerprint)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolverKey]);

  const handleModeChange = (newMode: typeof mode) => {
    setMode(newMode);
    if (newMode === 'random') {
      mockServer.clearFieldResolver(typeName, field.name);
    } else if (newMode === 'fixed' && !fixedVal.trim()) {
      // Don't sync an empty fixed value — wait for the user to enter one (onBlur)
    } else if (newMode === 'script' && !scriptCode.trim()) {
      // Don't sync an empty script — wait for the user to enter one (onBlur)
    } else {
      applyResolver(newMode, fixedVal, scriptCode, errorMsg);
    }
  };

  const applyResolver = (
    m: typeof mode,
    fv: string,
    sc: string,
    em: string,
  ) => {
    let r: MockResolver;
    if (m === 'fixed') {
      // Don't persist empty fixed values — random mode produces better output than
      // an undefined/empty scalar, and the empty string is not a valid user intent.
      if (!fv.trim()) return;
      r = { type: 'fixed', value: parseJsonOrRaw(fv) };
    } else if (m === 'script') {
      // Don't persist empty scripts — random mode is better than an empty script body.
      if (!sc.trim()) return;
      r = { type: 'script', code: sc };
    } else if (m === 'error') {
      r = { type: 'error', message: em };   // empty errorMsg is fine — buildMockMap supplies a default
    } else {
      mockServer.clearFieldResolver(typeName, field.name);
      return;
    }
    mockServer.setFieldResolver(typeName, field.name, r);
  };

  return (
    <div
      className={`gql-mock-field-row${mode !== 'random' ? ' gql-mock-field-row--overridden' : ''}`}
      data-testid="gql-mock-field-row"
    >
      <div className="gql-mock-field-row-main">
        <span className="gql-mock-field-name" title={field.description ?? undefined}>{field.name}</span>
        <span className="gql-mock-field-type">{field.type}</span>
        <CustomSelect
          className="gql-mock-resolver-select"
          value={mode}
          onChange={(v) => handleModeChange(v as typeof mode)}
          options={[
            { value: 'random', label: 'Random' },
            { value: 'fixed', label: 'Fixed' },
            { value: 'script', label: 'Script' },
            { value: 'error', label: 'Error' },
          ]}
          data-testid="gql-mock-resolver-select"
        />
      </div>

      {mode === 'fixed' && (
        <input
          type="text"
          className="gql-mock-fixed-input"
          value={fixedVal}
          placeholder='Value (e.g. "hello" or 42)'
          onChange={(e) => setFixedVal(e.target.value)}
          onBlur={(e) => applyResolver(mode, e.currentTarget.value, scriptCode, errorMsg)}
          data-testid="gql-mock-fixed-input"
        />
      )}
      {mode === 'script' && (
        <textarea
          className="gql-mock-script-input"
          rows={2}
          value={scriptCode}
          placeholder="return new Date().toISOString()"
          onChange={(e) => setScriptCode(e.target.value)}
          onBlur={(e) => applyResolver(mode, fixedVal, e.currentTarget.value, errorMsg)}
          data-testid="gql-mock-script-input"
        />
      )}
      {mode === 'error' && (
        <input
          type="text"
          className="gql-mock-fixed-input"
          value={errorMsg}
          placeholder="Error message"
          onChange={(e) => setErrorMsg(e.target.value)}
          onBlur={(e) => applyResolver(mode, fixedVal, scriptCode, e.currentTarget.value)}
          data-testid="gql-mock-error-input"
        />
      )}
    </div>
  );
}

// ─── Internal helpers ─────────────────────────────────────────────────────────
