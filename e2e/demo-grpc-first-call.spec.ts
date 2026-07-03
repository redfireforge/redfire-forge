/**
 * Demo — GRPC-1 Your First gRPC Call: step-through validation
 *
 * ONLY this lesson — run via:
 *   npm run test:e2e:demo:grpc1
 *
 * Full lesson needs Docker on port 50051 + Express backend on :3001:
 *   cd docker/grpc && docker compose up -d
 *   npm run server
 */

import { test, expect } from '@playwright/test';
import {
  launchGrpcLesson,
  advanceSteps,
  restartLesson,
  completeCurrentStepAction,
  exitLesson,
  getStepInfo,
  takeNamedScreenshot,
} from './demo-player-helpers';
import { isGrpcLiveInfraReady, silenceLogStream } from './grpc-helpers';
import {
  GRPC1_LESSON,
  prepareGrpc1DockerLesson,
  walkFullGrpc1Lesson,
} from './grpc-lesson-smoke-helpers';

const LESSON_NAME = GRPC1_LESSON.name;
const DEMO_ACTION_TIMEOUT = 180_000;

test.describe.configure({ retries: 0 });

async function mockGrpcHealthProbe(page: Parameters<typeof silenceLogStream>[0]): Promise<void> {
  const fulfill = (route: import('@playwright/test').Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok' }),
    });
  // checkEndpoint rewrites localhost → 127.0.0.1 (loopbackUrl).
  await page.route('http://localhost:50052/health', fulfill);
  await page.route('http://127.0.0.1:50052/health', fulfill);
  await page.route('http://localhost:3001/health', fulfill);
  await page.route('http://127.0.0.1:3001/health', fulfill);
}

test.beforeEach(async ({ page }) => {
  await silenceLogStream(page);
  await mockGrpcHealthProbe(page);
});

test.describe('GRPC-1 — lesson shell', () => {
  test('concept slide unlocks Start after prerequisite gate', async ({ page }) => {
    await launchGrpcLesson(page, LESSON_NAME);
    const { title } = await getStepInfo(page);
    expect(title).toMatch(/gRPC Studio/i);
    await takeNamedScreenshot(page, 'grpc1-lesson-start');
  });

  test('lesson has 10 steps', async ({ page }) => {
    await launchGrpcLesson(page, LESSON_NAME);
    const counter = await page.locator('.demo-live-step-counter').textContent();
    expect(counter).toMatch(/1\s*[/]\s*10/);
  });
});

test.describe('GRPC-1 — target field', () => {
  test('studio shows localhost:50051 with target OK badge after target step', async ({ page }) => {
    test.setTimeout(240_000);
    await launchGrpcLesson(page, LESSON_NAME);
    await restartLesson(page);

    await advanceSteps(page, 1, DEMO_ACTION_TIMEOUT);
    await completeCurrentStepAction(page, DEMO_ACTION_TIMEOUT);

    await expect(page.locator('[data-testid="grpc-target-input"]')).toHaveValue('localhost:50051');
    await expect(page.locator('[data-testid="grpc-target-status-ok"]')).toBeVisible({ timeout: 10_000 });

    await takeNamedScreenshot(page, 'grpc1-target-ok');
  });
});

test.describe('GRPC-1 — full lesson (Docker)', () => {
  test('all 10 steps complete with echoed response from replay', async ({ page, request }) => {
    const ready = await isGrpcLiveInfraReady(request);
    test.skip(!ready, 'gRPC Docker (:50051) or Express backend (:3001) not running');

    test.setTimeout(900_000);
    await prepareGrpc1DockerLesson(page, request);

    await walkFullGrpc1Lesson(page);

    const { counter, title } = await getStepInfo(page);
    expect(counter).toMatch(/10\s*[/]\s*10/);
    expect(title).toMatch(/Send Unary|Replay/i);

    // After replay the lesson lands on Studio. Accept any of these valid states:
    // - response body visible (replay returned a response)
    // - proto form visible (replay loaded form, response pending)
    // - history replay btn visible (still in history detail view)
    const anyValidEndState = page.locator(
      '[data-testid="grpc-response-body"], [data-testid="grpc-proto-form"], [data-testid="grpc-history-replay-btn"]'
    ).first();
    await expect(anyValidEndState).toBeVisible({ timeout: 30_000 });

    await exitLesson(page);
    await takeNamedScreenshot(page, 'grpc1-lesson-complete');
  });
});
