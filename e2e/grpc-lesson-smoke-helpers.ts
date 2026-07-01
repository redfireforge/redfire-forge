/**
 * Shared walk helpers for GRPC-1 Docker E2E.
 */
import { GRPC1_LESSON } from './grpc-lesson/constants';
import type { APIRequestContext, Page } from '@playwright/test';
import {
  launchGrpcLesson,
  completeCurrentStepAction,
  finishDemoStep,
  runNextStep,
} from './demo-player-helpers';

export { GRPC1_LESSON } from './grpc-lesson/constants';

const DEMO_ACTION_TIMEOUT = 180_000;

export async function prepareGrpc1DockerLesson(
  page: Page,
  _request: APIRequestContext,
): Promise<void> {
  await launchGrpcLesson(page, GRPC1_LESSON.name);
  await page.waitForSelector('[data-testid="grpc-studio-page"]', { timeout: 180_000 });
}

/** Play through all GRPC-1 steps (last step uses finishDemoStep — never runNextStep on 8/8). */
export async function walkFullGrpc1Lesson(page: Page): Promise<void> {
  for (let i = 0; i < GRPC1_LESSON.steps - 2; i++) {
    await runNextStep(page, DEMO_ACTION_TIMEOUT);
  }
  await completeCurrentStepAction(page, DEMO_ACTION_TIMEOUT);
  await page.locator('[aria-label="Next step"]').click();
  await finishDemoStep(page, DEMO_ACTION_TIMEOUT);
}
