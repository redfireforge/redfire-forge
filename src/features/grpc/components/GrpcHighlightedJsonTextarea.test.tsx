/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { GrpcHighlightedJsonTextarea } from './GrpcHighlightedJsonTextarea';

describe('GrpcHighlightedJsonTextarea', () => {
  it('renders highlighted backdrop and default textarea className', () => {
    render(
      <GrpcHighlightedJsonTextarea
        value='{"name":"grpc"}'
        testId="grpc-request-json"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId('grpc-request-json-wrap')).toBeTruthy();
    expect(screen.getByTestId('grpc-request-json').className).toContain('grpc-call-json-textarea');
    expect(document.querySelector('.grpc-highlighted-json-backdrop')).toBeTruthy();
  });

  it('forwards edits to onChange', () => {
    const onChange = vi.fn();
    render(
      <GrpcHighlightedJsonTextarea
        value="{}"
        testId="grpc-request-json"
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByTestId('grpc-request-json'), {
      target: { value: '{"updated":true}' },
    });
    expect(onChange).toHaveBeenCalledWith('{"updated":true}');
  });

  it('syncs backdrop scroll position and supports disabled custom className', () => {
    const { rerender } = render(
      <GrpcHighlightedJsonTextarea
        value='{"a":1}'
        testId="grpc-request-json"
        onChange={vi.fn()}
        className="custom-json"
      />,
    );
    const textarea = screen.getByTestId('grpc-request-json') as HTMLTextAreaElement;
    const backdrop = document.querySelector('.grpc-highlighted-json-backdrop') as HTMLPreElement;
    textarea.scrollTop = 12;
    textarea.scrollLeft = 4;
    fireEvent.scroll(textarea);
    expect(backdrop.scrollTop).toBe(12);
    expect(backdrop.scrollLeft).toBe(4);
    expect(textarea.className).toContain('custom-json');

    rerender(
      <GrpcHighlightedJsonTextarea
        value='{"b":2}'
        testId="grpc-request-json"
        onChange={vi.fn()}
        disabled
      />,
    );
    expect((screen.getByTestId('grpc-request-json') as HTMLTextAreaElement).disabled).toBe(true);
  });

  it('re-syncs backdrop scroll when value changes', () => {
    const { rerender } = render(
      <GrpcHighlightedJsonTextarea
        value='{"a":1}'
        testId="grpc-request-json"
        onChange={vi.fn()}
      />,
    );
    const textarea = screen.getByTestId('grpc-request-json') as HTMLTextAreaElement;
    textarea.scrollTop = 8;
    fireEvent.scroll(textarea);
    rerender(
      <GrpcHighlightedJsonTextarea
        value='{"a":2}'
        testId="grpc-request-json"
        onChange={vi.fn()}
      />,
    );
    const backdrop = document.querySelector('.grpc-highlighted-json-backdrop') as HTMLPreElement;
    expect(backdrop.scrollTop).toBe(8);
  });
});
