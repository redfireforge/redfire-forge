import type { CatalogEndpoint, HostConfig, CatalogServer, CatalogEnvironment } from '../types/catalog';
import type { AuthConfig, Microservice, Environment } from '@shared/types';
import { generateStubJson } from './schemaStubGenerator';
import { acquireOAuth2Token } from '../../../engine/tokenManager';
import { resolveAuthHeaders } from '@shared/utils/authHeaders';

interface CurlParams {
  endpoint: CatalogEndpoint;
  hostConfig: HostConfig;
  servers: CatalogServer[];
  paramValues: Record<string, string>;
  headerValues: Record<string, string>;
  bodyText: string;
  auth: AuthConfig;
  environments?: CatalogEnvironment[];
  linkedMicroservice?: Microservice;
  appEnvironments?: Environment[];
}

export async function buildCatalogCurlCommand(params: CurlParams): Promise<string> {
  const { endpoint, hostConfig, servers, paramValues, headerValues, bodyText, auth, environments, linkedMicroservice } = params;
  const baseUrl = resolveBaseUrl(hostConfig, servers, environments, linkedMicroservice);
  const fullUrl = buildFullUrl(baseUrl, endpoint.path, paramValues, endpoint.parameters);

  const parts: string[] = ['curl'];

  if (endpoint.method !== 'GET') {
    parts.push(`-X ${endpoint.method}`);
  }

  parts.push(`'${fullUrl}'`);

  const headers: { key: string; value: string }[] = [];

  if (auth.type === 'oauth2' && auth.tokenUrl) {
    try {
      const token = await acquireOAuth2Token(auth);
      headers.push({ key: 'Authorization', value: `Bearer ${token}` });
    } catch {
      headers.push({ key: 'Authorization', value: 'Bearer <TOKEN_ERROR: check OAuth2 config>' });
    }
  } else if (auth.type === 'apikey' && auth.apiKeyName && auth.apiKeyValue && auth.apiKeyIn === 'query') {
    try {
      const url = new URL(fullUrl);
      url.searchParams.set(auth.apiKeyName, auth.apiKeyValue);
      const idx = parts.findIndex(p => p.startsWith("'"));
      if (idx >= 0) parts[idx] = `'${url.toString()}'`;
    } catch { /* keep original */ }
  } else if (auth.type !== 'none') {
    const authHdrs = resolveAuthHeaders(auth);
    // Auto-prefix Bearer for apikey named "Authorization" without a scheme
    if (auth.type === 'apikey' && auth.apiKeyName?.toLowerCase() === 'authorization' && authHdrs['Authorization'] && !authHdrs['Authorization'].match(/^(Bearer|Basic|Token)\s/i)) {
      authHdrs['Authorization'] = `Bearer ${authHdrs['Authorization']}`;
    }
    for (const [k, v] of Object.entries(authHdrs)) {
      headers.push({ key: k, value: v });
    }
  }

  for (const [key, value] of Object.entries(headerValues)) {
    if (key.trim() && value.trim()) {
      headers.push({ key: key.trim(), value: value.trim() });
    }
  }

  if (bodyText.trim() && !headers.some(h => h.key.toLowerCase() === 'content-type')) {
    headers.push({ key: 'Content-Type', value: 'application/json' });
  }

  for (const h of headers) {
    parts.push(`\\\n  -H '${h.key}: ${h.value}'`);
  }

  if (bodyText.trim() && endpoint.method !== 'GET') {
    const escaped = bodyText.replace(/'/g, "'\\''");
    parts.push(`\\\n  -d '${escaped}'`);
  }

  return parts.join(' ');
}

export async function buildCatalogCurlSingleLine(params: CurlParams): Promise<string> {
  return (await buildCatalogCurlCommand(params)).replace(/\\\n\s*/g, ' ');
}

export async function buildDefaultCurlCommand(
  endpoint: CatalogEndpoint,
  hostConfig: HostConfig,
  servers: CatalogServer[],
  auth: AuthConfig,
  environments?: CatalogEnvironment[],
  linkedMicroservice?: Microservice,
): Promise<string> {
  const paramValues: Record<string, string> = {};
  for (const p of endpoint.parameters) {
    if (p.example != null) paramValues[p.name] = String(p.example);
    else if (p.schema?.example != null) paramValues[p.name] = String(p.schema.example);
    else if (p.schema?.default != null) paramValues[p.name] = String(p.schema.default);
  }

  let bodyText = '';
  const jsonCT = endpoint.requestBody?.contentTypes.find(ct => ct.mediaType.includes('json'));
  if (jsonCT?.schema) {
    bodyText = generateStubJson(jsonCT.schema);
  }

  return buildCatalogCurlCommand({
    endpoint, hostConfig, servers, paramValues, headerValues: {}, bodyText, auth, environments, linkedMicroservice,
  });
}

export function extractServerPathPrefix(servers: CatalogServer[]): string {
  if (servers.length === 0) return '';
  const raw = servers[0].url;
  try {
    const parsed = new URL(raw);
    const p = parsed.pathname.replace(/\/+$/, '');
    return p === '/' ? '' : p;
  } catch {
    if (!raw.startsWith('/')) return '';
    const trimmed = raw.replace(/\/+$/, '');
    return trimmed || '';
  }
}

export function resolveBaseUrl(
  hostConfig: HostConfig,
  servers: CatalogServer[],
  environments?: CatalogEnvironment[],
  linkedMicroservice?: Microservice,
): string {
  if (hostConfig.strategy === 'environment' && hostConfig.environmentId) {
    if (linkedMicroservice) {
      const url = linkedMicroservice.baseUrls[hostConfig.environmentId];
      if (url) {
        const base = url.replace(/\/+$/, '');
        const pathPrefix = extractServerPathPrefix(servers);
        return pathPrefix ? `${base}${pathPrefix}` : base;
      }
    }
    if (environments?.length) {
      const env = environments.find(e => e.id === hostConfig.environmentId);
      if (env) return env.baseUrl.replace(/\/+$/, '');
    }
  }
  if (hostConfig.strategy === 'hardcoded' && hostConfig.hardcodedUrl) {
    return hostConfig.hardcodedUrl.replace(/\/+$/, '');
  }
  if (hostConfig.strategy === 'inherited' && servers.length > 0) {
    const idx = hostConfig.selectedServerIndex ?? 0;
    const server = servers[idx] ?? servers[0];
    const url = server.resolvedUrl || server.url;
    return url.replace(/\/+$/, '');
  }
  return '';
}

function extractPathSuffix(baseUrl: string): string {
  try {
    const parsed = new URL(baseUrl);
    const p = parsed.pathname.replace(/\/+$/, '');
    return p === '' || p === '/' ? '' : p;
  } catch {
    return '';
  }
}

export function buildFullUrl(
  baseUrl: string,
  path: string,
  paramValues: Record<string, string>,
  parameters: CatalogEndpoint['parameters'],
): string {
  let resolvedPath = path;
  for (const p of parameters.filter(p => p.in === 'path')) {
    const value = paramValues[p.name] || `{${p.name}}`;
    resolvedPath = resolvedPath.replaceAll(`{${p.name}}`, encodeURIComponent(value));
  }

  const queryParams = parameters.filter(p => p.in === 'query');
  const queryParts: string[] = [];
  for (const p of queryParams) {
    const value = paramValues[p.name];
    if (value) queryParts.push(`${encodeURIComponent(p.name)}=${encodeURIComponent(value)}`);
  }

  const normalizedPath = resolvedPath.startsWith('/') ? resolvedPath : `/${resolvedPath}`;
  const baseNoTrail = baseUrl.replace(/\/+$/, '');
  const pathPrefix = extractPathSuffix(baseNoTrail);
  const effectivePath = pathPrefix && normalizedPath.startsWith(pathPrefix)
    ? normalizedPath.slice(pathPrefix.length) || '/'
    : normalizedPath;
  const full = `${baseNoTrail}${effectivePath}`;
  return queryParts.length > 0 ? `${full}?${queryParts.join('&')}` : full;
}
