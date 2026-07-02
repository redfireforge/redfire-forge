/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { FIXTURE_UNARY_CALL_RESULT } from '../../../shared/grpc/contractFixtures';
import { GRPC_ERROR_CODES } from '../../../shared/grpc/contracts';
import { GrpcResponsePanel } from './GrpcResponsePanel';
import { resetGrpcStudioHintsForTests } from '../hooks/useGrpcStudioHints';

describe('GrpcResponsePanel coverage gaps', () => {
  beforeEach(() => {
    resetGrpcStudioHintsForTests();
  });
  it('renders trailers and timing tabs', () => {
    render(
      <GrpcResponsePanel
        lifecycle="success"
        lastResult={FIXTURE_UNARY_CALL_RESULT}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-response-tab-trailers'));
    expect(screen.getByTestId('grpc-response-trailers')).toBeTruthy();

    fireEvent.click(screen.getByTestId('grpc-response-tab-timing'));
    expect(screen.getByTestId('grpc-response-timing')).toBeTruthy();
  });

  it('resets copy status after successful clipboard write', async () => {
    vi.useFakeTimers();
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });

    render(
      <GrpcResponsePanel
        lifecycle="success"
        lastResult={FIXTURE_UNARY_CALL_RESULT}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-response-copy'));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByTestId('grpc-response-copy').textContent).toBe('Copied');

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.getByTestId('grpc-response-copy').textContent).toBe('Copy Response');
    vi.useRealTimers();
  });

  it('resets copy failed status after clipboard rejection', async () => {
    vi.useFakeTimers();
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    });

    render(
      <GrpcResponsePanel
        lifecycle="success"
        lastResult={FIXTURE_UNARY_CALL_RESULT}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-response-copy'));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByTestId('grpc-response-copy').textContent).toMatch(/failed/i);

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByTestId('grpc-response-copy').textContent).toBe('Copy Response');
    vi.useRealTimers();
  });

  it('switches back to the body tab from other response tabs', () => {
    render(
      <GrpcResponsePanel
        lifecycle="success"
        lastResult={FIXTURE_UNARY_CALL_RESULT}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-response-tab-headers'));
    fireEvent.click(screen.getByTestId('grpc-response-tab-body'));
    expect(screen.getByTestId('grpc-response-body')).toBeTruthy();
  });

  it('marks copy failures when clipboard write rejects', async () => {
    vi.useFakeTimers();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockRejectedValue(new Error('denied')),
      },
    });

    render(
      <GrpcResponsePanel
        lifecycle="success"
        lastResult={FIXTURE_UNARY_CALL_RESULT}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('grpc-response-copy'));
      await Promise.resolve();
    });
    await vi.waitFor(() => {
      expect(screen.getByTestId('grpc-response-copy').textContent).toMatch(/failed/i);
    });
    act(() => {
      vi.runOnlyPendingTimers();
    });
    vi.useRealTimers();
  });

  it('disables copy while panel disabled', () => {
    render(
      <GrpcResponsePanel
        lifecycle="success"
        lastResult={FIXTURE_UNARY_CALL_RESULT}
        disabled
      />,
    );

    expect((screen.getByTestId('grpc-response-copy') as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows copied state after a successful clipboard write', async () => {
    vi.useFakeTimers();
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });

    render(
      <GrpcResponsePanel
        lifecycle="success"
        lastResult={FIXTURE_UNARY_CALL_RESULT}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('grpc-response-copy'));
      await Promise.resolve();
    });
    await vi.waitFor(() => {
      expect(screen.getByTestId('grpc-response-copy').textContent).toBe('Copied');
    });
    act(() => {
      vi.runOnlyPendingTimers();
    });
    vi.useRealTimers();
  });

  it('renders empty headers and trailers tables', () => {
    render(
      <GrpcResponsePanel
        lifecycle="success"
        lastResult={{
          ...FIXTURE_UNARY_CALL_RESULT,
          headers: {},
          trailers: {},
        }}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-response-tab-headers'));
    expect(screen.getByTestId('grpc-response-headers-empty')).toBeTruthy();

    fireEvent.click(screen.getByTestId('grpc-response-tab-trailers'));
    expect(screen.getByTestId('grpc-response-trailers-empty')).toBeTruthy();
  });

  it('shows retryable error hint and permission hint on successful PERMISSION_DENIED responses', () => {
    render(
      <GrpcResponsePanel
        lifecycle="error"
        lastError={{
          code: GRPC_ERROR_CODES.UNREACHABLE,
          category: 'unreachable',
          message: 'Upstream unavailable',
          retryable: true,
        }}
      />,
    );
    expect(screen.getByText(/retryable/i)).toBeTruthy();

    render(
      <GrpcResponsePanel
        lifecycle="success"
        lastResult={{
          ...FIXTURE_UNARY_CALL_RESULT,
          status: 7,
          statusMessage: 'Permission denied',
        }}
      />,
    );
    expect(screen.getByTestId('grpc-spring-hint-spring_permission_denied')).toBeTruthy();
  });
});
