import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import { highlightJson } from '../../../shared/utils/jsonHighlighter';
import { syncHighlightedJsonScrollPosition } from '../utils/grpcHighlightedJsonScroll';

export interface GrpcHighlightedJsonTextareaProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  testId: string;
  className?: string;
}

export function GrpcHighlightedJsonTextarea({
  value,
  onChange,
  disabled = false,
  testId,
  className = 'grpc-call-json-textarea',
}: GrpcHighlightedJsonTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLPreElement>(null);

  const highlighted = useMemo(() => highlightJson(value), [value]);

  const syncScroll = useCallback(() => {
    syncHighlightedJsonScrollPosition(textareaRef.current, backdropRef.current);
  }, []);

  useLayoutEffect(() => {
    syncScroll();
  }, [value, syncScroll]);

  return (
    <div className="grpc-highlighted-json-editor" data-testid={`${testId}-wrap`}>
      <pre
        ref={backdropRef}
        className="grpc-highlighted-json-backdrop grpc-response-json--highlighted"
        aria-hidden
      >
        {highlighted}
      </pre>
      <textarea
        ref={textareaRef}
        className={`${className} grpc-highlighted-json-input`}
        data-testid={testId}
        value={value}
        disabled={disabled}
        spellCheck={false}
        aria-label="Request JSON body"
        onChange={(event) => onChange(event.target.value)}
        onScroll={syncScroll}
      />
    </div>
  );
}
