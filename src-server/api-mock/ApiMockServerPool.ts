/**
 * API Mock Studio — server pool (Phase 2B).
 * Manages multiple mock listeners keyed by serverId.
 */
import type {
  ApiMockServerDefinitionV1,
  ApiMockTransactionV1,
  ApiMockServerState,
} from '../../src/shared/api-mock/contracts.js';
import { ApiMockNetworkListener, isPortAvailable } from './ApiMockNetworkListener.js';
import { AUTO_PORT_RANGE } from '../../src/shared/api-mock/defaults.js';
import type { ScenarioState } from '../../src/shared/api-mock/scenarioRuntime.js';

export interface PoolEntry {
  serverId: string;
  port: number;
  state: ApiMockServerState;
  listener: ApiMockNetworkListener;
  generation: number;
}

export interface PoolStatus {
  serverId: string;
  port: number;
  state: ApiMockServerState;
  generation: number;
  error?: string;
}

export class ApiMockServerPool {
  private readonly entries = new Map<string, PoolEntry>();
  private onTransaction: ((tx: ApiMockTransactionV1) => void) | undefined;

  setTransactionHandler(handler: (tx: ApiMockTransactionV1) => void): void {
    this.onTransaction = handler;
  }

  private reservedPorts(): Set<number> {
    return new Set([...this.entries.values()].map(e => e.port));
  }

  async allocatePort(preferred?: number): Promise<number> {
    if (preferred && preferred >= 1024 && preferred <= 65535) {
      if (!this.reservedPorts().has(preferred) && await isPortAvailable(preferred)) {
        return preferred;
      }
    }
    const reserved = this.reservedPorts();
    for (let port = AUTO_PORT_RANGE.min; port <= AUTO_PORT_RANGE.max; port++) {
      if (reserved.has(port)) continue;
      if (await isPortAvailable(port)) return port;
    }
    throw new Error(`No available port in ${AUTO_PORT_RANGE.min}-${AUTO_PORT_RANGE.max}`);
  }

  async start(definition: ApiMockServerDefinitionV1): Promise<PoolStatus> {
    const existing = this.entries.get(definition.id);
    if (existing?.listener.isRunning()) {
      throw new Error(`Server "${definition.id}" is already running on port ${existing.port}`);
    }

    const portOwner = [...this.entries.values()].find(e => e.port === definition.port && e.serverId !== definition.id);
    if (portOwner) {
      throw new Error(`Port ${definition.port} is owned by server "${portOwner.serverId}"`);
    }

    const listener = new ApiMockNetworkListener({
      serverId: definition.id,
      definition,
      onTransaction: this.onTransaction,
    });

    const { port, generation } = await listener.start();
    const entry: PoolEntry = { serverId: definition.id, port, state: 'running', listener, generation };
    this.entries.set(definition.id, entry);
    return { serverId: definition.id, port, state: 'running', generation };
  }

  async stop(serverId: string): Promise<PoolStatus> {
    const entry = this.entries.get(serverId);
    if (!entry) throw new Error(`Server "${serverId}" not found`);
    if (!entry.listener.isRunning()) {
      entry.state = 'stopped';
      return { serverId, port: entry.port, state: 'stopped', generation: entry.generation };
    }
    entry.state = 'draining';
    await entry.listener.stop();
    entry.state = 'stopped';
    return { serverId, port: entry.port, state: 'stopped', generation: entry.generation };
  }

  async restart(definition: ApiMockServerDefinitionV1): Promise<PoolStatus> {
    const entry = this.entries.get(definition.id);
    if (entry?.listener.isRunning()) await this.stop(definition.id);
    return this.start(definition);
  }

  commit(serverId: string, definition: ApiMockServerDefinitionV1): PoolStatus {
    const entry = this.entries.get(serverId);
    if (!entry || !entry.listener.isRunning()) throw new Error(`Server "${serverId}" is not running`);
    const gen = entry.listener.commit(definition);
    entry.generation = gen;
    return { serverId, port: entry.port, state: 'running', generation: gen };
  }

  status(serverId: string): PoolStatus | undefined {
    const entry = this.entries.get(serverId);
    if (!entry) return undefined;
    return {
      serverId,
      port: entry.port,
      state: entry.listener.isRunning() ? 'running' : 'stopped',
      generation: entry.generation,
    };
  }

  list(): PoolStatus[] {
    return [...this.entries.values()].map(e => ({
      serverId: e.serverId,
      port: e.port,
      state: e.listener.isRunning() ? 'running' : 'stopped',
      generation: e.generation,
    }));
  }

  async stopAllAsync(): Promise<void> {
    const running = [...this.entries.values()].filter(e => e.listener.isRunning());
    await Promise.all(running.map(e => this.stop(e.serverId)));
  }

  getScenarioState(serverId: string): ScenarioState | undefined {
    const entry = this.entries.get(serverId);
    if (!entry || !entry.listener.isRunning()) return undefined;
    return entry.listener.getScenarioState();
  }

  resetScenarioState(serverId: string): boolean {
    const entry = this.entries.get(serverId);
    if (!entry || !entry.listener.isRunning()) return false;
    entry.listener.resetScenario();
    return true;
  }
}

export const apiMockPool = new ApiMockServerPool();
