/**
 * graphql-subscriptions.spec.ts — Live E2E for GraphQL Studio subscriptions (Phase 4).
 *
 * Uses Docker GraphQL test server on port 4010:
 *   cd docker/graphql && docker compose up -d
 *   E2E_GRAPHQL_SERVER=1 npx playwright test e2e/graphql-subscriptions.spec.ts
 */

import { test, expect } from '@playwright/test';
import {
  createTestOrder,
  fillEndpoint,
  fillMonacoEditor,
  gotoGqlStudio,
  GQL_HTTP,
  introspectSchema,
  isGraphqlServerHealthy,
  subscriptionQuery,
} from './graphql-helpers';

/** Select a value in a CustomSelect (div-based, not native <select>). */
async function selectCustomTransport(page: import('@playwright/test').Page, value: string) {
  const wrapper = page.locator('[data-testid="gql-transport-select"]');
  await wrapper.locator('.cs-trigger').click();
  const menu = page.locator('.cs-menu');
  await menu.waitFor({ state: 'visible', timeout: 5_000 });
  await menu.locator(`.cs-item[data-value="${value}"]`).click();
}

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
});

test('subscription receives PENDING → PROCESSING → COMPLETE for created order', async ({ page, request }) => {
  const orderId = await createTestOrder(request);

  await fillMonacoEditor(page, subscriptionQuery(orderId));
  await selectCustomTransport(page, 'graphql-transport-ws');
  await expect(page.locator('[data-testid="gql-subscribe-btn"]')).toBeVisible({ timeout: 5_000 });

  await page.locator('[data-testid="gql-subscribe-btn"]').click();
  await expect(page.locator('[data-testid="gql-ws-status"]')).toHaveClass(/gql-ws-status--active/, { timeout: 15_000 });
  await expect(page.locator('[data-testid="gql-sub-log"]')).toBeVisible({ timeout: 10_000 });

  const log = page.locator('[data-testid="gql-sub-message-list"]');
  await expect(log).toContainText('PENDING', { timeout: 10_000 });
  await expect(log).toContainText('PROCESSING', { timeout: 10_000 });
  await expect(log).toContainText('COMPLETE', { timeout: 10_000 });

  const rows = page.locator('[data-testid="gql-sub-row"]');
  await expect(rows).toHaveCount(3, { timeout: 15_000 });
});

test('subscription stats show message count after stream completes', async ({ page, request }) => {
  const orderId = await createTestOrder(request);

  await fillMonacoEditor(page, subscriptionQuery(orderId));
  await selectCustomTransport(page, 'graphql-transport-ws');
  await page.locator('[data-testid="gql-subscribe-btn"]').click();
  await expect(page.locator('[data-testid="gql-sub-stats-bar"]')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('[data-testid="gql-sub-stats-bar"]')).toContainText('3', { timeout: 15_000 });
});

test('stream toolbar re-subscribe stays live long enough for pause control', async ({ page, request }) => {
  const orderId = await createTestOrder(request);

  await fillMonacoEditor(page, subscriptionQuery(orderId));
  await selectCustomTransport(page, 'graphql-transport-ws');
  await page.locator('[data-testid="gql-subscribe-btn"]').click();

  await expect(page.locator('[data-testid="gql-sub-message-list"]')).toContainText('COMPLETE', { timeout: 20_000 });
  await expect(page.locator('[data-testid="gql-sub-resubscribe-btn"]')).toBeVisible({ timeout: 5_000 });

  await page.locator('[data-testid="gql-sub-resubscribe-btn"]').click();
  await expect(page.locator('[data-testid="gql-sub-pause-btn"]')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('[data-testid="gql-sub-stop-btn"]')).toBeVisible();

  // Stream must not snap back to "Completed" instantly — Pause should remain for at least 1s.
  await page.waitForTimeout(1_000);
  await expect(page.locator('[data-testid="gql-sub-pause-btn"]')).toBeVisible();
  await expect(page.locator('[data-testid="gql-sub-resubscribe-btn"]')).not.toBeVisible();
});
