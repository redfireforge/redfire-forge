/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ConsoleLogLine from './ConsoleLogLine';
import { formatTimestamp, highlightMatches, highlightSearchMatch, type LogLine } from '../utils/consoleLogUtils';

describe('formatTimestamp', () => {
  it('returns empty string for falsy value', () => {
    expect(formatTimestamp(0)).toBe('');
    expect(formatTimestamp(undefined)).toBe('');
  });

  it('returns formatted time for valid timestamp', () => {
    const ts = new Date('2026-01-15T14:30:45.123Z').getTime();
    const result = formatTimestamp(ts);
    expect(result).toContain('30');
    expect(result).toContain('45');
  });
});

describe('highlightMatches', () => {
  it('returns text as-is when no query', () => {
    expect(highlightMatches('hello world', '')).toBe('hello world');
  });

  it('returns text as-is when no match', () => {
    expect(highlightMatches('hello world', 'xyz')).toBe('hello world');
  });

  it('wraps matching parts in <mark> elements', () => {
    const result = highlightMatches('hello world hello', 'hello');
    expect(Array.isArray(result)).toBe(true);
  });

  it('handles special regex characters in query', () => {
    const result = highlightMatches('price is $10.00', '$10.00');
    expect(Array.isArray(result)).toBe(true);
  });
});

describe('ConsoleLogLine', () => {
  const baseLine: LogLine = { prefix: '*', text: 'Info message', ts: 1000 };

  it('renders with correct CSS class for known prefix', () => {
    const { container } = render(<ConsoleLogLine line={baseLine} />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('wf-cl-info');
  });

  it('renders error prefix class', () => {
    const line: LogLine = { prefix: '!', text: 'Error occurred', ts: 2000 };
    const { container } = render(<ConsoleLogLine line={line} />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('wf-cl-error');
  });

  it('renders unknown prefix as plain', () => {
    const line: LogLine = { prefix: 'UNKNOWN', text: 'text', ts: 0 };
    const { container } = render(<ConsoleLogLine line={line} />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('wf-cl-plain');
  });

  it('renders text content', () => {
    render(<ConsoleLogLine line={baseLine} />);
    expect(screen.getByText('Info message')).toBeTruthy();
  });

  it('renders node label when provided', () => {
    const line: LogLine = { ...baseLine, nodeLabel: 'Step 1' };
    render(<ConsoleLogLine line={line} />);
    expect(screen.getByText('[Step 1]')).toBeTruthy();
  });

  it('adds clickable class and handles click', () => {
    const onClick = vi.fn();
    const { container } = render(<ConsoleLogLine line={baseLine} onClick={onClick} />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('wf-cl-line-clickable');
    fireEvent.click(el);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('adds match class when isMatch is true', () => {
    const { container } = render(<ConsoleLogLine line={baseLine} isMatch />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('wf-cl-line-match');
  });

  it('adds current-match class when isCurrentMatch is true', () => {
    const { container } = render(<ConsoleLogLine line={baseLine} isCurrentMatch />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('wf-cl-line-current-match');
  });

  it('calls lineRef with element', () => {
    const refFn = vi.fn();
    render(<ConsoleLogLine line={baseLine} lineRef={refFn} />);
    expect(refFn).toHaveBeenCalled();
  });

  it('renders icon for prefix', () => {
    const { container } = render(<ConsoleLogLine line={{ prefix: '>', text: 'req', ts: 0 }} />);
    expect(container.textContent).toContain('→');
  });

  it('renders separator prefix without icon', () => {
    const { container } = render(<ConsoleLogLine line={{ prefix: '---', text: '', ts: 0 }} />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('wf-cl-separator');
  });
});

describe('highlightSearchMatch', () => {
  it('returns plain text when query is empty', () => {
    expect(highlightSearchMatch('hello', '')).toBe('hello');
  });

  it('returns plain text when no match', () => {
    expect(highlightSearchMatch('hello', 'xyz')).toBe('hello');
  });

  it('wraps first match in mark tag with custom class', () => {
    const result = highlightSearchMatch('Hello World', 'world', 'my-highlight');
    const { container } = render(<>{result}</>);
    const mark = container.querySelector('mark');
    expect(mark).not.toBeNull();
    expect(mark!.className).toBe('my-highlight');
    expect(mark!.textContent).toBe('World');
  });

  it('is case-insensitive', () => {
    const result = highlightSearchMatch('FooBar', 'foo', 'hl');
    const { container } = render(<>{result}</>);
    expect(container.querySelector('mark')!.textContent).toBe('Foo');
  });

  it('uses default class name when not specified', () => {
    const result = highlightSearchMatch('test text', 'text', undefined);
    const { container } = render(<>{result}</>);
    expect(container.querySelector('mark')!.className).toBe('search-highlight');
  });

  it('only highlights first occurrence', () => {
    const result = highlightSearchMatch('abc abc abc', 'abc', 'hl');
    const { container } = render(<>{result}</>);
    const marks = container.querySelectorAll('mark');
    expect(marks).toHaveLength(1);
  });
});
