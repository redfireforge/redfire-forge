import { useCallback, useRef } from 'react';
import { useExpressionHints } from '../../hooks/useExpressionHints';
import type { WorkflowVariableHint } from '../../utils/workflowVariableHints';

interface UseExpressionAutocompleteFieldOptions {
  value: string;
  onChange: (value: string) => void;
  variableHints: WorkflowVariableHint[];
  jsonPathHints?: string[];
}

export function useExpressionAutocompleteField({
  value,
  onChange,
  variableHints,
  jsonPathHints,
}: UseExpressionAutocompleteFieldOptions) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { hintState, inputRef, onInputChange, onKeyDown, accept, close } = useExpressionHints(variableHints, jsonPathHints);

  const handleTextChange = useCallback((nextValue: string, selectionStart: number | null) => {
    const cursor = selectionStart ?? nextValue.length;
    onChange(nextValue);
    onInputChange(nextValue, cursor);
  }, [onChange, onInputChange]);

  const handleSelect = useCallback((item: Parameters<typeof accept>[0]) => {
    accept(item, value, onChange);
  }, [accept, value, onChange]);

  const handleBlur = useCallback(() => {
    requestAnimationFrame(() => {
      if (document.activeElement === inputRef.current) return;
      close();
    });
  }, [close, inputRef]);

  return {
    wrapperRef,
    inputRef,
    hintState,
    handleTextChange,
    handleSelect,
    handleBlur,
    onKeyDown,
  };
}