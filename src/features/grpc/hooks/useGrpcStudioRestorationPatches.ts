/**
 * Patch generators for restoring persisted gRPC Studio session state.
 */

import type { GrpcStudioTabState, GrpcTabDescriptorState } from '../grpcStudioTypes';
import type { GrpcStudioPersistedSession } from './useGrpcStudioPersistence';

type PersistableDescriptorState = Pick<
  GrpcTabDescriptorState,
  'sourceSelection' | 'expandedServiceIds'
>;

/**
 * Generate tab state patches from a persisted session.
 * For each tab in the persisted session, create a patch that restores its state.
 * Skip tabs that don't exist in the current session (they may have been deleted).
 */
export function generateRestoredTabPatches(
  currentTabs: GrpcStudioTabState[],
  persisted: GrpcStudioPersistedSession,
): Array<{ tabId: string; patch: Partial<GrpcStudioTabState> }> {
  const patches: Array<{ tabId: string; patch: Partial<GrpcStudioTabState> }> = [];

  // Create a map of current tabs by ID for quick lookup
  const currentTabsById = new Map(currentTabs.map((tab) => [tab.id, tab]));

  // For each persisted tab, generate a patch if the tab still exists
  for (const persistedTab of persisted.tabs) {
    const currentTab = currentTabsById.get(persistedTab.id);
    if (!currentTab) {
      // Tab was deleted, skip it
      continue;
    }

    // Create a patch with all persistable properties
    const patch: Partial<GrpcStudioTabState> = {};

    // Only include properties that differ from current state
    if (persistedTab.target !== currentTab.target) {
      patch.target = persistedTab.target;
    }
    if (persistedTab.tlsMode !== currentTab.tlsMode) {
      patch.tlsMode = persistedTab.tlsMode;
    }
    if (JSON.stringify(persistedTab.tlsConfig) !== JSON.stringify(currentTab.tlsConfig)) {
      patch.tlsConfig = persistedTab.tlsConfig;
    }
    if (JSON.stringify(persistedTab.auth) !== JSON.stringify(currentTab.auth)) {
      patch.auth = persistedTab.auth;
    }
    if (JSON.stringify(persistedTab.metadata) !== JSON.stringify(currentTab.metadata)) {
      patch.metadata = persistedTab.metadata;
    }
    if (persistedTab.timeoutMs !== currentTab.timeoutMs) {
      patch.timeoutMs = persistedTab.timeoutMs;
    }
    if (persistedTab.connectionId !== currentTab.connectionId) {
      patch.connectionId = persistedTab.connectionId;
    }
    if (persistedTab.requestMode !== currentTab.requestMode) {
      patch.requestMode = persistedTab.requestMode;
    }
    if (JSON.stringify(persistedTab.body) !== JSON.stringify(currentTab.body)) {
      patch.body = persistedTab.body;
    }
    if (JSON.stringify(persistedTab.envVarOverrides) !== JSON.stringify(currentTab.envVarOverrides)) {
      patch.envVarOverrides = persistedTab.envVarOverrides;
    }
    if (persistedTab.servicesCollapsed !== currentTab.servicesCollapsed) {
      patch.servicesCollapsed = persistedTab.servicesCollapsed;
    }

    // Only add patch if there are differences
    if (Object.keys(patch).length > 0) {
      patches.push({ tabId: persistedTab.id, patch });
    }
  }

  return patches;
}

/**
 * Generate descriptor state patches from a persisted session.
 */
export function generateRestoredDescriptorPatches(
  currentTabDescriptors: Record<string, GrpcTabDescriptorState>,
  persisted: GrpcStudioPersistedSession,
): Array<{ tabId: string; patch: Partial<PersistableDescriptorState> }> {
  const patches: Array<{ tabId: string; patch: Partial<PersistableDescriptorState> }> = [];

  for (const [tabId, persistedDesc] of Object.entries(persisted.tabDescriptors)) {
    const currentDesc = currentTabDescriptors[tabId];
    if (!currentDesc) {
      // Tab descriptor doesn't exist, skip
      continue;
    }

    const patch: Partial<PersistableDescriptorState> = {};

    if (JSON.stringify(persistedDesc.sourceSelection) !== JSON.stringify(currentDesc.sourceSelection)) {
      patch.sourceSelection = persistedDesc.sourceSelection;
    }
    if (JSON.stringify(persistedDesc.expandedServiceIds) !== JSON.stringify(currentDesc.expandedServiceIds)) {
      patch.expandedServiceIds = persistedDesc.expandedServiceIds;
    }

    if (Object.keys(patch).length > 0) {
      patches.push({ tabId, patch });
    }
  }

  return patches;
}
