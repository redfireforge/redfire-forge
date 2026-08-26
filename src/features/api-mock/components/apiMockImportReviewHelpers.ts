import type { ApiMockDiagnosticV1, ApiMockRouteV1 } from '@shared/api-mock/contracts';
import type { SourceRequest } from '@shared/api-mock/sourceToRule';

export type ApiMockImportSourceId = 'curl' | 'catalog' | 'requests' | 'openapi' | 'wiremock' | 'native' | 'har';
export type ImportMode = 'merge' | 'replace' | 'copy';
export type ImportSource = ApiMockImportSourceId;

export interface ImportOptions {
  mode: ImportMode;
  newFolderName?: string;
}

export interface PreviewState {
  routes: ApiMockRouteV1[];
  diagnostics: ApiMockDiagnosticV1[];
  lossReport: string[];
}

export interface CatalogPick {
  key: string;
  label: string;
  method: string;
  path: string;
}

export interface RequestPick {
  key: string;
  label: string;
  method: string;
  url: string;
  headers: Array<{ key: string; value: string }>;
  body: string;
}

export const IMPORT_SOURCES: Array<{ id: ImportSource; label: string; hint: string }> = [
  { id: 'curl', label: 'cURL command', hint: 'Generate rule and sample' },
  { id: 'openapi', label: 'OpenAPI / Swagger', hint: 'Paste JSON or YAML' },
  { id: 'catalog', label: 'Catalog endpoints', hint: 'Select one or many operations' },
  { id: 'requests', label: 'Requests collection', hint: 'Promote items or folders' },
  { id: 'native', label: 'RedfireForge export', hint: 'Native round-trip' },
  { id: 'wiremock', label: 'WireMock mappings', hint: 'Import stub definitions' },
  { id: 'har', label: 'HAR capture', hint: 'Browser/devtools archive (redacted)' },
];

export function parseCurlToSource(curl: string): SourceRequest {
  const method = curl.match(/-X\s+(\w+)/i)?.[1] ?? 'GET';
  const urlMatch = curl.match(/(?:curl\s+)?(?:-[^\s]+\s+)*['"]?(https?:\/\/[^\s'"]+)/i) ?? curl.match(/['"]?(\/[^\s'"]*)/);
  const rawUrl = urlMatch?.[1] ?? '/';
  let path: string;
  try { path = new URL(rawUrl).pathname; } catch { path = rawUrl.split('?')[0]; }
  const headers: Record<string, string> = {};
  for (const m of curl.matchAll(/-H\s+['"]([^'"]+)['"]/gi)) {
    const [key, ...rest] = m[1].split(':');
    if (key) headers[key.trim()] = rest.join(':').trim();
  }
  const bodyMatch = curl.match(/-d\s+['"]([^'"]*)['"]/i) ?? curl.match(/--data(?:-raw)?\s+['"]([^'"]*)['"]/i);
  const body = bodyMatch?.[1];
  const ct = headers['Content-Type'] || headers['content-type'];

  return { method, path, headers, body, contentType: ct };
}

export function responseStatusMeta(status: number): { statusClass: string; statusText: string } {
  const statusClass = status < 300 ? 'success' : status < 500 ? 'warning' : 'danger';
  const statusText = status < 300 ? 'OK' : status < 400 ? 'Redirect' : status < 500 ? 'Client Error' : 'Server Error';
  return { statusClass, statusText };
}

export function splitPathParams(pathValue: string): string[] {
  return pathValue.split(/(\{[^}]+\})/);
}
