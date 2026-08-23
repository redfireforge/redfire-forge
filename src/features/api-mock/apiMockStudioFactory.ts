import type { ApiMockServerDefinitionV1 } from '@shared/api-mock/contracts';
import { DEFAULT_SETTINGS, createDefaultResponse, EMPTY_PREDICATE_GROUP } from '@shared/api-mock/defaults';
import type { ApiMockRuntimeStatus } from './components/ApiMockServerTabs';

export interface RuntimeInfo {
  status: ApiMockRuntimeStatus;
  generation: number;
  error?: string;
  appliedJson?: string;
}

const ts = () => new Date().toISOString();

export function createServer(index: number, port: number): ApiMockServerDefinitionV1 {
  return {
    id: `srv-${crypto.randomUUID().slice(0, 8)}`,
    name: `Mock Server ${index}`,
    enabled: true,
    host: '127.0.0.1',
    port,
    basePath: '',
    folders: [],
    routes: [],
    samples: [],
    variables: [],
    settings: { ...DEFAULT_SETTINGS },
    createdAt: ts(),
    updatedAt: ts(),
  };
}

export function createRoute(name: string): ApiMockServerDefinitionV1['routes'][0] {
  const id = `route-${crypto.randomUUID().slice(0, 8)}`;
  return {
    id,
    name,
    enabled: true,
    method: 'GET',
    path: { kind: 'exact', value: '/' },
    priority: 10,
    predicates: { ...EMPTY_PREDICATE_GROUP, id: `pg-${id}` },
    responseMode: 'rules',
    responses: [createDefaultResponse(`resp-${id}`)],
    tags: [],
    createdAt: ts(),
    updatedAt: ts(),
  };
}

export const nowIso = ts;
