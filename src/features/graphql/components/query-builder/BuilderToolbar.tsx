import { useMemo } from 'react';
import type { GraphqlSchemaInfo } from '../../../../shared/types/graphql';
import type { BuilderState } from '../../hooks/useGraphqlQueryBuilder';

export interface BuilderToolbarProps {
  state:          BuilderState;
  schemaInfo:     GraphqlSchemaInfo | null;
  selectedCount:  number;
  onSetOpType:    (t: 'query' | 'mutation' | 'subscription') => void;
  onSetOpName:    (n: string) => void;
  onCopy:         () => void;
  onEditInEditor: () => void;
  onExecute:      () => void;
  onReset:        () => void;
  copied:         boolean;
}

const OP_META = {
  query:        { letter: 'Q', label: 'Query' },
  mutation:     { letter: 'M', label: 'Mutation' },
  subscription: { letter: 'S', label: 'Subscription' },
} as const;

export function BuilderToolbar({
  state, schemaInfo, selectedCount, onSetOpType, onSetOpName,
  onCopy, onEditInEditor, onExecute, onReset, copied,
}: BuilderToolbarProps) {
  const typeCount = schemaInfo?.types?.length ?? 0;
  const fieldCount = useMemo(
    () => schemaInfo?.types?.reduce((s, t) => s + (t.fields?.length ?? 0), 0) ?? 0,
    [schemaInfo],
  );

  return (
    <div className="gql-qb-toolbar" data-testid="gql-qb-toolbar">
      <div className="gql-qb-toolbar-start">
        <span className="gql-qb-toolbar-title">Query builder</span>

        <div className="gql-qb-op-switcher" role="group" aria-label="Operation type">
          {(['query', 'mutation', 'subscription'] as const).map((t) => {
            const { letter, label } = OP_META[t];
            const active = state.operationType === t;
            return (
              <button
                key={t}
                type="button"
                className={`gql-qb-op-btn gql-qb-op-btn--${t}${active ? ' gql-qb-op-btn--active' : ''}`}
                onClick={() => onSetOpType(t)}
                aria-pressed={active}
                aria-label={label}
                title={label}
                data-testid={`gql-qb-op-${t}`}
              >
                <span className="gql-qb-op-letter" aria-hidden="true">{letter}</span>
                <span className="gql-qb-op-label">{label}</span>
              </button>
            );
          })}
        </div>

        <input
          type="text"
          className="gql-qb-op-name"
          value={state.operationName}
          onChange={(e) => onSetOpName(e.target.value)}
          placeholder="Operation name (optional)"
          aria-label="Operation name"
          spellCheck={false}
          data-testid="gql-qb-op-name"
        />
      </div>

      <div className="gql-qb-toolbar-meta">
        {schemaInfo ? (
          <span
            className="gql-qb-schema-badge"
            title={`${typeCount} types, ${fieldCount} total fields`}
          >
            {typeCount} types
          </span>
        ) : (
          <span className="gql-qb-schema-badge gql-qb-schema-badge--empty">No schema</span>
        )}
        <span className="gql-qb-sel-badge" aria-live="polite" aria-atomic="true">
          {selectedCount} field{selectedCount !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="gql-qb-toolbar-actions">
        <button
          type="button"
          className="gql-qb-btn gql-qb-btn--ghost gql-qb-btn--sm"
          onClick={onReset}
          title="Clear all selections"
          aria-label="Clear all selections"
          data-testid="gql-qb-reset"
          disabled={selectedCount === 0}
        >
          Clear
        </button>
        <button
          type="button"
          className={`gql-qb-btn gql-qb-btn--sm${copied ? ' gql-qb-btn--success' : ''}`}
          onClick={onCopy}
          title="Copy generated query"
          aria-label={copied ? 'Copied!' : 'Copy generated query'}
          data-testid="gql-qb-copy"
        >
          {copied ? '✓ Copied' : 'Copy SDL'}
        </button>
        <button
          type="button"
          className="gql-qb-btn gql-qb-btn--sm"
          onClick={onEditInEditor}
          title="Send query to editor"
          aria-label="Send query to editor"
          data-testid="gql-qb-edit"
        >
          Edit in Editor
        </button>
        <button
          type="button"
          className="gql-qb-btn gql-qb-btn--primary gql-qb-btn--sm"
          onClick={onExecute}
          title="Execute query (⌘↵)"
          aria-label="Execute query"
          disabled={selectedCount === 0}
          data-testid="gql-qb-execute"
        >
          Execute
        </button>
      </div>
    </div>
  );
}
