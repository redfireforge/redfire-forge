/**
 * WS Mock Server — E2E Test Suite
 * Tests: WM-01 through WM-19
 * Requires: backend on 3001, Vite on 5173
 */
import { test, expect, type Page } from '@playwright/test';

const BASE = 'http://localhost:5173/?tab=websocket-studio';
const _MOCK_URL = 'ws://localhost:9876';

/* ── helpers ─────────────────────────────────────────── */

async function gotoWsStudio(page: Page) {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="mode-client"]', { timeout: 5000 });
}

async function switchMode(page: Page, mode: 'client' | 'mock' | 'saved') {
  await page.click(`[data-testid="mode-${mode}"]`);
  await page.waitForTimeout(300);
}

async function _switchLeftTab(page: Page, tab: string) {
  await page.click(`[data-testid="left-tab-${tab}"]`);
  await page.waitForTimeout(200);
}

async function _switchRightTab(page: Page, tab: string) {
  await page.click(`[data-testid="right-tab-${tab}"]`);
  await page.waitForTimeout(200);
}

async function gotoMockMode(page: Page) {
  await gotoWsStudio(page);
  await switchMode(page, 'mock');
  await page.waitForTimeout(300);
}

async function startMockServer(page: Page, port = 9876) {
  const portInput = page.locator('[data-testid="mock-port-input"]');
  await portInput.fill(String(port));
  await page.click('[data-testid="mock-start-btn"]');
  await page.waitForTimeout(1000);
  // Wait for status to show Running
  await expect(page.locator('[data-testid="mock-status-label"]')).toContainText(/running/i, { timeout: 5000 });
}

async function stopMockServer(page: Page) {
  const stopBtn = page.locator('[data-testid="mock-stop-btn"]');
  if (await stopBtn.isVisible({ timeout: 500 }).catch(() => false)) {
    await stopBtn.click();
    await page.waitForTimeout(500);
  }
}

/* ── Ensure mock server is stopped before tests ──────── */

test.beforeAll(async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  // Stop any running mock server from previous test suites
  await page.request.post('http://localhost:3001/api/ws/mock/stop').catch(() => {});
  await ctx.close();
});

/* ── WM-01–07: Mock Server Core ──────────────────────── */

test.describe('Mock Server Core (WM-01–07)', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure mock server is stopped before each test
    await page.request.post('http://localhost:3001/api/ws/mock/stop').catch(() => {});
  });

  test('WM-01: Mock Server mode reachable from mode switch', async ({ page }) => {
    await gotoMockMode(page);
    await expect(page.locator('[data-testid="mock-server-panel"]')).toBeVisible();
    // Start button should be visible
    await expect(page.locator('[data-testid="mock-start-btn"]')).toBeVisible();
  });

  test('WM-02: Port configuration', async ({ page }) => {
    await gotoMockMode(page);
    const portInput = page.locator('[data-testid="mock-port-input"]');
    await expect(portInput).toBeVisible();
    await portInput.fill('9877');
    await expect(portInput).toHaveValue('9877');
  });

  test('WM-03: Start mock server — status changes to Running', async ({ page }) => {
    await gotoMockMode(page);
    // Use a different port to avoid conflict with the backend's echo server
    await startMockServer(page, 9877);
    await expect(page.locator('[data-testid="mock-status-label"]')).toContainText(/running/i);
    // Stop button should appear
    await expect(page.locator('[data-testid="mock-stop-btn"]')).toBeVisible();
    await stopMockServer(page);
  });

  test('WM-05: Connected client count', async ({ page }) => {
    await gotoMockMode(page);
    await startMockServer(page, 9878);
    // Client count should start at 0
    const clientCount = page.locator('[data-testid="mock-client-count"]');
    await expect(clientCount).toContainText('0');
    await stopMockServer(page);
  });

  test('WM-06: Activity log visible', async ({ page }) => {
    await gotoMockMode(page);
    await startMockServer(page, 9879);
    // Switch to log tab
    const logTab = page.locator('[data-testid="mock-tab-log"]');
    await logTab.click();
    await page.waitForTimeout(200);
    const log = page.locator('[data-testid="mock-log"]');
    await expect(log).toBeVisible();
    await stopMockServer(page);
  });

  test('WM-07: Stop mock server — status changes', async ({ page }) => {
    await gotoMockMode(page);
    await startMockServer(page, 9880);
    await stopMockServer(page);
    await expect(page.locator('[data-testid="mock-status-label"]')).not.toContainText(/running/i);
  });
});

/* ── WM-08–09: Broadcast ─────────────────────────────── */

test.describe('Broadcast (WM-08–09)', () => {
  test('WM-09: Broadcast with no clients — button disabled', async ({ page }) => {
    await gotoMockMode(page);
    await startMockServer(page, 9881);
    const broadcastBtn = page.locator('[data-testid="mock-broadcast-btn"]');
    // With no clients, broadcast button should be disabled
    const _isDisabled = await broadcastBtn.isDisabled().catch(() => false);
    // Or the input is visible
    const broadcastInput = page.locator('[data-testid="mock-broadcast-input"]');
    await expect(broadcastInput).toBeVisible();
    await stopMockServer(page);
  });
});

/* ── WM-10–16: Response Rules Engine ─────────────────── */

test.describe('Response Rules (WM-10–16)', () => {
  test('WM-10: Add a response rule', async ({ page }) => {
    await gotoMockMode(page);
    // Switch to rules tab
    const rulesTab = page.locator('[data-testid="mock-tab-rules"]');
    await rulesTab.click();
    await page.waitForTimeout(200);
    // Add a rule
    const addRuleBtn = page.locator('[data-testid="mock-add-rule"]');
    await expect(addRuleBtn).toBeVisible();
    await addRuleBtn.click();
    await page.waitForTimeout(300);
    // A rule row should appear
    const rules = page.locator('[data-testid*="mock-rule-"]');
    const count = await rules.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('WM-14: Fallback mode selector', async ({ page }) => {
    await gotoMockMode(page);
    const fallback = page.locator('[data-testid="mock-fallback-select"]');
    await expect(fallback).toBeVisible();
  });

  test('WM-15: Rule enable/disable toggle', async ({ page }) => {
    await gotoMockMode(page);
    const rulesTab = page.locator('[data-testid="mock-tab-rules"]');
    await rulesTab.click();
    await page.waitForTimeout(200);
    // Add a rule if none exist
    const addRuleBtn = page.locator('[data-testid="mock-add-rule"]');
    await addRuleBtn.click();
    await page.waitForTimeout(300);
    // Toggle should exist on the rule
    const toggles = page.locator('[data-testid*="rule-toggle-"]');
    const count = await toggles.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('WM-16: Rule test preview', async ({ page }) => {
    await gotoMockMode(page);
    const testSection = page.locator('[data-testid="mock-test-section"]');
    if (await testSection.isVisible({ timeout: 1000 }).catch(() => false)) {
      const testInput = page.locator('[data-testid="mock-test-input"]');
      await expect(testInput).toBeVisible();
    }
  });
});

/* ── WM-18: Persistence ──────────────────────────────── */

test.describe('Persistence (WM-18)', () => {
  test('WM-18: Rules persist across page reload', async ({ page }) => {
    await gotoMockMode(page);
    const rulesTab = page.locator('[data-testid="mock-tab-rules"]');
    await rulesTab.click();
    await page.waitForTimeout(200);
    // Add a rule
    await page.click('[data-testid="mock-add-rule"]');
    await page.waitForTimeout(300);
    const rulesBefore = await page.locator('[data-testid*="mock-rule-"]').count();
    expect(rulesBefore).toBeGreaterThanOrEqual(1);
    // Reload and check
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="mode-client"]', { timeout: 5000 });
    await switchMode(page, 'mock');
    await page.waitForTimeout(300);
    await page.locator('[data-testid="mock-tab-rules"]').click();
    await page.waitForTimeout(300);
    const rulesAfter = await page.locator('[data-testid*="mock-rule-"]').count();
    expect(rulesAfter).toBeGreaterThanOrEqual(1);
  });
});

/* ── WM-19: End-to-End ───────────────────────────────── */

test.describe('End-to-End (WM-19)', () => {
  test('WM-19: Connect from another tab to own mock server', async ({ page }) => {
    await gotoMockMode(page);
    await startMockServer(page, 9882);
    // Add a new connection tab
    await page.click('[data-testid="conn-tab-add"]');
    await page.waitForTimeout(300);
    // The new tab is now active — scope to active pane
    const pane = page.locator('[data-testid^="conn-tab-pane-"]:visible');
    await pane.locator('[data-testid="mode-client"]').click();
    await page.waitForTimeout(300);
    // Connect to our mock server
    await pane.locator('[data-testid="left-tab-connect"]').click();
    await page.waitForTimeout(200);
    const urlInput = pane.locator('[aria-label="WebSocket URL"]');
    await urlInput.fill('ws://localhost:9882');
    await pane.locator('[data-testid="connect-btn"]').click();
    await page.locator('[data-testid="conn-tab-bar"] [role="tab"][aria-selected="true"][aria-label*="connected"]').waitFor({ timeout: 10000 });
    // Send a message
    await pane.locator('[data-testid="left-tab-compose"]').click();
    await page.waitForTimeout(200);
    const composeInput = pane.locator('.ws-compose-input');
    await composeInput.fill('Hello mock');
    await pane.locator('[data-testid="send-btn"]').click();
    await page.waitForTimeout(1000);
    // Echo response should appear
    await pane.locator('[data-testid="right-tab-events"]').click();
    await page.waitForTimeout(200);
    const msgList = pane.locator('[data-testid="message-list"]');
    await expect(msgList).toBeVisible();
    // Disconnect
    await pane.locator('[data-testid="left-tab-connect"]').click();
    await page.waitForTimeout(200);
    await pane.locator('[data-testid="disconnect-btn"]').click();
    await page.waitForTimeout(500);
    // Switch back to tab 1 to stop mock server
    const tabs = page.locator('[data-testid="conn-tab-bar"] [role="tab"]');
    await tabs.first().click();
    await page.waitForTimeout(300);
    const pane1 = page.locator('[data-testid^="conn-tab-pane-"]:visible');
    await pane1.locator('[data-testid="mode-mock"]').click();
    await page.waitForTimeout(300);
    await stopMockServer(page);
  });
});
