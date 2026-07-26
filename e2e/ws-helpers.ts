/**
 * Shared WebSocket Studio E2E helpers.
 *
 * Extracted from ws-core-connect, ws-mock-server, ws-multi-mock-investigate,
 * ws-protocols-console, ws-protocols-graphql, ws-protocols-socketio, and
 * demo-selector-guard to eliminate copy-paste duplication.
 */
import { expect, type Page, type Browser } from '@playwright/test';

export const WS_STUDIO_BASE = 'http://localhost:5173/?tab=websocket-studio';
export const WS_DEFAULT_MOCK_PORT = 9876;
export const WS_DEFAULT_MOCK_URL = `ws://localhost:${WS_DEFAULT_MOCK_PORT}`;

/** Navigate to the WebSocket Studio tab and wait for the mode selector. */
export async function gotoWsStudio(page: Page, opts?: { timeout?: number }): Promise<void> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      await page.goto(WS_STUDIO_BASE, { waitUntil: 'networkidle' });
      break;
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('ERR_CONNECTION_REFUSED') || attempt === 5) {
        throw error;
      }
      await page.waitForTimeout(1_000);
    }
  }
  if (lastError && page.url() !== WS_STUDIO_BASE) {
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }
  await page.waitForSelector('[data-testid="mode-client"]', { timeout: opts?.timeout ?? 8000 });
}

/** Switch the active connection pane to a mode (client / mock / saved). */
export async function switchWsMode(page: Page, mode: 'client' | 'mock' | 'saved'): Promise<void> {
  await page.click(`[data-testid="mode-${mode}"]`);
  await page.waitForTimeout(300);
}

/** Click a left-panel tab (connect / headers / send / auth / templates). */
export async function switchWsLeftTab(page: Page, tab: string): Promise<void> {
  await page.click(`[data-testid="left-tab-${tab}"]`);
  await page.waitForTimeout(200);
}

/** Click a right-panel tab (console / filters / diff / etc.). */
export async function switchWsRightTab(page: Page, tab: string): Promise<void> {
  await page.click(`[data-testid="right-tab-${tab}"]`);
  await page.waitForTimeout(200);
}

/**
 * Connect to a WebSocket URL.
 * Retries once if the initial wait times out (mock server may have been
 * stopped by a parallel spec — restarts it and tries again).
 */
export async function connectWsTo(
  page: Page,
  url = WS_DEFAULT_MOCK_URL,
  mockPort = WS_DEFAULT_MOCK_PORT,
): Promise<void> {
  await switchWsLeftTab(page, 'connect');
  const urlInput = page.locator('[aria-label="WebSocket URL"]');
  await urlInput.fill(url);
  await page.click('[data-testid="connect-btn"]');
  const connected = page.locator('[data-testid="conn-tab-bar"] [aria-label*="connected"]');
  try {
    await connected.waitFor({ timeout: 8000 });
  } catch {
    // Mock server may have been stopped by a parallel spec — restart and retry
    await page.request.post('http://localhost:3001/api/ws/mock/start', {
      data: { port: mockPort },
    }).catch(() => {});
    await page.waitForTimeout(500);
    await page.click('[data-testid="connect-btn"]');
    await connected.waitFor({ timeout: 10000 });
  }
  await page.waitForTimeout(300);
}

/** Wait until the connect tab status bar shows a connected state. */
export async function waitForWsConnected(page: Page, opts?: { timeout?: number }): Promise<void> {
  await expect(page.locator('[data-testid="status-badge"]')).toContainText(/connected/i, {
    timeout: opts?.timeout ?? 10_000,
  });
}

/** Disconnect from the current WebSocket connection. */
export async function disconnectWs(page: Page): Promise<void> {
  const disconnectBtn = page.locator('[data-testid="disconnect-btn"]');
  if (!(await disconnectBtn.isVisible({ timeout: 500 }).catch(() => false))) {
    await switchWsLeftTab(page, 'connect');
  }
  await disconnectBtn.click();
  await page.locator('[data-testid="conn-tab-bar"] [aria-label*="disconnected"]').waitFor({ timeout: 5000 });
}

/**
 * Type and send a WebSocket message via the compose panel.
 * Reconnects automatically if the compose input is not enabled.
 */
export async function sendWsMessage(page: Page, msg: string): Promise<void> {
  await switchWsLeftTab(page, 'send');
  const input = page.locator('.ws-compose-input');
  try {
    await expect(input).toBeEnabled({ timeout: 5000 });
  } catch {
    await connectWsTo(page);
    await switchWsLeftTab(page, 'send');
    await expect(input).toBeEnabled({ timeout: 10000 });
  }
  await input.fill(msg);
  await page.click('[data-testid="send-btn"]');
  await page.waitForTimeout(500);
}

/**
 * Start the mock WS server via the backend helper API.
 * Optionally stops any existing server on that port first.
 */
export async function startWsMockViaApi(page: Page, port = WS_DEFAULT_MOCK_PORT): Promise<void> {
  await page.request.post('http://localhost:3001/api/ws/mock/start', {
    data: { port },
  }).catch(() => {});
  await page.waitForTimeout(500);
}

/** Stop the mock WS server via the backend helper API. */
export async function stopWsMockViaApi(page: Page, port = WS_DEFAULT_MOCK_PORT): Promise<void> {
  await page.request.post('http://localhost:3001/api/ws/mock/stop', {
    data: { port },
  }).catch(() => {});
}

/**
 * Start the mock server from within the Mock mode UI.
 * Switches to mock mode, stops any running server, then starts fresh.
 */
export async function startWsMockFromUI(page: Page): Promise<void> {
  const stopBtn = page.locator('[data-testid="mock-stop-btn"]');
  if (await stopBtn.isVisible({ timeout: 500 }).catch(() => false)) {
    await stopBtn.click();
    await page.waitForTimeout(500);
  }
  await page.click('[data-testid="mock-start-btn"]');
  await page.waitForTimeout(1000);
  await expect(page.locator('[data-testid="mock-status-label"]')).toContainText(/running/i, { timeout: 5000 });
}

/** Stop the mock server from within the Mock mode UI (if running). */
export async function stopWsMockFromUI(page: Page): Promise<void> {
  const stopBtn = page.locator('[data-testid="mock-stop-btn"]');
  if (await stopBtn.isVisible({ timeout: 500 }).catch(() => false)) {
    await stopBtn.click();
    await page.waitForTimeout(500);
  }
}

/**
 * Reset mock server to a stopped state (UI + backend API).
 * Stops common mock ports used across WS E2E specs.
 */
export async function ensureWsMockStopped(page: Page, ports: number[] = [WS_DEFAULT_MOCK_PORT, 9877, 9878]): Promise<void> {
  for (const port of ports) {
    await page.request.post('http://localhost:3001/api/ws/mock/stop', { data: { port } }).catch(() => {});
  }
  await stopWsMockFromUI(page);
  await page.waitForTimeout(400);
}

/**
 * Shared `beforeAll` helper: ensures the WS mock echo server is running on the
 * given port. Call from `test.beforeAll` in any spec that needs the mock server.
 *
 * @example
 * test.beforeAll(async ({ browser }) => { await ensureWsMockServer(browser); });
 */
export async function ensureWsMockServer(
  browser: Browser,
  port = WS_DEFAULT_MOCK_PORT,
): Promise<void> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const resp = await page.request.post('http://localhost:3001/api/ws/mock/start', {
    data: { port, rules: [], fallback: 'echo' },
  });
  expect(resp.ok()).toBeTruthy();
  await ctx.close();
}

/** Returns the active (visible) WebSocket connection pane locator. */
export function getActiveWsPane(page: Page) {
  return page.locator('[data-testid^="conn-tab-pane-"]:visible');
}

/** Returns the WS tab bar locator. */
export function getWsTabBar(page: Page) {
  return page.locator('[data-testid="conn-tab-bar"]');
}

/** Returns all WS connection tab locators. */
export function getWsTabs(page: Page) {
  return getWsTabBar(page).locator('[role="tab"]');
}

/** Returns the "add tab" button locator in the WS tab bar. */
export function getWsAddTabBtn(page: Page) {
  return page.locator('[data-testid="conn-tab-add"]');
}
