/** Step execution pipeline — preAction, spotlight, reading, action, verify. */
import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';
import type { DemoLesson, DemoStep, SpeedMultiplier, StepPhase } from './types';
import { calcReadingTime } from './types';
import {
  GQL_MODAL_LOCK_OPEN,
  getEnvIntroStepIndex,
  getProfileIntroStepIndex,
  resolveGqlModalLockForLessonStep,
  syncGqlModalLock,
} from './adapters/gqlModalLockBridge';
import { isGraphqlStudioLesson, isGrpcStudioLesson, syncGrpcStudioLessonStepOnComplete } from './adapters';
import { scrollDemoTargetIntoView } from './demoSpotlightUtils';
import {
  abortableSleep,
  buildDemoActionContext,
  buildQuietDemoActionContext,
  isElementVisible,
  waitForElement,
} from './useDemoHubHelpers';
import { purgeAllSpotlightRings } from './demoRipple';

/** Step pipeline timing — tuned for snappy Preparing/Acting badges without skipping UI feedback. */
export const DEMO_PRE_SETTLE_MS = 240;
export const DEMO_SPOTLIGHT_SETTLE_MS = 1200;
export const DEMO_POST_ACTION_SETTLE_MS = 820;
export const DEMO_VERIFY_ABSORB_MS = 1100;
/** Cap how long Verifying can poll for a selector (fail fast when missing). */
export const DEMO_VERIFY_WAIT_MS = 3_200;
export const DEMO_VERIFY_WAIT_FROM_READING_MS = 3_600;

export interface UseDemoHubStepPipelineOptions {
  navigateToTab: (tab: string) => void;
  selectedLesson: DemoLesson | null;
  stepIndex: number;
  view: string;
  setStepPhase: (phase: StepPhase) => void;
  abortRef: MutableRefObject<AbortController | null>;
  executingRef: MutableRefObject<boolean>;
  skipReadingRef: MutableRefObject<(() => void) | null>;
  profilesIntroducedInSessionRef: MutableRefObject<boolean>;
  envIntroducedInSessionRef: MutableRefObject<boolean>;
}

export function useDemoHubStepPipeline({
  navigateToTab,
  selectedLesson,
  stepIndex,
  view,
  setStepPhase,
  abortRef,
  executingRef,
  skipReadingRef,
  profilesIntroducedInSessionRef,
  envIntroducedInSessionRef,
}: UseDemoHubStepPipelineOptions) {
  const buildContext = useCallback(
    () => buildDemoActionContext(navigateToTab),
    [navigateToTab],
  );

  const buildQuietContext = useCallback(
    () => buildQuietDemoActionContext(navigateToTab),
    [navigateToTab],
  );

  const buildQuietContextRef = useRef(buildQuietContext);
  buildQuietContextRef.current = buildQuietContext;

  const syncGqlModalLockForLessonStep = useCallback((
    lesson: DemoLesson,
    targetStepIndex: number,
    step: DemoStep,
  ) => {
    const profileIntroIndex = getProfileIntroStepIndex(lesson.id, lesson.steps);
    if (profileIntroIndex >= 0 && targetStepIndex >= profileIntroIndex) {
      profilesIntroducedInSessionRef.current = true;
    }
    const envIntroIndex = getEnvIntroStepIndex(lesson.id, lesson.steps);
    if (envIntroIndex >= 0 && targetStepIndex >= envIntroIndex) {
      envIntroducedInSessionRef.current = true;
    }
    syncGqlModalLock(resolveGqlModalLockForLessonStep({
      step: { id: step.id, highlight: step.highlight, verify: step.verify },
      lessonId: lesson.id,
      stepIndex: targetStepIndex,
      steps: lesson.steps,
      profilesIntroducedInSession: profilesIntroducedInSessionRef.current,
      envIntroducedInSession: envIntroducedInSessionRef.current,
    }));
  }, [profilesIntroducedInSessionRef, envIntroducedInSessionRef]);

  useEffect(() => {
    if (view !== 'live' || !selectedLesson) return;
    if (!isGraphqlStudioLesson(selectedLesson)) return;
    const step = selectedLesson.steps[stepIndex];
    if (!step) return;
    syncGqlModalLockForLessonStep(selectedLesson, stepIndex, step);
  }, [view, selectedLesson, stepIndex, syncGqlModalLockForLessonStep]);

  const executeCurrentStep = useCallback(async (
    step: DemoStep,
    speed: SpeedMultiplier,
    options?: { skipReading?: boolean; stepIndex?: number },
  ) => {
    abortRef.current?.abort();
    purgeAllSpotlightRings();
    const ac = new AbortController();
    abortRef.current = ac;
    const { signal } = ac;

    executingRef.current = true;
    const quietCtx = buildQuietContext();
    const visibleCtx = buildContext();
    const scaleMs = (ms: number) => Math.round(ms / speed);

    try {
      const lesson = selectedLesson;
      const targetStepIndex = options?.stepIndex ?? stepIndex;
      if (lesson && isGraphqlStudioLesson(lesson)) {
        syncGqlModalLockForLessonStep(lesson, targetStepIndex, step);
      }

      setStepPhase('pre');
      if (step.preAction) {
        try { await step.preAction(quietCtx); } catch (e) { console.warn('[DemoHub] preAction failed:', e); }
        await abortableSleep(DEMO_PRE_SETTLE_MS, signal);
        if (signal.aborted) return;
      }

      setStepPhase('reading');
      const readTime = (typeof step.pauseAfter === 'number') ? step.pauseAfter : calcReadingTime(step);

      const readingPause = options?.skipReading
        ? abortableSleep(100, signal)
        : new Promise<void>((resolve) => {
          skipReadingRef.current = resolve;
          const timer = setTimeout(resolve, scaleMs(readTime));
          signal.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true });
        });

      const spotlightWork = (async () => {
        if (!step.highlight) return;
        await waitForElement(step.highlight, 2000, signal);
        if (signal.aborted) return;
        const allHighlight = document.querySelectorAll(step.highlight);
        const el = Array.from(allHighlight).find(e => isElementVisible(e)) ?? null;
        if (el instanceof HTMLElement) {
          scrollDemoTargetIntoView(el, { block: 'center' });
        }
        await abortableSleep(DEMO_SPOTLIGHT_SETTLE_MS, signal);
      })();

      const readingSyncWork = (async () => {
        if (!step.readingSync) return;
        try {
          await step.readingSync(quietCtx, signal);
        } catch (e) {
          console.warn('[DemoHub] readingSync failed:', e);
        }
      })();

      await Promise.all([readingPause, spotlightWork, readingSyncWork]);
      skipReadingRef.current = null;
      if (signal.aborted) return;

      if (step.action) {
        setStepPhase('action');
        try { await step.action(visibleCtx); } catch (e) { console.warn('[DemoHub] action failed:', e); }
        await abortableSleep(scaleMs(DEMO_POST_ACTION_SETTLE_MS), signal);
        if (signal.aborted) return;
      }

      let stepVerified = !step.verify;
      if (step.verify) {
        setStepPhase('verify');
        stepVerified = await waitForElement(step.verify, DEMO_VERIFY_WAIT_MS, signal);
        if (signal.aborted) return;
        if (stepVerified) {
          await abortableSleep(scaleMs(DEMO_VERIFY_ABSORB_MS), signal);
          if (signal.aborted) return;
        }
      }

      if (lesson && isGrpcStudioLesson(lesson)) {
        syncGrpcStudioLessonStepOnComplete(lesson, step.id, targetStepIndex, {
          verifyRequired: Boolean(step.verify),
          verified: stepVerified,
        });
      }

      setStepPhase('done');
    } finally {
      executingRef.current = false;
      if (signal.aborted && abortRef.current === ac) {
        setStepPhase('done');
      }
    }
  }, [buildContext, buildQuietContext, selectedLesson, stepIndex, syncGqlModalLockForLessonStep, abortRef, executingRef, skipReadingRef, setStepPhase]);

  const finishCurrentStepFromReading = useCallback(async (step: DemoStep, speed: SpeedMultiplier) => {
    abortRef.current?.abort();
    purgeAllSpotlightRings();
    skipReadingRef.current?.();
    skipReadingRef.current = null;

    const ac = new AbortController();
    abortRef.current = ac;
    const { signal } = ac;

    executingRef.current = true;
    const visibleCtx = buildContext();
    const scaleMs = (ms: number) => Math.round(ms / speed);
    const lesson = selectedLesson;
    const currentStepIndex = stepIndex;

    try {
      if (step.action) {
        setStepPhase('action');
        try { await step.action(visibleCtx); } catch (e) { console.warn('[DemoHub] action failed:', e); }
        await abortableSleep(scaleMs(DEMO_POST_ACTION_SETTLE_MS), signal);
        if (signal.aborted) return;
      }

      let stepVerified = !step.verify;
      if (step.verify) {
        setStepPhase('verify');
        stepVerified = await waitForElement(step.verify, DEMO_VERIFY_WAIT_FROM_READING_MS, signal);
        if (signal.aborted) return;
        if (stepVerified) {
          await abortableSleep(scaleMs(DEMO_VERIFY_ABSORB_MS), signal);
          if (signal.aborted) return;
        }
      }

      if (lesson && isGrpcStudioLesson(lesson)) {
        syncGrpcStudioLessonStepOnComplete(lesson, step.id, currentStepIndex, {
          verifyRequired: Boolean(step.verify),
          verified: stepVerified,
        });
      }

      setStepPhase('done');
    } finally {
      executingRef.current = false;
      if (signal.aborted && abortRef.current === ac) {
        setStepPhase('done');
      }
    }
  }, [buildContext, selectedLesson, stepIndex, abortRef, executingRef, skipReadingRef, setStepPhase]);

  const clearGqlIntroSessionFlags = useCallback(() => {
    profilesIntroducedInSessionRef.current = false;
    envIntroducedInSessionRef.current = false;
  }, [profilesIntroducedInSessionRef, envIntroducedInSessionRef]);

  const resetGqlModalSessionFlags = useCallback(() => {
    clearGqlIntroSessionFlags();
    syncGqlModalLock(GQL_MODAL_LOCK_OPEN);
  }, [clearGqlIntroSessionFlags]);

  return {
    buildContext,
    buildQuietContext,
    buildQuietContextRef,
    syncGqlModalLockForLessonStep,
    executeCurrentStep,
    finishCurrentStepFromReading,
    clearGqlIntroSessionFlags,
    resetGqlModalSessionFlags,
  };
}
