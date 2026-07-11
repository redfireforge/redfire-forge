/**
 * WebSocket Basics — Environment Manager validation.
 *
 * Validates the EM-first lesson flow:
 *  - WebSocket-only ws-demo microservice (no HTTP tab)
 *  - WebSocket Demo environment deployed (not d01)
 *  - Connect tab uses {{wsBaseUrl}} after EM + header setup
 *
 * Run:
 *   npx playwright test --project=demo-stepthrough e2e/ws-basics-em.spec.ts --reporter=html
 */
import { test, expect } from '@playwright/test';
import { visibleWsUrlInput } from './helpers';
import {
  launchLesson,
  advanceSteps,
  restartLesson,
  completeCurrentStepAction,
  getStepInfo,
} from './demo-player-helpers';

test.describe('WebSocket Basics — lesson shell', () => {
  test('lesson has 12 steps', async ({ page }) => {
    await launchLesson(page, 'WebSocket', 'WebSocket Basics');
    const counter = await page.locator('.demo-live-step-counter').textContent();
    expect(counter).toMatch(/1\s*[/]\s*12/);
    const { title } = await getStepInfo(page);
    expect(title).toMatch(/Welcome/i);
  });
});

test.describe('WebSocket Basics — Environment Manager', () => {
  test('ws-demo is WebSocket-only with WebSocket Demo deployed', async ({ page }) => {
    test.setTimeout(120_000);
    await launchLesson(page, 'WebSocket', 'WebSocket Basics');
    await restartLesson(page);
    // Steps 1–2 complete (actions ran); step 3 reading begins on EM.
    await advanceSteps(page, 2, 90_000);

    await expect(page.locator('.env-manager')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-env-name="WebSocket Demo"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-svc-name="ws-demo"]')).toBeVisible();
    await expect(page.locator('[data-testid="em-protocol-tab-http"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="em-protocol-tab-websocket"]')).toBeVisible();

    const wsDemoRow = page.locator('tr').filter({ hasText: 'WebSocket Demo' });
    await expect(wsDemoRow.locator('input[type="checkbox"]')).toBeChecked();

    // Step 3 action saves ws://localhost:9876 on the WebSocket Demo row.
    await completeCurrentStepAction(page, 90_000);
    await expect(wsDemoRow.locator('code.em-url-text')).toContainText('ws://localhost:9876');

    const d01Row = page.locator('tr').filter({ hasText: /^d01$/ });
    if (await d01Row.count()) {
      await expect(d01Row.locator('input[type="checkbox"]')).not.toBeChecked();
    }

    await expect(page.locator('[data-testid="derived-vars-websocket"]')).toContainText('{{wsBaseUrl}}');
  });

  test('connect tab uses {{wsBaseUrl}} after EM and header setup', async ({ page }) => {
    test.setTimeout(240_000);
    await launchLesson(page, 'WebSocket', 'WebSocket Basics');
    await restartLesson(page);
    // Through step 6 reading (mock + header + env-vars intro).
    await advanceSteps(page, 5, 90_000);
    // Step 6 action fills {{wsBaseUrl}} on the Connect tab.
    await completeCurrentStepAction(page, 90_000);
    await expect(visibleWsUrlInput(page)).toHaveValue('{{wsBaseUrl}}');
  });
});
