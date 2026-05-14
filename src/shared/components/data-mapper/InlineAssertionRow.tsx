import { useState, useCallback, useRef, useEffect } from 'react';
import type { Assertion, ComparisonOperator } from '../../types';
import {
  ARRAY_ASSERTION_LABELS,
  COMPARISON_OPS,
  formatAssertionSummary,
} from './utils/targetTreeHelpers';

/**
 * One row in the inline array-assertion strip rendered beneath an array node.
 * Displays an assertion (length / contains / each / subset / custom) with a
 * type pill, optional inline editor for the value, and a remove button.
 *
 * Extracted from `TargetTreeNode.tsx` so the row logic can be unit tested
 * without rendering an entire tree.
 */
interface InlineAssertionRowProps {
  assertion: Assertion;
  globalIndex: number;
  onUpdate?: (index: number, patch: Partial<Assertion>) => void;
  onRemove?: (index: number) => void;
}

export default function InlineAssertionRow({
  assertion,
  globalIndex,
  onUpdate,
  onRemove,
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
      setLocalValue(assertion.value ?? '');
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
      onUpdate(globalIndex, { value: localValue } as Partial<Assertion>);
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

  return (
    <div className={`dm-array-assertion-row dm-array-assertion-row--${meta.cssClass}`} onClick={(e) => e.stopPropagation()}>
      <span className="dm-array-assertion-type-pill" title={meta.label}>
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
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commitEdit}
          aria-label="Assertion value"
        />
      ) : (
        <span
          className={`dm-array-assertion-value${onUpdate ? ' dm-array-assertion-value--editable' : ''}`}
          onClick={(e) => { e.stopPropagation(); startEdit(); }}
          title={onUpdate ? 'Click to edit value' : formatAssertionSummary(assertion)}
        >
          {formatAssertionSummary(assertion)}
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
