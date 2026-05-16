import { useState, useCallback, useRef, useEffect } from 'react';
import type { Assertion, ComparisonOperator } from '../../types';
import {
  ARRAY_ASSERTION_LABELS,
  COMPARISON_OPS,
  formatAssertionSummary,
  parseEachInput,
} from './utils/targetTreeHelpers';

/**
 * One row in the inline array-assertion strip rendered beneath an array node.
 * Displays an assertion (length / contains / each / subset / custom) with a
 * type pill, optional inline editor for the value, and a remove button.
 *
 * Extracted from `TargetTreeNode.tsx` so the row logic can be unit tested
 * without rendering an entire tree.
 */
export interface AssertionRowVerifyResult {
  passed: boolean;
  actual?: string;
  expected?: string;
}

interface InlineAssertionRowProps {
  assertion: Assertion;
  globalIndex: number;
  onUpdate?: (index: number, patch: Partial<Assertion>) => void;
  onRemove?: (index: number) => void;
  verifyResult?: AssertionRowVerifyResult;
}

function getPlaceholder(type: string): string {
  switch (type) {
    case 'arrayLength': return 'Enter number';
    case 'arrayContains': return '"value" or {"key": "value"} — exact match';
    case 'each': return 'field operator value — applied to every item';
    case 'containsSubset': return '{"key": "value", ...} — matches nested fields too';
    default: return 'Enter value';
  }
}

export default function InlineAssertionRow({
  assertion,
  globalIndex,
  onUpdate,
  onRemove,
  verifyResult,
}: InlineAssertionRowProps) {
  const meta = ARRAY_ASSERTION_LABELS[assertion.type] ?? ARRAY_ASSERTION_LABELS['custom'];
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const startEdit = useCallback(() => {
    if (!onUpdate) return;
    if (assertion.type === 'arrayLength') {
      setLocalValue(String(assertion.value));
    } else if (assertion.type === 'arrayContains') {
      setLocalValue(assertion.value);
    } else if (assertion.type === 'each') {
      setLocalValue(formatAssertionSummary(assertion));
    } else if (assertion.type === 'containsSubset') {
      setLocalValue(assertion.expected);
    } else if (assertion.type === 'custom') {
      setLocalValue(assertion.expression);
    }
    setEditing(true);
  }, [onUpdate, assertion]);

  const commitEdit = useCallback(() => {
    if (!onUpdate) return;
    if (assertion.type === 'arrayLength') {
      const num = parseInt(localValue, 10);
      if (!isNaN(num)) onUpdate(globalIndex, { value: num } as Partial<Assertion>);
    } else if (assertion.type === 'arrayContains') {
      onUpdate(globalIndex, { value: localValue } as Partial<Assertion>);
    } else if (assertion.type === 'each') {
      const parsed = parseEachInput(localValue);
      if (parsed) {
        onUpdate(globalIndex, { fieldPath: parsed.fieldPath, operator: parsed.operator, value: parsed.value || undefined } as Partial<Assertion>);
      } else {
        onUpdate(globalIndex, { value: localValue } as Partial<Assertion>);
      }
    } else if (assertion.type === 'containsSubset') {
      onUpdate(globalIndex, { expected: localValue } as Partial<Assertion>);
    } else if (assertion.type === 'custom') {
      onUpdate(globalIndex, { expression: localValue } as Partial<Assertion>);
    }
    setEditing(false);
  }, [onUpdate, globalIndex, localValue, assertion.type]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
    else if (e.key === 'Escape') { e.preventDefault(); setEditing(false); }
  }, [commitEdit]);

  const verifyCls = verifyResult ? (verifyResult.passed ? ' dm-array-assertion-row--pass' : ' dm-array-assertion-row--fail') : '';

  return (
    <div className={`dm-array-assertion-row dm-array-assertion-row--${meta.cssClass}${verifyCls}`} onClick={(e) => e.stopPropagation()}>
      {verifyResult && (
        <span
          className={`dm-array-assertion-verify-badge dm-array-assertion-verify-badge--${verifyResult.passed ? 'pass' : 'fail'}`}
          title={verifyResult.passed
            ? 'Passed'
            : `Failed${verifyResult.expected ? ` — Expected: ${verifyResult.expected}` : ''}${verifyResult.actual ? `, Got: ${verifyResult.actual}` : ''}`}
        >
          {verifyResult.passed ? '✓' : '✗'}
        </span>
      )}
      <span className="dm-array-assertion-type-pill" title={meta.description}>
        {meta.icon} {meta.label}
      </span>
      {assertion.type === 'arrayLength' && onUpdate && (
        <select
          className="dm-array-assertion-op-select"
          value={assertion.operator}
          onChange={(e) => onUpdate(globalIndex, { operator: e.target.value as ComparisonOperator } as Partial<Assertion>)}
          aria-label="Comparison operator"
          onClick={(e) => e.stopPropagation()}
        >
          {COMPARISON_OPS.map(op => <option key={op} value={op}>{op}</option>)}
        </select>
      )}
      {assertion.type === 'arrayLength' && !onUpdate && (
        <span className="dm-array-assertion-op-label">{assertion.operator}</span>
      )}
      {editing ? (
        <input
          ref={inputRef}
          className="dm-array-assertion-value-input"
          type={assertion.type === 'arrayLength' ? 'number' : 'text'}
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commitEdit}
          onClick={(e) => e.stopPropagation()}
          placeholder={getPlaceholder(assertion.type)}
          aria-label="Assertion value"
        />
      ) : (
        <span
          className={`dm-array-assertion-value${onUpdate ? ' dm-array-assertion-value--editable' : ''}`}
          onClick={(e) => { e.stopPropagation(); startEdit(); }}
          title={onUpdate ? `Click to edit — ${getPlaceholder(assertion.type)}` : formatAssertionSummary(assertion)}
        >
          {formatAssertionSummary(assertion) || (onUpdate ? getPlaceholder(assertion.type) : '')}
        </span>
      )}
      {assertion.negate && (
        <span className="dm-array-assertion-negate" title="Negated">NOT</span>
      )}
      {onRemove && (
        <button
          type="button"
          className="dm-array-assertion-remove"
          onClick={(e) => { e.stopPropagation(); onRemove(globalIndex); }}
          aria-label="Remove assertion"
          title="Remove this assertion"
        >
          ✕
        </button>
      )}
    </div>
  );
}
