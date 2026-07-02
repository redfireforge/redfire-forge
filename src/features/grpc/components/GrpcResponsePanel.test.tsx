/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FIXTURE_UNARY_CALL_RESULT } from '../../../shared/grpc/contractFixtures';
import { GRPC_ERROR_CODES } from '../../../shared/grpc/contracts';
import { GrpcResponsePanel } from './GrpcResponsePanel';
import { resetGrpcStudioHintsForTests } from '../hooks/useGrpcStudioHints';

describe('GrpcResponsePanel (Phase 1G)', () => {
  beforeEach(() => {
    resetGrpcStudioHintsForTests();
  });
  it('shows idle hint when no call has been made', () => {
    render(
      <GrpcResponsePanel lifecycle="idle" />,
    );

    expect(screen.getByTestId('grpc-response-idle')).toBeTruthy();
  });

  it('shows in-flight indicator while calling', () => {
    render(
      <GrpcResponsePanel lifecycle="calling" />,
    );

    expect(screen.getByTestId('grpc-response-in-flight')).toBeTruthy();
  });

  it('renders success status, duration, and body JSON', () => {
    render(
      <GrpcResponsePanel
        lifecycle="success"
        lastResult={FIXTURE_UNARY_CALL_RESULT}
        targetAddress="localhost:50051"
      />,
    );

    expect(screen.getByTestId('grpc-response-status').textContent).toContain('OK · 0');
    expect(screen.getByTestId('grpc-response-duration').textContent).toBe('87ms');
    expect(screen.getByTestId('grpc-response-target').textContent).toContain('localhost:50051');
    expect(screen.getByTestId('grpc-response-body').textContent).toContain('"message": "hello grpc"');
  });

  it('shows headers tab with count badge', () => {
    render(
      <GrpcResponsePanel
        lifecycle="success"
        lastResult={FIXTURE_UNARY_CALL_RESULT}
      />,
    );

    expect(screen.getByTestId('grpc-response-headers-count').textContent).toBe('1');
    fireEvent.click(screen.getByTestId('grpc-response-tab-headers'));
    expect(screen.getByTestId('grpc-response-headers')).toBeTruthy();
  });

  it('shows error summary and panel on failure', () => {
    render(
      <GrpcResponsePanel
        lifecycle="error"
        lastError={{
          code: GRPC_ERROR_CODES.UNREACHABLE,
          category: 'unreachable',
          message: 'Could not reach localhost:59999',
          retryable: true,
        }}
      />,
    );

    expect(screen.getByTestId('grpc-response-error-summary').textContent).toContain('Could not reach');
    expect(screen.getByTestId('grpc-response-error-panel')).toBeTruthy();
  });

  it('shows cancelled banner', () => {
    render(
      <GrpcResponsePanel lifecycle="cancelled" />,
    );

    expect(screen.getByTestId('grpc-response-cancelled')).toBeTruthy();
  });

  it('copies response body to clipboard', async () => {
    const writeText = vi.fn(async () => undefined);
    const originalClipboard = Object.getOwnPropertyDescriptor(globalThis.navigator, 'clipboard');
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const timeoutSpy = vi.spyOn(window, 'setTimeout').mockImplementation(((handler: TimerHandler) => {
      if (typeof handler === 'function') {
        handler();
      }
      return 0 as unknown as ReturnType<typeof setTimeout>;
    }) as typeof setTimeout);

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
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('"message": "hello grpc"'));

    timeoutSpy.mockRestore();
    if (originalClipboard) {
      Object.defineProperty(globalThis.navigator, 'clipboard', originalClipboard);
    }
  });

  it('masks authorization headers in headers tab (Phase 4E)', () => {
    render(
      <GrpcResponsePanel
        lifecycle="success"
        lastResult={{
          ...FIXTURE_UNARY_CALL_RESULT,
          headers: { authorization: 'Bearer super-secret-token-value' },
        }}
      />,
    );

    fireEvent.click(screen.getByTestId('grpc-response-tab-headers'));
    const table = screen.getByTestId('grpc-response-headers');
    expect(table.textContent).toContain('authorization');
    expect(table.textContent).not.toContain('super-secret-token-value');
    expect(table.textContent).toContain('…');
  });

  it('shows TLS failure hint from error details (Phase 4G)', () => {
    render(
      <GrpcResponsePanel
        lifecycle="error"
        lastError={{
          code: GRPC_ERROR_CODES.UNREACHABLE,
          category: 'unreachable',
          message: 'TLS handshake failed',
          details: { tlsFailure: 'hostname_mismatch' },
        }}
      />,
    );
    expect(screen.getByTestId('grpc-response-tls-hint').textContent).toMatch(/hostname/i);
  });

  it('dismisses PERMISSION_DENIED hint for status 7 (Phase 4G)', async () => {
    const user = userEvent.setup();
    render(
      <GrpcResponsePanel
        lifecycle="error"
        lastError={{
          code: GRPC_ERROR_CODES.CALL_FAILED,
          category: 'call_failed',
          message: 'Permission denied',
          details: { grpcStatus: 7 },
        }}
      />,
    );
    expect(screen.getByTestId('grpc-spring-hint-spring_permission_denied')).toBeTruthy();
    await user.click(screen.getByTestId('grpc-spring-hint-dismiss-spring_permission_denied'));
    expect(screen.queryByTestId('grpc-spring-hint-spring_permission_denied')).toBeNull();
  });

  it('does not show PERMISSION_DENIED hint for status 16 (Phase 4G)', () => {
    render(
      <GrpcResponsePanel
        lifecycle="error"
        lastError={{
          code: GRPC_ERROR_CODES.CALL_FAILED,
          category: 'call_failed',
          message: 'Unauthenticated',
          details: { grpcStatus: 16 },
        }}
      />,
    );
    expect(screen.queryByTestId('grpc-spring-hint-spring_permission_denied')).toBeNull();
  });

  it('shows browser transport hint for classified CORS failures (Phase 10E)', () => {
    render(
      <GrpcResponsePanel
        lifecycle="error"
        lastError={{
          code: GRPC_ERROR_CODES.UNREACHABLE,
          category: 'unreachable',
          message: 'Browser blocked the cross-origin request (CORS).',
          details: {
            browserTransportFailure: 'cors',
            transportMode: 'grpc-web',
            suggestExpressProxy: true,
          },
        }}
      />,
    );
    expect(screen.getByTestId('grpc-response-browser-transport-hint').textContent).toMatch(/CORS/i);
  });

  it('does not show browser transport hint for unrelated errors (Phase 10E)', () => {
    render(
      <GrpcResponsePanel
        lifecycle="error"
        lastError={{
          code: GRPC_ERROR_CODES.UNREACHABLE,
          category: 'unreachable',
          message: 'Could not reach localhost:59999',
          retryable: true,
        }}
      />,
    );
    expect(screen.queryByTestId('grpc-response-browser-transport-hint')).toBeNull();
  });

  it('shows Express fallback button when browser transport error offers it (Phase 10E)', () => {
    const onRetryWithExpress = vi.fn();
    render(
      <GrpcResponsePanel
        lifecycle="error"
        lastError={{
          code: GRPC_ERROR_CODES.UNREACHABLE,
          category: 'unreachable',
          message: 'Browser blocked the cross-origin request (CORS).',
          retryable: true,
          details: {
            browserTransportFailure: 'cors',
            transportMode: 'grpc-web',
            suggestExpressProxy: true,
            expressFallbackOffered: true,
            fallbackReason: 'Browser blocked the cross-origin request (CORS).',
            transportAttempted: 'grpc-web',
          },
        }}
        onRetryWithExpress={onRetryWithExpress}
      />,
    );
    fireEvent.click(screen.getByTestId('grpc-retry-express-btn'));
    expect(onRetryWithExpress).toHaveBeenCalled();
  });
});
