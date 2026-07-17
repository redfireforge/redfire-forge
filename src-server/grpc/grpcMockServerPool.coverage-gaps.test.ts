/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FIXTURE_DESCRIPTOR,
  FIXTURE_ECHO_PROTO,
} from '../../src/shared/grpc/contractFixtures.js';
import { clearGrpcDescriptorStore, getGrpcDescriptor, setGrpcDescriptor } from './descriptorStore.js';
import { encodeRootAsProtosetBase64, parseProtoFiles } from './protoDescriptorParser.js';
import {
  getServerGrpcMockRuntimeRegistry,
  resetServerGrpcMockRuntimeRegistryForTests,
} from './grpcMockServerRuntimeBridge.js';

const listenerMocks = vi.hoisted(() => {
  const instances: Array<{
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    getStatus: ReturnType<typeof vi.fn>;
    getLogs: ReturnType<typeof vi.fn>;
  }> = [];
  let startError: Error | null = null;
  let stopError: Error | null = null;
  let omitPortInStatus = false;
  let allocatedPort = 50061;

  return {
    instances,
    startError: {
      get: () => startError,
      set: (value: Error | null) => { startError = value; },
    },
    stopError: {
      get: () => stopError,
      set: (value: Error | null) => { stopError = value; },
    },
    omitPortInStatus: {
      get: () => omitPortInStatus,
      set: (value: boolean) => { omitPortInStatus = value; },
    },
    allocatedPort: {
      get: () => allocatedPort,
      set: (value: number) => { allocatedPort = value; },
    },
    reset() {
      instances.length = 0;
      startError = null;
      stopError = null;
      omitPortInStatus = false;
      allocatedPort = 50061;
    },
  };
});

vi.mock('./grpcMockNetworkListener.js', () => ({
  tryAllocateGrpcMockListenerPort: vi.fn(async () => listenerMocks.allocatedPort.get()),
  GrpcMockNetworkListener: vi.fn(function MockListener(this: unknown) {
    const instance = {
      start: vi.fn(async () => {
        const error = listenerMocks.startError.get();
        if (error) {
          throw error;
        }
        const port = listenerMocks.allocatedPort.get();
        return {
          running: true,
          tabId: 'tab-1',
          ...(listenerMocks.omitPortInStatus.get() ? {} : { port }),
          listenTarget: `127.0.0.1:${port}`,
          generation: 1,
          inFlightCount: 0,
        };
      }),
      stop: vi.fn(async () => {
        const error = listenerMocks.stopError.get();
        if (error) {
          throw error;
        }
        return {
          running: false,
          tabId: 'tab-1',
          generation: 0,
          inFlightCount: 0,
        };
      }),
      getStatus: vi.fn(() => {
        const port = listenerMocks.allocatedPort.get();
        return {
          running: true,
          tabId: 'tab-1',
          listenTarget: `127.0.0.1:${port}`,
          generation: 1,
          inFlightCount: 0,
        };
      }),
      getLogs: vi.fn(() => [{ id: 1, ts: 'now', event: 'listener-start' as const }]),
    };
    listenerMocks.instances.push(instance);
    return instance;
  }),
}));

import { GrpcMockServerPool } from './grpcMockServerPool.js';
import { tryAllocateGrpcMockListenerPort } from './grpcMockNetworkListener.js';

const BASE_START_REQUEST = {
  tabId: 'tab-pool',
  connectionId: 'conn-pool',
  descriptorKey: FIXTURE_DESCRIPTOR.key,
  ruleSet: {
    rules: [{
      id: 'echo',
      name: 'Echo',
      enabled: true,
      priority: 1,
      predicate: { kind: 'method_equals' as const, method: 'Echo' },
      response: { statusCode: 0, body: { message: 'ok' } },
    }],
  },
};

describe('grpcMockServerPool coverage gaps', () => {
  let pool: GrpcMockServerPool;

  beforeEach(() => {
    listenerMocks.reset();
    resetServerGrpcMockRuntimeRegistryForTests();
    clearGrpcDescriptorStore();
    setGrpcDescriptor(FIXTURE_DESCRIPTOR);
    pool = new GrpcMockServerPool();
    vi.mocked(tryAllocateGrpcMockListenerPort).mockClear();
  });

  it('rejects empty tabId on start', async () => {
    await expect(pool.start({ ...BASE_START_REQUEST, tabId: '   ' }))
      .rejects.toThrow(/tabId is required/i);
  });

  it('resolves descriptor from protoset payload and stores it', async () => {
    clearGrpcDescriptorStore();
    const root = parseProtoFiles([{ path: 'echo.proto', content: FIXTURE_ECHO_PROTO }]);
    const protosetBase64 = encodeRootAsProtosetBase64(root);

    await pool.start({
      ...BASE_START_REQUEST,
      descriptorKey: 'protoset-key',
      protosetBase64,
      contentSha256: 'custom-sha',
    });

    const stored = getGrpcDescriptor('protoset-key');
    expect(stored?.key).toBe('protoset-key');
    expect(stored?.contentSha256).toBe('custom-sha');
    await pool.stop(BASE_START_REQUEST.tabId);
  });

  it('falls back to normalized content hash when provided hash is blank', async () => {
    clearGrpcDescriptorStore();
    const root = parseProtoFiles([{ path: 'echo.proto', content: FIXTURE_ECHO_PROTO }]);
    const protosetBase64 = encodeRootAsProtosetBase64(root);

    await pool.start({
      ...BASE_START_REQUEST,
      descriptorKey: 'protoset-blank-sha',
      protosetBase64,
      contentSha256: '   ',
    });

    const stored = getGrpcDescriptor('protoset-blank-sha');
    expect(stored?.key).toBe('protoset-blank-sha');
    expect(stored?.contentSha256).not.toBe('   ');
    await pool.stop(BASE_START_REQUEST.tabId);
  });

  it('uses allocated port when listener status omits port', async () => {
    listenerMocks.omitPortInStatus.set(true);
    await pool.start(BASE_START_REQUEST);
    expect(listenerMocks.instances[0]?.start).toHaveBeenCalled();
    await pool.stop(BASE_START_REQUEST.tabId);
  });

  it('swallows listener stop failures during start cleanup', async () => {
    listenerMocks.startError.set(new Error('listener start failed'));
    listenerMocks.stopError.set(new Error('listener stop failed'));
    await expect(pool.start(BASE_START_REQUEST)).rejects.toThrow(/listener start failed/i);
    expect(listenerMocks.instances[0]?.stop).toHaveBeenCalled();
  });

  it('throws when descriptor is missing from store and protoset payload', async () => {
    clearGrpcDescriptorStore();
    await expect(pool.start({
      ...BASE_START_REQUEST,
      descriptorKey: 'missing-key',
    })).rejects.toThrow(/not loaded on the server/i);
  });

  it('restarts an existing tab listener before starting again', async () => {
    await pool.start(BASE_START_REQUEST);
    const firstInstance = listenerMocks.instances[0];
    await pool.start(BASE_START_REQUEST);
    expect(firstInstance?.stop).toHaveBeenCalled();
    expect(listenerMocks.instances).toHaveLength(2);
    await pool.stop(BASE_START_REQUEST.tabId);
  });

  it('forces stop of an already-registered runtime manager before listener boot', async () => {
    const registry = getServerGrpcMockRuntimeRegistry();
    registry.startTab(BASE_START_REQUEST.tabId, {
      connectionId: BASE_START_REQUEST.connectionId,
      ruleSet: BASE_START_REQUEST.ruleSet,
    });
    const stopSpy = vi.spyOn(registry, 'stopTab');

    await pool.start(BASE_START_REQUEST);

    expect(stopSpy).toHaveBeenCalledWith(BASE_START_REQUEST.tabId, { force: true });
    stopSpy.mockRestore();
    await pool.stop(BASE_START_REQUEST.tabId);
  });

  it('cleans up listener and registry when start fails after listener creation', async () => {
    listenerMocks.startError.set(new Error('listener start failed'));
    await expect(pool.start(BASE_START_REQUEST)).rejects.toThrow(/listener start failed/i);
    expect(listenerMocks.instances[0]?.stop).toHaveBeenCalled();
  });

  it('returns idle status and stops registry when tab is unknown', async () => {
    const status = await pool.stop('missing-tab');
    expect(status.running).toBe(false);
    expect(status.tabId).toBe('missing-tab');
    expect(pool.getStatus('missing-tab').running).toBe(false);
    expect(pool.getLogs('missing-tab')).toEqual([]);
  });

  it('delegates status and logs to active listener entries', async () => {
    await pool.start(BASE_START_REQUEST);

    const status = pool.getStatus(BASE_START_REQUEST.tabId);
    expect(status.running).toBe(true);
    expect(listenerMocks.instances[0]?.getStatus).toHaveBeenCalled();

    const logs = pool.getLogs(BASE_START_REQUEST.tabId, 7);
    expect(listenerMocks.instances[0]?.getLogs).toHaveBeenCalledWith(7);
    expect(logs.length).toBeGreaterThan(0);

    await pool.stop(BASE_START_REQUEST.tabId);
  });

  it('commits latency policy updates for running tabs', () => {
    return pool.start(BASE_START_REQUEST).then(() => {
      const result = pool.commit({
        tabId: BASE_START_REQUEST.tabId,
        ruleSet: BASE_START_REQUEST.ruleSet,
        latencyPolicy: { defaultLatencyMs: 25 },
      });
      expect(result.generation).toBeGreaterThan(0);
      expect(result.committedAt).toBeTruthy();
      return pool.stop(BASE_START_REQUEST.tabId);
    });
  });

  it('throws when committing to an unknown tab', () => {
    expect(() => pool.commit({
      tabId: 'missing-tab',
      ruleSet: BASE_START_REQUEST.ruleSet,
    })).toThrow(/No mock listener registered/i);
  });

  it('resolveDescriptorForListenTarget matches running listeners and ignores blanks', async () => {
    expect(pool.resolveDescriptorForListenTarget('   ')).toBeUndefined();
    await pool.start(BASE_START_REQUEST);
    const resolved = pool.resolveDescriptorForListenTarget('127.0.0.1:50061');
    expect(resolved?.key).toBe(FIXTURE_DESCRIPTOR.key);
    expect(pool.resolveDescriptorForListenTarget('127.0.0.1:59999')).toBeUndefined();
    await pool.stop(BASE_START_REQUEST.tabId);
  });

  it('stopAll and stopAllAsync stop every registered tab', async () => {
    await pool.start({ ...BASE_START_REQUEST, tabId: 'tab-a' });
    await pool.start({ ...BASE_START_REQUEST, tabId: 'tab-b' });
    pool.stopAll();
    await pool.stopAllAsync();
    expect(pool.getStatus('tab-a').running).toBe(false);
    expect(pool.getStatus('tab-b').running).toBe(false);
  });
});
