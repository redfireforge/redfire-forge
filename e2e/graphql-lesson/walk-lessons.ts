import type { Page } from '@playwright/test';
import {
  completeCurrentStepAction,
  finishDemoStep,
  runNextStep,
} from '../demo-player-helpers';
import {
  DEMO_ACTION_TIMEOUT,
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
  HISTORY_TIMEOUT,
  MUTATION_TIMEOUT,
} from './constants';
import {
  advanceOneDemoStep,
  completeDemoStep,
  makeDemoLessonWalk,
} from './step-driver';

export const walkFullGql1Lesson = makeDemoLessonWalk({
  lessonLabel: 'GQL-1',
  steps: GQL1_LESSON.steps,
});

/** Play through all 18 GQL-2 steps (extended timeouts for history/compare). */
export async function walkFullGql2Lesson(page: Page): Promise<void> {
  for (let i = 0; i < GQL2_LESSON.steps - 2; i++) {
    const timeout = i >= 11 ? HISTORY_TIMEOUT : DEMO_ACTION_TIMEOUT;
    await runNextStep(page, timeout);
  }
  await completeCurrentStepAction(page, HISTORY_TIMEOUT);
  await page.locator('[aria-label="Next step"]').click();
  await finishDemoStep(page, HISTORY_TIMEOUT);
}

export const walkFullGql3Lesson = makeDemoLessonWalk({
  lessonLabel: 'GQL-3',
  steps: GQL3_LESSON.steps,
  stepTimeout: (i) => (i >= 2 ? MUTATION_TIMEOUT : DEMO_ACTION_TIMEOUT),
  finalTimeout: MUTATION_TIMEOUT,
});

export const walkFullGql4Lesson = makeDemoLessonWalk({
  lessonLabel: 'GQL-4',
  steps: GQL4_LESSON.steps,
  stepTimeout: (i) => (i >= 2 ? MUTATION_TIMEOUT : DEMO_ACTION_TIMEOUT),
  finalTimeout: MUTATION_TIMEOUT,
});

export const walkFullGql5Lesson = makeDemoLessonWalk({
  lessonLabel: 'GQL-5',
  steps: GQL5_LESSON.steps,
  stepTimeout: (i) => (i >= 3 ? MUTATION_TIMEOUT : DEMO_ACTION_TIMEOUT),
  finalTimeout: MUTATION_TIMEOUT,
});

/** Play through all GQL-6 steps (extended timeouts for mutation executes). */
export async function walkFullGql6Lesson(page: Page): Promise<void> {
  for (let i = 0; i < GQL6_LESSON.steps - 2; i++) {
    const timeout = i >= 4 ? MUTATION_TIMEOUT : DEMO_ACTION_TIMEOUT;
    await runNextStep(page, timeout);
  }
  await completeCurrentStepAction(page, MUTATION_TIMEOUT);
  await page.locator('[aria-label="Next step"]').click();
  await finishDemoStep(page, MUTATION_TIMEOUT);
}

export const walkFullGql7Lesson = makeDemoLessonWalk({
  lessonLabel: 'GQL-7',
  steps: GQL7_LESSON.steps,
  stepTimeout: (i) => (i >= 2 ? MUTATION_TIMEOUT : DEMO_ACTION_TIMEOUT),
  finalTimeout: MUTATION_TIMEOUT,
});

export const walkFullGql8Lesson = makeDemoLessonWalk({
  lessonLabel: 'GQL-8',
  steps: GQL8_LESSON.steps,
  stepTimeout: (i) => (i === 0 ? MUTATION_TIMEOUT : DEMO_ACTION_TIMEOUT),
  finalTimeout: DEMO_ACTION_TIMEOUT,
});

export const walkFullGql9Lesson = makeDemoLessonWalk({
  lessonLabel: 'GQL-9',
  steps: GQL9_LESSON.steps,
  stepTimeout: (i) => (i >= 2 ? MUTATION_TIMEOUT : DEMO_ACTION_TIMEOUT),
  finalTimeout: MUTATION_TIMEOUT,
});

export const walkFullGql10Lesson = makeDemoLessonWalk({
  lessonLabel: 'GQL-10',
  steps: GQL10_LESSON.steps,
  stepTimeout: (i) => (i >= 2 ? MUTATION_TIMEOUT : DEMO_ACTION_TIMEOUT),
  finalTimeout: MUTATION_TIMEOUT,
});

export const walkFullGql11Lesson = makeDemoLessonWalk({
  lessonLabel: 'GQL-11',
  steps: GQL11_LESSON.steps,
  stepTimeout: (i) => (i >= 2 ? MUTATION_TIMEOUT : DEMO_ACTION_TIMEOUT),
  finalTimeout: MUTATION_TIMEOUT,
});

export function gql12StepTimeout(stepIndex: number): number {
  return stepIndex <= 2 ? MUTATION_TIMEOUT : DEMO_ACTION_TIMEOUT;
}

/** Play through all 7 GQL-12 steps (snapshots, changelog diff, export JSON). */
export async function walkFullGql12Lesson(page: Page): Promise<void> {
  for (let i = 0; i < GQL12_LESSON.steps - 1; i++) {
    const info = await page.evaluate(() => ({
      counter: document.querySelector('.demo-live-step-counter')?.textContent?.trim() ?? '',
      title: document.querySelector('.demo-live-step-title')?.textContent?.trim() ?? '',
      phase:
        document.querySelector('[data-testid="demo-live-panel"]')?.getAttribute('data-step-phase') ??
        '',
    }));
    console.log(`[GQL-12 walk] step ${i + 1} — ${info.counter} ${info.title} (phase=${info.phase})`);
    await advanceOneDemoStep(page, 'GQL-12', GQL12_LESSON.steps, gql12StepTimeout(i));
  }
  await completeDemoStep(page, 'GQL-12', GQL12_LESSON.steps, DEMO_ACTION_TIMEOUT);
}

export function gql13StepTimeout(stepIndex: number): number {
  if (stepIndex === 4 || stepIndex === 8 || stepIndex === 11 || stepIndex === 13) {
    return MUTATION_TIMEOUT;
  }
  return DEMO_ACTION_TIMEOUT;
}

export const walkFullGql13Lesson = makeDemoLessonWalk({
  lessonLabel: 'GQL-13',
  steps: GQL13_LESSON.steps,
  stepTimeout: gql13StepTimeout,
  finalTimeout: gql13StepTimeout(GQL13_LESSON.steps - 1),
});

function makeGqlLessonWalk(lesson: { steps: number }, timeoutFromStep: number) {
  return makeDemoLessonWalk({
    lessonLabel: 'GQL',
    steps: lesson.steps,
    stepTimeout: (i) => (i >= timeoutFromStep ? MUTATION_TIMEOUT : DEMO_ACTION_TIMEOUT),
    finalTimeout: MUTATION_TIMEOUT,
  });
}

export const walkFullGql14Lesson = makeGqlLessonWalk(GQL14_LESSON, 2);
export const walkFullGql15Lesson = makeGqlLessonWalk(GQL15_LESSON, 4);
export const walkFullGql16Lesson = makeGqlLessonWalk(GQL16_LESSON, 7);
export const walkFullGql17Lesson = makeGqlLessonWalk(GQL17_LESSON, 3);
export const walkFullGql18Lesson = makeGqlLessonWalk(GQL18_LESSON, 12);
/** Heavy step index 7 = Quick Test (0-based) after Variables step was added. */
export const walkFullGql19Lesson = makeGqlLessonWalk(GQL19_LESSON, 7);
