/**
 * graphql-query-builder.spec.ts — Live E2E for GraphQL Studio query builder (Phase 4).
 *
 * Requires Docker GraphQL test server on port 4010.
 */

import { test, expect } from '@playwright/test';
import {
  executeQuery,
  fillEndpoint,
  gotoGqlStudio,
  GQL_HTTP,
  introspectSchema,
  isGraphqlServerHealthy,
  openBuilderMode,
} from './graphql-helpers';

test.describe.configure({ mode: 'serial', timeout: 90_000 });

let serverAvailable = false;

test.beforeAll(async ({ request }) => {
  serverAvailable = await isGraphqlServerHealthy(request);
});

test.beforeEach(async ({ page, request }) => {
  if (!serverAvailable) {
    test.skip();
    return;
  }
  await gotoGqlStudio(page, request);
  await fillEndpoint(page, GQL_HTTP);
  await introspectSchema(page);
  await openBuilderMode(page);
});

test('builder shows Query root fields from live schema', async ({ page }) => {
  const tree = page.locator('[data-testid="gql-qb-field-tree"]');
  await expect(tree).toContainText('health');
  await expect(tree).toContainText('user');
});

test('selecting health field updates generated query preview', async ({ page }) => {
  const healthRow = page.locator('.gql-qb-field-row', { hasText: 'health' }).first();
  await healthRow.locator('.gql-qb-check').click();

  const code = page.locator('[data-testid="gql-qb-code"]');
  await expect(code).toContainText('health', { timeout: 5_000 });
  await expect(code).toContainText('query');
});

test('builder execute runs health query against live server', async ({ page }) => {
  const healthRow = page.locator('.gql-qb-field-row', { hasText: 'health' }).first();
  await healthRow.locator('.gql-qb-check').click();
  await page.locator('[data-testid="gql-qb-execute"]').click();

  await expect(page.locator('[data-testid="gql-response-viewer"]')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[data-testid="gql-response-body"]')).toContainText('"ok"');
  await expect(page.locator('[data-testid="gql-response-status"]')).toContainText('200');
});

test('switching to mutation type shows createUser field', async ({ page }) => {
  await page.locator('[data-testid="gql-qb-op-mutation"]').click();
  const tree = page.locator('[data-testid="gql-qb-field-tree"]');
  await expect(tree).toContainText('createUser', { timeout: 5_000 });
  await expect(tree).toContainText('createOrder');
});

test('edit in editor sends generated query to Monaco editor', async ({ page }) => {
  const healthRow = page.locator('.gql-qb-field-row', { hasText: 'health' }).first();
  await healthRow.locator('.gql-qb-check').click();
  await page.locator('[data-testid="gql-qb-edit"]').click();

  await page.locator('[data-testid="gql-mode-editor"]').click();
  await page.waitForFunction(() => {
    const w = window as unknown as Record<string, unknown>;
    const monaco = w['monaco'] as { editor?: { getModels?: () => { getValue: () => string }[] } };
    const models = monaco?.editor?.getModels?.() ?? [];
    return models.some((m) => m.getValue().includes('health'));
  }, { timeout: 5_000 });
});

test('direct editor execute still works after builder session', async ({ page }) => {
  await page.locator('[data-testid="gql-mode-editor"]').click();
  await executeQuery(page, 'query { health }');
  await expect(page.locator('[data-testid="gql-response-body"]')).toContainText('"ok"');
});
