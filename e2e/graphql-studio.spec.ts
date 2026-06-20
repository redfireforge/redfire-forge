/**
 * graphql-studio.spec.ts — E2E tests for the GraphQL Studio.
 *
 * Tests the navigation, basic UI state, and core interactions of the
 * GraphQL Studio page without requiring a live GraphQL server.
 */

import { test, expect } from '@playwright/test';

const GQL_URL = '/?tab=graphql-studio';

test.describe('GraphQL Studio — navigation', () => {
  test('navigates to GraphQL Studio via URL param', async ({ page }) => {
    await page.goto(GQL_URL);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('[data-testid="gql-studio-page"]')).toBeVisible({ timeout: 15000 });
  });

  test('shows connection bar at top', async ({ page }) => {
    await page.goto(GQL_URL);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('[data-testid="gql-connection-bar"]')).toBeVisible({ timeout: 10000 });
  });

  test('has a URL/endpoint input field', async ({ page }) => {
    await page.goto(GQL_URL);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('[data-testid="gql-endpoint-input"]')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('GraphQL Studio — tab bar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(GQL_URL);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('[data-testid="gql-tab-bar"]', { timeout: 10000 });
  });

  test('renders at least one query tab', async ({ page }) => {
    const tabs = page.locator('[data-testid="gql-tab-bar"] button[role="tab"]');
    await expect(tabs.first()).toBeVisible({ timeout: 5000 });
  });

  test('shows + add tab button', async ({ page }) => {
    await expect(page.locator('[data-testid="gql-tab-add-btn"]')).toBeVisible();
  });

  test('clicking + button adds a new tab', async ({ page }) => {
    const tabSelector = '[data-testid="gql-tab-bar"] button[role="tab"]';
    const initialCount = await page.locator(tabSelector).count();
    await page.click('[data-testid="gql-tab-add-btn"]');
    await page.waitForTimeout(300);
    const newCount = await page.locator(tabSelector).count();
    expect(newCount).toBeGreaterThan(initialCount);
  });
});

test.describe('GraphQL Studio — editor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(GQL_URL);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('[data-testid="gql-studio-page"]', { timeout: 15000 });
  });

  test('Monaco editor container is visible', async ({ page }) => {
    await expect(page.locator('.monaco-editor').first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('GraphQL Studio — bottom panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(GQL_URL);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('[data-testid="gql-studio-page"]', { timeout: 15000 });
  });

  test('Variables tab is visible', async ({ page }) => {
    await expect(page.locator('[data-testid="gql-bottom-tab-variables"]')).toBeVisible({ timeout: 10000 });
  });

  test('Headers tab is visible', async ({ page }) => {
    await expect(page.locator('[data-testid="gql-bottom-tab-headers"]')).toBeVisible({ timeout: 10000 });
  });

  test('clicking Headers tab switches panel content', async ({ page }) => {
    await page.click('[data-testid="gql-bottom-tab-headers"]');
    await expect(page.locator('[data-testid="gql-headers-panel"]')).toBeVisible({ timeout: 5000 });
  });

  test('clicking + Add in Headers adds a new header row', async ({ page }) => {
    await page.click('[data-testid="gql-bottom-tab-headers"]');
    await page.waitForSelector('[data-testid="gql-headers-panel"]');
    await page.click('[data-testid="gql-headers-add-btn"]');
    const rows = await page.locator('[data-testid^="gql-header-row-"]').count();
    expect(rows).toBeGreaterThanOrEqual(1);
  });
});

test.describe('GraphQL Studio — right pane', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(GQL_URL);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('[data-testid="gql-studio-page"]', { timeout: 15000 });
  });

  test('Response pane tab is visible', async ({ page }) => {
    await expect(page.locator('[data-testid="gql-right-tab-response"]')).toBeVisible({ timeout: 10000 });
  });

  test('Schema pane tab is visible', async ({ page }) => {
    await expect(page.locator('[data-testid="gql-right-tab-schema"]')).toBeVisible({ timeout: 10000 });
  });

  test('empty response state visible initially', async ({ page }) => {
    await expect(page.locator('[data-testid="gql-response-empty"]')).toBeVisible({ timeout: 10000 });
  });

  test('switching to Schema tab shows schema idle state', async ({ page }) => {
    await page.click('[data-testid="gql-right-tab-schema"]');
    await expect(page.locator('[data-testid="gql-se-empty-idle"]')).toBeVisible({ timeout: 5000 });
  });

  test('Schema idle state has Introspect Schema button', async ({ page }) => {
    await page.click('[data-testid="gql-right-tab-schema"]');
    await expect(page.locator('[data-testid="gql-se-idle-introspect-btn"]')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('GraphQL Studio — connection profiles', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(GQL_URL);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('[data-testid="gql-studio-page"]', { timeout: 15000 });
  });

  test('connection bar shows endpoint input', async ({ page }) => {
    await expect(page.locator('[data-testid="gql-endpoint-input"]')).toBeVisible({ timeout: 10000 });
  });

  test('typing in endpoint input updates the value', async ({ page }) => {
    const input = page.locator('[data-testid="gql-endpoint-input"]');
    await input.fill('https://api.example.com/graphql');
    await expect(input).toHaveValue('https://api.example.com/graphql');
  });
});

test.describe('GraphQL Studio — persistence', () => {
  test('tab state is preserved across page reload', async ({ browser }) => {
    // Use a fresh, isolated browser context to avoid cross-test state contamination
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const tabSelector = '[data-testid="gql-tab-bar"] button[role="tab"]';

    try {
      await page.goto('http://localhost:5173' + GQL_URL);
      await page.waitForSelector('[data-testid="gql-tab-bar"]', { timeout: 15000 });

      // Fresh context → exactly 1 default tab
      const initialCount = await page.locator(tabSelector).count();
      expect(initialCount).toBe(1);

      // Add one more tab and wait for the 500ms debounce to flush to localStorage
      await page.click('[data-testid="gql-tab-add-btn"]');
      await page.waitForTimeout(800);
      expect(await page.locator(tabSelector).count()).toBe(2);

      // Verify the tabs are persisted before reloading
      const tabsInStorage = await page.evaluate(() => {
        const raw = localStorage.getItem('gql_tabs_v1');
        if (!raw) return null;
        try { return JSON.parse(raw) as unknown[]; } catch { return null; }
      });
      expect(tabsInStorage).toHaveLength(2);

      // Reload and verify the two tabs are restored from localStorage
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForSelector('[data-testid="gql-tab-bar"]', { timeout: 20000 });
      // Wait for React to stabilize after StrictMode double-invoke
      await page.waitForTimeout(600);
      expect(await page.locator(tabSelector).count()).toBe(2);
    } finally {
      await ctx.close();
    }
  });
});
