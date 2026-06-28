/**
 * Shared walk + prepare helpers for GQL-1..3 Docker E2E (smoke + per-lesson specs).
 *
 * Keeps lesson step advancement logic in one place so smoke and step-through specs
 * stay aligned on timeouts and last-step handling (finishDemoStep on final step).
 *
 * Canonical source for full-lesson walks — per-lesson specs import from here;
 * do not duplicate walk logic in individual spec files.
 *
 * Pitfalls memo: e2e/DEMO-LESSON-E2E-MEMO.md
 */
import type { APIRequestContext, Page } from '@playwright/test';
import { GQL } from '../src/shared/selectors';
import {
  launchGqlLesson,
  waitForReadingPhase,
  runNextStep,
  completeCurrentStepAction,
  finishDemoStep,
  openDemoHub,
  selectProtocolsDomain,
  selectCategory,
  openLesson,
  waitForPrerequisiteGateUp,
  startLesson,
} from './demo-player-helpers';
import {
  seedGqlDemoEnvironmentForE2e,
  setupLiveProxy,
  setupLiveWebSocket,
  ensureGqlDemoHeaderSelected,
  ensureGql2StudioEndpoint,
  ensureGql3StudioEndpoint,
  makeProxyEnvelope,
  GQL_HTTP,
  seedGqlStudioSettings,
} from './graphql-helpers';
import { REDFIREFORGE_IDB_VERSION } from './helpers';

export const GQL1_LESSON = { name: 'Your First GraphQL Query', steps: 13 } as const;
export const GQL2_LESSON = { name: 'Variables & Arguments', steps: 18 } as const;
export const GQL3_LESSON = { name: 'Schema Exploration', steps: 10 } as const;
export const GQL4_LESSON = { name: 'Authentication & Headers', steps: 14 } as const;
export const GQL5_LESSON = { name: 'HTTPS, TLS & Certificates', steps: 18 } as const;
export const GQL6_LESSON = { name: 'Mutations — Create, Update, Delete', steps: 19 } as const;
export const GQL7_LESSON = { name: 'Subscriptions — Real-Time Data', steps: 15 } as const;
export const GQL8_LESSON = { name: 'Query Builder — Visual Operations', steps: 11 } as const;
export const GQL9_LESSON = { name: 'Collections & History', steps: 11 } as const;
export const GQL10_LESSON = { name: 'Export & Share Queries', steps: 7 } as const;
export const GQL11_LESSON = { name: 'Performance Tracing', steps: 8 } as const;
export const GQL12_LESSON = { name: 'Schema Diff & Breaking Changes', steps: 7 } as const;
export const GQL13_LESSON = { name: 'Mock Server', steps: 15 } as const;
export const GQL14_LESSON = { name: 'Multi-Tab Workspaces', steps: 12 } as const;
export const GQL15_LESSON = { name: 'Batch Execution', steps: 10 } as const;
export const GQL16_LESSON = { name: 'Workflow Integration', steps: 13 } as const;
export const GQL17_LESSON = { name: 'Workflow Runner & Results', steps: 9 } as const;
export const GQL18_LESSON = { name: 'Mutation Node in Workflow', steps: 15 } as const;
export const GQL19_LESSON = { name: 'Subscription Node in Workflow', steps: 9 } as const;

/** Bottom Auth panel selectors for GQL-4 / GQL-14 lesson walks (Slice 7.6 — Option D). */
export const GQL_LESSON_AUTH = {
  badge: GQL.AUTH_BADGE_BTN,
  bottomTab: GQL.BOTTOM_TAB_AUTH,
  panel: GQL.AUTH_PANEL,
  typeSelect: GQL.AUTH_TYPE_SELECT,
} as const;

/** Wait until the docked Auth panel is visible (after badge click or tab switch). */
export async function waitForGqlAuthPanel(page: Page, timeout = 15_000): Promise<void> {
  await page.locator(GQL.AUTH_PANEL).waitFor({ state: 'visible', timeout });
}

/** Mock proxy endpoint (desktop / Node proxy on port 3001). */
export const GQL13_MOCK_HTTP = 'http://localhost:3001/api/graphql/mock';
export const GQL13_PROXY_HEALTH = 'http://localhost:3001/health';
export const GQL13_MOCK_CONFIG_URL = 'http://localhost:3001/api/graphql/mock/config';

/** TLS health probe for GQL-5 PrerequisiteGate (docker/graphql/tls). */
export const GQL_TLS_HEALTH = 'http://127.0.0.1:4444/health';
export const GQL_TLS_MTLS_HEALTH = 'http://127.0.0.1:4446/health';
export const GQL_TLS_HTTPS = 'https://localhost:4443/graphql';
export const GQL_TLS_MTLS_HTTPS = 'https://localhost:4445/graphql';

export const DEMO_ACTION_TIMEOUT = 180_000;
export const HISTORY_TIMEOUT = 300_000;
export const MUTATION_TIMEOUT = 300_000;

const GQL1_PANEL = '[data-testid="demo-live-panel"]';

async function currentStepNumber(page: Page): Promise<number> {
  const counter = await page.locator('.demo-live-step-counter').textContent();
  const match = counter?.match(/(\d+)\s*\/\s*\d+/);
  return match ? parseInt(match[1], 10) : 0;
}

async function waitForGql1StepReady(page: Page, timeout = DEMO_ACTION_TIMEOUT): Promise<void> {
  await page.waitForFunction(
    (sel) => {
      const p = document.querySelector(sel)?.getAttribute('data-step-phase');
      return p === 'reading' || p === 'done';
    },
    GQL1_PANEL,
    { timeout },
  );
}

async function waitForGql1StepDone(page: Page, timeout = DEMO_ACTION_TIMEOUT): Promise<void> {
  await page.waitForFunction(
    (sel) => document.querySelector(sel)?.getAttribute('data-step-phase') === 'done',
    GQL1_PANEL,
    { timeout },
  );
}

async function skipGql1Reading(page: Page): Promise<void> {
  const badge = page.locator('.demo-live-phase-badge.skippable');
  await badge.waitFor({ state: 'visible', timeout: 30_000 }).catch(() => {});
  if (await badge.isVisible().catch(() => false)) {
    await badge.click();
  }
}

async function completeGql1DemoStep(page: Page, timeout = DEMO_ACTION_TIMEOUT): Promise<void> {
  const stepNum = await currentStepNumber(page);
  const title = (await page.locator('.demo-live-step-title').textContent())?.trim() ?? '';
  await waitForGql1StepReady(page, timeout);
  const phase = await page.locator(GQL1_PANEL).getAttribute('data-step-phase');
  if (phase === 'done') return;
  await skipGql1Reading(page);
  try {
    await waitForGql1StepDone(page, timeout);
  } catch (err) {
    const stuckPhase = await page.locator(GQL1_PANEL).getAttribute('data-step-phase');
    throw new Error(
      `GQL-1 step ${stepNum} "${title}" stuck in phase "${stuckPhase}" after ${timeout}ms: ${err}`,
    );
  }
}

async function advanceOneGql1Step(page: Page, timeout = DEMO_ACTION_TIMEOUT): Promise<void> {
  const stepBefore = await currentStepNumber(page);
  await completeGql1DemoStep(page, timeout);

  if (stepBefore >= GQL1_LESSON.steps) return;

  const enteringLastStep = stepBefore === GQL1_LESSON.steps - 1;
  await page.locator('[aria-label="Next step"]').click();

  if (enteringLastStep) {
    await waitForGql1StepReady(page, timeout);
  } else {
    await waitForReadingPhase(page, timeout);
  }
}

/** Walk all 13 steps of GQL-1 (reading pauses skipped via badge). */
export async function walkFullGql1Lesson(page: Page): Promise<void> {
  for (let i = 0; i < GQL1_LESSON.steps - 1; i++) {
    await advanceOneGql1Step(page);
  }
  await completeGql1DemoStep(page);
}

/** Play through all 18 GQL-2 steps (extended timeouts for history/compare). */
export async function walkFullGql2Lesson(page: Page): Promise<void> {
  for (let i = 0; i < GQL2_LESSON.steps - 2; i++) {
    const timeout = i >= 11 ? HISTORY_TIMEOUT : DEMO_ACTION_TIMEOUT;
    await runNextStep(page, timeout);
  }
  await completeCurrentStepAction(page, HISTORY_TIMEOUT);
  await page.locator('[aria-label="Next step"]').click();
  await finishDemoStep(page, HISTORY_TIMEOUT);
}

/** Play through all 8 GQL-3 steps (introspect, Try → insert, execute, SDL export). */
export async function walkFullGql3Lesson(page: Page): Promise<void> {
  for (let i = 0; i < GQL3_LESSON.steps - 1; i++) {
    const timeout = i >= 2 ? MUTATION_TIMEOUT : DEMO_ACTION_TIMEOUT;
    await advanceOneGql3Step(page, timeout);
  }
  await completeGql3DemoStep(page, MUTATION_TIMEOUT);
}

async function waitForGql3StepReady(page: Page, timeout = DEMO_ACTION_TIMEOUT): Promise<void> {
  await page.waitForFunction(
    (sel) => {
      const p = document.querySelector(sel)?.getAttribute('data-step-phase');
      return p === 'reading' || p === 'done';
    },
    GQL1_PANEL,
    { timeout },
  );
}

async function waitForGql3StepDone(page: Page, timeout = DEMO_ACTION_TIMEOUT): Promise<void> {
  await page.waitForFunction(
    (sel) => document.querySelector(sel)?.getAttribute('data-step-phase') === 'done',
    GQL1_PANEL,
    { timeout },
  );
}

async function skipGql3Reading(page: Page): Promise<void> {
  const badge = page.locator('.demo-live-phase-badge.skippable');
  await badge.waitFor({ state: 'visible', timeout: 30_000 }).catch(() => {});
  if (await badge.isVisible().catch(() => false)) {
    await badge.click();
  }
}

async function completeGql3DemoStep(page: Page, timeout = DEMO_ACTION_TIMEOUT): Promise<void> {
  const stepNum = await currentStepNumber(page);
  const title = (await page.locator('.demo-live-step-title').textContent())?.trim() ?? '';
  await waitForGql3StepReady(page, timeout);
  const phase = await page.locator(GQL1_PANEL).getAttribute('data-step-phase');
  if (phase === 'done') return;
  await skipGql3Reading(page);
  try {
    await waitForGql3StepDone(page, timeout);
  } catch (err) {
    const stuckPhase = await page.locator(GQL1_PANEL).getAttribute('data-step-phase');
    throw new Error(
      `GQL-3 step ${stepNum} "${title}" stuck in phase "${stuckPhase}" after ${timeout}ms: ${err}`,
    );
  }
}

async function advanceOneGql3Step(page: Page, timeout = DEMO_ACTION_TIMEOUT): Promise<void> {
  const stepBefore = await currentStepNumber(page);
  await completeGql3DemoStep(page, timeout);

  if (stepBefore >= GQL3_LESSON.steps) return;

  const enteringLastStep = stepBefore === GQL3_LESSON.steps - 1;
  await page.locator('[aria-label="Next step"]').click();

  if (enteringLastStep) {
    await waitForGql3StepReady(page, timeout);
  } else {
    await waitForReadingPhase(page, timeout);
  }
}

/** Play through all 12 GQL-4 steps (auth modes, execute + metadata, connection profile). */
export async function walkFullGql4Lesson(page: Page): Promise<void> {
  for (let i = 0; i < GQL4_LESSON.steps - 1; i++) {
    const timeout = i >= 2 ? MUTATION_TIMEOUT : DEMO_ACTION_TIMEOUT;
    await advanceOneGql4Step(page, timeout);
  }
  await completeGql4DemoStep(page, MUTATION_TIMEOUT);
}

async function waitForGql4StepReady(page: Page, timeout = DEMO_ACTION_TIMEOUT): Promise<void> {
  await page.waitForFunction(
    (sel) => {
      const p = document.querySelector(sel)?.getAttribute('data-step-phase');
      return p === 'reading' || p === 'done';
    },
    GQL1_PANEL,
    { timeout },
  );
}

async function waitForGql4StepDone(page: Page, timeout = DEMO_ACTION_TIMEOUT): Promise<void> {
  await page.waitForFunction(
    (sel) => document.querySelector(sel)?.getAttribute('data-step-phase') === 'done',
    GQL1_PANEL,
    { timeout },
  );
}

async function skipGql4Reading(page: Page): Promise<void> {
  const badge = page.locator('.demo-live-phase-badge.skippable');
  await badge.waitFor({ state: 'visible', timeout: 30_000 }).catch(() => {});
  if (await badge.isVisible().catch(() => false)) {
    await badge.click();
  }
}

async function completeGql4DemoStep(page: Page, timeout = DEMO_ACTION_TIMEOUT): Promise<void> {
  const stepNum = await currentStepNumber(page);
  const title = (await page.locator('.demo-live-step-title').textContent())?.trim() ?? '';
  await waitForGql4StepReady(page, timeout);
  const phase = await page.locator(GQL1_PANEL).getAttribute('data-step-phase');
  if (phase === 'done') return;
  await skipGql4Reading(page);
  try {
    await waitForGql4StepDone(page, timeout);
  } catch (err) {
    const stuckPhase = await page.locator(GQL1_PANEL).getAttribute('data-step-phase');
    throw new Error(
      `GQL-4 step ${stepNum} "${title}" stuck in phase "${stuckPhase}" after ${timeout}ms: ${err}`,
    );
  }
}

async function advanceOneGql4Step(page: Page, timeout = DEMO_ACTION_TIMEOUT): Promise<void> {
  const stepBefore = await currentStepNumber(page);
  await completeGql4DemoStep(page, timeout);

  if (stepBefore >= GQL4_LESSON.steps) return;

  const enteringLastStep = stepBefore === GQL4_LESSON.steps - 1;
  await page.locator('[aria-label="Next step"]').click();

  if (enteringLastStep) {
    await waitForGql4StepReady(page, timeout);
  } else {
    await waitForReadingPhase(page, timeout);
  }
}

/** Play through all 12 GQL-5 steps (skip-cert, CA, mTLS, restore plain HTTP). */
export async function walkFullGql5Lesson(page: Page): Promise<void> {
  for (let i = 0; i < GQL5_LESSON.steps - 1; i++) {
    // Docker introspection / TLS steps need extended timeouts from step 4 onward.
    const timeout = i >= 3 ? MUTATION_TIMEOUT : DEMO_ACTION_TIMEOUT;
    await advanceOneGql5Step(page, timeout);
  }
  await completeGql5DemoStep(page, MUTATION_TIMEOUT);
}

async function waitForGql5StepReady(page: Page, timeout = DEMO_ACTION_TIMEOUT): Promise<void> {
  await page.waitForFunction(
    (sel) => {
      const p = document.querySelector(sel)?.getAttribute('data-step-phase');
      return p === 'reading' || p === 'done';
    },
    GQL1_PANEL,
    { timeout },
  );
}

async function waitForGql5StepDone(page: Page, timeout = DEMO_ACTION_TIMEOUT): Promise<void> {
  await page.waitForFunction(
    (sel) => document.querySelector(sel)?.getAttribute('data-step-phase') === 'done',
    GQL1_PANEL,
    { timeout },
  );
}

async function skipGql5Reading(page: Page): Promise<void> {
  const badge = page.locator('.demo-live-phase-badge.skippable');
  await badge.waitFor({ state: 'visible', timeout: 30_000 }).catch(() => {});
  if (await badge.isVisible().catch(() => false)) {
    await badge.click();
  }
}

async function completeGql5DemoStep(page: Page, timeout = DEMO_ACTION_TIMEOUT): Promise<void> {
  const stepNum = await currentStepNumber(page);
  const title = (await page.locator('.demo-live-step-title').textContent())?.trim() ?? '';
  await waitForGql5StepReady(page, timeout);
  const phase = await page.locator(GQL1_PANEL).getAttribute('data-step-phase');
  if (phase === 'done') return;
  await skipGql5Reading(page);
  try {
    await waitForGql5StepDone(page, timeout);
  } catch (err) {
    const stuckPhase = await page.locator(GQL1_PANEL).getAttribute('data-step-phase');
    throw new Error(
      `GQL-5 step ${stepNum} "${title}" stuck in phase "${stuckPhase}" after ${timeout}ms: ${err}`,
    );
  }
}

async function advanceOneGql5Step(page: Page, timeout = DEMO_ACTION_TIMEOUT): Promise<void> {
  const stepBefore = await currentStepNumber(page);
  await completeGql5DemoStep(page, timeout);

  if (stepBefore >= GQL5_LESSON.steps) return;

  const enteringLastStep = stepBefore === GQL5_LESSON.steps - 1;
  await page.locator('[aria-label="Next step"]').click();

  if (enteringLastStep) {
    await waitForGql5StepReady(page, timeout);
  } else {
    await waitForReadingPhase(page, timeout);
  }
}

type Gql5ProxyPayload = {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
};

function gql5ProxyTarget(url: string, bodyStr: string): { forward: boolean; url: string } {
  if (url.includes('4445') || bodyStr.includes('4445')) {
    return { forward: true, url: url.includes('4445') ? url : GQL_TLS_MTLS_HTTPS };
  }
  if (url.includes('4443') || bodyStr.includes('4443')) {
    return { forward: true, url: url.includes('4443') ? url : GQL_TLS_HTTPS };
  }
  if (url.includes('4010') || bodyStr.includes('4010')) {
    return { forward: true, url: url.includes('4010') ? url : GQL_HTTP };
  }
  return { forward: false, url };
}

/**
 * Legacy Playwright __proxy mock for environments without real Docker TLS stacks.
 * Full GQL-5 E2E uses the real Vite __proxy middleware (see prepareGql5DockerLesson).
 */
async function _setupGql5LiveProxy(page: Page, request: APIRequestContext): Promise<void> {
  await page.route('**/__proxy', async (route) => {
    const bodyStr = route.request().postData() ?? '';
    let payload: Gql5ProxyPayload | null = null;
    try {
      payload = JSON.parse(bodyStr) as Gql5ProxyPayload;
    } catch {
      payload = null;
    }

    const targetUrl = payload?.url ?? '';
    const { forward, url } = gql5ProxyTarget(targetUrl, bodyStr);
    if (!forward) {
      return route.abort('failed');
    }

    const method = (payload?.method ?? 'POST').toUpperCase();
    const headers = { ...(payload?.headers ?? {}) };
    const tlsOpts = { ignoreHTTPSErrors: true };

    try {
      if (method === 'GET') {
        const res = await request.get(url, { headers, ...tlsOpts });
        const text = await res.text();
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: makeProxyEnvelope(res.status(), text),
        });
      }
      const res = await request.post(url, {
        headers: { 'Content-Type': 'application/json', ...headers },
        data: payload?.body ? JSON.parse(payload.body) : {},
        ...tlsOpts,
      });
      const text = await res.text();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: makeProxyEnvelope(res.status(), text),
      });
    } catch {
      return route.abort('failed');
    }
  });
}

/** True when docker/graphql/tls health probe responds on port 4444. */
export async function isGqlTlsServerHealthy(request: APIRequestContext): Promise<boolean> {
  try {
    const res = await request.get(GQL_TLS_HEALTH, { timeout: 5_000 });
    if (!res.ok()) return false;
    const body = (await res.json()) as { status?: string };
    return body.status === 'ok';
  } catch {
    return false;
  }
}

/** True when mTLS stack health probe responds on port 4446. */
export async function isGqlMtlsServerHealthy(request: APIRequestContext): Promise<boolean> {
  try {
    const res = await request.get(GQL_TLS_MTLS_HEALTH, { timeout: 5_000 });
    if (!res.ok()) return false;
    const body = (await res.json()) as { status?: string };
    return body.status === 'ok';
  } catch {
    return false;
  }
}

/** Play through all GQL-6 steps (extended timeouts for mutation executes). */
export async function walkFullGql6Lesson(page: Page): Promise<void> {
  for (let i = 0; i < GQL6_LESSON.steps - 2; i++) {
    const timeout = i >= 4 ? MUTATION_TIMEOUT : DEMO_ACTION_TIMEOUT;
    await runNextStep(page, timeout);
  }
  await completeCurrentStepAction(page, MUTATION_TIMEOUT);
  await page.locator('[aria-label="Next step"]').click();
  await finishDemoStep(page, MUTATION_TIMEOUT);
}

/** Play through all 12 GQL-7 steps (subscriptions + WebSocket; extended timeouts from introspect onward). */
export async function walkFullGql7Lesson(page: Page): Promise<void> {
  for (let i = 0; i < GQL7_LESSON.steps - 1; i++) {
    const timeout = i >= 2 ? MUTATION_TIMEOUT : DEMO_ACTION_TIMEOUT;
    await advanceOneGql7Step(page, timeout);
  }
  await completeGql7DemoStep(page, MUTATION_TIMEOUT);
}

async function waitForGql7StepReady(page: Page, timeout = DEMO_ACTION_TIMEOUT): Promise<void> {
  await page.waitForFunction(
    (sel) => {
      const p = document.querySelector(sel)?.getAttribute('data-step-phase');
      return p === 'reading' || p === 'done';
    },
    GQL1_PANEL,
    { timeout },
  );
}

async function waitForGql7StepDone(page: Page, timeout = DEMO_ACTION_TIMEOUT): Promise<void> {
  await page.waitForFunction(
    (sel) => document.querySelector(sel)?.getAttribute('data-step-phase') === 'done',
    GQL1_PANEL,
    { timeout },
  );
}

async function skipGql7Reading(page: Page): Promise<void> {
  const badge = page.locator('.demo-live-phase-badge.skippable');
  await badge.waitFor({ state: 'visible', timeout: 30_000 }).catch(() => {});
  if (await badge.isVisible().catch(() => false)) {
    await badge.click();
  }
}

async function completeGql7DemoStep(page: Page, timeout = DEMO_ACTION_TIMEOUT): Promise<void> {
  const stepNum = await currentStepNumber(page);
  const title = (await page.locator('.demo-live-step-title').textContent())?.trim() ?? '';
  await waitForGql7StepReady(page, timeout);
  const phase = await page.locator(GQL1_PANEL).getAttribute('data-step-phase');
  if (phase === 'done') return;
  await skipGql7Reading(page);
  try {
    await waitForGql7StepDone(page, timeout);
  } catch (err) {
    const stuckPhase = await page.locator(GQL1_PANEL).getAttribute('data-step-phase');
    throw new Error(
      `GQL-7 step ${stepNum} "${title}" stuck in phase "${stuckPhase}" after ${timeout}ms: ${err}`,
    );
  }
}

async function advanceOneGql7Step(page: Page, timeout = DEMO_ACTION_TIMEOUT): Promise<void> {
  const stepBefore = await currentStepNumber(page);
  await completeGql7DemoStep(page, timeout);

  if (stepBefore >= GQL7_LESSON.steps) return;

  const enteringLastStep = stepBefore === GQL7_LESSON.steps - 1;
  await page.locator('[aria-label="Next step"]').click();

  if (enteringLastStep) {
    await waitForGql7StepReady(page, timeout);
  } else {
    await waitForReadingPhase(page, timeout);
  }
}

/** Play through all 10 GQL-8 steps (builder mode; introspect on step 1). */
export async function walkFullGql8Lesson(page: Page): Promise<void> {
  for (let i = 0; i < GQL8_LESSON.steps - 1; i++) {
    const timeout = i === 0 ? MUTATION_TIMEOUT : DEMO_ACTION_TIMEOUT;
    await advanceOneGql8Step(page, timeout);
  }
  await completeGql8DemoStep(page, DEMO_ACTION_TIMEOUT);
}

async function waitForGql8StepReady(page: Page, timeout = DEMO_ACTION_TIMEOUT): Promise<void> {
  await page.waitForFunction(
    (sel) => {
      const p = document.querySelector(sel)?.getAttribute('data-step-phase');
      return p === 'reading' || p === 'done';
    },
    GQL1_PANEL,
    { timeout },
  );
}

async function waitForGql8StepDone(page: Page, timeout = DEMO_ACTION_TIMEOUT): Promise<void> {
  await page.waitForFunction(
    (sel) => document.querySelector(sel)?.getAttribute('data-step-phase') === 'done',
    GQL1_PANEL,
    { timeout },
  );
}

async function skipGql8Reading(page: Page): Promise<void> {
  const badge = page.locator('.demo-live-phase-badge.skippable');
  await badge.waitFor({ state: 'visible', timeout: 30_000 }).catch(() => {});
  if (await badge.isVisible().catch(() => false)) {
    await badge.click();
  }
}

async function completeGql8DemoStep(page: Page, timeout = DEMO_ACTION_TIMEOUT): Promise<void> {
  const stepNum = await currentStepNumber(page);
  const title = (await page.locator('.demo-live-step-title').textContent())?.trim() ?? '';
  await waitForGql8StepReady(page, timeout);
  const phase = await page.locator(GQL1_PANEL).getAttribute('data-step-phase');
  if (phase === 'done') return;
  await skipGql8Reading(page);
  try {
    await waitForGql8StepDone(page, timeout);
  } catch (err) {
    const stuckPhase = await page.locator(GQL1_PANEL).getAttribute('data-step-phase');
    throw new Error(
      `GQL-8 step ${stepNum} "${title}" stuck in phase "${stuckPhase}" after ${timeout}ms: ${err}`,
    );
  }
}

async function advanceOneGql8Step(page: Page, timeout = DEMO_ACTION_TIMEOUT): Promise<void> {
  const stepBefore = await currentStepNumber(page);
  await completeGql8DemoStep(page, timeout);

  if (stepBefore >= GQL8_LESSON.steps) return;

  const enteringLastStep = stepBefore === GQL8_LESSON.steps - 1;
  await page.locator('[aria-label="Next step"]').click();

  if (enteringLastStep) {
    await waitForGql8StepReady(page, timeout);
  } else {
    await waitForReadingPhase(page, timeout);
  }
}

/** Play through all 8 GQL-9 steps (history, collections export/import). */
export async function walkFullGql9Lesson(page: Page): Promise<void> {
  for (let i = 0; i < GQL9_LESSON.steps - 1; i++) {
    const timeout = i < 4 ? MUTATION_TIMEOUT : DEMO_ACTION_TIMEOUT;
    await advanceOneGql9Step(page, timeout);
  }
  await completeGql9DemoStep(page, MUTATION_TIMEOUT);
}

async function waitForGql9StepReady(page: Page, timeout = DEMO_ACTION_TIMEOUT): Promise<void> {
  await page.waitForFunction(
    (sel) => {
      const p = document.querySelector(sel)?.getAttribute('data-step-phase');
      return p === 'reading' || p === 'done';
    },
    GQL1_PANEL,
    { timeout },
  );
}

async function waitForGql9StepDone(page: Page, timeout = DEMO_ACTION_TIMEOUT): Promise<void> {
  await page.waitForFunction(
    (sel) => document.querySelector(sel)?.getAttribute('data-step-phase') === 'done',
    GQL1_PANEL,
    { timeout },
  );
}

async function skipGql9Reading(page: Page): Promise<void> {
  const badge = page.locator('.demo-live-phase-badge.skippable');
  await badge.waitFor({ state: 'visible', timeout: 30_000 }).catch(() => {});
  if (await badge.isVisible().catch(() => false)) {
    await badge.click();
  }
}

async function completeGql9DemoStep(page: Page, timeout = DEMO_ACTION_TIMEOUT): Promise<void> {
  const stepNum = await currentStepNumber(page);
  const title = (await page.locator('.demo-live-step-title').textContent())?.trim() ?? '';
  await waitForGql9StepReady(page, timeout);
  const phase = await page.locator(GQL1_PANEL).getAttribute('data-step-phase');
  if (phase === 'done') return;
  await skipGql9Reading(page);
  try {
    await waitForGql9StepDone(page, timeout);
  } catch (err) {
    const stuckPhase = await page.locator(GQL1_PANEL).getAttribute('data-step-phase');
    throw new Error(
      `GQL-9 step ${stepNum} "${title}" stuck in phase "${stuckPhase}" after ${timeout}ms: ${err}`,
    );
  }
}

async function advanceOneGql9Step(page: Page, timeout = DEMO_ACTION_TIMEOUT): Promise<void> {
  const stepBefore = await currentStepNumber(page);
  await completeGql9DemoStep(page, timeout);

  if (stepBefore >= GQL9_LESSON.steps) return;

  const enteringLastStep = stepBefore === GQL9_LESSON.steps - 1;
  await page.locator('[aria-label="Next step"]').click();

  if (enteringLastStep) {
    await waitForGql9StepReady(page, timeout);
  } else {
    await waitForReadingPhase(page, timeout);
  }
}

/** Play through all 5 GQL-10 steps (builder export + history cURL). */
export async function walkFullGql10Lesson(page: Page): Promise<void> {
  for (let i = 0; i < GQL10_LESSON.steps - 1; i++) {
    const timeout = i === 0 ? MUTATION_TIMEOUT : DEMO_ACTION_TIMEOUT;
    await advanceOneGql10Step(page, timeout);
  }
  await completeGql10DemoStep(page, MUTATION_TIMEOUT);
}

async function waitForGql10StepReady(page: Page, timeout = DEMO_ACTION_TIMEOUT): Promise<void> {
  await page.waitForFunction(
    (sel) => {
      const p = document.querySelector(sel)?.getAttribute('data-step-phase');
      return p === 'reading' || p === 'done';
    },
    GQL1_PANEL,
    { timeout },
  );
}

async function waitForGql10StepDone(page: Page, timeout = DEMO_ACTION_TIMEOUT): Promise<void> {
  await page.waitForFunction(
    (sel) => document.querySelector(sel)?.getAttribute('data-step-phase') === 'done',
    GQL1_PANEL,
    { timeout },
  );
}

async function skipGql10Reading(page: Page): Promise<void> {
  const badge = page.locator('.demo-live-phase-badge.skippable');
  await badge.waitFor({ state: 'visible', timeout: 30_000 }).catch(() => {});
  if (await badge.isVisible().catch(() => false)) {
    await badge.click();
  }
}

async function completeGql10DemoStep(page: Page, timeout = DEMO_ACTION_TIMEOUT): Promise<void> {
  const stepNum = await currentStepNumber(page);
  const title = (await page.locator('.demo-live-step-title').textContent())?.trim() ?? '';
  await waitForGql10StepReady(page, timeout);
  const phase = await page.locator(GQL1_PANEL).getAttribute('data-step-phase');
  if (phase === 'done') return;
  await skipGql10Reading(page);
  try {
    await waitForGql10StepDone(page, timeout);
  } catch (err) {
    const stuckPhase = await page.locator(GQL1_PANEL).getAttribute('data-step-phase');
    throw new Error(
      `GQL-10 step ${stepNum} "${title}" stuck in phase "${stuckPhase}" after ${timeout}ms: ${err}`,
    );
  }
}

async function advanceOneGql10Step(page: Page, timeout = DEMO_ACTION_TIMEOUT): Promise<void> {
  const stepBefore = await currentStepNumber(page);
  await completeGql10DemoStep(page, timeout);

  if (stepBefore >= GQL10_LESSON.steps) return;

  const enteringLastStep = stepBefore === GQL10_LESSON.steps - 1;
  await page.locator('[aria-label="Next step"]').click();

  if (enteringLastStep) {
    await waitForGql10StepReady(page, timeout);
  } else {
    await waitForReadingPhase(page, timeout);
  }
}

function gql11StepTimeout(stepIndex: number, isLastComplete = false): number {
  if (isLastComplete || stepIndex === 0 || stepIndex === 2) return MUTATION_TIMEOUT;
  return DEMO_ACTION_TIMEOUT;
}

/** Play through all 8 GQL-11 steps (complexity badge, tracing waterfall, histogram). */
export async function walkFullGql11Lesson(page: Page): Promise<void> {
  for (let i = 0; i < GQL11_LESSON.steps - 1; i++) {
    await advanceOneGql11Step(page, gql11StepTimeout(i));
  }
  await completeGql11DemoStep(page, gql11StepTimeout(GQL11_LESSON.steps - 1, true));
}

async function waitForGql11StepReady(page: Page, timeout = DEMO_ACTION_TIMEOUT): Promise<void> {
  await page.waitForFunction(
    (sel) => {
      const p = document.querySelector(sel)?.getAttribute('data-step-phase');
      return p === 'reading' || p === 'done';
    },
    GQL1_PANEL,
    { timeout },
  );
}

async function waitForGql11StepDone(page: Page, timeout = DEMO_ACTION_TIMEOUT): Promise<void> {
  await page.waitForFunction(
    (sel) => document.querySelector(sel)?.getAttribute('data-step-phase') === 'done',
    GQL1_PANEL,
    { timeout },
  );
}

async function skipGql11Reading(page: Page): Promise<void> {
  const badge = page.locator('.demo-live-phase-badge.skippable');
  await badge.waitFor({ state: 'visible', timeout: 30_000 }).catch(() => {});
  if (await badge.isVisible().catch(() => false)) {
    await badge.click();
  }
}

async function completeGql11DemoStep(page: Page, timeout = DEMO_ACTION_TIMEOUT): Promise<void> {
  const stepNum = await currentStepNumber(page);
  const title = (await page.locator('.demo-live-step-title').textContent())?.trim() ?? '';
  await waitForGql11StepReady(page, timeout);
  const phase = await page.locator(GQL1_PANEL).getAttribute('data-step-phase');
  if (phase === 'done') return;
  await skipGql11Reading(page);
  try {
    await waitForGql11StepDone(page, timeout);
  } catch (err) {
    const stuckPhase = await page.locator(GQL1_PANEL).getAttribute('data-step-phase');
    throw new Error(
      `GQL-11 step ${stepNum} "${title}" stuck in phase "${stuckPhase}" after ${timeout}ms: ${err}`,
    );
  }
}

async function advanceOneGql11Step(page: Page, timeout = DEMO_ACTION_TIMEOUT): Promise<void> {
  const stepBefore = await currentStepNumber(page);
  await completeGql11DemoStep(page, timeout);

  if (stepBefore >= GQL11_LESSON.steps) return;

  const enteringLastStep = stepBefore === GQL11_LESSON.steps - 1;
  await page.locator('[aria-label="Next step"]').click();

  if (enteringLastStep) {
    await waitForGql11StepReady(page, timeout);
  } else {
    await waitForReadingPhase(page, timeout);
  }
}

function gql12StepTimeout(stepIndex: number): number {
  return stepIndex <= 2 ? MUTATION_TIMEOUT : DEMO_ACTION_TIMEOUT;
}

/** Play through all 7 GQL-12 steps (snapshots, changelog diff, export JSON). */
export async function walkFullGql12Lesson(page: Page): Promise<void> {
  for (let i = 0; i < GQL12_LESSON.steps - 1; i++) {
    const info = await page.evaluate(() => ({
      counter: document.querySelector('.demo-live-step-counter')?.textContent?.trim() ?? '',
      title: document.querySelector('.demo-live-step-title')?.textContent?.trim() ?? '',
      phase: document.querySelector('[data-testid="demo-live-panel"]')?.getAttribute('data-step-phase') ?? '',
    }));
    console.log(`[GQL-12 walk] step ${i + 1} — ${info.counter} ${info.title} (phase=${info.phase})`);
    await advanceOneGql12Step(page, gql12StepTimeout(i));
  }
  await completeGql12DemoStep(page, DEMO_ACTION_TIMEOUT);
}

async function waitForGql12StepReady(page: Page, timeout = DEMO_ACTION_TIMEOUT): Promise<void> {
  await page.waitForFunction(
    (sel) => {
      const p = document.querySelector(sel)?.getAttribute('data-step-phase');
      return p === 'reading' || p === 'done';
    },
    GQL1_PANEL,
    { timeout },
  );
}

async function waitForGql12StepDone(page: Page, timeout = DEMO_ACTION_TIMEOUT): Promise<void> {
  await page.waitForFunction(
    (sel) => document.querySelector(sel)?.getAttribute('data-step-phase') === 'done',
    GQL1_PANEL,
    { timeout },
  );
}

async function skipGql12Reading(page: Page): Promise<void> {
  const badge = page.locator('.demo-live-phase-badge.skippable');
  await badge.waitFor({ state: 'visible', timeout: 30_000 }).catch(() => {});
  if (await badge.isVisible().catch(() => false)) {
    await badge.click();
  }
}

async function completeGql12DemoStep(page: Page, timeout = DEMO_ACTION_TIMEOUT): Promise<void> {
  const stepNum = await currentStepNumber(page);
  const title = (await page.locator('.demo-live-step-title').textContent())?.trim() ?? '';
  await waitForGql12StepReady(page, timeout);
  const phase = await page.locator(GQL1_PANEL).getAttribute('data-step-phase');
  if (phase === 'done') return;
  await skipGql12Reading(page);
  try {
    await waitForGql12StepDone(page, timeout);
  } catch (err) {
    const stuckPhase = await page.locator(GQL1_PANEL).getAttribute('data-step-phase');
    throw new Error(
      `GQL-12 step ${stepNum} "${title}" stuck in phase "${stuckPhase}" after ${timeout}ms: ${err}`,
    );
  }
}

async function advanceOneGql12Step(page: Page, timeout = DEMO_ACTION_TIMEOUT): Promise<void> {
  const stepBefore = await currentStepNumber(page);
  await completeGql12DemoStep(page, timeout);

  if (stepBefore >= GQL12_LESSON.steps) return;

  const enteringLastStep = stepBefore === GQL12_LESSON.steps - 1;
  await page.locator('[aria-label="Next step"]').click();

  if (enteringLastStep) {
    await waitForGql12StepReady(page, timeout);
  } else {
    await waitForReadingPhase(page, timeout);
  }
}

function gql13StepTimeout(stepIndex: number): number {
  // Introspect, execute, latency re-run, and live restore need extra time.
  if (stepIndex === 4 || stepIndex === 8 || stepIndex === 11 || stepIndex === 13) {
    return MUTATION_TIMEOUT;
  }
  return DEMO_ACTION_TIMEOUT;
}

/** Play through all 15 GQL-13 steps (mock panel, override, latency, restore live). */
export async function walkFullGql13Lesson(page: Page): Promise<void> {
  for (let i = 0; i < GQL13_LESSON.steps - 1; i++) {
    await advanceOneGql13Step(page, gql13StepTimeout(i));
  }
  await completeGql13DemoStep(page, gql13StepTimeout(GQL13_LESSON.steps - 1));
}

async function waitForGql13StepReady(page: Page, timeout = DEMO_ACTION_TIMEOUT): Promise<void> {
  await page.waitForFunction(
    (sel) => {
      const p = document.querySelector(sel)?.getAttribute('data-step-phase');
      return p === 'reading' || p === 'done';
    },
    GQL1_PANEL,
    { timeout },
  );
}

async function waitForGql13StepDone(page: Page, timeout = DEMO_ACTION_TIMEOUT): Promise<void> {
  await page.waitForFunction(
    (sel) => document.querySelector(sel)?.getAttribute('data-step-phase') === 'done',
    GQL1_PANEL,
    { timeout },
  );
}

async function skipGql13Reading(page: Page): Promise<void> {
  const badge = page.locator('.demo-live-phase-badge.skippable');
  await badge.waitFor({ state: 'visible', timeout: 30_000 }).catch(() => {});
  if (await badge.isVisible().catch(() => false)) {
    await badge.click();
  }
}

async function completeGql13DemoStep(page: Page, timeout = DEMO_ACTION_TIMEOUT): Promise<void> {
  const stepNum = await currentStepNumber(page);
  const title = (await page.locator('.demo-live-step-title').textContent())?.trim() ?? '';
  await waitForGql13StepReady(page, timeout);
  const phase = await page.locator(GQL1_PANEL).getAttribute('data-step-phase');
  if (phase === 'done') return;
  await skipGql13Reading(page);
  try {
    await waitForGql13StepDone(page, timeout);
  } catch (err) {
    const stuckPhase = await page.locator(GQL1_PANEL).getAttribute('data-step-phase');
    throw new Error(
      `GQL-13 step ${stepNum} "${title}" stuck in phase "${stuckPhase}" after ${timeout}ms: ${err}`,
    );
  }
}

async function advanceOneGql13Step(page: Page, timeout = DEMO_ACTION_TIMEOUT): Promise<void> {
  const stepBefore = await currentStepNumber(page);
  await completeGql13DemoStep(page, timeout);

  if (stepBefore >= GQL13_LESSON.steps) return;

  const enteringLastStep = stepBefore === GQL13_LESSON.steps - 1;
  await page.locator('[aria-label="Next step"]').click();

  if (enteringLastStep) {
    await waitForGql13StepReady(page, timeout);
  } else {
    await waitForGql13StepReady(page, timeout);
  }
}

function isGql13LiveGraphqlUrl(url: string): boolean {
  return url.includes('localhost:4010') || url.includes('127.0.0.1:4010');
}

function isGql13MockProxyUrl(url: string): boolean {
  return url.includes('/api/graphql/mock') || url.includes('localhost:3001') || url.includes('127.0.0.1:3001');
}

/** Forward Docker (4010) and mock proxy (3001) through /__proxy — required for GQL-13 E2E. */
export async function setupGql13LiveAndMockProxy(page: Page, request: APIRequestContext): Promise<void> {
  await page.route('**/__proxy', async (route) => {
    const bodyStr = route.request().postData() ?? '';
    let payload: { url?: string; method?: string; headers?: Record<string, string>; body?: string } | null = null;
    try {
      payload = JSON.parse(bodyStr) as typeof payload;
    } catch {
      payload = null;
    }
    const targetUrl = payload?.url ?? '';

    if (isGql13MockProxyUrl(targetUrl) || bodyStr.includes('/api/graphql/mock')) {
      try {
        const gqlBody = payload?.body ? JSON.parse(payload.body) : {};
        const res = await request.post(GQL13_MOCK_HTTP, {
          headers: { 'Content-Type': 'application/json', ...(payload?.headers ?? {}) },
          data: gqlBody,
        });
        const text = await res.text();
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: makeProxyEnvelope(res.status(), text),
        });
      } catch {
        return route.abort('failed');
      }
    }

    if (
      isGql13LiveGraphqlUrl(targetUrl) ||
      bodyStr.includes('localhost:4010') ||
      bodyStr.includes('127.0.0.1:4010')
    ) {
      try {
        const url = targetUrl || GQL_HTTP;
        const method = (payload?.method ?? 'POST').toUpperCase();
        const headers = { ...(payload?.headers ?? {}) };
        const res =
          method === 'GET'
            ? await request.get(url, { headers })
            : await request.post(url, {
                headers: { 'Content-Type': 'application/json', ...headers },
                data: payload?.body ? JSON.parse(payload.body) : {},
              });
        const text = await res.text();
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: makeProxyEnvelope(res.status(), text),
        });
      } catch {
        return route.abort('failed');
      }
    }

    try {
      const response = await route.fetch();
      await route.fulfill({ response });
    } catch {
      await route.abort('failed');
    }
  });
}

/** Generic demo-step driver for lessons that use reading-skip + phase=done (GQL-14, GQL-15). */
async function completeGenericGqlDemoStep(
  page: Page,
  lessonLabel: string,
  maxSteps: number,
  timeout = DEMO_ACTION_TIMEOUT,
): Promise<void> {
  const stepNum = await currentStepNumber(page);
  const title = (await page.locator('.demo-live-step-title').textContent())?.trim() ?? '';
  await waitForGql3StepReady(page, timeout);
  const phase = await page.locator(GQL1_PANEL).getAttribute('data-step-phase');
  if (phase === 'done') return;
  await skipGql3Reading(page);
  try {
    await waitForGql3StepDone(page, timeout);
  } catch (err) {
    const stuckPhase = await page.locator(GQL1_PANEL).getAttribute('data-step-phase');
    throw new Error(
      `${lessonLabel} step ${stepNum}/${maxSteps} "${title}" stuck in phase "${stuckPhase}" after ${timeout}ms: ${err}`,
    );
  }
}

async function advanceOneGenericGqlStep(
  page: Page,
  maxSteps: number,
  timeout = DEMO_ACTION_TIMEOUT,
): Promise<void> {
  const stepBefore = await currentStepNumber(page);
  await completeGenericGqlDemoStep(page, 'GQL', maxSteps, timeout);
  if (stepBefore >= maxSteps) return;
  const enteringLastStep = stepBefore === maxSteps - 1;
  await page.locator('[aria-label="Next step"]').click();
  if (enteringLastStep) {
    await waitForGql3StepReady(page, timeout);
  } else {
    await waitForReadingPhase(page, timeout);
  }
}

function makeGqlLessonWalk(lesson: { steps: number }, timeoutFromStep: number) {
  return async function walkFullLesson(page: Page): Promise<void> {
    for (let i = 0; i < lesson.steps - 1; i++) {
      const timeout = i >= timeoutFromStep ? MUTATION_TIMEOUT : DEMO_ACTION_TIMEOUT;
      await advanceOneGenericGqlStep(page, lesson.steps, timeout);
    }
    await completeGenericGqlDemoStep(page, 'GQL', lesson.steps, MUTATION_TIMEOUT);
  };
}

/** Play through all 12 GQL-14 steps (multi-tab workspaces). */
export const walkFullGql14Lesson = makeGqlLessonWalk(GQL14_LESSON, 2);

/** Play through all 10 GQL-15 steps (batch execution). */
export const walkFullGql15Lesson = makeGqlLessonWalk(GQL15_LESSON, 4);

/** Play through all 13 GQL-16 steps (workflow designer; extended timeouts from Quick Test). */
export const walkFullGql16Lesson = makeGqlLessonWalk(GQL16_LESSON, 7);

/** Play through all 9 GQL-17 steps (workflow runner; extended timeouts from start-run). */
export const walkFullGql17Lesson = makeGqlLessonWalk(GQL17_LESSON, 3);

/** Play through all 15 GQL-18 steps (blank canvas build; extended timeouts from first Quick Test). */
export const walkFullGql18Lesson = makeGqlLessonWalk(GQL18_LESSON, 11);

/** Play through all 9 GQL-19 steps (subscription workflow; extended timeouts from Quick Test). */
export const walkFullGql19Lesson = makeGqlLessonWalk(GQL19_LESSON, 6);

/** Playwright E2E: inject desktop mock shim before any navigation (unlocks Start + mock helpers). */
export async function installGql13E2eDesktopShim(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (window as unknown as Record<string, unknown>).__RF_E2E_MOCK_DESKTOP__ = true;
  });
}

/** Playwright E2E: set web-mock flag after app bootstrap (never __TAURI_INTERNALS__ — hangs on Loading). */
export async function activateGql13E2eWebMock(page: Page): Promise<void> {
  await page.waitForSelector('[data-testid="gql-studio-page"]', { timeout: 180_000 });
  await page.evaluate(() => {
    (window as unknown as Record<string, unknown>).__RF_E2E_MOCK_DESKTOP__ = true;
  });
}

export async function isGqlMockProxyHealthy(request: APIRequestContext): Promise<boolean> {
  try {
    const res = await request.get(GQL13_PROXY_HEALTH, { timeout: 5_000 });
    return res.ok();
  } catch {
    return false;
  }
}

async function launchGqlStudio(page: Page, lessonName: string): Promise<void> {
  await launchGqlLesson(page, lessonName);
  await page.waitForSelector('[data-testid="gql-studio-page"]', { timeout: 180_000 });
  await waitForReadingPhase(page, 180_000);
}

/** GQL-1: live proxy only — lesson seeds Environment Manager during early steps. */
export async function prepareGql1DockerLesson(
  page: Page,
  request: APIRequestContext,
): Promise<void> {
  await setupLiveProxy(page, request);
  await launchGqlStudio(page, GQL1_LESSON.name);
}

/** GQL-2: seed EM + proxy + header/env endpoint bootstrap. */
export async function prepareGql2DockerLesson(
  page: Page,
  request: APIRequestContext,
): Promise<void> {
  await seedGqlDemoEnvironmentForE2e(page);
  await setupLiveProxy(page, request);
  await launchGqlStudio(page, GQL2_LESSON.name);
  await ensureGqlDemoHeaderSelected(page);
  await ensureGql2StudioEndpoint(page);
}

/** GQL-6: seed EM + proxy + literal Docker endpoint bootstrap (mutations lesson). */
export async function prepareGql6DockerLesson(
  page: Page,
  request: APIRequestContext,
): Promise<void> {
  await seedGqlDemoEnvironmentForE2e(page);
  await setupLiveProxy(page, request);
  await launchGqlStudio(page, GQL6_LESSON.name);
  await ensureGqlDemoHeaderSelected(page);
  await ensureGql3StudioEndpoint(page);
}

/** GQL-7: seed EM + HTTP proxy + WebSocket passthrough for subscription stream. */
export async function prepareGql7DockerLesson(
  page: Page,
  request: APIRequestContext,
): Promise<void> {
  await seedGqlDemoEnvironmentForE2e(page);
  await setupLiveProxy(page, request);
  await setupLiveWebSocket(page);
  await launchGqlStudio(page, GQL7_LESSON.name);
  await ensureGqlDemoHeaderSelected(page);
  await ensureGql3StudioEndpoint(page);
}

/** GQL-8: seed EM + proxy + literal Docker endpoint (query builder introspect). */
export async function prepareGql8DockerLesson(
  page: Page,
  request: APIRequestContext,
): Promise<void> {
  await seedGqlDemoEnvironmentForE2e(page);
  await setupLiveProxy(page, request);
  await launchGqlStudio(page, GQL8_LESSON.name);
  await ensureGqlDemoHeaderSelected(page);
  await ensureGql3StudioEndpoint(page);
}

/** GQL-9: seed EM + proxy + literal Docker endpoint (history + collections). */
export async function prepareGql9DockerLesson(
  page: Page,
  request: APIRequestContext,
): Promise<void> {
  await seedGqlDemoEnvironmentForE2e(page);
  await setupLiveProxy(page, request);
  await launchGqlStudio(page, GQL9_LESSON.name);
  await ensureGqlDemoHeaderSelected(page);
  await ensureGql3StudioEndpoint(page);
}

/** GQL-10: seed EM + proxy + literal Docker endpoint (builder export + history cURL). */
export async function prepareGql10DockerLesson(
  page: Page,
  request: APIRequestContext,
): Promise<void> {
  await seedGqlDemoEnvironmentForE2e(page);
  await setupLiveProxy(page, request);
  await launchGqlStudio(page, GQL10_LESSON.name);
  await ensureGqlDemoHeaderSelected(page);
  await ensureGql3StudioEndpoint(page);
}

/** GQL-11: seed EM + proxy + literal Docker endpoint (performance tracing + histogram). */
export async function prepareGql11DockerLesson(
  page: Page,
  request: APIRequestContext,
): Promise<void> {
  await seedGqlDemoEnvironmentForE2e(page);
  await setupLiveProxy(page, request);
  await launchGqlStudio(page, GQL11_LESSON.name);
  await ensureGqlDemoHeaderSelected(page);
  await ensureGql3StudioEndpoint(page);
}

/** GQL-12: seed EM + proxy + literal Docker endpoint (schema diff + changelog). */
export async function prepareGql12DockerLesson(
  page: Page,
  request: APIRequestContext,
): Promise<void> {
  await seedGqlDemoEnvironmentForE2e(page);
  await setupLiveProxy(page, request);
  // Phase 8 sweep clears storage in openDemoHub — seed baseline IDB after that clear.
  await openDemoHub(page);
  await selectProtocolsDomain(page);
  await selectCategory(page, 'GraphQL');
  await openLesson(page, GQL12_LESSON.name);
  await waitForPrerequisiteGateUp(page);
  await seedGql12BaselineSnapshotForE2e(page);
  await startLesson(page);
  await page.waitForSelector('[data-testid="gql-studio-page"]', { timeout: 180_000 });
  await ensureGqlDemoHeaderSelected(page);
  await ensureGql3StudioEndpoint(page);
  await waitForReadingPhase(page, 180_000);
}

/** GQL-13: Docker live endpoint + desktop mock proxy (port 3001) with Tauri shim. */
export async function prepareGql13DockerLesson(
  page: Page,
  request: APIRequestContext,
): Promise<void> {
  await seedGqlDemoEnvironmentForE2e(page);
  await seedGqlStudioSettings(page);
  await setupGql13LiveAndMockProxy(page, request);
  await launchGqlStudio(page, GQL13_LESSON.name);
  await activateGql13E2eWebMock(page);
  await ensureGqlDemoHeaderSelected(page);
  await ensureGql3StudioEndpoint(page);
}

/** Normalized connection id — Studio maps localhost → 127.0.0.1 for snapshot keys. */
const GQL12_SCHEMA_CONN_ID = 'http://127.0.0.1:4010/graphql';
const GQL12_BASELINE_LABEL = 'Prior release (demo)';

/** Older SDL variant seeded for GQL-12 diff (matches lesson12-schema-diff helper). */
const GQL12_BASELINE_SDL = `
type Query {
  health: String
  user(id: ID!): User
  users: [User!]!
}

type User {
  id: ID!
  name: String!
}

input OrderInput {
  customerId: ID!
  items: [String!]
}

type Order {
  id: ID!
  status: OrderStatusEnum!
  customerId: ID!
}

enum OrderStatusEnum {
  PENDING
  PROCESSING
  COMPLETE
}

type OrderStatus {
  status: OrderStatusEnum!
  updatedAt: String!
}

type Mutation {
  createOrder(input: OrderInput!): Order!
  createUser(name: String!, email: String!): User!
  deleteUser(id: ID!): DeleteResult!
}

type DeleteResult {
  success: Boolean!
}

type Subscription {
  orderStatus(orderId: ID!): OrderStatus!
}
`;

/** Seed baseline snapshot on normalized endpoint (lesson setup uses localhost — invisible in UI). */
export async function seedGql12BaselineSnapshotForE2e(page: Page): Promise<void> {
  const snapshot = {
    id: `e2e-gql12-baseline-${Date.now()}`,
    connectionId: GQL12_SCHEMA_CONN_ID,
    sdl: GQL12_BASELINE_SDL,
    typesCount: 10,
    capturedAt: Date.now() - 7 * 86_400_000,
    label: GQL12_BASELINE_LABEL,
  };
  await page.evaluate(
    ({ snap, dbName, dbVersion }) =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open(dbName, dbVersion);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('graphql-schema-snapshots')) {
            const store = db.createObjectStore('graphql-schema-snapshots', { keyPath: 'id' });
            store.createIndex('connectionId', 'connectionId', { unique: false });
          }
        };
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('graphql-schema-snapshots', 'readwrite');
          tx.objectStore('graphql-schema-snapshots').put(snap);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      }),
    { snap: snapshot, dbName: 'redfireforge', dbVersion: REDFIREFORGE_IDB_VERSION },
  );
}

/** GQL-3: seed EM + proxy + literal Docker endpoint bootstrap (schema exploration). */
export async function prepareGql3DockerLesson(
  page: Page,
  request: APIRequestContext,
): Promise<void> {
  await seedGqlDemoEnvironmentForE2e(page);
  await setupLiveProxy(page, request);
  await launchGqlStudio(page, GQL3_LESSON.name);
  await ensureGqlDemoHeaderSelected(page);
  await ensureGql3StudioEndpoint(page);
}

/** GQL-4: seed EM + proxy + literal Docker endpoint bootstrap (auth & headers). */
export async function prepareGql4DockerLesson(
  page: Page,
  request: APIRequestContext,
): Promise<void> {
  await seedGqlDemoEnvironmentForE2e(page);
  await setupLiveProxy(page, request);
  await launchGqlStudio(page, GQL4_LESSON.name);
  await ensureGqlDemoHeaderSelected(page);
  await ensureGql3StudioEndpoint(page);
}

/** GQL-5: real Vite __proxy + Node /api/graphql/* handle TLS/mTLS when Docker stacks are up. */
export async function prepareGql5DockerLesson(
  page: Page,
  _request: APIRequestContext,
): Promise<void> {
  await seedGqlDemoEnvironmentForE2e(page);
  // Do not mock __proxy — Vite middleware applies skip-cert, CA, and mTLS from the request body.
  await launchGqlStudio(page, GQL5_LESSON.name);
  await ensureGqlDemoHeaderSelected(page);
}

/** GQL-14: seed EM + proxy + endpoint bootstrap (multi-tab; tabBudget 2). */
export async function prepareGql14DockerLesson(
  page: Page,
  request: APIRequestContext,
): Promise<void> {
  await seedGqlDemoEnvironmentForE2e(page);
  await setupLiveProxy(page, request);
  await launchGqlStudio(page, GQL14_LESSON.name);
  await ensureGqlDemoHeaderSelected(page);
  await ensureGql2StudioEndpoint(page);
}

/** GQL-15: seed EM + proxy + endpoint bootstrap (batch; tabBudget 2). */
export async function prepareGql15DockerLesson(
  page: Page,
  request: APIRequestContext,
): Promise<void> {
  await seedGqlDemoEnvironmentForE2e(page);
  await setupLiveProxy(page, request);
  await launchGqlStudio(page, GQL15_LESSON.name);
  await ensureGqlDemoHeaderSelected(page);
  await ensureGql3StudioEndpoint(page);
}

/** GQL-16: seed EM + proxy + Workflow Designer lesson (Quick Test needs Docker 4010). */
export async function prepareGql16DockerLesson(
  page: Page,
  request: APIRequestContext,
): Promise<void> {
  await seedGqlDemoEnvironmentForE2e(page);
  await setupLiveProxy(page, request);
  await launchGqlLesson(page, GQL16_LESSON.name);
  await page.waitForSelector('[data-testid="demo-live-panel"]', { timeout: 180_000 });
  await waitForReadingPhase(page, 180_000);
}

/** GQL-17: seed EM + proxy + Workflow Runner lesson (3-iteration demo run needs Docker 4010). */
export async function prepareGql17DockerLesson(
  page: Page,
  request: APIRequestContext,
): Promise<void> {
  await seedGqlDemoEnvironmentForE2e(page);
  await setupLiveProxy(page, request);
  await launchGqlLesson(page, GQL17_LESSON.name);
  await page.waitForSelector('[data-testid="demo-live-panel"]', { timeout: 180_000 });
  await waitForReadingPhase(page, 180_000);
}

/** GQL-18: seed EM + proxy + Workflow Designer mutation chain (Quick Test needs Docker 4010). */
export async function prepareGql18DockerLesson(
  page: Page,
  request: APIRequestContext,
): Promise<void> {
  await seedGqlDemoEnvironmentForE2e(page);
  await setupLiveProxy(page, request);
  await launchGqlLesson(page, GQL18_LESSON.name);
  await page.waitForSelector('[data-testid="demo-live-panel"]', { timeout: 180_000 });
  await waitForReadingPhase(page, 180_000);
}

/** GQL-19: seed EM + proxy + WebSocket passthrough + Workflow Designer subscription chain. */
export async function prepareGql19DockerLesson(
  page: Page,
  request: APIRequestContext,
): Promise<void> {
  await seedGqlDemoEnvironmentForE2e(page);
  await setupLiveProxy(page, request);
  await setupLiveWebSocket(page);
  await launchGqlLesson(page, GQL19_LESSON.name);
  await page.waitForSelector('[data-testid="demo-live-panel"]', { timeout: 180_000 });
  await waitForReadingPhase(page, 180_000);
}

export type GqlSmokeLessonId = 'gql1' | 'gql2' | 'gql3';

const SMOKE_LESSONS: Record<GqlSmokeLessonId, { name: string; steps: number; prepare: typeof prepareGql1DockerLesson; walk: (page: Page) => Promise<void> }> = {
  gql1: { ...GQL1_LESSON, prepare: prepareGql1DockerLesson, walk: walkFullGql1Lesson },
  gql2: { ...GQL2_LESSON, prepare: prepareGql2DockerLesson, walk: walkFullGql2Lesson },
  gql3: { ...GQL3_LESSON, prepare: prepareGql3DockerLesson, walk: walkFullGql3Lesson },
};

export function getGqlSmokeLesson(id: GqlSmokeLessonId) {
  return SMOKE_LESSONS[id];
}

export const GQL_SMOKE_LESSON_IDS: GqlSmokeLessonId[] = ['gql1', 'gql2', 'gql3'];
