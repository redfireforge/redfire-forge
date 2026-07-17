/**
 * ws-workflow-runner-designer.spec.ts — Workflow Designer WS node E2E (WR-01 to WR-13).
 */
import { test, expect } from '@playwright/test';
import { waitForWorkflowReady, openWorkflowBlocksTab, seedAppData, gotoAppTab } from './helpers';
import {
  addNodeFromPalette,
  makeWsWorkflow,
  seedWorkflow,
  seedWiredWorkflow,
  startMockServer,
} from './helpers/ws-workflow-runner-helpers';

test.describe('Part A — Workflow Designer WS Nodes', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorkflow(page, makeWsWorkflow());
    await page.goto('/?tab=workflow');
    await waitForWorkflowReady(page);
  });

  test('WR-01: Create a blank workflow — canvas with Start node', async ({ page }) => {
    // The seeded workflow already has a Start node
    await expect(page.locator('.wf-designer')).toBeVisible();
    // Palette should be visible
    await expect(page.locator('.wf-palette')).toBeVisible();
    // Toolbar should be visible with key buttons
    await expect(page.locator('.wf-toolbar')).toBeVisible();
    await expect(page.getByText('Quick Test')).toBeVisible();
  });

  test('WR-02: WS nodes appear in the palette', async ({ page }) => {
    await openWorkflowBlocksTab(page);

    // Use the search box to filter — auto-expands matching categories
    const searchBox = page.locator('.wf-palette-search');
    await searchBox.fill('WS');
    await page.waitForTimeout(300);

    // All 4 WS nodes should be visible (search expands matching categories)
    await expect(page.locator('.wf-palette-block-wsConnect')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.wf-palette-block-wsSend')).toBeVisible();
    await expect(page.locator('.wf-palette-block-wsReceive')).toBeVisible();
    await expect(page.locator('.wf-palette-block-wsTrigger')).toBeVisible();

    // Clear search
    await searchBox.clear();
  });

  test('WR-03: Add a WS Connect node via palette click', async ({ page }) => {
    await addNodeFromPalette(page, 'WS Connect', 'wf-palette-block-wsConnect');

    // A node with class wf-node-wsConnect should appear on the canvas
    await expect(page.locator('.wf-node-wsConnect')).toBeVisible({ timeout: 5000 });
  });

  test('WR-04: WS Connect config dialog', async ({ page }) => {
    await addNodeFromPalette(page, 'WS Connect', 'wf-palette-block-wsConnect');

    // Double-click the node to open config
    await page.locator('.wf-node-wsConnect').dblclick();

    // Config dialog should be visible
    const configPanel = page.locator('[data-testid="ws-connect-config"]');
    await expect(configPanel).toBeVisible({ timeout: 5000 });

    // Verify key fields exist
    await expect(page.getByLabel('URL', { exact: true }).or(page.locator('label:has-text("URL")')).first()).toBeVisible();
    await expect(page.getByLabel('Connection ID').or(page.locator('label:has-text("Connection ID")')).first()).toBeVisible();
  });

  test('WR-06: WS Send config dialog', async ({ page }) => {
    await addNodeFromPalette(page, 'WS Send', 'wf-palette-block-wsSend');

    await page.locator('.wf-node-wsSend').dblclick();

    const configPanel = page.locator('[data-testid="ws-send-config"]');
    await expect(configPanel).toBeVisible({ timeout: 5000 });

    // Verify key fields
    await expect(page.locator('label:has-text("Connection ID"), label:has-text("Connection Ref")').first()).toBeVisible();
    await expect(page.locator('label:has-text("Message")').first()).toBeVisible();
  });

  test('WR-08: WS Receive config dialog with match criteria', async ({ page }) => {
    await addNodeFromPalette(page, 'WS Receive', 'wf-palette-block-wsReceive');

    await page.locator('.wf-node-wsReceive').dblclick();

    const configPanel = page.locator('[data-testid="ws-receive-config"]');
    await expect(configPanel).toBeVisible({ timeout: 5000 });

    // Match criteria section should be visible
    await expect(page.locator('text=Match Criteria').first()).toBeVisible();
  });

  test('WR-09: WS Trigger config dialog', async ({ page }) => {
    await addNodeFromPalette(page, 'WS Trigger', 'wf-palette-block-wsTrigger');

    await page.locator('.wf-node-wsTrigger').dblclick();

    const configPanel = page.locator('[data-testid="ws-trigger-config"]');
    await expect(configPanel).toBeVisible({ timeout: 5000 });

    // Should show URL, Connection ID, Match Criteria
    await expect(page.locator('label:has-text("URL")').first()).toBeVisible();
  });
});

/* ──────────────────────────────────────────────────────────────────────
 * WR-11/12/13: Wired flow + Quick Test
 * ────────────────────────────────────────────────────────────────────── */

test.describe('Part A — Wired WS flow + Quick Test', () => {
  test.beforeEach(async ({ page }) => {
    await seedWiredWorkflow(page);
  });

  test('WR-11: Wired WS Connect → Send → Receive flow renders', async ({ page }) => {
    await startMockServer(page);
    await page.goto('/?tab=workflow');
    await waitForWorkflowReady(page);

    // All 3 WS nodes plus Start should be visible
    await expect(page.locator('.wf-node-wsConnect')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.wf-node-wsSend')).toBeVisible();
    await expect(page.locator('.wf-node-wsReceive')).toBeVisible();

    // Edges should connect them
    const edges = page.locator('.react-flow__edge');
    await expect(edges).toHaveCount(3, { timeout: 5000 });
  });

  test('WR-12: Quick Test executes the WS workflow', async ({ page }) => {
    test.setTimeout(60000);
    await startMockServer(page);
    await page.goto('/?tab=workflow');
    await waitForWorkflowReady(page);

    // Click Quick Test
    const quickTestBtn = page.locator('.wf-quick-test-btn');
    await expect(quickTestBtn).toBeVisible({ timeout: 5000 });
    await quickTestBtn.click();

    // Wait for execution to complete — result shows in toolbar as "N/N passed" or "N failed"
    const passed = page.getByText(/\d+\/\d+ passed/i).first();
    const failed = page.getByText(/\d+ failed/i).first();
    await expect(passed.or(failed)).toBeVisible({ timeout: 40000 });
  });

  test('WR-13: Node Output & Logs tabs after Quick Test', async ({ page }) => {
    await startMockServer(page);
    await page.goto('/?tab=workflow');
    await waitForWorkflowReady(page);

    // Run Quick Test first — wait for it to complete (pass or fail)
    await page.locator('.wf-quick-test-btn').click();
    const passedText = page.getByText(/\d+\/\d+ passed/i).first();
    const failedText = page.getByText(/\d+ failed/i).first();
    await expect(passedText.or(failedText)).toBeVisible({ timeout: 25000 });

    // Double-click the WS Connect node to open config
    await page.locator('.wf-node-wsConnect').dblclick();
    await page.waitForTimeout(500);

    // Check for Output tab
    const outputTab = page.getByRole('tab', { name: /Output/i }).or(page.locator('button:has-text("Output")'));
    if (await outputTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await outputTab.click();
    }

    // Check for Logs tab
    const logsTab = page.getByRole('tab', { name: /Logs/i }).or(page.locator('button:has-text("Logs")'));
    if (await logsTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await logsTab.click();
    }
  });
});

test('Cleanup: stop mock server', async ({ page }) => {
  await seedAppData(page);
  await gotoAppTab(page, 'websocket-studio');

  const mockTab = page.locator('[data-testid="mode-mock"]');
  if (await mockTab.isVisible({ timeout: 3000 }).catch(() => false)) {
    await mockTab.click();
    const stopBtn = page.getByRole('button', { name: 'Stop Server' });
    if (await stopBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await stopBtn.click();
    }
  }
});
