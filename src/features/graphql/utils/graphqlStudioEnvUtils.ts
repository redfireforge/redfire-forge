import type { Microservice } from '../../../shared/types';
import type { GraphqlAuth, GraphqlEnvironment, GraphqlHeaderRow } from '../../../shared/types/graphql';
import { buildEnvVarMap } from '../../../shared/utils/envVarUtils';
import {
  getRowStatus,
  type EndpointRowStatus,
} from '../../environments/utils/protocolEndpointUtils';
import { buildAuthHeaders } from './authUtils';
import { resolveVars } from './envUtils';

/** Build merged global env map for GraphQL Studio from header selection or legacy props. */
export function buildGraphqlGlobalEnvMap(
  selectedSvc: Microservice | undefined,
  selectedEnvId: string | undefined,
  resolvedBaseUrl: string | undefined,
  envName: string | undefined,
  svcName: string | undefined,
): Record<string, string> {
  if (selectedSvc && selectedEnvId) {
    return buildEnvVarMap(selectedSvc, selectedEnvId, 'graphql', envName);
  }
  if (resolvedBaseUrl || envName || svcName) {
    return buildEnvVarMap(
      {
        id: '',
        name: svcName ?? '',
        baseUrls: resolvedBaseUrl ? { __legacy__: resolvedBaseUrl } : {},
      },
      '__legacy__',
      'graphql',
      envName,
    );
  }
  return {};
}

export function resolveGraphqlEndpointProtocolStatus(
  selectedSvc: Microservice | undefined,
  selectedEnvId: string | undefined,
): EndpointRowStatus | undefined {
  if (selectedSvc && selectedEnvId) {
    return getRowStatus(selectedSvc, 'graphql', selectedEnvId);
  }
  return undefined;
}

export function buildActiveTabHeaderMap(
  headers: GraphqlHeaderRow[] | undefined,
): Record<string, string> {
  if (!headers) return {};
  const map: Record<string, string> = {};
  for (const h of headers) {
    if (h.enabled && h.key.trim()) map[h.key.trim()] = h.value;
  }
  return map;
}

export function buildGraphqlSchemaHeaders(
  auth: GraphqlAuth | null | undefined,
  activeTabHeaders: Record<string, string>,
  activeEnvironment: GraphqlEnvironment | null,
  globalEnvMap: Record<string, string>,
): Record<string, string> {
  const authH = buildAuthHeaders(auth);
  const resolved: Record<string, string> = {};
  for (const [k, v] of Object.entries({ ...authH, ...activeTabHeaders })) {
    resolved[k] = resolveVars(v, activeEnvironment, globalEnvMap);
  }
  return resolved;
}
