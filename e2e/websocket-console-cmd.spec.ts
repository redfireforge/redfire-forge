import { test, expect } from '@playwright/test';
import { seedAppData } from './helpers';

/**
 * Phase 10 — console command line E2E for the redesigned WebSocket studio.
 * Opens the Console right-pane tab and exercises the
 * command line end-to-end in a real browser: the input + hint render, `/help`
 * echoes and lists commands, ↑ recalls history, and `/clear` empties the log.
 *
 * The shell chrome renders without a live backend, so these checks drive the
 * `useConsoleCommands` dispatch + the `ConsolePanel` command line UI.
 */
test.describe('WebSocket console command line (Phase 10)', () => {
  test.beforeEach(async ({ page }) => {
    await seedAppData(page);
    await page.goto('/?tab=websocket-studio', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="ws-studio-shell"]')).toBeVisible({ timeout: 20000 });

    // Open the Console right-pane tab.
    await page.locator('#ws-right-tab-console').click();
    await expect(page.locator('[data-testid="ws-console"]')).toBeVisible();
  });

  test('renders the command line with prompt, input, and hint', async ({ page }) => {
    await expect(page.locator('[data-testid="ws-console-cmd"]')).toBeVisible();
    const input = page.locator('[data-testid="ws-console-cmd-input"]');
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute('aria-label', 'Console command line');
    await expect(page.locator('.ws-console-cmd-hint')).toContainText('/help');
  });

  test('/help echoes the command and lists the available commands', async ({ page }) => {
    const input = page.locator('[data-testid="ws-console-cmd-input"]');
    await input.click();
    await input.fill('/help');
    await input.press('Enter');

    // Input clears after submit.
    await expect(input).toHaveValue('');
    const body = page.locator('[data-testid="ws-console"] .ws-console-body');
    await expect(body).toContainText('/help');
    await expect(body).toContainText('Available commands');
  });

  test('recalls the previous command with ArrowUp', async ({ page }) => {
    const input = page.locator('[data-testid="ws-console-cmd-input"]');
    await input.click();
    await input.fill('/help');
    await input.press('Enter');
    await expect(input).toHaveValue('');

    await input.press('ArrowUp');
    await expect(input).toHaveValue('/help');
  });

  test('/connect echoes and reports a connecting result', async ({ page }) => {
    const input = page.locator('[data-testid="ws-console-cmd-input"]');
    await input.click();
    await input.fill('/connect ws://localhost:9');
    await input.press('Enter');

    const body = page.locator('[data-testid="ws-console"] .ws-console-body');
    await expect(body).toContainText('/connect ws://localhost:9');
    await expect(body).toContainText('Connecting to ws://localhost:9');
  });

  test('/clear empties the console', async ({ page }) => {
    const input = page.locator('[data-testid="ws-console-cmd-input"]');
    await input.click();
    await input.fill('/help');
    await input.press('Enter');
    const body = page.locator('[data-testid="ws-console"] .ws-console-body');
    await expect(body).toContainText('Available commands');

    await input.fill('/clear');
    await input.press('Enter');
    await expect(page.locator('[data-testid="ws-console-empty"]')).toBeVisible();
  });
});
