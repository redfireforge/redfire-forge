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
  'aria-label'?: string;
  variableHints: WorkflowVariableHint[];
}

/**
 * Text input with inline autocomplete for `{{variable}}` and `{{$function()}}`.
 *
 * - Type `{{` → shows matching variable hints
 * - Type `{{$` → shows matching expression function hints
 * - Arrow keys navigate, Enter/Tab accepts, Escape dismisses
 */
const ExpressionInput = forwardRef<HTMLInputElement, Props>(function ExpressionInput({
  value,
  onChange,
  placeholder,
  className,
  disabled,
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

  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement, [inputRef]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleTextChange(e.target.value, e.target.selectionStart);
  }, [handleTextChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    onKeyDown(e, value, onChange);
  }, [onKeyDown, value, onChange]);

  return (
    <div className="expr-input-wrapper" ref={wrapperRef}>
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={className}
        disabled={disabled}
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

export default ExpressionInput;
