/**
 * Phase 11M — tab-scoped gRPC mock listener pool (app-scoped process registry).
 */
import type { GrpcDescriptor } from '../../src/shared/grpc/contracts.js';
import type {
  GrpcMockListenerCommitRequest,
  GrpcMockListenerCommitResult,
  GrpcMockListenerLogEntry,
  GrpcMockListenerStartRequest,
  GrpcMockListenerStartResult,
  GrpcMockListenerStatus,
} from '../../src/shared/grpc/grpcMockListenerContracts.js';
import { assertGrpcMockRuleSet } from '../../src/shared/grpc/grpcMockRuleContracts.js';
import { assertGrpcMockLatencyPolicy } from '../../src/shared/grpc/grpcMockLatencySimulation.js';
import { normalizeRootToDescriptor } from './descriptorNormalizer.js';
import { getGrpcDescriptor, setGrpcDescriptor } from './descriptorStore.js';
import { setDescriptorRootCache } from './descriptorRootCache.js';
import { parseProtosetBase64 } from './protoDescriptorParser.js';
import { GrpcMockNetworkListener, tryAllocateGrpcMockListenerPort } from './grpcMockNetworkListener.js';
import { getServerGrpcMockRuntimeRegistry } from './grpcMockServerRuntimeBridge.js';

interface PoolEntry {
  tabId: string;
  port: number;
  listener: GrpcMockNetworkListener;
  descriptor: GrpcDescriptor;
}

export class GrpcMockServerPool {
  private readonly entries = new Map<string, PoolEntry>();

  private reservedPorts(): Set<number> {
    return new Set([...this.entries.values()].map((entry) => entry.port));
  }

  private resolveDescriptor(input: {
    descriptorKey: string;
    protosetBase64?: string;
    contentSha256?: string;
  }): GrpcDescriptor {
    const protoset = input.protosetBase64?.trim();
    if (protoset) {
      const root = parseProtosetBase64(protoset);
      const normalized = normalizeRootToDescriptor(root, 'protoset', '', {
        sourceRef: input.descriptorKey,
      });
      const descriptor: GrpcDescriptor = {
        ...normalized,
        key: input.descriptorKey,
        contentSha256: input.contentSha256?.trim() || normalized.contentSha256,
      };
      setGrpcDescriptor(descriptor);
      setDescriptorRootCache(descriptor.key, root);
      return descriptor;
    }

    const cached = getGrpcDescriptor(input.descriptorKey);
    if (cached) {
      return cached;
    }
    throw new Error(
      `Descriptor "${input.descriptorKey}" is not loaded on the server. Reflect or describe on this tab first.`,
    );
  }

  async start(request: GrpcMockListenerStartRequest): Promise<GrpcMockListenerStartResult> {
    const tabId = request.tabId.trim();
    if (!tabId) {
      throw new Error('tabId is required.');
    }

    assertGrpcMockRuleSet(request.ruleSet);
    assertGrpcMockLatencyPolicy(request.latencyPolicy);

    const existing = this.entries.get(tabId);
    if (existing) {
      await this.stop(tabId);
    }

    const descriptor = this.resolveDescriptor({
      descriptorKey: request.descriptorKey,
      protosetBase64: request.protosetBase64,
      contentSha256: request.contentSha256,
    });

    const registry = getServerGrpcMockRuntimeRegistry();
    let listener: GrpcMockNetworkListener | undefined;
    try {
      if (registry.hasManager(tabId)) {
        registry.stopTab(tabId, { force: true });
      }
      registry.startTab(tabId, {
        connectionId: request.connectionId,
        ruleSet: request.ruleSet,
        latencyPolicy: request.latencyPolicy,
      });
      const manager = registry.getManager(tabId);

      listener = new GrpcMockNetworkListener(tabId, manager);
      const port = request.port ?? await tryAllocateGrpcMockListenerPort(this.reservedPorts(), request.port);
      const status = await listener.start({
        tabId,
        connectionId: request.connectionId,
        descriptor,
        port,
      });

      this.entries.set(tabId, {
        tabId,
        port: status.port ?? port,
        listener,
        descriptor,
      });
      return { status };
    } catch (error) {
      if (listener != null) {
        await listener.stop().catch(() => undefined);
      }
      registry.stopTab(tabId, { force: true });
      throw error;
    }
  }

  async stop(tabId: string): Promise<GrpcMockListenerStatus> {
    const entry = this.entries.get(tabId);
    if (entry == null) {
      getServerGrpcMockRuntimeRegistry().stopTab(tabId);
      return {
        running: false,
        tabId,
        generation: 0,
        inFlightCount: 0,
      };
    }
    const status = await entry.listener.stop();
    this.entries.delete(tabId);
    getServerGrpcMockRuntimeRegistry().remove(tabId, { force: true });
    return status;
  }

  commit(request: GrpcMockListenerCommitRequest): GrpcMockListenerCommitResult {
    const tabId = request.tabId.trim();
    const entry = this.entries.get(tabId);
    if (entry == null) {
      throw new Error(`No mock listener registered for tab: ${tabId}`);
    }
    assertGrpcMockRuleSet(request.ruleSet);
    assertGrpcMockLatencyPolicy(request.latencyPolicy);
    const manager = getServerGrpcMockRuntimeRegistry().getManager(tabId);
    const committed = manager.commitRuleSet(request.ruleSet);
    if (request.latencyPolicy != null) {
      manager.commitLatencyPolicy(request.latencyPolicy);
    }
    return {
      generation: committed.generation,
      committedAt: committed.committedAt,
    };
  }

  getStatus(tabId: string): GrpcMockListenerStatus {
    const entry = this.entries.get(tabId);
    if (entry == null) {
      return {
        running: false,
        tabId,
        generation: 0,
        inFlightCount: 0,
      };
    }
    return entry.listener.getStatus();
  }

  getLogs(tabId: string, since = -1): GrpcMockListenerLogEntry[] {
    const entry = this.entries.get(tabId);
    if (entry == null) {
      return [];
    }
    return entry.listener.getLogs(since);
  }

  resolveDescriptorForListenTarget(listenTarget: string): GrpcDescriptor | undefined {
    const normalizedTarget = listenTarget.trim();
    if (!normalizedTarget) {
      return undefined;
    }

    for (const entry of this.entries.values()) {
      if (entry.listener.getStatus().listenTarget === normalizedTarget) {
        return entry.descriptor;
      }
    }

    return undefined;
  }

  stopAll(): void {
    for (const tabId of [...this.entries.keys()]) {
      void this.stop(tabId);
    }
  }

  async stopAllAsync(): Promise<void> {
    for (const tabId of [...this.entries.keys()]) {
      await this.stop(tabId);
    }
  }
}

export const grpcMockServerPool = new GrpcMockServerPool();

export async function resetGrpcMockServerPoolForTests(): Promise<void> {
  await grpcMockServerPool.stopAllAsync();
}
