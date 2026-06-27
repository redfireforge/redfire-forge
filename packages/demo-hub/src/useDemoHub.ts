/** Demo Hub — state machine hook */
import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  DemoHubState,
  DemoDomain,
  DemoLesson,
  DemoStep,
  SpeedMultiplier,
  HubView,
  StepPhase,
} from './types';
import { calcReadingTime } from './types';
import { useDemoProgress } from './useDemoProgress';
import { isLessonDesktopOnlyBlocked } from './utils/lessonPlatform';
import { isWorkflowDesignerLesson } from './utils/workflowLessonUi';
import {
  closeWorkflowConfigModal,
  expandAppSidebar,
  isGraphqlStudioLesson,
} from './adapters';
import {
  GQL_MODAL_LOCK_OPEN,
  getEnvIntroStepIndex,
  getProfileIntroStepIndex,
  resolveGqlModalLockForLessonStep,
  syncGqlModalLock,
} from './adapters/gqlModalLockBridge';
import {
  clearDemoLiveSession,
  consumeLiveDemoResumeOnce,
  persistDemoLiveSession,
  readDemoLiveSession,
} from './demoLiveSession';
import { startDemoLiveGuardHeartbeat, syncDemoLiveGuard } from './demoLiveGuard';
import { scrollDemoTargetIntoView } from './demoSpotlightUtils';
import {
  abortableSleep,
  buildDemoActionContext,
  buildQuietDemoActionContext,
  findLessonById,
  isElementVisible,
  restoreStateFromProgress,
  runGqlDemoStorageHygiene,
  runGqlStudioLessonTeardown,
  waitForElement,
} from './useDemoHubHelpers';

/** Step pipeline timing — tuned for snappy Preparing/Acting badges without skipping UI feedback. */
const DEMO_PRE_SETTLE_MS = 60;
const DEMO_SPOTLIGHT_SETTLE_MS = 250;
const DEMO_POST_ACTION_SETTLE_MS = 350;
const DEMO_VERIFY_ABSORB_MS = 500;

export interface UseDemoHubOptions {
  navigateToTab: (tab: string) => void;
}

export function useDemoHub({ navigateToTab }: UseDemoHubOptions) {
  const progress = useDemoProgress();
  const shouldResumeLiveRef = useRef(
    (() => {
      if (!consumeLiveDemoResumeOnce()) return false;
      const session = readDemoLiveSession();
      return !!(session && findLessonById(session.lessonId));
    })(),
  );
  // Restore the last navigation position from localStorage so a hard refresh
  // returns the user to the same page they were on (or resumes live demo).
  const [state, setState] = useState<DemoHubState>(() => restoreStateFromProgress(progress.data));
  const [hubOpen, setHubOpen] = useState(false);
  const [stepPhase, setStepPhase] = useState<StepPhase>('done');

  const autoPlayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  /** Abort controller for the currently-running step pipeline.
   *  Bumped on every goToStep / nextStep / exitLiveDemo so that
   *  a stale pipeline stops early instead of racing the new one. */
  const abortRef = useRef<AbortController | null>(null);
  /** True while executeCurrentStep is running — prevents auto-play
   *  from firing a second pipeline concurrently. */
  const executingRef = useRef(false);
  /** Resolve function for the reading-phase sleep — called by skipReading(). */
  const skipReadingRef = useRef<(() => void) | null>(null);
  /**
   * Monotone counter bumped whenever we want to cancel any pending auto-play
   * callbacks. clearTimeout() only cancels timers that haven't fired yet; if a
   * timer callback is already running asynchronously (after its 1500ms pause),
   * clearTimeout is a no-op. By checking the generation at each await point
   * inside the callback we guarantee that any already-running callback that
   * belongs to a previous session exits cleanly instead of overwriting state.
   */
  const autoPlayGenRef = useRef(0);
  /**
   * While true, useDemoShortcuts must not auto-exit live mode for tab mismatch.
   * startLiveDemo sets this before navigateToTab + view:'live' so a one-frame
   * stale activeTab (still demo-hub) cannot immediately call exitLiveDemo().
   */
  const suppressLiveTabExitRef = useRef(false);
  /**
   * Once the viewer reaches the profile-save step in a live GraphQL lesson,
   * keep Profiles unlocked for the rest of the session (even if they rewind).
   */
  const profilesIntroducedInSessionRef = useRef(false);
  /**
   * Once the viewer reaches the env-setup step in a live GraphQL lesson,
   * keep Env unlocked for the rest of the session (even if they rewind).
   */
  const envIntroducedInSessionRef = useRef(false);
  /** Mirrors isPlaying for async auto-play callbacks (state closures can be stale). */
  const isPlayingRef = useRef(false);
  /** Mirrors stepPhase so nextStep can finish a skipped reading phase reliably. */
  const stepPhaseRef = useRef<StepPhase>(stepPhase);

  useEffect(() => {
    isPlayingRef.current = state.isPlaying;
  }, [state.isPlaying]);

  useEffect(() => {
    stepPhaseRef.current = stepPhase;
  }, [stepPhase]);

  /** Cancel pending auto-play timers and in-flight step pipelines. */
  const pauseAutoPlay = useCallback(() => {
    if (autoPlayRef.current) {
      clearTimeout(autoPlayRef.current);
      autoPlayRef.current = null;
    }
    autoPlayGenRef.current++;
    isPlayingRef.current = false;
    abortRef.current?.abort();
    skipReadingRef.current?.();
    skipReadingRef.current = null;
    setStepPhase('done');
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    return () => { if (autoPlayRef.current) clearTimeout(autoPlayRef.current); };
  }, []);

  /** Persist live demo progress so reload / HMR can restore the overlay. */
  useEffect(() => {
    if (state.view === 'live' && state.selectedLesson) {
      persistDemoLiveSession({
        lessonId: state.selectedLesson.id,
        stepIndex: state.stepIndex,
        isPlaying: state.isPlaying,
        speed: state.speed,
        savedAt: Date.now(),
      });
    }
  }, [state.view, state.selectedLesson, state.stepIndex, state.isPlaying, state.speed]);

  useEffect(() => {
    const onPageHide = () => {
      if (state.view === 'live' && state.selectedLesson) {
        persistDemoLiveSession({
          lessonId: state.selectedLesson.id,
          stepIndex: state.stepIndex,
          isPlaying: state.isPlaying,
          speed: state.speed,
          savedAt: Date.now(),
        });
      }
    };
    window.addEventListener('pagehide', onPageHide);
    return () => window.removeEventListener('pagehide', onPageHide);
  }, [state.view, state.selectedLesson, state.stepIndex, state.isPlaying, state.speed]);

  /** Tell Vite dev middleware not to let E2E sweeps kill :5173 while demoing. */
  useEffect(() => {
    if (state.view !== 'live' || !state.selectedLesson) {
      void syncDemoLiveGuard(false);
      return;
    }
    return startDemoLiveGuardHeartbeat(state.selectedLesson.id);
  }, [state.view, state.selectedLesson]);

  /** Free GraphQL Studio modals whenever live demo is not active. */
  useEffect(() => {
    if (state.view !== 'live') {
      profilesIntroducedInSessionRef.current = false;
      envIntroducedInSessionRef.current = false;
      syncGqlModalLock(GQL_MODAL_LOCK_OPEN);
    }
  }, [state.view]);

  // Derived: hub overlay visible when not in live mode
  const hubVisible = hubOpen && state.view !== 'live';

  // ─── Navigation ────────────────────────────────────────────────
  const openHub = useCallback(() => {
    setHubOpen(true);
    setState(prev => ({ ...prev, view: 'domains' }));
    progress.setLastView('domains');
  }, [progress]);

  const selectDomain = useCallback((domain: DemoDomain) => {
    if (!domain.available) return;
    // Clear selectedLesson so a fresh domain entry always starts without a category hint
    setState(prev => ({ ...prev, view: 'lessons', selectedDomain: domain, selectedLesson: null }));
    progress.setLastDomain(domain.id);
    progress.setLastView('lessons');
  }, [progress]);

  const selectLesson = useCallback((lesson: DemoLesson) => {
    setState(prev => ({ ...prev, view: 'concept', selectedLesson: lesson, stepIndex: 0 }));
    progress.setLastLesson(lesson.id);
    progress.setLastView('concept');
  }, [progress]);

  // ─── Lesson Completion ────────────────────────────────────────
  /** User clicked "Complete" — mark lesson done. exitLiveDemo is called separately. */
  const confirmLessonComplete = useCallback(() => {
    const lesson = state.selectedLesson;
    if (lesson) progress.markLessonComplete(lesson.id);
  }, [state.selectedLesson, progress]);

  // ─── Action Context Builder ────────────────────────────────────
  const buildContext = useCallback(
    () => buildDemoActionContext(navigateToTab),
    [navigateToTab],
  );

  /** Build a "quiet" context without visual ripple — for preAction, setup, cleanup */
  const buildQuietContext = useCallback(
    () => buildQuietDemoActionContext(navigateToTab),
    [navigateToTab],
  );

  const buildQuietContextRef = useRef(buildQuietContext);
  buildQuietContextRef.current = buildQuietContext;

  /** Run lesson cleanup when leaving live mode via hub chrome (close/back). */
  const runLiveLessonCleanup = useCallback((lesson: DemoLesson | null | undefined) => {
    if (!lesson) return Promise.resolve();
    if (isWorkflowDesignerLesson(lesson)) {
      expandAppSidebar();
    }
    const ctx = buildQuietContext();
    if (isGraphqlStudioLesson(lesson)) {
      return runGqlStudioLessonTeardown(lesson, ctx);
    }
    if (lesson.cleanup) {
      return lesson.cleanup(ctx).catch((e) => {
        console.warn('[DemoHub] Lesson cleanup failed:', e);
      });
    }
    return Promise.resolve();
  }, [buildQuietContext]);

  /** Jump directly to the domain selector from any view — used by the
   *  "Learning Hub" breadcrumb so it always lands on the root, not the
   *  intermediate lessons list. */
  const goToDomains = useCallback(() => {
    if (autoPlayRef.current) clearTimeout(autoPlayRef.current);
    autoPlayGenRef.current++;
    abortRef.current?.abort();
    const leavingLive = state.view === 'live';
    const lesson = leavingLive ? state.selectedLesson : null;
    if (leavingLive) {
      clearDemoLiveSession();
      void syncDemoLiveGuard(false);
      if (lesson) void runLiveLessonCleanup(lesson);
    }
    progress.setLastView('domains');
    setState(prev => ({
      ...prev,
      view: 'domains' as HubView,
      selectedDomain: null,
      isPlaying: false,
    }));
  }, [state.view, state.selectedLesson, progress, runLiveLessonCleanup]);

  const closeHub = useCallback(() => {
    if (autoPlayRef.current) clearTimeout(autoPlayRef.current);
    autoPlayGenRef.current++;
    abortRef.current?.abort();
    const lesson = state.selectedLesson;
    const liveLesson = state.view === 'live' ? lesson : null;
    if (liveLesson) {
      void runLiveLessonCleanup(liveLesson);
    } else if (lesson && isGraphqlStudioLesson(lesson)) {
      void runGqlStudioLessonTeardown(lesson, buildQuietContextRef.current());
    }
    setHubOpen(false);
    setState(prev => ({ ...prev, isPlaying: false }));
  }, [state.view, state.selectedLesson, runLiveLessonCleanup]);

  const goBack = useCallback(() => {
    const leavingLive = state.view === 'live';
    const lesson = leavingLive ? state.selectedLesson : null;
    if (autoPlayRef.current) clearTimeout(autoPlayRef.current);
    if (leavingLive) {
      clearDemoLiveSession();
      void syncDemoLiveGuard(false);
    }
    setState(prev => {
      switch (prev.view) {
        case 'lessons':
          progress.setLastView('domains');
          return { ...prev, view: 'domains' as HubView, selectedDomain: null };
        case 'concept':
          progress.setLastView('lessons');
          return { ...prev, view: 'lessons' as HubView };
        case 'live':
          progress.setLastView('concept');
          return { ...prev, view: 'concept' as HubView, isPlaying: false };
        default: return prev;
      }
    });
    if (leavingLive) {
      runLiveLessonCleanup(lesson);
    }
  }, [state.view, state.selectedLesson, progress, runLiveLessonCleanup]);

  // ─── Live Demo Execution ───────────────────────────────────────
  const syncGqlModalLockForLessonStep = useCallback((
    lesson: DemoLesson,
    stepIndex: number,
    step: DemoStep,
  ) => {
    const profileIntroIndex = getProfileIntroStepIndex(lesson.id, lesson.steps);
    if (profileIntroIndex >= 0 && stepIndex >= profileIntroIndex) {
      profilesIntroducedInSessionRef.current = true;
    }
    const envIntroIndex = getEnvIntroStepIndex(lesson.id, lesson.steps);
    if (envIntroIndex >= 0 && stepIndex >= envIntroIndex) {
      envIntroducedInSessionRef.current = true;
    }
    syncGqlModalLock(resolveGqlModalLockForLessonStep({
      step: { id: step.id, highlight: step.highlight, verify: step.verify },
      lessonId: lesson.id,
      stepIndex,
      steps: lesson.steps,
      profilesIntroducedInSession: profilesIntroducedInSessionRef.current,
      envIntroducedInSession: envIntroducedInSessionRef.current,
    }));
  }, []);

  /** Keep Env lock in sync when live step changes (including session restore before executeCurrentStep). */
  useEffect(() => {
    if (state.view !== 'live' || !state.selectedLesson) return;
    if (!isGraphqlStudioLesson(state.selectedLesson)) return;
    const step = state.selectedLesson.steps[state.stepIndex];
    if (!step) return;
    syncGqlModalLockForLessonStep(state.selectedLesson, state.stepIndex, step);
  }, [state.view, state.selectedLesson, state.stepIndex, syncGqlModalLockForLessonStep]);

  /**
   * Step execution pipeline (human-paced):
   *   1. preAction — invisible nav/setup (instant, quiet)
   *   2. spotlight — retry-find highlight target, scroll into view
   *   3. reading  — pause for user to read narration
   *   4. action   — visible action with click ripple
   *   5. verify   — retry-wait for result selector
   *   6. done     — post-action settle pause
   */
  const executeCurrentStep = useCallback(async (
    step: DemoStep,
    speed: SpeedMultiplier,
    options?: { skipReading?: boolean; stepIndex?: number },
  ) => {
    // Cancel any prior running pipeline
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const { signal } = ac;

    executingRef.current = true;
    const quietCtx = buildQuietContext();
    const visibleCtx = buildContext();
    const scaleMs = (ms: number) => Math.round(ms / speed);

    try {
      const lesson = state.selectedLesson;
      const stepIndex = options?.stepIndex ?? state.stepIndex;
      if (lesson && isGraphqlStudioLesson(lesson)) {
        syncGqlModalLockForLessonStep(lesson, stepIndex, step);
      }

      // Phase 1: preAction (invisible navigation)
      setStepPhase('pre');
      if (step.preAction) {
        try { await step.preAction(quietCtx); } catch (e) { console.warn('[DemoHub] preAction failed:', e); }
        await abortableSleep(DEMO_PRE_SETTLE_MS, signal); // DOM settle
        if (signal.aborted) return;
      }

      // Phase 2+3: spotlight target + reading pause run together so the
      // "Reading — click to skip" badge is visible during both waits.
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

      // Phase 4: visible action (with click ripple)
      if (step.action) {
        setStepPhase('action');
        try { await step.action(visibleCtx); } catch (e) { console.warn('[DemoHub] action failed:', e); }
        // Post-action settle — lets user see the result of the click/fill
        await abortableSleep(scaleMs(DEMO_POST_ACTION_SETTLE_MS), signal);
        if (signal.aborted) return;
      }

      // Phase 5: verify (retry-wait for result)
      if (step.verify) {
        setStepPhase('verify');
        await waitForElement(step.verify, 3000, signal);
        if (signal.aborted) return;
        await abortableSleep(scaleMs(DEMO_VERIFY_ABSORB_MS), signal); // absorb result
        if (signal.aborted) return;
      }

      setStepPhase('done');
    } finally {
      executingRef.current = false;
      if (signal.aborted && abortRef.current === ac) {
        setStepPhase('done');
      }
    }
  }, [buildContext, buildQuietContext, state.selectedLesson, state.stepIndex, syncGqlModalLockForLessonStep]);

  /** Run action + verify when the user skips the reading pause via Next / ArrowRight. */
  const finishCurrentStepFromReading = useCallback(async (step: DemoStep, speed: SpeedMultiplier) => {
    abortRef.current?.abort();
    skipReadingRef.current?.();
    skipReadingRef.current = null;

    const ac = new AbortController();
    abortRef.current = ac;
    const { signal } = ac;

    executingRef.current = true;
    const visibleCtx = buildContext();
    const scaleMs = (ms: number) => Math.round(ms / speed);

    try {
      if (step.action) {
        setStepPhase('action');
        try { await step.action(visibleCtx); } catch (e) { console.warn('[DemoHub] action failed:', e); }
        await abortableSleep(scaleMs(DEMO_POST_ACTION_SETTLE_MS), signal);
        if (signal.aborted) return;
      }

      if (step.verify) {
        setStepPhase('verify');
        await waitForElement(step.verify, 25000, signal);
        if (signal.aborted) return;
        await abortableSleep(scaleMs(DEMO_VERIFY_ABSORB_MS), signal);
        if (signal.aborted) return;
      }

      setStepPhase('done');
    } finally {
      executingRef.current = false;
      if (signal.aborted && abortRef.current === ac) {
        setStepPhase('done');
      }
    }
  }, [buildContext]);

  const runLiveDemoSetup = useCallback(async (lesson: DemoLesson, gen: number): Promise<boolean> => {
    suppressLiveTabExitRef.current = true;
    try {
      if (lesson.initialTab) navigateToTab(lesson.initialTab);
      if (isWorkflowDesignerLesson(lesson)) {
        expandAppSidebar();
      }
      await new Promise(r => setTimeout(r, 350));
      if (isGraphqlStudioLesson(lesson)) {
        await runGqlDemoStorageHygiene();
      }
      if (lesson.setup) {
        const ctx = buildQuietContext();
        try { await lesson.setup(ctx); } catch (e) { console.warn('[DemoHub] Lesson setup failed:', e); }
      }
      return autoPlayGenRef.current === gen;
    } finally {
      suppressLiveTabExitRef.current = false;
    }
  }, [navigateToTab, buildQuietContext]);

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
  }, [state.selectedLesson, state.stepIndex, state.speed, runLiveDemoSetup, executeCurrentStep, progress]);

  useEffect(() => {
    if (!shouldResumeLiveRef.current) return;
    shouldResumeLiveRef.current = false;
    void resumeInterruptedLiveDemo();
  }, [resumeInterruptedLiveDemo]);

  const startLiveDemo = useCallback(async () => {
    const lesson = state.selectedLesson;
    if (!lesson) return;
    if (isLessonDesktopOnlyBlocked(lesson)) return;

    const gen = autoPlayGenRef.current;

    profilesIntroducedInSessionRef.current = false;
    envIntroducedInSessionRef.current = false;
    syncGqlModalLock(GQL_MODAL_LOCK_OPEN);
    setState(prev => ({ ...prev, view: 'live', stepIndex: 0, isPlaying: false }));

    const ok = await runLiveDemoSetup(lesson, gen);
    if (!ok) return;

    if (isMountedRef.current && lesson.steps[0]) {
      await executeCurrentStep(lesson.steps[0], state.speed, { stepIndex: 0 });
      progress.setLessonStep(lesson.id, 0);
    }
  }, [state.selectedLesson, state.speed, runLiveDemoSetup, executeCurrentStep, progress]);

  const goToStep = useCallback(async (index: number) => {
    const lesson = state.selectedLesson;
    if (!lesson) return;
    closeWorkflowConfigModal();
    const clamped = Math.max(0, Math.min(index, lesson.steps.length - 1));
    if (autoPlayRef.current) clearTimeout(autoPlayRef.current);
    autoPlayGenRef.current++; // invalidate any already-running auto-play callback
    // Abort any running pipeline so it doesn't race with the new one
    abortRef.current?.abort();
    // Reset phase BEFORE updating stepIndex to prevent spotlight flash
    setStepPhase('pre');
    const targetStep = lesson.steps[clamped];
    if (isGraphqlStudioLesson(lesson)) {
      syncGqlModalLockForLessonStep(lesson, clamped, targetStep);
    }
    setState(prev => ({ ...prev, stepIndex: clamped, isPlaying: false }));
    await executeCurrentStep(targetStep, state.speed, { stepIndex: clamped });
    progress.setLessonStep(lesson.id, clamped);
    // At the last step: stop auto-play so the user can read before choosing to Complete.
    if (clamped >= lesson.steps.length - 1) {
      setState(prev => ({ ...prev, isPlaying: false }));
    }
  }, [state.selectedLesson, state.speed, executeCurrentStep, progress, syncGqlModalLockForLessonStep]);

  const nextStep = useCallback(async () => {
    const lesson = state.selectedLesson;
    if (!lesson) return;
    // At the last step the Next button is disabled in LiveDemo; nothing to do here.
    if (state.stepIndex >= lesson.steps.length - 1) return;
    if (stepPhaseRef.current === 'reading') {
      await finishCurrentStepFromReading(lesson.steps[state.stepIndex], state.speed);
    }
    await goToStep(state.stepIndex + 1);
  }, [state.selectedLesson, state.stepIndex, state.speed, goToStep, finishCurrentStepFromReading]);


  const toggleAutoPlay = useCallback(() => {
    let shouldPause = false;
    setState(prev => {
      const newPlaying = !prev.isPlaying;
      if (!newPlaying) shouldPause = true;
      // If starting play at the last step, restart from step 0
      const lesson = prev.selectedLesson;
      const atEnd = lesson && prev.stepIndex >= lesson.steps.length - 1;
      if (newPlaying && atEnd && lesson) {
        const currentSpeed = prev.speed;
        // Snapshot current generation so the async callback can detect if
        // restart/exit was triggered while cleanup/setup was in progress.
        const atEndGen = autoPlayGenRef.current;
        // Run cleanup → setup → step 0 action asynchronously after state update.
        // NOTE: isPlaying starts as false so the auto-play effect does NOT fire
        // concurrently with cleanup/setup (which would race against them switching
        // tabs and cause template/profile deletion to fail). isPlaying is re-enabled
        // inside the callback after setup completes.
        setTimeout(async () => {
          if (!isMountedRef.current || autoPlayGenRef.current !== atEndGen) return;
          const ctx = buildQuietContext();
          if (lesson.cleanup) {
            try { await lesson.cleanup(ctx); } catch (e) { console.warn('[DemoHub] Lesson cleanup failed:', e); }
          }
          /* v8 ignore next */
          if (!isMountedRef.current || autoPlayGenRef.current !== atEndGen) return;
          // Navigate back to the lesson's starting tab (same as restartDemo does).
          if (lesson.initialTab) ctx.navigateToTab(lesson.initialTab);
          if (isWorkflowDesignerLesson(lesson)) {
            expandAppSidebar();
          }
          await new Promise(r => setTimeout(r, 350));
          if (!isMountedRef.current || autoPlayGenRef.current !== atEndGen) return;
          if (isGraphqlStudioLesson(lesson)) {
            await runGqlDemoStorageHygiene();
          }
          if (lesson.setup) {
            try { await lesson.setup(ctx); } catch (e) { console.warn('[DemoHub] Lesson setup failed:', e); }
          }
          if (isMountedRef.current && lesson.steps[0] && autoPlayGenRef.current === atEndGen) {
            // Re-enable auto-play now that setup is done, then execute step 0.
            setState(prev => ({ ...prev, isPlaying: true }));
            await executeCurrentStep(lesson.steps[0], currentSpeed, { stepIndex: 0 });
            progress.setLessonStep(lesson.id, 0);
          }
        }, 50);
        // Start with isPlaying: false to prevent the auto-play effect from racing
        // with cleanup/setup (it would immediately schedule step 1 before setup finishes).
        return { ...prev, isPlaying: false, stepIndex: 0 };
      }
      return { ...prev, isPlaying: newPlaying };
    });
    if (shouldPause) pauseAutoPlay();
  }, [buildQuietContext, executeCurrentStep, progress, pauseAutoPlay]);

  // Stable progress callbacks — useCallback([update]) where update is useCallback([])
  // so these never change reference across renders. Destructured here to keep
  // the auto-play effect deps stable (avoids re-firing when progress.data updates).
  const { setLessonStep: progressSetStep, resetLesson, resetProgress } = progress;

  // Auto-play effect: step execution includes its own reading pauses,
  // so we just chain steps sequentially when playing
  useEffect(() => {
    if (!state.isPlaying || state.view !== 'live' || !state.selectedLesson) return;
    const lesson = state.selectedLesson;
    if (state.stepIndex >= lesson.steps.length - 1) {
      setState(prev => ({ ...prev, isPlaying: false }));
      return;
    }

    // Breathing room between steps — long enough to feel like a pause
    const breathingPause = Math.round(1500 / state.speed);
    // Stamp this callback with the current generation so that if restart/exit
    // bumps the counter while this callback is already executing, the callback
    // can detect it is stale and bail out without overwriting state.
    const gen = ++autoPlayGenRef.current;

    autoPlayRef.current = setTimeout(async () => {
      /* v8 ignore next */
      if (!isMountedRef.current || !isPlayingRef.current || autoPlayGenRef.current !== gen) return;
      // Wait for any running step pipeline to finish before advancing.
      // At slower speeds (0.5×), setup + step execution can exceed the
      // breathing pause — without this poll the demo would get permanently stuck.
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
  }, [state.isPlaying, state.stepIndex, state.view, state.selectedLesson, state.speed, executeCurrentStep, progressSetStep]);

  const restartDemo = useCallback(async () => {
    const lesson = state.selectedLesson;
    if (!lesson) return;
    profilesIntroducedInSessionRef.current = false;
    envIntroducedInSessionRef.current = false;
    closeWorkflowConfigModal();
    if (autoPlayRef.current) clearTimeout(autoPlayRef.current);
    autoPlayGenRef.current++; // invalidate any already-running auto-play callback
    abortRef.current?.abort();
    setState(prev => ({ ...prev, stepIndex: 0, isPlaying: false }));
    setStepPhase('done');
    const gen = autoPlayGenRef.current; // capture after increment
    const ctx = buildQuietContext();
    if (lesson.cleanup) {
      try { await lesson.cleanup(ctx); } catch (e) { console.warn('[DemoHub] cleanup failed:', e); }
    }
    suppressLiveTabExitRef.current = true;
    try {
      if (lesson.initialTab) navigateToTab(lesson.initialTab);
      if (isWorkflowDesignerLesson(lesson)) {
        expandAppSidebar();
      }
      await new Promise(r => setTimeout(r, 350));
      if (isGraphqlStudioLesson(lesson)) {
        await runGqlDemoStorageHygiene();
      }
      if (lesson.setup) {
        try { await lesson.setup(ctx); } catch (e) { console.warn('[DemoHub] setup failed:', e); }
      }
      // Guard: if exit/restart was called again during setup, bail out.
      if (autoPlayGenRef.current !== gen) return;
    } finally {
      suppressLiveTabExitRef.current = false;
    }
    if (isMountedRef.current && lesson.steps[0]) {
      await executeCurrentStep(lesson.steps[0], state.speed, { stepIndex: 0 });
      progress.setLessonStep(lesson.id, 0);
    }
  }, [state.selectedLesson, state.speed, navigateToTab, buildQuietContext, executeCurrentStep, progress]);

  // Exit live mode → immediately return to concept view, then run cleanup in background.
  // Cleanup is intentionally deferred so the concept page renders without delay —
  // the user should never see a blank body while cleanup operations complete.
  const exitLiveDemo = useCallback(async () => {
    await syncDemoLiveGuard(false);
    profilesIntroducedInSessionRef.current = false;
    envIntroducedInSessionRef.current = false;
    syncGqlModalLock(GQL_MODAL_LOCK_OPEN);
    clearDemoLiveSession();
    closeWorkflowConfigModal();
    if (autoPlayRef.current) clearTimeout(autoPlayRef.current);
    autoPlayGenRef.current++; // invalidate any already-running auto-play callback
    abortRef.current?.abort(); // stop any running step pipeline

    // Show concept view immediately — cleanup runs silently in the background.
    setState(prev => ({ ...prev, view: 'concept', isPlaying: false }));
    progress.setLastView('concept');
    setStepPhase('done');

    // Run lesson cleanup after the view change so the UI is never blank.
    // Cleanup only manipulates hidden tab DOM (WS Studio, Kafka Studio, etc.)
    // so it is safe to run while the user is viewing the concept page.
    const lesson = state.selectedLesson;
    if (lesson) {
      if (isWorkflowDesignerLesson(lesson)) {
        expandAppSidebar();
      }
      const ctx = buildQuietContext();
      if (isGraphqlStudioLesson(lesson)) {
        try { await runGqlStudioLessonTeardown(lesson, ctx); } catch (e) {
          console.warn('[DemoHub] Lesson cleanup failed:', e);
        }
      } else if (lesson.cleanup) {
        try { await lesson.cleanup(ctx); } catch (e) { console.warn('[DemoHub] Lesson cleanup failed:', e); }
      }
    }
  }, [state.selectedLesson, buildQuietContext, progress]);

  return {
    state,
    hubOpen,
    hubVisible,
    stepPhase,
    progress: progress.data,
    openHub,
    closeHub,
    selectDomain,
    selectLesson,
    goBack,
    goToDomains,
    startLiveDemo,
    exitLiveDemo,
    goToStep,
    nextStep,
    toggleAutoPlay,
    restartDemo,
    confirmLessonComplete,
    resetLesson,
    resetProgress,
    setLastCategory: progress.setLastCategory,
    skipReading: useCallback(() => { skipReadingRef.current?.(); }, []),
    suppressLiveTabExitRef,
  };
}

export {
  abortableSleep,
  findLessonById,
  firstVisible,
  isElementVisible,
  restoreStateFromProgress,
  scaleQuietDelay,
  showClickRipple,
  waitForElement,
} from './useDemoHubHelpers';
