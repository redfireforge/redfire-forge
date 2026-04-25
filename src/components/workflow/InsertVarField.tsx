import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  onRequestVariableInsert?: (apply: (snippet: string) => void) => void;
  onInsert: (snippet: string) => void;
}

/**
 * Wraps an input or textarea with an optional "Insert…" button that opens
 * the workflow variable picker.
 *
 * When `onRequestVariableInsert` is provided, renders the field and button
 * side-by-side in a flex row. Otherwise renders the child alone.
 */
export default function InsertVarField({ children, onRequestVariableInsert, onInsert }: Props) {
  if (!onRequestVariableInsert) return <>{children}</>;
  return (
    <div className="wf-config-field-with-insert">
      {children}
      <button
        type="button"
        className="btn btn-sm wf-config-insert-var-btn"
        title="Insert variable from workflow or upstream step"
        onClick={() => onRequestVariableInsert(onInsert)}
      >
        Insert…
      </button>
    </div>
  );
}
