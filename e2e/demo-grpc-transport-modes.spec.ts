/**
 * Demo — GRPC-19 Transport Modes: Express, gRPC-Web & Spring Servlet
 *
 * ONLY this lesson — run via:
 *   npx playwright test e2e/demo-grpc-transport-modes.spec.ts --reporter=html
 *
 * Full lesson needs:
 *   - Go echo server on :50051 + Express backend on :3001 (npm run server)
 *   - Envoy gRPC-Web sidecar on :50055 (cd docker/grpc && docker compose up -d)
 */
import { test, expect } from '@playwright/test';
import {
  advanceSteps,
  completeCurrentStepAction,
  exitLesson,
  getStepInfo,
  launchGrpcLesson,
  playThroughLesson,
  takeNamedScreenshot,
} from './demo-player-helpers';
import {
  isGrpcTransportModesInfraReady,
  silenceLogStream,
} from './grpc-helpers';

const LESSON_NAME = 'Transport Modes: Express, gRPC-Web & Spring Servlet';
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
  // Envoy sidecar (:50055) is probed via Vite→Express proxy at /health/envoy
  await page.route('**/health/envoy', fulfill);
}

test.beforeEach(async ({ page }) => {
  await silenceLogStream(page);
  await mockGrpcHealthProbe(page);
});

test.describe('GRPC-19 — lesson shell', () => {
  test('concept slide starts and exposes 8-step flow', async ({ page }) => {
    await launchGrpcLesson(page, LESSON_NAME);
    const { counter, title } = await getStepInfo(page);
    expect(counter).toMatch(/1\s*[/]\s*8/);
    expect(title).toMatch(/Browsers Need a Transport Mode/i);
    await takeNamedScreenshot(page, 'grpc19-lesson-start');
  });

  test('step 1 tours the four transport mode cards', async ({ page }) => {
    test.setTimeout(120_000);
    await launchGrpcLesson(page, LESSON_NAME);
    await completeCurrentStepAction(page, DEMO_ACTION_TIMEOUT);

    await expect(page.locator('[data-testid="grpc-connection-settings-drawer"]')).toHaveCount(0);
    await takeNamedScreenshot(page, 'grpc19-step1-tour-complete');
  });
});

test.describe('GRPC-19 — full lesson (Docker + Envoy)', () => {
  test('all 8 steps complete: Express → gRPC-Web → fallback retry → compression → per-tab → Tauri intro', async ({ page, request }) => {
    const ready = await isGrpcTransportModesInfraReady(request);
    test.skip(!ready, 'gRPC Docker (:50051), Express backend (:3001), or Envoy sidecar (:50055) not running');

    test.setTimeout(900_000);
    await launchGrpcLesson(page, LESSON_NAME);
    await playThroughLesson(page, LESSON_STEPS, DEMO_ACTION_TIMEOUT);

    const { counter, title } = await getStepInfo(page);
    expect(counter).toMatch(/8\s*[/]\s*8/);
    expect(title).toMatch(/Tauri Native/i);

    await exitLesson(page);
    await takeNamedScreenshot(page, 'grpc19-lesson-complete');
  });

  test('step 4 shows the browser-transport failure and Retry with Express Proxy', async ({ page, request }) => {
    const ready = await isGrpcTransportModesInfraReady(request);
    test.skip(!ready, 'gRPC Docker (:50051), Express backend (:3001), or Envoy sidecar (:50055) not running');

    test.setTimeout(300_000);
    await launchGrpcLesson(page, LESSON_NAME);
    await advanceSteps(page, 3, DEMO_ACTION_TIMEOUT);
    await completeCurrentStepAction(page, DEMO_ACTION_TIMEOUT);

    const { counter, title } = await getStepInfo(page);
    expect(counter).toMatch(/4\s*[/]\s*8/);
    expect(title).toMatch(/Graceful Degradation/i);

    // By the end of step 4's action, the fallback retry has already run and
    // resolved back to a successful Express Proxy response.
    await expect(page.locator('[data-testid="grpc-response-body"]')).toBeVisible({ timeout: 20_000 });
    await takeNamedScreenshot(page, 'grpc19-step4-fallback-recovered');
  });

  test('step 7 proves transport mode is isolated per tab', async ({ page, request }) => {
    const ready = await isGrpcTransportModesInfraReady(request);
    test.skip(!ready, 'gRPC Docker (:50051), Express backend (:3001), or Envoy sidecar (:50055) not running');

    test.setTimeout(300_000);
    await launchGrpcLesson(page, LESSON_NAME);
    await advanceSteps(page, 6, DEMO_ACTION_TIMEOUT);
    await completeCurrentStepAction(page, DEMO_ACTION_TIMEOUT);

    const { counter, title } = await getStepInfo(page);
    expect(counter).toMatch(/7\s*[/]\s*8/);
    expect(title).toMatch(/Per Tab/i);

    // Step may leave a demo scratch tab open — at least one tab remains on Express.
    await expect(page.locator('[data-testid="grpc-tab-bar"] [role="tab"]').first()).toBeVisible();
    await expect(page.locator('[data-testid="grpc-target-input"]')).toHaveValue(/50051|express/i);
    await takeNamedScreenshot(page, 'grpc19-step7-per-tab-confirmed');
  });
});
