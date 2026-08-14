/**
 * Shared builders for API Mock gallery sample factories.
 */
import type { ApiMockServerDefinitionV1 } from '../../../shared/api-mock/contracts';
import { EMPTY_PREDICATE_GROUP } from '../../../shared/api-mock/defaults';

export const TS = '2026-08-13T00:00:00.000Z';

export function jsonBody(content: string) {
  return { kind: 'json' as const, content, contentType: 'application/json' };
}

export function xmlBody(content: string) {
  return { kind: 'xml' as const, content, contentType: 'application/xml' };
}

export function jsonHeader(id: string) {
  return { id, key: 'Content-Type', value: 'application/json', enabled: true };
}

export function xmlHeader(id: string) {
  return { id, key: 'Content-Type', value: 'application/xml', enabled: true };
}

export function emptyGroup(id: string) {
  return { ...EMPTY_PREDICATE_GROUP, id };
}

type StoreRoute = ApiMockServerDefinitionV1['routes'][0];

export interface StoreRouteSpec {
  id: string;
  /** Omit for a rule that lives outside every folder (Ungrouped). */
  folderId?: string;
  name: string;
  method: StoreRoute['method'];
  path: StoreRoute['path'];
  priority: number;
  body: string;
  status?: number;
  tags: string[];
  operationId?: string;
  enabled?: boolean;
  /** Omit for a rule that matches on method and path alone. */
  predicates?: StoreRoute['predicates'];
  /** `xml` answers with an `application/xml` body — SOAP-shaped endpoints. */
  bodyKind?: 'json' | 'xml';
}

export function storeRoute(spec: StoreRouteSpec): StoreRoute {
  return {
    id: spec.id,
    ...(spec.folderId ? { folderId: spec.folderId } : {}),
    name: spec.name,
    enabled: spec.enabled ?? true,
    method: spec.method,
    path: spec.path,
    priority: spec.priority,
    predicates: spec.predicates ?? emptyGroup(`pg-${spec.id}`),
    responseMode: 'rules',
    responses: [{
      id: `resp-${spec.id}`,
      name: `${spec.status ?? 200} Default`,
      enabled: true,
      isDefault: true,
      status: spec.status ?? 200,
      headers: [spec.bodyKind === 'xml' ? xmlHeader(`h-${spec.id}`) : jsonHeader(`h-${spec.id}`)],
      cookies: [],
      body: spec.bodyKind === 'xml' ? xmlBody(spec.body) : jsonBody(spec.body),
      behavior: { delayMs: 0, jitterMs: 0 },
    }],
    tags: spec.tags,
    ...(spec.operationId ? { operationId: spec.operationId } : {}),
    createdAt: TS,
    updatedAt: TS,
  };
}
