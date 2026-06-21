/**
 * Environment Manager expansion — E2E coverage for AC-EM-01 through AC-EM-20.
 * No Docker required; uses seeded localStorage + dev server on 5173.
 */
import { test, expect } from '@playwright/test';
import {
  addProtocolTab,
  expandMicroservice,
  expectHeaderProtocolIndicator,
  gotoEnvironmentManager,
  gotoGraphqlStudio,
  gotoSseStudio,
  gotoWebSocketStudio,
  seedEnvironmentManagerData,
  selectProtocolTab,
} from './environment-manager-helpers';

test.describe('Environment Manager — protocol tabs (AC-EM-01, AC-EM-02)', () => {
  test.beforeEach(async ({ page }) => {
    await seedEnvironmentManagerData(page);
    await gotoEnvironmentManager(page);
    await expandMicroservice(page);
  });

  test('EM-01: seeded HTTP tab, add-protocol menu includes all protocols', async ({ page }) => {
    const tablist = page.getByRole('tablist', { name: 'Protocol endpoints' });
    await expect(page.getByTestId('em-protocol-tab-http')).toBeVisible();
    await expect(page.getByTestId('em-add-protocol-btn')).toBeVisible();

    await page.getByTestId('em-add-protocol-btn').click();
    await expect(page.getByTestId('em-add-protocol-menu')).toBeVisible();
    await expect(page.getByTestId('em-add-protocol-item-http')).toHaveCount(0);
    await page.getByTestId('em-add-protocol-btn').click();

    let labels = await tablist.getByRole('tab').allTextContents();
    expect(labels.some((t) => t.includes('HTTP'))).toBe(true);
    expect(labels.some((t) => t.includes('WebSocket'))).toBe(false);

    for (const protocol of ['websocket', 'sse', 'graphql', 'grpc'] as const) {
      await addProtocolTab(page, protocol);
    }

    labels = await tablist.getByRole('tab').allTextContents();
    expect(labels.some((t) => t.includes('HTTP'))).toBe(true);
    expect(labels.some((t) => t.includes('WebSocket'))).toBe(true);
    expect(labels.some((t) => t.includes('SSE'))).toBe(true);
    expect(labels.some((t) => t.includes('GraphQL'))).toBe(true);
    expect(labels.some((t) => t.includes('gRPC'))).toBe(true);

    const order = ['HTTP', 'WebSocket', 'SSE', 'GraphQL', 'gRPC'];
    let lastIndex = -1;
    for (const name of order) {
      const idx = labels.findIndex((t) => t.includes(name));
      expect(idx).toBeGreaterThan(lastIndex);
      lastIndex = idx;
    }
  });

  test('EM-02: protocol completeness badges in card header', async ({ page }) => {
    const badges = page.getByTestId('protocol-header-badges');
    await expect(badges).toBeVisible();
    await expect(badges).toContainText(/HTTP/);
  });
});

test.describe('Environment Manager — inline edit & validation (AC-EM-05, AC-EM-17)', () => {
  test.beforeEach(async ({ page }) => {
    await seedEnvironmentManagerData(page);
    await gotoEnvironmentManager(page);
    await expandMicroservice(page);
  });

  test('EM-05: saves explicit WebSocket endpoint with ws/wss validation', async ({ page }) => {
    await selectProtocolTab(page, 'websocket');
    await page.getByRole('button', { name: 'Edit' }).first().click();
    const input = page.getByTestId('em-endpoint-edit-input');
    await input.fill('http://bad');
    await expect(page.getByText(/Use ws:\/\//)).toBeVisible();
    await expect(page.getByTestId('em-endpoint-save-btn')).toBeDisabled();
    await input.fill('wss://ws.e2e.example.com');
    await page.getByTestId('em-endpoint-save-btn').click();
    await expect(page.locator('.em-url-text').filter({ hasText: 'wss://ws.e2e.example.com' })).toBeVisible();
  });
});

test.describe('Header protocol indicator (AC-EM-14, AC-EM-15)', () => {
  test('EM-14: WebSocket studio shows explicit indicator when endpoint configured', async ({ page }) => {
    await seedEnvironmentManagerData(page, {
      protocolEndpoints: {
        websocket: { 'env-1': { baseUrl: 'wss://ws.e2e.example.com' } },
      },
    });
    await gotoWebSocketStudio(page);
    await expectHeaderProtocolIndicator(page, {
      status: 'explicit',
      urlFragment: 'wss://ws.e2e.example.com',
    });
  });

  test('EM-15: SSE studio shows fallback indicator from HTTP base', async ({ page }) => {
    await seedEnvironmentManagerData(page);
    await gotoSseStudio(page);
    await expectHeaderProtocolIndicator(page, {
      status: 'fallback',
      urlFragment: 'localhost:5173',
    });
  });
});

test.describe('Studio inline resolved preview (AC-EM-19, AC-EM-20)', () => {
  test('EM-19: WebSocket connect panel shows resolved preview for {{wsBaseUrl}}', async ({ page }) => {
    await seedEnvironmentManagerData(page, {
      protocolEndpoints: {
        websocket: { 'env-1': { baseUrl: 'wss://ws.e2e.example.com' } },
      },
    });
    await gotoWebSocketStudio(page);
    await page.getByLabel('WebSocket URL').fill('{{wsBaseUrl}}');
    const preview = page.getByTestId('env-preview');
    await expect(preview).toBeVisible({ timeout: 10000 });
    await expect(preview).toContainText('wss://ws.e2e.example.com');
    await expect(preview.locator('.studio-endpoint-preview-status--explicit')).toBeVisible();
  });

  test('EM-19: SSE studio shows resolved preview for template URL', async ({ page }) => {
    await seedEnvironmentManagerData(page);
    await gotoSseStudio(page);
    const urlInput = page.getByTestId('sse-url-input');
    await urlInput.fill('{{sseUrl}}/events');
    const preview = page.getByTestId('sse-endpoint-preview');
    await expect(preview).toBeVisible({ timeout: 10000 });
    await expect(preview).toContainText('localhost:5173');
  });

  test('EM-20: GraphQL connection bar shows resolved preview for {{graphqlUrl}}', async ({ page }) => {
    await seedEnvironmentManagerData(page, {
      protocolEndpoints: {
        graphql: { 'env-1': { baseUrl: 'https://gql.e2e.example.com', path: '/v1' } },
      },
    });
    await gotoGraphqlStudio(page);
    await page.getByTestId('gql-endpoint-input').fill('{{graphqlUrl}}');
    const preview = page.getByTestId('gql-endpoint-preview');
    await expect(preview).toBeVisible({ timeout: 10000 });
    await expect(preview).toContainText('https://gql.e2e.example.com/v1');
  });
});

test.describe('Derived variables panel (AC-EM-13)', () => {
  test('EM-13: GraphQL tab shows derived {{graphqlUrl}} variable', async ({ page }) => {
    await seedEnvironmentManagerData(page, {
      protocolEndpoints: {
        graphql: { 'env-1': { baseUrl: 'https://gql.e2e.example.com', path: '/graphql' } },
      },
    });
    await gotoEnvironmentManager(page);
    await expandMicroservice(page);
    await selectProtocolTab(page, 'graphql');
    const panel = page.getByTestId('derived-vars-graphql');
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('{{graphqlUrl}}');
  });
});
