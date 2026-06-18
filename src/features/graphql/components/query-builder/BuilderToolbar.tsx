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

export function BuilderToolbar({
  state, schemaInfo, selectedCount, onSetOpType, onSetOpName,
  onCopy, onEditInEditor, onExecute, onReset, copied,
}: BuilderToolbarProps) {
  const typeCount  = schemaInfo?.types?.length ?? 0;
  const fieldCount = useMemo(
    () => schemaInfo?.types?.reduce((s, t) => s + (t.fields?.length ?? 0), 0) ?? 0,
    [schemaInfo],
  );

  return (
    <div className="gql-qb-toolbar" data-testid="gql-qb-toolbar">
      <span className="gql-qb-toolbar-title">Query Builder</span>

      <div className="gql-qb-op-switcher" role="group" aria-label="Operation type">
        {(['query', 'mutation', 'subscription'] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={`gql-qb-op-btn gql-qb-op-btn--${t}${state.operationType === t ? ' gql-qb-op-btn--active' : ''}`}
            onClick={() => onSetOpType(t)}
            aria-pressed={state.operationType === t}
            data-testid={`gql-qb-op-${t}`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <input
        type="text"
        className="gql-qb-op-name"
        value={state.operationName}
        onChange={(e) => onSetOpName(e.target.value)}
        placeholder="operationName (optional)"
        aria-label="Operation name"
        spellCheck={false}
        data-testid="gql-qb-op-name"
      />

      {schemaInfo && (
        <span className="gql-qb-schema-info" title={`${typeCount} types, ${fieldCount} total fields`}>
          {typeCount} types
        </span>
      )}

      <span className="gql-qb-selected-count" aria-live="polite" aria-atomic="true">
        {selectedCount} field{selectedCount !== 1 ? 's' : ''}
      </span>

      <button
        type="button"
        className="gql-qb-reset-btn"
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
        className="gql-qb-copy-btn"
        onClick={onCopy}
        title="Copy generated query"
        aria-label={copied ? 'Copied!' : 'Copy generated query'}
        data-testid="gql-qb-copy"
      >
        {copied ? '✓ Copied' : 'Copy SDL'}
      </button>

      <button
        type="button"
        className="gql-qb-edit-btn"
        onClick={onEditInEditor}
        title="Send query to editor"
        aria-label="Send query to editor"
        data-testid="gql-qb-edit"
      >
        Edit in Editor
      </button>

      <button
        type="button"
        className="gql-qb-exec-btn gql-btn gql-btn--primary"
        onClick={onExecute}
        title="Execute query (⌘↵)"
        aria-label="Execute query"
        disabled={selectedCount === 0}
        data-testid="gql-qb-execute"
      >
        Execute
      </button>
    </div>
  );
}
