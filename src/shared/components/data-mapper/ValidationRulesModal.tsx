import { useRef, useState, useCallback, useEffect, useMemo, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import ValidationCodeEditor, { type LineVerifyResult } from './ValidationCodeEditor';
import DslReferencePanel from './DslReferencePanel';
import { useValidationRulesModal, type VrModalMode } from './hooks/useValidationRulesModal';
import type { ParseError } from './utils/validationDsl';
import { parseDsl, dslToModel, countDslRuleLines, DSL_ASSERTION_TYPES } from './utils/validationDsl';
import { evaluateFieldOperator, evaluateAssertions } from '../../../engine/validator';
import { getByPath } from '../../utils/jsonPath';
import { debugExpression, type EvalStep } from './utils/expressionStepDebugger';
import type { MapperSource } from './types';
import '../../../styles/validation-rules-modal.css';

interface InlineVerifyResult {
  lineNumber: number;
  passed: boolean;
  actual?: string;
  expected?: string;
  path?: string;
  expression?: string;
  debugSteps?: EvalStep[];
  inputData?: unknown;
}

interface ValidationRulesModalProps {
  value: string;
  onChange: (text: string) => void;
  errors: ParseError[];
  samplePaths: string[];
  onClose: () => void;
  onJumpToNode?: (path: string) => void;
  portalContainerRef?: RefObject<HTMLDivElement | null>;
  verifyStatus?: 'idle' | 'running' | 'complete';
  verifyPassedCount?: number;
  verifyFailedCount?: number;
  lineResults?: LineVerifyResult[];
  sampleResponseData?: unknown;
  unorderedArrays?: boolean;
}

export default function ValidationRulesModal({
  value,
  onChange,
  errors,
  samplePaths,
  onClose,
  onJumpToNode,
  portalContainerRef,
  verifyStatus,
  verifyPassedCount = 0,
  verifyFailedCount = 0,
  lineResults = [],
  sampleResponseData,
  unorderedArrays: _unorderedArrays = false,
}: ValidationRulesModalProps) {
  const {
    mode,
    setMode,
    referenceVisible,
    toggleReference,
    dockedHeight,
    onDockedResizeStart,
    floatPos,
    floatSize,
    onFloatDragStart,
    onFloatResizeStart,
    onRightEdgeResizeStart,
  } = useValidationRulesModal();

  const editorRef = useRef<import('monaco-editor').editor.IStandaloneCodeEditor | null>(null);
  const revertValueRef = useRef(value);
  const [localText, setLocalText] = useState(value);
  const [localErrors, setLocalErrors] = useState<ParseError[]>(errors);
  const userEditedRef = useRef(false);
  const lastSyncedValueRef = useRef(value);
  const lastSyncedErrorsRef = useRef(errors);

  // Sync from external prop when user hasn't made local edits
  if (value !== lastSyncedValueRef.current && !userEditedRef.current) {
    lastSyncedValueRef.current = value;
    setLocalText(value);
    setLocalErrors(errors);
    lastSyncedErrorsRef.current = errors;
    revertValueRef.current = value;
  }
  // Also sync errors when value is unchanged but errors arrive later (e.g. on reopen)
  if (errors !== lastSyncedErrorsRef.current && !userEditedRef.current) {
    lastSyncedErrorsRef.current = errors;
    setLocalErrors(errors);
  }

  const handleLocalChange = useCallback((text: string) => {
    if (!userEditedRef.current) {
      revertValueRef.current = localText;
    }
    userEditedRef.current = true;
    setLocalText(text);
    const { errors: parsed } = parseDsl(text);
    setLocalErrors(parsed);
  }, [localText]);

  const handleSave = useCallback(() => {
    onChange(localText);
    onClose();
  }, [localText, onChange, onClose]);

  const handleCancel = useCallback(() => {
    if (userEditedRef.current) {
      onChange(revertValueRef.current);
    }
    onClose();
  }, [onChange, onClose]);

  const handleInsert = useCallback((text: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    const model = editor.getModel();
    const pos = editor.getPosition();
    if (!pos || !model) return;

    const lineContent = model.getLineContent(pos.lineNumber);
    const textBeforeCursor = lineContent.slice(0, pos.column - 1).trim();

    let insertText = text;
    // If cursor is on a line that already has a path, only insert the operator
    if (textBeforeCursor && !textBeforeCursor.startsWith('#')) {
      const match = text.match(/^\S+\s{2,}(\S+)/);
      if (match) {
        insertText = '  ' + match[1] + '  ';
      }
    }

    editor.executeEdits('dsl-ref-insert', [{
      range: {
        startLineNumber: pos.lineNumber,
        startColumn: pos.column,
        endLineNumber: pos.lineNumber,
        endColumn: pos.column,
      },
      text: textBeforeCursor ? insertText : insertText + '\n',
      forceMoveMarkers: true,
    }]);
    editor.focus();
  }, []);

  const handleEditorMount = useCallback((editor: import('monaco-editor').editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const editor = editorRef.current;
      if (editor) {
        const suggestWidget = editor.getDomNode()?.querySelector('.editor-widget.suggest-widget.visible');
        if (suggestWidget) return;
      }
      handleCancel();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleCancel]);

  const ruleCount = useMemo(() => countDslRuleLines(localText), [localText]);
  const errorCount = localErrors.length;

  // ── Inline Verify ──
  const [inlineResults, setInlineResults] = useState<InlineVerifyResult[]>([]);
  const [inlineVerifyStatus, setInlineVerifyStatus] = useState<'idle' | 'complete'>('idle');
  const [showResultsStrip, setShowResultsStrip] = useState(false);

  const handleVerifyInline = useCallback(() => {
    const responseBody = sampleResponseData != null
      ? (typeof sampleResponseData === 'string' ? (() => { try { return JSON.parse(sampleResponseData); } catch { return undefined; } })() : sampleResponseData)
      : undefined;

    if (responseBody === undefined) {
      setInlineResults([]);
      setInlineVerifyStatus('complete');
      return;
    }

    // Helper: enrich a displayValue when path resolved to undefined
    const enrichUndefined = (path: string, rootData: unknown): string => {
      const segments = path.replace(/^\$\./, '').split('.');
      let parent: unknown = rootData;
      let resolvedSoFar = '$';
      for (let s = 0; s < segments.length - 1; s++) {
        const seg = segments[s];
        parent = getByPath(parent, seg);
        resolvedSoFar += '.' + seg;
        if (parent === undefined) break;
      }
      if (parent !== undefined && typeof parent === 'object' && parent !== null) {
        const keys = Array.isArray(parent)
          ? `Array[${(parent as unknown[]).length}]`
          : Object.keys(parent as Record<string, unknown>).slice(0, 12).join(', ');
        return `undefined  (at ${resolvedSoFar}: ${keys})`;
      }
      return 'undefined';
    };

    const { rules } = parseDsl(localText);
    const model = dslToModel(rules);
    const results: InlineVerifyResult[] = [];

    // Evaluate field assertions
    for (const field of model.fields) {
      const rule = rules.find(r => r.path && (`$.${r.path}` === field.jsonPath || r.path === field.jsonPath.replace(/^\$\.?/, '')));
      const lineNumber = rule?.lineNumber ?? 0;
      if (!lineNumber) continue;

      const actualValue = getByPath(responseBody, field.jsonPath);
      const operator = field.operator ?? 'equals';
      const evalResult = evaluateFieldOperator(
        actualValue,
        operator,
        field.operatorValue,
        field.expectedValue,
      );
      const effectivePass = field.negate ? !evalResult.pass : evalResult.pass;

      // Build debug steps for field assertions
      const fieldDebugSteps: EvalStep[] = [
        {
          label: 'Path Resolution',
          expression: field.jsonPath,
          value: actualValue,
          displayValue: actualValue !== undefined
            ? (typeof actualValue === 'object' ? JSON.stringify(actualValue)?.slice(0, 80) + (JSON.stringify(actualValue).length > 80 ? '…' : '') : String(actualValue))
            : enrichUndefined(field.jsonPath, responseBody),
          error: actualValue === undefined ? 'path not found' : undefined,
        },
        {
          label: 'Operator',
          expression: `${field.negate ? 'NOT ' : ''}${operator}`,
          value: field.operatorValue ?? field.expectedValue,
          displayValue: field.operatorValue ?? field.expectedValue ?? '(no value)',
        },
        {
          label: 'Result',
          expression: `${evalResult.actual} ${field.negate ? 'NOT ' : ''}${operator} ${evalResult.expected}`,
          value: effectivePass,
          displayValue: effectivePass ? 'PASS' : 'FAIL',
          error: effectivePass ? undefined : 'assertion failed',
        },
      ];

      results.push({
        lineNumber,
        passed: effectivePass,
        actual: evalResult.actual,
        expected: evalResult.expected,
        path: field.jsonPath,
        inputData: { [field.jsonPath]: actualValue },
        debugSteps: fieldDebugSteps,
      });
    }

    // Evaluate DSL assertions (arrayLength, each, contains, custom, etc.)
    const dslAssertions = model.assertions.filter(a => DSL_ASSERTION_TYPES.has(a.type));
    if (dslAssertions.length > 0) {
      const ctx = { httpStatus: 200, responseTimeMs: 0, responseHeaders: {}, responseBody };
      const assertionRules = rules.filter(r => r.kind === 'each' || r.kind === 'length' || r.kind === 'contains_item' || r.kind === 'subset' || r.kind === 'custom');

      // Build a source for the step debugger — ASSERT expressions use $.body.offers
      // context, so we wrap responseBody as { body: responseBody } to match the
      // resolution context used by evaluateAssertions
      const debugSource: MapperSource = {
        id: 'response-body',
        label: 'Response Body',
        sampleData: { body: responseBody, status: 200, headers: {} },
        format: 'json',
      };

      let assertionIdx = 0;
      for (const a of dslAssertions) {
        const rule = assertionRules[assertionIdx];
        assertionIdx++;
        const lineNumber = rule?.lineNumber ?? 0;
        if (!lineNumber) continue;

        const { failures } = evaluateAssertions([a], ctx);
        const passed = failures.length === 0;

        let debugSteps: EvalStep[] | undefined;
        let inputData: unknown;

        if (a.type === 'custom' && a.expression) {
          // Custom ASSERT: run full step debugger
          const assertCtx = { body: responseBody, status: 200, headers: {} };
          try {
            const debugResult = debugExpression(a.expression, [debugSource], 'response-body');
            debugSteps = debugResult.steps;
            // Enrich: if any path step resolved to undefined, show available keys
            for (const step of debugSteps) {
              if (step.label === 'Path Resolution' && step.value === undefined) {
                step.displayValue = enrichUndefined(step.expression, assertCtx);
                step.error = 'path not found';
              }
            }
          } catch { /* non-critical */ }
          // Resolve paths using same context as evaluateAssertions
          const pathMatches = a.expression.match(/\$\.[\w.[*\]-]+/g);
          if (pathMatches && pathMatches.length > 0) {
            const inputMap: Record<string, unknown> = {};
            for (const p of pathMatches) {
              inputMap[p] = getByPath(assertCtx, p);
            }
            inputData = inputMap;
          }
        } else if ('jsonPath' in a) {
          // Collection/array assertions: build structured debug steps
          const jp = (a as { jsonPath: string }).jsonPath;
          const resolvedValue = getByPath(responseBody, jp);
          inputData = { [jp]: resolvedValue };

          const steps: EvalStep[] = [{
            label: 'Path Resolution',
            expression: jp,
            value: resolvedValue,
            displayValue: resolvedValue !== undefined
              ? (typeof resolvedValue === 'object' ? JSON.stringify(resolvedValue)?.slice(0, 80) + (JSON.stringify(resolvedValue).length > 80 ? '…' : '') : String(resolvedValue))
              : enrichUndefined(jp, responseBody),
            error: resolvedValue === undefined ? 'path not found' : undefined,
          }];

          if (a.type === 'arrayLength') {
            const arr = Array.isArray(resolvedValue) ? resolvedValue : [];
            steps.push({
              label: 'Array Length',
              expression: `${jp}.length`,
              value: arr.length,
              displayValue: String(arr.length),
            });
            steps.push({
              label: 'Comparison',
              expression: `${arr.length} ${(a as { operator?: string }).operator ?? '?'} ${(a as { value?: number }).value ?? '?'}`,
              value: passed,
              displayValue: passed ? 'PASS' : 'FAIL',
              error: passed ? undefined : 'assertion failed',
            });
          } else if (a.type === 'each') {
            const arr = Array.isArray(resolvedValue) ? resolvedValue : [];
            const fieldPath = (a as { fieldPath?: string }).fieldPath || '';
            const eachOp = (a as { operator?: string }).operator ?? '';
            const eachVal = (a as { value?: string }).value;
            const extractedValues = arr.map((item: unknown) => fieldPath ? getByPath(item, fieldPath) : item);
            steps.push({
              label: 'Array Items',
              expression: `${jp}[*]${fieldPath ? '.' + fieldPath : ''}`,
              value: extractedValues,
              displayValue: JSON.stringify(extractedValues)?.slice(0, 80) + (JSON.stringify(extractedValues).length > 80 ? '…' : ''),
            });
            if (!passed) {
              // Show which specific items failed
              const failedItems = extractedValues
                .map((val: unknown, idx: number) => ({ idx, val }))
                .filter(({ val }: { val: unknown }) => {
                  try {
                    const r = evaluateFieldOperator(val, eachOp as never, eachVal ?? '', eachVal ?? '');
                    return !r.pass;
                  } catch { return true; }
                });
              if (failedItems.length > 0) {
                steps.push({
                  label: 'Failed Items',
                  expression: failedItems.slice(0, 5).map((fi: { idx: number; val: unknown }) => `[${fi.idx}]=${JSON.stringify(fi.val)}`).join(', ') + (failedItems.length > 5 ? ` +${failedItems.length - 5} more` : ''),
                  value: failedItems.length,
                  displayValue: `${failedItems.length} of ${arr.length} items failed`,
                  error: 'items failed check',
                });
              }
            }
            steps.push({
              label: 'Each Check',
              expression: `each ${eachOp}${eachVal ? ' ' + eachVal : ''}`,
              value: passed,
              displayValue: passed ? `PASS — all ${arr.length} items match` : `FAIL — ${failures[0]?.actual ?? 'some items do not match'}`,
              error: passed ? undefined : 'assertion failed',
            });
          } else if (a.type === 'arrayContains' || a.type === 'containsSubset') {
            const expectedItems = 'items' in a ? (a as { items?: unknown[] }).items : undefined;
            if (expectedItems) {
              steps.push({
                label: 'Expected',
                expression: a.type === 'containsSubset' ? 'subset' : 'contains',
                value: expectedItems,
                displayValue: JSON.stringify(expectedItems)?.slice(0, 80) + (JSON.stringify(expectedItems).length > 80 ? '…' : ''),
              });
            }
            steps.push({
              label: 'Contains Check',
              expression: `${a.type === 'containsSubset' ? 'subset match' : `contains_${(a as { mode?: string }).mode ?? 'any'}`}`,
              value: passed,
              displayValue: passed ? 'PASS' : `FAIL — ${failures[0]?.actual ?? 'not found in array'}`,
              error: passed ? undefined : 'assertion failed',
            });
          }

          debugSteps = steps;
        }

        results.push({
          lineNumber,
          passed,
          actual: failures[0]?.actual,
          expected: failures[0]?.expected,
          path: 'jsonPath' in a ? (a as { jsonPath: string }).jsonPath : undefined,
          expression: a.type === 'custom' ? a.expression : undefined,
          debugSteps,
          inputData,
        });
      }
    }

    setInlineResults(results);
    setInlineVerifyStatus('complete');
    setShowResultsStrip(results.some(r => !r.passed));
  }, [localText, sampleResponseData]);

  // Clear inline results when text changes
  useEffect(() => {
    if (inlineVerifyStatus === 'complete') {
      setInlineResults([]);
      setInlineVerifyStatus('idle');
      setShowResultsStrip(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localText]);

  const inlineLineResults: LineVerifyResult[] = useMemo(() =>
    inlineResults.map(r => ({
      lineNumber: r.lineNumber,
      passed: r.passed,
      actual: r.actual,
      expected: r.expected,
    })),
  [inlineResults]);

  const effectiveLineResults = inlineResults.length > 0 ? inlineLineResults : lineResults;
  const inlinePassedCount = inlineResults.filter(r => r.passed).length;
  const inlineFailedCount = inlineResults.filter(r => !r.passed).length;
  const failedResults = inlineResults.filter(r => !r.passed);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [expandedStepKey, setExpandedStepKey] = useState<string | null>(null);

  const handleModeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setMode(e.target.value as VrModalMode);
  }, [setMode]);

  // ── Shared sub-components ──

  const headerEl = (
    <div
      className="vr-modal-header"
      onMouseDown={mode === 'floating' ? onFloatDragStart : undefined}
      style={mode === 'floating' ? { cursor: 'grab' } : undefined}
    >
      <span className="vr-modal-header-title">
        <span className="vr-modal-header-icon">{mode === 'floating' ? '\u2847' : '\u26A1'}</span>
        {' '}Validation Rules
      </span>
      <div className="vr-modal-header-stats">
        <span className="vr-modal-stat">
          <span className={`vr-modal-dot${errorCount > 0 ? ' vr-modal-dot--err' : ' vr-modal-dot--ok'}`} />
          {ruleCount} rule{ruleCount !== 1 ? 's' : ''}
        </span>
        {errorCount > 0 && (
          <span className="vr-modal-stat vr-modal-stat--error">
            <span className="vr-modal-dot vr-modal-dot--err" />
            {errorCount} error{errorCount !== 1 ? 's' : ''}
          </span>
        )}
        {inlineVerifyStatus === 'complete' && inlinePassedCount > 0 && (
          <span className="vr-modal-stat vr-modal-stat--pass">
            <span className="vr-modal-dot vr-modal-dot--pass" />
            {inlinePassedCount} passed
          </span>
        )}
        {inlineVerifyStatus === 'complete' && inlineFailedCount > 0 && (
          <span className="vr-modal-stat vr-modal-stat--fail">
            <span className="vr-modal-dot vr-modal-dot--err" />
            {inlineFailedCount} failed
          </span>
        )}
        {inlineVerifyStatus === 'idle' && verifyStatus === 'complete' && verifyPassedCount > 0 && (
          <span className="vr-modal-stat vr-modal-stat--pass">
            <span className="vr-modal-dot vr-modal-dot--pass" />
            {verifyPassedCount} passed
          </span>
        )}
        {inlineVerifyStatus === 'idle' && verifyStatus === 'complete' && verifyFailedCount > 0 && (
          <span className="vr-modal-stat vr-modal-stat--fail">
            <span className="vr-modal-dot vr-modal-dot--err" />
            {verifyFailedCount} failed
          </span>
        )}
      </div>
      <div className="vr-modal-header-actions">
        <button
          type="button"
          className="vr-modal-action-btn vr-modal-action-btn--verify"
          onClick={handleVerifyInline}
          title="Verify rules against sample response (without saving)"
          aria-label="Verify inline"
          disabled={!sampleResponseData}
        >
          ▶ Verify
        </button>
        <span className="vr-modal-action-sep" />
        <button
          type="button"
          className={`vr-modal-action-btn${referenceVisible ? ' vr-modal-action-btn--active' : ''}`}
          onClick={toggleReference}
          title="Toggle DSL reference"
          aria-label="Toggle reference panel"
        >
          Reference {referenceVisible ? '\u25C2' : '\u25B8'}
        </button>
        <span className="vr-modal-action-sep" />
        <select
          className="vr-modal-mode-select"
          value={mode}
          onChange={handleModeChange}
          title="Display mode (saved as default)"
          aria-label="Modal display mode"
        >
          <option value="docked">{'\u2B13'} Bottom</option>
          <option value="floating">{'\u29C9'} Floating</option>
          <option value="maximized">{'\u2B1C'} Full Screen</option>
        </select>
      </div>
    </div>
  );

  const handleJumpToLine = useCallback((lineNumber: number) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.revealLineInCenter(lineNumber);
    editor.setPosition({ lineNumber, column: 1 });
    editor.focus();
  }, []);

  const bodyEl = (
    <div className="vr-modal-body">
      <div className="vr-modal-editor-pane">
        <ValidationCodeEditor
          value={localText}
          onChange={handleLocalChange}
          errors={localErrors}
          samplePaths={samplePaths}
          onJumpToNode={onJumpToNode}
          height="100%"
          onEditorMount={handleEditorMount}
          hideHeader
          hideFooter
          lineResults={effectiveLineResults}
        />
        {showResultsStrip && failedResults.length > 0 && (
          <div className="vr-results-strip">
            <div className="vr-results-strip-header">
              <span className="vr-results-strip-title">
                Failed Rules ({failedResults.length})
              </span>
              <button
                type="button"
                className="vr-results-strip-close"
                onClick={() => setShowResultsStrip(false)}
                aria-label="Close results"
              >
                ×
              </button>
            </div>
            <div className="vr-results-strip-list">
              {failedResults.map((r, i) => (
                <div key={i} className="vr-results-strip-entry">
                  <div
                    className={`vr-results-strip-item${expandedIndex === i ? ' vr-results-strip-item--expanded' : ''}`}
                    onClick={() => setExpandedIndex(expandedIndex === i ? null : i)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter') setExpandedIndex(expandedIndex === i ? null : i); }}
                  >
                    <span className="vr-results-strip-expand">{expandedIndex === i ? '▾' : '▸'}</span>
                    <span className="vr-results-strip-line">L{r.lineNumber}</span>
                    <span className="vr-results-strip-path">{r.expression || r.path || ''}</span>
                    <span className="vr-results-strip-detail">
                      {r.expected && <span className="vr-results-strip-expected">Expected: {r.expected}</span>}
                      {r.actual && <span className="vr-results-strip-actual">Got: {r.actual}</span>}
                    </span>
                    <button
                      type="button"
                      className="vr-results-strip-goto"
                      onClick={(e) => { e.stopPropagation(); handleJumpToLine(r.lineNumber); }}
                      title="Jump to line"
                      aria-label="Jump to line"
                    >
                      ↗
                    </button>
                  </div>
                  {expandedIndex === i && (
                    <div className="vr-results-strip-debug">
                      {r.inputData != null && (() => {
                        const fullJson = JSON.stringify(r.inputData, null, 2);
                        const isLarge = fullJson.length > 200;
                        const inputKey = `input-${i}`;
                        const isInputExpanded = expandedStepKey === inputKey;
                        return (
                          <div className="vr-debug-section">
                            <div
                              className="vr-debug-section-title vr-debug-section-title--clickable"
                              onClick={() => setExpandedStepKey(isInputExpanded ? null : inputKey)}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => { if (e.key === 'Enter') setExpandedStepKey(isInputExpanded ? null : inputKey); }}
                            >
                              <span>Input Data</span>
                              <span className="vr-debug-section-toggle">
                                {isInputExpanded ? '▾ Collapse' : `▸ ${isLarge ? 'Expand full' : 'Show'}`}
                              </span>
                            </div>
                            {!isInputExpanded && isLarge && (
                              <pre className="vr-debug-json vr-debug-json--preview">{fullJson.slice(0, 150)}…</pre>
                            )}
                            {(!isLarge || isInputExpanded) && (
                              <pre className="vr-debug-json">{fullJson}</pre>
                            )}
                          </div>
                        );
                      })()}
                      {r.debugSteps && r.debugSteps.length > 0 && (
                        <div className="vr-debug-section">
                          <div className="vr-debug-section-title">Evaluation Steps</div>
                          <div className="vr-debug-steps">
                            {r.debugSteps.map((step, si) => {
                              const stepKey = `${i}-${si}`;
                              const isStepExpanded = expandedStepKey === stepKey;
                              const fullValue = step.value !== undefined
                                ? (typeof step.value === 'object' ? JSON.stringify(step.value, null, 2) : String(step.value))
                                : step.displayValue;
                              const isTruncated = fullValue.length > 60;
                              return (
                                <div key={si}>
                                  <div
                                    className={`vr-debug-step${step.error ? ' vr-debug-step--error' : ''}${isTruncated ? ' vr-debug-step--clickable' : ''}`}
                                    onClick={isTruncated ? () => setExpandedStepKey(isStepExpanded ? null : stepKey) : undefined}
                                    role={isTruncated ? 'button' : undefined}
                                    tabIndex={isTruncated ? 0 : undefined}
                                    onKeyDown={isTruncated ? (e) => { if (e.key === 'Enter') setExpandedStepKey(isStepExpanded ? null : stepKey); } : undefined}
                                  >
                                    <span className="vr-debug-step-num">{si + 1}</span>
                                    <span className="vr-debug-step-label">{step.label}</span>
                                    <code className="vr-debug-step-expr">{step.expression}</code>
                                    <span className="vr-debug-step-arrow">→</span>
                                    <code className={`vr-debug-step-value${step.error ? ' vr-debug-step-value--err' : ''}`}>
                                      {step.displayValue}
                                    </code>
                                    {isTruncated && <span className="vr-debug-step-toggle">{isStepExpanded ? '▾' : '▸'}</span>}
                                  </div>
                                  {isStepExpanded && (
                                    <pre className="vr-debug-step-full">{fullValue}</pre>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {!r.debugSteps && !r.inputData && (
                        <div className="vr-debug-section">
                          <div className="vr-debug-no-data">No additional debug information available</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <button
        type="button"
        className={`vr-ref-edge-toggle${referenceVisible ? '' : ' vr-ref-edge-toggle--collapsed'}`}
        onClick={toggleReference}
        title={referenceVisible ? 'Hide reference' : 'Show reference'}
        aria-label={referenceVisible ? 'Hide reference panel' : 'Show reference panel'}
      >
        {referenceVisible
          ? '\u25B8'
          : <><span className="vr-ref-edge-label">REF</span>{'\u25C2'}</>}
      </button>
      {referenceVisible && <DslReferencePanel onInsert={handleInsert} onClose={toggleReference} />}
    </div>
  );

  const footerActionsEl = (
    <div className="vr-modal-actions">
      <div className="vr-modal-actions-hints">
        <span>Syntax: <code>path  operator  [value]</code></span>
        <span>Auto-suggest while typing</span>
        {onJumpToNode && <span><kbd>Ctrl</kbd>+<kbd>G</kbd> jump to node</span>}
        <span><code>#</code> comments</span>
      </div>
      <div className="vr-modal-actions-buttons">
        <button type="button" className="vr-modal-btn vr-modal-btn--secondary" onClick={handleCancel}>
          Cancel
        </button>
        <button type="button" className="vr-modal-btn vr-modal-btn--primary" onClick={handleSave}>
          Save
        </button>
      </div>
    </div>
  );

  // Portal into the closest modal overlay ancestor so the panel participates
  // in the same stacking context (e.g. insomnia-modal-overlay z-index: 10080).
  // Falls back to document.body when used outside a modal shell.
  const portalTarget = portalContainerRef?.current?.closest('.dm-modal-overlay')
    ?? portalContainerRef?.current?.closest('.modal-overlay')
    ?? document.body;

  if (mode === 'docked') {
    return createPortal(
      <div className="vr-modal-panel vr-modal-panel--docked" style={{ height: dockedHeight }} role="region" aria-label="Validation Rules">
        <div className="vr-modal-resize-handle" onMouseDown={onDockedResizeStart} />
        {headerEl}
        {bodyEl}
        {footerActionsEl}
      </div>,
      portalTarget,
    );
  }

  if (mode === 'maximized') {
    return createPortal(
      <div className="vr-modal-panel vr-modal-panel--maximized" role="region" aria-label="Validation Rules">
        {headerEl}
        {bodyEl}
        {footerActionsEl}
      </div>,
      portalTarget,
    );
  }

  return createPortal(
    <div
      className="vr-modal-panel vr-modal-panel--floating"
      style={{ left: floatPos.x, top: floatPos.y, width: floatSize.w, height: floatSize.h }}
      role="region"
      aria-label="Validation Rules"
    >
      {headerEl}
      {bodyEl}
      {footerActionsEl}
      <div className="vr-modal-float-edge-right" onMouseDown={onRightEdgeResizeStart} />
      <div className="vr-modal-float-grip" onMouseDown={onFloatResizeStart} />
    </div>,
    portalTarget,
  );
}
