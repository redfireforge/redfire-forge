/** Step execution pipeline — preAction, spotlight, reading, action, verify. */
import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';
import type { DemoActionContext, DemoLesson, DemoStep, SpeedMultiplier, StepPhase } from './types';
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
export const DEMO_PRE_SETTLE_MS = 80;
/** Paint settle before lifting the boot veil when a step has no highlight target. */
export const DEMO_BOOT_SURFACE_MS = 120;
/** Extra settle after the highlight is found so Studio chrome finishes committing. */
/** Two frames — longer settles kept a dark empty veil over an already-ready step 1. */
export const DEMO_BOOT_REVEAL_SETTLE_MS = 32;
export const DEMO_SPOTLIGHT_SETTLE_MS = 700;
export const DEMO_POST_ACTION_SETTLE_MS = 180;
export const DEMO_VERIFY_ABSORB_MS = 550;
/** Cap how long Verifying can poll for a selector (fail fast when missing). */
export const DEMO_VERIFY_WAIT_MS = 3_200;
export const DEMO_VERIFY_WAIT_FROM_READING_MS = 3_600;
/**
 * Hard cap for lesson `action()` execution.
 * Human-paced demos use spotlight holds (0.8–1.2s) plus network waits; multi-beat
 * steps routinely need 20–35s. Keep this above that budget so Acting does not
 * abort mid-tour and spam `[DemoHub] action timed out` warnings.
 * Heavy prep belongs in uncapped `preAction` — not jammed into `action`.
 */
export const DEMO_ACTION_TIMEOUT_MS = 45_000;

/**
 * Race `step.action` against DEMO_ACTION_TIMEOUT_MS.
 * Critical: cancel the timeout when the action settles — otherwise a completed
 * action still logs `[DemoHub] action timed out` ~45s later while the user is
 * on a later step (or parked on Done), which looked like every lesson was broken.
 */
export async function runActionWithTimeout(
  step: DemoStep,
  ctx: DemoActionContext,
  signal: AbortSignal,
  onTimeout: () => void,
): Promise<void> {
  if (!step.action) return;
  let actionSettled = false;
  const timeoutAc = new AbortController();
  const onStepAbort = () => timeoutAc.abort();
  signal.addEventListener('abort', onStepAbort, { once: true });

  const actionPromise = Promise.resolve(step.action(ctx))
    .catch((e) => {
      if (!signal.aborted) console.warn('[DemoHub] action failed:', e);
    })
    .finally(() => {
      actionSettled = true;
      timeoutAc.abort();
    });

  let timedOut = false;
  await Promise.race([
    actionPromise,
    abortableSleep(DEMO_ACTION_TIMEOUT_MS, timeoutAc.signal).then(() => {
      if (!actionSettled && !signal.aborted) {
        timedOut = true;
        console.warn(`[DemoHub] action timed out after ${DEMO_ACTION_TIMEOUT_MS}ms for step ${step.id}`);
      }
    }),
  ]);
  signal.removeEventListener('abort', onStepAbort);
  if (timedOut) onTimeout();
}

export interface UseDemoHubStepPipelineOptions {
  navigateToTab: (tab: string) => void;
  selectedLesson: DemoLesson | null;
  stepIndex: number;
  view: string;
  setStepPhase: (phase: StepPhase) => void;
  /** Fired when Preparing ends and Reading/Acting content should be visible. */
  onPreparingComplete?: () => void;
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
  onPreparingComplete,
  abortRef,
  executingRef,
  skipReadingRef,
  profilesIntroducedInSessionRef,
  envIntroducedInSessionRef,
}: UseDemoHubStepPipelineOptions) {
  const onPreparingCompleteRef = useRef(onPreparingComplete);
  onPreparingCompleteRef.current = onPreparingComplete;
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
    // Bind AbortSignal into ctx so delay/waitFor/click bail when Acting times out
    // or the user advances — otherwise orphaned awaits keep running for tens of seconds.
    const quietCtx = buildQuietDemoActionContext(navigateToTab, signal);
    const visibleCtx = buildDemoActionContext(navigateToTab, signal);
    const scaleMs = (ms: number) => Math.round(ms / speed);

    try {
      const lesson = selectedLesson;
      const targetStepIndex = options?.stepIndex ?? stepIndex;
      if (lesson && isGraphqlStudioLesson(lesson)) {
        syncGqlModalLockForLessonStep(lesson, targetStepIndex, step);
      }

      setStepPhase('pre');
      if (step.preAction) {
        try {
          // Same late-rejection guard as actions — preAction can spawn work that
          // rejects after the step has already moved on (Uncaught (in promise)).
          await Promise.resolve(step.preAction(quietCtx)).catch((e) => {
            if (!signal.aborted) console.warn('[DemoHub] preAction failed:', e);
          });
        } catch (e) {
          console.warn('[DemoHub] preAction failed:', e);
        }
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

      // Keep the boot veil up until the step surface has painted — lifting at the
      // first Reading tick exposed empty Environments/Studio chrome (blue flash).
      const revealBootSurface = (async () => {
        if (step.highlight) {
          try {
            await waitForElement(step.highlight, 2_000, signal);
          } catch { /* reveal anyway — don't trap the user under the veil */ }
          if (signal.aborted) return;
          const allHighlight = document.querySelectorAll(step.highlight);
          const el = Array.from(allHighlight).find(e => isElementVisible(e)) ?? null;
          if (el instanceof HTMLElement) {
            scrollDemoTargetIntoView(el, { block: 'center' });
          }
        } else {
          await abortableSleep(DEMO_BOOT_SURFACE_MS, signal);
        }
        if (signal.aborted) return;
        // Let Studio/Environments finish committing under the veil (tab rename,
        // protocol panel, etc.) — 16ms was too short and still flashed blue.
        await abortableSleep(DEMO_BOOT_REVEAL_SETTLE_MS, signal);
        if (signal.aborted) return;
        onPreparingCompleteRef.current?.();
      })();

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

      await Promise.all([readingPause, revealBootSurface, spotlightWork, readingSyncWork]);
      skipReadingRef.current = null;
      if (signal.aborted) return;

      if (step.action) {
        setStepPhase('action');
        try {
          await runActionWithTimeout(step, visibleCtx, signal, () => {
            if (!signal.aborted) ac.abort();
          });
        } catch (e) {
          console.warn('[DemoHub] action failed:', e);
        }
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
      // Belt: never leave the boot veil stuck if revealBootSurface aborted early.
      onPreparingCompleteRef.current?.();
      if (signal.aborted && abortRef.current === ac) {
        setStepPhase('done');
      }
    }
  }, [navigateToTab, selectedLesson, stepIndex, syncGqlModalLockForLessonStep, abortRef, executingRef, skipReadingRef, setStepPhase]);

  const finishCurrentStepFromReading = useCallback(async (step: DemoStep, speed: SpeedMultiplier) => {
    abortRef.current?.abort();
    purgeAllSpotlightRings();
    skipReadingRef.current?.();
    skipReadingRef.current = null;

    const ac = new AbortController();
    abortRef.current = ac;
    const { signal } = ac;

    executingRef.current = true;
    const visibleCtx = buildDemoActionContext(navigateToTab, signal);
    const scaleMs = (ms: number) => Math.round(ms / speed);
    const lesson = selectedLesson;
    const currentStepIndex = stepIndex;

    try {
      if (step.action) {
        setStepPhase('action');
        try {
          await runActionWithTimeout(step, visibleCtx, signal, () => {
            if (!signal.aborted) ac.abort();
          });
        } catch (e) {
          console.warn('[DemoHub] action failed:', e);
        }
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
  }, [navigateToTab, selectedLesson, stepIndex, abortRef, executingRef, skipReadingRef, setStepPhase]);

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
