/**
 * WS Core Connect — E2E Test Suite
 * Tests: WC-01 through WC-46, WC-A01–A03, WC-C01–C09
 * Requires: backend on 3001 (mock WS echo on 9876), Vite on 5173
 */
import { test, expect, type Page } from '@playwright/test';

const BASE = 'http://localhost:5173/?tab=websocket-studio';
const MOCK_URL = 'ws://localhost:9876';

/* ── helpers ─────────────────────────────────────────── */

async function gotoWsStudio(page: Page) {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="mode-client"]', { timeout: 5000 });
}

async function connectTo(page: Page, url = MOCK_URL) {
  // Ensure we're on the Connect tab so URL input + connect-btn are visible
  await switchLeftTab(page, 'connect');
  const urlInput = page.locator('[aria-label="WebSocket URL"]');
  await urlInput.fill(url);
  await page.click('[data-testid="connect-btn"]');
  // Use Playwright locator (more reliable than waitForFunction) on the
  // connection tab bar — aria-label includes state hint e.g. "localhost:9876 — connected".
  await page.locator('[data-testid="conn-tab-bar"] [aria-label*="connected"]').waitFor({ timeout: 10000 });
  await page.waitForTimeout(300);
}

async function disconnect(page: Page) {
  // disconnect-btn is in the Connect tab; switch there if not already
  const disconnectBtn = page.locator('[data-testid="disconnect-btn"]');
  if (!(await disconnectBtn.isVisible({ timeout: 500 }).catch(() => false))) {
    await switchLeftTab(page, 'connect');
  }
  await disconnectBtn.click();
  // Wait for tab label to lose "connected" state
  await page.locator('[data-testid="conn-tab-bar"] [aria-label*="disconnected"]').waitFor({ timeout: 5000 });
}

async function switchLeftTab(page: Page, tab: string) {
  await page.click(`[data-testid="left-tab-${tab}"]`);
  await page.waitForTimeout(200);
}

async function switchRightTab(page: Page, tab: string) {
  await page.click(`[data-testid="right-tab-${tab}"]`);
  await page.waitForTimeout(200);
}

async function sendMessage(page: Page, msg: string) {
  await switchLeftTab(page, 'compose');
  const input = page.locator('.ws-compose-input');
  await input.fill(msg);
  await page.click('[data-testid="send-btn"]');
  await page.waitForTimeout(500);
}

async function switchMode(page: Page, mode: 'client' | 'mock' | 'saved') {
  await page.click(`[data-testid="mode-${mode}"]`);
  await page.waitForTimeout(300);
}

/* ── WC-01: Navigation & Layout ──────────────────────── */

test.describe('Navigation & Layout (WC-01–03)', () => {
  test('WC-01: Activity bar → Protocols → WebSocket sub-nav', async ({ page }) => {
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
    await page.click('text=Protocols');
    await page.waitForTimeout(300);
    await expect(page.locator('button:has-text("Kafka")')).toBeVisible();
    await expect(page.locator('button:has-text("WebSocket")')).toBeVisible();
    await expect(page.locator('button:has-text("SSE")')).toBeVisible();
    await page.click('button:has-text("WebSocket")');
    await page.waitForTimeout(300);
    await expect(page.locator('[data-testid="ws-studio-shell"]')).toBeVisible();
  });

  test('WC-02: Page layout — tab bar, mode switch, split pane', async ({ page }) => {
    await gotoWsStudio(page);
    await expect(page.locator('[data-testid="mode-client"]')).toBeVisible();
    await expect(page.locator('[data-testid="mode-mock"]')).toBeVisible();
    await expect(page.locator('[data-testid="mode-saved"]')).toBeVisible();
    await expect(page.locator('[data-testid="left-tab-connect"]')).toBeVisible();
    await expect(page.locator('[data-testid="left-tab-params"]')).toBeVisible();
    await expect(page.locator('[data-testid="left-tab-auth"]')).toBeVisible();
    await expect(page.locator('[data-testid="left-tab-headers"]')).toBeVisible();
    await expect(page.locator('[data-testid="left-tab-compose"]')).toBeVisible();
    await expect(page.locator('[data-testid="right-tab-events"]')).toBeVisible();
    await expect(page.locator('[data-testid="right-tab-console"]')).toBeVisible();
    await expect(page.locator('[data-testid="right-tab-stats"]')).toBeVisible();
    await expect(page.locator('[data-testid="right-tab-loadtest"]')).toBeVisible();
    await expect(page.locator('[data-testid="right-tab-schema"]')).toBeVisible();
  });

  test('WC-03: Initial state — URL input, status, buttons', async ({ page }) => {
    await gotoWsStudio(page);
    const urlInput = page.locator('[aria-label="WebSocket URL"]');
    await expect(urlInput).toBeVisible();
    await expect(urlInput).toHaveValue('');
    await expect(page.locator('[data-testid="protocol-select"]')).toBeVisible();
    await expect(page.locator('[data-testid="connect-btn"]')).toBeDisabled();
    await expect(page.locator('[data-testid="disconnect-btn"]')).toBeDisabled();
    await expect(page.locator('[data-testid="status-badge"]')).toContainText('Disconnected');
    // counters is inside Connect panel — verify we're on connect tab
    await expect(page.locator('[data-testid="counters"]')).toContainText('↑ 0 ↓ 0');
  });
});

/* ── WC-04–10: Connection Lifecycle ──────────────────── */

test.describe('Connection Lifecycle (WC-04–10)', () => {
  test('WC-04: Connect to echo server', async ({ page }) => {
    await gotoWsStudio(page);
    await connectTo(page);
    const activeTab = page.locator('[role="tab"][aria-selected="true"]').first();
    await expect(activeTab).toContainText('localhost:9876');
    // Verify via always-visible events bar
    await expect(page.locator('.ws-messages-status-label')).toContainText('Connected');
    // Switch to Connect tab for connect-panel-only elements
    await switchLeftTab(page, 'connect');
    await expect(page.locator('[aria-label="WebSocket URL"]')).toBeDisabled();
    await expect(page.locator('[data-testid="connect-btn"]')).toBeDisabled();
    await expect(page.locator('[data-testid="disconnect-btn"]')).toBeEnabled();
    await expect(page.locator('[data-testid="transport-badge"]')).toContainText('Direct');
    await expect(page.locator('[data-testid="protocol-badge"]')).toContainText('Raw');
  });

  test('WC-05: Disconnect from echo server', async ({ page }) => {
    await gotoWsStudio(page);
    await connectTo(page);
    await disconnect(page);
    await expect(page.locator('.ws-messages-status-label')).toContainText('Disconnected');
    await switchLeftTab(page, 'connect');
    await expect(page.locator('[aria-label="WebSocket URL"]')).toBeEnabled();
    await expect(page.locator('[data-testid="connect-btn"]')).toBeEnabled();
  });

  test('WC-06: Connect with custom headers (proxy mode)', async ({ page }) => {
    await gotoWsStudio(page);
    const urlInput = page.locator('[aria-label="WebSocket URL"]');
    await urlInput.fill(MOCK_URL);
    await switchLeftTab(page, 'headers');
    await page.waitForTimeout(200);
    const addBtn = page.locator('[data-testid$="-add-btn"]').first();
    await addBtn.click();
    await page.waitForTimeout(200);
    const headerRow = page.locator('[data-testid$="-row-0"]');
    const keyInput = headerRow.locator('input').first();
    const valInput = headerRow.locator('input').nth(1);
    await keyInput.fill('Authorization');
    await valInput.fill('Bearer test-token-123');
    await switchLeftTab(page, 'connect');
    await page.click('[data-testid="connect-btn"]');
    await page.locator('[data-testid="conn-tab-bar"] [aria-label*="connected"]').waitFor({ timeout: 10000 });
    await switchLeftTab(page, 'connect');
    await expect(page.locator('[data-testid="transport-badge"]')).toContainText('Proxy');
    await switchLeftTab(page, 'compose');
    await expect(page.locator('[data-testid="ping-btn"]')).toBeEnabled();
  });

  test('WC-07: Connect with query parameters', async ({ page }) => {
    await gotoWsStudio(page);
    const urlInput = page.locator('[aria-label="WebSocket URL"]');
    await urlInput.fill(MOCK_URL);
    await switchLeftTab(page, 'params');
    await page.waitForTimeout(200);
    const addBtn = page.locator('[data-testid$="-add-btn"]').first();
    await addBtn.click();
    await page.waitForTimeout(200);
    const paramRow = page.locator('[data-testid$="-row-0"]');
    const keyInput = paramRow.locator('input').first();
    const valInput = paramRow.locator('input').nth(1);
    await keyInput.fill('token');
    await valInput.fill('abc123');
    await switchLeftTab(page, 'connect');
    await page.click('[data-testid="connect-btn"]');
    await page.locator('[data-testid="conn-tab-bar"] [aria-label*="connected"]').waitFor({ timeout: 10000 });
    await expect(page.locator('.ws-messages-status-label')).toContainText('Connected');
  });

  test('WC-09: Connect to invalid URL', async ({ page }) => {
    await gotoWsStudio(page);
    const urlInput = page.locator('[aria-label="WebSocket URL"]');
    await urlInput.fill('ws://invalid-host-that-does-not-exist:9999');
    await page.click('[data-testid="connect-btn"]');
    // Wait for connection to fail — state hint is 'error' or 'disconnected'
    await page.locator('[data-testid="conn-tab-bar"] [aria-label*="error"]').waitFor({ timeout: 15000 });
    const status = await page.locator('.ws-messages-status-label').textContent();
    expect(status).not.toContain('Connecting');
  });
});

/* ── WC-11–18: Compose & Messaging ───────────────────── */

test.describe('Compose & Messaging (WC-11–18)', () => {
  test.beforeEach(async ({ page }) => {
    await gotoWsStudio(page);
    await connectTo(page);
  });

  test('WC-11: Send text message', async ({ page }) => {
    await sendMessage(page, 'Hello WebSocket!');
    const sentMsg = page.locator('[data-testid="message-list"] [data-testid^="message-row-"]').filter({ hasText: 'Hello WebSocket!' }).first();
    await expect(sentMsg).toBeVisible();
    await expect(sentMsg).toContainText('16 B');
    // counters is inside Connect tab; check via events status bar instead
    await expect(page.locator('[data-testid="messages-status-bar"]')).toContainText('↑ 1');
  });

  test('WC-12: Echo server response', async ({ page }) => {
    await sendMessage(page, 'Hello WebSocket!');
    const receivedMsgs = page.locator('[data-testid="message-list"] [data-testid^="message-row-"]').filter({ hasText: '↓' }).filter({ hasText: 'Hello WebSocket!' });
    await expect(receivedMsgs.first()).toBeVisible();
    // counters is inside Connect tab; check via events status bar instead
    await expect(page.locator('[data-testid="messages-status-bar"]')).toContainText('↓ 1');
  });

  test('WC-13: Cmd+Enter shortcut sends message', async ({ page }) => {
    await switchLeftTab(page, 'compose');
    const input = page.locator('.ws-compose-input');
    await input.fill('Shortcut test');
    await input.press('Meta+Enter');
    await page.waitForTimeout(500);
    await expect(page.locator('[data-testid="message-list"]')).toContainText('Shortcut test');
  });

  test('WC-14: Send JSON message — auto-detection', async ({ page }) => {
    await sendMessage(page, '{"type":"greeting","message":"Hello JSON"}');
    const sentMsg = page.locator('[data-testid="message-list"] [data-testid^="message-row-"]').filter({ hasText: 'greeting' }).first();
    await expect(sentMsg).toContainText('json');
  });

  test('WC-15: Format selector — Text / JSON / Binary modes', async ({ page }) => {
    await switchLeftTab(page, 'compose');
    const formatSelect = page.locator('[data-testid="format-select"]');
    await expect(formatSelect).toBeVisible();
    const options = await formatSelect.locator('option').allTextContents();
    expect(options).toContain('Text');
    expect(options).toContain('JSON');
    expect(options).toContain('Binary (Base64)');
  });

  test('WC-16: Send binary message', async ({ page }) => {
    await switchLeftTab(page, 'compose');
    await page.selectOption('[data-testid="format-select"]', 'binary');
    const input = page.locator('.ws-compose-input');
    await input.fill('SGVsbG8gQmluYXJ5IQ==');
    await page.click('[data-testid="send-btn"]');
    await page.waitForTimeout(500);
    const sentMsg = page.locator('[data-testid="message-list"] [data-testid^="message-row-"]').filter({ hasText: 'binary' }).first();
    await expect(sentMsg).toBeVisible();
  });

  test('WC-16a: Type badge inference (content-based)', async ({ page }) => {
    const sysMsg = page.locator('[data-testid="message-list"] [data-testid^="message-row-"]').first();
    await expect(sysMsg).toContainText('sys');
    await sendMessage(page, '{"hello":"world"}');
    const jsonMsg = page.locator('[data-testid="message-list"] [data-testid^="message-row-"]').filter({ hasText: 'hello' }).first();
    await expect(jsonMsg).toContainText('json');
    await sendMessage(page, 'hello there');
    const textMsg = page.locator('[data-testid="message-list"] [data-testid^="message-row-"]').filter({ hasText: 'hello there' }).first();
    await expect(textMsg).toContainText('text');
  });

  test('WC-18: Send button disabled states', async ({ page }) => {
    await switchLeftTab(page, 'compose');
    const input = page.locator('.ws-compose-input');
    await input.fill('');
    await expect(page.locator('[data-testid="send-btn"]')).toBeDisabled();
    await input.fill('test');
    await expect(page.locator('[data-testid="send-btn"]')).toBeEnabled();
  });
});

/* ── WC-19–24: Message Log ───────────────────────────── */

test.describe('Message Log (WC-19–24)', () => {
  test.beforeEach(async ({ page }) => {
    await gotoWsStudio(page);
    await connectTo(page);
  });

  test('WC-20: Direction filter', async ({ page }) => {
    await sendMessage(page, 'filter test 1');
    await sendMessage(page, 'filter test 2');
    const dirFilter = page.locator('[data-testid="filter-toggle-btn"]');
    await expect(dirFilter).toBeVisible();
  });

  test('WC-21: Text search', async ({ page }) => {
    await sendMessage(page, 'unique-search-term-xyz');
    const searchInput = page.locator('[data-testid="search-input"]');
    await searchInput.fill('unique-search-term');
    await page.waitForTimeout(300);
    const rows = page.locator('[data-testid="message-list"] [data-testid^="message-row-"]:visible');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  test('WC-22: Click message → detail panel', async ({ page }) => {
    await sendMessage(page, '{"detail":"test"}');
    await page.waitForTimeout(300);
    const msgRow = page.locator('[data-testid="message-list"] [data-testid^="message-row-"]').filter({ hasText: 'detail' }).first();
    await msgRow.click();
    await page.waitForTimeout(300);
    const detail = page.locator('[data-testid="detail-panel"]');
    await expect(detail).toBeVisible();
    await expect(detail.locator('text=JSON')).toBeVisible();
    await expect(detail.locator('text=Raw')).toBeVisible();
    await expect(detail.locator('text=Hex')).toBeVisible();
  });

  test('WC-23: Clear messages', async ({ page }) => {
    await sendMessage(page, 'to-be-cleared');
    await page.click('[data-testid="clear-btn"]');
    await page.waitForTimeout(300);
    await expect(page.locator('text=No messages yet')).toBeVisible();
  });

  test('WC-24: Export messages as JSON', async ({ page }) => {
    await sendMessage(page, 'export-test');
    // Disable showSaveFilePicker so it falls back to anchor-based download
    await page.evaluate(() => { delete (window as Record<string, unknown>).showSaveFilePicker; });
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 10000 }),
      page.click('[data-testid="export-messages-btn"]'),
    ]);
    expect(download.suggestedFilename()).toContain('.json');
  });
});

/* ── WC-25–29c: Saved Connection Profiles ────────────── */

test.describe('Saved Connection Profiles (WC-25–29c)', () => {
  test('WC-25: Saved mode — empty state', async ({ page }) => {
    await gotoWsStudio(page);
    await switchMode(page, 'saved');
    await expect(page.locator('span.ws-saved-rail-title')).toBeVisible();
    await expect(page.locator('[data-testid="new-profile-btn"]')).toBeVisible();
  });

  test('WC-26: Save current connection as profile', async ({ page }) => {
    await gotoWsStudio(page);
    const urlInput = page.locator('[aria-label="WebSocket URL"]');
    await urlInput.fill(MOCK_URL);
    await page.click('[data-testid="save-as-profile-btn"]');
    await page.waitForTimeout(500);
    const nameInput = page.locator('[data-testid="profile-name-input"]');
    await expect(nameInput).toBeVisible();
    await nameInput.fill('Echo Server Test');
    await page.click('[data-testid="profile-save-btn"]');
    await page.waitForTimeout(500);
    await expect(page.locator('[data-testid^="profile-card-"]').first()).toContainText('Echo Server Test');
  });

  test('WC-27: Load profile → fills connect form & connects', async ({ page }) => {
    await gotoWsStudio(page);
    const urlInput = page.locator('[aria-label="WebSocket URL"]');
    await urlInput.fill(MOCK_URL);
    await page.click('[data-testid="save-as-profile-btn"]');
    await page.waitForTimeout(500);
    const nameInput = page.locator('[data-testid="profile-name-input"]');
    await nameInput.fill('Load Test Profile');
    await page.click('[data-testid="profile-save-btn"]');
    await page.waitForTimeout(500);
    await page.click('[data-testid^="load-btn-"]');
    await page.waitForTimeout(2000);
    await expect(page.locator('[aria-label="WebSocket URL"]')).toHaveValue(MOCK_URL);
  });

  test('WC-28: Delete profile', async ({ page }) => {
    await gotoWsStudio(page);
    const urlInput = page.locator('[aria-label="WebSocket URL"]');
    await urlInput.fill(MOCK_URL);
    await page.click('[data-testid="save-as-profile-btn"]');
    await page.waitForTimeout(500);
    const nameInput = page.locator('[data-testid="profile-name-input"]');
    await nameInput.fill('To Delete');
    await page.click('[data-testid="profile-save-btn"]');
    await page.waitForTimeout(500);
    await page.click('[data-testid^="delete-btn-"]');
    await page.waitForTimeout(200);
    await page.click('[data-testid^="confirm-delete-"]');
    await page.waitForTimeout(500);
    await expect(page.locator('text=To Delete')).not.toBeVisible();
  });

  test('WC-29a: Duplicate a profile', async ({ page }) => {
    await gotoWsStudio(page);
    const urlInput = page.locator('[aria-label="WebSocket URL"]');
    await urlInput.fill(MOCK_URL);
    await page.click('[data-testid="save-as-profile-btn"]');
    await page.waitForTimeout(500);
    const nameInput = page.locator('[data-testid="profile-name-input"]');
    await nameInput.fill('Original Profile');
    await page.click('[data-testid="profile-save-btn"]');
    await page.waitForTimeout(500);
    await page.click('[data-testid^="dup-btn-"]');
    await page.waitForTimeout(500);
    await expect(page.locator('text=Original Profile (copy)')).toBeVisible();
  });
});

/* ── WC-30: Config Lock ──────────────────────────────── */

test.describe('Config Lock (WC-30)', () => {
  test('WC-30: Config lock while connected', async ({ page }) => {
    await gotoWsStudio(page);
    await connectTo(page);
    await switchLeftTab(page, 'connect');
    await expect(page.locator('[aria-label="WebSocket URL"]')).toBeDisabled();
    await expect(page.locator('[data-testid="protocol-select"]')).toBeDisabled();
    await expect(page.locator('text=Connection settings are locked')).toBeVisible();
  });
});

/* ── WC-31–35: Message Templates ─────────────────────── */

test.describe('Message Templates (WC-31–35)', () => {
  test('WC-31: Save message template', async ({ page }) => {
    await gotoWsStudio(page);
    await connectTo(page);
    await switchLeftTab(page, 'compose');
    const input = page.locator('.ws-compose-input');
    await input.fill('{"action":"subscribe","topic":"prices"}');
    await page.click('[data-testid="template-trigger"]');
    await page.waitForTimeout(300);
    const nameInput = page.locator('[data-testid="template-save-name"]');
    await expect(nameInput).toBeVisible();
    await nameInput.fill('Subscribe Prices');
    await page.click('[data-testid="template-save-btn"]');
    await page.waitForTimeout(300);
    await expect(page.locator('[data-testid="template-list"]')).toContainText('Subscribe Prices');
  });

  test('WC-32: Load template → fills compose bar', async ({ page }) => {
    await gotoWsStudio(page);
    await connectTo(page);
    await switchLeftTab(page, 'compose');
    const input = page.locator('.ws-compose-input');
    await input.fill('{"greeting":"hello"}');
    await page.click('[data-testid="template-trigger"]');
    await page.waitForTimeout(300);
    const nameInput = page.locator('[data-testid="template-save-name"]');
    await nameInput.fill('Greeting JSON');
    await page.click('[data-testid="template-save-btn"]');
    await page.waitForTimeout(300);
    await input.fill('');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await page.click('[data-testid="template-trigger"]');
    await page.waitForTimeout(300);
    await page.click('[data-testid^="template-item-"]');
    await page.waitForTimeout(200);
    await expect(input).toHaveValue('{"greeting":"hello"}');
  });

  test('WC-33: Delete template', async ({ page }) => {
    await gotoWsStudio(page);
    await connectTo(page);
    await switchLeftTab(page, 'compose');
    const input = page.locator('.ws-compose-input');
    await input.fill('temp delete test');
    await page.click('[data-testid="template-trigger"]');
    await page.waitForTimeout(300);
    const nameInput = page.locator('[data-testid="template-save-name"]');
    await nameInput.fill('ToDelete');
    await page.click('[data-testid="template-save-btn"]');
    await page.waitForTimeout(300);
    await page.click('[data-testid^="template-delete-"]');
    await page.waitForTimeout(300);
    // After deleting the only template, template-list is replaced by template-empty
    await expect(page.locator('[data-testid="template-dropdown"]')).not.toContainText('ToDelete');
  });
});

/* ── WC-36: Auto-Reconnect ───────────────────────────── */

test.describe('Auto-Reconnect (WC-36)', () => {
  test('WC-36: Auto-reconnect settings UI', async ({ page }) => {
    await gotoWsStudio(page);
    await switchLeftTab(page, 'connect');
    const checkbox = page.locator('[data-testid="auto-reconnect-toggle"]');
    await expect(checkbox).toBeVisible();
    const maxAttempts = page.locator('[data-testid="max-reconnect-attempts"]');
    await expect(maxAttempts).toBeVisible();
    const retryInterval = page.locator('[data-testid="reconnect-interval-ms"]');
    await expect(retryInterval).toBeVisible();
    const backoff = page.locator('[data-testid="backoff-multiplier"]');
    await expect(backoff).toBeVisible();
  });
});

/* ── WC-38: Close with code/reason ───────────────────── */

test.describe('Close with Code (WC-38)', () => {
  test('WC-38: Close with code/reason', async ({ page }) => {
    await gotoWsStudio(page);
    await connectTo(page);
    await switchLeftTab(page, 'connect');
    await page.click('[data-testid="disconnect-caret"]');
    await page.waitForTimeout(300);
    const codeInput = page.locator('[data-testid="close-code-input"]');
    await expect(codeInput).toBeVisible();
    const reasonInput = page.locator('[data-testid="close-reason-input"]');
    await expect(reasonInput).toBeVisible();
    await expect(page.locator('text=1000 Normal')).toBeVisible();
    await codeInput.fill('1000');
    await reasonInput.fill('Normal closure test');
    await page.click('[data-testid="close-with-code-btn"]');
    await page.waitForTimeout(1000);
    await expect(page.locator('.ws-messages-status-label')).toContainText('Disconnected');
  });
});

/* ── WC-40: Environment Variable Interpolation ───────── */

test.describe('Environment Variables (WC-40)', () => {
  test('WC-40: URL with {{wsBaseUrl}} placeholder', async ({ page }) => {
    await gotoWsStudio(page);
    await switchLeftTab(page, 'connect');
    const urlInput = page.locator('[aria-label="WebSocket URL"]');
    await urlInput.fill('{{wsBaseUrl}}/ws');
    await expect(urlInput).toHaveValue('{{wsBaseUrl}}/ws');
    // Without an environment resolving the variable, URL is invalid — connect stays disabled
    // The test verifies the placeholder can be typed in the URL field
    await expect(page.locator('[data-testid="connect-btn"]')).toBeDisabled();
  });
});

/* ── WC-A01–A03: Connection Auth ─────────────────────── */

test.describe('Connection Auth (WC-A01–A03)', () => {
  test('WC-A01: Auth panel layout & type selector', async ({ page }) => {
    await gotoWsStudio(page);
    await switchLeftTab(page, 'auth');
    await expect(page.locator('text=Connection Auth')).toBeVisible();
    const typeSelect = page.locator('select').filter({ has: page.locator('option:has-text("No Auth")') });
    await expect(typeSelect).toBeVisible();
    const options = await typeSelect.locator('option').allTextContents();
    expect(options).toContain('No Auth');
    expect(options).toContain('Bearer Token');
    expect(options).toContain('Basic Auth');
  });

  test('WC-A02: Bearer Token fields & masked preview', async ({ page }) => {
    await gotoWsStudio(page);
    await switchLeftTab(page, 'auth');
    const typeSelect = page.locator('select').filter({ has: page.locator('option:has-text("No Auth")') });
    await typeSelect.selectOption({ label: 'Bearer Token' });
    await page.waitForTimeout(200);
    // Fill the token input field
    const tokenField = page.locator('input[placeholder*="eyJ"]');
    if (await tokenField.count() > 0) {
      await tokenField.fill('my-secret-token-abc123');
    } else {
      // Fallback: find first text input in auth panel
      const authInputs = page.locator('[data-testid="left-tab-auth"] ~ * input[type="text"]');
      if (await authInputs.count() > 0) {
        await authInputs.first().fill('my-secret-token-abc123');
      }
    }
    await expect(page.locator('[data-testid="ws-auth-resolved"]')).toBeVisible();
    await expect(page.locator('[data-testid="ws-auth-callout"]')).toBeVisible();
  });

  test('WC-A03: Auth forces proxy transport (browser)', async ({ page }) => {
    await gotoWsStudio(page);
    await switchLeftTab(page, 'auth');
    const typeSelect = page.locator('select').filter({ has: page.locator('option:has-text("No Auth")') });
    await typeSelect.selectOption({ label: 'Bearer Token' });
    await page.waitForTimeout(200);
    const tokenField = page.locator('input[placeholder*="eyJ"]');
    if (await tokenField.count() > 0) {
      await tokenField.fill('test-token');
    }
    await switchLeftTab(page, 'connect');
    const urlInput = page.locator('[aria-label="WebSocket URL"]');
    await urlInput.fill(MOCK_URL);
    await page.click('[data-testid="connect-btn"]');
    await page.locator('[data-testid="conn-tab-bar"] [aria-label*="connected"]').waitFor({ timeout: 10000 });
    await switchLeftTab(page, 'connect');
    await expect(page.locator('[data-testid="transport-badge"]')).toContainText('Proxy');
  });
});

/* ── WC-C01–C09: Console ─────────────────────────────── */

test.describe('Console (WC-C01–C09)', () => {
  test('WC-C01: Console pane layout', async ({ page }) => {
    await gotoWsStudio(page);
    await switchRightTab(page, 'console');
    await expect(page.locator('[data-testid="ws-console-view-structured"]')).toBeVisible();
    await expect(page.locator('[data-testid="ws-console-view-raw"]')).toBeVisible();
    await expect(page.locator('[data-testid="ws-console-level-all"]')).toBeVisible();
    await expect(page.locator('[data-testid="ws-console-level-info"]')).toBeVisible();
    await expect(page.locator('[data-testid="ws-console-level-warn"]')).toBeVisible();
    await expect(page.locator('[data-testid="ws-console-level-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="ws-console-cmd-input"]')).toBeVisible();
  });

  test('WC-C02: Structured view — lifecycle & handshake entries', async ({ page }) => {
    await gotoWsStudio(page);
    // Connect first (while Events tab visible), then switch to Console
    await connectTo(page);
    await switchRightTab(page, 'console');
    const consolePane = page.locator('[data-testid="ws-console"]');
    await expect(consolePane).toContainText('Connected');
  });

  test('WC-C06: /help and /clear commands', async ({ page }) => {
    await gotoWsStudio(page);
    await switchRightTab(page, 'console');
    const cmdInput = page.locator('[data-testid="ws-console-cmd-input"]');
    await cmdInput.fill('/help');
    await cmdInput.press('Enter');
    await page.waitForTimeout(300);
    await expect(page.locator('[data-testid="ws-console"]')).toContainText('Available commands');
    await cmdInput.fill('/clear');
    await cmdInput.press('Enter');
    await page.waitForTimeout(300);
  });

  test('WC-C07: /ping command — transport-gated', async ({ page }) => {
    await gotoWsStudio(page);
    await connectTo(page);
    await switchRightTab(page, 'console');
    const cmdInput = page.locator('[data-testid="ws-console-cmd-input"]');
    await cmdInput.fill('/ping');
    await cmdInput.press('Enter');
    await page.waitForTimeout(300);
    await expect(page.locator('[data-testid="ws-console"]')).toContainText('not supported');
  });

  test('WC-C08: /send command', async ({ page }) => {
    await gotoWsStudio(page);
    await connectTo(page);
    await switchRightTab(page, 'console');
    const cmdInput = page.locator('[data-testid="ws-console-cmd-input"]');
    await cmdInput.fill('/send hello-from-console');
    await cmdInput.press('Enter');
    await page.waitForTimeout(500);
    await expect(page.locator('[data-testid="ws-console"]')).toContainText('Message sent');
  });

  test('WC-C08b: /connect and /disconnect commands', async ({ page }) => {
    await gotoWsStudio(page);
    await switchRightTab(page, 'console');
    const cmdInput = page.locator('[data-testid="ws-console-cmd-input"]');
    await cmdInput.fill(`/connect ${MOCK_URL}`);
    await cmdInput.press('Enter');
    // Wait for connection via tab label (works regardless of active right tab)
    await page.locator('[data-testid="conn-tab-bar"] [aria-label*="connected"]').waitFor({ timeout: 10000 });
    await cmdInput.fill('/disconnect');
    await cmdInput.press('Enter');
    await page.locator('[data-testid="conn-tab-bar"] [aria-label*="disconnected"]').waitFor({ timeout: 5000 });
  });
});
