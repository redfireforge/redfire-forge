import { useCallback, useMemo, useRef } from 'react';
import { syncHighlightedTextareaScroll } from '../utils/highlightedTextareaScroll';

export interface HighlightedHtmlTextareaProps {
  value: string;
  onChange: (value: string) => void;
  highlightHtml: (value: string) => string;
  rows?: number;
  testId: string;
  wrapTestId?: string;
  wrapClassName?: string;
  backdropClassName?: string;
  textareaClassName?: string;
  ariaLabel?: string;
  disabled?: boolean;
}

export function HighlightedHtmlTextarea({
  value,
  onChange,
  highlightHtml,
  rows = 12,
  testId,
  wrapTestId,
  wrapClassName = 'grpc-json-editor-wrap',
  backdropClassName = 'grpc-json-editor-highlight',
  textareaClassName = 'grpc-json-editor-input',
  ariaLabel,
  disabled = false,
}: HighlightedHtmlTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);

  const highlighted = useMemo(() => highlightHtml(value), [highlightHtml, value]);

  const syncScroll = useCallback(() => {
    syncHighlightedTextareaScroll(textareaRef.current, preRef.current);
  }, []);

  return (
    <div className={wrapClassName} data-testid={wrapTestId ?? `${testId}-wrap`}>
      <pre
        ref={preRef}
        className={backdropClassName}
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: highlighted + '\n' }}
      />
      <textarea
        ref={textareaRef}
        className={textareaClassName}
        rows={rows}
        data-testid={testId}
        value={value}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.value)}
        onScroll={syncScroll}
        spellCheck={false}
      />
    </div>
  );
}
