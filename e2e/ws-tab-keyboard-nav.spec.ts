/**
 * WS Tab Keyboard Navigation — E2E Test Suite
 * Tests: WT-39 through WT-42
 * Covers: Arrow Left/Right, Home/End, Enter/Space, Delete, F2 rename
 * Requires: backend on 3001 (mock WS echo on 9876), Vite on 5173
 *
 * Note: Tauri desktop uses the same web frontend, so these keyboard
 * interactions render identically. Tauri-specific verification can be done
 * via the MCP bridge (`mcp_mcp-server-ta_webview_keyboard`).
 */
import { test, expect, type Page } from '@playwright/test';
import { gotoWsStudio, ensureWsMockServer, getWsTabBar, getWsTabs, getWsAddTabBtn } from './ws-helpers';


/* ── Ensure mock echo server is running ──────────────── */

test.beforeAll(async ({ browser }) => { await ensureWsMockServer(browser); });

/* ── helpers ─────────────────────────────────────────── */

const tabBar = getWsTabBar;
const allTabs = getWsTabs;
const activeTab = (page: Page) => getWsTabBar(page).locator('[role="tab"][aria-selected="true"]');
const addBtn = getWsAddTabBtn;

/** Add N extra tabs (starts with 1 tab, ends with 1+N) */
async function addTabs(page: Page, count: number) {
  for (let i = 0; i < count; i++) {
    await addBtn(page).click();
    await page.waitForTimeout(200);
  }
}

/** Connect the currently active tab to the mock echo server */
async function connectActiveTab(page: Page) {
  const pane = page.locator('[data-testid^="conn-tab-pane-"]:visible');
  await pane.locator('[data-testid="left-tab-connect"]').click();
  await pane.locator('[aria-label="WebSocket URL"]').fill('ws://localhost:9876');
  await pane.locator('[data-testid="connect-btn"]').click();
  try {
    await activeTab(page).filter({ has: page.locator('[title="connected"]') }).waitFor({ timeout: 10000 });
  } catch {
    // Mock server may have been restarted by another worker — restart + retry
    await page.request.post('http://localhost:3001/api/ws/mock/start', {
      data: { port: 9876, rules: [], fallback: 'echo' },
    }).catch(() => {});
    await page.waitForTimeout(500);
    await pane.locator('[data-testid="connect-btn"]').click();
    await activeTab(page).filter({ has: page.locator('[title="connected"]') }).waitFor({ timeout: 10000 });
  }
  await page.waitForTimeout(300);
}

/** Focus the tab at a given 0-based index via Tab key or click+keyboard */
async function focusTabByIndex(page: Page, index: number) {
  const tab = allTabs(page).nth(index);
  await tab.click();
  await page.waitForTimeout(100);
}

/* ── WT-39: Arrow Left/Right with wrap-around + focus ring ── */

test.describe('WT-39: Arrow Left/Right focus navigation', () => {

  test('ArrowRight moves focus to the next tab', async ({ page }) => {
    await gotoWsStudio(page);
    await addTabs(page, 2); // 3 tabs total
    const tabs = allTabs(page);

    // Focus tab 0
    await focusTabByIndex(page, 0);
    await tabs.nth(0).press('ArrowRight');

    // Tab 1 should now be focused
    await expect(tabs.nth(1)).toBeFocused();
  });

  test('ArrowLeft moves focus to the previous tab', async ({ page }) => {
    await gotoWsStudio(page);
    await addTabs(page, 2);
    const tabs = allTabs(page);

    await focusTabByIndex(page, 1);
    await tabs.nth(1).press('ArrowLeft');

    await expect(tabs.nth(0)).toBeFocused();
  });

  test('ArrowRight wraps from last to first tab', async ({ page }) => {
    await gotoWsStudio(page);
    await addTabs(page, 1); // 2 tabs
    const tabs = allTabs(page);

    await focusTabByIndex(page, 1);
    await tabs.nth(1).press('ArrowRight');

    await expect(tabs.nth(0)).toBeFocused();
  });

  test('ArrowLeft wraps from first to last tab', async ({ page }) => {
    await gotoWsStudio(page);
    await addTabs(page, 1);
    const tabs = allTabs(page);

    await focusTabByIndex(page, 0);
    await tabs.nth(0).press('ArrowLeft');

    await expect(tabs.nth(1)).toBeFocused();
  });

  test('focus ring is visible on keyboard navigation', async ({ page }) => {
    await gotoWsStudio(page);
    await addTabs(page, 1);
    const tabs = allTabs(page);

    await focusTabByIndex(page, 0);
    await tabs.nth(0).press('ArrowRight');

    // :focus-visible should produce an outline
    const outline = await tabs.nth(1).evaluate(
      (el) => getComputedStyle(el).outlineStyle,
    );
    expect(outline).not.toBe('none');
  });
});

/* ── WT-40: Enter/Space activates tab; Home/End jump ────── */

test.describe('WT-40: Enter/Space activates, Home/End jumps', () => {

  test('Enter activates the focused tab', async ({ page }) => {
    await gotoWsStudio(page);
    await addTabs(page, 2);
    const tabs = allTabs(page);

    // Focus tab 2 (not active)
    await focusTabByIndex(page, 0);
    await tabs.nth(0).press('ArrowRight');
    await tabs.nth(1).press('ArrowRight');

    // Tab 2 focused but not selected yet
    await expect(tabs.nth(2)).toBeFocused();
    await expect(tabs.nth(2)).not.toHaveAttribute('aria-selected', 'true');

    // Press Enter to activate
    await tabs.nth(2).press('Enter');
    await expect(tabs.nth(2)).toHaveAttribute('aria-selected', 'true');
  });

  test('Space activates the focused tab', async ({ page }) => {
    await gotoWsStudio(page);
    await addTabs(page, 1);
    const tabs = allTabs(page);

    await focusTabByIndex(page, 0);
    await tabs.nth(0).press('ArrowRight');
    await expect(tabs.nth(1)).toBeFocused();

    await tabs.nth(1).press(' ');
    await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
  });

  test('Home jumps to first tab', async ({ page }) => {
    await gotoWsStudio(page);
    await addTabs(page, 2);
    const tabs = allTabs(page);

    await focusTabByIndex(page, 2);
    await tabs.nth(2).press('Home');

    await expect(tabs.nth(0)).toBeFocused();
  });

  test('End jumps to last tab', async ({ page }) => {
    await gotoWsStudio(page);
    await addTabs(page, 2);
    const tabs = allTabs(page);

    await focusTabByIndex(page, 0);
    await tabs.nth(0).press('End');

    await expect(tabs.nth(2)).toBeFocused();
  });
});

/* ── WT-41: Delete key closes tab + auto-focus ──────────── */

test.describe('WT-41: Delete key closes focused tab', () => {

  test('Delete removes the focused tab and focuses the new active', async ({ page }) => {
    await gotoWsStudio(page);
    await addTabs(page, 2); // 3 tabs
    const tabs = allTabs(page);

    // Focus and delete tab 1 (middle)
    await focusTabByIndex(page, 1);
    await tabs.nth(1).press('Delete');

    // Should now have 2 tabs
    await expect(allTabs(page)).toHaveCount(2);

    // A tab should be focused (auto-focus after delete)
    const focusedTab = tabBar(page).locator('[role="tab"]:focus');
    await expect(focusedTab).toHaveCount(1);
  });

  test('Delete on last remaining tab does nothing', async ({ page }) => {
    await gotoWsStudio(page);
    // Only 1 tab — close button shouldn't even render, Delete should be no-op
    const tabs = allTabs(page);
    await expect(tabs).toHaveCount(1);

    await focusTabByIndex(page, 0);
    await tabs.nth(0).press('Delete');

    // Still 1 tab
    await expect(allTabs(page)).toHaveCount(1);
  });

  test('Delete on connected tab shows confirmation and closes on confirm', async ({ page }) => {
    await gotoWsStudio(page);
    await addTabs(page, 1); // 2 tabs
    await connectActiveTab(page);

    const tabs = allTabs(page);
    // The connected tab should have "connected" in aria-label
    const connectedTab = tabs.filter({ hasText: /localhost/ }).first();
    await connectedTab.focus();
    await connectedTab.press('Delete');

    // Confirmation modal appears for connected tabs
    const confirmBtn = page.locator('button', { hasText: 'Close' }).last();
    await expect(confirmBtn).toBeVisible({ timeout: 3000 });
    await confirmBtn.click();

    // Should close — only 1 tab remains
    await expect(allTabs(page)).toHaveCount(1);
  });
});

/* ── WT-42: F2 starts inline rename ─────────────────────── */

test.describe('WT-42: F2 rename on focused tab', () => {

  test('F2 opens inline rename input', async ({ page }) => {
    await gotoWsStudio(page);
    const tabs = allTabs(page);

    await focusTabByIndex(page, 0);
    await tabs.nth(0).press('F2');

    // An input should appear inside the tab
    const renameInput = tabs.nth(0).locator('input');
    await expect(renameInput).toBeVisible();
    await expect(renameInput).toBeFocused();
  });

  test('Enter commits the rename', async ({ page }) => {
    await gotoWsStudio(page);
    const tabs = allTabs(page);

    await focusTabByIndex(page, 0);
    await tabs.nth(0).press('F2');

    const renameInput = tabs.nth(0).locator('input');
    await renameInput.fill('My Test Server');
    await renameInput.press('Enter');

    // Input should disappear, label should update
    await expect(renameInput).not.toBeVisible();
    await expect(tabs.nth(0)).toContainText('My Test Server');
  });

  test('Escape cancels the rename', async ({ page }) => {
    await gotoWsStudio(page);
    const tabs = allTabs(page);

    // Get the original label
    const originalLabel = await tabs.nth(0).innerText();

    await focusTabByIndex(page, 0);
    await tabs.nth(0).press('F2');

    const renameInput = tabs.nth(0).locator('input');
    await renameInput.fill('SHOULD NOT SAVE');
    await renameInput.press('Escape');

    // Input gone, original label preserved
    await expect(renameInput).not.toBeVisible();
    await expect(tabs.nth(0)).toContainText(originalLabel.split('×')[0].trim());
  });

  test('Arrow keys are suppressed during rename', async ({ page }) => {
    await gotoWsStudio(page);
    await addTabs(page, 1);
    const tabs = allTabs(page);

    await focusTabByIndex(page, 0);
    await tabs.nth(0).press('F2');

    const renameInput = tabs.nth(0).locator('input');
    await renameInput.fill('test');

    // ArrowRight should move cursor in input, NOT change tab focus
    await renameInput.press('ArrowRight');
    await expect(renameInput).toBeFocused(); // still in input
    await expect(tabs.nth(1)).not.toBeFocused(); // didn't jump to next tab

    await renameInput.press('Escape');
  });
});
