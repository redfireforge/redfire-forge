import type {
  CatalogEntry,
  CatalogEndpoint,
  CatalogVersion,
  CatalogServer,
  CatalogFolder,
  CatalogParameter,
  CatalogResponse,
  HostConfig,
  CatalogAuthConfig,
  CatalogSecurityScheme,
} from '../types/catalog';
import type { HttpMethod } from '../../../shared/types';

export function makeVersion(over: Partial<CatalogVersion> = {}): CatalogVersion {
  return {
    id: 'v1',
    version: '1.0.0',
    importedAt: 1700000000000,
    specHash: 'hash-1',
    specSize: 2048,
    ...over,
  };
}

export function makeServer(over: Partial<CatalogServer> = {}): CatalogServer {
  return { url: 'https://api.example.com', description: 'Prod', ...over };
}

export function makeParam(over: Partial<CatalogParameter> = {}): CatalogParameter {
  return {
    name: 'id',
    in: 'path',
    required: true,
    schema: { type: 'string' },
    ...over,
  };
}

export function makeResponse(over: Partial<CatalogResponse> = {}): CatalogResponse {
  return { statusCode: '200', description: 'OK', ...over };
}

export function makeEndpoint(over: Partial<CatalogEndpoint> = {}): CatalogEndpoint {
  return {
    id: 'ep1',
    summary: 'Get user',
    method: 'GET' as HttpMethod,
    path: '/users/{id}',
    parameters: [],
    responses: [makeResponse()],
    tags: [],
    ...over,
  };
}

export function makeFolder(over: Partial<CatalogFolder> = {}): CatalogFolder {
  return {
    id: 'f1',
    name: 'Users',
    endpoints: [],
    folders: [],
    ...over,
  };
}

export function makeHostConfig(over: Partial<HostConfig> = {}): HostConfig {
  return { strategy: 'global', ...over };
}

export function makeAuthConfig(over: Partial<CatalogAuthConfig> = {}): CatalogAuthConfig {
  return { strategy: 'global', ...over };
}

export function makeScheme(over: Partial<CatalogSecurityScheme> = {}): CatalogSecurityScheme {
  return { type: 'http', scheme: 'bearer', ...over };
}

export function makeEntry(over: Partial<CatalogEntry> = {}): CatalogEntry {
  return {
    id: 'entry1',
    name: 'My API',
    description: 'A sample API',
    currentVersionId: 'v1',
    versions: [makeVersion()],
    servers: [makeServer()],
    securitySchemes: {},
    folders: [makeFolder({ endpoints: [makeEndpoint()] })],
    endpoints: [],
    hostConfig: makeHostConfig(),
    authConfig: makeAuthConfig(),
    ...over,
  };
}
