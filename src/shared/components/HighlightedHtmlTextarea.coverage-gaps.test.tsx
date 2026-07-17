/**
 * @vitest-environment jsdom
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HighlightedHtmlTextarea } from './HighlightedHtmlTextarea';

describe('HighlightedHtmlTextarea coverage gaps', () => {
  it('renders with default and custom test ids and class names', () => {
    render(
      <HighlightedHtmlTextarea
        value='{"a":1}'
        testId="mock-json-input"
        onChange={vi.fn()}
        highlightHtml={(v) => `<span>${v}</span>`}
      />,
    );

    expect(screen.getByTestId('mock-json-input-wrap')).toBeTruthy();
    expect(screen.getByTestId('mock-json-input')).toBeTruthy();
    expect(document.querySelector('.grpc-json-editor-highlight')?.innerHTML).toContain('{"a":1}');
  });

  it('uses explicit wrapTestId, ariaLabel, rows, and custom class names', () => {
    render(
      <HighlightedHtmlTextarea
        value="{}"
        testId="editor"
        wrapTestId="editor-shell"
        wrapClassName="custom-wrap"
        backdropClassName="custom-backdrop"
        textareaClassName="custom-textarea"
        rows={8}
        ariaLabel="Mock response JSON"
        onChange={vi.fn()}
        highlightHtml={() => '<b>{}</b>'}
      />,
    );

    expect(screen.getByTestId('editor-shell')).toBeTruthy();
    const textarea = screen.getByTestId('editor') as HTMLTextAreaElement;
    expect(textarea.getAttribute('aria-label')).toBe('Mock response JSON');
    expect(textarea.rows).toBe(8);
    expect(textarea.className).toContain('custom-textarea');
    expect(document.querySelector('.custom-backdrop')?.innerHTML).toContain('<b>{}</b>');
  });

  it('forwards onChange and supports disabled state', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <HighlightedHtmlTextarea
        value="old"
        testId="editor"
        onChange={onChange}
        highlightHtml={(v) => v}
      />,
    );

    const textarea = screen.getByTestId('editor') as HTMLTextAreaElement;
    expect(textarea.disabled).toBe(false);

    fireEvent.change(textarea, { target: { value: 'new-value' } });
    expect(onChange).toHaveBeenCalledWith('new-value');

    rerender(
      <HighlightedHtmlTextarea
        value="old"
        testId="editor"
        onChange={onChange}
        highlightHtml={(v) => v}
        disabled
      />,
    );
    expect((screen.getByTestId('editor') as HTMLTextAreaElement).disabled).toBe(true);
  });

  it('syncs backdrop scroll position when textarea scrolls', () => {
    render(
      <HighlightedHtmlTextarea
        value='{"scroll":"test"}'
        testId="editor"
        onChange={vi.fn()}
        highlightHtml={(v) => v}
      />,
    );

    const textarea = screen.getByTestId('editor') as HTMLTextAreaElement;
    const backdrop = document.querySelector('.grpc-json-editor-highlight') as HTMLPreElement;
    Object.defineProperty(textarea, 'scrollTop', { value: 24, writable: true, configurable: true });
    Object.defineProperty(textarea, 'scrollLeft', { value: 8, writable: true, configurable: true });
    Object.defineProperty(backdrop, 'scrollTop', { value: 0, writable: true, configurable: true });
    Object.defineProperty(backdrop, 'scrollLeft', { value: 0, writable: true, configurable: true });

    act(() => {
      fireEvent.scroll(textarea);
    });

    expect(backdrop.scrollTop).toBe(24);
    expect(backdrop.scrollLeft).toBe(8);
  });
});
