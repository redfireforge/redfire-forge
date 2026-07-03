/**
 * Demo — GRPC Phase 12A lessons 2/3: smoke validation
 *
 * Covers:
 * - GRPC-2 Service Discovery with Reflection
 * - GRPC-3 Importing Proto Files
 *
 * Live walkthrough tests auto-skip when Docker gRPC + Express backend are unavailable.
 */
import { test, expect } from '@playwright/test';
import {
  exitLesson,
  finishDemoStep,
  getStepInfo,
  launchGrpcLesson,
  playThroughLesson,
  takeNamedScreenshot,
} from './demo-player-helpers';
import { isGrpcLiveInfraReady, silenceLogStream } from './grpc-helpers';

const GRPC2_LESSON_NAME = 'Service Discovery with Reflection';
const GRPC3_LESSON_NAME = 'Importing Proto Files';
const LESSON_STEPS = 8;
const DEMO_ACTION_TIMEOUT = 180_000;

test.describe.configure({ retries: 0 });

async function mockGrpcHealthProbe(page: Parameters<typeof silenceLogStream>[0]): Promise<void> {
  const fulfill = (route: import('@playwright/test').Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok' }),
    });

  await page.route('http://localhost:50052/health', fulfill);
  await page.route('http://127.0.0.1:50052/health', fulfill);
  await page.route('http://localhost:3001/health', fulfill);
  await page.route('http://127.0.0.1:3001/health', fulfill);
}

test.beforeEach(async ({ page }) => {
  await silenceLogStream(page);
  await mockGrpcHealthProbe(page);
});

test.describe('GRPC-2 — lesson shell', () => {
  test('concept slide starts and exposes 8-step flow', async ({ page }) => {
    await launchGrpcLesson(page, GRPC2_LESSON_NAME);
    const { counter, title } = await getStepInfo(page);
    expect(counter).toMatch(/1\s*[/]\s*8/);
    expect(title).toMatch(/Reflection Workflow/i);
    await takeNamedScreenshot(page, 'grpc2-lesson-start');
  });
});

test.describe('GRPC-3 — lesson shell', () => {
  test('concept slide starts and exposes 8-step flow', async ({ page }) => {
    await launchGrpcLesson(page, GRPC3_LESSON_NAME);
    const { counter, title } = await getStepInfo(page);
    expect(counter).toMatch(/1\s*[/]\s*8/);
    expect(title).toMatch(/Proto Import/i);
    await takeNamedScreenshot(page, 'grpc3-lesson-start');
  });
});

test.describe('GRPC-2/3 — full lesson walkthrough (Docker)', () => {
  test('GRPC-2 completes all 8 steps with reflected call form visible', async ({ page, request }) => {
    const ready = await isGrpcLiveInfraReady(request);
    test.skip(!ready, 'gRPC Docker (:50051) or Express backend (:3001) not running');

    test.setTimeout(900_000);
    await launchGrpcLesson(page, GRPC2_LESSON_NAME);
    await playThroughLesson(page, LESSON_STEPS, DEMO_ACTION_TIMEOUT);

    const { counter, title } = await getStepInfo(page);
    expect(counter).toMatch(/8\s*[/]\s*8/);
    expect(title).toMatch(/Reflection Complete/i);
    await expect(page.locator('[data-testid="grpc-proto-form"]')).toBeVisible({ timeout: 15_000 });

    await exitLesson(page);
    await takeNamedScreenshot(page, 'grpc2-lesson-complete');
  });

  test('GRPC-3 reaches schema-browser flow and finishes on callable form', async ({ page, request }) => {
    const ready = await isGrpcLiveInfraReady(request);
    test.skip(!ready, 'gRPC Docker (:50051) or Express backend (:3001) not running');

    test.setTimeout(900_000);
    await launchGrpcLesson(page, GRPC3_LESSON_NAME);

    // Run until step 7/8 explicitly to assert schema-browser phase before final completion.
    for (let i = 0; i < LESSON_STEPS - 2; i += 1) {
      await finishDemoStep(page, DEMO_ACTION_TIMEOUT);
      await page.locator('[aria-label="Next step"]').click();
    }

    const atStep7 = await getStepInfo(page);
    expect(atStep7.counter).toMatch(/7\s*[/]\s*8/);
    expect(atStep7.title).toMatch(/Open Echo into Call Panel/i);
    await expect(page.locator('[data-testid="grpc-proto-form"]')).toBeVisible({ timeout: 15_000 });

    // Finish step 8/8.
    await finishDemoStep(page, DEMO_ACTION_TIMEOUT);
    await page.locator('[aria-label="Next step"]').click();
    await finishDemoStep(page, DEMO_ACTION_TIMEOUT);

    const done = await getStepInfo(page);
    expect(done.counter).toMatch(/8\s*[/]\s*8/);
    expect(done.title).toMatch(/Proto Import Workflow Complete/i);
    await expect(page.locator('[data-testid="grpc-proto-form"]')).toBeVisible({ timeout: 15_000 });

    await exitLesson(page);
    await takeNamedScreenshot(page, 'grpc3-lesson-complete');
  });
});
