/**
 * Coverage gaps — grpcBrowserTransportRouter.ts (Phase 10B).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GrpcWebTransportPreflightError } from './grpcWebTransportContracts';
import { setGrpcTransportMode } from './grpcTransportTabRouting';

const invokeUnary = vi.fn();
const cancelUnary = vi.fn();

vi.mock('./grpcBrowserTransportAdapters', () => ({
  getGrpcBrowserTransportAdapter: vi.fn(),
  GRPC_BROWSER_TRANSPORT_ADAPTERS: {},
}));

import { getGrpcBrowserTransportAdapter } from './grpcBrowserTransportAdapters';
import {
  assertGrpcTransportDispatchReady,
  isGrpcTransportDispatchImplemented,
  resetGrpcBrowserTransportRouterForTests,
  resolveGrpcBrowserTransportAdapterForTab,
} from './grpcBrowserTransportRouter';

function mockAdapter(mode: 'express' | 'tauri' | 'grpc-web' | 'spring-servlet', dispatchReady: boolean) {
  return {
    mode,
    dispatchReady,
    invokeUnary,
    cancelUnary,
  };
}

describe('grpcBrowserTransportRouter coverage gaps', () => {
  beforeEach(() => {
    setGrpcTransportMode(null);
    vi.mocked(getGrpcBrowserTransportAdapter).mockReset();
    invokeUnary.mockReset();
    cancelUnary.mockReset();
  });

  it('resetGrpcBrowserTransportRouterForTests is a no-op hook', () => {
    expect(() => resetGrpcBrowserTransportRouterForTests()).not.toThrow();
  });

  it('isGrpcTransportDispatchImplemented returns false when adapter dispatchReady is false', () => {
    vi.mocked(getGrpcBrowserTransportAdapter).mockReturnValue(
      mockAdapter('grpc-web', false),
    );

    expect(isGrpcTransportDispatchImplemented('grpc-web')).toBe(false);
    expect(getGrpcBrowserTransportAdapter).toHaveBeenCalledWith('grpc-web');
  });

  it.each(['grpc-web', 'spring-servlet'] as const)(
    'assertGrpcTransportDispatchReady throws Phase 10H preflight for %s when dispatchReady is false',
    (mode) => {
      vi.mocked(getGrpcBrowserTransportAdapter).mockReturnValue(
        mockAdapter(mode, false),
      );

      expect(() => assertGrpcTransportDispatchReady(mode)).toThrow(GrpcWebTransportPreflightError);
      try {
        assertGrpcTransportDispatchReady(mode);
      } catch (error) {
        expect(error).toBeInstanceOf(GrpcWebTransportPreflightError);
        const preflight = error as GrpcWebTransportPreflightError;
        expect(preflight.mode).toBe(mode);
        expect(preflight.message).toMatch(/Phase 10H/);
        expect(preflight.message).toMatch(/Use Express Proxy for now/);
      }
    },
  );

  it('resolveGrpcBrowserTransportAdapterForTab uses snapshotTransportMode when provided', () => {
    setGrpcTransportMode('grpc-web');
    const expressAdapter = mockAdapter('express', true);
    vi.mocked(getGrpcBrowserTransportAdapter).mockReturnValue(expressAdapter);

    const adapter = resolveGrpcBrowserTransportAdapterForTab('tab-snapshot', 'express');

    expect(getGrpcBrowserTransportAdapter).toHaveBeenCalledWith('express');
    expect(adapter).toBe(expressAdapter);
    expect(adapter.mode).toBe('express');
  });
});
