import { v4 as uuidv4 } from 'uuid';
import YAML from 'yaml';
import type {
  CatalogEntry, CatalogVersion, CatalogFolder, CatalogEndpoint,
  CatalogParameter, CatalogRequestBody, CatalogResponse,
  CatalogServer, CatalogSecurityScheme, CatalogContentType,
  SchemaObject, ParsedSpec,
} from '../types/catalog';
import type { HttpMethod } from '../../../shared/types';

const SUPPORTED_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

interface RawSpec {
  swagger?: string;
  openapi?: string;
  info?: { title?: string; version?: string; description?: string };
  host?: string;
  basePath?: string;
  schemes?: string[];
  servers?: Array<{ url?: string; description?: string }>;
  paths?: Record<string, Record<string, unknown>>;
  components?: { securitySchemes?: Record<string, unknown> };
  securityDefinitions?: Record<string, unknown>;
  tags?: Array<{ name?: string; description?: string }>;
  produces?: string[];
  consumes?: string[];
}

function resolveRefs(obj: unknown, root: unknown, depth = 0): unknown {
  if (depth > 30 || obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => resolveRefs(item, root, depth + 1));
  }

  const record = obj as Record<string, unknown>;
  if (typeof record.$ref === 'string') {
    const resolved = followRef(record.$ref, root);
    if (resolved !== undefined) {
      return resolveRefs(resolved, root, depth + 1);
    }
    return record;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    result[key] = resolveRefs(value, root, depth + 1);
  }
  return result;
}

function followRef(ref: string, root: unknown): unknown {
  if (!ref.startsWith('#/')) return undefined;
  const parts = ref.slice(2).split('/').map(p => p.replace(/~1/g, '/').replace(/~0/g, '~'));
  let current: unknown = root;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/**
 * Resolve a potentially relative server URL against an import source URL.
 * If the server URL is already absolute (starts with http:// or https://), returns it as-is.
 * If relative (starts with /), combines with the origin of the import source.
 */
function resolveServerUrl(serverUrl: string, importSourceUrl?: string): string | undefined {
  // Already absolute
  if (serverUrl.startsWith('http://') || serverUrl.startsWith('https://')) {
    return serverUrl;
  }
  // Relative URL — need import source to resolve
  if (!importSourceUrl) return undefined;
  try {
    const sourceUrl = new URL(importSourceUrl);
    // Combine origin with relative path
    return `${sourceUrl.origin}${serverUrl.startsWith('/') ? serverUrl : '/' + serverUrl}`;
  } catch {
    return undefined;
  }
}

export async function parseOpenApiSpec(rawText: string, importSourceUrl?: string): Promise<ParsedSpec> {
  const warnings: string[] = [];
  let rawParsed: unknown;

  try {
    rawParsed = YAML.parse(rawText);
  } catch {
    try {
      rawParsed = JSON.parse(rawText);
    } catch {
      throw new Error('Invalid file: could not parse as YAML or JSON');
    }
  }

  if (!rawParsed || typeof rawParsed !== 'object') {
    throw new Error('Invalid file: parsed content is not an object');
  }

  const spec = resolveRefs(rawParsed, rawParsed) as RawSpec;
  if (!spec || typeof spec !== 'object') {
    throw new Error('Invalid file: parsed content is not an object');
  }

  const isSwagger2 = typeof spec.swagger === 'string' && spec.swagger.startsWith('2');
  const isOpenApi3 = typeof spec.openapi === 'string' && spec.openapi.startsWith('3');

  if (!isSwagger2 && !isOpenApi3) {
    throw new Error(
      'Unsupported spec format: expected "swagger: 2.0" or "openapi: 3.x.x" field. ' +
      'Supported formats: Swagger 2.0, OpenAPI 3.0.x, OpenAPI 3.1.x.'
    );
  }

  const title = spec.info?.title || 'Untitled API';
  const version = spec.info?.version || '0.0.0';
  const description = spec.info?.description;

  if (!spec.info?.title) warnings.push('Missing info.title — using "Untitled API"');

  const rawServers = extractServers(spec, isSwagger2);
  // Resolve relative server URLs if import source is known
  const servers = rawServers.map(s => ({
    ...s,
    resolvedUrl: resolveServerUrl(s.url, importSourceUrl),
  }));
  const securitySchemes = extractSecuritySchemes(spec, isSwagger2);
  const tagDescriptions = new Map<string, string>();
  if (spec.tags) {
    for (const t of spec.tags) {
      if (t.name && t.description) tagDescriptions.set(t.name, t.description);
    }
  }

  const allEndpoints: CatalogEndpoint[] = [];
  const endpointsByTag = new Map<string, CatalogEndpoint[]>();

  if (spec.paths) {
    for (const [path, pathItem] of Object.entries(spec.paths)) {
      if (!pathItem || typeof pathItem !== 'object') continue;

      const pathLevelParams = extractParameters(
        (pathItem as Record<string, unknown>).parameters as unknown[] | undefined
      );

      for (const method of SUPPORTED_METHODS) {
        const op = (pathItem as Record<string, unknown>)[method.toLowerCase()] as Record<string, unknown> | undefined;
        if (!op) continue;

        const opParams = extractParameters(op.parameters as unknown[] | undefined);
        const mergedParams = mergeParameters(pathLevelParams, opParams);

        let requestBody: CatalogRequestBody | undefined;
        if (isSwagger2) {
          requestBody = extractSwagger2RequestBody(op, spec);
        } else if (op.requestBody && typeof op.requestBody === 'object') {
          requestBody = extractRequestBody(op.requestBody as Record<string, unknown>);
        }

        const responses = extractResponses(op.responses as Record<string, unknown> | undefined);
        const tags: string[] = Array.isArray(op.tags) ? op.tags.filter((t): t is string => typeof t === 'string') : [];
        const security: string[] | undefined = extractSecurityNames(op.security as unknown);

        const operationId = typeof op.operationId === 'string' ? op.operationId : undefined;
        const summary = typeof op.summary === 'string' ? op.summary
          : operationId || `${method} ${path}`;

        if (!operationId) {
          warnings.push(`${method.toUpperCase()} ${path} has no operationId — name auto-generated`);
        }

        const endpoint: CatalogEndpoint = {
          id: uuidv4(),
          operationId,
          summary,
          description: typeof op.description === 'string' ? op.description : undefined,
          method,
          path,
          parameters: mergedParams,
          requestBody,
          responses,
          security,
          deprecated: op.deprecated === true,
          tags,
        };

        allEndpoints.push(endpoint);

        if (tags.length === 0) {
          const list = endpointsByTag.get('__untagged__') ?? [];
          list.push(endpoint);
          endpointsByTag.set('__untagged__', list);
        } else {
          for (const tag of tags) {
            const list = endpointsByTag.get(tag) ?? [];
            list.push(endpoint);
            endpointsByTag.set(tag, list);
          }
        }
      }
    }
  }

  const folders: CatalogFolder[] = [];
  const untagged: CatalogEndpoint[] = [];

  for (const [tag, eps] of endpointsByTag) {
    if (tag === '__untagged__') {
      untagged.push(...eps);
    } else {
      folders.push({
        id: uuidv4(),
        name: tag,
        description: tagDescriptions.get(tag),
        endpoints: eps,
        folders: [],
      });
    }
  }

  const specHash = await hashString(rawText);
  const versionId = uuidv4();

  const catalogVersion: CatalogVersion = {
    id: versionId,
    version,
    importedAt: Date.now(),
    specHash,
    specSize: rawText.length,
  };

  const entry: CatalogEntry = {
    id: uuidv4(),
    name: title,
    description,
    currentVersionId: versionId,
    versions: [catalogVersion],
    servers,
    securitySchemes,
    folders,
    endpoints: untagged,
    hostConfig: {
      strategy: servers.length > 0 ? 'inherited' : 'hardcoded',
      selectedServerIndex: servers.length > 0 ? 0 : undefined,
    },
    authConfig: {
      strategy: Object.keys(securitySchemes).length > 0 ? 'inherited' : 'hardcoded',
      inheritedSchemeId: Object.keys(securitySchemes)[0],
    },
  };

  return { entry, rawSpec: rawText, warnings };
}

// ─── Extractors ──────────────────────────────────────────

function extractServers(spec: RawSpec, isSwagger2: boolean): CatalogServer[] {
  if (isSwagger2) {
    const schemes = spec.schemes ?? ['https'];
    const host = spec.host ?? 'localhost';
    const basePath = spec.basePath ?? '';
    return schemes.map(scheme => ({
      url: `${scheme}://${host}${basePath}`,
      description: `${scheme} server`,
    }));
  }

  if (!spec.servers || !Array.isArray(spec.servers)) return [];
  return spec.servers
    .filter(s => s && typeof s.url === 'string')
    .map(s => ({ url: s.url!, description: s.description }));
}

function extractSecuritySchemes(spec: RawSpec, isSwagger2: boolean): Record<string, CatalogSecurityScheme> {
  const raw = isSwagger2
    ? spec.securityDefinitions
    : spec.components?.securitySchemes;
  if (!raw || typeof raw !== 'object') return {};

  const result: Record<string, CatalogSecurityScheme> = {};
  for (const [name, def] of Object.entries(raw)) {
    if (!def || typeof def !== 'object') continue;
    const d = def as Record<string, unknown>;

    let type: CatalogSecurityScheme['type'] = 'http';
    if (d.type === 'apiKey') type = 'apiKey';
    else if (d.type === 'oauth2') type = 'oauth2';
    else if (d.type === 'openIdConnect') type = 'openIdConnect';
    else if (d.type === 'http') type = 'http';
    else if (d.type === 'basic') type = 'http';

    result[name] = {
      type,
      name: typeof d.name === 'string' ? d.name : undefined,
      in: (d.in === 'header' || d.in === 'query' || d.in === 'cookie') ? d.in : undefined,
      scheme: typeof d.scheme === 'string' ? d.scheme : (d.type === 'basic' ? 'basic' : undefined),
      bearerFormat: typeof d.bearerFormat === 'string' ? d.bearerFormat : undefined,
      description: typeof d.description === 'string' ? d.description : undefined,
    };
  }
  return result;
}

function extractParameters(params: unknown[] | undefined): CatalogParameter[] {
  if (!Array.isArray(params)) return [];
  return params
    .filter((p): p is Record<string, unknown> => p !== null && typeof p === 'object')
    .filter(p => p.in !== 'body' && p.in !== 'formData')
    .map(p => ({
      name: String(p.name ?? ''),
      in: (p.in === 'path' || p.in === 'query' || p.in === 'header' || p.in === 'cookie')
        ? p.in : 'query',
      required: p.required === true || p.in === 'path',
      description: typeof p.description === 'string' ? p.description : undefined,
      schema: (p.schema && typeof p.schema === 'object' ? p.schema : { type: typeof p.type === 'string' ? p.type : 'string' }) as SchemaObject,
      example: p.example,
    }));
}

function mergeParameters(pathLevel: CatalogParameter[], opLevel: CatalogParameter[]): CatalogParameter[] {
  const byKey = new Map<string, CatalogParameter>();
  for (const p of pathLevel) byKey.set(`${p.in}:${p.name}`, p);
  for (const p of opLevel) byKey.set(`${p.in}:${p.name}`, p);
  return Array.from(byKey.values());
}

function extractRequestBody(rb: Record<string, unknown>): CatalogRequestBody | undefined {
  const content = rb.content as Record<string, Record<string, unknown>> | undefined;
  if (!content || typeof content !== 'object') return undefined;

  const contentTypes: CatalogContentType[] = [];
  for (const [mediaType, def] of Object.entries(content)) {
    if (!def || typeof def !== 'object') continue;
    contentTypes.push({
      mediaType,
      schema: (def.schema && typeof def.schema === 'object' ? def.schema : {}) as SchemaObject,
      example: def.example,
    });
  }

  if (contentTypes.length === 0) return undefined;
  return {
    required: rb.required === true,
    description: typeof rb.description === 'string' ? rb.description : undefined,
    contentTypes,
  };
}

function extractSwagger2RequestBody(op: Record<string, unknown>, spec: RawSpec): CatalogRequestBody | undefined {
  const params = op.parameters as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(params)) return undefined;

  const bodyParam = params.find(p => p.in === 'body');
  const formParams = params.filter(p => p.in === 'formData');

  if (bodyParam) {
    const consumes = (op.consumes ?? spec.consumes ?? ['application/json']) as string[];
    return {
      required: bodyParam.required === true,
      description: typeof bodyParam.description === 'string' ? bodyParam.description : undefined,
      contentTypes: consumes.map(mediaType => ({
        mediaType,
        schema: (bodyParam.schema && typeof bodyParam.schema === 'object' ? bodyParam.schema : {}) as SchemaObject,
        example: bodyParam.example,
      })),
    };
  }

  if (formParams.length > 0) {
    const hasFile = formParams.some(p => p.type === 'file');
    const mediaType = hasFile ? 'multipart/form-data' : 'application/x-www-form-urlencoded';
    const properties: Record<string, SchemaObject> = {};
    const required: string[] = [];

    for (const p of formParams) {
      const name = String(p.name ?? '');
      properties[name] = { type: typeof p.type === 'string' ? p.type : 'string' };
      if (p.required) required.push(name);
    }

    return {
      required: required.length > 0,
      contentTypes: [{
        mediaType,
        schema: { type: 'object', properties, required: required.length > 0 ? required : undefined },
      }],
    };
  }

  return undefined;
}

function extractResponses(responses: Record<string, unknown> | undefined): CatalogResponse[] {
  if (!responses || typeof responses !== 'object') return [];
  const result: CatalogResponse[] = [];

  for (const [statusCode, def] of Object.entries(responses)) {
    if (!def || typeof def !== 'object') continue;
    const d = def as Record<string, unknown>;

    let schema: SchemaObject | undefined;
    let example: unknown;

    if (d.content && typeof d.content === 'object') {
      const content = d.content as Record<string, Record<string, unknown>>;
      const jsonContent = content['application/json'] ?? Object.values(content)[0];
      if (jsonContent) {
        schema = (jsonContent.schema && typeof jsonContent.schema === 'object' ? jsonContent.schema : undefined) as SchemaObject | undefined;
        example = jsonContent.example;
      }
    } else if (d.schema && typeof d.schema === 'object') {
      schema = d.schema as SchemaObject;
      example = d.example ?? (d.examples as Record<string, unknown>)?.['application/json'];
    }

    result.push({
      statusCode,
      description: typeof d.description === 'string' ? d.description : '',
      schema,
      example,
    });
  }

  return result;
}

function extractSecurityNames(security: unknown): string[] | undefined {
  if (!Array.isArray(security)) return undefined;
  const names = new Set<string>();
  for (const req of security) {
    if (req && typeof req === 'object') {
      for (const name of Object.keys(req)) names.add(name);
    }
  }
  return names.size > 0 ? Array.from(names) : undefined;
}

async function hashString(text: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const buffer = new TextEncoder().encode(text);
    const hash = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

export function countEndpoints(entry: CatalogEntry): number {
  let count = entry.endpoints.length;
  const stack = [...entry.folders];
  while (stack.length > 0) {
    const folder = stack.pop()!;
    count += folder.endpoints.length;
    stack.push(...folder.folders);
  }
  return count;
}

export function getSpecFormatLabel(rawText: string): string {
  try {
    const spec = YAML.parse(rawText);
    if (spec?.swagger) return `Swagger ${spec.swagger}`;
    if (spec?.openapi) return `OpenAPI ${spec.openapi}`;
  } catch { /* ignore */ }
  return 'Unknown';
}
