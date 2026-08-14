import { useState } from 'react';
import { MaximizeIcon } from './ApiMockIcons';
import { ApiMockTextExpandModal } from './ApiMockTextExpandModal';

interface Props {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  disabled?: boolean;
  placeholder?: string;
  testId: string;
  multiline?: boolean;
  className?: string;
  ariaLabel?: string;
}

/**
 * Compact body field with an expand control that opens the full-text popup.
 */
export function ApiMockExpandableText({
  label,
  value,
  onChange,
  readOnly = false,
  disabled = false,
  placeholder,
  testId,
  multiline = false,
  className,
  ariaLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const locked = readOnly || disabled;
  const fieldClass = `${multiline ? 'am-textarea' : 'am-input'} mono${className ? ` ${className}` : ''}`;

  return (
    <div className="am-expandable-text">
      {multiline ? (
        <textarea
          className={fieldClass}
          value={value}
          onChange={e => onChange?.(e.target.value)}
          placeholder={placeholder}
          readOnly={readOnly}
          disabled={disabled}
          aria-label={ariaLabel ?? label}
          data-testid={testId}
        />
      ) : (
        <input
          className={fieldClass}
          value={value}
          onChange={e => onChange?.(e.target.value)}
          placeholder={placeholder}
          readOnly={readOnly}
          disabled={disabled}
          aria-label={ariaLabel ?? label}
          data-testid={testId}
        />
      )}
      {!disabled && !open && (
        <button
          type="button"
          className="am-icon-btn"
          aria-label={`Expand ${label}`}
          title={`Expand ${label}`}
          onClick={() => setOpen(true)}
          data-testid={`${testId}-expand`}
        >
          <MaximizeIcon size={15} />
        </button>
      )}
      {open && (
        <ApiMockTextExpandModal
          title={label}
          value={value}
          readOnly={locked}
          placeholder={placeholder}
          onApply={onChange}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
