/**
 * WS Tab Drag-and-Drop Reorder — E2E Test Suite
 * Tests: WT-36 through WT-38
 * Covers: drag reorder, visual indicators, persistence across navigation
 * Requires: backend on 3001 (mock WS echo on 9876), Vite on 5173
 */
import { test, expect, type Page } from '@playwright/test';

const BASE = 'http://localhost:5173/?tab=websocket-studio';

/* ── helpers ─────────────────────────────────────────── */

const tabBar = (page: Page) => page.locator('[data-testid="conn-tab-bar"]');
const allTabs = (page: Page) => tabBar(page).locator('[role="tab"]');
const addBtn = (page: Page) => page.locator('[data-testid="conn-tab-add"]');

async function gotoWsStudio(page: Page) {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="mode-client"]', { timeout: 5000 });
}

async function addTabs(page: Page, count: number) {
  for (let i = 0; i < count; i++) {
    await addBtn(page).click();
    await page.waitForTimeout(200);
  }
}

/** Rename a tab via double-click for identification */
async function renameTab(page: Page, index: number, name: string) {
  const tab = allTabs(page).nth(index);
  await tab.dblclick();
  await page.waitForTimeout(100);
  const input = tab.locator('input');
  await input.fill(name);
  await input.press('Enter');
  await page.waitForTimeout(200);
}

/** Get ordered tab labels */
async function getTabLabels(page: Page): Promise<string[]> {
  const tabs = allTabs(page);
  const count = await tabs.count();
  const labels: string[] = [];
  for (let i = 0; i < count; i++) {
    // Get innerText but strip the close button × character
    const text = await tabs.nth(i).innerText();
    labels.push(text.replace(/×/g, '').trim());
  }
  return labels;
}

/** Drag tab from one index to another using Playwright's drag API */
async function dragTab(page: Page, fromIndex: number, toIndex: number) {
  const fromTab = allTabs(page).nth(fromIndex);
  const toTab = allTabs(page).nth(toIndex);

  const fromBox = await fromTab.boundingBox();
  const toBox = await toTab.boundingBox();
  if (!fromBox || !toBox) throw new Error('Could not get tab bounding boxes');

  // Drag from center of source to the left edge of target (to insert before)
  // or right edge (to insert after)
  const fromX = fromBox.x + fromBox.width / 2;
  const fromY = fromBox.y + fromBox.height / 2;
  const toX = fromIndex < toIndex
    ? toBox.x + toBox.width * 0.75  // Drop on right side → after
    : toBox.x + toBox.width * 0.25; // Drop on left side → before
  const toY = toBox.y + toBox.height / 2;

  await page.mouse.move(fromX, fromY);
  await page.mouse.down();
  await page.waitForTimeout(100);

  // Move in steps for drag events to fire
  const steps = 5;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(
      fromX + (toX - fromX) * (i / steps),
      fromY + (toY - fromY) * (i / steps),
    );
    await page.waitForTimeout(50);
  }

  await page.mouse.up();
  await page.waitForTimeout(300);
}

/* ── WT-36: Drag tab to new position ────────────────────── */

test.describe('WT-36: Drag tab reorder', () => {

  test('tabs are draggable', async ({ page }) => {
    await gotoWsStudio(page);
    await addTabs(page, 2); // 3 tabs

    const tabs = allTabs(page);
    for (let i = 0; i < 3; i++) {
      await expect(tabs.nth(i)).toHaveAttribute('draggable', 'true');
    }
  });

  test('drag tab from position 0 to position 2 reorders', async ({ page }) => {
    await gotoWsStudio(page);
    await addTabs(page, 2); // 3 tabs

    // Rename tabs for identification
    await renameTab(page, 0, 'Alpha');
    await renameTab(page, 1, 'Beta');
    await renameTab(page, 2, 'Gamma');

    const before = await getTabLabels(page);
    expect(before).toEqual(['Alpha', 'Beta', 'Gamma']);

    // Drag Alpha (0) to after Gamma (2)
    await dragTab(page, 0, 2);

    const after = await getTabLabels(page);
    // Alpha should have moved to the end
    expect(after[0]).not.toBe('Alpha');
    expect(after).toContain('Alpha');
    expect(after).toContain('Beta');
    expect(after).toContain('Gamma');
  });

  test('drag tab from position 2 to position 0 reorders', async ({ page }) => {
    await gotoWsStudio(page);
    await addTabs(page, 2);

    await renameTab(page, 0, 'First');
    await renameTab(page, 1, 'Second');
    await renameTab(page, 2, 'Third');

    // Drag Third (2) to before First (0)
    await dragTab(page, 2, 0);

    const after = await getTabLabels(page);
    expect(after[0]).toBe('Third');
  });
});

/* ── WT-37: Visual drag indicators ──────────────────────── */

test.describe('WT-37: Drag visual indicators', () => {

  test('dragged tab has reduced opacity', async ({ page }) => {
    await gotoWsStudio(page);
    await addTabs(page, 1); // 2 tabs

    const firstTab = allTabs(page).nth(0);
    const secondTab = allTabs(page).nth(1);

    const fromBox = await firstTab.boundingBox();
    const toBox = await secondTab.boundingBox();
    if (!fromBox || !toBox) throw new Error('No bounding box');

    // Start drag
    await page.mouse.move(fromBox.x + fromBox.width / 2, fromBox.y + fromBox.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(100);

    // Move to trigger dragstart
    await page.mouse.move(toBox.x + toBox.width / 2, toBox.y + toBox.height / 2, { steps: 3 });
    await page.waitForTimeout(200);

    // Check that the dragging class is applied (opacity: 0.4)
    const hasDraggingClass = await firstTab.evaluate(
      (el) => el.classList.contains('ws-conn-tab-dragging'),
    );
    expect(hasDraggingClass).toBe(true);

    await page.mouse.up();
  });
});

/* ── WT-38: Tab order persists after navigation ─────────── */

test.describe('WT-38: Tab order persisted', () => {
  test.describe.configure({ timeout: 90_000 });

  test('reordered tabs survive navigation away and back', async ({ page }) => {
    await gotoWsStudio(page);
    await addTabs(page, 2);

    // Name them for tracking
    await renameTab(page, 0, 'Persist-A');
    await renameTab(page, 1, 'Persist-B');
    await renameTab(page, 2, 'Persist-C');

    // Drag C to first position
    await dragTab(page, 2, 0);
    await page.waitForTimeout(500); // Wait for debounced save

    const afterDrag = await getTabLabels(page);
    expect(afterDrag[0]).toBe('Persist-C');

    // Navigate away
    await page.goto('http://localhost:5173/?tab=kafka', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    // Navigate back
    await gotoWsStudio(page);
    await page.waitForTimeout(500);

    // Verify order is preserved
    const afterNav = await getTabLabels(page);
    expect(afterNav[0]).toBe('Persist-C');
    expect(afterNav).toContain('Persist-A');
    expect(afterNav).toContain('Persist-B');
  });
});
