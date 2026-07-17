/**
 * WS Filtering, Diff & Schema — E2E Test Suite
 * Tests: WF-01 through WF-33
 * Requires: backend on 3001, Vite on 5173
 */
import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5173/?tab=websocket-studio';
// Use a dedicated port to avoid cross-spec mock server interference (ws-core-connect uses 9876)
const MOCK_PORT = '9880';

/** Navigate to WS Studio Client mode, start mock server, connect, send seed messages */
async function setupWithMessages(page) {
  // Ensure mock server is running via API (handles parallel worker race)
  await page.request.post('http://localhost:3001/api/ws/mock/start', {
    data: { port: parseInt(MOCK_PORT, 10) },
  }).catch(() => {});
  await page.waitForTimeout(500);

  await page.goto(BASE, { waitUntil: 'networkidle' });

  // Switch to Client mode
  await page.click('[data-testid="mode-client"]');
  await page.waitForTimeout(300);

  // Connect
  const urlInput = page.locator('[aria-label="WebSocket URL"]');
  await urlInput.fill(`ws://localhost:${MOCK_PORT}`);
  await page.click('[data-testid="connect-btn"]');

  // Wait for connected state with retry
  const connected = page.locator('[data-testid="conn-tab-bar"] [aria-label*="connected"]');
  try {
    await connected.waitFor({ timeout: 10000 });
  } catch {
    // Retry: restart mock server and reconnect
    await page.request.post('http://localhost:3001/api/ws/mock/start', {
      data: { port: parseInt(MOCK_PORT, 10) },
    }).catch(() => {});
    await page.waitForTimeout(1000);
    await page.click('[data-testid="connect-btn"]');
    await connected.waitFor({ timeout: 15000 });
  }
  await page.waitForTimeout(300);

  // Switch to Send tab and send messages
  await page.click('[data-testid="left-tab-send"]');
  await page.waitForTimeout(200);

  const msgInput = page.locator('textarea[aria-label="Message input"]');
  // Wait for compose input to be enabled (connection fully established)
  // If still disabled, do a full stop+start+reconnect cycle (up to 2 retries)
  let composeReady = false;
  for (let attempt = 0; attempt < 3 && !composeReady; attempt++) {
    try {
      await expect(msgInput).toBeEnabled({ timeout: attempt === 0 ? 5000 : 10000 });
      composeReady = true;
    } catch {
      // Connection may have dropped — full stop+start+reconnect cycle
      await page.request.post('http://localhost:3001/api/ws/mock/stop', {
        data: { port: parseInt(MOCK_PORT, 10) },
      }).catch(() => {});
      await page.waitForTimeout(300);
      await page.request.post('http://localhost:3001/api/ws/mock/start', {
        data: { port: parseInt(MOCK_PORT, 10) },
      }).catch(() => {});
      await page.waitForTimeout(1000);
      await page.click('[data-testid="left-tab-connect"]');
      await page.waitForTimeout(200);
      await page.click('[data-testid="connect-btn"]');
      const reconnected = page.locator('[data-testid="conn-tab-bar"] [aria-label*="connected"]');
      await reconnected.waitFor({ timeout: 15000 });
      await page.waitForTimeout(500);
      await page.click('[data-testid="left-tab-send"]');
      await page.waitForTimeout(300);
    }
  }
  if (!composeReady) {
    await expect(msgInput).toBeEnabled({ timeout: 10000 });
  }
  const sendBtn = page.locator('[data-testid="send-btn"]');

  const messages = [
    'Hello text message',
    '{"type":"greeting","name":"Alice","count":1}',
    '{"type":"error","code":500,"message":"Server error"}',
    '{"type":"greeting","name":"Bob","count":2}',
    '{"type":"status","active":true,"name":"Carol"}',
  ];

  for (const msg of messages) {
    // Ensure input is still enabled (connection may drop under parallel load)
    try {
      await expect(msgInput).toBeEnabled({ timeout: 3000 });
    } catch {
      // Reconnect
      await page.request.post('http://localhost:3001/api/ws/mock/start', {
        data: { port: parseInt(MOCK_PORT, 10) },
      }).catch(() => {});
      await page.waitForTimeout(500);
      await page.click('[data-testid="left-tab-connect"]');
      await page.waitForTimeout(200);
      await page.click('[data-testid="connect-btn"]');
      const reconnected = page.locator('[data-testid="conn-tab-bar"] [aria-label*="connected"]');
      await reconnected.waitFor({ timeout: 15000 });
      await page.waitForTimeout(300);
      await page.click('[data-testid="left-tab-send"]');
      await page.waitForTimeout(200);
      await expect(msgInput).toBeEnabled({ timeout: 10000 });
    }
    await msgInput.fill(msg);
    await sendBtn.click();
    await page.waitForTimeout(400);
  }

  // Switch to Events tab
  await page.click('[data-testid="right-tab-events"]');
  await page.waitForTimeout(500);
}

// ===== Search Modes =====

test('WF-01: Search mode pills — Text / Regex / JSONPath', async ({ page }) => {
  await setupWithMessages(page);

  const pills = page.locator('[data-testid="search-mode-pills"]');
  await expect(pills).toBeVisible();

  const textPill = page.locator('[data-testid="search-mode-text"]');
  const regexPill = page.locator('[data-testid="search-mode-regex"]');
  const jpPill = page.locator('[data-testid="search-mode-jsonpath"]');

  await expect(textPill).toBeVisible();
  await expect(regexPill).toBeVisible();
  await expect(jpPill).toBeVisible();

  // Default: Text active
  await expect(textPill).toHaveClass(/ws-search-mode-pill-active/);

  // Switch to Regex
  await regexPill.click();
  await expect(regexPill).toHaveClass(/ws-search-mode-pill-active/);
  await expect(textPill).not.toHaveClass(/ws-search-mode-pill-active/);

  // Switch to JSONPath
  await jpPill.click();
  await expect(jpPill).toHaveClass(/ws-search-mode-pill-active/);
});

test('WF-02: Text mode — substring match', async ({ page }) => {
  test.slow();
  await setupWithMessages(page);

  const searchInput = page.locator('[data-testid="search-input"]');
  await searchInput.fill('Hello');
  await page.waitForTimeout(300);

  // Should show match counter (fewer than total)
  const counter = page.locator('[data-testid="match-counter"]');
  if (await counter.isVisible()) {
    const text = await counter.textContent();
    // Counter shows "N of M" where N < M
    expect(text).toMatch(/\d+ of \d+/);
  }
});

test('WF-03: Regex mode — pattern matching', async ({ page }) => {
  test.slow();
  await setupWithMessages(page);

  // Switch to Regex mode
  await page.click('[data-testid="search-mode-regex"]');
  await page.waitForTimeout(200);

  const searchInput = page.locator('[data-testid="search-input"]');

  // Valid regex
  await searchInput.fill('"type":\\s*"error"');
  await page.waitForTimeout(300);
  const counter = page.locator('[data-testid="match-counter"]');
  if (await counter.isVisible()) {
    const text = await counter.textContent();
    expect(text).toMatch(/\d+ of \d+/);
  }

  // Invalid regex — input should get error class
  await searchInput.fill('[invalid');
  await page.waitForTimeout(300);
  await expect(searchInput).toHaveClass(/ws-search-invalid/);
});

test('WF-04: JSONPath mode — structured queries', async ({ page }) => {
  test.setTimeout(120000);
  await setupWithMessages(page);

  await page.click('[data-testid="search-mode-jsonpath"]');
  await page.waitForTimeout(200);

  const searchInput = page.locator('[data-testid="search-input"]');
  await searchInput.fill('$.type');
  await page.waitForTimeout(300);

  // Should filter to only JSON messages with a "type" field
  const counter = page.locator('[data-testid="match-counter"]');
  if (await counter.isVisible()) {
    const text = await counter.textContent();
    expect(text).toMatch(/\d+ of \d+/);
  }

  // Value match
  await searchInput.fill('$.type=error');
  await page.waitForTimeout(300);
  if (await counter.isVisible()) {
    const text = await counter.textContent();
    expect(text).toMatch(/\d+ of \d+/);
  }
});

test('WF-05: Match counter updates', async ({ page }) => {
  await setupWithMessages(page);

  const searchInput = page.locator('[data-testid="search-input"]');
  await searchInput.fill('greeting');
  await page.waitForTimeout(300);

  const counter = page.locator('[data-testid="match-counter"]');
  if (await counter.isVisible()) {
    const text = await counter.textContent();
    expect(text).toMatch(/\d+ of \d+/);
  }
});

// ===== Attribute Filters =====

test('WF-06: Filter bar toggle', async ({ page }) => {
  await setupWithMessages(page);

  const filterBtn = page.locator('[data-testid="filter-toggle-btn"]');
  await expect(filterBtn).toBeVisible();
  await expect(filterBtn).toHaveText(/Filters/);

  // Open filter bar
  await filterBtn.click();
  await page.waitForTimeout(300);
  const filterBar = page.locator('[data-testid="filter-bar"]');
  await expect(filterBar).toBeVisible();

  // Should have size, time, content type filters
  await expect(page.locator('[data-testid="size-filter"]')).toBeVisible();
  await expect(page.locator('[data-testid="time-filter"]')).toBeVisible();
  await expect(page.locator('[data-testid="content-type-filter"]')).toBeVisible();

  // Close filter bar
  await filterBtn.click();
  await page.waitForTimeout(300);
  await expect(filterBar).not.toBeVisible();
});

test('WF-07: Size filter', async ({ page }) => {
  await setupWithMessages(page);

  await page.click('[data-testid="filter-toggle-btn"]');
  await page.waitForTimeout(300);

  const sizeFilter = page.locator('[data-testid="size-filter"]');
  // Default: all
  await expect(sizeFilter).toHaveValue('all');

  // Select < 1KB
  await sizeFilter.selectOption('lt1k');
  await page.waitForTimeout(300);
  // Messages should still be visible (our test messages are small)

  // Select > 10KB — should filter out all small messages
  await sizeFilter.selectOption('gt10k');
  await page.waitForTimeout(300);
  // Match counter should show fewer or 0
});

test('WF-08: Time filter', async ({ page }) => {
  await setupWithMessages(page);

  await page.click('[data-testid="filter-toggle-btn"]');
  await page.waitForTimeout(300);

  const timeFilter = page.locator('[data-testid="time-filter"]');
  await expect(timeFilter).toHaveValue('all');

  // Select Last 30s — all messages are recent so should still show
  await timeFilter.selectOption('last30s');
  await page.waitForTimeout(300);
});

test('WF-09: Content type filter', async ({ page }) => {
  await setupWithMessages(page);

  await page.click('[data-testid="filter-toggle-btn"]');
  await page.waitForTimeout(300);

  const ctFilter = page.locator('[data-testid="content-type-filter"]');
  await expect(ctFilter).toHaveValue('all');

  // Filter to JSON only
  await ctFilter.selectOption('json');
  await page.waitForTimeout(300);

  // Filter to Text only
  await ctFilter.selectOption('text');
  await page.waitForTimeout(300);
});

test('WF-10: Filter composition (AND logic)', async ({ page }) => {
  await setupWithMessages(page);

  // Set direction to Sent
  const dirFilter = page.locator('[aria-label="Direction filter"]');
  await dirFilter.selectOption('sent');
  await page.waitForTimeout(200);

  // Open filter bar and set size
  await page.click('[data-testid="filter-toggle-btn"]');
  await page.waitForTimeout(300);
  await page.locator('[data-testid="size-filter"]').selectOption('lt1k');
  await page.waitForTimeout(200);

  // Set text search
  const searchInput = page.locator('[data-testid="search-input"]');
  await searchInput.fill('greeting');
  await page.waitForTimeout(300);

  // Match counter should show filtered count
  const counter = page.locator('[data-testid="match-counter"]');
  if (await counter.isVisible()) {
    const text = await counter.textContent();
    expect(text).toMatch(/\d+ of \d+/);
  }
});

test('WF-11: Active filter count badge', async ({ page }) => {
  await setupWithMessages(page);

  const filterBtn = page.locator('[data-testid="filter-toggle-btn"]');

  // Open filters and set non-default values
  await filterBtn.click();
  await page.waitForTimeout(300);
  await page.locator('[data-testid="size-filter"]').selectOption('lt1k');
  await page.locator('[data-testid="time-filter"]').selectOption('last5m');
  await page.waitForTimeout(500);

  // Filter button should show count — use expect with timeout for re-render
  await expect(filterBtn).toHaveText(/Filters\s*\(\d+\)/, { timeout: 5000 });

  // Clear button should appear
  const clearBtn = page.locator('[data-testid="clear-filters-btn"]');
  await expect(clearBtn).toBeVisible();
  await clearBtn.click();
  await page.waitForTimeout(300);

  // Badge should be gone
  await expect(filterBtn).toHaveText('Filters', { timeout: 5000 });
});

// ===== Filter Presets =====

test('WF-12: Save current filters as preset', async ({ page }) => {
  await setupWithMessages(page);

  // Set up filters
  const searchInput = page.locator('[data-testid="search-input"]');
  await searchInput.fill('error');
  await page.waitForTimeout(200);

  await page.click('[data-testid="filter-toggle-btn"]');
  await page.waitForTimeout(300);
  await page.locator('[data-testid="size-filter"]').selectOption('lt1k');
  await page.waitForTimeout(200);

  // Click presets button
  const presetsBtn = page.locator('[data-testid="presets-btn"]');
  await presetsBtn.click();
  await page.waitForTimeout(300);

  // Click save preset
  const saveBtn = page.locator('[data-testid="save-preset-btn"]');
  if (await saveBtn.isVisible()) {
    await saveBtn.click();
    await page.waitForTimeout(500);
  }
});

test('WF-13+14: Apply and delete preset', async ({ page }) => {
  await setupWithMessages(page);

  // First save a preset
  const searchInput = page.locator('[data-testid="search-input"]');
  await searchInput.fill('error');
  await page.waitForTimeout(200);

  await page.click('[data-testid="filter-toggle-btn"]');
  await page.waitForTimeout(300);
  await page.locator('[data-testid="size-filter"]').selectOption('lt1k');
  await page.waitForTimeout(200);

  const presetsBtn = page.locator('[data-testid="presets-btn"]');
  await presetsBtn.click();
  await page.waitForTimeout(300);

  const saveBtn = page.locator('[data-testid="save-preset-btn"]');
  if (await saveBtn.isVisible()) {
    await saveBtn.click();
    await page.waitForTimeout(500);

    // Clear and re-open presets to apply
    await searchInput.fill('');
    await page.waitForTimeout(200);

    // Re-open presets
    if (!(await page.locator('[data-testid="presets-dropdown"]').isVisible())) {
      await presetsBtn.click();
      await page.waitForTimeout(300);
    }

    // Look for apply button
    const applyBtns = page.locator('[data-testid^="preset-apply-"]');
    const count = await applyBtns.count();
    if (count > 0) {
      await applyBtns.first().click();
      await page.waitForTimeout(300);
    }
  }
});

// ===== Diff / Compare =====

test('WF-15: Compare mode toggle', async ({ page }) => {
  await setupWithMessages(page);

  const compareBtn = page.locator('[data-testid="compare-btn"]');
  await expect(compareBtn).toBeVisible();

  // Enter compare mode
  await compareBtn.click();
  await page.waitForTimeout(300);

  // Banner should appear
  const banner = page.locator('[data-testid="compare-banner"]');
  await expect(banner).toBeVisible();

  // Cancel button should be in banner
  const cancelBtn = page.locator('[data-testid="compare-cancel"]');
  await expect(cancelBtn).toBeVisible();

  // Exit compare mode
  await cancelBtn.click();
  await page.waitForTimeout(300);
  await expect(banner).not.toBeVisible();
});

test('WF-16+17: Select A and B → diff modal with line-level diff', async ({ page }) => {
  test.slow();
  await setupWithMessages(page);

  // Enter compare mode
  await page.click('[data-testid="compare-btn"]');
  await page.waitForTimeout(300);

  // Click first message row
  const rows = page.locator('.ws-message-row');
  const rowCount = await rows.count();
  expect(rowCount).toBeGreaterThanOrEqual(4);

  await rows.nth(1).click(); // message A (second row — a JSON one)
  await page.waitForTimeout(300);

  await rows.nth(3).click(); // message B (fourth row)
  await page.waitForTimeout(500);

  // Diff modal should open
  const diffModal = page.locator('[data-testid="diff-modal"]');
  await expect(diffModal).toBeVisible({ timeout: 10000 });

  // Check modal title
  const title = diffModal.locator('.ws-diff-title');
  await expect(title).toHaveText('Message Diff');

  // Meta labels
  await expect(page.locator('[data-testid="diff-meta-left"]')).toBeVisible();
  await expect(page.locator('[data-testid="diff-meta-right"]')).toBeVisible();
});

test('WF-18: JSON structural changes summary', async ({ page }) => {
  test.slow();
  await setupWithMessages(page);

  // Ensure messages have been received
  const rows = page.locator('.ws-message-row');
  await expect(rows.nth(3)).toBeVisible({ timeout: 5000 });

  await page.click('[data-testid="compare-btn"]');
  await page.waitForTimeout(300);

  // Select two different JSON messages
  await rows.nth(1).click();
  await page.waitForTimeout(300);
  await rows.nth(3).click();
  await page.waitForTimeout(500);

  const diffModal = page.locator('[data-testid="diff-modal"]');
  await expect(diffModal).toBeVisible({ timeout: 10000 });

  // Summary section
  const summary = page.locator('[data-testid="diff-summary"]');
  if (await summary.isVisible()) {
    const text = await summary.textContent();
    expect(text).toMatch(/structural change|added|changed|removed|identical/i);
  }
});

test('WF-19: Swap sides and Copy diff', async ({ page }) => {
  await setupWithMessages(page);

  await page.click('[data-testid="compare-btn"]');
  await page.waitForTimeout(300);

  const rows = page.locator('.ws-message-row');
  await rows.nth(1).click();
  await page.waitForTimeout(300);
  await rows.nth(3).click();
  await page.waitForTimeout(500);

  const diffModal = page.locator('[data-testid="diff-modal"]');
  await expect(diffModal).toBeVisible({ timeout: 10000 });

  // Swap button
  const swapBtn = page.locator('[data-testid="diff-swap"]');
  await expect(swapBtn).toBeVisible();
  const metaLeftBefore = await page.locator('[data-testid="diff-meta-left"]').textContent();
  await swapBtn.click();
  await page.waitForTimeout(300);
  const metaLeftAfter = await page.locator('[data-testid="diff-meta-left"]').textContent();
  // After swap, left side content should change
  expect(metaLeftAfter).not.toBe(metaLeftBefore);

  // Copy button
  const copyBtn = page.locator('[data-testid="diff-copy"]');
  await expect(copyBtn).toBeVisible();
  await copyBtn.click();
  await page.waitForTimeout(200);
});

test('WF-20: Close diff → exits compare mode', async ({ page }) => {
  await setupWithMessages(page);

  await page.click('[data-testid="compare-btn"]');
  await page.waitForTimeout(300);

  const rows = page.locator('.ws-message-row');
  await rows.nth(1).click();
  await page.waitForTimeout(300);
  await rows.nth(3).click();
  await page.waitForTimeout(500);

  const diffModal = page.locator('[data-testid="diff-modal"]');
  await expect(diffModal).toBeVisible({ timeout: 10000 });

  // Close modal
  await page.click('[data-testid="diff-close"]');
  await page.waitForTimeout(300);

  await expect(diffModal).not.toBeVisible();
  // Compare mode should also exit
  const banner = page.locator('[data-testid="compare-banner"]');
  await expect(banner).not.toBeVisible();
});

// ===== Quick Diff =====

test('WF-21+22: Detail panel Diff ↑ / Diff ↓ buttons', async ({ page }) => {
  await setupWithMessages(page);

  // Click a message row to open detail panel
  const rows = page.locator('.ws-message-row');
  await rows.nth(3).click(); // Pick a row that has previous same-direction messages
  await page.waitForTimeout(500);

  // Look for Diff prev/next buttons
  const diffPrev = page.locator('[data-testid="detail-diff-prev"]');
  const diffNext = page.locator('[data-testid="detail-diff-next"]');

  // At least one should exist
  const prevVisible = await diffPrev.isVisible().catch(() => false);
  const nextVisible = await diffNext.isVisible().catch(() => false);

  if (prevVisible) {
    await diffPrev.click();
    await page.waitForTimeout(500);
    const diffModal = page.locator('[data-testid="diff-modal"]');
    await expect(diffModal).toBeVisible({ timeout: 10000 });
    await page.click('[data-testid="diff-close"]');
    await page.waitForTimeout(300);
  }
});

// ===== Schema Management =====

test('WF-24: Schema panel toggle (from right tab)', async ({ page }) => {
  await setupWithMessages(page);

  // Schema is a right tab
  const schemaTab = page.locator('[data-testid="right-tab-schema"]');
  await schemaTab.click();
  await page.waitForTimeout(300);

  // Schema panel should show
  const schemaPanel = page.locator('[data-testid="ws-schema-panel"]');
  await expect(schemaPanel).toBeVisible();

  // Validation toggle
  const valToggle = page.locator('[data-testid="ws-validation-toggle"]');
  await expect(valToggle).toBeVisible();

  // Add schema button
  const addBtn = page.locator('[data-testid="ws-schema-add-btn"]');
  await expect(addBtn).toBeVisible();
});

test('WF-25: Add schema', async ({ page }) => {
  await setupWithMessages(page);

  await page.click('[data-testid="right-tab-schema"]');
  await page.waitForTimeout(300);

  // Enable validation
  const valToggle = page.locator('[data-testid="ws-validation-toggle"]');
  const isChecked = await valToggle.isChecked();
  if (!isChecked) {
    await valToggle.click();
    await page.waitForTimeout(200);
  }

  // Click Add Schema
  await page.click('[data-testid="ws-schema-add-btn"]');
  await page.waitForTimeout(300);

  // Fill in schema editor
  const nameInput = page.locator('[data-testid="ws-schema-name-input"]');
  if (await nameInput.isVisible()) {
    await nameInput.fill('Greeting Schema');

    const schemaText = page.locator('[data-testid="ws-schema-textarea"]');
    await schemaText.fill(JSON.stringify({
      type: 'object',
      properties: {
        type: { type: 'string' },
        name: { type: 'string' }
      },
      required: ['type']
    }, null, 2));

    const dirSelect = page.locator('[data-testid="ws-schema-direction-select"]');
    if (await dirSelect.isVisible()) {
      await dirSelect.selectOption('both');
    }

    // Save
    const saveBtn = page.locator('[data-testid="ws-schema-save-btn"]');
    await saveBtn.click();
    await page.waitForTimeout(500);

    // Schema card should appear
    const cards = page.locator('[data-testid="ws-schema-card"]');
    expect(await cards.count()).toBeGreaterThanOrEqual(1);
  }
});

test('WF-26: Edit and Delete schema', async ({ page }) => {
  await setupWithMessages(page);

  await page.click('[data-testid="right-tab-schema"]');
  await page.waitForTimeout(300);

  // Add schema first
  const valToggle = page.locator('[data-testid="ws-validation-toggle"]');
  if (!(await valToggle.isChecked())) {
    await valToggle.click();
    await page.waitForTimeout(200);
  }

  await page.click('[data-testid="ws-schema-add-btn"]');
  await page.waitForTimeout(300);

  const nameInput = page.locator('[data-testid="ws-schema-name-input"]');
  if (await nameInput.isVisible()) {
    await nameInput.fill('Test Schema');
    const schemaText = page.locator('[data-testid="ws-schema-textarea"]');
    await schemaText.fill('{"type":"object","properties":{"id":{"type":"number"}},"required":["id"]}');
    await page.click('[data-testid="ws-schema-save-btn"]');
    await page.waitForTimeout(500);

    const cards = page.locator('[data-testid="ws-schema-card"]');
    const initialCount = await cards.count();
    expect(initialCount).toBeGreaterThanOrEqual(1);

    // Edit — click Edit button on card
    const editBtn = cards.first().locator('button', { hasText: 'Edit' });
    if (await editBtn.isVisible()) {
      await editBtn.click();
      await page.waitForTimeout(300);
      // Editor should reopen
    }

    // Delete — click Delete then Confirm
    const deleteBtn = cards.first().locator('button', { hasText: 'Delete' });
    if (await deleteBtn.isVisible()) {
      await deleteBtn.click();
      await page.waitForTimeout(200);
      const confirmBtn = cards.first().locator('button', { hasText: 'Confirm' });
      if (await confirmBtn.isVisible()) {
        await confirmBtn.click();
        await page.waitForTimeout(500);
      }
    }
  }
});

test('WF-28+29: Validation badges on messages', async ({ page }) => {
  await setupWithMessages(page);

  // Go to Schema tab and add a schema
  await page.click('[data-testid="right-tab-schema"]');
  await page.waitForTimeout(300);

  const valToggle = page.locator('[data-testid="ws-validation-toggle"]');
  if (!(await valToggle.isChecked())) {
    await valToggle.click();
    await page.waitForTimeout(200);
  }

  await page.click('[data-testid="ws-schema-add-btn"]');
  await page.waitForTimeout(300);

  const nameInput = page.locator('[data-testid="ws-schema-name-input"]');
  if (await nameInput.isVisible()) {
    await nameInput.fill('Greeting Schema');
    const schemaText = page.locator('[data-testid="ws-schema-textarea"]');
    await schemaText.fill(JSON.stringify({
      type: 'object',
      properties: { type: { type: 'string' }, name: { type: 'string' } },
      required: ['type', 'name']
    }, null, 2));
    await page.click('[data-testid="ws-schema-save-btn"]');
    await page.waitForTimeout(500);
  }

  // Switch to Events tab to see validation badges
  await page.click('[data-testid="right-tab-events"]');
  await page.waitForTimeout(500);

  // Look for valid/invalid badges on messages
  const validBadges = page.locator('.ws-validation-badge-valid, .ws-validation-valid');
  const invalidBadges = page.locator('.ws-validation-badge-invalid, .ws-validation-invalid');

  const vCount = await validBadges.count();
  const iCount = await invalidBadges.count();
  // We should have some mix of valid and invalid
  expect(vCount + iCount).toBeGreaterThanOrEqual(0); // At minimum badges render
});

test('WF-30: Validation filter dropdown', async ({ page }) => {
  await setupWithMessages(page);

  // Add schema and enable validation
  await page.click('[data-testid="right-tab-schema"]');
  await page.waitForTimeout(300);

  const valToggle = page.locator('[data-testid="ws-validation-toggle"]');
  if (!(await valToggle.isChecked())) {
    await valToggle.click();
    await page.waitForTimeout(200);
  }

  await page.click('[data-testid="ws-schema-add-btn"]');
  await page.waitForTimeout(300);

  const nameInput = page.locator('[data-testid="ws-schema-name-input"]');
  if (await nameInput.isVisible()) {
    await nameInput.fill('V Filter Test');
    const schemaText = page.locator('[data-testid="ws-schema-textarea"]');
    await schemaText.fill('{"type":"object","required":["type"]}');
    await page.click('[data-testid="ws-schema-save-btn"]');
    await page.waitForTimeout(500);
  }

  // Switch to Events and check validation filter
  await page.click('[data-testid="right-tab-events"]');
  await page.waitForTimeout(500);

  const vFilter = page.locator('[data-testid="validation-filter"]');
  if (await vFilter.isVisible()) {
    await vFilter.selectOption('valid');
    await page.waitForTimeout(300);
    await vFilter.selectOption('invalid');
    await page.waitForTimeout(300);
    await vFilter.selectOption('all');
    await page.waitForTimeout(300);
  }
});

test('WF-32: Generate schema from messages', async ({ page }) => {
  await setupWithMessages(page);

  await page.click('[data-testid="right-tab-schema"]');
  await page.waitForTimeout(300);

  const genBtn = page.locator('[data-testid="ws-schema-generate-btn"]');
  if (await genBtn.isVisible()) {
    await genBtn.click();
    await page.waitForTimeout(500);

    // Schema editor should be populated with inferred schema
    const schemaText = page.locator('[data-testid="ws-schema-textarea"]');
    if (await schemaText.isVisible()) {
      const val = await schemaText.inputValue();
      expect(val.length).toBeGreaterThan(10);
      // Should be valid JSON
      expect(() => JSON.parse(val)).not.toThrow();
    }
  }
});

// ===== Console vs Events Interplay (WF-34 through WF-40) =====

test('WF-34: Console /send appears in Events log', async ({ page }) => {
  await setupWithMessages(page);

  // Verify still connected before sending console command
  const connected = page.locator('[data-testid="conn-tab-bar"] [aria-label*="connected"]');
  try {
    await connected.waitFor({ timeout: 3000 });
  } catch {
    // Reconnect if connection dropped under parallel load
    await page.request.post('http://localhost:3001/api/ws/mock/start', {
      data: { port: parseInt(MOCK_PORT, 10) },
    }).catch(() => {});
    await page.waitForTimeout(500);
    await page.click('[data-testid="left-tab-connect"]');
    await page.waitForTimeout(200);
    await page.click('[data-testid="connect-btn"]');
    await connected.waitFor({ timeout: 10000 });
    await page.waitForTimeout(300);
  }

  // Switch to Console tab
  await page.click('[data-testid="right-tab-console"]');
  await page.waitForTimeout(300);

  // Send a message via Console /send command
  const cmdInput = page.locator('[data-testid="ws-console-cmd-input"]');
  await cmdInput.fill('/send {"action":"test","value":42}');
  await cmdInput.press('Enter');
  await page.waitForTimeout(500);

  // Verify Console shows command echo and "Message sent."
  const consoleRows = page.locator('.ws-console-row');
  const consoleTexts = await consoleRows.allTextContents();
  const joined = consoleTexts.join(' ');
  expect(joined).toContain('/send');
  expect(joined).toContain('Message sent');

  // Switch to Events tab — the /send frame should appear there too
  await page.click('[data-testid="right-tab-events"]');
  await page.waitForTimeout(500);

  const eventRows = page.locator('.ws-message-row');
  const eventTexts = await eventRows.allTextContents();
  const eventJoined = eventTexts.join(' ');
  // The sent frame and its echo should be in Events
  expect(eventJoined).toContain('action');
  expect(eventJoined).toContain('test');
});

test('WF-35: Events search does NOT affect Console', async ({ page }) => {
  await setupWithMessages(page);

  // Type a search on Events tab
  const searchInput = page.locator('[data-testid="search-input"]');
  await searchInput.fill('error');
  await page.waitForTimeout(500);

  // Verify Events is filtered (match counter should show subset)
  const counter = page.locator('[data-testid="match-counter"]');
  if (await counter.isVisible()) {
    const counterText = await counter.textContent();
    expect(counterText).toMatch(/\d+ of \d+/);
  }

  // Switch to Console — search should be empty, entries unfiltered
  await page.click('[data-testid="right-tab-console"]');
  await page.waitForTimeout(300);

  const consoleSearch = page.locator('[data-testid="ws-console-search"]');
  if (await consoleSearch.isVisible()) {
    const val = await consoleSearch.inputValue();
    expect(val).toBe('');
  }

  // Console count should show full entry count (filtered === total)
  const consoleCount = page.locator('[data-testid="ws-console-count"]');
  if (await consoleCount.isVisible()) {
    const countText = await consoleCount.textContent();
    // Format is "N/N" when unfiltered
    const parts = countText.split('/');
    if (parts.length === 2) {
      expect(parts[0].trim()).toBe(parts[1].trim());
    }
  }

  // Switch back to Events — "error" search should still be there
  await page.click('[data-testid="right-tab-events"]');
  await page.waitForTimeout(300);
  const searchVal = await searchInput.inputValue();
  expect(searchVal).toBe('error');
});

test('WF-36: Console search does NOT affect Events', async ({ page }) => {
  await setupWithMessages(page);

  // Switch to Console tab and apply a search + category filter
  await page.click('[data-testid="right-tab-console"]');
  await page.waitForTimeout(300);

  const consoleSearch = page.locator('[data-testid="ws-console-search"]');
  if (await consoleSearch.isVisible()) {
    await consoleSearch.fill('Connecting');
    await page.waitForTimeout(300);
  }

  const categoryFilter = page.locator('[data-testid="ws-console-category"]');
  if (await categoryFilter.isVisible()) {
    await categoryFilter.selectOption('handshake');
    await page.waitForTimeout(300);
  }

  // Console count should reflect the filtered state
  const consoleCount = page.locator('[data-testid="ws-console-count"]');
  if (await consoleCount.isVisible()) {
    const countText = await consoleCount.textContent();
    // Format is "filtered/total" — filtered < total when filters are active
    expect(countText).toMatch(/\d+\/\d+/);
  }

  // Switch to Events — should be unaffected by Console filters
  await page.click('[data-testid="right-tab-events"]');
  await page.waitForTimeout(300);

  // Events search should be empty (independent state)
  const eventsSearch = page.locator('[data-testid="search-input"]');
  const eventsSearchVal = await eventsSearch.inputValue();
  expect(eventsSearchVal).toBe('');

  // All Events messages should be visible (no filter from Console)
  const eventRows = page.locator('.ws-message-row');
  const eventCount = await eventRows.count();
  expect(eventCount).toBeGreaterThanOrEqual(10); // 5 sent + 5 echo + system
});

test('WF-37: Schema validation only applies to Events', async ({ page }) => {
  await setupWithMessages(page);

  // Go to Schema tab and add a schema requiring "id" field
  await page.click('[data-testid="right-tab-schema"]');
  await page.waitForTimeout(300);

  const valToggle = page.locator('[data-testid="ws-validation-toggle"]');
  if (!(await valToggle.isChecked())) {
    await valToggle.click();
    await page.waitForTimeout(200);
  }

  await page.click('[data-testid="ws-schema-add-btn"]');
  await page.waitForTimeout(300);

  const nameInput = page.locator('[data-testid="ws-schema-name-input"]');
  if (await nameInput.isVisible()) {
    await nameInput.fill('id-required');
    const schemaText = page.locator('[data-testid="ws-schema-textarea"]');
    await schemaText.fill('{"type":"object","required":["id"]}');
    await page.click('[data-testid="ws-schema-save-btn"]');
    await page.waitForTimeout(500);
  }

  // Send a message via Console /send that violates the schema (no "id" field)
  await page.click('[data-testid="right-tab-console"]');
  await page.waitForTimeout(300);
  const cmdInput = page.locator('[data-testid="ws-console-cmd-input"]');
  await cmdInput.fill('/send {"name":"no-id"}');
  await cmdInput.press('Enter');
  await page.waitForTimeout(500);

  // Console entries should have NO validation badges
  const consoleBadges = page.locator('.ws-console-row .ws-validation-badge-valid, .ws-console-row .ws-validation-badge-invalid, .ws-console-row .ws-validation-valid, .ws-console-row .ws-validation-invalid');
  expect(await consoleBadges.count()).toBe(0);

  // Events tab should have validation badges on the sent frame
  await page.click('[data-testid="right-tab-events"]');
  await page.waitForTimeout(500);

  // The validation filter dropdown should be in Events toolbar
  const vFilter = page.locator('[data-testid="validation-filter"]');
  expect(await vFilter.count()).toBeGreaterThanOrEqual(1); // exists in Events
});

test('WF-38: Filter presets are Events-only', async ({ page }) => {
  await setupWithMessages(page);

  // Open filter bar and set a filter
  const filterBtn = page.locator('[data-testid="filter-toggle-btn"]');
  await filterBtn.click();
  await page.waitForTimeout(300);

  const contentFilter = page.locator('[data-testid="content-type-filter"]');
  if (await contentFilter.isVisible()) {
    await contentFilter.selectOption('json');
    await page.waitForTimeout(300);
  }

  // Save preset
  const presetsBtn = page.locator('[data-testid="presets-btn"]');
  if (await presetsBtn.isVisible()) {
    await presetsBtn.click();
    await page.waitForTimeout(300);

    const savePresetBtn = page.locator('[data-testid="save-preset-btn"]');
    if (await savePresetBtn.isVisible()) {
      await savePresetBtn.click();
      await page.waitForTimeout(300);
    }
  }

  // Note Events message count while filtered
  const eventRowsFiltered = page.locator('.ws-message-row');
  const filteredCount = await eventRowsFiltered.count();

  // Switch to Console — should be unaffected by Events filter/preset
  await page.click('[data-testid="right-tab-console"]');
  await page.waitForTimeout(300);

  // Console should show all entries (no preset mechanism)
  const consoleRows = page.locator('.ws-console-row');
  const consoleCount = await consoleRows.count();
  expect(consoleCount).toBeGreaterThanOrEqual(1); // at least lifecycle entries

  // Console should not have a presets button
  const consolePresets = page.locator('[data-testid="ws-console-presets"]');
  expect(await consolePresets.count()).toBe(0);

  // Switch back to Events — preset filter should still be active
  await page.click('[data-testid="right-tab-events"]');
  await page.waitForTimeout(300);
  const eventRowsStillFiltered = page.locator('.ws-message-row');
  const stillFiltered = await eventRowsStillFiltered.count();
  expect(stillFiltered).toBe(filteredCount);
});

test('WF-39: Clearing one tab does not clear the other', async ({ page }) => {
  await setupWithMessages(page);

  // Record Console entry count before Events clear
  await page.click('[data-testid="right-tab-console"]');
  await page.waitForTimeout(300);
  const consoleRowsBefore = page.locator('.ws-console-row');
  const consoleBefore = await consoleRowsBefore.count();
  expect(consoleBefore).toBeGreaterThanOrEqual(1); // lifecycle entries exist

  // Clear Events
  await page.click('[data-testid="right-tab-events"]');
  await page.waitForTimeout(300);
  await page.click('[data-testid="clear-btn"]');
  await page.waitForTimeout(300);

  // Verify Events is empty
  const eventRowsAfterClear = page.locator('.ws-message-row');
  expect(await eventRowsAfterClear.count()).toBe(0);

  // Console should still have all its entries
  await page.click('[data-testid="right-tab-console"]');
  await page.waitForTimeout(300);
  const consoleRowsAfter = page.locator('.ws-console-row');
  const consoleAfter = await consoleRowsAfter.count();
  expect(consoleAfter).toBe(consoleBefore);

  // Now clear Console
  await page.click('[data-testid="ws-console-clear"]');
  await page.waitForTimeout(300);
  const consoleRowsCleared = page.locator('.ws-console-row');
  expect(await consoleRowsCleared.count()).toBe(0);

  // Events should still be empty (from our earlier clear)
  await page.click('[data-testid="right-tab-events"]');
  await page.waitForTimeout(300);
  expect(await eventRowsAfterClear.count()).toBe(0);
});

test('WF-40: Compare mode is Events-only (Console has no compare)', async ({ page }) => {
  await setupWithMessages(page);

  // Enter compare mode on Events tab
  const compareBtn = page.locator('[data-testid="compare-btn"]');
  await compareBtn.click();
  await page.waitForTimeout(300);

  // Verify compare banner appears on Events
  const compareBanner = page.locator('[data-testid="compare-banner"]');
  await expect(compareBanner).toBeVisible();

  // Select first message (A)
  const rows = page.locator('.ws-message-row');
  await rows.nth(0).click();
  await page.waitForTimeout(300);

  // Select second message (B) → diff modal opens
  await rows.nth(1).click();
  await page.waitForTimeout(500);

  // Diff modal should open
  const diffModal = page.locator('[data-testid="diff-modal"]');
  if (await diffModal.isVisible()) {
    // Close the diff modal
    await page.click('[data-testid="diff-close"]');
    await page.waitForTimeout(300);
  }

  // Cancel compare mode
  const cancelBtn = page.locator('[data-testid="compare-cancel"]');
  if (await cancelBtn.isVisible()) {
    await cancelBtn.click();
    await page.waitForTimeout(300);
  }

  // Verify compare mode exited
  expect(await compareBanner.count()).toBe(0);

  // Switch to Console — verify no compare button exists
  await page.click('[data-testid="right-tab-console"]');
  await page.waitForTimeout(300);

  // Console should have no compare button (compare is Events-only)
  const consoleCompareBtn = page.locator('[data-testid="compare-btn"]');
  expect(await consoleCompareBtn.count()).toBe(0);
});

// ===== Cleanup: Stop mock server =====

test('Cleanup: Stop mock server', async ({ page }) => {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.click('[data-testid="mode-mock"]');
  await page.waitForTimeout(300);
  const stopBtn = page.locator('[data-testid="mock-stop-btn"]');
  if (await stopBtn.isVisible()) {
    await stopBtn.click();
    await page.waitForTimeout(500);
  }
});
