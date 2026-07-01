/**
 * Phase 11E - Per-tab gRPC mock runtime registry.
 *
 * Routes mock execution to the active tab manager and cleans up on tab close.
 */

import type { GrpcMockRuntimeManager, GrpcMockRuntimeStartConfig } from './grpcMockRuntimeCore';
import { createGrpcMockRuntimeManager } from './grpcMockRuntimeCore';
import type { GrpcMockResolvedMockConfig } from './grpcMockConfigResolution';

export interface GrpcMockRuntimeRegistryEntry {
  tabId: string;
  manager: GrpcMockRuntimeManager;
}

export interface GrpcMockRuntimeRegistry {
  getActiveTabId(): string | undefined;
  setActiveTab(tabId: string): void;
  getManager(tabId: string): GrpcMockRuntimeManager;
  hasManager(tabId: string): boolean;
  remove(tabId: string): boolean;
  startTab(tabId: string, config: GrpcMockRuntimeStartConfig): GrpcMockRuntimeManager;
  startTabFromResolved(tabId: string, resolved: GrpcMockResolvedMockConfig): GrpcMockRuntimeManager;
  stopTab(tabId: string): void;
  listTabIds(): string[];
}

export function createGrpcMockRuntimeRegistry(): GrpcMockRuntimeRegistry {
  const managers = new Map<string, GrpcMockRuntimeManager>();
  let activeTabId: string | undefined;

  const getOrCreate = (tabId: string): GrpcMockRuntimeManager => {
    let manager = managers.get(tabId);
    if (manager == null) {
      manager = createGrpcMockRuntimeManager();
      managers.set(tabId, manager);
    }
    return manager;
  };

  return {
    getActiveTabId() {
      return activeTabId;
    },

    setActiveTab(tabId) {
      activeTabId = tabId;
    },

    getManager(tabId) {
      const manager = managers.get(tabId);
      if (manager == null) {
        throw new GrpcMockRuntimeRegistryTabNotFoundError(tabId);
      }
      return manager;
    },

    hasManager(tabId) {
      return managers.has(tabId);
    },

    remove(tabId) {
      const manager = managers.get(tabId);
      if (manager == null) {
        return false;
      }
      manager.stop();
      const removed = managers.delete(tabId);
      if (removed && activeTabId === tabId) {
        activeTabId = undefined;
      }
      return removed;
    },

    startTab(tabId, config) {
      const manager = getOrCreate(tabId);
      manager.start(config);
      return manager;
    },

    startTabFromResolved(tabId, resolved) {
      return this.startTab(tabId, {
        connectionId: resolved.connectionId,
        ruleSet: resolved.ruleSet,
        latencyPolicy: resolved.latencyPolicy,
      });
    },

    stopTab(tabId) {
      const manager = managers.get(tabId);
      if (manager == null) {
        return;
      }
      manager.stop();
    },

    listTabIds() {
      return [...managers.keys()];
    },
  };
}

export class GrpcMockRuntimeRegistryTabNotFoundError extends Error {
  readonly category = 'runtime' as const;
  readonly tabId: string;

  constructor(tabId: string) {
    super(`No mock runtime registered for tab: ${tabId}`);
    this.name = 'GrpcMockRuntimeRegistryTabNotFoundError';
    this.tabId = tabId;
  }
}
