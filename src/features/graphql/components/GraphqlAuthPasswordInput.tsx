import { useState, type RefObject } from 'react';

export function GraphqlAuthPasswordInput({
  value,
  onChange,
  placeholder,
  testId,
  inputRef,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  testId?: string;
  inputRef?: RefObject<HTMLInputElement | null>;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="gql-auth-pw-wrap">
      <input
        ref={inputRef}
        id={testId}
        type={visible ? 'text' : 'password'}
        className="gql-input gql-auth-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        data-testid={testId}
      />
      <button
        type="button"
        className="gql-auth-pw-toggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide value' : 'Show value'}
        title={visible ? 'Hide' : 'Show'}
      >
        {visible ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}
