import { v4 as uuidv4 } from 'uuid';
import type { RequestCollection, RequestItem, RequestFolder, KeyValue, CatalogRequestMeta } from '../../../shared/types';
import type { CatalogEndpoint, CatalogServer, SavedEndpointValues } from '../types/catalog';
import { extractServerPathPrefix } from './catalogCurlGenerator';

export interface CatalogExportEnv {
  envId: string;
  envName: string;
  baseUrl: string;
}

export interface CatalogExportPayload {
  collectionName: string;
  envs: CatalogExportEnv[];
  endpoints: CatalogEndpoint[];
  customNames: Record<string, string>;
  sampleEpIds: Set<string>;
  savedEpValues: Record<string, SavedEndpointValues>;
}

export interface CatalogExportContext {
  servers: CatalogServer[];
  microserviceId?: string;
  versionLabel?: string;
  existingWbEnvNames: Map<string, string>; // envName -> wbEnvId
  groupId?: string;
  catalogEntryName?: string;
}

export interface CatalogExportResult {
  collection: RequestCollection;
  newEnvironments: { id: string; name: string }[];
}

export function buildExportRequests(
  endpoints: CatalogEndpoint[],
  baseUrl: string,
  serverPathPrefix: string,
  customNames: Record<string, string>,
  sampleEpIds: Set<string>,
  epVals: Record<string, SavedEndpointValues>,
  sourceSpec?: string,
): RequestItem[] {
  return endpoints.map(ep => {
    const reqName = customNames[ep.id]?.trim() || ep.summary || `${ep.method} ${ep.path}`;
    const useSample = sampleEpIds.has(ep.id);
    const saved = useSample ? epVals[ep.id] : undefined;

    const headers: KeyValue[] = [
      { key: 'Content-Type', value: 'application/json' },
    ];
    for (const p of ep.parameters.filter(pp => pp.in === 'header')) {
      headers.push({ key: p.name, value: saved?.headers?.[p.name] ?? '' });
    }

    const queryParams = ep.parameters
      .filter(p => p.in === 'query')
      .map(p => ({ key: p.name, value: saved?.params?.[p.name] ?? '', enabled: true }));

    let pathUrl = ep.path;
    for (const p of ep.parameters.filter(pp => pp.in === 'path')) {
      const val = saved?.params?.[p.name];
      pathUrl = pathUrl.replaceAll(`{${p.name}}`, val ? val : `{${p.name}}`);
    }

    const normalizedPath = pathUrl.startsWith('/') ? pathUrl : `/${pathUrl}`;
    let fullUrl = baseUrl.replace(/\/+$/, '') + serverPathPrefix + normalizedPath;

    const filledQp = queryParams.filter(q => q.value);
    if (filledQp.length > 0) {
      const qs = filledQp.map(q => `${encodeURIComponent(q.key)}=${encodeURIComponent(q.value)}`).join('&');
      fullUrl += `?${qs}`;
    }

    const catalogMeta: CatalogRequestMeta = {
      operationId: ep.operationId,
      description: ep.description,
      originalPath: ep.path,
      tags: ep.tags,
      deprecated: ep.deprecated || undefined,
      parameters: ep.parameters.map(p => ({
        name: p.name,
        in: p.in,
        required: p.required,
        description: p.description,
        type: p.schema?.type,
      })),
      expectedResponses: ep.responses.map(r => ({
        statusCode: r.statusCode,
        description: r.description,
      })),
      security: ep.security,
      sourceSpec,
    };

    const body = saved?.body ?? '';
    return {
      id: uuidv4(),
      name: reqName,
      method: ep.method,
      url: fullUrl,
      headers,
      body,
      bodyType: body ? 'json' as const : undefined,
      auth: { type: 'inherit' as const },
      savedQueryParams: queryParams,
      catalogMeta,
    };
  });
}

export function buildCatalogExport(
  payload: CatalogExportPayload,
  context: CatalogExportContext,
): CatalogExportResult {
  const { collectionName, envs, endpoints, customNames, sampleEpIds, savedEpValues: epVals } = payload;
  const { servers, microserviceId, versionLabel, existingWbEnvNames, groupId, catalogEntryName } = context;

  const envIdMap: Record<string, string> = {};
  const baseUrls: Record<string, string> = {};
  const newEnvironments: { id: string; name: string }[] = [];

  for (const env of envs) {
    const existingId = existingWbEnvNames.get(env.envName);
    const wbEnvId = existingId ?? uuidv4();
    envIdMap[env.envId] = wbEnvId;
    baseUrls[wbEnvId] = env.baseUrl;
    if (!existingId) newEnvironments.push({ id: wbEnvId, name: env.envName });
  }

  const serverPathPrefix = extractServerPathPrefix(servers);
  const sourceSpec = catalogEntryName
    ? `${catalogEntryName}${versionLabel ? ` ${versionLabel}` : ''}`
    : undefined;

  const folders: RequestFolder[] = envs.map(env => ({
    id: uuidv4(),
    name: env.envName,
    requests: buildExportRequests(endpoints, env.baseUrl, serverPathPrefix, customNames, sampleEpIds, epVals, sourceSpec),
    folders: [] as RequestFolder[],
    isSubCollection: true,
    selectedEnvId: envIdMap[env.envId],
    baseUrls: { [envIdMap[env.envId]]: env.baseUrl },
  }));

  const versionSuffix = versionLabel ? ` (${versionLabel})` : '';

  const collection: RequestCollection = {
    id: uuidv4(),
    name: `${collectionName}${versionSuffix}`,
    mode: 'multi-env' as const,
    groupId,
    microserviceId,
    baseUrls,
    requests: [],
    folders,
  };

  return { collection, newEnvironments };
}
