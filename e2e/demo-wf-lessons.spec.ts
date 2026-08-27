/**
 * Demo Hub — Workflows domain lesson smoke walks (WF-1 … WF-8, excluding WF-HAR).
 * HAR import lesson lives in demo-workflow-har-import.spec.ts.
 *
 * Run one lesson:
 *   npx playwright test --project=demo-wf e2e/demo-wf-lessons.spec.ts -g "WF-1" --reporter=html --workers=1
 *
 * Run the entire Workflows suite:
 *   npx playwright test --project=demo-wf e2e/demo-wf-lessons.spec.ts --reporter=html --workers=1
 *
 * See e2e/DEMO-LESSON-E2E-MEMO.md — last-step handling lives in playThroughLesson.
 */
import { test } from '@playwright/test';
import { smokeWalkWorkflowLesson } from './demo-wf-helpers';

test.describe.configure({ mode: 'serial', retries: 0 });

const HEAVY_ACTION_TIMEOUT = 180_000;

test('WF-1: Build Your First Workflow', async ({ page }) => {
  test.setTimeout(600_000);
  await smokeWalkWorkflowLesson(page, {
    category: 'Fundamentals',
    lessonName: /Build Your First Workflow/i,
    expectedSteps: 6,
    actionTimeoutMs: HEAVY_ACTION_TIMEOUT,
  });
});

test('WF-2: Variables & Data Flow', async ({ page }) => {
  test.setTimeout(600_000);
  await smokeWalkWorkflowLesson(page, {
    category: 'Fundamentals',
    lessonName: /Variables & Data Flow/i,
    expectedSteps: 5,
    actionTimeoutMs: HEAVY_ACTION_TIMEOUT,
  });
});

test('WF-3: Conditional Branching', async ({ page }) => {
  test.setTimeout(720_000);
  await smokeWalkWorkflowLesson(page, {
    category: 'Logic',
    lessonName: /Conditional Branching/i,
    expectedSteps: 7,
    actionTimeoutMs: HEAVY_ACTION_TIMEOUT,
  });
});

test('WF-4: Loops & Parallel Execution', async ({ page }) => {
  test.setTimeout(720_000);
  await smokeWalkWorkflowLesson(page, {
    category: 'Logic',
    lessonName: /Loops & Parallel Execution/i,
    expectedSteps: 7,
    actionTimeoutMs: HEAVY_ACTION_TIMEOUT,
  });
});

test('WF-5: Error Handling & Recovery', async ({ page }) => {
  test.setTimeout(600_000);
  await smokeWalkWorkflowLesson(page, {
    category: 'Tools',
    lessonName: /Error Handling & Recovery/i,
    expectedSteps: 4,
    actionTimeoutMs: HEAVY_ACTION_TIMEOUT,
  });
});

test('WF-6: Quick Test & Debug Mode', async ({ page }) => {
  test.setTimeout(600_000);
  await smokeWalkWorkflowLesson(page, {
    category: 'Tools',
    lessonName: /Quick Test & Debug Mode/i,
    expectedSteps: 5,
    actionTimeoutMs: HEAVY_ACTION_TIMEOUT,
  });
});

test('WF-7: Versioning, Services & Catalog Integration', async ({ page }) => {
  test.setTimeout(900_000);
  await smokeWalkWorkflowLesson(page, {
    category: 'Tools',
    lessonName: /Versioning, Services & Catalog/i,
    expectedSteps: 8,
    actionTimeoutMs: 240_000,
  });
});


test('WF-8: Protocol Nodes Overview', async ({ page }) => {
  test.setTimeout(600_000);
  await smokeWalkWorkflowLesson(page, {
    category: 'Tools',
    lessonName: /Protocol Nodes Overview/i,
    expectedSteps: 4,
    actionTimeoutMs: HEAVY_ACTION_TIMEOUT,
  });
});
