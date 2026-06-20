/**
 * graphql-schema-explorer.spec.ts — Live E2E for GraphQL Studio schema explorer (Phase 4).
 *
 * Requires Docker GraphQL test server on port 4010.
 */

import { test, expect } from '@playwright/test';
import {
  fillEndpoint,
  gotoGqlStudio,
  gotoSchemaTab,
  GQL_HTTP,
  introspectSchema,
  isGraphqlServerHealthy,
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
  await gotoSchemaTab(page);
});

test('schema explorer lists User and Order types after live introspection', async ({ page }) => {
  await expect(page.locator('[data-testid="gql-se-type-list"]')).toBeVisible();
  await expect(page.locator('[data-testid="gql-se-type-User"]')).toBeVisible();
  await expect(page.locator('[data-testid="gql-se-type-Order"]')).toBeVisible();
});

test('search filters types and selecting User shows type detail', async ({ page }) => {
  await page.locator('[data-testid="gql-se-search"]').fill('User');
  await expect(page.locator('[data-testid="gql-se-type-User"]')).toBeVisible();
  await expect(page.locator('[data-testid="gql-se-type-Order"]')).toBeHidden();

  await page.locator('[data-testid="gql-se-type-User"]').click();
  await expect(page.locator('[data-testid="gql-se-type-detail"]')).toBeVisible();
  await expect(page.locator('[data-testid="gql-se-type-detail"]')).toContainText('name');
  await expect(page.locator('[data-testid="gql-se-type-detail"]')).toContainText('email');
});

test('SDL tab shows schema and export SDL triggers download', async ({ page }) => {
  await page.locator('[data-testid="gql-se-type-Query"]').click();
  await page.locator('[data-testid="gql-se-dtab-sdl"]').click();
  await expect(page.locator('[data-testid="gql-se-detail-panel"]')).toContainText('type Query');

  const downloadPromise = page.waitForEvent('download');
  await page.locator('[data-testid="gql-se-export-sdl-btn"]').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.graphql$/);
});

test('copy SDL button copies type definition to clipboard', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.locator('[data-testid="gql-se-type-User"]').click();
  await page.locator('[data-testid="gql-se-dtab-sdl"]').click();
  await page.locator('[data-testid="gql-se-copy-sdl-btn"]').click();
  const clipText = await page.evaluate(async () => navigator.clipboard.readText());
  expect(clipText).toContain('type User');
  expect(clipText).toContain('email');
});
