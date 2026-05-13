import { useState, useMemo, useCallback, useEffect, useRef, lazy, Suspense, useId } from 'react';
import { evaluateMapperExpression } from './utils/mapperExpressionEvaluator';
import { debugExpression } from './utils/expressionStepDebugger';
import type { EvalStep } from './utils/expressionStepDebugger';
import { groupedExpressionFunctions, EXPRESSION_CATEGORIES } from '../../../features/workflow/utils/expressionFunctions';
import type { ExpressionFunction } from '../../../features/workflow/utils/expressionFunctions/types';
import { TRANSFORMATION_LIBRARY, searchTemplates } from './utils/transformationLibrary';
import {
  loadExpressionSnippets,
  saveExpressionSnippet,
  deleteExpressionSnippet,
  type ExpressionSnippet,
} from './utils/expressionSnippets';
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

function toExpressionReference(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '$.value';
  if (trimmed.startsWith('$')) return trimmed;
  const normalized = trimmed.replace(/^\.+/, '');
  return `$.${normalized}`;
}

function extractTemplateFunctionNames(template: string): string[] {
  const matches = template.match(/\$[a-zA-Z_][a-zA-Z0-9_]*/g) ?? [];
  return Array.from(new Set(matches));
}

function fixedValueToExpression(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed === 'true' || trimmed === 'false' || trimmed === 'null') return trimmed;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return trimmed;
  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      JSON.parse(trimmed);
      return trimmed;
    } catch {
      // fall through and store as string literal
    }
  }
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith('\'') && trimmed.endsWith('\''))
  ) {
    return JSON.stringify(trimmed.slice(1, -1));
  }
  return JSON.stringify(trimmed);
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
  const [isExpanded, setIsExpanded] = useState(false);
  const [expression, setExpression] = useState(mapping.expression ?? mapping.sourcePath);
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('All');
  const [functionSearch, setFunctionSearch] = useState('');
  const [selectedFn, setSelectedFn] = useState<ExpressionFunction | null>(null);
  const [templateQuery, setTemplateQuery] = useState('');
  const [composeTemplates, setComposeTemplates] = useState(false);
  const [fixedValueInput, setFixedValueInput] = useState('');
  const [snippets, setSnippets] = useState<ExpressionSnippet[]>([]);
  const [snippetName, setSnippetName] = useState('');
  const [snippetBusy, setSnippetBusy] = useState(false);
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const completionDisposableRef = useRef<IDisposable | null>(null);
  const prevMappingIdRef = useRef(mapping.id);
  const expressionRef = useRef(expression);
  expressionRef.current = expression;
  const handleSaveRef = useRef<() => void>(() => {});

  const handleUndo = useCallback(() => {
    const editor = editorRef.current;
    if (editor) {
      editor.trigger('keyboard', 'undo', null);
      editor.focus();
    }
  }, []);

  const handleRedo = useCallback(() => {
    const editor = editorRef.current;
    if (editor) {
      editor.trigger('keyboard', 'redo', null);
      editor.focus();
    }
  }, []);

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

  const supportedFunctionNames = useMemo(
    () => new Set(allFunctions.map((fn) => (fn.name.startsWith('$') ? fn.name : `$${fn.name}`))),
    [allFunctions],
  );

  const templateCandidates = useMemo(() => {
    const base = templateQuery.trim() ? searchTemplates(templateQuery.trim()) : TRANSFORMATION_LIBRARY;
    return [...base]
      .filter((template) => {
        const fnNames = extractTemplateFunctionNames(template.template);
        return fnNames.every((name) => supportedFunctionNames.has(name));
      })
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 8);
  }, [templateQuery, supportedFunctionNames]);

  useEffect(() => {
    if (prevMappingIdRef.current !== mapping.id) {
      prevMappingIdRef.current = mapping.id;
      setExpression(mapping.expression ?? mapping.sourcePath);
    }
  }, [mapping.id, mapping.expression, mapping.sourcePath]);

  useEffect(() => {
    let cancelled = false;
    void loadExpressionSnippets().then((loaded) => {
      if (!cancelled) setSnippets(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const grouped = useMemo(() => {
    const base = groupedExpressionFunctions();
    if (!customFunctions?.length) return base;
    const customGroup = { category: 'Custom', functions: customFunctions };
    return [...base, customGroup];
  }, [customFunctions]);

  const filteredGroups = useMemo(() => {
    const byCategory = activeCategory === 'All' ? grouped : grouped.filter((g) => g.category === activeCategory);
    const q = functionSearch.trim().toLowerCase();
    if (!q) return byCategory;
    return byCategory
      .map((g) => ({
        ...g,
        functions: g.functions.filter((fn) =>
          fn.name.toLowerCase().includes(q) || fn.description.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.functions.length > 0);
  }, [grouped, activeCategory, functionSearch]);

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

    if (fn.args.length === 0) {
      setExpression(`${fnCall}()`);
      return;
    }

    const currentExpr = expression.trim();
    const baseInput = currentExpr
      ? currentExpr
      : toExpressionReference(mapping.sourcePath);

    const args = fn.args.map((arg, index) => {
      if (index === 0) return baseInput;
      const type = arg.type.toLowerCase();
      if (type.includes('string')) return '"value"';
      if (type.includes('number')) return '0';
      if (type.includes('bool')) return 'false';
      return arg.name;
    });

    setExpression(`${fnCall}(${args.join(', ')})`);
  }, [expression, mapping.sourcePath]);

  const handleInsertTemplate = useCallback((template: string) => {
    const sourceRef = toExpressionReference(mapping.sourcePath);
    const currentExpr = expression.trim();
    const pipelineInput = composeTemplates && currentExpr
      ? currentExpr
      : sourceRef;
    setExpression(template.replace(/\$\.PATH/g, pipelineInput));
  }, [mapping.sourcePath, composeTemplates, expression]);

  const handleComposeWithFunction = useCallback((fn: ExpressionFunction) => {
    const fnCall = fn.name.startsWith('$') ? fn.name : `$${fn.name}`;
    if (fn.args.length === 0) {
      setExpression(`${fnCall}()`);
      return;
    }
    const baseInput = expression.trim()
      ? toExpressionReference(expression)
      : toExpressionReference(mapping.sourcePath);
    const args = fn.args.map((arg, index) => {
      if (index === 0) return baseInput;
      const type = arg.type.toLowerCase();
      if (type.includes('string')) return '"value"';
      if (type.includes('number')) return '0';
      if (type.includes('bool')) return 'false';
      return arg.name;
    });
    setExpression(`${fnCall}(${args.join(', ')})`);
  }, [expression, mapping.sourcePath]);

  const handleApplyFixedValue = useCallback(() => {
    const literal = fixedValueToExpression(fixedValueInput);
    if (!literal) return;
    setExpression(literal);
  }, [fixedValueInput]);

  const handleSaveSnippet = useCallback(async () => {
    const name = snippetName.trim();
    if (!name || !expression.trim()) return;
    setSnippetBusy(true);
    try {
      const next = await saveExpressionSnippet(name, expression);
      setSnippets(next);
      setSnippetName('');
    } finally {
      setSnippetBusy(false);
    }
  }, [snippetName, expression]);

  const handleDeleteSnippet = useCallback(async (snippetId: string) => {
    setSnippetBusy(true);
    try {
      const next = await deleteExpressionSnippet(snippetId);
      setSnippets(next);
    } finally {
      setSnippetBusy(false);
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
    <div className={`dm-expr-overlay ${isExpanded ? 'dm-expr--expanded' : ''}`} onKeyDown={handleKeyDown} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="dm-expr-modal">
        <div className="dm-expr-header">
          <span id={titleId} className="dm-expr-title">Expression Editor</span>
          <span className="dm-expr-target-path">Target: {mapping.targetPath}</span>
          <div className="dm-expr-header-actions">
            <button
              type="button"
              className="dm-expr-action-btn"
              onClick={handleUndo}
              title="Undo (Ctrl+Z)"
              aria-label="Undo"
            >
              ↶
            </button>
            <button
              type="button"
              className="dm-expr-action-btn"
              onClick={handleRedo}
              title="Redo (Ctrl+Shift+Z)"
              aria-label="Redo"
            >
              ↷
            </button>
            <span className="dm-expr-action-divider" />
            <button
              type="button"
              className="dm-expr-action-btn"
              onClick={() => setIsExpanded((v) => !v)}
              title={isExpanded ? 'Shrink to default size' : 'Expand to full screen'}
              aria-label={isExpanded ? 'Shrink' : 'Expand'}
            >
              {isExpanded ? '⊟' : '⊞'}
            </button>
          </div>
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
            <input
              className="dm-expr-fn-search"
              value={functionSearch}
              onChange={(e) => setFunctionSearch(e.target.value)}
              placeholder="Search functions…"
              aria-label="Search functions"
            />
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
              {filteredGroups.length === 0 && functionSearch.trim() && (
                <div className="dm-expr-fn-empty">No functions matching "{functionSearch.trim()}"</div>
              )}
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
            <div className="dm-expr-fixed-value">
              <div className="dm-expr-fixed-value-label">Fixed Value</div>
              <div className="dm-expr-fixed-value-controls">
                <input
                  className="dm-expr-fixed-value-input"
                  value={fixedValueInput}
                  onChange={(e) => setFixedValueInput(e.target.value)}
                  placeholder='e.g. hello, 42, true, {"x":1}'
                  aria-label="Fixed value input"
                />
                <button
                  type="button"
                  className="dm-expr-inline-btn"
                  onClick={handleApplyFixedValue}
                  disabled={!fixedValueInput.trim()}
                >
                  Use value
                </button>
              </div>
            </div>
            <div className="dm-expr-template-panel">
              <div className="dm-expr-template-header">
                <span className="dm-expr-template-title">Function Templates</span>
                <label className="dm-expr-template-compose">
                  <input
                    type="checkbox"
                    checked={composeTemplates}
                    onChange={(e) => setComposeTemplates(e.target.checked)}
                  />
                  Compose current
                </label>
              </div>
              <input
                className="dm-expr-template-search"
                value={templateQuery}
                onChange={(e) => setTemplateQuery(e.target.value)}
                placeholder="Search templates"
                aria-label="Search function templates"
              />
              <div className="dm-expr-template-list">
                {templateCandidates.length > 0 ? (
                  templateCandidates.map((template) => (
                    <button
                      type="button"
                      key={template.id}
                      className="dm-expr-template-item"
                      onClick={() => handleInsertTemplate(template.template)}
                      title={template.description}
                    >
                      <span className="dm-expr-template-item-label">{template.label}</span>
                      <span className="dm-expr-template-item-category">{template.category}</span>
                    </button>
                  ))
                ) : (
                  <div className="dm-expr-template-empty">No templates match.</div>
                )}
              </div>
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
                <button
                  type="button"
                  className="dm-expr-inline-btn"
                  onClick={() => handleComposeWithFunction(selectedFn)}
                >
                  Compose with current
                </button>
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
                  onChange={(e) => setSnippetName(e.target.value)}
                  placeholder="Snippet name"
                  aria-label="Snippet name"
                />
                <button
                  type="button"
                  className="dm-expr-inline-btn"
                  onClick={() => void handleSaveSnippet()}
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
                          onClick={() => setExpression(snippet.expression)}
                        >
                          Use
                        </button>
                        <button
                          type="button"
                          className="dm-expr-inline-btn dm-expr-inline-btn--danger"
                          onClick={() => void handleDeleteSnippet(snippet.id)}
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
