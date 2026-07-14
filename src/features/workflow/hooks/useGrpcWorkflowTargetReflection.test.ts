/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { FIXTURE_DESCRIPTOR } from '../../../shared/grpc/contractFixtures';
import { useGrpcWorkflowTargetReflection } from './useGrpcWorkflowTargetReflection';

vi.mock('../utils/grpcWorkflowReflection', () => ({
  reflectGrpcWorkflowTarget: vi.fn(),
}));

import { reflectGrpcWorkflowTarget } from '../utils/grpcWorkflowReflection';

describe('useGrpcWorkflowTargetReflection', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it('reflects automatically after a valid target is entered', async () => {
    vi.mocked(reflectGrpcWorkflowTarget).mockResolvedValue(FIXTURE_DESCRIPTOR);

    const { result } = renderHook(() => useGrpcWorkflowTargetReflection('localhost:50051'));

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });

    expect(result.current.services.map((service) => service.fullName)).toContain('echo.EchoService');
  });

  it('stays idle for unresolved template targets', async () => {
    const { result } = renderHook(() => useGrpcWorkflowTargetReflection('{{grpcHost}}'));

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 500));
    });

    expect(result.current.status).toBe('idle');
    expect(reflectGrpcWorkflowTarget).not.toHaveBeenCalled();
  });

  it('surfaces reflection errors and supports manual reflectNow', async () => {
    vi.mocked(reflectGrpcWorkflowTarget).mockRejectedValueOnce(new Error('reflect failed'));

    const { result } = renderHook(() => useGrpcWorkflowTargetReflection('localhost:50051'));

    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });
    expect(result.current.errorMessage).toBe('reflect failed');
    expect(result.current.descriptor).toBeNull();

    vi.mocked(reflectGrpcWorkflowTarget).mockResolvedValueOnce(FIXTURE_DESCRIPTOR);
    await act(async () => {
      await result.current.reflectNow();
    });
    expect(result.current.status).toBe('ready');
    expect(result.current.descriptor).toEqual(FIXTURE_DESCRIPTOR);
  });

  it('reflectNow is a no-op for invalid targets', async () => {
    const { result } = renderHook(() => useGrpcWorkflowTargetReflection('not-valid'));

    await act(async () => {
      await result.current.reflectNow();
    });

    expect(result.current.status).toBe('idle');
    expect(reflectGrpcWorkflowTarget).not.toHaveBeenCalled();
  });

  it('ignores superseded reflectNow success responses', async () => {
    let resolveFirst: ((value: typeof FIXTURE_DESCRIPTOR) => void) | undefined;
    const first = new Promise<typeof FIXTURE_DESCRIPTOR>((resolve) => {
      resolveFirst = resolve;
    });
    vi.mocked(reflectGrpcWorkflowTarget)
      .mockReturnValueOnce(first)
      .mockResolvedValueOnce(FIXTURE_DESCRIPTOR);

    const { result } = renderHook(() => useGrpcWorkflowTargetReflection('localhost:50051'));

    await act(async () => {
      const firstCall = result.current.reflectNow();
      const secondCall = result.current.reflectNow();
      resolveFirst?.(FIXTURE_DESCRIPTOR);
      await firstCall;
      await secondCall;
    });

    expect(result.current.status).toBe('ready');
    expect(reflectGrpcWorkflowTarget).toHaveBeenCalledTimes(2);
  });

  it('ignores superseded reflectNow error responses', async () => {
    let rejectFirst: ((reason: Error) => void) | undefined;
    const first = new Promise<typeof FIXTURE_DESCRIPTOR>((_resolve, reject) => {
      rejectFirst = reject;
    });
    vi.mocked(reflectGrpcWorkflowTarget)
      .mockReturnValueOnce(first)
      .mockResolvedValueOnce(FIXTURE_DESCRIPTOR);

    const { result } = renderHook(() => useGrpcWorkflowTargetReflection('localhost:50051'));

    await act(async () => {
      const firstCall = result.current.reflectNow();
      const secondCall = result.current.reflectNow();
      rejectFirst?.(new Error('stale'));
      await firstCall;
      await secondCall;
    });

    expect(result.current.status).toBe('ready');
    expect(result.current.errorMessage).toBeUndefined();
  });

  it('ignores stale reflection responses after target changes', async () => {
    let resolveSlow: ((value: typeof FIXTURE_DESCRIPTOR) => void) | undefined;
    const slowPromise = new Promise<typeof FIXTURE_DESCRIPTOR>((resolve) => {
      resolveSlow = resolve;
    });
    vi.mocked(reflectGrpcWorkflowTarget).mockReturnValueOnce(slowPromise);

    const { result, rerender } = renderHook(
      ({ target }) => useGrpcWorkflowTargetReflection(target),
      { initialProps: { target: 'localhost:50051' } },
    );

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 500));
    });
    expect(result.current.status).toBe('loading');

    rerender({ target: 'localhost:50052' });
    vi.mocked(reflectGrpcWorkflowTarget).mockResolvedValueOnce(FIXTURE_DESCRIPTOR);

    await act(async () => {
      resolveSlow?.(FIXTURE_DESCRIPTOR);
      await new Promise((resolve) => window.setTimeout(resolve, 500));
    });

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });
  });

  it('ignores stale reflection errors after target changes', async () => {
    let rejectSlow: ((reason: Error) => void) | undefined;
    const slowPromise = new Promise<typeof FIXTURE_DESCRIPTOR>((_resolve, reject) => {
      rejectSlow = reject;
    });
    vi.mocked(reflectGrpcWorkflowTarget).mockReturnValueOnce(slowPromise);

    const { result, rerender } = renderHook(
      ({ target }) => useGrpcWorkflowTargetReflection(target),
      { initialProps: { target: 'localhost:50051' } },
    );

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 500));
    });
    expect(result.current.status).toBe('loading');

    rerender({ target: 'localhost:50052' });
    vi.mocked(reflectGrpcWorkflowTarget).mockResolvedValueOnce(FIXTURE_DESCRIPTOR);

    await act(async () => {
      rejectSlow?.(new Error('stale failure'));
      await new Promise((resolve) => window.setTimeout(resolve, 500));
    });

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });
    expect(result.current.errorMessage).toBeUndefined();
  });

  it('stringifies non-Error reflection failures', async () => {
    vi.mocked(reflectGrpcWorkflowTarget).mockRejectedValueOnce('network down');

    const { result } = renderHook(() => useGrpcWorkflowTargetReflection('localhost:50051'));

    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });
    expect(result.current.errorMessage).toBe('network down');
  });

  it('re-reflects when tls mode changes', async () => {
    vi.mocked(reflectGrpcWorkflowTarget).mockResolvedValue(FIXTURE_DESCRIPTOR);

    const { result, rerender } = renderHook(
      ({ tlsMode }) => useGrpcWorkflowTargetReflection('localhost:50051', tlsMode),
      { initialProps: { tlsMode: 'disabled' as const } },
    );

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });

    rerender({ tlsMode: 'tls' });
    await waitFor(() => {
      expect(reflectGrpcWorkflowTarget).toHaveBeenCalledWith('localhost:50051', 'tls');
    });
  });

  it('clears pending reflection timer on unmount', async () => {
    const clearSpy = vi.spyOn(window, 'clearTimeout');
    const { unmount } = renderHook(() => useGrpcWorkflowTargetReflection('localhost:50051'));
    unmount();
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });
});
