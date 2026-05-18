import { useState, useMemo, useCallback, useEffect, useRef, lazy, Suspense, useId } from 'react';
import { createPortal } from 'react-dom';
import { evaluateMapperExpression } from './utils/mapperExpressionEvaluator';
import { debugExpression } from './utils/expressionStepDebugger';
import type { EvalStep } from './utils/expressionStepDebugger';
import { prettyDebugValue, truncateDebugValue } from './utils/expressionDebugHelpers';
import ExpressionDebugDetailModal from './ExpressionDebugDetailModal';
import { useTemporarySourceOverride } from './hooks/useTemporarySourceOverride';
import type { ExpressionFunction } from '../../../features/workflow/utils/expressionFunctions/types';
import { useExpressionFunctionCatalog } from './hooks/useExpressionFunctionCatalog';
import {
  loadExpressionSnippets,
  saveExpressionSnippet,
  deleteExpressionSnippet,
  type ExpressionSnippet,
} from './utils/expressionSnippets';
import type { MapperSource, Mapping } from './types';
import type { OnMount } from '@monaco-editor/react';
import type { editor as MonacoEditor, IDisposable, Position } from 'monaco-editor';
import {
  buildFunctionSnippet,
  fixedValueToExpression,
  getSourceLeafPaths,
  LAMBDA_INSERT_TEMPLATES,
  toExpressionReference,
} from './utils/expressionEditorHelpers';

const Editor = lazy(() => import('@monaco-editor/react'));

interface ExpressionEditorModalProps {
  mapping: Mapping;
  sources: MapperSource[];
  activeSourceId: string;
  customFunctions?: ExpressionFunction[];
  onSave: (mappingId: string, expression: string) => void;
  onCancel: () => void;
  onRename?: (mappingId: string, oldTargetPath: string, newTargetPath: string) => void;
}

type CategoryFilter = string;

export default function ExpressionEditorModal({
  mapping,
  sources,
  activeSourceId,
  customFunctions,
  onSave,
  onCancel,
  onRename,
}: ExpressionEditorModalProps) {
  const titleId = useId();
  const [isExpanded, setIsExpanded] = useState(false);
  const [expression, setExpression] = useState(mapping.expression ?? /* v8 ignore next */ mapping.sourcePath);
  const [targetNameValue, setTargetNameValue] = useState(mapping.targetPath);
  const targetNameRef = useRef<HTMLInputElement>(null);
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('All');
  const [functionSearch, setFunctionSearch] = useState('');
  const [selectedFn, setSelectedFn] = useState<ExpressionFunction | null>(null);
  /* v8 ignore next */
  const [templateQuery, setTemplateQuery] = useState('');
  const [composeTemplates, setComposeTemplates] = useState(false);
  const [fixedValueInput, setFixedValueInput] = useState('');
  const [snippets, setSnippets] = useState<ExpressionSnippet[]>([]);
  const [snippetName, setSnippetName] = useState('');
  const [snippetBusy, setSnippetBusy] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const completionDisposableRef = useRef<IDisposable | null>(null);
  const prevMappingIdRef = useRef(mapping.id);
  const expressionRef = useRef(expression);
  expressionRef.current = expression;
  const handleSaveRef = useRef<() => void>(() => {});

  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  /* v8 ignore next 20 */
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, input, select')) return;
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: dragOffset.x, origY: dragOffset.y };
    const handleMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      setDragOffset({
        x: dragRef.current.origX + ev.clientX - dragRef.current.startX,
        y: dragRef.current.origY + ev.clientY - dragRef.current.startY,
      });
    };
    const handleUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }, [dragOffset]);

  /* v8 ignore next 6 */
  const handleUndo = useCallback(() => {
    const editor = editorRef.current;
    if (editor) {
      editor.trigger('keyboard', 'undo', null);
      editor.focus();
    }
  }, []);

  /* v8 ignore next 6 */
  const handleRedo = useCallback(() => {
    const editor = editorRef.current;
    if (editor) {
      editor.trigger('keyboard', 'redo', null);
      editor.focus();
    }
  }, []);

  const {
    allFunctions, filteredGroups, allCategories, templateCandidates,
  } = useExpressionFunctionCatalog(customFunctions, activeCategory, functionSearch, templateQuery);

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
      setExpression(mapping.expression ?? /* v8 ignore next */ mapping.sourcePath);
      setTargetNameValue(mapping.targetPath);
    }
  }, [mapping.id, mapping.expression, mapping.sourcePath, mapping.targetPath]);

  const commitTargetName = useCallback(() => {
    const trimmed = targetNameValue.trim();
    if (trimmed && trimmed !== mapping.targetPath && onRename) {
      onRename(mapping.id, mapping.targetPath, trimmed);
    }
  }, [targetNameValue, mapping.id, mapping.targetPath, onRename]);

  useEffect(() => {
    let cancelled = false;
    void loadExpressionSnippets().then((loaded) => {
      if (!cancelled) setSnippets(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const [preview, setPreview] = useState<{ display: string; error?: string }>({ display: '', error: undefined });
  const [debugSteps, setDebugSteps] = useState<EvalStep[] | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [showDebugger, setShowDebugger] = useState(false);
  const [detailStep, setDetailStep] = useState<EvalStep | null>(null);
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());
  const {
    effectiveSources,
    showSourceEditor,
    tempSourceJson,
    sourceJsonError,
    setTempSourceJson,
    handleToggleSourceEditor,
  } = useTemporarySourceOverride(sources, activeSourceId);

  const toggleStepExpand = useCallback((idx: number) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }, []);

  const toggleExpandAll = useCallback(() => {
    if (!debugSteps) return;
    setExpandedSteps(prev => {
      if (prev.size === debugSteps.length) return new Set();
      return new Set(debugSteps.map((_, i) => i));
    });
  }, [debugSteps]);

  useEffect(() => {
    if (!expression.trim()) {
      setPreview({ display: '', error: undefined });
      setDebugSteps(null);
      setShowDebugger(false);
      return;
    }
    const timer = setTimeout(() => {
      const result = evaluateMapperExpression(expression, effectiveSources, activeSourceId, customFunctions);
      setPreview({
        display: result.error ? `Error: ${result.error}` : result.preview,
        error: result.error,
      });
      if (showDebugger) {
        const debugResult = debugExpression(expression, effectiveSources, activeSourceId, customFunctions);
        setDebugSteps(debugResult.steps);
        setActiveStep(debugResult.steps.length - 1);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [expression, effectiveSources, activeSourceId, customFunctions, showDebugger]);

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

    const lambdaTemplate = LAMBDA_INSERT_TEMPLATES[fnCall];
    if (lambdaTemplate) {
      setExpression(lambdaTemplate.replace('ARRAY', baseInput));
      return;
    }

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

    const lambdaTemplate = LAMBDA_INSERT_TEMPLATES[fnCall];
    if (lambdaTemplate) {
      setExpression(lambdaTemplate.replace('ARRAY', baseInput));
      return;
    }

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

  /* v8 ignore next 73 */
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
              const snippet = buildFunctionSnippet(fnCall, fn);
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
      /* v8 ignore next */
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

  /* v8 ignore next 10 */
  const fallbackTextarea = (
    <textarea
      className="dm-expr-textarea"
      value={expression}
      onChange={(e) => setExpression(e.target.value)}
      placeholder="Loading editor…"
      aria-label="Expression"
      spellCheck={false}
      rows={4}
    />
  );

  const portalTarget = useMemo(() => {
    /* v8 ignore next */
    return document.querySelector('.dm-modal-shell') ?? document.body;
  }, []);

  /* v8 ignore next 2 */
  const stepHeaderKeyDown = useCallback((i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleStepExpand(i); }
  }, [toggleStepExpand]);

  /* v8 ignore next 2 */
  const stepResultKeyDown = useCallback((step: EvalStep, e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetailStep(step); }
  }, []);

  return createPortal(
    <div className={`dm-expr-overlay ${isExpanded ? 'dm-expr--expanded' : ''}`} onKeyDown={handleKeyDown} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div ref={modalRef} className="dm-expr-modal" style={!isExpanded && (dragOffset.x || dragOffset.y) ? { transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)` } : undefined}>
        <div className="dm-expr-header" onMouseDown={!isExpanded ? handleDragStart : undefined} style={!isExpanded ? { cursor: 'grab' } : undefined}>
          <span id={titleId} className="dm-expr-title">Expression Editor</span>
          {!onRename && (
            <span className="dm-expr-target-path">Target: {mapping.targetPath}</span>
          )}
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
              onClick={() => {
                /* v8 ignore next */
                if (modalRef.current) {
                  modalRef.current.style.width = '';
                  modalRef.current.style.height = '';
                }
                setIsExpanded((v) => !v);
                setDragOffset({ x: 0, y: 0 });
              }}
              title={isExpanded ? 'Shrink to default size' : 'Expand to full screen'}
              aria-label={isExpanded ? 'Shrink' : 'Expand'}
            >
              {isExpanded ? '⊟' : '⊞'}
            </button>
          </div>
        </div>

        {onRename && (
          <div className="dm-expr-variable-row">
            <label className="dm-expr-variable-label" htmlFor="dm-expr-var-name">Variable Name</label>
            <input
              id="dm-expr-var-name"
              ref={targetNameRef}
              className="dm-expr-variable-input"
              value={targetNameValue}
              onChange={(e) => setTargetNameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); commitTargetName(); }
                else if (e.key === 'Escape') { e.preventDefault(); setTargetNameValue(mapping.targetPath); }
                e.stopPropagation();
              }}
              onBlur={commitTargetName}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              placeholder="e.g. myVariable"
              aria-label="Variable name (target path)"
            />
          </div>
        )}

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
                      title="Click to insert template (see documentation on the right)"
                    >
                      <span className="dm-expr-fn-name">{fn.name}</span>
                      {fn.args.some(a => a.type === 'function') && (
                        <span className="dm-expr-fn-lambda-badge">λ</span>
                      )}
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
            <Suspense fallback={fallbackTextarea}>
              <Editor
                height="120px"
                language="plaintext"
                theme="vs-dark"
                value={expression}
                onChange={(val) => setExpression(val ?? /* v8 ignore next */ '')}
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
                <button
                  className={`dm-expr-debug-toggle ${showSourceEditor ? 'dm-expr-debug-toggle--active' : ''}`}
                  onClick={handleToggleSourceEditor}
                  title={showSourceEditor ? 'Hide source editor' : 'Temporarily edit source JSON for testing'}
                  aria-pressed={showSourceEditor}
                >
                  Edit Source
                </button>
              </div>
              <div className={`dm-expr-preview-value ${preview.error ? 'dm-expr-preview-value--error' : ''}`} aria-live="polite" aria-atomic="true">
                {preview.display || (expression.trim() ? 'Evaluating…' : 'Enter an expression above')}
              </div>
              {showSourceEditor && (
                <div className="dm-expr-source-editor">
                  <div className="dm-expr-source-editor-header">
                    <span className="dm-expr-source-editor-label">Temporary Source JSON</span>
                    {sourceJsonError && <span className="dm-expr-source-editor-error">{sourceJsonError}</span>}
                    <span className="dm-expr-source-editor-hint">Changes are not saved</span>
                  </div>
                  <textarea
                    className="dm-expr-source-editor-textarea"
                    value={tempSourceJson}
                    onChange={(e) => setTempSourceJson(e.target.value)}
                    spellCheck={false}
                    aria-label="Temporary source JSON editor"
                  />
                </div>
              )}
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
                  <button
                    className="dm-expr-step-btn dm-expr-step-btn--toggle-all"
                    onClick={toggleExpandAll}
                    aria-label={expandedSteps.size === debugSteps.length ? 'Collapse all' : 'Expand all'}
                  >
                    {expandedSteps.size === debugSteps.length ? '▴ Collapse All' : '▾ Expand All'}
                  </button>
                </div>
                <div className="dm-expr-step-list">
                  {debugSteps.map((step, i) => {
                    const isOpen = expandedSteps.has(i);
                    return (
                      <div
                        key={i}
                        className={`dm-expr-step ${i === activeStep ? 'dm-expr-step--active' : ''} ${i < activeStep ? 'dm-expr-step--done' : ''} ${step.error ? 'dm-expr-step--error' : ''}`}
                      >
                        <span className="dm-expr-step-badge">{i + 1}</span>
                        <div className="dm-expr-step-content">
                          <div
                            className="dm-expr-step-header"
                            onClick={() => toggleStepExpand(i)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => stepHeaderKeyDown(i, e)}
                          >
                            <span className={`dm-expr-step-chevron ${isOpen ? 'dm-expr-step-chevron--open' : ''}`}>▸</span>
                            <span className="dm-expr-step-label">{step.label}</span>
                            <code className="dm-expr-step-expression">{truncateDebugValue(step.expression)}</code>
                          </div>
                          {isOpen && (
                            <div
                              className="dm-expr-step-result"
                              onClick={() => setDetailStep(step)}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => stepResultKeyDown(step, e)}
                              title="Click to view full detail"
                            >
                              <span className="dm-expr-step-arrow">→</span>
                              <code className={`dm-expr-step-value ${step.error ? 'dm-expr-step-value--error' : ''}`}>
                                {prettyDebugValue(step.displayValue)}
                              </code>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
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
                <div className="dm-expr-doc-actions">
                  <button
                    type="button"
                    className="dm-expr-inline-btn dm-expr-inline-btn--primary"
                    onClick={() => handleInsertFunction(selectedFn)}
                  >
                    Insert
                  </button>
                  <button
                    type="button"
                    className="dm-expr-inline-btn"
                    onClick={() => handleComposeWithFunction(selectedFn)}
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

      {detailStep && (
        <ExpressionDebugDetailModal step={detailStep} onClose={() => setDetailStep(null)} />
      )}
    </div>,
    portalTarget,
  );
}
