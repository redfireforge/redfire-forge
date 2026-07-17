/**
 * @vitest-environment jsdom
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GrpcJsonCodeToolbar } from './GrpcJsonCodeToolbar';

describe('GrpcJsonCodeToolbar', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { writeText: vi.fn(() => Promise.resolve()) },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('renders label and copy button with default test ids', () => {
    render(<GrpcJsonCodeToolbar copyText='{"a":1}' />);
    expect(screen.getByText('JSON')).toBeTruthy();
    expect(screen.getByTestId('grpc-json-copy-btn').textContent).toBe('Copy');
  });

  it('copies text and shows copied status', async () => {
    vi.useFakeTimers();
    render(<GrpcJsonCodeToolbar copyText='{"hello":"world"}' />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('grpc-json-copy-btn'));
      await Promise.resolve();
    });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('{"hello":"world"}');
    expect(screen.getByTestId('grpc-json-copy-btn').textContent).toBe('Copied');
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.getByTestId('grpc-json-copy-btn').textContent).toBe('Copy');
  });

  it('shows copy failed when clipboard write rejects', async () => {
    vi.useFakeTimers();
    vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(new Error('denied'));
    render(<GrpcJsonCodeToolbar copyText='x' />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('grpc-json-copy-btn'));
      await Promise.resolve();
    });
    expect(screen.getByTestId('grpc-json-copy-btn').textContent).toBe('Copy failed');
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByTestId('grpc-json-copy-btn').textContent).toBe('Copy');
  });

  it('skips copy when disabled or text is empty', async () => {
    const { rerender } = render(<GrpcJsonCodeToolbar copyText='' />);
    fireEvent.click(screen.getByTestId('grpc-json-copy-btn'));
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();

    rerender(<GrpcJsonCodeToolbar copyText='x' copyDisabled />);
    fireEvent.click(screen.getByTestId('grpc-json-copy-btn'));
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
  });

  it('invokes pretty format when provided', () => {
    const onPrettyFormat = vi.fn();
    render(
      <GrpcJsonCodeToolbar
        copyText='{}'
        onPrettyFormat={onPrettyFormat}
        testIdPrefix='custom-json'
        label='Body'
      />,
    );
    expect(screen.getByText('Body')).toBeTruthy();
    fireEvent.click(screen.getByTestId('custom-json-pretty-btn'));
    expect(onPrettyFormat).toHaveBeenCalledTimes(1);
  });

  it('disables pretty format button when prettyDisabled', () => {
    render(
      <GrpcJsonCodeToolbar copyText='{}' onPrettyFormat={vi.fn()} prettyDisabled />,
    );
    expect(screen.getByTestId('grpc-json-pretty-btn')).toHaveProperty('disabled', true);
  });
});
