import { useState, useMemo, useCallback } from 'react';
import type { ExpressionFunction } from '../../utils/expressionFunctions';
import { groupedExpressionFunctions, EXPRESSION_CATEGORIES } from '../../utils/expressionFunctions';
import { evaluateExpression, formatExpressionResult } from '../../utils/expressionEvaluator';
import type { WorkflowVariableHint } from '../../utils/workflowVariableHints';

interface Props {
  hints: WorkflowVariableHint[];
  onInsert: (template: string) => void;
}

type ExprCategory = (typeof EXPRESSION_CATEGORIES)[number] | 'All';

/**
 * Three-column expression builder:
 *  Left:   function catalog grouped by category
 *  Middle: expression composer with variable chips
 *  Right:  selected function docs + live preview
 */
export default function ExpressionBuilderView({ hints, onInsert }: Props) {
  const [selectedFn, setSelectedFn] = useState<ExpressionFunction | null>(null);
  const [expression, setExpression] = useState('');
  const [activeCategory, setActiveCategory] = useState<ExprCategory>('All');
  const [argValues, setArgValues] = useState<string[]>([]);

  const grouped = useMemo(() => groupedExpressionFunctions(), []);

  /** Filter by category. */
  const filteredGroups = useMemo(() => {
    if (activeCategory === 'All') return grouped;
    return grouped.filter((g) => g.category === activeCategory);
  }, [grouped, activeCategory]);

  /** When a function is selected, reset arg values. */
  const handleSelectFn = useCallback((fn: ExpressionFunction) => {
    setSelectedFn(fn);
    setArgValues(fn.args.map(() => ''));
    // Build initial expression template
    const argPlaceholders = fn.args.map((a) => a.name);
    setExpression(`${fn.name}(${argPlaceholders.join(', ')})`);
  }, []);

  /** Update a specific arg value. */
  const handleArgChange = useCallback((idx: number, value: string) => {
    setArgValues((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
    // Rebuild expression with actual values
    if (selectedFn) {
      setArgValues((prev) => {
        const next = [...prev];
        next[idx] = value;
        const argStrs = next.map((v, i) => {
          if (!v) return selectedFn.args[i]?.name ?? '';
          // Wrap in quotes if it looks like a plain string (not a variable ref or number)
          if (v.startsWith('{{') || !isNaN(Number(v)) || v === 'true' || v === 'false') return v;
          return `"${v}"`;
        });
        setExpression(`${selectedFn.name}(${argStrs.join(', ')})`);
        return next;
      });
    }
  }, [selectedFn]);

  /** Insert a variable ref into an arg field. */
  const _handleInsertVarIntoArg = useCallback((idx: number, ref: string) => {
    handleArgChange(idx, `{{${ref}}}`);
  }, [handleArgChange]);

  /** Live preview. */
  const preview = useMemo(() => {
    if (!expression.trim()) return { display: '', error: undefined };
    const result = evaluateExpression(expression, {
      resolveVariable: (name) => {
        const h = hints.find((h) => h.ref === name || h.ref.endsWith(`.${name}`));
        return h?.defaultValue ?? `[${name}]`;
      },
    });
    return {
      display: result.error ? `Error: ${result.error}` : formatExpressionResult(result.value),
      error: result.error,
    };
  }, [expression, hints]);

  /** Insert the built expression as a template. */
  const handleInsert = useCallback(() => {
    if (!expression.trim()) return;
    const template = `{{${expression}}}`;
    onInsert(template);
  }, [expression, onInsert]);

  return (
    <div className="wf-expr-builder">
      {/* Category filter */}
      <div className="wf-expr-category-toolbar">
        <button
          type="button"
          className={`wf-expr-cat-btn ${activeCategory === 'All' ? 'active' : ''}`}
          onClick={() => setActiveCategory('All')}
        >All</button>
        {EXPRESSION_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            className={`wf-expr-cat-btn ${activeCategory === cat ? 'active' : ''}`}
            onClick={() => setActiveCategory(cat)}
          >{cat}</button>
        ))}
      </div>

      <div className="wf-expr-columns">
        {/* ── Left: Function catalog ── */}
        <div className="wf-expr-left">
          <div className="wf-expr-left-title">Functions</div>
          <div className="wf-expr-fn-list">
            {filteredGroups.map((g) => (
              <div key={g.category}>
                <div className="wf-expr-fn-category">{g.category}</div>
                {g.functions.map((fn) => (
                  <button
                    key={fn.name}
                    type="button"
                    className={`wf-expr-fn-item ${selectedFn?.name === fn.name ? 'active' : ''}`}
                    onClick={() => handleSelectFn(fn)}
                    title={fn.description}
                  >
                    <span className="wf-expr-fn-name">{fn.name}</span>
                    <span className="wf-expr-fn-return">{fn.returnType}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* ── Middle: Composer ── */}
        <div className="wf-expr-middle">
          <div className="wf-expr-middle-title">Expression</div>
          <textarea
            className="wf-expr-textarea"
            value={expression}
            onChange={(e) => setExpression(e.target.value)}
            placeholder="Select a function or type an expression…"
            spellCheck={false}
            rows={3}
            aria-label="Expression input"
          />

          {/* Arg inputs when a function is selected */}
          {selectedFn && selectedFn.args.length > 0 && (
            <div className="wf-expr-args">
              <div className="wf-expr-args-title">Arguments</div>
              {selectedFn.args.map((arg, idx) => (
                <div key={arg.name} className="wf-expr-arg-row">
                  <label className="wf-expr-arg-label">
                    <span className="wf-expr-arg-name">{arg.name}</span>
                    <span className="wf-expr-arg-type">{arg.type}</span>
                    {arg.required && <span className="wf-expr-arg-required">*</span>}
                  </label>
                  <input
                    className="wf-expr-arg-input"
                    value={argValues[idx] ?? ''}
                    onChange={(e) => handleArgChange(idx, e.target.value)}
                    placeholder={arg.description}
                    aria-label={`Argument: ${arg.name}`}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Variable chips — click to insert into focused arg */}
          {hints.length > 0 && (
            <div className="wf-expr-var-chips">
              <div className="wf-expr-var-chips-title">Variables</div>
              <div className="wf-expr-var-chips-list">
                {hints.slice(0, 20).map((h) => (
                  <button
                    key={h.ref}
                    type="button"
                    className="wf-expr-var-chip"
                    onClick={() => {
                      // Insert into expression at cursor or append
                      setExpression((prev) => prev + `{{${h.ref}}}`);
                    }}
                    title={`Insert {{${h.ref}}}`}
                  >
                    {h.label || h.ref.split('.').pop()}
                  </button>
                ))}
                {hints.length > 20 && (
                  <span className="wf-expr-var-chips-more">+{hints.length - 20} more</span>
                )}
              </div>
            </div>
          )}

          {/* Preview */}
          <div className="wf-expr-preview">
            <div className="wf-expr-preview-title">Preview</div>
            <div className={`wf-expr-preview-value ${preview.error ? 'error' : ''}`}>
              {preview.display || (expression.trim() ? 'Evaluating…' : 'Enter an expression above')}
            </div>
          </div>

          {/* Insert button */}
          <div className="wf-expr-actions">
            <button
              type="button"
              className="wf-expr-insert-btn"
              onClick={handleInsert}
              disabled={!expression.trim()}
            >
              Insert Expression
            </button>
          </div>
        </div>

        {/* ── Right: Function docs ── */}
        <div className="wf-expr-right">
          {selectedFn ? (
            <>
              <div className="wf-expr-doc-header">
                <span className="wf-expr-doc-name">{selectedFn.name}</span>
                <span className="wf-expr-doc-category">{selectedFn.category}</span>
              </div>
              <div className="wf-expr-doc-sig">{selectedFn.signature}</div>
              <p className="wf-expr-doc-desc">{selectedFn.description}</p>

              {selectedFn.args.length > 0 && (
                <div className="wf-expr-doc-args">
                  <div className="wf-expr-doc-args-title">Parameters</div>
                  <table className="wf-expr-doc-args-table">
                    <thead>
                      <tr><th>Name</th><th>Type</th><th>Required</th><th>Description</th></tr>
                    </thead>
                    <tbody>
                      {selectedFn.args.map((a) => (
                        <tr key={a.name}>
                          <td><code>{a.name}</code></td>
                          <td>{a.type}</td>
                          <td>{a.required ? '✓' : ''}</td>
                          <td>{a.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {selectedFn.examples.length > 0 && (
                <div className="wf-expr-doc-examples">
                  <div className="wf-expr-doc-examples-title">Examples</div>
                  {selectedFn.examples.map((ex, i) => (
                    <div key={i} className="wf-expr-doc-example">
                      <code className="wf-expr-doc-example-input">{ex.input}</code>
                      <span className="wf-expr-doc-example-arrow">→</span>
                      <code className="wf-expr-doc-example-output">{ex.output}</code>
                    </div>
                  ))}
                </div>
              )}

              <div className="wf-expr-doc-returns">
                <strong>Returns:</strong> {selectedFn.returnType}
              </div>
            </>
          ) : (
            <div className="wf-expr-doc-empty">
              <div className="wf-expr-doc-empty-icon">ƒ</div>
              <p>Select a function from the catalog to see its documentation.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
