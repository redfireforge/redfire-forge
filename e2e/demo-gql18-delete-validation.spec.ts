/**
 * GQL-18 manual validation — Delete User add + configure steps (13–14).
 *
 * Run headed with screenshots:
 *   npx playwright test e2e/demo-gql18-delete-validation.spec.ts --project=demo-gql18 --headed
 */

import { test, expect } from '@playwright/test';
import { GQL } from '../src/shared/selectors';
import {
  advanceSteps,
  completeCurrentStepAction,
  getStepInfo,
  takeNamedScreenshot,
} from './demo-player-helpers';
import { GQL_HEALTH, isGraphqlServerHealthy, silenceLogStream } from './graphql-helpers';
import {
  GQL18_LESSON,
  prepareGql18DockerLesson,
} from './graphql-lesson-smoke-helpers';

const DELETE_NODE_ID = 'gql18-delete';
const MUTATION_TIMEOUT = 300_000;

test.describe.configure({ retries: 0 });

test.beforeEach(async ({ page }) => {
  await silenceLogStream(page);
  await page.route(GQL_HEALTH, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok' }),
    }),
  );
});

test.describe('GQL-18 — Delete User steps (manual validation)', () => {
  test('step 13 adds Delete User node with visible palette click', async ({ page, request }) => {
    const healthy = await isGraphqlServerHealthy(request);
    test.skip(!healthy, 'GraphQL test server not running on port 4010');

    test.setTimeout(MUTATION_TIMEOUT);
    await prepareGql18DockerLesson(page, request);

    // Steps 1–12 complete → land on step 13 (Add Delete User) reading phase.
    await advanceSteps(page, 12, MUTATION_TIMEOUT);

    const { counter, title } = await getStepInfo(page);
    expect(counter).toMatch(/13\s*[/]\s*15/);
    expect(title).toMatch(/Delete User/i);

    await completeCurrentStepAction(page, MUTATION_TIMEOUT);

    await expect(page.locator(`[data-id="${DELETE_NODE_ID}"]`)).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-testid="gql-canvas-mutation-node"]')).toHaveCount(2, {
      timeout: 15_000,
    });

    await takeNamedScreenshot(page, 'gql18-step13-delete-node-added');
  });

  test('step 14 configures deleteUser mutation on Delete User node', async ({ page, request }) => {
    const healthy = await isGraphqlServerHealthy(request);
    test.skip(!healthy, 'GraphQL test server not running on port 4010');

    test.setTimeout(MUTATION_TIMEOUT);
    await prepareGql18DockerLesson(page, request);

    // Through step 13 action → step 14 reading.
    await advanceSteps(page, 13, MUTATION_TIMEOUT);

    const { counter, title } = await getStepInfo(page);
    expect(counter).toMatch(/14\s*[/]\s*15/);
    expect(title).toMatch(/deleteUser/i);

    await completeCurrentStepAction(page, MUTATION_TIMEOUT);

    await expect(page.locator(GQL.WF_MUTATION_PANEL)).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[data-testid="gql-wf-query-editor"]')).toContainText('deleteUser', {
      timeout: 10_000,
    });

    await takeNamedScreenshot(page, 'gql18-step14-delete-configured');
  });
});

// Re-export for alignment test
void GQL18_LESSON;
