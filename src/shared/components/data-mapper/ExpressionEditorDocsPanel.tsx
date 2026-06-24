import type { ExpressionFunction } from '../../../features/workflow/utils/expressionFunctions/types';
import type { ExpressionSnippet } from './utils/expressionSnippets';

export interface ExpressionEditorDocsPanelProps {
  selectedFn: ExpressionFunction | null;
  snippets: ExpressionSnippet[];
  snippetName: string;
  snippetBusy: boolean;
  expression: string;
  onSnippetNameChange: (name: string) => void;
  onSaveSnippet: () => void;
  onDeleteSnippet: (id: string) => void;
  onUseSnippet: (expression: string) => void;
  onInsertFunction: (fn: ExpressionFunction) => void;
  onComposeWithFunction: (fn: ExpressionFunction) => void;
}

export default function ExpressionEditorDocsPanel({
  selectedFn,
  snippets,
  snippetName,
  snippetBusy,
  expression,
  onSnippetNameChange,
  onSaveSnippet,
  onDeleteSnippet,
  onUseSnippet,
  onInsertFunction,
  onComposeWithFunction,
}: ExpressionEditorDocsPanelProps) {
  return (
    <div className="dm-expr-docs">
      {selectedFn ? (
        <>
          <div className="dm-expr-doc-header">
            <span className="dm-expr-doc-name">{selectedFn.name}</span>
            <span className="dm-expr-doc-category">{selectedFn.category}</span>
          </div>
          <div className="dm-expr-doc-sig">{selectedFn.signature}</div>
          <p className="dm-expr-doc-desc">{selectedFn.description}</p>
          {selectedFn.args.length > 0 && (
            <div className="dm-expr-doc-args">
              <div className="dm-expr-doc-args-title">Parameters</div>
              {selectedFn.args.map((a) => (
                <div key={a.name} className="dm-expr-doc-arg">
                  <code>{a.name}</code>
                  <span className="dm-expr-doc-arg-type">{a.type}</span>
                  {a.required && <span className="dm-expr-doc-arg-req">*</span>}
                  <span className="dm-expr-doc-arg-desc">{a.description}</span>
                </div>
              ))}
            </div>
          )}
          {selectedFn.examples.length > 0 && (
            <div className="dm-expr-doc-examples">
              <div className="dm-expr-doc-examples-title">Examples</div>
              {selectedFn.examples.map((ex, i) => (
                <div key={i} className="dm-expr-doc-example">
                  <code>{ex.input}</code> → <code>{ex.output}</code>
                </div>
              ))}
            </div>
          )}
          <div className="dm-expr-doc-actions">
            <button
              type="button"
              className="dm-expr-inline-btn dm-expr-inline-btn--primary"
              onClick={() => onInsertFunction(selectedFn)}
            >
              Insert
            </button>
            <button
              type="button"
              className="dm-expr-inline-btn"
              onClick={() => onComposeWithFunction(selectedFn)}
            >
              Compose with current
            </button>
          </div>
          <div className="dm-expr-doc-returns">Returns: {selectedFn.returnType}</div>
        </>
      ) : (
        <div className="dm-expr-doc-empty">
          <div className="dm-expr-doc-empty-icon">ƒ</div>
          <p>Select a function to see documentation.</p>
        </div>
      )}
      <div className="dm-expr-snippets">
        <div className="dm-expr-doc-examples-title">Reusable Snippets</div>
        <div className="dm-expr-snippet-save">
          <input
            className="dm-expr-snippet-name"
            value={snippetName}
            onChange={(e) => onSnippetNameChange(e.target.value)}
            placeholder="Snippet name"
            aria-label="Snippet name"
          />
          <button
            type="button"
            className="dm-expr-inline-btn"
            onClick={onSaveSnippet}
            disabled={snippetBusy || !snippetName.trim() || !expression.trim()}
          >
            Save
          </button>
        </div>
        <div className="dm-expr-snippet-list">
          {snippets.length === 0 ? (
            <div className="dm-expr-snippet-empty">No saved snippets yet.</div>
          ) : (
            snippets.map((snippet) => (
              <div key={snippet.id} className="dm-expr-snippet-item">
                <div className="dm-expr-snippet-meta">
                  <span className="dm-expr-snippet-title">{snippet.name}</span>
                  <code className="dm-expr-snippet-expression">{snippet.expression}</code>
                </div>
                <div className="dm-expr-snippet-actions">
                  <button
                    type="button"
                    className="dm-expr-inline-btn"
                    onClick={() => onUseSnippet(snippet.expression)}
                  >
                    Use
                  </button>
                  <button
                    type="button"
                    className="dm-expr-inline-btn dm-expr-inline-btn--danger"
                    onClick={() => onDeleteSnippet(snippet.id)}
                    disabled={snippetBusy}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
