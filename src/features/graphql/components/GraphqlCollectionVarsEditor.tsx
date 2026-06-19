/**
 * CollectionVarsEditor — inline key-value editor for collection-level variables.
 * Extracted from GraphqlCollections.tsx to reduce its line count.
 */
import { useState, useCallback } from 'react';
import type { GraphqlCollection } from '../../../shared/types/graphql';

interface CollectionVarsEditorProps {
  collection: GraphqlCollection;
  onSave: (vars: Record<string, string>) => void;
}

export function CollectionVarsEditor({ collection, onSave }: CollectionVarsEditorProps) {
  const [rows, setRows] = useState<Array<{ key: string; value: string }>>(() =>
    Object.entries(collection.variables).map(([k, v]) => ({ key: k, value: v })),
  );

  const commit = useCallback((updated: Array<{ key: string; value: string }>) => {
    const vars: Record<string, string> = {};
    for (const { key, value } of updated) {
      if (key.trim()) vars[key.trim()] = value;
    }
    onSave(vars);
  }, [onSave]);

  const handleKeyChange = (idx: number, key: string) => {
    const next = rows.map((r, i) => i === idx ? { ...r, key } : r);
    setRows(next);
    commit(next);
  };

  const handleValueChange = (idx: number, value: string) => {
    const next = rows.map((r, i) => i === idx ? { ...r, value } : r);
    setRows(next);
    commit(next);
  };

  const addRow = () => setRows((prev) => [...prev, { key: '', value: '' }]);

  const deleteRow = (idx: number) => {
    const next = rows.filter((_, i) => i !== idx);
    setRows(next);
    commit(next);
  };

  return (
    <div className="gql-col-vars-editor" data-testid="gql-col-vars-editor">
      <div className="gql-col-vars-editor-header">
        <span className="gql-col-vars-editor-title">Collection variables</span>
        <span className="gql-col-vars-editor-hint">Available as <code>rf.getCollectionVar(key)</code> in scripts</span>
      </div>
      {rows.map((row, idx) => (
        <div key={idx} className="gql-col-vars-row">
          <input
            type="text"
            className="gql-col-vars-key"
            placeholder="key"
            value={row.key}
            onChange={(e) => handleKeyChange(idx, e.target.value)}
            aria-label={`Variable key ${idx + 1}`}
            data-testid="gql-col-vars-key"
          />
          <input
            type="text"
            className="gql-col-vars-value"
            placeholder="value"
            value={row.value}
            onChange={(e) => handleValueChange(idx, e.target.value)}
            aria-label={`Variable value ${idx + 1}`}
            data-testid="gql-col-vars-value"
          />
          <button
            type="button"
            className="gql-col-vars-del"
            onClick={() => deleteRow(idx)}
            aria-label={`Delete variable ${row.key || idx + 1}`}
            title="Delete row"
            data-testid="gql-col-vars-del"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        className="gql-col-vars-add"
        onClick={addRow}
        aria-label="Add variable"
        data-testid="gql-col-vars-add"
      >
        + Add variable
      </button>
    </div>
  );
}
