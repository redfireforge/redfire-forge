/**
 * @vitest-environment jsdom
 * Coverage gaps — grpcStudioTabLifecycle.ts (Phase 7E/7H).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as grpcTransportFacade from '../../../shared/grpc/grpcTransportFacade';
import { isTauri } from '../../../shared/utils/platform';
import {
  bindTauriWindowCloseRequested,
  registerGrpcStudioAppLifecycle,
} from './grpcStudioTabLifecycle';

const tauriMocks = vi.hoisted(() => {
  const disposeCloseRequested = vi.fn();
  const getCurrentWindow = vi.fn();
  return { disposeCloseRequested, getCurrentWindow };
});

vi.mock('../../../shared/utils/platform', () => ({
  isTauri: vi.fn(() => true),
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: tauriMocks.getCurrentWindow,
}));

vi.mock('../../../shared/grpc/grpcTransportFacade', async () => {
  const actual = await vi.importActual<typeof grpcTransportFacade>('../../../shared/grpc/grpcTransportFacade');
  return {
    ...actual,
    cleanupGrpcTabNative: vi.fn(() => Promise.resolve()),
  };
});

const flushMicrotasks = () => new Promise<void>((resolve) => {
  queueMicrotask(() => resolve());
});

describe('grpcStudioTabLifecycle coverage gaps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isTauri).mockReturnValue(true);
    tauriMocks.getCurrentWindow.mockImplementation(async () => ({
      onCloseRequested: vi.fn(async () => tauriMocks.disposeCloseRequested),
    }));
  });

  it('returns a noop dispose on non-Tauri builds', () => {
    vi.mocked(isTauri).mockReturnValue(false);
    const cleanup = registerGrpcStudioAppLifecycle({ getTabIds: () => ['tab-a'] });
    cleanup();
    expect(grpcTransportFacade.cleanupGrpcTabNative).not.toHaveBeenCalled();
  });

  it('cleans tabs on dispose when detachStreamEvents is omitted', () => {
    const cleanup = registerGrpcStudioAppLifecycle({ getTabIds: () => ['tab-x'] });
    cleanup();
    expect(grpcTransportFacade.cleanupGrpcTabNative).toHaveBeenCalledWith('tab-x');
  });

  it('cleans every tab id on beforeunload', () => {
    const cleanup = registerGrpcStudioAppLifecycle({ getTabIds: () => ['tab-a', 'tab-b'] });
    window.dispatchEvent(new Event('beforeunload'));
    expect(grpcTransportFacade.cleanupGrpcTabNative).toHaveBeenCalledWith('tab-a');
    expect(grpcTransportFacade.cleanupGrpcTabNative).toHaveBeenCalledWith('tab-b');
    cleanup();
  });

  it('skips Tauri close hook registration when disposed before import resolves', async () => {
    const onCloseRequested = vi.fn(async () => tauriMocks.disposeCloseRequested);
    tauriMocks.getCurrentWindow.mockImplementation(async () => ({
      onCloseRequested,
    }));

    const cleanup = registerGrpcStudioAppLifecycle({ getTabIds: () => [] });
    cleanup();
    await flushMicrotasks();
    expect(onCloseRequested).not.toHaveBeenCalled();
  });

  it('falls back to beforeunload-only cleanup when Tauri import fails', async () => {
    tauriMocks.getCurrentWindow.mockRejectedValueOnce(new Error('not tauri'));
    const cleanup = registerGrpcStudioAppLifecycle({ getTabIds: () => ['tab-web'] });
    await flushMicrotasks();

    window.dispatchEvent(new Event('beforeunload'));
    expect(grpcTransportFacade.cleanupGrpcTabNative).toHaveBeenCalledWith('tab-web');
    cleanup();
  });

  it('bindTauriWindowCloseRequested invokes cleanup when Tauri close fires', async () => {
    let closeHandler: (() => void) | undefined;
    const disposeCloseRequested = vi.fn();
    const getCurrentWindow = vi.fn(async () => ({
      onCloseRequested: vi.fn(async (handler: () => void) => {
        closeHandler = handler;
        return disposeCloseRequested;
      }),
    }));

    const onClose = vi.fn();
    const dispose = await bindTauriWindowCloseRequested(onClose, () => false, getCurrentWindow);
    expect(getCurrentWindow).toHaveBeenCalledTimes(1);
    expect(closeHandler).toBeTypeOf('function');
    closeHandler!();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(dispose).toBe(disposeCloseRequested);
  });

  it('bindTauriWindowCloseRequested skips registration when cancelled', async () => {
    const onCloseRequested = vi.fn(async () => tauriMocks.disposeCloseRequested);
    const getCurrentWindow = vi.fn(async () => ({ onCloseRequested }));

    const dispose = await bindTauriWindowCloseRequested(vi.fn(), () => true, getCurrentWindow);
    expect(getCurrentWindow).not.toHaveBeenCalled();
    expect(dispose).toBeUndefined();
  });

  it('bindTauriWindowCloseRequested returns undefined when Tauri import fails', async () => {
    const getCurrentWindow = vi.fn(async () => {
      throw new Error('not tauri');
    });
    const dispose = await bindTauriWindowCloseRequested(vi.fn(), () => false, getCurrentWindow);
    expect(dispose).toBeUndefined();
  });
});
