import { useMemo } from 'react';
import type { Microservice } from '@shared/types';
import {
  buildGraphqlGlobalEnvMap,
  resolveGraphqlEndpointProtocolStatus,
} from '../utils/graphqlStudioEnvUtils';

export interface UseGraphqlStudioEnvMapArgs {
  selectedSvc?: Microservice;
  selectedEnvId?: string;
  resolvedBaseUrl?: string;
  envName?: string;
  svcName?: string;
}

export function useGraphqlStudioEnvMap({
  selectedSvc,
  selectedEnvId,
  resolvedBaseUrl,
  envName,
  svcName,
}: UseGraphqlStudioEnvMapArgs) {
  const globalEnvMap = useMemo(
    () => buildGraphqlGlobalEnvMap(selectedSvc, selectedEnvId, resolvedBaseUrl, envName, svcName),
    [selectedSvc, selectedEnvId, resolvedBaseUrl, envName, svcName],
  );

  const endpointProtocolStatus = useMemo(
    () => resolveGraphqlEndpointProtocolStatus(selectedSvc, selectedEnvId),
    [selectedSvc, selectedEnvId],
  );

  return { globalEnvMap, endpointProtocolStatus };
}
