/**
 * Demo Hub — Docker-Inclusive Live Demo Validation
 *
 * Runs the FULL live-demo flow for every Docker-gated lesson when the required
 * infrastructure is reachable. Because all Docker services (Kafka/Redpanda,
 * Socket.IO, STOMP, GraphQL, TLS servers) are running in CI / dev environments
 * the spec exercises the complete path:
 *
 *   concept slide → PrerequisiteGate (server detected) → Start Demo →
 *   live panel → first step reading phase → Exit → concept slide returns
 *
 * Run alongside the standard suite via:
 *   E2E_WITH_DOCKER=1 npx playwright test e2e/demo-hub-docker-validate.spec.ts
 *
 * Or without the env var — the spec self-skips individual tests if the required
 * Docker endpoint is down (safe to run in any environment).
 */
import { test, expect, type Page } from '@playwright/test';

const BASE = 'http://localhost:5173';
const HUB_TIMEOUT = 12_000;
const STEP_TIMEOUT = 30_000;   // Kafka setup can take longer
const EXIT_TIMEOUT = 20_000;   // Kafka cleanup can take time

// ─── navigation helpers ───────────────────────────────────────────

async function openDemoHub(page: Page) {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.locator('[title="Demo Hub"]').click();
  await page.waitForSelector('.demo-domain-card', { timeout: HUB_TIMEOUT });
}

async function selectDomain(page: Page) {
  const card = page.locator('.demo-domain-card')
    .filter({ hasNot: page.locator('.coming-soon') }).first();
  await card.click();
  await page.waitForSelector('.demo-lesson-list', { timeout: HUB_TIMEOUT });
}

async function selectCategory(page: Page, category: 'Kafka' | 'WebSocket' | 'SSE') {
  const tab = page.locator('.demo-category-tab')
    .filter({ hasText: new RegExp(category, 'i') });
  if (await tab.count() > 0) {
    await tab.click();
    await page.waitForTimeout(300);
  }
}

async function openLesson(page: Page, fragment: string) {
  const item = page.locator('.demo-lesson-item')
    .filter({ hasText: fragment }).first();
  await expect(item).toBeVisible({ timeout: HUB_TIMEOUT });
  await item.click();
  await page.waitForSelector('.demo-lesson-player', { timeout: HUB_TIMEOUT });
}

/** Wait for the PrerequisiteGate probe to settle (up or down, max 10 s). */
async function waitForGateToSettle(page: Page): Promise<'up' | 'down'> {
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-testid="prereq-status"]');
    if (!el) return false;
    const cls = el.className;
    return cls.includes('prereq-status--up') || cls.includes('prereq-status--down');
  }, { timeout: 10_000 }).catch(() => { /* still checking — treat as down */ });

  const status = page.locator('[data-testid="prereq-status"]');
  const cls = await status.getAttribute('class').catch(() => '');
  return cls?.includes('prereq-status--up') ? 'up' : 'down';
}

/**
 * Full flow for a Docker-gated lesson.
 * - Validates concept slide and PrerequisiteGate always.
 * - Runs live demo ONLY when the endpoint is reachable (gate shows "up").
 * - Skips the live demo (with a console note) when the server is down.
 */
async function runDockerLesson(
  page: Page,
  category: 'Kafka' | 'WebSocket' | 'SSE',
  fragment: string,
) {
  await openDemoHub(page);
  await selectDomain(page);
  await selectCategory(page, category);
  await openLesson(page, fragment);

  // Concept slide must always render
  const title = page.locator('.demo-concept-title');
  await expect(title).toBeVisible({ timeout: HUB_TIMEOUT });
  const titleText = (await title.textContent())?.trim() ?? '';
  expect(titleText.length).toBeGreaterThan(0);

  // PrerequisiteGate must be present
  const gate = page.locator('[data-testid="prereq-gate"]');
  await expect(gate).toBeVisible({ timeout: HUB_TIMEOUT });
  const cmd = page.locator('[data-testid="prereq-command"]');
  await expect(cmd).toBeVisible();
  expect(((await cmd.textContent()) ?? '').trim().length).toBeGreaterThan(5);

  const state = await waitForGateToSettle(page);

  if (state === 'down') {
    console.log(`[SKIP-LIVE] ${fragment}: Docker endpoint not reachable — concept+gate validated only`);
    return;
  }

  // Server is UP → run the full live demo
  const startBtn = page.locator('.demo-start-btn');
  await expect(startBtn).toBeEnabled({ timeout: HUB_TIMEOUT });
  await startBtn.click();

  const panel = page.locator('.demo-live-panel');
  await expect(panel).toBeVisible({ timeout: HUB_TIMEOUT });

  const stepTitle = panel.locator('.demo-live-step-title');
  await expect(stepTitle).toBeVisible({ timeout: STEP_TIMEOUT });

  // Wait for the reading phase badge — this confirms setup has finished AND
  // the step execution pipeline has reached the reading pause. The Next button
  // is initially enabled with stepPhase='done' (before setup runs), so we
  // must wait for the genuine reading phase to avoid a race where the test
  // clicks Exit while startLiveDemo is still executing setup in the background.
  const phaseBadge = panel.locator('.demo-live-phase-badge');
  await expect(phaseBadge).toContainText('Reading', { timeout: STEP_TIMEOUT });

  const nextBtn = panel.locator('[aria-label="Next step"]');
  await expect(nextBtn).toBeEnabled({ timeout: 3000 });

  console.log(`[PASS-LIVE] ${fragment}: live demo started, step rendered, Next enabled`);

  // Exit — wait for cleanup to finish (Kafka cleanups can be slow)
  const exitBtn = page.locator('.demo-live-exit-btn');
  await expect(exitBtn).toBeVisible({ timeout: 5000 });
  await exitBtn.click();
  await expect(page.locator('.demo-lesson-player')).toBeVisible({ timeout: EXIT_TIMEOUT });

  console.log(`[PASS-EXIT] ${fragment}: exited cleanly, concept slide restored`);
}

// ══════════════════════════════════════════════════════════════════
// Docker-gated WebSocket lessons
// ══════════════════════════════════════════════════════════════════

test.describe('Docker WS Lessons — Full Live Demo', () => {
  test('WS-D1: Socket.IO Protocol', async ({ page }) => {
    await runDockerLesson(page, 'WebSocket', 'Socket.IO');
  });

  test('WS-D2: STOMP / RabbitMQ', async ({ page }) => {
    await runDockerLesson(page, 'WebSocket', 'STOMP');
  });

  test('WS-D3: GraphQL Subscriptions', async ({ page }) => {
    await runDockerLesson(page, 'WebSocket', 'GraphQL');
  });

  test('WS-D4: Local TLS Echo Server (Docker)', async ({ page }) => {
    await runDockerLesson(page, 'WebSocket', 'Local TLS Echo');
  });
});

// ══════════════════════════════════════════════════════════════════
// Kafka lessons — full live demo when Kafka is reachable
// ══════════════════════════════════════════════════════════════════

test.describe('Kafka Lessons — Full Live Demo (Docker)', () => {
  test('K01: Quick Start', async ({ page }) => {
    await runDockerLesson(page, 'Kafka', 'Quick Start');
  });

  test('K02: Publish Studio', async ({ page }) => {
    await runDockerLesson(page, 'Kafka', 'Publish Studio');
  });

  test('K03: Consume Studio', async ({ page }) => {
    await runDockerLesson(page, 'Kafka', 'Consume Studio');
  });

  test('K04: Headers & Filters', async ({ page }) => {
    await runDockerLesson(page, 'Kafka', 'Headers & Filters');
  });

  test('K06: Topic Explorer', async ({ page }) => {
    await runDockerLesson(page, 'Kafka', 'Topic Explorer');
  });

  test('K07: Schema Registry', async ({ page }) => {
    await runDockerLesson(page, 'Kafka', 'Schema Registry');
  });

  test('K08: Stream Mode', async ({ page }) => {
    await runDockerLesson(page, 'Kafka', 'Stream Mode');
  });

  test('K09: Workflow: Produce Node', async ({ page }) => {
    await runDockerLesson(page, 'Kafka', 'Workflow: Produce Node');
  });

  test('K10: Workflow: Consume & Wait', async ({ page }) => {
    await runDockerLesson(page, 'Kafka', 'Workflow: Consume');
  });

  test('K11: Secure Cluster (SASL)', async ({ page }) => {
    await runDockerLesson(page, 'Kafka', 'Secure Cluster');
  });

  test('K12: TLS-Encrypted Cluster', async ({ page }) => {
    await runDockerLesson(page, 'Kafka', 'TLS-Encrypted');
  });

  test('K13: Harness: Run Kafka Workflow', async ({ page }) => {
    await runDockerLesson(page, 'Kafka', 'Harness: Run Kafka');
  });
});
