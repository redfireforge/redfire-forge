import { useCallback, useImperativeHandle, forwardRef } from 'react';
import type { WorkflowVariableHint } from '../../utils/workflowVariableHints';
import ExpressionHintDropdown from './ExpressionHintDropdown';
import { useExpressionAutocompleteField } from './useExpressionAutocompleteField';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  rows?: number;
  spellCheck?: boolean;
  'aria-label'?: string;
  variableHints: WorkflowVariableHint[];
}

/**
 * Textarea with inline autocomplete for `{{variable}}` and `{{$function()}}`.
 * Mirrors ExpressionInput but renders a `<textarea>` instead of `<input>`.
 */
const ExpressionTextarea = forwardRef<HTMLTextAreaElement, Props>(function ExpressionTextarea({
  value,
  onChange,
  placeholder,
  className,
  disabled,
  rows,
  spellCheck,
  variableHints,
  ...rest
}, ref) {
  const {
    wrapperRef,
    inputRef,
    hintState,
    handleTextChange,
    handleSelect,
    handleBlur,
    onKeyDown,
  } = useExpressionAutocompleteField({ value, onChange, variableHints });

  useImperativeHandle(ref, () => inputRef.current as HTMLTextAreaElement, [inputRef]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    handleTextChange(e.target.value, e.target.selectionStart);
  }, [handleTextChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    onKeyDown(e as unknown as React.KeyboardEvent<HTMLInputElement>, value, onChange);
  }, [onKeyDown, value, onChange]);

  return (
    <div className="expr-input-wrapper" ref={wrapperRef}>
      <textarea
        ref={inputRef as React.RefObject<HTMLTextAreaElement>}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={className}
        disabled={disabled}
        rows={rows}
        spellCheck={spellCheck}
        autoComplete="off"
        style={{ width: '100%' }}
        {...rest}
      />
      <ExpressionHintDropdown
        open={hintState.open}
        items={hintState.items}
        selectedIndex={hintState.selectedIndex}
        onSelect={handleSelect}
        anchorRef={inputRef as React.RefObject<HTMLElement>}
      />
    </div>
  );
});

export default ExpressionTextarea;
