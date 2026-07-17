import { useMemo } from 'react';
import type { Microservice } from '../../../shared/types';
import { buildEnvVarMap } from '../../../shared/utils/envVarUtils';
import { getRowStatus } from '../../environments/utils/protocolEndpointUtils';
import { buildLegacyGrpcEnvVarMap } from '../utils/grpcStudioPageEnv';
import type { GrpcTabConnectionPageDefaults } from '../utils/resolveGrpcTabConnection';

export interface UseGrpcStudioPageEnvContextOptions {
  resolvedBaseUrl?: string;
  envName?: string;
  svcName?: string;
  selectedSvc?: Microservice;
  selectedEnvId?: string;
  workspaceDefaultsOverride?: Record<string, string>;
}

export function useGrpcStudioPageEnvContext({
  resolvedBaseUrl,
  envName,
  svcName,
  selectedSvc,
  selectedEnvId,
  workspaceDefaultsOverride,
}: UseGrpcStudioPageEnvContextOptions) {
  const envVarMap = useMemo(() => {
    if (selectedSvc && selectedEnvId) {
      return buildEnvVarMap(selectedSvc, selectedEnvId, 'grpc', envName);
    }
    return buildLegacyGrpcEnvVarMap(resolvedBaseUrl, envName, svcName);
  }, [selectedSvc, selectedEnvId, resolvedBaseUrl, envName, svcName]);

  const workspaceDefaults = useMemo(() => {
    const legacyDefaults = buildLegacyGrpcEnvVarMap(resolvedBaseUrl, envName, svcName);
    if (!workspaceDefaultsOverride) return legacyDefaults;
    return { ...legacyDefaults, ...workspaceDefaultsOverride };
  }, [resolvedBaseUrl, envName, svcName, workspaceDefaultsOverride]);

  const pageDefaults = useMemo<GrpcTabConnectionPageDefaults>(() => ({
    target: envVarMap.grpcHost ?? '',
    tlsMode: 'disabled' as const,
  }), [envVarMap.grpcHost]);

  const endpointProtocolStatus = useMemo(() => {
    if (selectedSvc && selectedEnvId) {
      return getRowStatus(selectedSvc, 'grpc', selectedEnvId);
    }
    return undefined;
  }, [selectedSvc, selectedEnvId]);

  const defaultAuthProfileId = selectedSvc?.authProfileIds?.[selectedEnvId ?? ''] ?? null;

  return {
    envVarMap,
    workspaceDefaults,
    pageDefaults,
    endpointProtocolStatus,
    defaultAuthProfileId,
  };
}
