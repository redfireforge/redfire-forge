import { useState, useMemo, useCallback, useEffect, useRef, lazy, Suspense, useId } from 'react';
import { evaluateMapperExpression } from './utils/mapperExpressionEvaluator';
import { debugExpression } from './utils/expressionStepDebugger';
import type { EvalStep } from './utils/expressionStepDebugger';
import { groupedExpressionFunctions, EXPRESSION_CATEGORIES } from '../../../features/workflow/utils/expressionFunctions';
import type { ExpressionFunction } from '../../../features/workflow/utils/expressionFunctions/types';
import type { MapperSource, Mapping } from './types';
import type { OnMount } from '@monaco-editor/react';
import type { editor as MonacoEditor, IDisposable, Position } from 'monaco-editor';
import { buildJsonTree, getAllLeafPaths } from '../../utils/jsonTreeModel';
import { coerceSampleData } from './utils/mapperParsing';

const Editor = lazy(() => import('@monaco-editor/react'));

interface ExpressionEditorModalProps {
  mapping: Mapping;
  sources: MapperSource[];
  activeSourceId: string;
  customFunctions?: ExpressionFunction[];
  onSave: (mappingId: string, expression: string) => void;
  onCancel: () => void;
}

type CategoryFilter = (typeof EXPRESSION_CATEGORIES)[number] | 'All';

function getSourceLeafPaths(sources: MapperSource[], activeSourceId: string): string[] {
  const src = sources.find((s) => s.id === activeSourceId);
  if (src?.sampleData == null) return [];
  const parsed = coerceSampleData(src.sampleData);
  if (parsed == null) return [];
  try {
    const tree = buildJsonTree(parsed, '', '');
    return getAllLeafPaths(tree);
  } catch {
    return [];
  }
}

export default function ExpressionEditorModal({
  mapping,
  sources,
  activeSourceId,
  customFunctions,
  onSave,
  onCancel,
}: ExpressionEditorModalProps) {
  const titleId = useId();
  const [expression, setExpression] = useState(mapping.expression ?? mapping.sourcePath);
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('All');
  const [selectedFn, setSelectedFn] = useState<ExpressionFunction | null>(null);
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const completionDisposableRef = useRef<IDisposable | null>(null);
  const prevMappingIdRef = useRef(mapping.id);
  const expressionRef = useRef(expression);
  expressionRef.current = expression;
  const handleSaveRef = useRef<() => void>(() => {});

  const allFunctions = useMemo(() => {
    const base = groupedExpressionFunctions();
    const allFns: ExpressionFunction[] = [];
    for (const g of base) allFns.push(...g.functions);
    if (customFunctions?.length) allFns.push(...customFunctions);
    return allFns;
  }, [customFunctions]);

  const sourcePathsRef = useRef<string[]>([]);
  sourcePathsRef.current = useMemo(
    () => getSourceLeafPaths(sources, activeSourceId),
    [sources, activeSourceId],
  );

  const allFunctionsRef = useRef(allFunctions);
  allFunctionsRef.current = allFunctions;

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
  const [debugSteps, setDebugSteps] = useState<EvalStep[] | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [showDebugger, setShowDebugger] = useState(false);

  useEffect(() => {
    if (!expression.trim()) {
      setPreview({ display: '', error: undefined });
      setDebugSteps(null);
      setShowDebugger(false);
      return;
    }
    const timer = setTimeout(() => {
      const result = evaluateMapperExpression(expression, sources, activeSourceId, customFunctions);
      setPreview({
        display: result.error ? `Error: ${result.error}` : result.preview,
        error: result.error,
      });
      if (showDebugger) {
        const debugResult = debugExpression(expression, sources, activeSourceId, customFunctions);
        setDebugSteps(debugResult.steps);
        setActiveStep(debugResult.steps.length - 1);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [expression, sources, activeSourceId, customFunctions, showDebugger]);

  const handleToggleDebugger = useCallback(() => {
    setShowDebugger((prev) => {
      if (prev) {
        setDebugSteps(null);
        setActiveStep(0);
        return false;
      }
      if (!expression.trim()) return false;
      const debugResult = debugExpression(expression, sources, activeSourceId, customFunctions);
      setDebugSteps(debugResult.steps);
      setActiveStep(debugResult.steps.length - 1);
      return true;
    });
  }, [expression, sources, activeSourceId, customFunctions]);

  const handleInsertFunction = useCallback((fn: ExpressionFunction) => {
    setSelectedFn(fn);
    const fnCall = fn.name.startsWith('$') ? fn.name : `$${fn.name}`;
    const template = fn.args.length > 0
      ? `${fnCall}(${fn.args.map((a) => a.name).join(', ')})`
      : `${fnCall}()`;

    const editor = editorRef.current;
    if (editor) {
      const selection = editor.getSelection();
      if (selection) {
        editor.executeEdits('insert-function', [{
          range: selection,
          text: template,
        }]);
        editor.focus();
      }
    } else {
      setExpression((prev) => prev + template);
    }
  }, []);

  const handleSave = useCallback(() => {
    if (preview.error) {
      if (!window.confirm('This expression has evaluation errors. Save anyway?')) return;
    }
    onSave(mapping.id, expression);
  }, [mapping.id, expression, onSave, preview.error]);
  handleSaveRef.current = handleSave;

  const handleEditorDidMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;

    const currentModel = editor.getModel();
    if (currentModel && expressionRef.current && currentModel.getValue() !== expressionRef.current) {
      currentModel.setValue(expressionRef.current);
    }

    completionDisposableRef.current?.dispose();
    completionDisposableRef.current = monaco.languages.registerCompletionItemProvider('plaintext', {
      triggerCharacters: ['$', '.'],
      provideCompletionItems(model: MonacoEditor.ITextModel, position: Position) {
        const textUntilPosition = model.getValueInRange({
          startLineNumber: position.lineNumber,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        });

        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        if (/\$\.\s*$/.test(textUntilPosition) || /\$\.[a-zA-Z0-9_.[\]]*$/.test(textUntilPosition)) {
          return {
            suggestions: sourcePathsRef.current.map((p) => ({
              label: `$.${p}`,
              kind: monaco.languages.CompletionItemKind.Field,
              insertText: p,
              detail: 'Source field',
              documentation: `Reference to source path "${p}"`,
              range,
            })),
          };
        }

        if (/\$[a-zA-Z]*$/.test(textUntilPosition)) {
          return {
            suggestions: allFunctionsRef.current.map((fn) => {
              const fnCall = fn.name.startsWith('$') ? fn.name : `$${fn.name}`;
              const snippet = fn.args.length > 0
                ? `${fnCall}(\${1:${fn.args[0].name}})`
                : `${fnCall}()`;
              return {
                label: fnCall,
                kind: monaco.languages.CompletionItemKind.Function,
                insertText: snippet,
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                detail: `${fn.category} — ${fn.returnType}`,
                documentation: `${fn.description}\n\n${fn.signature}`,
                range,
              };
            }),
          };
        }

        return { suggestions: [] };
      },
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      handleSaveRef.current();
    });

    editor.addCommand(monaco.KeyCode.Escape, () => {
      onCancel();
    });

    editor.focus();
  }, [onCancel]);

  useEffect(() => {
    return () => {
      completionDisposableRef.current?.dispose();
    };
  }, []);

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
    <div className="dm-expr-overlay" onKeyDown={handleKeyDown} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="dm-expr-modal">
        <div className="dm-expr-header">
          <span id={titleId} className="dm-expr-title">Expression Editor</span>
          <span className="dm-expr-target-path">Target: {mapping.targetPath}</span>
          <button className="dm-expr-close" onClick={onCancel} aria-label="Close expression editor">×</button>
        </div>

        <div className="dm-expr-body">
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

          <div className="dm-expr-editor-area">
            <div className="dm-expr-editor-label">Expression</div>
            <Suspense fallback={
              <textarea
                className="dm-expr-textarea"
                value={expression}
                onChange={(e) => setExpression(e.target.value)}
                placeholder="Loading editor…"
                aria-label="Expression"
                spellCheck={false}
                rows={4}
              />
            }>
              <Editor
                height="120px"
                language="plaintext"
                theme="vs-dark"
                value={expression}
                onChange={(val) => setExpression(val ?? '')}
                onMount={handleEditorDidMount}
                options={{
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  lineNumbers: 'off',
                  folding: false,
                  wordWrap: 'on',
                  fontSize: 13,
                  renderLineHighlight: 'none',
                  overviewRulerLanes: 0,
                  hideCursorInOverviewRuler: true,
                  scrollbar: { vertical: 'auto', horizontal: 'hidden' },
                  padding: { top: 8, bottom: 8 },
                  suggest: { showIcons: true },
                  quickSuggestions: true,
                  tabSize: 2,
                }}
              />
            </Suspense>
            <div className="dm-expr-source-hint">
              Type <code>$.</code> for source fields, <code>$</code> for functions. <code>Ctrl+Enter</code> to save.
            </div>

            <div className="dm-expr-preview-section">
              <div className="dm-expr-preview-label">
                Live Preview
                <button
                  className={`dm-expr-debug-toggle ${showDebugger ? 'dm-expr-debug-toggle--active' : ''}`}
                  onClick={handleToggleDebugger}
                  title={showDebugger ? 'Hide step-through debugger' : 'Debug expression step by step'}
                  aria-pressed={showDebugger}
                >
                  Step Debug
                </button>
              </div>
              <div className={`dm-expr-preview-value ${preview.error ? 'dm-expr-preview-value--error' : ''}`} aria-live="polite" aria-atomic="true">
                {preview.display || (expression.trim() ? 'Evaluating…' : 'Enter an expression above')}
              </div>
            </div>
            {showDebugger && debugSteps && debugSteps.length > 0 && (
              <div className="dm-expr-step-debugger" role="region" aria-label="Step-through debugger">
                <div className="dm-expr-step-controls">
                  <button
                    className="dm-expr-step-btn"
                    disabled={activeStep <= 0}
                    onClick={() => setActiveStep((s) => Math.max(0, s - 1))}
                    aria-label="Previous step"
                  >
                    ◀
                  </button>
                  <span className="dm-expr-step-counter">
                    Step {activeStep + 1} / {debugSteps.length}
                  </span>
                  <button
                    className="dm-expr-step-btn"
                    disabled={activeStep >= debugSteps.length - 1}
                    onClick={() => setActiveStep((s) => Math.min(debugSteps.length - 1, s + 1))}
                    aria-label="Next step"
                  >
                    ▶
                  </button>
                </div>
                <div className="dm-expr-step-list">
                  {debugSteps.map((step, i) => (
                    <div
                      key={i}
                      className={`dm-expr-step ${i === activeStep ? 'dm-expr-step--active' : ''} ${i < activeStep ? 'dm-expr-step--done' : ''} ${step.error ? 'dm-expr-step--error' : ''}`}
                      onClick={() => setActiveStep(i)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveStep(i); } }}
                    >
                      <span className="dm-expr-step-label">{step.label}</span>
                      <code className="dm-expr-step-expression">{step.expression}</code>
                      <span className="dm-expr-step-arrow">→</span>
                      <code
                        className={`dm-expr-step-value ${step.error ? 'dm-expr-step-value--error' : ''}`}
                        title={step.displayValue}
                      >
                        {step.displayValue.length > 60 ? step.displayValue.slice(0, 59) + '…' : step.displayValue}
                      </code>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

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
