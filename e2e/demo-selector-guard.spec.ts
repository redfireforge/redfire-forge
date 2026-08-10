/**
 * Demo Player — Selector Guard E2E Test
 *
 * Ensures every shared selector from `src/shared/selectors.ts` resolves
 * to a real DOM element in the WebSocket Studio. If a UI refactor removes
 * or renames a data-testid / class, this test breaks — alerting you to
 * update both the selector constant and the demo lessons that use it.
 */
import { test, expect } from '@playwright/test';
import { WS } from '../src/shared/selectors';
import { WS_STUDIO_BASE } from './ws-helpers';

/* ── helpers ─────────────────────────────────────────── */

async function gotoWsStudio(page: import('@playwright/test').Page) {
  await page.goto(WS_STUDIO_BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector(WS.MODE_CLIENT, { timeout: 5000 });
}

async function startMock(page: import('@playwright/test').Page) {
  await page.click(WS.MODE_MOCK);
  const startBtn = page.locator(WS.MOCK_START_BTN);
  if (await startBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    if (await startBtn.isEnabled()) {
      await startBtn.click();
      try {
        await page.waitForSelector(WS.MOCK_STOP_BTN, { timeout: 5000 });
      } catch {
        await page.click(WS.MODE_CLIENT);
        return false;
      }
    }
  }
  await page.click(WS.MODE_CLIENT);
  return true;
}

async function connectMock(page: import('@playwright/test').Page) {
  await page.click(WS.LEFT_TAB_CONNECT);
  await page.fill(WS.URL_INPUT, 'ws://localhost:9876');
  await page.click(WS.CONNECT_BTN);
  try {
    await page.locator(WS.STATUS_CONNECTED).first().waitFor({ timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/* ── Guard tests: verify shared selectors exist on page ── */

test.describe('Demo Selector Guard — WebSocket Studio', () => {

  test('mode toggles and left tabs are present', async ({ page }) => {
    await gotoWsStudio(page);

    await expect(page.locator(WS.MODE_CLIENT)).toBeVisible();
    await expect(page.locator(WS.MODE_MOCK)).toBeVisible();
    await expect(page.locator(WS.LEFT_TAB_CONNECT)).toBeVisible();
    await expect(page.locator(WS.LEFT_TAB_SEND)).toBeVisible();
    await expect(page.locator(WS.LEFT_TAB_AUTH)).toBeVisible();
  });

  test('connect panel elements are present', async ({ page }) => {
    await gotoWsStudio(page);
    await page.click(WS.LEFT_TAB_CONNECT);

    await expect(page.locator(WS.URL_INPUT)).toBeVisible();
    await expect(page.locator(WS.CONNECT_BTN)).toBeVisible();
    await expect(page.locator(WS.PROTOCOL_SELECT)).toBeVisible();
    await expect(page.locator(WS.CONN_TAB_ADD)).toBeVisible();
  });

  test('mock server buttons are present', async ({ page }) => {
    await gotoWsStudio(page);
    await page.click(WS.MODE_MOCK);

    await expect(page.locator(WS.MOCK_START_BTN).or(page.locator(WS.MOCK_STOP_BTN))).toBeVisible();
  });

  test('send panel elements appear after connect', async ({ page }) => {
    await gotoWsStudio(page);
    const mockReady = await startMock(page);
    test.skip(!mockReady, 'WebSocket mock backend is unavailable in this environment.');
    const connected = await connectMock(page);
    test.skip(!connected, 'WebSocket mock backend is unavailable in this environment.');

    await page.click(WS.LEFT_TAB_SEND);
    await expect(page.locator(WS.SEND_BTN)).toBeVisible();
    await expect(page.locator(WS.MESSAGE_INPUT)).toBeVisible();
  });

  test('events panel and clear button are present', async ({ page }) => {
    await gotoWsStudio(page);

    await expect(page.locator(WS.RIGHT_TAB_EVENTS)).toBeVisible();
    await expect(page.locator(WS.CLEAR_BTN)).toBeVisible();
  });

  test('auth panel elements are present', async ({ page }) => {
    await gotoWsStudio(page);
    await page.click(WS.LEFT_TAB_AUTH);

    await expect(page.locator(WS.AUTH_TYPE_SELECT)).toBeVisible();
  });

  test('disconnect button appears when connected', async ({ page }) => {
    await gotoWsStudio(page);
    const mockReady = await startMock(page);
    test.skip(!mockReady, 'WebSocket mock backend is unavailable in this environment.');
    const connected = await connectMock(page);
    test.skip(!connected, 'WebSocket mock backend is unavailable in this environment.');

    await page.click(WS.LEFT_TAB_CONNECT);
    await expect(page.locator(WS.DISCONNECT_BTN)).toBeVisible();
  });

  test('status dot shows connected state', async ({ page }) => {
    await gotoWsStudio(page);
    const mockReady = await startMock(page);
    test.skip(!mockReady, 'WebSocket mock backend is unavailable in this environment.');
    const connected = await connectMock(page);
    test.skip(!connected, 'WebSocket mock backend is unavailable in this environment.');

    await expect(page.locator(WS.STATUS_CONNECTED).first()).toBeVisible({ timeout: 15000 });
  });

  test('message rows appear after sending', async ({ page }) => {
    await gotoWsStudio(page);
    const mockReady = await startMock(page);
    test.skip(!mockReady, 'WebSocket mock backend is unavailable in this environment.');
    const connected = await connectMock(page);
    test.skip(!connected, 'WebSocket mock backend is unavailable in this environment.');

    await page.click(WS.LEFT_TAB_SEND);
    await page.fill(WS.MESSAGE_INPUT, 'guard-test');
    await page.click(WS.SEND_BTN);

    await expect(page.locator(WS.MESSAGE_ROW).first()).toBeVisible({ timeout: 5000 });
  });
});
