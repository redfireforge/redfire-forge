import { useCallback, type RefObject } from 'react';
import { CustomSelect } from '../CustomSelect';
import type { Mapping } from './types';
import type { OperatorMeta } from './utils/operatorRegistry';

export interface OperatorValueEditorProps {
  mapping: Mapping;
  currentOp: string;
  currentOpMeta: OperatorMeta;
  isRangeOperator: boolean;
  editingOperatorValue: boolean;
  localOperatorValue: string;
  operatorValueRef: RefObject<HTMLInputElement | null>;
  rangeSecondRef: RefObject<HTMLInputElement | null>;
  typeSelectRef: RefObject<HTMLSelectElement | null>;
  setLocalOperatorValue: (v: string) => void;
  setEditingOperatorValue: (v: boolean) => void;
  handleTypeSelectChange: (value: string) => void;
  handleOperatorValueCommit: () => void;
  handleOperatorValueKeyDown: (e: React.KeyboardEvent) => void;
  handleRangeCommit: (part1: string, part2: string) => void;
  startEditOperatorValue: () => void;
}

function refValue(ref: RefObject<HTMLInputElement | null>): string {
  /* v8 ignore next */
  return ref.current?.value ?? '';
}

export default function OperatorValueEditor({
  mapping,
  currentOp,
  currentOpMeta,
  isRangeOperator,
  editingOperatorValue,
  localOperatorValue,
  operatorValueRef,
  rangeSecondRef,
  typeSelectRef: _typeSelectRef,
  setLocalOperatorValue,
  setEditingOperatorValue,
  handleTypeSelectChange,
  handleOperatorValueCommit,
  handleOperatorValueKeyDown,
  handleRangeCommit,
  startEditOperatorValue,
}: OperatorValueEditorProps) {
  const handleRangeFirstKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      rangeSecondRef.current?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditingOperatorValue(false);
    }
  }, [rangeSecondRef, setEditingOperatorValue]);

  const handleRangeSecondKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleRangeCommit(refValue(operatorValueRef), refValue(rangeSecondRef));
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditingOperatorValue(false);
    }
  }, [handleRangeCommit, operatorValueRef, rangeSecondRef, setEditingOperatorValue]);

  const handleRangeSecondBlur = useCallback(() => {
    handleRangeCommit(refValue(operatorValueRef), refValue(rangeSecondRef));
  }, [handleRangeCommit, operatorValueRef, rangeSecondRef]);

  if (!currentOpMeta.needsValue) return null;

  if (!editingOperatorValue) {
    return (
      <span
        className="dm-operator-value-display"
        title="Click to edit value"
        onClick={(e) => { e.stopPropagation(); startEditOperatorValue(); }}
      >
        {mapping.operatorValue || mapping.sourcePath || '—'}
      </span>
    );
  }

  if (currentOp === 'is_type') {
    return (
      <div onClick={(e) => e.stopPropagation()}>
        <CustomSelect
          className="dm-operator-value-input dm-type-select"
          value={localOperatorValue}
          onChange={handleTypeSelectChange}
          options={[
            { value: 'string', label: 'string' },
            { value: 'number', label: 'number' },
            { value: 'boolean', label: 'boolean' },
            { value: 'object', label: 'object' },
            { value: 'array', label: 'array' },
            { value: 'null', label: 'null' },
          ]}
          placeholder="select type…"
          aria-label="Select expected type"
        />
      </div>
    );
  }

  if (isRangeOperator) {
    const parts = localOperatorValue.split(',').map(s => s.trim());
    /* v8 ignore next 2 */
    const val1 = parts[0] ?? '';
    const val2 = parts[1] ?? '';
    const label1 = currentOp === 'between' ? 'min' : 'value';
    const label2 = currentOp === 'between' ? 'max' : 'tolerance';
    return (
      <span className="dm-range-inputs" onClick={(e) => e.stopPropagation()}>
        <input
          ref={operatorValueRef}
          className="dm-operator-value-input dm-range-input"
          defaultValue={val1}
          placeholder={label1}
          type="number"
          aria-label={label1}
          onKeyDown={handleRangeFirstKeyDown}
        />
        <span className="dm-range-separator">–</span>
        <input
          ref={rangeSecondRef}
          className="dm-operator-value-input dm-range-input"
          defaultValue={val2}
          placeholder={label2}
          type="number"
          aria-label={label2}
          onKeyDown={handleRangeSecondKeyDown}
          onBlur={handleRangeSecondBlur}
        />
      </span>
    );
  }

  return (
    <input
      ref={operatorValueRef}
      className="dm-operator-value-input"
      value={localOperatorValue}
      onChange={(e) => setLocalOperatorValue(e.target.value)}
      onKeyDown={handleOperatorValueKeyDown}
      onBlur={handleOperatorValueCommit}
      onClick={(e) => e.stopPropagation()}
      placeholder="Enter value"
      aria-label="Operator comparison value"
    />
  );
}
