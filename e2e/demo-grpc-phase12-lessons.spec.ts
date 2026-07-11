/**
 * Demo — GRPC Phase 12A consolidated lessons: smoke validation
 *
 * Covers:
 * - GRPC-16 Schema Discovery: Reflection & Proto Import
 * - GRPC-17 Streaming RPCs: All Four Patterns
 *
 * Live walkthrough tests auto-skip when Docker gRPC + Express backend are unavailable.
 */
import { test, expect } from '@playwright/test';
import {
  exitLesson,
  getStepInfo,
  launchGrpcLesson,
  playThroughLesson,
  takeNamedScreenshot,
} from './demo-player-helpers';
import { isGrpcLiveInfraReady, silenceLogStream } from './grpc-helpers';

const GRPC16_LESSON_NAME = 'Schema Discovery: Reflection & Proto Import';
const GRPC17_LESSON_NAME = 'Streaming RPCs: All Four Patterns';
const DEMO_ACTION_TIMEOUT = 180_000;

function parseStepCounter(counter: string): { current: number; total: number } {
  const match = counter.match(/(\d+)\s*\/\s*(\d+)/);
  const current = Number(match?.[1] ?? NaN);
  const total = Number(match?.[2] ?? NaN);
  return { current, total };
}

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

test.describe('GRPC-16 — lesson shell', () => {
  test('concept slide starts and exposes the lesson flow', async ({ page }) => {
    await launchGrpcLesson(page, GRPC16_LESSON_NAME);
    const { counter, title } = await getStepInfo(page);
    const parsed = parseStepCounter(counter);
    expect(parsed.current).toBe(1);
    expect(parsed.total).toBeGreaterThan(1);
    expect(title).toMatch(/Descriptor Sources Overview/i);
    await takeNamedScreenshot(page, 'grpc16-lesson-start');
  });
});

test.describe('GRPC-17 — lesson shell', () => {
  test('concept slide starts and exposes the lesson flow', async ({ page }) => {
    await launchGrpcLesson(page, GRPC17_LESSON_NAME);
    const { counter, title } = await getStepInfo(page);
    const parsed = parseStepCounter(counter);
    expect(parsed.current).toBe(1);
    expect(parsed.total).toBeGreaterThan(1);
    expect(title).toMatch(/Four Streaming Patterns/i);
    await takeNamedScreenshot(page, 'grpc17-lesson-start');
  });
});

test.describe('GRPC-16/17 — full lesson walkthrough (Docker)', () => {
  test('GRPC-16 completes all steps and returns to the studio shell', async ({ page, request }) => {
    const ready = await isGrpcLiveInfraReady(request);
    test.skip(!ready, 'gRPC Docker (:50051) or Express backend (:3001) not running');

    test.setTimeout(900_000);
    await launchGrpcLesson(page, GRPC16_LESSON_NAME);
    const start = await getStepInfo(page);
    const parsedStart = parseStepCounter(start.counter);
    expect(parsedStart.total).toBeGreaterThan(1);
    await playThroughLesson(page, parsedStart.total, DEMO_ACTION_TIMEOUT);

    const { counter, title } = await getStepInfo(page);
    expect(counter).toMatch(new RegExp(`${parsedStart.total}\\s*[/]\\s*${parsedStart.total}`));
    expect(title).toMatch(/Understanding Schema Drift/i);

    await exitLesson(page);
    await takeNamedScreenshot(page, 'grpc16-lesson-complete');
  });

  test('GRPC-17 completes all steps with callable form visible', async ({ page, request }) => {
    const ready = await isGrpcLiveInfraReady(request);
    test.skip(!ready, 'gRPC Docker (:50051) or Express backend (:3001) not running');

    test.setTimeout(900_000);
    await launchGrpcLesson(page, GRPC17_LESSON_NAME);
    const start = await getStepInfo(page);
    const parsedStart = parseStepCounter(start.counter);
    expect(parsedStart.total).toBeGreaterThan(1);
    await playThroughLesson(page, parsedStart.total, DEMO_ACTION_TIMEOUT);

    const done = await getStepInfo(page);
    expect(done.counter).toMatch(new RegExp(`${parsedStart.total}\\s*[/]\\s*${parsedStart.total}`));
    expect(done.title).toMatch(/Export the Stream Log/i);
    await expect(page.locator('[data-testid="grpc-stream-export-log-btn"], [data-testid="grpc-stream-panel"]').first()).toBeVisible({ timeout: 15_000 });

    await exitLesson(page);
    await takeNamedScreenshot(page, 'grpc17-lesson-complete');
  });
});
