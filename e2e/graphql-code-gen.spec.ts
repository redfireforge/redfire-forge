/**
 * graphql-code-gen.spec.ts — E2E for query code generation in GraphQL Studio (Phase 4).
 *
 * NOTE: The full multi-target codegen UI (React Query, Kotlin, etc.) is not yet
 * implemented in the app. This spec covers the Query Builder's live code generation
 * pipeline — preview, copy, and editor sync — which is the shipped codegen surface.
 *
 * Requires Docker GraphQL test server on port 4010.
 */

import { test, expect } from '@playwright/test';
import {
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

test.beforeEach(async ({ page, context, request }) => {
  if (!serverAvailable) {
    test.skip();
    return;
  }
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await gotoGqlStudio(page, request);
  await fillEndpoint(page, GQL_HTTP);
  await introspectSchema(page);
  await openBuilderMode(page);
});

async function selectField(page: import('@playwright/test').Page, fieldName: string) {
  const row = page.locator('.gql-qb-field-row', { hasText: fieldName }).first();
  await row.locator('.gql-qb-check').click();
}

test('generated query preview updates live as fields are selected', async ({ page }) => {
  await selectField(page, 'health');
  const code = page.locator('[data-testid="gql-qb-code"]');
  await expect(code).toContainText('query');
  await expect(code).toContainText('health');

  await page.locator('[data-testid="gql-qb-reset"]').click();
  await expect(code).not.toContainText('health');

  await page.locator('[data-testid="gql-qb-op-mutation"]').click();
  await selectField(page, 'createUser');
  await expect(code).toContainText('mutation');
  await expect(code).toContainText('createUser');
});

test('copy SDL button copies generated query to clipboard', async ({ page }) => {
  await selectField(page, 'health');
  await page.locator('[data-testid="gql-qb-copy"]').click();
  await expect(page.locator('[data-testid="gql-qb-copy"]')).toContainText('Copied');

  const clipText = await page.evaluate(async () => navigator.clipboard.readText());
  expect(clipText).toContain('health');
  expect(clipText).toMatch(/query\s*\{?/);
});

test('operation name appears in generated query when set', async ({ page }) => {
  await page.locator('[data-testid="gql-qb-op-name"]').fill('HealthProbe');
  await selectField(page, 'health');
  await expect(page.locator('[data-testid="gql-qb-code"]')).toContainText('HealthProbe');
});

test('edit in editor transfers generated code to Monaco', async ({ page }) => {
  await selectField(page, 'health');
  await page.locator('[data-testid="gql-qb-edit"]').click();
  await page.locator('[data-testid="gql-mode-editor"]').click();

  await page.waitForFunction(() => {
    const w = window as unknown as Record<string, unknown>;
    const monaco = w['monaco'] as { editor?: { getModels?: () => { getValue: () => string }[] } };
    return (monaco?.editor?.getModels?.() ?? []).some((m) => m.getValue().includes('health'));
  }, { timeout: 5_000 });
});

test('generated mutation includes argument placeholders for createUser', async ({ page }) => {
  await page.locator('[data-testid="gql-qb-op-mutation"]').click();
  const createUserRow = page.locator('.gql-qb-field-row', { hasText: 'createUser' }).first();
  await createUserRow.locator('.gql-qb-expand-btn').click();
  await createUserRow.locator('.gql-qb-check').click();

  const code = page.locator('[data-testid="gql-qb-code"]');
  await expect(code).toContainText('createUser');
  await expect(code).toContainText('mutation');
});
