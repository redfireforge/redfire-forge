/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { GrpcHighlightedJsonTextarea } from './GrpcHighlightedJsonTextarea';

describe('GrpcHighlightedJsonTextarea', () => {
  it('renders highlighted backdrop and editable textarea', () => {
    render(
      <GrpcHighlightedJsonTextarea
        value='{"name":"grpc"}'
        testId="grpc-request-json"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId('grpc-request-json-wrap')).toBeTruthy();
    expect(screen.getByTestId('grpc-request-json')).toBeTruthy();
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
});
