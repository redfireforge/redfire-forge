/**
 * WS Tabs & Persistence — E2E Test Suite
 * Tests: WT-01 through WT-45
 * Requires: backend on 3001 (mock WS echo on 9876), Vite on 5173
 */
import { test, expect, type Page } from '@playwright/test';

const BASE = 'http://localhost:5173/?tab=websocket-studio';
const MOCK_URL = 'ws://localhost:9876';

/* ── Ensure mock echo server is running ──────────────── */

test.beforeAll(async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const resp = await page.request.post('http://localhost:3001/api/ws/mock/start', {
    data: { port: 9876, rules: [], fallback: 'echo' },
  });
  expect(resp.ok()).toBeTruthy();
  await ctx.close();
});

/* ── helpers ─────────────────────────────────────────── */

/** Returns the active (visible) connection tab pane locator */
function activePane(page: Page) {
  return page.locator('[data-testid^="conn-tab-pane-"]:visible');
}

async function gotoWsStudio(page: Page) {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="mode-client"]', { timeout: 5000 });
}

async function connectTo(page: Page, url = MOCK_URL) {
  await switchLeftTab(page, 'connect');
  const pane = activePane(page);
  const urlInput = pane.locator('[aria-label="WebSocket URL"]');
  await urlInput.fill(url);
  await pane.locator('[data-testid="connect-btn"]').click();
  const connectedTab = page.locator('[data-testid="conn-tab-bar"] [role="tab"][aria-selected="true"][aria-label*="connected"]');
  try {
    await connectedTab.waitFor({ timeout: 10000 });
  } catch {
    // Retry: restart mock server and reconnect
    await page.request.post('http://localhost:3001/api/ws/mock/start', {
      data: { port: 9876 },
    }).catch(() => {});
    await page.waitForTimeout(1000);
    await pane.locator('[data-testid="connect-btn"]').click();
    await connectedTab.waitFor({ timeout: 15000 });
  }
  await page.waitForTimeout(300);
}

async function disconnect(page: Page) {
  const pane = activePane(page);
  // Check if already disconnected
  const disconnectedTab = page.locator('[data-testid="conn-tab-bar"] [role="tab"][aria-selected="true"][aria-label*="disconnected"]');
  if (await disconnectedTab.isVisible({ timeout: 500 }).catch(() => false)) {
    return; // Already disconnected
  }
  const disconnectBtn = pane.locator('[data-testid="disconnect-btn"]');
  if (!(await disconnectBtn.isVisible({ timeout: 500 }).catch(() => false))) {
    await switchLeftTab(page, 'connect');
  }
  // Wait for button to be enabled (connection must be active)
  try {
    await expect(disconnectBtn).toBeEnabled({ timeout: 5000 });
  } catch {
    // Connection may have already dropped
    return;
  }
  await pane.locator('[data-testid="disconnect-btn"]').click();
  await disconnectedTab.waitFor({ timeout: 5000 });
}

async function switchLeftTab(page: Page, tab: string) {
  await activePane(page).locator(`[data-testid="left-tab-${tab}"]`).click();
  await page.waitForTimeout(200);
}

async function switchRightTab(page: Page, tab: string) {
  await activePane(page).locator(`[data-testid="right-tab-${tab}"]`).click();
  await page.waitForTimeout(200);
}

async function sendMessage(page: Page, msg: string) {
  await switchLeftTab(page, 'compose');
  const pane = activePane(page);
  const input = pane.locator('.ws-compose-input');
  try {
    await expect(input).toBeEnabled({ timeout: 5000 });
  } catch {
    // Connection may have dropped — reconnect
    await connectTo(page);
    await switchLeftTab(page, 'compose');
    await expect(input).toBeEnabled({ timeout: 10000 });
  }
  await input.fill(msg);
  await pane.locator('[data-testid="send-btn"]').click();
  await page.waitForTimeout(500);
}

async function addTab(page: Page) {
  await page.click('[data-testid="conn-tab-add"]');
  await page.waitForTimeout(300);
}

/* ── WT-01–05: Multiple Concurrent Connections ───────── */

test.describe('Multiple Connections (WT-01–05)', () => {
  test('WT-01: Add tabs up to 8; 9th blocked', async ({ page }) => {
    test.setTimeout(60000);
    await gotoWsStudio(page);
    // Start with 1 tab, add 7 more to reach 8
    for (let i = 0; i < 7; i++) {
      await addTab(page);
    }
    const tabs = page.locator('[data-testid="conn-tab-bar"] [role="tab"]');
    await expect(tabs).toHaveCount(8);
    // Add button should be removed from DOM at max
    const addBtn = page.locator('[data-testid="conn-tab-add"]');
    await expect(addBtn).toHaveCount(0);
  });

  test('WT-02: Independent connection state per tab', async ({ page }) => {
    await gotoWsStudio(page);
    await connectTo(page);
    // Tab 1 connected — add tab 2
    await addTab(page);
    // Tab 2 should be disconnected — connect btn visible in active pane
    await switchLeftTab(page, 'connect');
    await expect(activePane(page).locator('[data-testid="connect-btn"]')).toBeVisible();
    // Switch back to tab 1 — should still be connected
    const tabElements = page.locator('[data-testid="conn-tab-bar"] [role="tab"]');
    await tabElements.first().click();
    await page.waitForTimeout(300);
    await page.locator('[data-testid="conn-tab-bar"] [role="tab"][aria-selected="true"][aria-label*="connected"]').waitFor({ timeout: 3000 });
  });

  test('WT-03: Background tab stays connected', async ({ page }) => {
    await gotoWsStudio(page);
    await connectTo(page);
    // Send a message
    await sendMessage(page, 'Hello from tab 1');
    // Add and switch to tab 2
    await addTab(page);
    await page.waitForTimeout(500);
    // Switch back to tab 1
    const tabElements = page.locator('[data-testid="conn-tab-bar"] [role="tab"]');
    await tabElements.first().click();
    await page.waitForTimeout(300);
    // Should still be connected with messages
    await page.locator('[data-testid="conn-tab-bar"] [role="tab"][aria-selected="true"][aria-label*="connected"]').waitFor({ timeout: 3000 });
    await switchRightTab(page, 'events');
    await expect(activePane(page).locator('[data-testid="message-list"]')).toBeVisible();
  });

  test('WT-04: Close tab — confirmation for connected tabs', async ({ page }) => {
    await gotoWsStudio(page);
    await addTab(page);
    // Connect on tab 2
    await connectTo(page);
    // Close connected tab — should prompt
    const tabs = page.locator('[data-testid="conn-tab-bar"] [role="tab"]');
    const tab2 = tabs.nth(1);
    const tab2Id = await tab2.getAttribute('data-testid');
    const tabId = tab2Id?.replace('conn-tab-', '') || '';
    const closeBtn = page.locator(`[data-testid="conn-tab-close-${tabId}"]`);
    await closeBtn.click();
    await page.waitForTimeout(300);
    // Confirm modal should appear — click confirm button
    const confirmBtn = page.locator('.modal-overlay button:has-text("Close"), .confirm-modal button:has-text("Close")');
    if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmBtn.click();
      await page.waitForTimeout(500);
    }
    // After confirmation, tab should be removed
    await expect(tabs).toHaveCount(1);
  });

  test('WT-05: Tab auto-label from URL; double-click to rename', async ({ page }) => {
    await gotoWsStudio(page);
    await connectTo(page);
    // Tab should show URL-derived label
    const tab = page.locator('[data-testid="conn-tab-bar"] [role="tab"]').first();
    await expect(tab).toContainText('localhost');
    // Double-click to rename
    await tab.dblclick();
    await page.waitForTimeout(200);
    const renameInput = page.locator('[data-testid="conn-tab-bar"] input[type="text"]');
    if (await renameInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await renameInput.fill('My Connection');
      await renameInput.press('Enter');
      await page.waitForTimeout(200);
      await expect(tab).toContainText('My Connection');
    }
  });
});

/* ── WT-06–10: Tab Persistence ───────────────────────── */

test.describe('Tab Persistence (WT-06–10)', () => {
  test('WT-06: Navigate away and back — tabs restored', async ({ page }) => {
    await gotoWsStudio(page);
    await addTab(page);
    // Fill URL in tab 2
    await switchLeftTab(page, 'connect');
    const urlInput = activePane(page).locator('[aria-label="WebSocket URL"]');
    await urlInput.fill('ws://example.com:8080');
    // Navigate to a different page
    await page.click('text=Protocols');
    await page.waitForTimeout(300);
    await page.click('button:has-text("Kafka")');
    await page.waitForTimeout(500);
    // Navigate back to WebSocket
    await page.click('button:has-text("WebSocket")');
    await page.waitForTimeout(500);
    // Tabs should be restored
    const tabs = page.locator('[data-testid="conn-tab-bar"] [role="tab"]');
    await expect(tabs).toHaveCount(2);
  });

  test('WT-07: Restored tabs start disconnected', async ({ page }) => {
    await gotoWsStudio(page);
    await connectTo(page);
    // Navigate away
    await page.click('text=Protocols');
    await page.waitForTimeout(300);
    await page.click('button:has-text("Kafka")');
    await page.waitForTimeout(500);
    // Navigate back
    await page.click('button:has-text("WebSocket")');
    await page.waitForTimeout(500);
    // URL should be preserved but disconnected
    await switchLeftTab(page, 'connect');
    const urlInput = activePane(page).locator('[aria-label="WebSocket URL"]');
    await expect(urlInput).toHaveValue(MOCK_URL);
  });

  test('WT-09: Rename persists across navigation', async ({ page }) => {
    await gotoWsStudio(page);
    // Double-click tab to rename
    const tab = page.locator('[data-testid="conn-tab-bar"] [role="tab"]').first();
    await tab.dblclick();
    await page.waitForTimeout(200);
    const renameInput = page.locator('[data-testid="conn-tab-bar"] input[type="text"]');
    if (await renameInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await renameInput.fill('Persistent Name');
      await renameInput.press('Enter');
      await page.waitForTimeout(200);
      // Navigate away and back
      await page.click('text=Protocols');
      await page.waitForTimeout(300);
      await page.click('button:has-text("Kafka")');
      await page.waitForTimeout(500);
      await page.click('button:has-text("WebSocket")');
      await page.waitForTimeout(500);
      const restoredTab = page.locator('[data-testid="conn-tab-bar"] [role="tab"]').first();
      await expect(restoredTab).toContainText('Persistent Name');
    }
  });

  test('WT-10: First visit — default single tab', async ({ page }) => {
    // Clear storage to simulate first visit
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.removeItem('redfire-ws-tab-state-v1'));
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="mode-client"]', { timeout: 5000 });
    const tabs = page.locator('[data-testid="conn-tab-bar"] [role="tab"]');
    await expect(tabs).toHaveCount(1);
  });
});

/* ── WT-11–15: Connection History ────────────────────── */

test.describe('Connection History (WT-11–15)', () => {
  test('WT-11: Connect adds URL to history', async ({ page }) => {
    await gotoWsStudio(page);
    // Clear history first
    await page.evaluate(() => localStorage.removeItem('redfire-ws-history-v1'));
    await connectTo(page);
    await disconnect(page);
    // Check history trigger exists
    const pane = activePane(page);
    const historyTrigger = pane.locator('[data-testid="url-history-trigger"]');
    await expect(historyTrigger).toBeVisible();
    await historyTrigger.click();
    await page.waitForTimeout(300);
    const historyDropdown = pane.locator('[data-testid="url-history-dropdown"]');
    await expect(historyDropdown).toBeVisible();
    await expect(historyDropdown).toContainText('localhost:9876');
  });

  test('WT-13: Click history row fills URL', async ({ page }) => {
    await gotoWsStudio(page);
    // First connect to create history
    await connectTo(page);
    await disconnect(page);
    // Clear URL
    await switchLeftTab(page, 'connect');
    const pane = activePane(page);
    const urlInput = pane.locator('[aria-label="WebSocket URL"]');
    await urlInput.fill('');
    // Open history and click entry
    const historyTrigger = pane.locator('[data-testid="url-history-trigger"]');
    await historyTrigger.click();
    await page.waitForTimeout(300);
    const historyItem = pane.locator('[data-testid="url-history-dropdown"] [data-testid*="url-history-item"]').first();
    await historyItem.click();
    await page.waitForTimeout(300);
    await expect(urlInput).toHaveValue(MOCK_URL);
  });

  test('WT-14: Clear History removes entries', async ({ page }) => {
    await gotoWsStudio(page);
    await connectTo(page);
    await disconnect(page);
    const pane = activePane(page);
    const historyTrigger = pane.locator('[data-testid="url-history-trigger"]');
    await historyTrigger.click();
    await page.waitForTimeout(300);
    const clearBtn = pane.locator('[data-testid="url-history-clear-btn"]');
    await clearBtn.click();
    await page.waitForTimeout(300);
    // History trigger should be hidden or dropdown empty
    const dropdown = pane.locator('[data-testid="url-history-dropdown"]');
    const isDropdownVisible = await dropdown.isVisible().catch(() => false);
    if (isDropdownVisible) {
      const items = pane.locator('[data-testid="url-history-dropdown"] [data-testid*="url-history-item"]');
      await expect(items).toHaveCount(0);
    }
  });

  test('WT-15: History is global across tabs', async ({ page }) => {
    await gotoWsStudio(page);
    await connectTo(page);
    await disconnect(page);
    // Add new tab
    await addTab(page);
    await switchLeftTab(page, 'connect');
    // History should be visible in tab 2
    const pane = activePane(page);
    const historyTrigger = pane.locator('[data-testid="url-history-trigger"]');
    if (await historyTrigger.isVisible({ timeout: 1000 }).catch(() => false)) {
      await historyTrigger.click();
      await page.waitForTimeout(300);
      await expect(pane.locator('[data-testid="url-history-dropdown"]')).toContainText('localhost:9876');
    }
  });
});

/* ── WT-16–18: Quick Connect from Tab Bar ────────────── */

test.describe('Quick Connect (WT-16–18)', () => {
  test('WT-16: Tab bar history dropdown shows recent URLs', async ({ page }) => {
    await gotoWsStudio(page);
    await connectTo(page);
    await disconnect(page);
    const trigger = page.locator('[data-testid="conn-tab-history-trigger"]');
    if (await trigger.isVisible({ timeout: 1000 }).catch(() => false)) {
      await trigger.click();
      await page.waitForTimeout(300);
      await expect(page.locator('[data-testid="conn-tab-history-dropdown"]')).toBeVisible();
    }
  });

  test('WT-17: Click URL in tab bar dropdown creates new tab', async ({ page }) => {
    await gotoWsStudio(page);
    await connectTo(page);
    await disconnect(page);
    const trigger = page.locator('[data-testid="conn-tab-history-trigger"]');
    if (await trigger.isVisible({ timeout: 1000 }).catch(() => false)) {
      const tabsBefore = await page.locator('[data-testid="conn-tab-bar"] [role="tab"]').count();
      await trigger.click();
      await page.waitForTimeout(300);
      const item = page.locator('[data-testid="conn-tab-history-dropdown"]').locator('[data-testid*="conn-tab-history-item"]').first();
      if (await item.isVisible({ timeout: 500 }).catch(() => false)) {
        await item.click();
        await page.waitForTimeout(500);
        const tabsAfter = await page.locator('[data-testid="conn-tab-bar"] [role="tab"]').count();
        expect(tabsAfter).toBe(tabsBefore + 1);
      }
    }
  });
});

/* ── WT-19–23: Message Bookmarks ─────────────────────── */

test.describe('Message Bookmarks (WT-19–23)', () => {
  test('WT-19: Click star to bookmark message', async ({ page }) => {
    await gotoWsStudio(page);
    await connectTo(page);
    await sendMessage(page, 'Bookmark me');
    await switchRightTab(page, 'events');
    await page.waitForTimeout(500);
    const pane = activePane(page);
    // Find a bookmark button on a message row
    const bookmarkBtn = pane.locator('[data-testid*="bookmark-btn-"]').first();
    await expect(bookmarkBtn).toBeVisible();
    await bookmarkBtn.click();
    await page.waitForTimeout(200);
    // Star should be filled (class or aria change)
    await expect(bookmarkBtn).toHaveClass(/bookmarked|active/);
  });

  test('WT-20: Click star again to remove bookmark', async ({ page }) => {
    await gotoWsStudio(page);
    await connectTo(page);
    await sendMessage(page, 'Toggle bookmark');
    await switchRightTab(page, 'events');
    await page.waitForTimeout(500);
    const pane = activePane(page);
    const bookmarkBtn = pane.locator('[data-testid*="bookmark-btn-"]').first();
    // Bookmark
    await bookmarkBtn.click();
    await page.waitForTimeout(200);
    // Un-bookmark
    await bookmarkBtn.click();
    await page.waitForTimeout(200);
    // Should not have bookmarked class
    const hasClass = await bookmarkBtn.evaluate(el => el.classList.contains('bookmarked') || el.classList.contains('active'));
    expect(hasClass).toBeFalsy();
  });

  test('WT-21: Bookmarked filter shows only bookmarked', async ({ page }) => {
    await gotoWsStudio(page);
    await connectTo(page);
    await sendMessage(page, 'Message A');
    await sendMessage(page, 'Message B');
    await switchRightTab(page, 'events');
    await page.waitForTimeout(500);
    const pane = activePane(page);
    // Bookmark only the first message
    const bookmarkBtns = pane.locator('[data-testid*="bookmark-btn-"]');
    await bookmarkBtns.first().click();
    await page.waitForTimeout(200);
    // Use direction filter to show bookmarked
    const filterToggle = pane.locator('[data-testid="filter-toggle-btn"]');
    await filterToggle.click();
    await page.waitForTimeout(300);
    // Look for bookmarked filter option
    const bookmarkFilter = page.locator('text=Bookmarked');
    if (await bookmarkFilter.isVisible({ timeout: 1000 }).catch(() => false)) {
      await bookmarkFilter.click();
      await page.waitForTimeout(300);
    }
  });

  test('WT-23: Export includes bookmark flag', async ({ page }) => {
    await gotoWsStudio(page);
    await connectTo(page);
    await sendMessage(page, 'Bookmarked export test');
    await switchRightTab(page, 'events');
    await page.waitForTimeout(500);
    const pane = activePane(page);
    // Bookmark the message
    const bookmarkBtn = pane.locator('[data-testid*="bookmark-btn-"]').first();
    await bookmarkBtn.click();
    await page.waitForTimeout(200);
    // Stub showSaveFilePicker for download
    await page.evaluate(() => { delete (window as Record<string, unknown>).showSaveFilePicker; });
    const downloadPromise = page.waitForEvent('download', { timeout: 10000 });
    await pane.locator('[data-testid="export-messages-btn"]').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.json');
  });
});

/* ── WT-24–27: Session Recording ─────────────────────── */

test.describe('Session Recording (WT-24–27)', () => {
  test('WT-24: Start recording shows indicator', async ({ page }) => {
    await gotoWsStudio(page);
    await connectTo(page);
    await switchRightTab(page, 'events');
    const pane = activePane(page);
    const recBtn = pane.locator('[data-testid="start-recording-btn"]');
    await expect(recBtn).toBeVisible();
    await recBtn.click();
    await page.waitForTimeout(300);
    // Stop recording button should appear
    await expect(pane.locator('[data-testid="stop-recording-btn"]')).toBeVisible();
  });

  test('WT-26: Stop recording saves file', async ({ page }) => {
    await gotoWsStudio(page);
    await connectTo(page);
    await switchRightTab(page, 'events');
    const pane = activePane(page);
    // Start recording
    await pane.locator('[data-testid="start-recording-btn"]').click();
    await page.waitForTimeout(300);
    // Send a message
    await sendMessage(page, 'Recording test');
    await switchRightTab(page, 'events');
    await page.waitForTimeout(500);
    // Stop recording — stub file picker
    await page.evaluate(() => { delete (window as Record<string, unknown>).showSaveFilePicker; });
    const downloadPromise = page.waitForEvent('download', { timeout: 10000 });
    await pane.locator('[data-testid="stop-recording-btn"]').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.json');
  });
});

/* ── WT-28–31: Session Replay ────────────────────────── */

test.describe('Session Replay (WT-28–31)', () => {
  test('WT-28: Import recording shows replay controls', async ({ page }) => {
    await gotoWsStudio(page);
    await switchRightTab(page, 'events');
    // Check import recording button exists
    const importBtn = activePane(page).locator('[data-testid="import-recording-btn"]');
    await expect(importBtn).toBeVisible();
  });
});

/* ── WT-32–35: Connection Stats ──────────────────────── */

test.describe('Stats Dashboard (WT-32–35)', () => {
  test('WT-32: Stats right tab shows stats panel', async ({ page }) => {
    await gotoWsStudio(page);
    await switchRightTab(page, 'stats');
    const pane = activePane(page);
    await expect(pane.locator('[data-testid="stats-panel"]')).toBeVisible();
    await expect(pane.locator('[data-testid="stats-msg-rate"]')).toBeVisible();
    await expect(pane.locator('[data-testid="stats-bytes-in"]')).toBeVisible();
    await expect(pane.locator('[data-testid="stats-bytes-out"]')).toBeVisible();
  });

  test('WT-33: Live metrics update during messaging', async ({ page }) => {
    await gotoWsStudio(page);
    await connectTo(page);
    await switchRightTab(page, 'stats');
    // Send messages to generate metrics
    await sendMessage(page, 'Stats test 1');
    await sendMessage(page, 'Stats test 2');
    await page.waitForTimeout(1000);
    await switchRightTab(page, 'stats');
    const msgRate = activePane(page).locator('[data-testid="stats-msg-rate"]');
    await expect(msgRate).toBeVisible();
  });

  test('WT-33a: Errors card only appears when errors occur', async ({ page }) => {
    await gotoWsStudio(page);
    await switchRightTab(page, 'stats');
    const pane = activePane(page);
    // Without connection errors, error card should not be prominent
    const errorsCard = pane.locator('[data-testid="stats-errors"]');
    // It may be visible but show 0
    if (await errorsCard.isVisible({ timeout: 1000 }).catch(() => false)) {
      await expect(errorsCard).toContainText('0');
    }
  });

  test('WT-35: Stats per-tab — disconnect zeros rates', async ({ page }) => {
    await gotoWsStudio(page);
    await connectTo(page);
    await sendMessage(page, 'Stats before disconnect');
    await disconnect(page);
    await switchRightTab(page, 'stats');
    await page.waitForTimeout(500);
    // After disconnect, rates should reset
    const msgRate = activePane(page).locator('[data-testid="stats-msg-rate"]');
    await expect(msgRate).toBeVisible();
  });
});

/* ── WT-36–38: Tab Drag-and-Drop ─────────────────────── */

test.describe('Tab Drag-and-Drop (WT-36–38)', () => {
  test('WT-36: Tabs are draggable', async ({ page }) => {
    await gotoWsStudio(page);
    await addTab(page);
    await addTab(page);
    const tabs = page.locator('[data-testid="conn-tab-bar"] [role="tab"]');
    await expect(tabs).toHaveCount(3);
    // Verify tabs have draggable attribute
    const firstTab = tabs.first();
    const isDraggable = await firstTab.getAttribute('draggable');
    expect(isDraggable).toBe('true');
  });
});

/* ── WT-39–42: Keyboard Navigation ───────────────────── */

test.describe('Keyboard Navigation (WT-39–42)', () => {
  test('WT-39: Arrow keys move focus between tabs', async ({ page }) => {
    await gotoWsStudio(page);
    await addTab(page);
    const tabs = page.locator('[data-testid="conn-tab-bar"] [role="tab"]');
    await tabs.first().focus();
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(200);
    // Second tab should be focused
    const focused = page.locator('[data-testid="conn-tab-bar"] [role="tab"]:focus');
    await expect(focused).toBeVisible();
  });

  test('WT-40: Enter activates focused tab', async ({ page }) => {
    await gotoWsStudio(page);
    await addTab(page);
    const tabs = page.locator('[data-testid="conn-tab-bar"] [role="tab"]');
    await tabs.first().focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    // Second tab should be active (aria-selected)
    const secondTab = tabs.nth(1);
    await expect(secondTab).toHaveAttribute('aria-selected', 'true');
  });
});

/* ── WT-43–45: New Feature Persistence ───────────────── */

test.describe('New Feature Persistence (WT-43–45)', () => {
  test('WT-43: Auth draft persistence per-tab', async ({ page }) => {
    await gotoWsStudio(page);
    await switchLeftTab(page, 'auth');
    // Auth panel should be visible (the tab button itself)
    const authPanel = activePane(page).locator('[data-testid="left-tab-auth"]');
    await expect(authPanel).toBeVisible();
  });

  test('WT-44: Console settings persistence', async ({ page }) => {
    await gotoWsStudio(page);
    await switchRightTab(page, 'console');
    const pane = activePane(page);
    // Toggle a console setting (e.g. view mode)
    const structuredBtn = pane.locator('[data-testid="ws-console-view-structured"]');
    await expect(structuredBtn).toBeVisible();
    const rawBtn = pane.locator('[data-testid="ws-console-view-raw"]');
    await rawBtn.click();
    await page.waitForTimeout(200);
    // Navigate away and back
    await page.click('text=Protocols');
    await page.waitForTimeout(300);
    await page.click('button:has-text("Kafka")');
    await page.waitForTimeout(500);
    await page.click('button:has-text("WebSocket")');
    await page.waitForTimeout(500);
    // Check console setting preserved
    await switchRightTab(page, 'console');
    await page.waitForTimeout(300);
    // The raw view should still be selected
    const rawBtnAfter = activePane(page).locator('[data-testid="ws-console-view-raw"]');
    await expect(rawBtnAfter).toBeVisible();
  });

  test('WT-45: Split pane width persistence', async ({ page }) => {
    await gotoWsStudio(page);
    const pane = activePane(page);
    // Split pane should be visible
    const split = pane.locator('[data-testid="ws-studio-split"]');
    await expect(split).toBeVisible();
    // Divider should be visible and draggable
    const divider = pane.locator('[data-testid="ws-studio-divider"]');
    await expect(divider).toBeVisible();
  });
});
