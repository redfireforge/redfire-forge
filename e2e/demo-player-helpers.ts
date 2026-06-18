/**
 * demo-player-helpers.ts
 *
 * Reusable Playwright helpers for demo lesson validation.
 *
 * ─── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
 * Agents were repeatedly discovering the Demo Hub DOM from scratch using the
 * Playwright MCP tool in a trial-and-error loop (navigate → evaluate → sleep →
 * screenshot). This is fragile, slow, and non-reusable.
 *
 * Instead: write one reusable spec and run it repeatedly:
 *
 *   npx playwright test e2e/demo-ws-workflow-builder.spec.ts --reporter=html
 *
 * The HTML report opens automatically and shows every screenshot + assertion
 * result in one page.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────
 *
 *   import { launchLesson, advanceSteps, runNextStep, assertNodeNotSelected }
 *     from './demo-player-helpers';
 *
 *   test('node is not selected when config modal opens', async ({ page }) => {
 *     await launchLesson(page, 'WebSocket', 'Workflow Builder');
 *     await advanceSteps(page, 3);                   // steps 1-3
 *     await page.locator('[aria-label="Next step"]').click();
 *     await page.waitForSelector('.wf-config-modal');
 *     await assertNodeNotSelected(page, '.react-flow__node-wsConnect');
 *   });
 *
 * ─── KEY SYNCHRONISATION CONTRACT ───────────────────────────────────────────
 * The demo player has two phases per step:
 *   READING  — Next button enabled  (user reads the description)
 *   ACTION   — Next button disabled (the step's action() is running)
 *
 * waitForReadingPhase() is the canonical gate — always use it instead of
 * arbitrary page.waitForTimeout() calls.
 */

import { type Page, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// ─── Timeouts ─────────────────────────────────────────────────────────────────

const HUB_TIMEOUT       = 10_000;  // demo hub DOM ready
const STEP_TIMEOUT      = 25_000;  // one step action (some steps have long waits)
const RESTART_TIMEOUT   = 30_000;  // restart includes cleanup + setup

// ─── Navigation helpers ───────────────────────────────────────────────────────

/** Navigate to the root page and open the Demo Hub pane. */
export async function openDemoHub(page: Page): Promise<void> {
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await page.locator('[title="Demo Hub"]').click();
  await page.waitForSelector('.demo-domain-card', { timeout: HUB_TIMEOUT });
}

/** Click the first non-Coming-Soon domain card (Protocols). */
export async function selectProtocolsDomain(page: Page): Promise<void> {
  const card = page
    .locator('.demo-domain-card')
    .filter({ hasNot: page.locator('.coming-soon') })
    .first();
  await card.click();
  await page.waitForSelector('.demo-lesson-list', { timeout: HUB_TIMEOUT });
}

/** Click a category tab by name. */
export async function selectCategory(
  page: Page,
  category: 'Kafka' | 'WebSocket' | 'SSE',
): Promise<void> {
  const tab = page
    .locator('.demo-category-tab')
    .filter({ hasText: new RegExp(category, 'i') });
  if (await tab.count() > 0) {
    await tab.click();
    await page.waitForTimeout(300);
  }
}

/** Click a lesson item by name fragment and wait for the lesson player. */
export async function openLesson(
  page: Page,
  lessonNameFragment: string,
): Promise<void> {
  const item = page
    .locator('.demo-lesson-item')
    .filter({ hasText: lessonNameFragment })
    .first();
  await expect(item).toBeVisible({ timeout: HUB_TIMEOUT });
  await item.click();
  await page.waitForSelector('.demo-lesson-player', { timeout: HUB_TIMEOUT });
}

/** Click "Start Demo" and wait for the live panel to appear. */
export async function startLesson(page: Page): Promise<void> {
  const startBtn = page.locator('.demo-start-btn');
  await expect(startBtn).toBeEnabled({ timeout: HUB_TIMEOUT });
  await startBtn.click();
  await page.waitForSelector('.demo-live-panel', { timeout: HUB_TIMEOUT });
}

/**
 * Full one-call navigation: Demo Hub → Protocols → category → lesson → Start.
 * This is the entry point for almost every demo validation spec.
 */
export async function launchLesson(
  page: Page,
  category: 'Kafka' | 'WebSocket' | 'SSE',
  lessonNameFragment: string,
): Promise<void> {
  await openDemoHub(page);
  await selectProtocolsDomain(page);
  await selectCategory(page, category);
  await openLesson(page, lessonNameFragment);
  await startLesson(page);
}

// ─── Step control ─────────────────────────────────────────────────────────────

/**
 * Wait until the demo enters its READING phase (Next button enabled).
 * This is the canonical synchronisation gate — prefer it over any
 * page.waitForTimeout() calls.
 */
export async function waitForReadingPhase(
  page: Page,
  timeout = STEP_TIMEOUT,
): Promise<void> {
  await page.waitForFunction(
    () => {
      const btn = document.querySelector('[aria-label="Next step"]') as HTMLButtonElement | null;
      return btn !== null && !btn.disabled;
    },
    { timeout },
  );
}

/**
 * Click Next and wait for the full action → reading cycle to complete.
 * After this call the step's action has run and the player is ready for the
 * next step.
 */
export async function runNextStep(
  page: Page,
  actionTimeoutMs = STEP_TIMEOUT,
): Promise<void> {
  await waitForReadingPhase(page);
  await page.locator('[aria-label="Next step"]').click();
  // Wait for action phase to start (Next becomes disabled); some zero-action
  // steps skip this so we tolerate failure.
  await page.waitForFunction(
    () => {
      const btn = document.querySelector('[aria-label="Next step"]') as HTMLButtonElement | null;
      return btn !== null && btn.disabled;
    },
    { timeout: 3_000 },
  ).catch(() => { /* zero-action observation step — already in reading */ });
  // Wait for the action to finish and reading phase to begin.
  await waitForReadingPhase(page, actionTimeoutMs);
}

/**
 * Advance through N steps in sequence, waiting for each action to complete.
 * Use this to reach a specific step quickly without caring about intermediate
 * state (e.g. advance to step 4 to test the config modal fix).
 */
export async function advanceSteps(page: Page, count: number): Promise<void> {
  for (let i = 0; i < count; i++) {
    await runNextStep(page);
  }
}

/** Click the restart button and wait for setup + reading phase. */
export async function restartLesson(page: Page): Promise<void> {
  await page.locator('.demo-live-restart-btn').click();
  await waitForReadingPhase(page, RESTART_TIMEOUT);
}

/** Click exit and wait for the lesson player to reappear. */
export async function exitLesson(page: Page): Promise<void> {
  await page.locator('.demo-live-exit-btn').click();
  await expect(page.locator('.demo-lesson-player')).toBeVisible({ timeout: 15_000 });
}

// ─── State inspection ─────────────────────────────────────────────────────────

/** Return `{ counter, title }` for the current live step (e.g. "4 / 11", "Configure the Connection"). */
export async function getStepInfo(page: Page): Promise<{ counter: string; title: string }> {
  const counter = await page.locator('.demo-live-step-counter').textContent().catch(() => '?/?');
  const title   = await page.locator('.demo-live-step-title').textContent().catch(() => '');
  return { counter: (counter ?? '').trim(), title: (title ?? '').trim() };
}

// ─── Assertions ───────────────────────────────────────────────────────────────

/**
 * Assert that a ReactFlow canvas node does NOT have the `.selected` class.
 * Use this to verify a node's highlight/selection ring was cleared before its
 * config modal was opened.
 */
export async function assertNodeNotSelected(
  page: Page,
  nodeSelector: string,
): Promise<void> {
  const hasSelected = await page
    .locator(nodeSelector)
    .evaluate((el) => el.classList.contains('selected'))
    .catch(() => false);
  expect(
    hasSelected,
    `Expected node "${nodeSelector}" to NOT have .selected class`,
  ).toBe(false);
}

/**
 * Assert a workflow config modal IS visible.
 * Useful to confirm the double-click opened it correctly.
 */
export async function assertConfigModalOpen(page: Page): Promise<void> {
  await expect(page.locator('.wf-config-modal')).toBeVisible({ timeout: 5_000 });
}

/**
 * Assert a workflow config modal is NOT visible.
 * Useful to confirm Save/Close dismissed it cleanly.
 */
export async function assertConfigModalClosed(page: Page): Promise<void> {
  await expect(page.locator('.wf-config-modal')).not.toBeVisible({ timeout: 3_000 });
}

// ─── Screenshot helpers ───────────────────────────────────────────────────────

/**
 * Take a named screenshot into e2e/screenshots/.
 * The filename is sanitised and timestamped so screenshots don't overwrite
 * each other across runs.
 *
 * Screenshots are gitignored; they exist only for local debugging.
 */
export async function takeNamedScreenshot(page: Page, name: string): Promise<void> {
  const dir = path.resolve(__dirname, 'screenshots');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const safe = name.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  const ts   = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  await page.screenshot({ path: path.join(dir, `${safe}-${ts}.png`) });
}
