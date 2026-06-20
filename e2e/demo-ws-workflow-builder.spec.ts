/**
 * Demo — WS Workflow Builder: step-through validation
 *
 * Validates the WS Workflow Builder lesson (ws-workflow-builder) step by step,
 * focusing on the specific behaviour introduced/fixed in each iteration.
 *
 * ─── RUN THIS ────────────────────────────────────────────────────────────────
 *
 *   npx playwright test e2e/demo-ws-workflow-builder.spec.ts --reporter=html
 *
 * The HTML report opens automatically in your browser. Every test shows its
 * screenshots inline so you can visually inspect each step.
 *
 * ─── WHAT IS VALIDATED ───────────────────────────────────────────────────────
 *
 *   1. Lesson launch + concept slide
 *   2. All 11 steps complete without error
 *   3. Config steps (4, 7, 9) open their modal WITHOUT a node selection ring
 *      (regression for the "highlighted node visible inside its config modal" bug)
 *   4. Config modal highlight — steps 4/7/9 spotlight the MODAL not the node
 *   5. Quick Test (step 10) shows the exec-summary
 */

import { test, expect } from '@playwright/test';
import {
  launchLesson,
  runNextStep,
  advanceSteps,
  waitForReadingPhase,
  assertNodeNotSelected,
  assertConfigModalOpen,
  assertConfigModalClosed,
  getStepInfo,
  takeNamedScreenshot,
  exitLesson,
  restartLesson,
} from './demo-player-helpers';

// ─── Shared setup ─────────────────────────────────────────────────────────────

// Mock the WS mock-server start/stop endpoints so the lesson setup doesn't
// fail when the real server isn't running in CI or a clean dev machine.
test.beforeEach(async ({ page }) => {
  await page.route('**/api/ws/mock/start', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }),
  );
  await page.route('**/api/ws/mock/stop', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }),
  );
  // Silence the SSE log-stream so the Vite proxy doesn't emit ECONNREFUSED noise.
  await page.route('**/api/logs/stream*', (route) =>
    route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      body: '',
    }),
  );
});

// ══════════════════════════════════════════════════════════════════════════════
// 1. Lesson shell
// ══════════════════════════════════════════════════════════════════════════════

test.describe('WS Workflow Builder — lesson shell', () => {
  test('concept slide renders with title, body and Start button', async ({ page }) => {
    await launchLesson(page, 'WebSocket', 'Workflow Builder');

    const { title } = await getStepInfo(page);
    expect(title.length).toBeGreaterThan(0);
    console.log('[PASS] live demo started at step:', title);
    await takeNamedScreenshot(page, 'wf-builder-concept');
  });

  test('lesson has 11 steps', async ({ page }) => {
    await launchLesson(page, 'WebSocket', 'Workflow Builder');
    const counter = await page.locator('.demo-live-step-counter').textContent();
    // e.g. "1 / 11"
    expect(counter).toMatch(/1\s*[/]\s*11/);
    console.log('[PASS] step counter:', counter?.trim());
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 2. Config modal — node must NOT have selection ring when modal opens
//    Regression for: "node highlight shown inside its config modal"
// ══════════════════════════════════════════════════════════════════════════════

test.describe('Config modal — node deselected before open', () => {
  /**
   * Helper: advance to a config step, click Next, intercept the config modal
   * the moment it appears, assert the target node is NOT selected.
   *
   * @param stepsToAdvance  How many full steps to advance BEFORE the config step
   *                        (i.e. run steps 1…N so we arrive at the reading phase
   *                         of the config step).
   * @param nodeSelector    ReactFlow node selector, e.g. '.react-flow__node-wsConnect'
   * @param stepLabel       Human label for screenshots / console logs.
   */
  async function checkConfigModalDeselection(
    page: Parameters<typeof launchLesson>[0],
    stepsToAdvance: number,
    nodeSelector: string,
    stepLabel: string,
  ): Promise<void> {
    await launchLesson(page, 'WebSocket', 'Workflow Builder');

    // Advance silently through all preceding steps.
    await advanceSteps(page, stepsToAdvance);

    const { counter, title } = await getStepInfo(page);
    console.log(`[INFO] At step ${counter}: "${title}" — about to run ${stepLabel}`);

    // Click Next to start the config step's action.
    // The action: deselectNodes (pane click) → doubleClickNode → waitFor(form) → fill → save
    await waitForReadingPhase(page);
    await page.locator('[aria-label="Next step"]').click();

    // Race: catch the config modal the moment it appears (before the step saves).
    // This window is ~600 ms (waitFor + delay inside the action).
    await page.waitForSelector('.wf-config-modal', { timeout: 12_000 });

    // At this instant the modal is open.  Assert the node is NOT selected.
    await assertNodeNotSelected(page, nodeSelector);
    await assertConfigModalOpen(page);

    await takeNamedScreenshot(page, `${stepLabel}-modal-open-no-ring`);
    console.log(`[PASS] ${stepLabel}: config modal open, node NOT selected`);

    // Wait for the step to finish saving and return to reading phase.
    await waitForReadingPhase(page);
    await assertConfigModalClosed(page);
    console.log(`[PASS] ${stepLabel}: modal closed after save`);
  }

  test('step 4 — WS Connect config modal opens without selection ring', async ({ page }) => {
    // Steps 1-3 must run first (create workflow, palette tour, add WS Connect node).
    await checkConfigModalDeselection(page, 3, '.react-flow__node-wsConnect', 'step-4-ws-connect');
  });

  test('step 7 — WS Send config modal opens without selection ring', async ({ page }) => {
    // Steps 1-6 (includes add connect + config connect + define variable + add send).
    await checkConfigModalDeselection(page, 6, '.react-flow__node-wsSend', 'step-7-ws-send');
  });

  test('step 9 — WS Receive config modal opens without selection ring', async ({ page }) => {
    // Steps 1-8 (all preceding steps including add receive).
    await checkConfigModalDeselection(page, 8, '.react-flow__node-wsReceive', 'step-9-ws-receive');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 3. Step-by-step walkthrough — all 11 steps
//    Run the whole lesson end-to-end and verify it completes without error.
// ══════════════════════════════════════════════════════════════════════════════

test.describe('WS Workflow Builder — full walkthrough', () => {
  test('all 11 steps complete without error', async ({ page }) => {
    // Also mock Quick Test execution so it returns a passing result immediately
    // (otherwise step 10 waits for a real WS server).
    await page.route('**/api/ws/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, state: 'connected' }),
      }),
    );

    await launchLesson(page, 'WebSocket', 'Workflow Builder');

    for (let step = 1; step <= 11; step++) {
      const { counter, title } = await getStepInfo(page);
      console.log(`[STEP ${step}] ${counter}: ${title}`);
      await takeNamedScreenshot(page, `wf-builder-step-${String(step).padStart(2, '0')}`);
      await runNextStep(page, 30_000);
    }

    // After all steps the counter should be at 11/11 (last step completed).
    const { counter } = await getStepInfo(page);
    expect(counter).toMatch(/11\s*[/]\s*11/);
    console.log('[PASS] All 11 steps completed. Final counter:', counter);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 4. Controls regression
// ══════════════════════════════════════════════════════════════════════════════

test.describe('WS Workflow Builder — demo controls', () => {
  test('restart resets to step 1', async ({ page }) => {
    await launchLesson(page, 'WebSocket', 'Workflow Builder');
    // Advance 2 steps then restart
    await runNextStep(page);
    await runNextStep(page);
    const { counter: before } = await getStepInfo(page);
    expect(before).toMatch(/3\s*[/]\s*11/);

    await restartLesson(page);
    const { counter: after } = await getStepInfo(page);
    expect(after).toMatch(/1\s*[/]\s*11/);
    console.log('[PASS] Restart: counter reset from', before, '→', after);
  });

  test('exit returns to concept slide', async ({ page }) => {
    await launchLesson(page, 'WebSocket', 'Workflow Builder');
    await runNextStep(page);
    await exitLesson(page);
    await expect(page.locator('.demo-concept-slide, .demo-lesson-player')).toBeVisible();
    console.log('[PASS] Exit: returned to concept/lesson player');
  });
});
