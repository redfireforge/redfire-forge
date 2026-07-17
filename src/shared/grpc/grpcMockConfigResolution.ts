/**
 * Phase 11E - gRPC mock config resolution.
 *
 * Resolves effective mock rule sets from tab override → connection profile → workspace default.
 * Persistence wiring belongs to Phase 11G UI.
 */

import type { GrpcMockRuleSet } from './grpcMockRuleContracts';
import type { GrpcMockLatencyPolicy } from './grpcMockLatencySimulation';

export const GRPC_MOCK_TAB_OVERRIDE_STORAGE_PREFIX = 'grpc-mock-tab-override-';
export const GRPC_MOCK_CONNECTION_CONFIG_STORAGE_PREFIX = 'grpc-mock-config-';

export interface GrpcMockConfigSource {
  ruleSet: GrpcMockRuleSet;
  latencyPolicy?: GrpcMockLatencyPolicy;
}

export interface GrpcMockResolvedMockConfig extends GrpcMockConfigSource {
  source: 'tab_override' | 'connection_profile' | 'workspace_default';
  connectionId: string;
}

export interface GrpcMockTabMockSlice {
  tabId: string;
  connectionId?: string;
  mockConfigOverride?: GrpcMockConfigSource;
}

export interface GrpcMockConnectionProfileMockSlice {
  connectionId: string;
  mockConfig?: GrpcMockConfigSource;
}

export function grpcMockTabOverrideStorageKey(tabId: string): string {
  return `${GRPC_MOCK_TAB_OVERRIDE_STORAGE_PREFIX}${tabId}`;
}

export function grpcMockConnectionConfigStorageKey(connectionId: string): string {
  return `${GRPC_MOCK_CONNECTION_CONFIG_STORAGE_PREFIX}${connectionId}`;
}

export function resolveGrpcMockConnectionId(
  tab: Pick<GrpcMockTabMockSlice, 'tabId' | 'connectionId'>,
  pageDefaultConnectionId?: string,
): string {
  if (tab.connectionId?.trim()) {
    return tab.connectionId.trim();
  }
  if (pageDefaultConnectionId?.trim()) {
    return pageDefaultConnectionId.trim();
  }
  return tab.tabId;
}

export function resolveGrpcTabMockConfig(
  tab: GrpcMockTabMockSlice,
  profile: GrpcMockConnectionProfileMockSlice | undefined,
  workspaceDefault: GrpcMockConfigSource,
): GrpcMockResolvedMockConfig {
  const connectionId = resolveGrpcMockConnectionId(tab, profile?.connectionId);

  if (tab.mockConfigOverride != null) {
    return {
      ...cloneMockConfigSource(tab.mockConfigOverride),
      source: 'tab_override',
      connectionId,
    };
  }

  if (profile?.mockConfig != null) {
    return {
      ...cloneMockConfigSource(profile.mockConfig),
      source: 'connection_profile',
      connectionId,
    };
  }

  return {
    ...cloneMockConfigSource(workspaceDefault),
    source: 'workspace_default',
    connectionId,
  };
}

function cloneMockConfigSource(source: GrpcMockConfigSource): GrpcMockConfigSource {
  return {
    ruleSet: structuredClone(source.ruleSet),
    ...(source.latencyPolicy != null ? { latencyPolicy: structuredClone(source.latencyPolicy) } : {}),
  };
}
