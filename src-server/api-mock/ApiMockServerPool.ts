/**
 * API Mock Studio — server pool (Phase 2B).
 * Manages multiple mock listeners keyed by serverId.
 */
import type {
  ApiMockServerDefinitionV1,
  ApiMockTransactionV1,
  ApiMockServerState,
  ApiMockLocalDiagnosticsV1,
} from '../../src/shared/api-mock/contracts.js';
import type { ApiMockRecordedDraftV1 } from '../../src/shared/api-mock/proxyRecording.js';
import { ApiMockNetworkListener, isPortAvailable } from './ApiMockNetworkListener.js';
import { AUTO_PORT_RANGE } from '../../src/shared/api-mock/defaults.js';
import type { ScenarioState } from '../../src/shared/api-mock/scenarioRuntime.js';
import type { SequenceState } from '../../src/shared/api-mock/responseSelector.js';

const MAX_RECORDED_DRAFTS = 200;

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
  private readonly recordedDrafts = new Map<string, ApiMockRecordedDraftV1[]>();
  private onTransaction: ((tx: ApiMockTransactionV1) => void) | undefined;

  setTransactionHandler(handler: (tx: ApiMockTransactionV1) => void): void {
    this.onTransaction = handler;
  }

  private pushRecordedDraft(serverId: string, draft: ApiMockRecordedDraftV1): void {
    const list = this.recordedDrafts.get(serverId) ?? [];
    if (list.some(d => d.fingerprint === draft.fingerprint)) return;
    list.push(draft);
    while (list.length > MAX_RECORDED_DRAFTS) list.shift();
    this.recordedDrafts.set(serverId, list);
  }

  getRecordedDrafts(serverId: string): ApiMockRecordedDraftV1[] {
    return [...(this.recordedDrafts.get(serverId) ?? [])];
  }

  clearRecordedDrafts(serverId: string): void {
    this.recordedDrafts.delete(serverId);
  }

  /** Remove drafts that the Studio has already merged into the workspace. */
  acknowledgeRecordedDrafts(serverId: string, ids: string[]): number {
    const list = this.recordedDrafts.get(serverId);
    if (!list?.length) return 0;
    const drop = new Set(ids);
    const next = list.filter(d => !drop.has(d.id));
    const removed = list.length - next.length;
    if (next.length) this.recordedDrafts.set(serverId, next);
    else this.recordedDrafts.delete(serverId);
    return removed;
  }

  /** Ports held by entries that still own a socket. Stopped entries hold none. */
  private reservedPorts(): Set<number> {
    return new Set(
      [...this.entries.values()]
        .filter(e => e.state !== 'stopped' || e.listener.isRunning())
        .map(e => e.port),
    );
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

    // Only a server that still holds the socket owns the port; a stopped entry
    // lingers in the map for status/journal reads but must not block reuse.
    const portOwner = [...this.entries.values()].find(e => (
      e.port === definition.port
      && e.serverId !== definition.id
      && (e.state !== 'stopped' || e.listener.isRunning())
    ));
    if (portOwner) {
      throw new Error(`Port ${definition.port} is owned by server "${portOwner.serverId}"`);
    }

    const listener = new ApiMockNetworkListener({
      serverId: definition.id,
      definition,
      onTransaction: this.onTransaction,
      onRecordedDraft: draft => this.pushRecordedDraft(definition.id, draft),
      getActiveMockPorts: () => [...this.reservedPorts()],
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

  getSequenceState(serverId: string): SequenceState | undefined {
    const entry = this.entries.get(serverId);
    if (!entry || !entry.listener.isRunning()) return undefined;
    return entry.listener.getSequenceState();
  }

  getListenerDiagnostics(serverId: string): Omit<ApiMockLocalDiagnosticsV1, 'journal'> | undefined {
    const entry = this.entries.get(serverId);
    return entry?.listener.getLocalDiagnostics();
  }

  /** Combined runtime snapshot for the Studio dock / editors. */
  getRuntimeState(serverId: string): (ScenarioState & { sequencePositions: Record<string, number> }) | undefined {
    const entry = this.entries.get(serverId);
    if (!entry || !entry.listener.isRunning()) return undefined;
    const scenario = entry.listener.getScenarioState();
    const sequence = entry.listener.getSequenceState();
    return {
      states: scenario.states,
      counters: scenario.counters,
      sequencePositions: sequence.positions,
    };
  }

  resetScenarioState(serverId: string): boolean {
    const entry = this.entries.get(serverId);
    if (!entry || !entry.listener.isRunning()) return false;
    entry.listener.resetScenario();
    return true;
  }
}

export const apiMockPool = new ApiMockServerPool();
