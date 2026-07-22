/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { selectOption, getCustomSelectValue } from '../../../../test-utils/customSelectHelper';
import GrpcAssertConfig from './GrpcAssertConfig';
import type { GrpcAssertNodeData } from '../../types/workflow/node-grpc';

function makeData(overrides: Partial<GrpcAssertNodeData> = {}): GrpcAssertNodeData {
  return {
    id: 'assert-1',
    type: 'grpcAssert',
    label: 'Assert result',
    source: 'grpc-unary-1',
    onError: 'fail',
    assertions: [{ grpcStatus: 0 }],
    ...overrides,
  };
}

describe('GrpcAssertConfig', () => {
  it('uses empty-array JSON when assertions are undefined and keeps it in sync on rerender', () => {
    const onChange = vi.fn();
    const { rerender } = render(<GrpcAssertConfig data={makeData({ assertions: undefined })} onChange={onChange} />);

    expect((screen.getByTestId('grpc-assert-config-assertions') as HTMLTextAreaElement).value).toBe('[]');

    rerender(<GrpcAssertConfig data={makeData({ assertions: undefined, label: 'Rerendered' })} onChange={onChange} />);

    expect((screen.getByTestId('grpc-assert-config-assertions') as HTMLTextAreaElement).value).toBe('[]');
    expect((screen.getByTestId('grpc-assert-config-label') as HTMLInputElement).value).toBe('Rerendered');
  });

  it('renders fields from data and defaults onError to fail when undefined', () => {
    const onChange = vi.fn();
    render(<GrpcAssertConfig data={makeData({ onError: undefined })} onChange={onChange} />);

    expect((screen.getByTestId('grpc-assert-config-label') as HTMLInputElement).value).toBe('Assert result');
    expect((screen.getByTestId('grpc-assert-config-source') as HTMLInputElement).value).toBe('grpc-unary-1');
    expect(screen.getByTestId('grpc-assert-config-on-error').querySelector('.cs-text')?.textContent).toBe('Fail workflow');
    expect((screen.getByTestId('grpc-assert-config-assertions') as HTMLTextAreaElement).value).toBe('[\n  {\n    "grpcStatus": 0\n  }\n]');
  });

  it('updates label/source/onError via onChange patches', () => {
    const onChange = vi.fn();
    const data = makeData();
    render(<GrpcAssertConfig data={data} onChange={onChange} />);

    fireEvent.change(screen.getByTestId('grpc-assert-config-label'), { target: { value: 'New label' } });
    fireEvent.change(screen.getByTestId('grpc-assert-config-source'), { target: { value: 'savedAlias' } });
    selectOption(screen.getByTestId('grpc-assert-config-on-error'), 'Continue workflow');

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ label: 'New label' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ source: 'savedAlias' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ onError: 'continue' }));
  });

  it('updates assertions only when JSON parses as an array', () => {
    const onChange = vi.fn();
    const data = makeData();
    render(<GrpcAssertConfig data={data} onChange={onChange} />);
    const textarea = screen.getByTestId('grpc-assert-config-assertions');

    // Invalid JSON should not patch data.assertions.
    fireEvent.change(textarea, { target: { value: '{bad json' } });
    expect(onChange).not.toHaveBeenCalledWith(expect.objectContaining({ assertions: expect.anything() }));

    // Valid non-array JSON should also not patch data.assertions.
    fireEvent.change(textarea, { target: { value: '{"grpcStatus":0}' } });
    expect(onChange).not.toHaveBeenCalledWith(expect.objectContaining({ assertions: expect.any(Array) }));

    // Valid array JSON should patch data.assertions.
    fireEvent.change(textarea, { target: { value: '[{"grpcStatus":1}]' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ assertions: [{ grpcStatus: 1 }] }));
  });

  it('syncs textarea text when data.assertions prop changes', () => {
    const onChange = vi.fn();
    const { rerender } = render(<GrpcAssertConfig data={makeData({ assertions: [] })} onChange={onChange} />);
    const textarea = screen.getByTestId('grpc-assert-config-assertions');

    fireEvent.change(textarea, { target: { value: '[{"grpcStatus":2}]' } });
    expect((textarea as HTMLTextAreaElement).value).toBe('[{"grpcStatus":2}]');

    rerender(
      <GrpcAssertConfig
        data={makeData({ assertions: [{ grpcStatus: 0 }, { grpcField: 'message', equals: 'ok' }] })}
        onChange={onChange}
      />,
    );

    expect((screen.getByTestId('grpc-assert-config-assertions') as HTMLTextAreaElement).value).toBe(
      '[\n  {\n    "grpcStatus": 0\n  },\n  {\n    "grpcField": "message",\n    "equals": "ok"\n  }\n]',
    );
  });
});
