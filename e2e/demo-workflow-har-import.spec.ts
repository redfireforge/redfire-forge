/**
 * Demo Hub — Workflow HAR Import lesson smoke walk.
 *
 * Run:
 *   npx playwright test --project=demo-wf e2e/demo-workflow-har-import.spec.ts --reporter=html --workers=1
 *
 * See e2e/DEMO-LESSON-E2E-MEMO.md — last-step handling lives in playThroughLesson.
 */
import { test } from '@playwright/test';
import { smokeWalkWorkflowLesson } from './demo-wf-helpers';

test.describe.configure({ mode: 'serial', retries: 0 });

test('WF-HAR: Import Browser Traffic', async ({ page }) => {
  test.setTimeout(600_000);
  await smokeWalkWorkflowLesson(page, {
    category: 'Fundamentals',
    lessonName: /Import Browser Traffic/i,
    expectedSteps: 6,
    actionTimeoutMs: 180_000,
  });
});
