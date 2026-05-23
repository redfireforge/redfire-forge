import type { KeyboardEventHandler, RefObject } from 'react';

const CHEVRON_UP = (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" width="10" height="10">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
  </svg>
);

const CHEVRON_DOWN = (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" width="10" height="10">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
  </svg>
);

export interface SearchMatchBarProps {
  value: string;
  onChange: (value: string) => void;
  currentMatch: number;
  totalMatches: number;
  onPrev: () => void;
  onNext: () => void;
  onClear: () => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  countClassName?: string;
  navClassName?: string;
  clearClassName?: string;
  inputType?: 'text' | 'search';
  controlsVisible?: boolean;
  showNavWhenEmpty?: boolean;
  hideClear?: boolean;
  navStyle?: 'svg' | 'text';
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
  inputRef?: RefObject<HTMLInputElement | null>;
  ariaLabel?: string;
  prevTitle?: string;
  nextTitle?: string;
}

export function SearchMatchBar({
  value,
  onChange,
  currentMatch,
  totalMatches,
  onPrev,
  onNext,
  onClear,
  placeholder,
  className,
  inputClassName,
  countClassName,
  navClassName,
  clearClassName,
  inputType = 'text',
  controlsVisible,
  showNavWhenEmpty = false,
  hideClear = false,
  navStyle = 'svg',
  onKeyDown,
  inputRef,
  ariaLabel,
  prevTitle = 'Previous',
  nextTitle = 'Next',
}: SearchMatchBarProps) {
  const showControls = controlsVisible ?? !!value;
  const showNav = showNavWhenEmpty || showControls;
  const disabled = totalMatches === 0;

  const input = (
    <input
      ref={inputRef}
      className={inputClassName}
      type={inputType}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      aria-label={ariaLabel}
    />
  );

  const countEl = showControls ? (
    <span className={countClassName}>
      {totalMatches > 0 ? `${currentMatch}/${totalMatches}` : 'No match'}
    </span>
  ) : null;

  const navButtons = showNav ? (
    <>
      <button
        type="button"
        className={navClassName}
        title={prevTitle}
        disabled={disabled}
        onClick={onPrev}
        aria-label={prevTitle}
      >
        {navStyle === 'text' ? '▲' : CHEVRON_UP}
      </button>
      <button
        type="button"
        className={navClassName}
        title={nextTitle}
        disabled={disabled}
        onClick={onNext}
        aria-label={nextTitle}
      >
        {navStyle === 'text' ? '▼' : CHEVRON_DOWN}
      </button>
    </>
  ) : null;

  const clearButton = showControls && !hideClear ? (
    <button type="button" className={clearClassName} onClick={onClear} aria-label="Clear search">
      ×
    </button>
  ) : null;

  const content = (
    <>
      {input}
      {countEl}
      {navButtons}
      {clearButton}
    </>
  );

  if (className) {
    return <div className={className}>{content}</div>;
  }

  return content;
}
