/**
 * graphql-test-server.spec.ts — Smoke test for the Docker GraphQL test server (4F-11).
 *
 * Requires:
 *   E2E_WITH_DOCKER=1  (or E2E_GRAPHQL_SERVER=1) — global-setup starts port 4010
 *
 * Run:
 *   E2E_WITH_DOCKER=1 npx playwright test e2e/graphql-test-server.spec.ts --reporter=list
 */
import { test, expect } from '@playwright/test';

const GQL_HTTP = 'http://localhost:4010/graphql';
const GQL_HEALTH = 'http://localhost:4010/health';

test.describe('GraphQL test server (port 4010)', () => {
  test('health endpoint returns ok', async ({ request }) => {
    const resp = await request.get(GQL_HEALTH);
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json();
    expect(body.status).toBe('ok');
    expect(body.service).toBe('graphql-test-server');
  });

  test('introspection returns Query type with user field', async ({ request }) => {
    const resp = await request.post(GQL_HTTP, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        query: '{ __schema { queryType { name fields { name } } } }',
      },
    });
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json();
    expect(body.errors).toBeUndefined();
    const fieldNames = body.data.__schema.queryType.fields.map((f: { name: string }) => f.name);
    expect(fieldNames).toContain('user');
    expect(fieldNames).toContain('health');
  });

  test('createUser mutation returns user with id', async ({ request }) => {
    const resp = await request.post(GQL_HTTP, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        query: 'mutation($name: String!, $email: String!) { createUser(name: $name, email: $email) { id name email } }',
        variables: { name: 'E2E User', email: 'e2e@example.com' },
      },
    });
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json();
    expect(body.errors).toBeUndefined();
    expect(body.data.createUser.id).toBeTruthy();
    expect(body.data.createUser.name).toBe('E2E User');
    expect(body.data.createUser.email).toBe('e2e@example.com');
  });

  test('query response includes Apollo tracing extensions', async ({ request }) => {
    const resp = await request.post(GQL_HTTP, {
      headers: { 'Content-Type': 'application/json' },
      data: { query: '{ health }' },
    });
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json();
    expect(body.data.health).toBe('ok');
    expect(body.extensions?.tracing?.version).toBe(1);
    expect(typeof body.extensions?.tracing?.duration).toBe('number');
  });

  test('APQ hash-only request returns PERSISTED_QUERY_NOT_FOUND', async ({ request }) => {
    const miss = await request.post(GQL_HTTP, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        extensions: {
          persistedQuery: {
            version: 1,
            sha256Hash: '0000000000000000000000000000000000000000000000000000000000000000',
          },
        },
      },
    });
    // Apollo returns HTTP 200 with a GraphQL error for cache misses
    expect(miss.ok()).toBeTruthy();
    const missBody = await miss.json();
    const codes = (missBody.errors ?? []).map(
      (e: { extensions?: { code?: string } }) => e.extensions?.code,
    );
    expect(codes).toContain('PERSISTED_QUERY_NOT_FOUND');
  });
});
