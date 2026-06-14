/**
 * WS Load Test — E2E Test Suite
 * Tests: WL-01 through WL-15
 * Requires: backend on 3001, Vite on 5173
 */
import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5173/?tab=websocket-studio';
const MOCK_PORT = '9876';

/** Navigate to WS Studio, start mock server, connect, switch to Load Test tab */
async function setupConnected(page) {
  await page.goto(BASE, { waitUntil: 'networkidle' });

  // Start mock server
  await page.click('[data-testid="mode-mock"]');
  await page.waitForTimeout(300);
  const startBtn = page.locator('[data-testid="mock-start-btn"]');
  if (await startBtn.isVisible()) {
    await startBtn.click();
    await page.waitForTimeout(1000);
  }

  // Switch to Client & connect
  await page.click('[data-testid="mode-client"]');
  await page.waitForTimeout(300);
  const urlInput = page.locator('[aria-label="WebSocket URL"]');
  await urlInput.fill(`ws://localhost:${MOCK_PORT}`);
  await page.click('[data-testid="connect-btn"]');
  await page.waitForTimeout(1500);

  // Switch to Load Test tab
  await page.click('[data-testid="right-tab-loadtest"]');
  await page.waitForTimeout(300);
}

/** Navigate to WS Studio but do NOT connect — stay disconnected */
async function setupDisconnected(page) {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.click('[data-testid="right-tab-loadtest"]');
  await page.waitForTimeout(300);
}

// ===== Load Test Configuration =====

test('WL-01: Load Test panel renders in right pane tab', async ({ page }) => {
  await setupConnected(page);

  const panel = page.locator('[data-testid="load-test-panel"]');
  await expect(panel).toBeVisible();

  const config = page.locator('[data-testid="lt-config"]');
  await expect(config).toBeVisible();

  // Profile pills visible
  await expect(page.locator('[data-testid="lt-profile-pills"]')).toBeVisible();
  // Template textarea visible
  await expect(page.locator('[data-testid="lt-message-template"]')).toBeVisible();
  // Start button visible
  await expect(page.locator('[data-testid="lt-start-btn"]')).toBeVisible();
});

test('WL-02: Must be connected; button states', async ({ page }) => {
  // Disconnected state
  await setupDisconnected(page);

  const panel = page.locator('[data-testid="load-test-panel"]');
  await expect(panel).toBeVisible();

  // Not-connected warning should appear
  const warning = page.locator('[data-testid="lt-not-connected"]');
  await expect(warning).toBeVisible();

  // Start button disabled when disconnected
  const startBtn = page.locator('[data-testid="lt-start-btn"]');
  await expect(startBtn).toBeDisabled();
});

test('WL-02b: Start disabled when connected but template empty', async ({ page }) => {
  await setupConnected(page);

  // Clear the template
  const template = page.locator('[data-testid="lt-message-template"]');
  await template.fill('');

  const startBtn = page.locator('[data-testid="lt-start-btn"]');
  await expect(startBtn).toBeDisabled();

  // Fill template → enabled
  await template.fill('{"test":1}');
  await expect(startBtn).toBeEnabled();
});

test('WL-03: Message template with placeholders', async ({ page }) => {
  await setupConnected(page);

  const template = page.locator('[data-testid="lt-message-template"]');
  await template.fill('{"id":{{counter}},"ts":"{{timestamp}}","r":"{{random}}"}');

  // Template should accept the placeholders without error
  await expect(template).toHaveValue('{"id":{{counter}},"ts":"{{timestamp}}","r":"{{random}}"}');

  // Summary should show expected messages count
  const summary = page.locator('[data-testid="lt-summary"]');
  await expect(summary).toBeVisible();
  await expect(summary).toContainText('Expected');
});

test('WL-04: Load profile selector — Constant / Ramp / Burst', async ({ page }) => {
  await setupConnected(page);

  const constant = page.locator('[data-testid="lt-profile-constant"]');
  const ramp = page.locator('[data-testid="lt-profile-ramp"]');
  const burst = page.locator('[data-testid="lt-profile-burst"]');

  // All three visible
  await expect(constant).toBeVisible();
  await expect(ramp).toBeVisible();
  await expect(burst).toBeVisible();

  // Default: Constant active
  await expect(constant).toHaveClass(/active/);

  // Rate and Duration visible for Constant
  await expect(page.locator('[data-testid="lt-rate"]')).toBeVisible();
  await expect(page.locator('[data-testid="lt-duration"]')).toBeVisible();

  // Switch to Ramp — should show start rate + end rate
  await ramp.click();
  await expect(ramp).toHaveClass(/active/);
  await expect(page.locator('[data-testid="lt-rate"]')).toBeVisible();
  await expect(page.locator('[data-testid="lt-rate-end"]')).toBeVisible();
  await expect(page.locator('[data-testid="lt-duration"]')).toBeVisible();

  // Switch to Burst — should show burst count, no rate/duration
  await burst.click();
  await expect(burst).toHaveClass(/active/);
  await expect(page.locator('[data-testid="lt-burst-count"]')).toBeVisible();
  await expect(page.locator('[data-testid="lt-rate"]')).not.toBeVisible();
  await expect(page.locator('[data-testid="lt-duration"]')).not.toBeVisible();
});

test('WL-05: Duration presets (5s/10s/15s/30s/60s)', async ({ page }) => {
  await setupConnected(page);

  // Duration input should be visible
  const duration = page.locator('[data-testid="lt-duration"]');
  await expect(duration).toBeVisible();

  // Check preset buttons exist (5s, 10s, 15s, 30s, 60s)
  for (const d of [5, 10, 15, 30, 60]) {
    const btn = page.locator(`.ws-lt-duration-btn:text-is("${d}s")`);
    await expect(btn).toBeVisible();
  }

  // Click 15s preset
  await page.locator('.ws-lt-duration-btn:text-is("15s")').click();
  await expect(duration).toHaveValue('15');

  // Click 30s preset
  await page.locator('.ws-lt-duration-btn:text-is("30s")').click();
  await expect(duration).toHaveValue('30');
});

test('WL-06: Safety confirmation for high rate (>100 msg/s)', async ({ page }) => {
  await setupConnected(page);

  // Fill template first so Start button becomes enabled
  const template = page.locator('[data-testid="lt-message-template"]');
  await template.fill('{"test":{{counter}}}');

  // Set high rate
  const rate = page.locator('[data-testid="lt-rate"]');
  await rate.fill('150');

  // Click Start — should show confirmation dialog
  const startBtn = page.locator('[data-testid="lt-start-btn"]');
  await expect(startBtn).toBeEnabled();
  await startBtn.click();
  await page.waitForTimeout(300);

  const confirm = page.locator('[data-testid="lt-confirm"]');
  await expect(confirm).toBeVisible();
  await expect(confirm).toContainText('150');

  // Cancel confirmation
  await page.click('[data-testid="lt-confirm-no"]');
  await expect(confirm).not.toBeVisible();

  // The config should still be visible (test didn't start)
  await expect(page.locator('[data-testid="lt-config"]')).toBeVisible();
});

test('WL-06b: Safety confirmation for ramp with high end rate', async ({ page }) => {
  await setupConnected(page);

  // Fill template first
  const template = page.locator('[data-testid="lt-message-template"]');
  await template.fill('{"test":{{counter}}}');

  // Switch to ramp
  await page.click('[data-testid="lt-profile-ramp"]');
  const rate = page.locator('[data-testid="lt-rate"]');
  await rate.fill('10');
  const rateEnd = page.locator('[data-testid="lt-rate-end"]');
  await rateEnd.fill('200');

  await page.click('[data-testid="lt-start-btn"]');
  await page.waitForTimeout(300);

  const confirm = page.locator('[data-testid="lt-confirm"]');
  await expect(confirm).toBeVisible();
  await expect(confirm).toContainText('Ramp from');

  await page.click('[data-testid="lt-confirm-no"]');
});

// ===== Real-Time Metrics =====

test('WL-07: Constant-rate test execution with live metrics', async ({ page }) => {
  await setupConnected(page);

  const template = page.locator('[data-testid="lt-message-template"]');
  await template.fill('{"test":{{counter}}}');

  // Use low rate and short duration for E2E speed
  const rate = page.locator('[data-testid="lt-rate"]');
  await rate.fill('5');
  const duration = page.locator('[data-testid="lt-duration"]');
  await duration.fill('3');

  await page.click('[data-testid="lt-start-btn"]');

  // Running state should appear
  const running = page.locator('[data-testid="lt-running"]');
  await expect(running).toBeVisible({ timeout: 3000 });
  await expect(running).toContainText('Load Test Running');

  // Live metrics should update — sent counter > 0
  await page.waitForTimeout(1500);
  const sentMetric = running.locator('.ws-lt-metric-value').first();
  const sentText = await sentMetric.textContent();
  expect(parseInt(sentText.replace(/,/g, ''), 10)).toBeGreaterThan(0);

  // Stop button should be visible
  await expect(page.locator('[data-testid="lt-stop-btn"]')).toBeVisible();

  // Wait for test to complete
  const results = page.locator('[data-testid="lt-results"]');
  await expect(results).toBeVisible({ timeout: 15000 });
});

test('WL-08: Ramp-up profile execution', async ({ page }) => {
  await setupConnected(page);

  await page.click('[data-testid="lt-profile-ramp"]');

  const rate = page.locator('[data-testid="lt-rate"]');
  await rate.fill('2');
  const rateEnd = page.locator('[data-testid="lt-rate-end"]');
  await rateEnd.fill('10');
  const duration = page.locator('[data-testid="lt-duration"]');
  await duration.fill('3');

  const template = page.locator('[data-testid="lt-message-template"]');
  await template.fill('{"ramp":{{counter}}}');

  await page.click('[data-testid="lt-start-btn"]');

  const running = page.locator('[data-testid="lt-running"]');
  await expect(running).toBeVisible({ timeout: 3000 });

  // Wait for completion
  const results = page.locator('[data-testid="lt-results"]');
  await expect(results).toBeVisible({ timeout: 15000 });

  // Verify result cards exist
  const cards = page.locator('[data-testid="lt-result-cards"]');
  await expect(cards).toBeVisible();
  await expect(cards).toContainText('Messages Sent');
});

test('WL-09: Burst profile execution', async ({ page }) => {
  await setupConnected(page);

  await page.click('[data-testid="lt-profile-burst"]');

  const burstCount = page.locator('[data-testid="lt-burst-count"]');
  await burstCount.fill('50');

  const template = page.locator('[data-testid="lt-message-template"]');
  await template.fill('{"burst":{{counter}}}');

  await page.click('[data-testid="lt-start-btn"]');

  // Burst should complete fast
  const results = page.locator('[data-testid="lt-results"]');
  await expect(results).toBeVisible({ timeout: 15000 });

  // Should show 50 sent
  await expect(results).toContainText('50');
});

test('WL-10: Stop button — mid-run halt', async ({ page }) => {
  await setupConnected(page);

  const template = page.locator('[data-testid="lt-message-template"]');
  await template.fill('{"stop-test":{{counter}}}');

  const rate = page.locator('[data-testid="lt-rate"]');
  await rate.fill('5');
  const duration = page.locator('[data-testid="lt-duration"]');
  await duration.fill('30'); // Long duration so we can stop mid-run

  await page.click('[data-testid="lt-start-btn"]');

  const running = page.locator('[data-testid="lt-running"]');
  await expect(running).toBeVisible({ timeout: 3000 });

  // Wait a bit then stop
  await page.waitForTimeout(2000);
  await page.click('[data-testid="lt-stop-btn"]');

  // Results should appear with partial data
  const results = page.locator('[data-testid="lt-results"]');
  await expect(results).toBeVisible({ timeout: 10000 });

  // Duration should be much less than 30s
  await expect(results).toContainText('Duration');
});

test('WL-11: Auto-stop on disconnect', async ({ page }) => {
  await setupConnected(page);

  const template = page.locator('[data-testid="lt-message-template"]');
  await template.fill('{"disconnect-test":{{counter}}}');

  const rate = page.locator('[data-testid="lt-rate"]');
  await rate.fill('5');
  const duration = page.locator('[data-testid="lt-duration"]');
  await duration.fill('30');

  await page.click('[data-testid="lt-start-btn"]');
  await page.waitForTimeout(500);

  const running = page.locator('[data-testid="lt-running"]');
  await expect(running).toBeVisible({ timeout: 5000 });
  await page.waitForTimeout(1500);

  // Disconnect by switching to Connect tab and clicking disconnect
  await page.click('[data-testid="left-tab-connect"]');
  await page.waitForTimeout(200);
  await page.click('[data-testid="disconnect-btn"]');

  // Results should appear (test auto-stopped)
  const results = page.locator('[data-testid="lt-results"]');
  await expect(results).toBeVisible({ timeout: 10000 });

  // Disconnected warning should appear
  const disconnectedMsg = page.locator('[data-testid="lt-done-disconnected"]');
  await expect(disconnectedMsg).toBeVisible();
});

// ===== Results Summary =====

test('WL-12: Results summary — total metrics', async ({ page }) => {
  await setupConnected(page);

  const template = page.locator('[data-testid="lt-message-template"]');
  await template.fill('{"metrics":{{counter}}}');

  const rate = page.locator('[data-testid="lt-rate"]');
  await rate.fill('10');
  const duration = page.locator('[data-testid="lt-duration"]');
  await duration.fill('3');

  await page.click('[data-testid="lt-start-btn"]');

  const results = page.locator('[data-testid="lt-results"]');
  await expect(results).toBeVisible({ timeout: 15000 });

  const cards = page.locator('[data-testid="lt-result-cards"]');
  await expect(cards).toBeVisible();
  await expect(cards).toContainText('Messages Sent');
  await expect(cards).toContainText('Received');
  await expect(cards).toContainText('Duration');
  await expect(cards).toContainText('Avg Send Rate');

  // Bytes row
  await expect(results).toContainText('Bytes sent');
  await expect(results).toContainText('Bytes received');
});

test('WL-13: Latency percentiles', async ({ page }) => {
  await setupConnected(page);

  const template = page.locator('[data-testid="lt-message-template"]');
  await template.fill('{"latency":{{counter}}}');

  const rate = page.locator('[data-testid="lt-rate"]');
  await rate.fill('10');
  const duration = page.locator('[data-testid="lt-duration"]');
  await duration.fill('3');

  await page.click('[data-testid="lt-start-btn"]');

  const results = page.locator('[data-testid="lt-results"]');
  await expect(results).toBeVisible({ timeout: 15000 });

  // Latency cards should show percentiles
  await expect(results).toContainText('Min');
  await expect(results).toContainText('Mean');
  await expect(results).toContainText('P50');
  await expect(results).toContainText('P95');
  await expect(results).toContainText('P99');
  await expect(results).toContainText('Max');
  await expect(results).toContainText('Round-Trip Latency');
});

test('WL-14: Latency histogram', async ({ page }) => {
  await setupConnected(page);

  const template = page.locator('[data-testid="lt-message-template"]');
  await template.fill('{"histogram":{{counter}}}');

  const rate = page.locator('[data-testid="lt-rate"]');
  await rate.fill('10');
  const duration = page.locator('[data-testid="lt-duration"]');
  await duration.fill('3');

  await page.click('[data-testid="lt-start-btn"]');

  const results = page.locator('[data-testid="lt-results"]');
  await expect(results).toBeVisible({ timeout: 15000 });

  // Histogram should be visible
  const histogram = page.locator('[data-testid="lt-histogram"]');
  await expect(histogram).toBeVisible();

  // Should have multiple histogram rows
  const rows = histogram.locator('.ws-lt-histogram-row');
  const rowCount = await rows.count();
  expect(rowCount).toBeGreaterThan(0);

  await expect(results).toContainText('Latency Distribution');
});

test('WL-15: Export results and New Test button', async ({ page }) => {
  await setupConnected(page);

  const template = page.locator('[data-testid="lt-message-template"]');
  await template.fill('{"export":{{counter}}}');

  const rate = page.locator('[data-testid="lt-rate"]');
  await rate.fill('10');
  const duration = page.locator('[data-testid="lt-duration"]');
  await duration.fill('3');

  await page.click('[data-testid="lt-start-btn"]');

  const results = page.locator('[data-testid="lt-results"]');
  await expect(results).toBeVisible({ timeout: 15000 });

  // Export button visible
  const exportBtn = page.locator('[data-testid="lt-export-btn"]');
  await expect(exportBtn).toBeVisible();
  await expect(exportBtn).toContainText('Export JSON');

  // Run Again button visible
  const runAgain = page.locator('[data-testid="lt-run-again-btn"]');
  await expect(runAgain).toBeVisible();

  // New Test button visible
  const newTest = page.locator('[data-testid="lt-clear-btn"]');
  await expect(newTest).toBeVisible();
  await expect(newTest).toContainText('New Test');

  // Click New Test → returns to config
  await newTest.click();
  await page.waitForTimeout(300);

  const config = page.locator('[data-testid="lt-config"]');
  await expect(config).toBeVisible();
});

// ===== Tab Persistence =====

test('WL-01b: Tab switch preserves Load Test panel state', async ({ page }) => {
  await setupConnected(page);

  // Fill template
  const template = page.locator('[data-testid="lt-message-template"]');
  await template.fill('preserve me');

  // Switch to Events tab and back
  await page.click('[data-testid="right-tab-events"]');
  await page.waitForTimeout(200);
  await page.click('[data-testid="right-tab-loadtest"]');
  await page.waitForTimeout(200);

  // Template should be preserved
  await expect(template).toHaveValue('preserve me');
});

// ===== Cleanup =====

test('Cleanup: stop mock server', async ({ page }) => {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.click('[data-testid="mode-mock"]');
  await page.waitForTimeout(300);
  const stopBtn = page.locator('[data-testid="mock-stop-btn"]');
  if (await stopBtn.isVisible()) {
    await stopBtn.click();
    await page.waitForTimeout(500);
  }
});
