import type { AuthConfig, HttpMethod } from '../../workflow/engine/index';

// ─── Environments ────────────────────────────────────────

export interface CatalogEnvironment {
  id: string;
  name: string;
  baseUrl: string;
}

// ─── Core Entry ──────────────────────────────────────────

export interface CatalogEntry {
  id: string;
  name: string;
  description?: string;
  currentVersionId: string;
  versions: CatalogVersion[];
  servers: CatalogServer[];
  securitySchemes: Record<string, CatalogSecurityScheme>;
  folders: CatalogFolder[];
  endpoints: CatalogEndpoint[];
  hostConfig: HostConfig;
  authConfig: CatalogAuthConfig;
  savedAuth?: AuthConfig;
  microserviceId?: string;
  customEndpointNames?: Record<string, string>;
  /** @deprecated Use microserviceId + global environments instead */
  environments?: CatalogEnvironment[];
  activeEnvironmentId?: string;
}

export interface SavedEndpointValues {
  params: Record<string, string>;
  headers: Record<string, string>;
  body: string;
}

// ─── Versioning ──────────────────────────────────────────

export interface CatalogVersion {
  id: string;
  version: string;
  importedAt: number;
  specHash: string;
  specSize: number;
  changelog?: string;
}

// ─── Folders & Endpoints ─────────────────────────────────

export interface CatalogFolder {
  id: string;
  name: string;
  description?: string;
  endpoints: CatalogEndpoint[];
  folders: CatalogFolder[];
}

export interface CatalogEndpoint {
  id: string;
  operationId?: string;
  summary: string;
  description?: string;
  method: HttpMethod;
  path: string;
  parameters: CatalogParameter[];
  requestBody?: CatalogRequestBody;
  responses: CatalogResponse[];
  security?: string[];
  deprecated?: boolean;
  tags: string[];
}

// ─── Parameters ──────────────────────────────────────────

export interface CatalogParameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  required: boolean;
  description?: string;
  schema: SchemaObject;
  example?: unknown;
}

export type SchemaObject = {
  type?: string;
  format?: string;
  enum?: unknown[];
  default?: unknown;
  example?: unknown;
  description?: string;
  properties?: Record<string, SchemaObject>;
  required?: string[];
  items?: SchemaObject;
  oneOf?: SchemaObject[];
  anyOf?: SchemaObject[];
  allOf?: SchemaObject[];
  nullable?: boolean;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
};

// ─── Request Body & Responses ────────────────────────────

export interface CatalogRequestBody {
  required: boolean;
  description?: string;
  contentTypes: CatalogContentType[];
}

export interface CatalogContentType {
  mediaType: string;
  schema: SchemaObject;
  example?: unknown;
}

export interface CatalogResponse {
  statusCode: string;
  description: string;
  schema?: SchemaObject;
  example?: unknown;
}

// ─── Server & Security ───────────────────────────────────

export interface CatalogServer {
  url: string;
  description?: string;
}

export interface CatalogSecurityScheme {
  type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect';
  name?: string;
  in?: 'header' | 'query' | 'cookie';
  scheme?: string;
  bearerFormat?: string;
  description?: string;
}

// ─── Host & Auth Configuration ───────────────────────────

export type ResolutionStrategy = 'global' | 'inherited' | 'hardcoded' | 'environment';

export interface HostConfig {
  strategy: ResolutionStrategy;
  hardcodedUrl?: string;
  selectedServerIndex?: number;
  globalEnvId?: string;
  environmentId?: string;
}

export interface CatalogAuthConfig {
  strategy: ResolutionStrategy;
  hardcoded?: AuthConfig;
  globalProfileId?: string;
  inheritedSchemeId?: string;
}

// ─── Diff Types (Phase 5) ────────────────────────────────

export type EndpointChangeType = 'added' | 'removed' | 'changed';

export interface EndpointDiff {
  method: HttpMethod;
  path: string;
  changeType: EndpointChangeType;
  details?: string[];
}

export interface CatalogSpecDiff {
  fromVersion: string;
  toVersion: string;
  added: EndpointDiff[];
  removed: EndpointDiff[];
  changed: EndpointDiff[];
  summary: {
    totalAdded: number;
    totalRemoved: number;
    totalChanged: number;
  };
}

// ─── Parser Result ───────────────────────────────────────

export interface ParsedSpec {
  entry: CatalogEntry;
  rawSpec: string;
  warnings: string[];
}
