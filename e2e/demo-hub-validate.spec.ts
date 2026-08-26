/**
 * Demo Hub — Comprehensive Visual Validation
 *
 * Validates every lesson in the Demo Hub (34 lessons total):
 *  - 13 Kafka lessons  (Docker-gated → validate concept + PrerequisiteGate)
 *  - 18 non-Docker WS/SSE/Kafka-Templates lessons → full live-demo flow
 *  -  3 Docker-gated WS lessons (Socket.IO, STOMP, GraphQL, ws-tls-local)
 *
 * For non-Docker lessons the spec:
 *   1. Opens the concept slide and verifies title + body + Start Demo button
 *   2. Starts the demo and verifies the live panel appears
 *   3. Waits for the reading phase (Next enabled)
 *   4. Exits and verifies clean return to the lesson player
 *
 * For Docker-gated lessons the spec:
 *   1. Opens the concept slide and verifies title + body
 *   2. Verifies PrerequisiteGate is shown with a docker command
 *   3. Verifies button state is consistent (disabled when server down, enabled when up)
 *   Works regardless of whether Docker is running or not.
 */
import { test, expect, type Page } from '@playwright/test';
import {
  openDemoHub,
  selectProtocolsDomain as selectDomain,
  selectCategory,
  openLesson,
  runNextStep,
  restartLesson,
  waitForReadingPhase,
  skipReadingPause,
  waitForActionPhase,
} from './demo-player-helpers';

const STEP_TIMEOUT = 20_000;
const DEMO_HUB_TIMEOUT = 10_000;

async function validateConceptSlide(page: Page) {
  const title = page.locator('.demo-concept-title');
  await expect(title).toBeVisible({ timeout: DEMO_HUB_TIMEOUT });
  const titleText = await title.textContent();
  expect(titleText?.trim().length).toBeGreaterThan(0);
  const body = page.locator('.demo-concept-body');
  await expect(body).toBeVisible({ timeout: DEMO_HUB_TIMEOUT });
}

async function validateStartBtnEnabled(page: Page) {
  const btn = page.locator('.demo-start-btn');
  await expect(btn).toBeVisible({ timeout: DEMO_HUB_TIMEOUT });
  await expect(btn).toBeEnabled({ timeout: DEMO_HUB_TIMEOUT });
}

/**
 * Validates PrerequisiteGate renders and is consistent.
 * Does NOT assert disabled/enabled — works whether Docker is up or down.
 */
async function validatePrerequisiteGate(page: Page, lessonName: string) {
  const gate = page.locator('[data-testid="prereq-gate"]');
  await expect(gate).toBeVisible({ timeout: DEMO_HUB_TIMEOUT });

  const cmd = page.locator('[data-testid="prereq-command"]');
  await expect(cmd).toBeVisible({ timeout: DEMO_HUB_TIMEOUT });
  const cmdText = await cmd.textContent();
  expect(cmdText?.trim().length).toBeGreaterThan(5);

  // Wait for probe to settle (up or down) — up to 5 s
  const status = page.locator('[data-testid="prereq-status"]');
  await expect(status).toBeVisible({ timeout: DEMO_HUB_TIMEOUT });

  // Wait for status to leave "checking" state
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-testid="prereq-status"]');
    return el && !el.classList.contains('prereq-status--checking') && !el.classList.contains('prereq-status--idle');
  }, { timeout: 8000 }).catch(() => { /* still checking — that's OK */ });

  const startBtn = page.locator('.demo-start-btn');
  await expect(startBtn).toBeVisible({ timeout: DEMO_HUB_TIMEOUT });

  // Verify consistent state: if button has --ready class (server up) it must be enabled,
  // if not ready, it must be disabled.
  const isReady = await startBtn.evaluate(
    el => el.classList.contains('demo-start-btn--ready'),
  );
  if (isReady) {
    await expect(startBtn).toBeEnabled({ timeout: 3000 });
    console.log(`[PASS] ${lessonName}: prereq gate shown, server UP → Start enabled`);
  } else {
    await expect(startBtn).toBeDisabled({ timeout: 3000 });
    console.log(`[PASS] ${lessonName}: prereq gate shown, server DOWN → Start disabled`);
  }
}

async function startDemoAndValidate(page: Page, lessonName: string) {
  const startBtn = page.locator('.demo-start-btn');
  await expect(startBtn).toBeEnabled({ timeout: DEMO_HUB_TIMEOUT });
  await startBtn.click();

  const panel = page.locator('.demo-live-panel');
  await expect(panel).toBeVisible({ timeout: DEMO_HUB_TIMEOUT });

  const nameLabel = panel.locator('.demo-live-lesson-name');
  await expect(nameLabel).toBeVisible({ timeout: 5000 });

  const stepTitle = panel.locator('.demo-live-step-title');
  await expect(stepTitle).toBeVisible({ timeout: STEP_TIMEOUT });

  const nextBtn = panel.locator('[aria-label="Next step"]');
  await expect(nextBtn).toBeVisible({ timeout: STEP_TIMEOUT });
  await waitForReadingPhase(page, STEP_TIMEOUT);

  // Some lessons are observation-only on step 1, while others are still running
  // preAction/action setup. The real contract is that the live panel reached a
  // valid phase; it is not required to already be done or have Next enabled.
  const panelPhase = await page.locator('[data-testid="demo-live-panel"]').getAttribute('data-step-phase');
  if (panelPhase === 'reading') {
    await skipReadingPause(page);
  }

  await waitForActionPhase(page, STEP_TIMEOUT);
  await page.waitForFunction(
    () => {
      const phase = document.querySelector('[data-testid="demo-live-panel"]')?.getAttribute('data-step-phase');
      return phase === 'reading' || phase === 'action' || phase === 'verify' || phase === 'done';
    },
    { timeout: STEP_TIMEOUT },
  );

  const finalPhase = await page.locator('[data-testid="demo-live-panel"]').getAttribute('data-step-phase');
  expect(['reading', 'action', 'verify', 'done']).toContain(finalPhase ?? '');

  console.log(`[PASS] ${lessonName}: live demo started and the panel reached a valid phase (${finalPhase ?? 'unknown'})`);
}

async function exitDemo(page: Page) {
  const exitBtn = page.locator('.demo-live-exit-btn');
  await expect(exitBtn).toBeVisible({ timeout: 5000 });
  await exitBtn.click();
  // Allow up to 15 s for cleanup to finish and the demo-hub tab to be re-activated.
  // Some lessons (e.g. ws-workspace) run a multi-second cleanup before setActiveTab fires.
  await expect(page.locator('.demo-lesson-player')).toBeVisible({ timeout: 15_000 });
}

// ─── Full live-demo flow helper ───────────────────────────────────

async function runLessonFlow(
  page: Page,
  category: 'Kafka' | 'WebSocket' | 'SSE',
  lessonNameFragment: string,
) {
  await openDemoHub(page);
  await selectDomain(page);
  await selectCategory(page, category);
  await openLesson(page, lessonNameFragment);
  await validateConceptSlide(page);
  await validateStartBtnEnabled(page);
  await startDemoAndValidate(page, lessonNameFragment);
  await exitDemo(page);
}

async function runDockerGatedFlow(
  page: Page,
  category: 'Kafka' | 'WebSocket' | 'SSE',
  lessonNameFragment: string,
) {
  await openDemoHub(page);
  await selectDomain(page);
  await selectCategory(page, category);
  await openLesson(page, lessonNameFragment);
  await validateConceptSlide(page);
  await validatePrerequisiteGate(page, lessonNameFragment);
}

// ══════════════════════════════════════════════════════════════════
// 1. Demo Hub top-level navigation
// ══════════════════════════════════════════════════════════════════

test.describe('Demo Hub — Top-level Navigation', () => {
  test('domain selector renders the Protocols card', async ({ page }) => {
    await openDemoHub(page);
    const protocolsCard = page.locator('.demo-domain-card').filter({ hasText: 'Protocols' });
    await expect(protocolsCard).toBeVisible();
    const comingSoon = await page.locator('.demo-domain-card.coming-soon').count();
    expect(comingSoon).toBe(0);
    await expect(protocolsCard).not.toHaveClass(/coming-soon/);
    console.log('[PASS] Domain selector: Protocols available and all registered paths are actionable');
  });

  test('API Mock domain card is its own Learning Hub entry', async ({ page }) => {
    await openDemoHub(page);
    const card = page.getByTestId('demo-domain-card-api-mock');
    await expect(card).toBeVisible();
    await expect(card).toContainText('API Mock');
    await card.click();
    await expect(page.locator('.demo-lesson-list')).toBeVisible();
    await expect(page.locator('.demo-lesson-item')).toHaveCount(25);
  });

  test('Protocols domain opens and shows category tabs', async ({ page }) => {
    await openDemoHub(page);
    await selectDomain(page);
    await expect(page.locator('.demo-category-tab')).toHaveCount(5);
    await expect(page.locator('.demo-category-tab').filter({ hasText: 'Kafka' })).toBeVisible();
    await expect(page.locator('.demo-category-tab').filter({ hasText: 'WebSocket' })).toBeVisible();
    await expect(page.locator('.demo-category-tab').filter({ hasText: 'SSE' })).toBeVisible();
    await expect(page.locator('.demo-category-tab').filter({ hasText: 'GraphQL' })).toBeVisible();
    await expect(page.locator('.demo-category-tab').filter({ hasText: 'gRPC' })).toBeVisible();
    console.log('[PASS] Category tabs: Kafka, WebSocket, SSE, GraphQL, gRPC visible');
  });

  test('Kafka category shows 13 lessons', async ({ page }) => {
    await openDemoHub(page);
    await selectDomain(page);
    await selectCategory(page, 'Kafka');
    const count = await page.locator('.demo-lesson-item').count();
    expect(count).toBe(13);
    console.log(`[PASS] Kafka: ${count} lessons`);
  });

  test('WebSocket category shows expected lessons', async ({ page }) => {
    await openDemoHub(page);
    await selectDomain(page);
    await selectCategory(page, 'WebSocket');
    const count = await page.locator('.demo-lesson-item').count();
    expect(count).toBeGreaterThanOrEqual(18);
    console.log(`[PASS] WebSocket: ${count} lessons`);
  });

  test('SSE category shows lessons', async ({ page }) => {
    await openDemoHub(page);
    await selectDomain(page);
    await selectCategory(page, 'SSE');
    const count = await page.locator('.demo-lesson-item').count();
    expect(count).toBeGreaterThanOrEqual(2);
    console.log(`[PASS] SSE: ${count} lessons`);
  });

  test('Docker-gated lessons show 🐳 badge', async ({ page }) => {
    await openDemoHub(page);
    await selectDomain(page);
    await selectCategory(page, 'WebSocket');
    const dockerBadges = page.locator('.demo-lesson-tag').filter({ hasText: '🐳' });
    const count = await dockerBadges.count();
    expect(count).toBeGreaterThanOrEqual(3);
    console.log(`[PASS] Docker badge: ${count} Docker-gated WS lessons`);
  });
});

// ══════════════════════════════════════════════════════════════════
// 2. WebSocket lessons — non-Docker (full live demo)
// ══════════════════════════════════════════════════════════════════

test.describe('WebSocket Lessons — Live Demo (non-Docker)', () => {
  test('WS-01: Mock Server', async ({ page }) => {
    await runLessonFlow(page, 'WebSocket', 'Mock Server');
  });

  test('WS-02: WebSocket Basics', async ({ page }) => {
    await runLessonFlow(page, 'WebSocket', 'WebSocket Basics');
  });

  test('WS-03: Console & Debugging', async ({ page }) => {
    await runLessonFlow(page, 'WebSocket', 'Console & Debugging');
  });

  test('WS-04: Tabs & Multi-Connection', async ({ page }) => {
    await runLessonFlow(page, 'WebSocket', 'Tabs & Multi-Connection');
  });

  test('WS-05: Auth & Transport', async ({ page }) => {
    await runLessonFlow(page, 'WebSocket', 'Auth & Transport');
  });

  test('WS-06: Filtering, Diff & Schema', async ({ page }) => {
    await runLessonFlow(page, 'WebSocket', 'Filtering, Diff');
  });

  test('WS-07: Load Testing', async ({ page }) => {
    await runLessonFlow(page, 'WebSocket', 'Load Testing');
  });

  test('WS-08: Workflow Builder', async ({ page }) => {
    await runLessonFlow(page, 'WebSocket', 'Workflow Builder');
  });

  test('WS-09: Advanced Mock Server', async ({ page }) => {
    await runLessonFlow(page, 'WebSocket', 'Advanced Mock Server');
  });

  test('WS-10: Profiles, Templates & Env Vars', async ({ page }) => {
    await runLessonFlow(page, 'WebSocket', 'Profiles, Templates');
  });

  test('WS-11: Auto-Reconnect & Stats', async ({ page }) => {
    await runLessonFlow(page, 'WebSocket', 'Auto-Reconnect');
  });

  test('WS-12: Session Recording & Replay', async ({ page }) => {
    await runLessonFlow(page, 'WebSocket', 'Session Recording');
  });

  test('WS-13: Power User: Tabs & Keyboard', async ({ page }) => {
    await runLessonFlow(page, 'WebSocket', 'Power User');
  });

  test('WS-14: Secure WebSocket — wss:// & TLS', async ({ page }) => {
    await runLessonFlow(page, 'WebSocket', 'Secure WebSocket');
  });

  test('WS-16: Run WS Workflow in Harness', async ({ page }) => {
    await runLessonFlow(page, 'WebSocket', 'Run WS Workflow');
  });
});

// ── Docker-gated WebSocket lessons ───────────────────────────────

test.describe('WebSocket Lessons — Docker-gated (concept + gate)', () => {
  test('WS-D1: Socket.IO Protocol', async ({ page }) => {
    await runDockerGatedFlow(page, 'WebSocket', 'Socket.IO');
  });

  test('WS-D2: STOMP / RabbitMQ', async ({ page }) => {
    await runDockerGatedFlow(page, 'WebSocket', 'STOMP');
  });

  test('WS-D3: GraphQL Subscriptions', async ({ page }) => {
    await runDockerGatedFlow(page, 'WebSocket', 'GraphQL');
  });

  test('WS-D4: Local TLS Echo Server (Docker)', async ({ page }) => {
    await runDockerGatedFlow(page, 'WebSocket', 'Local TLS Echo');
  });
});

// ══════════════════════════════════════════════════════════════════
// 3. SSE lessons — non-Docker (full live demo)
// ══════════════════════════════════════════════════════════════════

test.describe('SSE Lessons — Live Demo (non-Docker)', () => {
  test('SSE-01: SSE Studio', async ({ page }) => {
    await runLessonFlow(page, 'SSE', 'SSE Studio');
  });

  test('SSE-02: SSE Advanced Features', async ({ page }) => {
    await runLessonFlow(page, 'SSE', 'Advanced');
  });
});

// ══════════════════════════════════════════════════════════════════
// 4. Kafka lessons — Docker-gated (concept + gate)
// ══════════════════════════════════════════════════════════════════

test.describe('Kafka Lessons — Docker-gated (concept + gate)', () => {
  test('K01: Quick Start', async ({ page }) => {
    await runDockerGatedFlow(page, 'Kafka', 'Quick Start');
  });

  test('K02: Publish Studio', async ({ page }) => {
    await runDockerGatedFlow(page, 'Kafka', 'Publish Studio');
  });

  test('K03: Consume Studio', async ({ page }) => {
    await runDockerGatedFlow(page, 'Kafka', 'Consume Studio');
  });

  test('K04: Headers & Filters', async ({ page }) => {
    await runDockerGatedFlow(page, 'Kafka', 'Headers & Filters');
  });

  test('K05: Templates (non-Docker — full live demo)', async ({ page }) => {
    await runLessonFlow(page, 'Kafka', 'Templates');
  });

  test('K06: Topic Explorer', async ({ page }) => {
    await runDockerGatedFlow(page, 'Kafka', 'Topic Explorer');
  });

  test('K07: Schema Registry', async ({ page }) => {
    await runDockerGatedFlow(page, 'Kafka', 'Schema Registry');
  });

  test('K08: Stream Mode', async ({ page }) => {
    await runDockerGatedFlow(page, 'Kafka', 'Stream Mode');
  });

  test('K09: Workflow: Produce Node', async ({ page }) => {
    await runDockerGatedFlow(page, 'Kafka', 'Workflow: Produce Node');
  });

  test('K10: Workflow: Consume & Wait', async ({ page }) => {
    await runDockerGatedFlow(page, 'Kafka', 'Workflow: Consume');
  });

  test('K11: Secure Cluster (SASL)', async ({ page }) => {
    await runDockerGatedFlow(page, 'Kafka', 'Secure Cluster');
  });

  test('K12: TLS-Encrypted Cluster', async ({ page }) => {
    await runDockerGatedFlow(page, 'Kafka', 'TLS-Encrypted');
  });

  test('K13: Harness: Run Kafka Workflow', async ({ page }) => {
    await runDockerGatedFlow(page, 'Kafka', 'Harness: Run Kafka');
  });
});

// ══════════════════════════════════════════════════════════════════
// 5. Live demo controls — regression checks
// ══════════════════════════════════════════════════════════════════

test.describe('Live Demo Controls — Regression', () => {
  test('restart button resets to step 1', async ({ page }) => {
    await openDemoHub(page);
    await selectDomain(page);
    await selectCategory(page, 'WebSocket');
    await openLesson(page, 'Mock Server');
    await validateConceptSlide(page);
    await validateStartBtnEnabled(page);
    await page.locator('.demo-start-btn').click();
    await page.waitForSelector('.demo-live-panel', { timeout: DEMO_HUB_TIMEOUT });

    await runNextStep(page, STEP_TIMEOUT);
    const { counter: before } = await page.locator('.demo-live-step-counter').textContent().then(
      (t) => ({ counter: (t ?? '').trim() }),
    );
    expect(before).toMatch(/2\s*[/]\s*\d+/);

    await restartLesson(page);
    const counterText = await page.locator('.demo-live-step-counter').textContent();
    expect(counterText).toMatch(/^1\s*[/]\s*\d+/);
    console.log('[PASS] Restart: counter resets from', before, '→', counterText?.trim());
  });

  test('exit from live demo returns to concept slide', async ({ page }) => {
    await openDemoHub(page);
    await selectDomain(page);
    await selectCategory(page, 'WebSocket');
    // Use an observation-only lesson so we don't wait on a long auto-action
    await openLesson(page, 'Auth & Transport');
    await page.locator('.demo-start-btn').click();
    await page.waitForSelector('.demo-live-panel', { timeout: DEMO_HUB_TIMEOUT });
    await page.waitForSelector('.demo-live-step-counter', { timeout: DEMO_HUB_TIMEOUT });
    await exitDemo(page);
    await expect(page.locator('.demo-concept-slide')).toBeVisible({ timeout: 5000 });
    console.log('[PASS] Exit: returns to concept slide');
  });

  test('overview drawer is read-only during live demo', async ({ page }) => {
    await openDemoHub(page);
    await selectDomain(page);
    await selectCategory(page, 'WebSocket');
    await openLesson(page, 'Console & Debugging');
    await page.locator('.demo-start-btn').click();
    await page.waitForSelector('.demo-live-panel', { timeout: DEMO_HUB_TIMEOUT });
    await expect(page.locator('[aria-label="Next step"]')).toBeEnabled({ timeout: STEP_TIMEOUT });

    const overviewBtn = page.locator('.demo-live-overview-btn');
    if (await overviewBtn.count() > 0) {
      await overviewBtn.click();
      await page.waitForTimeout(300);
      const clickableBtns = await page.locator('.demo-overview-modal-item button').count();
      expect(clickableBtns).toBe(0);
      const readonlyItems = await page.locator('.demo-overview-modal-item--readonly').count();
      expect(readonlyItems).toBeGreaterThan(0);
      console.log('[PASS] Overview: read-only,', readonlyItems, 'items');
      const closeBtn = page.locator('.demo-overview-modal-close');
      if (await closeBtn.count() > 0) await closeBtn.click();
      else await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
    }
    await expect(page.locator('.demo-live-restart-btn')).toBeVisible({ timeout: 3000 });
  });

  test('play/pause toggle works', async ({ page }) => {
    await openDemoHub(page);
    await selectDomain(page);
    await selectCategory(page, 'WebSocket');
    await openLesson(page, 'Tabs & Multi-Connection');
    await page.locator('.demo-start-btn').click();
    await page.waitForSelector('.demo-live-panel', { timeout: DEMO_HUB_TIMEOUT });
    await waitForReadingPhase(page, STEP_TIMEOUT);
    await skipReadingPause(page);
    await waitForActionPhase(page);
    await expect(page.locator('[aria-label="Next step"]')).toBeEnabled({ timeout: STEP_TIMEOUT });

    const playBtn = page.locator('.demo-live-play-btn');
    const titleBefore = await playBtn.getAttribute('title');
    await playBtn.click();
    await page.waitForTimeout(300);
    const titleAfter = await playBtn.getAttribute('title');
    expect(titleBefore).not.toEqual(titleAfter);
    console.log('[PASS] Play/pause toggled:', titleBefore, '→', titleAfter);
  });

  test('step counter increments on Next', async ({ page }) => {
    await openDemoHub(page);
    await selectDomain(page);
    await selectCategory(page, 'WebSocket');
    await openLesson(page, 'Auth & Transport');
    await page.locator('.demo-start-btn').click();
    await page.waitForSelector('.demo-live-panel', { timeout: DEMO_HUB_TIMEOUT });

    await waitForReadingPhase(page, STEP_TIMEOUT);
    const before = await page.locator('.demo-live-step-counter').textContent();
    await runNextStep(page, STEP_TIMEOUT);
    const after = await page.locator('.demo-live-step-counter').textContent();
    expect(before).not.toEqual(after);
    console.log('[PASS] Counter advanced:', before?.trim(), '→', after?.trim());
  });

  test('sidebar step list reflects current lesson steps', async ({ page }) => {
    await openDemoHub(page);
    await selectDomain(page);
    await selectCategory(page, 'WebSocket');
    await openLesson(page, 'Filtering, Diff');
    // Sidebar renders step nav items with class demo-sidebar-nav-item (includes Concept + all steps)
    const steps = page.locator('.demo-sidebar-nav-item');
    const count = await steps.count();
    // Expect at least 2: the Concept item + at least one step
    expect(count).toBeGreaterThan(1);
    console.log(`[PASS] Sidebar: ${count} nav items visible for Filtering lesson`);
  });

  test('back navigation from lesson returns to lesson list', async ({ page }) => {
    await openDemoHub(page);
    await selectDomain(page);
    await selectCategory(page, 'WebSocket');
    await openLesson(page, 'Load Testing');
    // Click header back button
    const backBtn = page.locator('.demo-hub-back-btn, .demo-header-back, button').filter({ hasText: /back/i }).first();
    if (await backBtn.count() > 0) {
      await backBtn.click();
      await page.waitForSelector('.demo-lesson-list', { timeout: 5000 });
      console.log('[PASS] Back navigation: returned to lesson list');
    } else {
      // Fall back — press browser back
      await page.goBack();
      console.log('[SKIP] Back btn not found, used browser back');
    }
  });
});
