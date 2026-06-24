/** Demo Hub — state machine hook */
import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  DemoHubState,
  DemoDomain,
  DemoLesson,
  DemoStep,
  DemoActionContext,
  DemoProgress,
  SpeedMultiplier,
  HubView,
  StepPhase,
} from './types';
import { calcReadingTime } from './types';
import { useDemoProgress } from './useDemoProgress';
import { allDomains } from './lessons/index';
import { fillControlledInput } from './lessons/setup-helpers';
import { isLessonDesktopOnlyBlocked } from './utils/lessonPlatform';
import { cleanupGqlDemoLessonEnvironment } from './lessons/env-manager-lesson-helpers';
import { isWorkflowDesignerLesson } from './utils/workflowLessonUi';
import {
  closeWorkflowConfigModal,
  expandAppSidebar,
  isGraphqlStudioLesson,
} from './adapters';

async function runGqlDemoStorageHygiene(): Promise<void> {
  try {
    const { purgeGqlDemoEphemeralStorage } = await import('./lessons/gql-demo-storage-cleanup');
    const result = await purgeGqlDemoEphemeralStorage();
    if (result.profilesRemoved > 0 || result.runnerConfigsRemoved > 0 || result.staleKeysRemoved > 0) {
      console.info(
        `[DemoHub] GQL storage hygiene: ${result.profilesRemoved} profiles, `
        + `${result.runnerConfigsRemoved} runner configs, ${result.staleKeysRemoved} stale keys `
        + `(~${result.freedKB} KB)`,
      );
    }
  } catch (e) {
    console.warn('[DemoHub] GQL storage hygiene failed:', e);
  }
}

async function closeGraphqlDemoWorkspaceQuiet(lessonId: string): Promise<void> {
  const { closeGqlDemoWorkspaceQuiet } = await import(
    './lessons/protocols/graphql-lesson-helpers/gql-demo-tab'
  );
  await closeGqlDemoWorkspaceQuiet(lessonId);
}

/** Lesson-specific cleanup + GraphQL Studio demo env / EM teardown. */
async function runGqlStudioLessonTeardown(
  lesson: DemoLesson,
  ctx: DemoActionContext,
): Promise<void> {
  try {
    if (lesson.cleanup) {
      await lesson.cleanup(ctx);
    } else {
      await closeGraphqlDemoWorkspaceQuiet(lesson.id);
    }
  } catch (e) {
    console.warn('[DemoHub] Lesson cleanup failed:', e);
  }
  if (!isGraphqlStudioLesson(lesson)) return;
  try {
    await cleanupGqlDemoLessonEnvironment(ctx);
  } catch (e) {
    console.warn('[DemoHub] GQL demo environment cleanup failed:', e);
  }
}

/** Find the first VISIBLE element matching selector — avoids clicking hidden tab panels */
function firstVisible(selector: string): HTMLElement | null {
  const all = document.querySelectorAll(selector);
  for (const el of Array.from(all)) {
    if (!(el instanceof HTMLElement)) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return el;
  }
  return null;
}

const INITIAL_STATE: DemoHubState = {
  view: 'domains',
  selectedDomain: null,
  selectedLesson: null,
  stepIndex: 0,
  isPlaying: false,
  speed: 1,
};

/**
 * Restore the hub navigation position from persisted progress.
 * Returns the view + domain/lesson the user was on before a hard refresh.
 * Never restores 'live' — that requires setup to have run.
 */
function restoreStateFromProgress(progress: DemoProgress): DemoHubState {
  const base: DemoHubState = { ...INITIAL_STATE, speed: progress.speed };
  const { lastView, lastDomain, lastLesson } = progress;

  // Restore to concept view if we have a lesson and were on concept/live
  if (lastLesson && (lastView === 'concept' || lastView === undefined)) {
    for (const domain of allDomains) {
      const lesson = domain.lessons.find(l => l.id === lastLesson);
      if (lesson && domain.available) {
        return { ...base, view: 'concept', selectedDomain: domain, selectedLesson: lesson };
      }
    }
  }

  // Restore to lessons view if we have a domain (with or without a lastLesson)
  if (lastView === 'lessons' || (lastDomain && !lastLesson)) {
    const domain = allDomains.find(d => d.id === lastDomain);
    if (domain?.available) {
      // Keep lastLesson reference so the category tab is correctly highlighted
      const lesson = lastLesson ? domain.lessons.find(l => l.id === lastLesson) ?? null : null;
      return { ...base, view: 'lessons', selectedDomain: domain, selectedLesson: lesson };
    }
  }

  return base;
}

export interface UseDemoHubOptions {
  navigateToTab: (tab: string) => void;
}

export function useDemoHub({ navigateToTab }: UseDemoHubOptions) {
  const progress = useDemoProgress();
  // Restore the last navigation position from localStorage so a hard refresh
  // returns the user to the same page they were on.
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

  /** Jump directly to the domain selector from any view — used by the
   *  "Learning Hub" breadcrumb so it always lands on the root, not the
   *  intermediate lessons list. */
  const goToDomains = useCallback(() => {
    if (autoPlayRef.current) clearTimeout(autoPlayRef.current);
    autoPlayGenRef.current++;
    abortRef.current?.abort();
    progress.setLastView('domains');
    setState(prev => ({
      ...prev,
      view: 'domains' as HubView,
      selectedDomain: null,
      isPlaying: false,
    }));
  }, [progress]);

  // ─── Lesson Completion ────────────────────────────────────────
  /** User clicked "Complete" — mark lesson done. exitLiveDemo is called separately. */
  const confirmLessonComplete = useCallback(() => {
    const lesson = state.selectedLesson;
    if (lesson) progress.markLessonComplete(lesson.id);
  }, [state.selectedLesson, progress]);

  // ─── Action Context Builder ────────────────────────────────────
  const buildContext = useCallback((): DemoActionContext => ({
    navigateToTab,
    click: async (selector: string) => {
      const el = firstVisible(selector);
      if (el) {
        // Visual ripple so user sees what was clicked
        showClickRipple(el);
        await new Promise(r => setTimeout(r, 400)); // let ripple show
        el.click();
      }
    },
    fill: async (selector: string, value: string) => {
      const el = firstVisible(selector);
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        showClickRipple(el);
        await new Promise(r => setTimeout(r, 300));
        fillControlledInput(el, value);
      }
    },
    selectOption: async (selector: string, value: string) => {
      const el = firstVisible(selector) as HTMLSelectElement | null;
      if (el) {
        showClickRipple(el);
        await new Promise(r => setTimeout(r, 300));
        const nativeSet = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
        nativeSet?.call(el, value);
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    },
    waitFor: async (selector: string, timeout = 5000) => {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        if (document.querySelector(selector)) return;
        await new Promise(r => setTimeout(r, 100));
      }
    },
    delay: (ms: number) => new Promise(r => setTimeout(r, ms)),
  }), [navigateToTab]);

  /** Build a "quiet" context without visual ripple — for preAction, setup, cleanup */
  const buildQuietContext = useCallback((): DemoActionContext => ({
    navigateToTab,
    click: async (selector: string) => {
      const el = firstVisible(selector);
      if (el) el.click();
    },
    fill: async (selector: string, value: string) => {
      const el = firstVisible(selector);
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        fillControlledInput(el, value);
      }
    },
    selectOption: async (selector: string, value: string) => {
      const el = firstVisible(selector) as HTMLSelectElement | null;
      if (el) {
        const desc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
        if (desc?.set) desc.set.call(el, value);
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    },
    waitFor: async (selector: string, timeout = 5000) => {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        if (document.querySelector(selector)) return;
        await new Promise(r => setTimeout(r, 100));
      }
    },
    delay: (ms: number) => new Promise(r => setTimeout(r, ms)),
  }), [navigateToTab]);

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
    if (autoPlayRef.current) clearTimeout(autoPlayRef.current);
    if (leavingLive) runLiveLessonCleanup(lesson);
  }, [state.view, state.selectedLesson, progress, runLiveLessonCleanup]);

  // ─── Retry-based element wait ──────────────────────────────────
  const waitForElement = useCallback(async (
    selector: string,
    timeoutMs = 2000,
    signal?: AbortSignal,
  ): Promise<boolean> => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (signal?.aborted) return false;
      // Use querySelectorAll + find-visible so we handle multi-tab DOM correctly:
      // inactive tabs are display:none — querySelector would always return the
      // first (hidden) match, causing the wait to time out even when the
      // intended tab's element is visible.
      const els = document.querySelectorAll(selector);
      const visible = Array.from(els).find(e => isElementVisible(e));
      if (visible) return true;
      await new Promise(r => setTimeout(r, 100));
    }
    return false;
  }, []);

  /** Abortable sleep — resolves early if signal fires. */
  const abortableSleep = useCallback((ms: number, signal?: AbortSignal) => {
    return new Promise<void>(resolve => {
      if (signal?.aborted) { resolve(); return; }
      const timer = setTimeout(resolve, ms);
      signal?.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true });
    });
  }, []);

  // ─── Live Demo Execution ───────────────────────────────────────
  /**
   * Step execution pipeline (human-paced):
   *   1. preAction — invisible nav/setup (instant, quiet)
   *   2. spotlight — retry-find highlight target, scroll into view
   *   3. reading  — pause for user to read narration
   *   4. action   — visible action with click ripple
   *   5. verify   — retry-wait for result selector
   *   6. done     — post-action settle pause
   */
  const executeCurrentStep = useCallback(async (step: DemoStep, speed: SpeedMultiplier) => {
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
      // Phase 1: preAction (invisible navigation)
      setStepPhase('pre');
      if (step.preAction) {
        try { await step.preAction(quietCtx); } catch (e) { console.warn('[DemoHub] preAction failed:', e); }
        await abortableSleep(200, signal); // DOM settle
        if (signal.aborted) return;
      }

      // Phase 2+3: spotlight target + reading pause run together so the
      // "Reading — click to skip" badge is visible during both waits.
      setStepPhase('reading');
      const readTime = (typeof step.pauseAfter === 'number') ? step.pauseAfter : calcReadingTime(step);

      const readingPause = new Promise<void>((resolve) => {
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
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await abortableSleep(400, signal);
      })();

      await Promise.all([readingPause, spotlightWork]);
      skipReadingRef.current = null;
      if (signal.aborted) return;

      // Phase 4: visible action (with click ripple)
      if (step.action) {
        setStepPhase('action');
        try { await step.action(visibleCtx); } catch (e) { console.warn('[DemoHub] action failed:', e); }
        // Post-action settle — lets user see the result of the click/fill
        await abortableSleep(scaleMs(800), signal);
        if (signal.aborted) return;
      }

      // Phase 5: verify (retry-wait for result)
      if (step.verify) {
        setStepPhase('verify');
        await waitForElement(step.verify, 3000, signal);
        if (signal.aborted) return;
        await abortableSleep(scaleMs(1200), signal); // absorb result
        if (signal.aborted) return;
      }

      setStepPhase('done');
    } finally {
      executingRef.current = false;
    }
  }, [buildContext, buildQuietContext, waitForElement, abortableSleep]);

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
        await abortableSleep(scaleMs(800), signal);
        if (signal.aborted) return;
      }

      if (step.verify) {
        setStepPhase('verify');
        await waitForElement(step.verify, 25000, signal);
        if (signal.aborted) return;
        await abortableSleep(scaleMs(1200), signal);
        if (signal.aborted) return;
      }

      setStepPhase('done');
    } finally {
      executingRef.current = false;
    }
  }, [buildContext, waitForElement, abortableSleep]);

  const startLiveDemo = useCallback(async () => {
    const lesson = state.selectedLesson;
    if (!lesson) return;
    if (isLessonDesktopOnlyBlocked(lesson)) return;

    // Capture the generation counter so we can detect if exit/restart fires during setup.
    const gen = autoPlayGenRef.current;

    // Navigate to the lesson's initial tab and wait for DOM
    if (lesson.initialTab) navigateToTab(lesson.initialTab);
    if (isWorkflowDesignerLesson(lesson)) {
      expandAppSidebar();
    }

    setState(prev => ({ ...prev, view: 'live', stepIndex: 0, isPlaying: false }));

    // Give React + DOM a tick to render the target tab before setup
    await new Promise(r => setTimeout(r, 350));

    // Run lesson setup (start servers, reset state, etc.) — quiet, no ripple
    if (isGraphqlStudioLesson(lesson)) {
      await runGqlDemoStorageHygiene();
    }
    if (lesson.setup) {
      const ctx = buildQuietContext();
      try { await lesson.setup(ctx); } catch (e) { console.warn('[DemoHub] Lesson setup failed:', e); }
    }

    // Guard: if exitLiveDemo / restartDemo was called during setup, bail out.
    // exitLiveDemo and restartDemo both increment autoPlayGenRef so this is
    // a safe "was exit triggered?" check even before executeCurrentStep starts.
    if (autoPlayGenRef.current !== gen) return;

    if (isMountedRef.current && lesson.steps[0]) {
      await executeCurrentStep(lesson.steps[0], state.speed);
      progress.setLessonStep(lesson.id, 0);
    }
  }, [state.selectedLesson, state.speed, navigateToTab, buildQuietContext, executeCurrentStep, progress]);

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
    setState(prev => ({ ...prev, stepIndex: clamped, isPlaying: false }));
    await executeCurrentStep(lesson.steps[clamped], state.speed);
    progress.setLessonStep(lesson.id, clamped);
    // At the last step: stop auto-play so the user can read before choosing to Complete.
    if (clamped >= lesson.steps.length - 1) {
      setState(prev => ({ ...prev, isPlaying: false }));
    }
  }, [state.selectedLesson, state.speed, executeCurrentStep, progress]);

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
            await executeCurrentStep(lesson.steps[0], currentSpeed);
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
      await executeCurrentStep(lesson.steps[nextIdx], state.speed);
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
    if (isMountedRef.current && lesson.steps[0]) {
      await executeCurrentStep(lesson.steps[0], state.speed);
      progress.setLessonStep(lesson.id, 0);
    }
  }, [state.selectedLesson, state.speed, navigateToTab, buildQuietContext, executeCurrentStep, progress]);

  // Exit live mode → immediately return to concept view, then run cleanup in background.
  // Cleanup is intentionally deferred so the concept page renders without delay —
  // the user should never see a blank body while cleanup operations complete.
  const exitLiveDemo = useCallback(async () => {
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
  };
}

// ─── Helpers ─────────────────────────────────────────────────────
function isElementVisible(el: Element): boolean {
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;
  const style = getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
}

/** Show a brief CSS ripple animation on an element so the user sees what was clicked. */
function showClickRipple(el: HTMLElement) {
  const ring = document.createElement('div');
  ring.className = 'demo-click-ripple';
  const rect = el.getBoundingClientRect();
  ring.style.top = `${rect.top + rect.height / 2}px`;
  ring.style.left = `${rect.left + rect.width / 2}px`;
  document.body.appendChild(ring);
  ring.addEventListener('animationend', () => ring.remove());
}
