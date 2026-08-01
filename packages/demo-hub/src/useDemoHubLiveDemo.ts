/** Live demo runner — setup, teardown, auto-play, step navigation. */
import { useCallback, useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { DemoHubState, DemoLesson, SpeedMultiplier, StepPhase } from './types';
import type { useDemoProgress } from './useDemoProgress';
import { isLessonDesktopOnlyBlocked } from './utils/lessonPlatform';
import {
  closeWorkflowConfigModal,
  dispatchGqlTabsReload,
  expandAppSidebar,
  isGraphqlStudioLesson,
  completeGrpcStudioLessonRun,
  isGrpcStudioLesson,
  clearGrpcStudioLessonRun,
  loadDemoSession,
  pauseGrpcStudioLessonRun,
  purgeOrphanDemoTabs,
  resumeGrpcStudioLessonRun,
  runGrpcStudioLessonSetup,
  runGrpcStudioLessonTeardown,
} from './adapters';
import {
  clearDemoLiveSession,
  consumeLiveDemoResumeOnce,
  readDemoLiveSession,
} from './demoLiveSession';
import { syncDemoLiveGuard } from './demoLiveGuard';
import {
  closeGraphqlDemoWorkspaceQuiet,
  findLessonById,
  runGqlDemoStorageHygiene,
  runGqlStudioLessonTeardown,
  runGrpcDemoStorageHygiene,
} from './useDemoHubHelpers';
import { purgeAllSpotlightRings } from './demoRipple';
import type { DemoStep } from './types';

export interface UseDemoHubLiveDemoOptions {
  navigateToTab: (tab: string) => void;
  pause: (ms: number) => Promise<void>;
  state: DemoHubState;
  setState: Dispatch<SetStateAction<DemoHubState>>;
  setStepPhase: (phase: StepPhase) => void;
  stepPhaseRef: MutableRefObject<StepPhase>;
  progress: ReturnType<typeof useDemoProgress>;
  buildQuietContext: () => ReturnType<typeof import('./useDemoHubHelpers').buildQuietDemoActionContext>;
  executeCurrentStep: (
    step: DemoStep,
    speed: SpeedMultiplier,
    options?: { skipReading?: boolean; stepIndex?: number },
  ) => Promise<void>;
  finishCurrentStepFromReading: (step: DemoStep, speed: SpeedMultiplier) => Promise<void>;
  syncGqlModalLockForLessonStep: (lesson: DemoLesson, stepIndex: number, step: DemoStep) => void;
  resetGqlModalSessionFlags: () => void;
  clearGqlIntroSessionFlags: () => void;
  openIsolatedStudioDemoTabSession: (lesson: DemoLesson) => Promise<void>;
  closeIsolatedStudioDemoTabSession: (options?: { restorePreviousTab?: boolean }) => Promise<void>;
  ensureActiveDemoTabOrCreate: (lesson: DemoLesson) => Promise<void>;
  autoPlayRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  autoPlayGenRef: MutableRefObject<number>;
  abortRef: MutableRefObject<AbortController | null>;
  executingRef: MutableRefObject<boolean>;
  skipReadingRef: MutableRefObject<(() => void) | null>;
  isMountedRef: MutableRefObject<boolean>;
  isPlayingRef: MutableRefObject<boolean>;
  suppressLiveTabExitRef: MutableRefObject<boolean>;
  shouldResumeLiveRef: MutableRefObject<boolean>;
}

export function useDemoHubLiveDemo({
  navigateToTab,
  pause,
  state,
  setState,
  setStepPhase,
  stepPhaseRef,
  progress,
  buildQuietContext,
  executeCurrentStep,
  finishCurrentStepFromReading,
  syncGqlModalLockForLessonStep,
  resetGqlModalSessionFlags,
  clearGqlIntroSessionFlags,
  openIsolatedStudioDemoTabSession,
  closeIsolatedStudioDemoTabSession,
  ensureActiveDemoTabOrCreate,
  autoPlayRef,
  autoPlayGenRef,
  abortRef,
  executingRef,
  skipReadingRef,
  isMountedRef,
  isPlayingRef,
  suppressLiveTabExitRef,
  shouldResumeLiveRef,
}: UseDemoHubLiveDemoOptions) {
  const pauseAutoPlay = useCallback(() => {
    if (autoPlayRef.current) {
      clearTimeout(autoPlayRef.current);
      autoPlayRef.current = null;
    }
    autoPlayGenRef.current++;
    isPlayingRef.current = false;
    abortRef.current?.abort();
    purgeAllSpotlightRings();
    skipReadingRef.current?.();
    skipReadingRef.current = null;
    setStepPhase('done');
    const lesson = state.selectedLesson;
    if (lesson && isGrpcStudioLesson(lesson)) {
      pauseGrpcStudioLessonRun();
    }
  }, [state.selectedLesson, autoPlayRef, autoPlayGenRef, isPlayingRef, abortRef, skipReadingRef, setStepPhase]);

  const runLiveLessonCleanup = useCallback(async (lesson: DemoLesson | null | undefined) => {
    if (!lesson) return;
    purgeAllSpotlightRings();
    // Block DemoShellHost's live→initialTab bounce while we pin Contents.
    suppressLiveTabExitRef.current = true;
    try {
      expandAppSidebar();
      // Keep Demo Hub / Contents stable — cleanup must not flash Environments/Studio.
      navigateToTab('demo-hub');
      const baseCtx = buildQuietContext();
      const ctx = {
        ...baseCtx,
        navigateToTab: (tab: string) => {
          if (tab === 'demo-hub') navigateToTab(tab);
        },
      };
      if (isGraphqlStudioLesson(lesson)) {
        await runGqlStudioLessonTeardown(lesson, ctx);
      } else if (isGrpcStudioLesson(lesson)) {
        await runGrpcStudioLessonTeardown(lesson, ctx);
      } else if (lesson.cleanup) {
        await lesson.cleanup(ctx).catch((e) => {
          console.warn('[DemoHub] Lesson cleanup failed:', e);
        });
      }
    } finally {
      await closeIsolatedStudioDemoTabSession();
      purgeAllSpotlightRings();
      navigateToTab('demo-hub');
      suppressLiveTabExitRef.current = false;
    }
  }, [buildQuietContext, closeIsolatedStudioDemoTabSession, navigateToTab, suppressLiveTabExitRef]);

  const runLiveDemoSetup = useCallback(async (lesson: DemoLesson, gen: number): Promise<boolean> => {
    suppressLiveTabExitRef.current = true;
    try {
      await closeIsolatedStudioDemoTabSession({ restorePreviousTab: false });
      if (lesson.initialTab) navigateToTab(lesson.initialTab);
      expandAppSidebar();
      await new Promise(r => setTimeout(r, 350));
      if (isGraphqlStudioLesson(lesson)) {
        await runGqlDemoStorageHygiene();
      }
      if (isGrpcStudioLesson(lesson)) {
        await runGrpcDemoStorageHygiene();
        try {
          runGrpcStudioLessonSetup(lesson);
        } catch (e) {
          console.warn('[DemoHub] gRPC lesson runtime setup failed:', e);
        }
      }
      await openIsolatedStudioDemoTabSession(lesson);
      if (lesson.setup) {
        const ctx = buildQuietContext();
        try { await lesson.setup(ctx); } catch (e) { console.warn('[DemoHub] Lesson setup failed:', e); }
      }
      return autoPlayGenRef.current === gen;
    } finally {
      suppressLiveTabExitRef.current = false;
    }
  }, [navigateToTab, buildQuietContext, closeIsolatedStudioDemoTabSession, openIsolatedStudioDemoTabSession, suppressLiveTabExitRef, autoPlayGenRef]);

  const resumeInterruptedLiveDemo = useCallback(async () => {
    const lesson = state.selectedLesson;
    if (!lesson) return;
    const session = readDemoLiveSession();
    const stepIndex = Math.min(
      Math.max(0, session?.stepIndex ?? state.stepIndex),
      lesson.steps.length - 1,
    );
    const resumePlaying = session?.isPlaying ?? false;
    const gen = autoPlayGenRef.current;
    const ok = await runLiveDemoSetup(lesson, gen);
    if (!ok || !isMountedRef.current) return;

    const step = lesson.steps[stepIndex];
    if (step) {
      await executeCurrentStep(step, state.speed, { skipReading: true, stepIndex });
      if (!isMountedRef.current || autoPlayGenRef.current !== gen) return;
      progress.setLessonStep(lesson.id, stepIndex);
    }

    if (resumePlaying && isMountedRef.current) {
      setState(prev => ({ ...prev, isPlaying: true, stepIndex }));
    } else {
      setStepPhase('done');
    }
  }, [state.selectedLesson, state.stepIndex, state.speed, runLiveDemoSetup, executeCurrentStep, progress, isMountedRef, autoPlayGenRef, setState, setStepPhase]);

  useEffect(() => {
    if (!shouldResumeLiveRef.current) return;
    shouldResumeLiveRef.current = false;
    void resumeInterruptedLiveDemo();
  }, [resumeInterruptedLiveDemo, shouldResumeLiveRef]);

  const startLiveDemo = useCallback(async () => {
    const lesson = state.selectedLesson;
    if (!lesson) return;
    if (isLessonDesktopOnlyBlocked(lesson)) return;

    const gen = autoPlayGenRef.current;

    resetGqlModalSessionFlags();
    setState(prev => ({ ...prev, view: 'live', stepIndex: 0, isPlaying: false }));

    const ok = await runLiveDemoSetup(lesson, gen);
    if (!ok) return;

    if (isMountedRef.current && lesson.steps[0]) {
      await executeCurrentStep(lesson.steps[0], state.speed, { stepIndex: 0 });
      progress.setLessonStep(lesson.id, 0);
    }
  }, [state.selectedLesson, state.speed, runLiveDemoSetup, executeCurrentStep, progress, resetGqlModalSessionFlags, autoPlayGenRef, isMountedRef, setState]);

  const goToStep = useCallback(async (index: number) => {
    const lesson = state.selectedLesson;
    if (!lesson) return;
    closeWorkflowConfigModal();
    const clamped = Math.max(0, Math.min(index, lesson.steps.length - 1));
    if (autoPlayRef.current) clearTimeout(autoPlayRef.current);
    autoPlayGenRef.current++;
    abortRef.current?.abort();
    setStepPhase('pre');
    const targetStep = lesson.steps[clamped];
    if (isGraphqlStudioLesson(lesson)) {
      syncGqlModalLockForLessonStep(lesson, clamped, targetStep);
    }
    setState(prev => ({ ...prev, stepIndex: clamped, isPlaying: false }));
    await executeCurrentStep(targetStep, state.speed, { stepIndex: clamped });
    progress.setLessonStep(lesson.id, clamped);
    if (clamped >= lesson.steps.length - 1) {
      setState(prev => ({ ...prev, isPlaying: false }));
    }
  }, [state.selectedLesson, state.speed, executeCurrentStep, progress, syncGqlModalLockForLessonStep, autoPlayRef, autoPlayGenRef, abortRef, setStepPhase, setState]);

  const nextStep = useCallback(async () => {
    const lesson = state.selectedLesson;
    if (!lesson) return;
    if (state.stepIndex >= lesson.steps.length - 1) return;
    if (stepPhaseRef.current === 'reading') {
      await finishCurrentStepFromReading(lesson.steps[state.stepIndex], state.speed);
    }
    await goToStep(state.stepIndex + 1);
  }, [state.selectedLesson, state.stepIndex, state.speed, goToStep, finishCurrentStepFromReading, stepPhaseRef]);

  const toggleAutoPlay = useCallback(() => {
    const shouldPause = isPlayingRef.current;
    const lesson = state.selectedLesson;
    const atEnd = lesson != null && state.stepIndex >= lesson.steps.length - 1;
    const willReplayAtEnd = !shouldPause && atEnd && lesson != null;

    if (willReplayAtEnd && isGrpcStudioLesson(lesson)) {
      clearGrpcStudioLessonRun();
    }

    setState(prev => {
      const newPlaying = !prev.isPlaying;
      const replayLesson = prev.selectedLesson;
      const replayAtEnd = replayLesson && prev.stepIndex >= replayLesson.steps.length - 1;
      if (newPlaying && replayAtEnd && replayLesson) {
        const currentSpeed = prev.speed;
        const atEndGen = autoPlayGenRef.current;
        setTimeout(async () => {
          if (!isMountedRef.current || autoPlayGenRef.current !== atEndGen) return;
          const ctx = buildQuietContext();
          if (replayLesson.cleanup) {
            try { await replayLesson.cleanup(ctx); } catch (e) { console.warn('[DemoHub] Lesson cleanup failed:', e); }
          }
          /* v8 ignore next */
          if (!isMountedRef.current || autoPlayGenRef.current !== atEndGen) return;
          if (replayLesson.initialTab) ctx.navigateToTab(replayLesson.initialTab);
          expandAppSidebar();
          await new Promise(r => setTimeout(r, 120));
          if (!isMountedRef.current || autoPlayGenRef.current !== atEndGen) return;
          if (isGraphqlStudioLesson(replayLesson)) {
            await runGqlDemoStorageHygiene();
          }
          if (isGrpcStudioLesson(replayLesson)) {
            await runGrpcDemoStorageHygiene();
            try {
              runGrpcStudioLessonSetup(replayLesson);
            } catch (e) {
              console.warn('[DemoHub] gRPC lesson runtime setup failed:', e);
            }
          }
          await ensureActiveDemoTabOrCreate(replayLesson);
          if (replayLesson.setup) {
            try { await replayLesson.setup(ctx); } catch (e) { console.warn('[DemoHub] Lesson setup failed:', e); }
          }
          if (isMountedRef.current && replayLesson.steps[0] && autoPlayGenRef.current === atEndGen) {
            setState(prevState => ({ ...prevState, isPlaying: true }));
            await executeCurrentStep(replayLesson.steps[0], currentSpeed, { stepIndex: 0 });
            progress.setLessonStep(replayLesson.id, 0);
          }
        }, 50);
        return { ...prev, isPlaying: false, stepIndex: 0 };
      }
      return { ...prev, isPlaying: newPlaying };
    });
    if (shouldPause) {
      pauseAutoPlay();
    } else if (state.selectedLesson && isGrpcStudioLesson(state.selectedLesson)) {
      resumeGrpcStudioLessonRun();
    }
  }, [buildQuietContext, ensureActiveDemoTabOrCreate, executeCurrentStep, progress, pauseAutoPlay, state.selectedLesson, state.stepIndex, isPlayingRef, autoPlayGenRef, isMountedRef, setState]);

  const { setLessonStep: progressSetStep } = progress;

  useEffect(() => {
    if (!state.isPlaying || state.view !== 'live' || !state.selectedLesson) return;
    const lesson = state.selectedLesson;
    if (state.stepIndex >= lesson.steps.length - 1) {
      setState(prev => ({ ...prev, isPlaying: false }));
      return;
    }

    const breathingPause = Math.round(4200 / state.speed);
    const gen = ++autoPlayGenRef.current;

    autoPlayRef.current = setTimeout(async () => {
      /* v8 ignore next */
      if (!isMountedRef.current || !isPlayingRef.current || autoPlayGenRef.current !== gen) return;
      /* v8 ignore start */
      while (executingRef.current) {
        await new Promise(r => setTimeout(r, 200));
        if (!isMountedRef.current || !isPlayingRef.current || autoPlayGenRef.current !== gen) return;
      }
      if (!isPlayingRef.current || autoPlayGenRef.current !== gen) return;
      /* v8 ignore stop */
      closeWorkflowConfigModal();
      const nextIdx = state.stepIndex + 1;
      setStepPhase('pre');
      setState(prev => ({ ...prev, stepIndex: nextIdx }));
      await executeCurrentStep(lesson.steps[nextIdx], state.speed, { stepIndex: nextIdx });
      progressSetStep(lesson.id, nextIdx);
    }, breathingPause);

    return () => {
      if (autoPlayRef.current) {
        clearTimeout(autoPlayRef.current);
        autoPlayRef.current = null;
      }
    };
  }, [state.isPlaying, state.stepIndex, state.view, state.selectedLesson, state.speed, executeCurrentStep, progressSetStep, autoPlayRef, autoPlayGenRef, isMountedRef, isPlayingRef, executingRef, setStepPhase, setState]);

  const restartDemo = useCallback(async () => {
    const lesson = state.selectedLesson;
    if (!lesson) return;
    if (isGrpcStudioLesson(lesson)) {
      clearGrpcStudioLessonRun();
    }
    clearGqlIntroSessionFlags();
    closeWorkflowConfigModal();
    if (autoPlayRef.current) clearTimeout(autoPlayRef.current);
    autoPlayGenRef.current++;
    abortRef.current?.abort();
    setState(prev => ({ ...prev, stepIndex: 0, isPlaying: false }));
    setStepPhase('done');
    const gen = autoPlayGenRef.current;
    const ctx = buildQuietContext();
    if (lesson.cleanup) {
      try { await lesson.cleanup(ctx); } catch (e) { console.warn('[DemoHub] cleanup failed:', e); }
    }
    suppressLiveTabExitRef.current = true;
    try {
      if (lesson.initialTab) navigateToTab(lesson.initialTab);
      expandAppSidebar();
      await new Promise(r => setTimeout(r, 120));
      if (isGraphqlStudioLesson(lesson)) {
        await runGqlDemoStorageHygiene();
      }
      if (isGrpcStudioLesson(lesson)) {
        await runGrpcDemoStorageHygiene();
        try {
          runGrpcStudioLessonSetup(lesson);
        } catch (e) {
          console.warn('[DemoHub] gRPC lesson runtime setup failed:', e);
        }
      }
      await ensureActiveDemoTabOrCreate(lesson);
      if (lesson.setup) {
        try { await lesson.setup(ctx); } catch (e) { console.warn('[DemoHub] setup failed:', e); }
      }
      if (autoPlayGenRef.current !== gen) return;
    } finally {
      suppressLiveTabExitRef.current = false;
    }
    if (isMountedRef.current && lesson.steps[0]) {
      await executeCurrentStep(lesson.steps[0], state.speed, { stepIndex: 0 });
      progress.setLessonStep(lesson.id, 0);
    }
  }, [state.selectedLesson, state.speed, navigateToTab, buildQuietContext, ensureActiveDemoTabOrCreate, executeCurrentStep, progress, clearGqlIntroSessionFlags, autoPlayRef, autoPlayGenRef, abortRef, suppressLiveTabExitRef, isMountedRef, setState, setStepPhase]);

  const exitLiveDemo = useCallback(async () => {
    const liveSession = readDemoLiveSession();
    const lesson =
      state.selectedLesson
      ?? (liveSession ? findLessonById(liveSession.lessonId)?.lesson ?? null : null);

    // Must be set BEFORE navigateToTab('demo-hub'): DemoShellHost redirects
    // live+demo-hub → lesson.initialTab, which flashes Studio/header on Exit.
    suppressLiveTabExitRef.current = true;

    resetGqlModalSessionFlags();
    clearDemoLiveSession();
    closeWorkflowConfigModal();
    if (autoPlayRef.current) {
      clearTimeout(autoPlayRef.current);
      autoPlayRef.current = null;
    }
    autoPlayGenRef.current++;
    abortRef.current?.abort();
    skipReadingRef.current?.();
    skipReadingRef.current = null;
    // Drop any lingering spotlight rings before Contents is shown.
    purgeAllSpotlightRings();
    setState(prev => ({ ...prev, view: 'concept', isPlaying: false }));
    progress.setLastView('concept');
    setStepPhase('done');
    void syncDemoLiveGuard(false);
    navigateToTab('demo-hub');

    try {
      await pause(60);

      if (lesson) {
        expandAppSidebar();
        // Lesson cleanup historically navigates to Environments / Studio tabs.
        // Swallow those navigations so Contents stays stable (no flashing UI).
        const baseCtx = buildQuietContext();
        const ctx = {
          ...baseCtx,
          navigateToTab: (tab: string) => {
            if (tab === 'demo-hub') navigateToTab(tab);
          },
        };
        if (isGraphqlStudioLesson(lesson)) {
          try { await runGqlStudioLessonTeardown(lesson, ctx); } catch (e) {
            console.warn('[DemoHub] Lesson cleanup failed:', e);
          }
        } else if (isGrpcStudioLesson(lesson)) {
          try { await runGrpcStudioLessonTeardown(lesson, ctx); } catch (e) {
            console.warn('[DemoHub] Lesson cleanup failed:', e);
          }
        } else if (lesson.cleanup) {
          try { await lesson.cleanup(ctx); } catch (e) { console.warn('[DemoHub] Lesson cleanup failed:', e); }
        }
      }

      await closeIsolatedStudioDemoTabSession();

      try {
        const gqlSession = await loadDemoSession();
        if (gqlSession) {
          await closeGraphqlDemoWorkspaceQuiet(gqlSession.lessonId);
        }
        await purgeOrphanDemoTabs();
        dispatchGqlTabsReload();
      } catch (e) {
        console.warn('[DemoHub] GQL workspace force cleanup failed:', e);
      }
    } finally {
      purgeAllSpotlightRings();
      navigateToTab('demo-hub');
      suppressLiveTabExitRef.current = false;
    }
  }, [state.selectedLesson, buildQuietContext, closeIsolatedStudioDemoTabSession, progress, pause, navigateToTab, resetGqlModalSessionFlags, autoPlayRef, autoPlayGenRef, abortRef, skipReadingRef, setState, setStepPhase, suppressLiveTabExitRef]);

  const confirmLessonComplete = useCallback(() => {
    const lesson = state.selectedLesson;
    if (lesson) {
      if (isGrpcStudioLesson(lesson)) {
        completeGrpcStudioLessonRun();
      }
      progress.markLessonComplete(lesson.id, lesson.contentVersion ?? 1, lesson.steps.length);
    }
  }, [state.selectedLesson, progress]);

  return {
    pauseAutoPlay,
    runLiveLessonCleanup,
    startLiveDemo,
    exitLiveDemo,
    goToStep,
    nextStep,
    toggleAutoPlay,
    restartDemo,
    confirmLessonComplete,
  };
}

/** Initialise shouldResumeLiveRef — consumed once on mount. */
export function createShouldResumeLiveRef(): boolean {
  if (!consumeLiveDemoResumeOnce()) return false;
  const session = readDemoLiveSession();
  return !!(session && findLessonById(session.lessonId));
}
