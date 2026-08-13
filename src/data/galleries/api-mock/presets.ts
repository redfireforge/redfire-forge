/**
 * API Mock gallery sample factories — deterministic server definitions.
 */
import type { ApiMockServerDefinitionV1 } from '../../../shared/api-mock/contracts';
import { DEFAULT_SETTINGS, EMPTY_PREDICATE_GROUP, createDefaultResponse } from '../../../shared/api-mock/defaults';

const TS = '2026-08-13T00:00:00.000Z';

function jsonBody(content: string) {
  return { kind: 'json' as const, content, contentType: 'application/json' };
}

function jsonHeader(id: string) {
  return { id, key: 'Content-Type', value: 'application/json', enabled: true };
}

function emptyGroup(id: string) {
  return { ...EMPTY_PREDICATE_GROUP, id };
}

/** Single GET /health — Track A first Start + journal. */
export function createHealthCheckMock(): ApiMockServerDefinitionV1 {
  const routeId = 'route-health';
  const resp = createDefaultResponse('resp-health');
  resp.headers = [jsonHeader('h-ct')];
  resp.body = jsonBody('{"ok":true}');
  return {
    id: 'srv-gallery-health',
    name: 'Health check mock',
    enabled: true,
    host: '127.0.0.1',
    port: 4600,
    basePath: '',
    folders: [],
    routes: [{
      id: routeId,
      name: 'Health',
      enabled: true,
      method: 'GET',
      path: { kind: 'exact', value: '/health' },
      priority: 10,
      predicates: emptyGroup('pg-health'),
      responseMode: 'rules',
      responses: [resp],
      tags: ['gallery', 'health'],
      createdAt: TS,
      updatedAt: TS,
    }],
    samples: [{
      id: 'sample-health',
      name: 'GET /health',
      routeId,
      request: {
        method: 'GET',
        path: '/health',
        rawPath: '/health',
        query: {},
        headers: {},
        cookies: {},
        body: null,
        bodyTruncated: false,
        receivedAt: TS,
      },
      expected: { outcome: 'matched', routeId, status: 200, bodyContains: 'ok' },
    }],
    variables: [],
    settings: structuredClone(DEFAULT_SETTINGS),
    createdAt: TS,
    updatedAt: TS,
  };
}

/** Users API — parameterized path, JSON body predicate, examples. */
export function createUsersApiMock(): ApiMockServerDefinitionV1 {
  return {
    id: 'srv-gallery-users',
    name: 'Users API',
    enabled: true,
    host: '127.0.0.1',
    port: 4600,
    basePath: '/api/v1',
    folders: [{
      id: 'folder-users',
      name: 'Users',
      expanded: true,
      sortOrder: 0,
    }],
    routes: [
      {
        id: 'route-get-users',
        folderId: 'folder-users',
        name: 'List Users',
        enabled: true,
        method: 'GET',
        path: { kind: 'exact', value: '/users' },
        priority: 10,
        predicates: emptyGroup('pg-list'),
        responseMode: 'rules',
        responses: [{
          id: 'resp-list',
          name: '200 Default',
          enabled: true,
          isDefault: true,
          status: 200,
          headers: [jsonHeader('h1')],
          cookies: [],
          body: jsonBody('{"users":[{"id":1,"name":"Alice"},{"id":2,"name":"Bob"}]}'),
          behavior: { delayMs: 0, jitterMs: 0 },
        }],
        tags: ['gallery', 'users'],
        createdAt: TS,
        updatedAt: TS,
      },
      {
        id: 'route-get-user-by-id',
        folderId: 'folder-users',
        name: 'Get User by ID',
        enabled: true,
        method: 'GET',
        path: { kind: 'parameterized', value: '/users/:id', paramNames: ['id'] },
        priority: 20,
        predicates: {
          id: 'pg-by-id',
          combinator: 'all',
          children: [{
            id: 'pred-id-numeric',
            source: 'pathParam',
            selector: 'id',
            operator: 'regex',
            expected: '^[0-9]+$',
            options: { caseSensitive: true },
          }],
        },
        responseMode: 'rules',
        responses: [{
          id: 'resp-user',
          name: '200 Default',
          enabled: true,
          isDefault: true,
          status: 200,
          headers: [jsonHeader('h2')],
          cookies: [],
          body: jsonBody('{"id":"{{pathParam \'id\'}}","name":"User {{pathParam \'id\'}}"}'),
          behavior: { delayMs: 0, jitterMs: 0 },
        }],
        tags: ['gallery', 'users'],
        operationId: 'getUserById',
        createdAt: TS,
        updatedAt: TS,
      },
      {
        id: 'route-post-user',
        folderId: 'folder-users',
        name: 'Create User',
        enabled: true,
        method: 'POST',
        path: { kind: 'exact', value: '/users' },
        priority: 10,
        predicates: {
          id: 'pg-post',
          combinator: 'all',
          children: [{
            id: 'pred-json-body',
            source: 'body',
            operator: 'json_subset',
            expected: { name: 'string' },
            options: { matchStyle: 'subset' },
          }],
        },
        responseMode: 'rules',
        responses: [{
          id: 'resp-created',
          name: '201 Default',
          enabled: true,
          isDefault: true,
          status: 201,
          headers: [
            jsonHeader('h4'),
            { id: 'h5', key: 'Location', value: '/api/v1/users/{{uuid}}', enabled: true },
          ],
          cookies: [],
          body: jsonBody('{"id":"{{uuid}}","name":"{{jsonPath \'$.name\'}}","created":true}'),
          behavior: { delayMs: 0, jitterMs: 0 },
        }],
        tags: ['gallery', 'users', 'write'],
        createdAt: TS,
        updatedAt: TS,
      },
    ],
    samples: [{
      id: 'sample-get-user-42',
      name: 'Get user 42',
      routeId: 'route-get-user-by-id',
      request: {
        method: 'GET',
        path: '/api/v1/users/42',
        rawPath: '/api/v1/users/42',
        query: {},
        headers: { accept: ['application/json'] },
        cookies: {},
        body: null,
        bodyTruncated: false,
        receivedAt: TS,
      },
      expected: {
        outcome: 'matched',
        routeId: 'route-get-user-by-id',
        responseId: 'resp-user',
        status: 200,
      },
    }],
    variables: [],
    settings: structuredClone(DEFAULT_SETTINGS),
    createdAt: TS,
    updatedAt: TS,
  };
}

/** Two overlapping GETs — Conflict Inspector witness sample. */
export function createAmbiguousRoutesMock(): ApiMockServerDefinitionV1 {
  const makeRoute = (
    id: string,
    name: string,
    priority: number,
    body: string,
  ): ApiMockServerDefinitionV1['routes'][0] => ({
    id,
    name,
    enabled: true,
    method: 'GET',
    path: { kind: 'exact', value: '/orders' },
    priority,
    predicates: emptyGroup(`pg-${id}`),
    responseMode: 'rules',
    responses: [{
      id: `resp-${id}`,
      name: '200 Default',
      enabled: true,
      isDefault: true,
      status: 200,
      headers: [jsonHeader(`h-${id}`)],
      cookies: [],
      body: jsonBody(body),
      behavior: { delayMs: 0, jitterMs: 0 },
    }],
    tags: ['gallery', 'conflicts'],
    createdAt: TS,
    updatedAt: TS,
  });

  return {
    id: 'srv-gallery-conflicts',
    name: 'Ambiguous routes',
    enabled: true,
    host: '127.0.0.1',
    port: 4600,
    basePath: '',
    folders: [],
    routes: [
      makeRoute('route-orders-a', 'Orders A (priority 10)', 10, '{"source":"A","orders":[]}'),
      makeRoute('route-orders-b', 'Orders B (priority 10)', 10, '{"source":"B","orders":[]}'),
    ],
    samples: [{
      id: 'sample-orders-witness',
      name: 'GET /orders witness',
      routeId: 'route-orders-a',
      request: {
        method: 'GET',
        path: '/orders',
        rawPath: '/orders',
        query: {},
        headers: {},
        cookies: {},
        body: null,
        bodyTruncated: false,
        receivedAt: TS,
      },
      expected: { outcome: 'ambiguous', status: 409 },
    }],
    variables: [],
    settings: {
      ...structuredClone(DEFAULT_SETTINGS),
      selection: {
        ...structuredClone(DEFAULT_SETTINGS.selection),
        multipleMatchPolicy: 'reject_multiple',
        equalPriorityPolicy: 'reject',
      },
    },
    createdAt: TS,
    updatedAt: TS,
  };
}
