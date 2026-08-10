import type { APIRequestContext, Page } from '@playwright/test';
import {
  launchGqlLesson,
  openDemoHub,
  openLesson,
  selectCategory,
  selectProtocolsDomain,
  startLesson,
  waitForPrerequisiteGateUp,
  waitForReadingPhase,
} from '../demo-player-helpers';
import {
  ensureGql2StudioEndpoint,
  ensureGql3StudioEndpoint,
  ensureGqlDemoHeaderSelected,
  seedGqlDemoEnvironmentForE2e,
  seedGqlStudioSettings,
  setupLiveProxy,
  setupLiveWebSocket,
} from '../graphql-helpers';
import {
  GQL1_LESSON,
  GQL2_LESSON,
  GQL3_LESSON,
  GQL4_LESSON,
  GQL5_LESSON,
  GQL6_LESSON,
  GQL7_LESSON,
  GQL8_LESSON,
  GQL9_LESSON,
  GQL10_LESSON,
  GQL11_LESSON,
  GQL12_LESSON,
  GQL13_LESSON,
  GQL14_LESSON,
  GQL15_LESSON,
  GQL16_LESSON,
  GQL17_LESSON,
  GQL18_LESSON,
  GQL19_LESSON,
} from './constants';
import { seedGql12BaselineSnapshotForE2e } from './gql12-baseline';
import { activateGql13E2eWebMock, setupGql13LiveAndMockProxy } from './gql13-mock';

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
  // GQL-1 intentionally starts in Environment Manager at step 1.
  await launchGqlLesson(page, GQL1_LESSON.name);
  await waitForReadingPhase(page, 180_000);
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
