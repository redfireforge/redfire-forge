import { useRef, useCallback } from 'react';
import { useExpressionHints } from '../../hooks/useExpressionHints';
import type { WorkflowVariableHint } from '../../utils/workflowVariableHints';
import ExpressionHintDropdown from './ExpressionHintDropdown';

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
export default function ExpressionTextarea({
  value,
  onChange,
  placeholder,
  className,
  disabled,
  rows,
  spellCheck,
  variableHints,
  ...rest
}: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { hintState, inputRef, onInputChange, onKeyDown, accept, close } = useExpressionHints(variableHints);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const cursor = e.target.selectionStart ?? val.length;
    onChange(val);
    onInputChange(val, cursor);
  }, [onChange, onInputChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    onKeyDown(e as unknown as React.KeyboardEvent<HTMLInputElement>, value, onChange);
  }, [onKeyDown, value, onChange]);

  const handleSelect = useCallback((item: Parameters<typeof accept>[0]) => {
    accept(item, value, onChange);
  }, [accept, value, onChange]);

  return (
    <div className="expr-input-wrapper" ref={wrapperRef}>
      <textarea
        ref={inputRef as React.RefObject<HTMLTextAreaElement>}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          requestAnimationFrame(() => {
            if (document.activeElement === inputRef.current) return;
            close();
          });
        }}
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
}
