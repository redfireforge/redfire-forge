import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { evaluateMapperExpression } from './utils/mapperExpressionEvaluator';
import { groupedExpressionFunctions, EXPRESSION_CATEGORIES } from '../../../features/workflow/utils/expressionFunctions';
import type { ExpressionFunction } from '../../../features/workflow/utils/expressionFunctions/types';
import type { MapperSource, Mapping } from './types';

interface ExpressionEditorModalProps {
  mapping: Mapping;
  sources: MapperSource[];
  activeSourceId: string;
  customFunctions?: ExpressionFunction[];
  onSave: (mappingId: string, expression: string) => void;
  onCancel: () => void;
}

type CategoryFilter = (typeof EXPRESSION_CATEGORIES)[number] | 'All';

export default function ExpressionEditorModal({
  mapping,
  sources,
  activeSourceId,
  customFunctions,
  onSave,
  onCancel,
}: ExpressionEditorModalProps) {
  const [expression, setExpression] = useState(mapping.expression ?? mapping.sourcePath);
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('All');
  const [selectedFn, setSelectedFn] = useState<ExpressionFunction | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevMappingIdRef = useRef(mapping.id);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    if (prevMappingIdRef.current !== mapping.id) {
      prevMappingIdRef.current = mapping.id;
      setExpression(mapping.expression ?? mapping.sourcePath);
    }
  }, [mapping.id, mapping.expression, mapping.sourcePath]);

  const grouped = useMemo(() => {
    const base = groupedExpressionFunctions();
    if (!customFunctions?.length) return base;
    const customGroup = { category: 'Custom', functions: customFunctions };
    return [...base, customGroup];
  }, [customFunctions]);

  const filteredGroups = useMemo(() => {
    if (activeCategory === 'All') return grouped;
    return grouped.filter((g) => g.category === activeCategory);
  }, [grouped, activeCategory]);

  const allCategories = useMemo(() => {
    const cats = [...EXPRESSION_CATEGORIES] as string[];
    if (customFunctions?.length) cats.push('Custom');
    return cats;
  }, [customFunctions]);

  const [preview, setPreview] = useState<{ display: string; error?: string }>({ display: '', error: undefined });

  useEffect(() => {
    if (!expression.trim()) {
      setPreview({ display: '', error: undefined });
      return;
    }
    const timer = setTimeout(() => {
      const result = evaluateMapperExpression(expression, sources, activeSourceId, customFunctions);
      setPreview({
        display: result.error ? `Error: ${result.error}` : result.preview,
        error: result.error,
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [expression, sources, activeSourceId, customFunctions]);

  const handleInsertFunction = useCallback((fn: ExpressionFunction) => {
    setSelectedFn(fn);
    const fnCall = fn.name.startsWith('$') ? fn.name : `$${fn.name}`;
    const template = fn.args.length > 0
      ? `${fnCall}(${fn.args.map((a) => a.name).join(', ')})`
      : `${fnCall}()`;

    const ta = textareaRef.current;
    if (ta) {
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const before = expression.slice(0, start);
      const after = expression.slice(end);
      const next = before + template + after;
      setExpression(next);
      requestAnimationFrame(() => {
        const cursor = start + template.length;
        ta.setSelectionRange(cursor, cursor);
        ta.focus();
      });
    } else {
      setExpression((prev) => prev + template);
    }
  }, [expression]);

  const handleSave = useCallback(() => {
    onSave(mapping.id, expression);
  }, [mapping.id, expression, onSave]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  }, [handleSave, onCancel]);

  return (
    <div className="dm-expr-overlay" onKeyDown={handleKeyDown} tabIndex={-1} role="dialog" aria-modal="true">
      <div className="dm-expr-modal">
        <div className="dm-expr-header">
          <span className="dm-expr-title">Expression Editor</span>
          <span className="dm-expr-target-path">Target: {mapping.targetPath}</span>
          <button className="dm-expr-close" onClick={onCancel} title="Close">×</button>
        </div>

        <div className="dm-expr-body">
          {/* Left: Function catalog */}
          <div className="dm-expr-sidebar">
            <div className="dm-expr-category-bar">
              <button
                className={`dm-expr-cat-btn ${activeCategory === 'All' ? 'dm-expr-cat-btn--active' : ''}`}
                onClick={() => setActiveCategory('All')}
              >All</button>
              {allCategories.map((cat) => (
                <button
                  key={cat}
                  className={`dm-expr-cat-btn ${activeCategory === cat ? 'dm-expr-cat-btn--active' : ''}`}
                  onClick={() => setActiveCategory(cat as CategoryFilter)}
                >{cat}</button>
              ))}
            </div>
            <div className="dm-expr-fn-list">
              {filteredGroups.map((g) => (
                <div key={g.category}>
                  <div className="dm-expr-fn-category">{g.category}</div>
                  {g.functions.map((fn) => (
                    <button
                      key={fn.name}
                      className={`dm-expr-fn-item ${selectedFn?.name === fn.name ? 'dm-expr-fn-item--active' : ''}`}
                      onClick={() => handleInsertFunction(fn)}
                      title={fn.description}
                    >
                      <span className="dm-expr-fn-name">{fn.name}</span>
                      <span className="dm-expr-fn-return">{fn.returnType}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Center: Editor + preview */}
          <div className="dm-expr-editor-area">
            <div className="dm-expr-editor-label">Expression</div>
            <textarea
              ref={textareaRef}
              className="dm-expr-textarea"
              value={expression}
              onChange={(e) => setExpression(e.target.value)}
              placeholder="e.g. $upper($.name) or $concat($.firstName, &quot; &quot;, $.lastName)"
              spellCheck={false}
              rows={4}
            />
            <div className="dm-expr-source-hint">
              Use <code>$.path</code> to reference source fields. Use <code>$fn()</code> for functions.
            </div>

            <div className="dm-expr-preview-section">
              <div className="dm-expr-preview-label">Live Preview</div>
              <div className={`dm-expr-preview-value ${preview.error ? 'dm-expr-preview-value--error' : ''}`}>
                {preview.display || (expression.trim() ? 'Evaluating…' : 'Enter an expression above')}
              </div>
            </div>
          </div>

          {/* Right: Function docs */}
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
                <div className="dm-expr-doc-returns">Returns: {selectedFn.returnType}</div>
              </>
            ) : (
              <div className="dm-expr-doc-empty">
                <div className="dm-expr-doc-empty-icon">ƒ</div>
                <p>Select a function to see documentation.</p>
              </div>
            )}
          </div>
        </div>

        <div className="dm-expr-footer">
          <button className="dm-expr-btn dm-expr-btn--cancel" onClick={onCancel}>Cancel</button>
          <button className="dm-expr-btn dm-expr-btn--save" onClick={handleSave}>
            Save Expression
          </button>
        </div>
      </div>
    </div>
  );
}
