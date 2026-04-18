import type { CatalogEndpoint, HostConfig, CatalogServer } from '../types/catalog';
import type { AuthConfig } from '../types';

interface CurlParams {
  endpoint: CatalogEndpoint;
  hostConfig: HostConfig;
  servers: CatalogServer[];
  paramValues: Record<string, string>;
  headerValues: Record<string, string>;
  bodyText: string;
  auth: AuthConfig;
}

export function buildCatalogCurlCommand(params: CurlParams): string {
  const { endpoint, hostConfig, servers, paramValues, headerValues, bodyText, auth } = params;
  const baseUrl = resolveBaseUrl(hostConfig, servers);
  const fullUrl = buildFullUrl(baseUrl, endpoint.path, paramValues, endpoint.parameters);

  const parts: string[] = ['curl'];

  if (endpoint.method !== 'GET') {
    parts.push(`-X ${endpoint.method}`);
  }

  parts.push(`'${fullUrl}'`);

  const headers: { key: string; value: string }[] = [];

  if (auth.type === 'basic' && auth.username) {
    const encoded = btoa(`${auth.username}:${auth.password ?? ''}`);
    headers.push({ key: 'Authorization', value: `Basic ${encoded}` });
  } else if (auth.type === 'bearer' && auth.token) {
    const prefix = auth.prefix?.trim() || 'Bearer';
    headers.push({ key: 'Authorization', value: `${prefix} ${auth.token}` });
  } else if (auth.type === 'apikey' && auth.apiKeyName && auth.apiKeyValue) {
    if (auth.apiKeyIn === 'query') {
      try {
        const url = new URL(fullUrl);
        url.searchParams.set(auth.apiKeyName, auth.apiKeyValue);
        const idx = parts.findIndex(p => p.startsWith("'"));
        if (idx >= 0) parts[idx] = `'${url.toString()}'`;
      } catch { /* keep original */ }
    } else {
      headers.push({ key: auth.apiKeyName, value: auth.apiKeyValue });
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

export function resolveBaseUrl(hostConfig: HostConfig, servers: CatalogServer[]): string {
  if (hostConfig.strategy === 'hardcoded' && hostConfig.hardcodedUrl) {
    return hostConfig.hardcodedUrl.replace(/\/+$/, '');
  }
  if (hostConfig.strategy === 'inherited' && servers.length > 0) {
    const idx = hostConfig.selectedServerIndex ?? 0;
    const server = servers[idx] ?? servers[0];
    return server.url.replace(/\/+$/, '');
  }
  return '';
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
    resolvedPath = resolvedPath.replace(`{${p.name}}`, encodeURIComponent(value));
  }

  const queryParams = parameters.filter(p => p.in === 'query');
  const queryParts: string[] = [];
  for (const p of queryParams) {
    const value = paramValues[p.name];
    if (value) queryParts.push(`${encodeURIComponent(p.name)}=${encodeURIComponent(value)}`);
  }

  const full = `${baseUrl}${resolvedPath}`;
  return queryParts.length > 0 ? `${full}?${queryParts.join('&')}` : full;
}
