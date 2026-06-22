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
 *     await skipReadingPause(page);                  // start step 4 action
 *     await waitForActionPhase(page);
 *     await page.waitForSelector('.wf-config-modal');
 *     await assertNodeNotSelected(page, '.react-flow__node-wsConnect');
 *   });
 *
 * ─── KEY SYNCHRONISATION CONTRACT ───────────────────────────────────────────
 * The demo player has two phases per step:
 *   READING  — Next button enabled  (user reads the description)
 *   ACTION   — Next button disabled (the step's action() is running)
 *
 * waitForReadingPhase() is the canonical gate for when the Next button is
 * enabled. To run a step's action(), use completeCurrentStepAction() or
 * runNextStep() — never click Next during reading (that aborts the action).
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
  category: 'Kafka' | 'WebSocket' | 'SSE' | 'GraphQL',
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

/** Click "Start Demo" and wait for the live panel + first step reading phase. */
export async function startLesson(page: Page): Promise<void> {
  const startBtn = page.locator('.demo-start-btn');
  await expect(startBtn).toBeEnabled({ timeout: HUB_TIMEOUT });
  await startBtn.click();
  await page.waitForSelector('.demo-live-panel', { timeout: HUB_TIMEOUT });
  // startLiveDemo kicks off step 0 asynchronously — wait until it reaches reading.
  await waitForReadingPhase(page, RESTART_TIMEOUT);
}

/**
 * Full one-call navigation: Demo Hub → Protocols → category → lesson → Start.
 * This is the entry point for almost every demo validation spec.
 */
export async function launchLesson(
  page: Page,
  category: 'Kafka' | 'WebSocket' | 'SSE' | 'GraphQL',
  lessonNameFragment: string,
): Promise<void> {
  await openDemoHub(page);
  await selectProtocolsDomain(page);
  await selectCategory(page, category);
  await openLesson(page, lessonNameFragment);
  await startLesson(page);
}

/** Wait for a Docker PrerequisiteGate to report the server is up (enables Start Demo). */
export async function waitForPrerequisiteGateUp(
  page: Page,
  timeout = 20_000,
): Promise<void> {
  const gate = page.locator('[data-testid="prereq-gate"]');
  if ((await gate.count()) === 0) return;
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-testid="prereq-status"]')
        ?.classList.contains('prereq-status--up') === true,
    { timeout },
  );
}

/**
 * Demo Hub → Protocols → GraphQL → lesson → prerequisite gate → Start.
 * Use for Docker-gated GraphQL demo lessons (e.g. gql-first-query on port 4010).
 */
export async function launchGqlLesson(
  page: Page,
  lessonNameFragment: string,
): Promise<void> {
  await openDemoHub(page);
  await selectProtocolsDomain(page);
  await selectCategory(page, 'GraphQL');
  await openLesson(page, lessonNameFragment);
  await waitForPrerequisiteGateUp(page);
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

/** Click the skippable reading badge when the step is still in reading phase. */
export async function skipReadingPause(page: Page): Promise<void> {
  const badge = page.locator('.demo-live-phase-badge.skippable');
  if (await badge.isVisible({ timeout: 500 }).catch(() => false)) {
    await badge.click();
  }
}

/** Wait until the step action pipeline disables the Next button. */
export async function waitForActionPhase(page: Page, timeout = 5_000): Promise<void> {
  await page.waitForFunction(
    () => {
      const btn = document.querySelector('[aria-label="Next step"]') as HTMLButtonElement | null;
      return btn !== null && btn.disabled;
    },
    { timeout },
  ).catch(() => { /* zero-action observation step */ });
}

/**
 * Skip the reading pause (if skippable) and wait for the current step's action
 * to finish. Does not advance the step index — use runNextStep for that.
 *
 * IMPORTANT: Clicking the Next button during reading aborts the step before its
 * action runs. Always call this (or runNextStep) instead of clicking Next directly.
 */
export async function completeCurrentStepAction(
  page: Page,
  actionTimeoutMs = STEP_TIMEOUT,
): Promise<void> {
  await waitForReadingPhase(page, actionTimeoutMs);
  const phase = await page
    .locator('[data-testid="demo-live-panel"]')
    .getAttribute('data-step-phase');
  if (phase === 'reading') {
    await skipReadingPause(page);
  }
  await page.waitForFunction(
    () =>
      document.querySelector('[data-testid="demo-live-panel"]')?.getAttribute('data-step-phase') === 'done',
    { timeout: actionTimeoutMs },
  );
}

/**
 * Complete the current step (reading + action), click Next, and wait for the
 * following step to reach its reading phase.
 */
export async function runNextStep(
  page: Page,
  actionTimeoutMs = STEP_TIMEOUT,
): Promise<void> {
  await completeCurrentStepAction(page, actionTimeoutMs);
  await page.locator('[aria-label="Next step"]').click();
  await waitForReadingPhase(page, actionTimeoutMs);
}

/**
 * Advance through N steps in sequence, waiting for each action to complete.
 * Use this to reach a specific step quickly without caring about intermediate
 * state (e.g. advance to step 4 to test the config modal fix).
 */
export async function advanceSteps(
  page: Page,
  count: number,
  actionTimeoutMs = STEP_TIMEOUT,
): Promise<void> {
  for (let i = 0; i < count; i++) {
    await runNextStep(page, actionTimeoutMs);
  }
}

/**
 * Finish the current demo step (skip reading → wait for action/verify → done).
 * Safe on the last step where Next stays disabled after done.
 *
 * Demo E2E: on step N/N, Next is NEVER enabled — use this instead of runNextStep.
 * See e2e/DEMO-LESSON-E2E-MEMO.md §1.
 */
export async function finishDemoStep(
  page: Page,
  actionTimeoutMs = STEP_TIMEOUT,
): Promise<void> {
  const panelSel = '[data-testid="demo-live-panel"]';
  const readPhase = async () =>
    page.locator(panelSel).getAttribute('data-step-phase');

  let phase = await readPhase();
  if (phase === 'done') return;

  if (phase !== 'reading') {
    await page.waitForFunction(
      (sel) => {
        const p = document.querySelector(sel)?.getAttribute('data-step-phase');
        return p === 'reading' || p === 'done';
      },
      panelSel,
      { timeout: actionTimeoutMs },
    );
    phase = await readPhase();
    if (phase === 'done') return;
  }

  await skipReadingPause(page);
  await page.waitForFunction(
    (sel) => document.querySelector(sel)?.getAttribute('data-step-phase') === 'done',
    panelSel,
    { timeout: actionTimeoutMs },
  );
}

/** Advance through every step of a live demo lesson (reading skipped via badge). */
export async function playThroughLesson(
  page: Page,
  totalSteps: number,
  actionTimeoutMs = STEP_TIMEOUT,
): Promise<void> {
  // runNextStep ends with waitForReadingPhase, but Next is always disabled on the
  // last step (isLast). Advance through penultimate step, then finish the final one.
  for (let i = 0; i < totalSteps - 2; i++) {
    await runNextStep(page, actionTimeoutMs);
  }
  await completeCurrentStepAction(page, actionTimeoutMs);
  await page.locator('[aria-label="Next step"]').click();
  await finishDemoStep(page, actionTimeoutMs);
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
  const dir = path.resolve(process.cwd(), 'e2e/screenshots');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const safe = name.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  const ts   = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  await page.screenshot({ path: path.join(dir, `${safe}-${ts}.png`) });
}
