import { v4 as uuidv4 } from 'uuid';
import type { RequestItem, AuthConfig, KeyValue } from '../../../shared/types';
import type { CatalogEndpoint, CatalogServer } from '../types/catalog';

/** Generate a minimal sample JSON value from an OpenAPI-style schema. */
function sampleFromSchema(schema: Record<string, unknown> | undefined): unknown {
  if (!schema) return {};
  const type = schema.type as string | undefined;
  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;
  if (schema.enum && Array.isArray(schema.enum) && schema.enum.length > 0) return schema.enum[0];
  if (type === 'string') return (schema.format === 'date-time') ? '2024-01-01T00:00:00Z' : (schema.format === 'date') ? '2024-01-01' : 'string';
  if (type === 'integer' || type === 'number') return 0;
  if (type === 'boolean') return true;
  if (type === 'array') return [sampleFromSchema(schema.items as Record<string, unknown> | undefined)];
  if (type === 'object' || schema.properties) {
    const props = schema.properties as Record<string, Record<string, unknown>> | undefined;
    if (!props) return {};
    const obj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(props)) obj[k] = sampleFromSchema(v);
    return obj;
  }
  return {};
}

/**
 * Convert a CatalogEndpoint into a temporary RequestItem for promotion to Harness.
 * Does NOT persist to Requests — just builds a transient object for the modal.
 */
export function catalogEndpointToRequest(
  endpoint: CatalogEndpoint,
  servers: CatalogServer[],
  auth: AuthConfig,
  catalogEntryId?: string,
  catalogEntryName?: string,
  catalogVersion?: string,
): RequestItem {
  const baseUrl = servers[0]?.url ?? '';
  const url = baseUrl ? `${baseUrl.replace(/\/+$/, '')}${endpoint.path}` : endpoint.path;

  const headers: KeyValue[] = endpoint.parameters
    .filter(p => p.in === 'header')
    .map(p => ({ key: p.name, value: '' }));

  const savedQueryParams = endpoint.parameters
    .filter(p => p.in === 'query')
    .map(p => ({ key: p.name, value: '', enabled: true, description: p.description }));

  const savedPathParams = endpoint.parameters
    .filter(p => p.in === 'path')
    .map(p => ({ key: p.name, value: '', description: p.description, required: p.required }));

  let body = '';
  let bodyType: RequestItem['bodyType'] = 'none';
  if (endpoint.requestBody) {
    const ct = endpoint.requestBody.contentTypes?.[0];
    if (ct?.mediaType?.includes('json')) {
      bodyType = 'json';
      if (ct.example) body = JSON.stringify(ct.example, null, 2);
      else if (ct.schema?.example) body = JSON.stringify(ct.schema.example, null, 2);
      else if (ct.schema) body = JSON.stringify(sampleFromSchema(ct.schema as Record<string, unknown>), null, 2);
    } else if (ct?.mediaType?.includes('form')) {
      bodyType = 'form-urlencoded';
    }
  }

  const versionId = uuidv4();
  return {
    id: uuidv4(),
    name: endpoint.summary || `${endpoint.method} ${endpoint.path}`,
    method: endpoint.method,
    url,
    headers,
    body,
    bodyType,
    auth,
    savedQueryParams: savedQueryParams.length > 0 ? savedQueryParams : undefined,
    savedPathParams: savedPathParams.length > 0 ? savedPathParams : undefined,
    catalogMeta: {
      originalPath: endpoint.path,
      operationId: endpoint.operationId,
      sourceSpec: catalogEntryName,
      catalogEntryId,
      catalogEndpointId: endpoint.id,
      catalogVersion,
      tags: endpoint.tags ?? [],
      deprecated: endpoint.deprecated,
    },
    specVersions: [{
      id: versionId,
      url,
      method: endpoint.method,
      headers,
      body,
      bodyType,
      savedQueryParams: savedQueryParams.length > 0 ? savedQueryParams : undefined,
      savedPathParams: savedPathParams.length > 0 ? savedPathParams : undefined,
      catalogVersion: catalogVersion ?? '',
      catalogEntryId: catalogEntryId ?? '',
      catalogEndpointId: endpoint.id,
      importedAt: Date.now(),
    }],
    activeSpecVersionId: versionId,
  };
}
