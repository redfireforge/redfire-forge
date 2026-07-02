/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GrpcHighlightedJsonTextarea } from './GrpcHighlightedJsonTextarea';

describe('GrpcHighlightedJsonTextarea coverage gaps', () => {
  it('exposes accessibility attributes and highlighted backdrop markup', () => {
    render(
      <GrpcHighlightedJsonTextarea
        value='{"name":"grpc"}'
        testId="grpc-request-json"
        onChange={vi.fn()}
      />,
    );

    const textarea = screen.getByTestId('grpc-request-json') as HTMLTextAreaElement;
    expect(textarea.getAttribute('aria-label')).toBe('Request JSON body');
    expect(textarea.getAttribute('spellcheck')).toBe('false');
    expect(document.querySelector('.grpc-highlighted-json-backdrop')?.innerHTML).toContain('name');
  });

  it('uses explicit disabled=false and default className branch', () => {
    render(
      <GrpcHighlightedJsonTextarea
        value="{}"
        testId="grpc-request-json"
        onChange={vi.fn()}
        disabled={false}
      />,
    );

    const textarea = screen.getByTestId('grpc-request-json') as HTMLTextAreaElement;
    expect(textarea.disabled).toBe(false);
    expect(textarea.className).toContain('grpc-call-json-textarea');
  });

  it('syncs backdrop scroll position when the textarea scrolls', () => {
    const { rerender } = render(
      <GrpcHighlightedJsonTextarea
        value='{"scroll":"test"}'
        testId="grpc-request-json"
        onChange={vi.fn()}
        className="custom-json-textarea"
      />,
    );

    const textarea = screen.getByTestId('grpc-request-json') as HTMLTextAreaElement;
    const backdrop = document.querySelector('.grpc-highlighted-json-backdrop') as HTMLPreElement;
    Object.defineProperty(textarea, 'scrollTop', { value: 42, writable: true, configurable: true });
    Object.defineProperty(textarea, 'scrollLeft', { value: 12, writable: true, configurable: true });
    Object.defineProperty(backdrop, 'scrollTop', { value: 0, writable: true, configurable: true });
    Object.defineProperty(backdrop, 'scrollLeft', { value: 0, writable: true, configurable: true });

    act(() => {
      fireEvent.scroll(textarea);
    });

    expect(backdrop.scrollTop).toBe(42);
    expect(backdrop.scrollLeft).toBe(12);

    act(() => {
      rerender(
        <GrpcHighlightedJsonTextarea
          value='{"scroll":"updated"}'
          testId="grpc-request-json"
          onChange={vi.fn()}
          className="custom-json-textarea"
        />,
      );
    });
    expect(textarea.className).toContain('custom-json-textarea');
  });
});
