import { useRef } from 'react';
import type { BodyType } from '../../../shared/types';
import { isValidJson as checkValidJson, minifyJson, prettyJson } from '../../../shared/utils/helpers';

const BODY_CODE_TYPE_LABELS: Record<BodyType, string> = {
  'form-data': 'Multipart',
  'form-urlencoded': 'Form URL Encoded',
  json: 'JSON',
  xml: 'XML',
  text: 'Plain Text',
  file: 'File',
  none: 'No Body',
};

export interface CodeTextareaProps {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  bodyType: BodyType;
}

export function CodeTextarea({ value, onChange, placeholder, bodyType }: CodeTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const lines = (value || '').split('\n');
  const lineCount = Math.max(lines.length, 1);

  const handleScroll = () => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  const handleFormat = () => {
    const formatted = prettyJson(value);
    if (formatted !== value) onChange(formatted);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const newVal = `${value.slice(0, start)}  ${value.slice(end)}`;
      onChange(newVal);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 2;
      });
    }
  };

  const isJson = bodyType === 'json';
  const isValid = isJson && value.trim() ? checkValidJson(value) : true;

  return (
    <div className="body-code-container">
      <div className="body-code-toolbar">
        <span className="body-code-lang">{BODY_CODE_TYPE_LABELS[bodyType]}</span>
        <span className="body-code-line-info">{lineCount} line{lineCount !== 1 ? 's' : ''}</span>
        <div className="body-code-toolbar-actions">
          {isJson && (
            <>
              {!isValid && <span className="body-code-error">Invalid JSON</span>}
              <button
                type="button"
                className="body-code-btn"
                onClick={handleFormat}
                disabled={!value.trim() || !isValid}
                title="Format JSON with indentation"
              >
                Pretty Format
              </button>
              <button
                type="button"
                className="body-code-btn"
                onClick={() => { const m = minifyJson(value); if (m) onChange(m); }}
                disabled={!value.trim() || !isValid}
                title="Minify JSON (remove whitespace)"
              >
                Minify
              </button>
            </>
          )}
          <button
            type="button"
            className="body-code-btn"
            onClick={() => { void navigator.clipboard.writeText(value); }}
            disabled={!value.trim()}
            title="Copy to clipboard"
          >
            Copy
          </button>
        </div>
      </div>
      <div className="body-code-editor">
        <div className="body-code-lines" ref={lineNumbersRef} aria-hidden>
          {Array.from({ length: lineCount }, (_, i) => (
            <span key={i}>{i + 1}</span>
          ))}
        </div>
        <textarea
          ref={textareaRef}
          className="body-code-textarea"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
        />
      </div>
    </div>
  );
}
