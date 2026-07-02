import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { GrpcStudioRuntimeContext } from './grpcStudioRuntimeContext';
import {
  createConnectTargetHandler,
  createDisconnectTargetHandler,
  createToggleTargetConnectionHandler,
  resetGrpcTargetProbeGenerationForTests,
} from './grpcStudioTargetConnection';
import { bumpGrpcTargetProbeGeneration } from '../utils/grpcTargetProbeGeneration';

const probeGrpcTargetConnection = vi.fn();

vi.mock('../utils/grpcTargetConnection', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/grpcTargetConnection')>();
  return {
    ...actual,
    probeGrpcTargetConnection: (...args: unknown[]) => probeGrpcTargetConnection(...args),
  };
});

vi.mock('./grpcStudioTabCommands', () => ({
  createResolveTabConnectionHandler: () => () => ({
    target: 'localhost:50051',
    tlsMode: 'disabled',
    targetValidation: { valid: true },
  }),
}));

function makeCore(overrides: Partial<{
  tabs: Array<{ id: string; targetConnection?: { state: string }; timeoutMs?: number }>;
  updateTab: ReturnType<typeof vi.fn>;
}> = {}) {
  const tabs = overrides.tabs ?? [{ id: 'tab-1', timeoutMs: 5000 }];
  const updateTab = overrides.updateTab ?? vi.fn();
  return {
    sessionRef: { current: { tabs } },
    updateTab,
  };
}

describe('grpcStudioTargetConnection', () => {
  beforeEach(() => {
    resetGrpcTargetProbeGenerationForTests();
    probeGrpcTargetConnection.mockReset();
  });

  it('ignores stale probe results after target edit during connecting', async () => {
    let resolveProbe: ((value: unknown) => void) | undefined;
    probeGrpcTargetConnection.mockImplementation(() => new Promise((resolve) => {
      resolveProbe = resolve;
    }));

    const updateTab = vi.fn();
    const core = makeCore({
      tabs: [{ id: 'tab-1', timeoutMs: 120_000, targetConnection: { state: 'connecting' } }],
      updateTab,
    });
    const runtimeCtx = {} as GrpcStudioRuntimeContext;
    const connectTarget = createConnectTargetHandler(runtimeCtx, core as never);

    const connectPromise = connectTarget('tab-1');
    expect(probeGrpcTargetConnection).toHaveBeenCalledWith(
      expect.anything(),
      5_000,
    );

    // Simulate target edit resetting connection while probe is in-flight.
    bumpGrpcTargetProbeGeneration('tab-1');

    resolveProbe?.({
      state: 'connected',
      latencyMs: 9,
      checkedAt: new Date().toISOString(),
    });
    await connectPromise;

    expect(updateTab).not.toHaveBeenCalledWith('tab-1', {
      targetConnection: expect.objectContaining({ state: 'connected' }),
    });
  });

  it('ignores stale probe results after disconnect during connecting', async () => {
    let resolveProbe: ((value: unknown) => void) | undefined;
    probeGrpcTargetConnection.mockImplementation(() => new Promise((resolve) => {
      resolveProbe = resolve;
    }));

    const updateTab = vi.fn();
    const core = makeCore({ updateTab });
    const runtimeCtx = {} as GrpcStudioRuntimeContext;
    const connectTarget = createConnectTargetHandler(runtimeCtx, core as never);
    const disconnectTarget = createDisconnectTargetHandler(core as never);

    const connectPromise = connectTarget('tab-1');
    expect(updateTab).toHaveBeenCalledWith('tab-1', { targetConnection: { state: 'connecting' } });

    disconnectTarget('tab-1');
    resolveProbe?.({
      state: 'connected',
      latencyMs: 9,
      checkedAt: new Date().toISOString(),
    });
    await connectPromise;

    expect(updateTab).toHaveBeenCalledWith('tab-1', { targetConnection: { state: 'idle' } });
    expect(updateTab).not.toHaveBeenCalledWith('tab-1', {
      targetConnection: expect.objectContaining({ state: 'connected' }),
    });
  });

  it('toggle disconnects while connecting', () => {
    const updateTab = vi.fn();
    const core = makeCore({
      tabs: [{ id: 'tab-1', targetConnection: { state: 'connecting' } }],
      updateTab,
    });
    const connectTarget = vi.fn();
    const disconnectTarget = createDisconnectTargetHandler(core as never);
    const toggle = createToggleTargetConnectionHandler(core as never, connectTarget, disconnectTarget);

    toggle('tab-1');

    expect(connectTarget).not.toHaveBeenCalled();
    expect(updateTab).toHaveBeenCalledWith('tab-1', { targetConnection: { state: 'idle' } });
  });

  it('applies successful probe session when generation is current', async () => {
    probeGrpcTargetConnection.mockResolvedValue({
      state: 'connected',
      latencyMs: 12,
      checkedAt: '2026-07-01T00:00:00.000Z',
    });

    const updateTab = vi.fn();
    const core = makeCore({ updateTab });
    const connectTarget = createConnectTargetHandler({} as GrpcStudioRuntimeContext, core as never);

    await connectTarget('tab-1');

    expect(updateTab).toHaveBeenCalledWith('tab-1', { targetConnection: { state: 'connecting' } });
    expect(updateTab).toHaveBeenCalledWith('tab-1', {
      targetConnection: expect.objectContaining({ state: 'connected', latencyMs: 12 }),
    });
  });

  it('no-ops connect when tab is missing', async () => {
    const updateTab = vi.fn();
    const core = makeCore({ tabs: [], updateTab });
    const connectTarget = createConnectTargetHandler({} as GrpcStudioRuntimeContext, core as never);
    await connectTarget('missing');
    expect(probeGrpcTargetConnection).not.toHaveBeenCalled();
    expect(updateTab).not.toHaveBeenCalled();
  });

  it('toggle connects when idle', () => {
    const connectTarget = vi.fn();
    const disconnectTarget = vi.fn();
    const core = makeCore({ tabs: [{ id: 'tab-1', targetConnection: { state: 'idle' } }] });
    const toggle = createToggleTargetConnectionHandler(core as never, connectTarget, disconnectTarget);
    toggle('tab-1');
    expect(connectTarget).toHaveBeenCalledWith('tab-1');
    expect(disconnectTarget).not.toHaveBeenCalled();
  });

  it('toggle disconnects when connected', () => {
    const connectTarget = vi.fn();
    const disconnectTarget = vi.fn();
    const core = makeCore({ tabs: [{ id: 'tab-1', targetConnection: { state: 'connected' } }] });
    const toggle = createToggleTargetConnectionHandler(core as never, connectTarget, disconnectTarget);
    toggle('tab-1');
    expect(disconnectTarget).toHaveBeenCalledWith('tab-1');
    expect(connectTarget).not.toHaveBeenCalled();
  });

  it('applies error probe session when generation is current', async () => {
    probeGrpcTargetConnection.mockResolvedValue({
      state: 'error',
      errorMessage: 'refused',
      checkedAt: '2026-07-01T00:00:00.000Z',
    });
    const updateTab = vi.fn();
    const core = makeCore({ updateTab });
    const connectTarget = createConnectTargetHandler({} as GrpcStudioRuntimeContext, core as never);
    await connectTarget('tab-1');
    expect(updateTab).toHaveBeenCalledWith('tab-1', {
      targetConnection: expect.objectContaining({ state: 'error', errorMessage: 'refused' }),
    });
  });

  it('disconnectTarget resets connection to idle', () => {
    const updateTab = vi.fn();
    const core = makeCore({ updateTab });
    const disconnectTarget = createDisconnectTargetHandler(core as never);
    disconnectTarget('tab-1');
    expect(updateTab).toHaveBeenCalledWith('tab-1', { targetConnection: { state: 'idle' } });
  });

  it('toggle is a no-op when tab is missing', () => {
    const connectTarget = vi.fn();
    const disconnectTarget = vi.fn();
    const core = makeCore({ tabs: [] });
    const toggle = createToggleTargetConnectionHandler(core as never, connectTarget, disconnectTarget);
    toggle('missing-tab');
    expect(connectTarget).not.toHaveBeenCalled();
    expect(disconnectTarget).not.toHaveBeenCalled();
  });

  it('toggle connects when tab has no targetConnection field', () => {
    const connectTarget = vi.fn();
    const disconnectTarget = vi.fn();
    const core = makeCore({ tabs: [{ id: 'tab-1' }] });
    const toggle = createToggleTargetConnectionHandler(core as never, connectTarget, disconnectTarget);
    toggle('tab-1');
    expect(connectTarget).toHaveBeenCalledWith('tab-1');
  });
});
