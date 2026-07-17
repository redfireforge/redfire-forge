/**
 * GraphQL Demo Hub lessons — smoke auto-play (4F-7)
 *
 * Runs the first three GraphQL lessons end-to-end using the same walk/prepare
 * helpers as the per-lesson Docker specs (extended timeouts, EM seed, GQL-1 last-step fix).
 *
 * Requires the GraphQL test server on port 4010:
 *   cd docker/graphql && docker compose up -d
 *
 * Run:
 *   npm run test:e2e:demo:gql-smoke
 */

import { test, expect } from '@playwright/test';
import { exitLesson, getStepInfo } from './demo-player-helpers';
import { GQL_HEALTH, isGraphqlServerHealthy, silenceLogStream } from './graphql-helpers';
import { GQL_SMOKE_LESSON_IDS, getGqlSmokeLesson } from './graphql-lesson-smoke-helpers';

test.describe.configure({ retries: 0 });

/** Unlock the Docker prerequisite gate when port 4010 is not running locally. */
async function mockGraphqlHealthProbe(page: Parameters<typeof silenceLogStream>[0]): Promise<void> {
  await page.route(GQL_HEALTH, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok' }),
    }),
  );
}

test.beforeEach(async ({ page }) => {
  await silenceLogStream(page);
  await mockGraphqlHealthProbe(page);
});

test.describe('GraphQL lessons — smoke (GQL-1..3)', () => {
  for (const lessonId of GQL_SMOKE_LESSON_IDS) {
    const lesson = getGqlSmokeLesson(lessonId);
    test(`${lesson.name} auto-play completes without errors`, async ({ page, request }) => {
      const healthy = await isGraphqlServerHealthy(request);
      test.skip(!healthy, 'GraphQL test server not running on port 4010 — start docker/graphql');

      test.setTimeout(900_000);
      await lesson.prepare(page, request);
      await lesson.walk(page);

      const { counter } = await getStepInfo(page);
      expect(counter).toMatch(new RegExp(`${lesson.steps}\\s*[/]\\s*${lesson.steps}`));

      await exitLesson(page);
    });
  }
});
