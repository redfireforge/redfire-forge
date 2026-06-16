/** Demo Hub — state machine hook */
import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  DemoHubState,
  DemoDomain,
  DemoLesson,
  DemoStep,
  DemoActionContext,
  SpeedMultiplier,
  HubView,
  StepPhase,
} from './types';
import { calcReadingTime } from './types';
import { useDemoProgress } from './useDemoProgress';

const INITIAL_STATE: DemoHubState = {
  view: 'domains',
  selectedDomain: null,
  selectedLesson: null,
  stepIndex: 0,
  isPlaying: false,
  speed: 1,
};

export interface UseDemoHubOptions {
  navigateToTab: (tab: string) => void;
}

export function useDemoHub({ navigateToTab }: UseDemoHubOptions) {
  const progress = useDemoProgress();
  const [state, setState] = useState<DemoHubState>({
    ...INITIAL_STATE,
    speed: progress.data.speed,
  });
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
  }, []);

  const closeHub = useCallback(() => {
    if (autoPlayRef.current) clearTimeout(autoPlayRef.current);
    autoPlayGenRef.current++;
    abortRef.current?.abort();
    setHubOpen(false);
    setState(prev => ({ ...prev, isPlaying: false }));
  }, []);

  const selectDomain = useCallback((domain: DemoDomain) => {
    if (!domain.available) return;
    setState(prev => ({ ...prev, view: 'lessons', selectedDomain: domain }));
    progress.setLastDomain(domain.id);
  }, [progress]);

  const selectLesson = useCallback((lesson: DemoLesson) => {
    setState(prev => ({ ...prev, view: 'concept', selectedLesson: lesson, stepIndex: 0 }));
    progress.setLastLesson(lesson.id);
  }, [progress]);

  const goBack = useCallback(() => {
    setState(prev => {
      switch (prev.view) {
        case 'lessons': return { ...prev, view: 'domains' as HubView, selectedDomain: null };
        case 'concept': return { ...prev, view: 'lessons' as HubView, selectedLesson: null };
        case 'live': return { ...prev, view: 'concept' as HubView, isPlaying: false };
        default: return prev;
      }
    });
    if (autoPlayRef.current) clearTimeout(autoPlayRef.current);
  }, []);

  // ─── Action Context Builder ────────────────────────────────────
  const buildContext = useCallback((): DemoActionContext => ({
    navigateToTab,
    click: async (selector: string) => {
      const el = document.querySelector(selector);
      if (el instanceof HTMLElement) {
        // Visual ripple so user sees what was clicked
        showClickRipple(el);
        await new Promise(r => setTimeout(r, 400)); // let ripple show
        el.click();
      }
    },
    fill: async (selector: string, value: string) => {
      const el = document.querySelector(selector);
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        showClickRipple(el);
        await new Promise(r => setTimeout(r, 300));
        const proto = el instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
        const nativeSet = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        nativeSet?.call(el, value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    },
    selectOption: async (selector: string, value: string) => {
      const el = document.querySelector(selector) as HTMLSelectElement | null;
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
      const el = document.querySelector(selector);
      if (el instanceof HTMLElement) el.click();
    },
    fill: async (selector: string, value: string) => {
      const el = document.querySelector(selector);
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        const proto = el instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
        const nativeSet = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        nativeSet?.call(el, value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    },
    selectOption: async (selector: string, value: string) => {
      const el = document.querySelector(selector) as HTMLSelectElement | null;
      if (el) {
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

  // ─── Retry-based element wait ──────────────────────────────────
  const waitForElement = useCallback(async (
    selector: string,
    timeoutMs = 2000,
    signal?: AbortSignal,
  ): Promise<boolean> => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (signal?.aborted) return false;
      const el = document.querySelector(selector);
      if (el && isElementVisible(el)) return true;
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

      // Phase 2: spotlight (retry-based)
      setStepPhase('spotlight');
      if (step.highlight) {
        await waitForElement(step.highlight, 2000, signal);
        if (signal.aborted) return;
        const el = document.querySelector(step.highlight);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await abortableSleep(400, signal); // scroll settle
        if (signal.aborted) return;
      }

      // Phase 3: reading pause (auto-calculated from word count)
      // — user can click the "👀 Reading" badge to skip this wait.
      setStepPhase('reading');
      const readTime = (typeof step.pauseAfter === 'number') ? step.pauseAfter : calcReadingTime(step);
      await new Promise<void>(resolve => {
        skipReadingRef.current = resolve;
        const timer = setTimeout(resolve, scaleMs(readTime));
        signal.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true });
      });
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

  const startLiveDemo = useCallback(async () => {
    const lesson = state.selectedLesson;
    if (!lesson) return;

    // Navigate to the lesson's initial tab and wait for DOM
    if (lesson.initialTab) navigateToTab(lesson.initialTab);

    setState(prev => ({ ...prev, view: 'live', stepIndex: 0, isPlaying: false }));

    // Give React + DOM a tick to render the target tab before setup
    await new Promise(r => setTimeout(r, 350));

    // Run lesson setup (start servers, reset state, etc.) — quiet, no ripple
    if (lesson.setup) {
      const ctx = buildQuietContext();
      try { await lesson.setup(ctx); } catch (e) { console.warn('[DemoHub] Lesson setup failed:', e); }
    }

    if (isMountedRef.current && lesson.steps[0]) {
      await executeCurrentStep(lesson.steps[0], state.speed);
      progress.setLessonStep(lesson.id, 0);
    }
  }, [state.selectedLesson, state.speed, navigateToTab, buildQuietContext, executeCurrentStep, progress]);

  const goToStep = useCallback(async (index: number) => {
    const lesson = state.selectedLesson;
    if (!lesson) return;
    const clamped = Math.max(0, Math.min(index, lesson.steps.length - 1));
    if (autoPlayRef.current) clearTimeout(autoPlayRef.current);
    autoPlayGenRef.current++; // invalidate any already-running auto-play callback
    // Abort any running pipeline so it doesn't race with the new one
    abortRef.current?.abort();
    setState(prev => ({ ...prev, stepIndex: clamped, isPlaying: false }));
    await executeCurrentStep(lesson.steps[clamped], state.speed);
    progress.setLessonStep(lesson.id, clamped);
    // Mark the lesson complete when the last step is reached via manual navigation
    // (auto-play marks complete through its own effect; nextStep marks complete
    // when the user presses → again after already being on the last step)
    if (clamped >= lesson.steps.length - 1) {
      progress.markLessonComplete(lesson.id);
    }
  }, [state.selectedLesson, state.speed, executeCurrentStep, progress]);

  const nextStep = useCallback(() => {
    const lesson = state.selectedLesson;
    if (!lesson) return;
    if (state.stepIndex >= lesson.steps.length - 1) {
      // Lesson complete
      setState(prev => ({ ...prev, isPlaying: false }));
      progress.markLessonComplete(lesson.id);
      return;
    }
    goToStep(state.stepIndex + 1);
  }, [state.selectedLesson, state.stepIndex, goToStep, progress]);


  const toggleAutoPlay = useCallback(() => {
    setState(prev => {
      const newPlaying = !prev.isPlaying;
      if (!newPlaying && autoPlayRef.current) {
        clearTimeout(autoPlayRef.current);
        autoPlayRef.current = null;
        autoPlayGenRef.current++; // invalidate any already-running callback
      }
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
          if (!isMountedRef.current || autoPlayGenRef.current !== atEndGen) return;
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
  }, [buildQuietContext, executeCurrentStep, progress]);

  // Stable progress callbacks — useCallback([update]) where update is useCallback([])
  // so these never change reference across renders. Destructured here to keep
  // the auto-play effect deps stable (avoids re-firing when progress.data updates).
  const { setLessonStep: progressSetStep, markLessonComplete: progressMarkComplete } = progress;

  // Auto-play effect: step execution includes its own reading pauses,
  // so we just chain steps sequentially when playing
  useEffect(() => {
    if (!state.isPlaying || state.view !== 'live' || !state.selectedLesson) return;
    const lesson = state.selectedLesson;
    if (state.stepIndex >= lesson.steps.length - 1) {
      setState(prev => ({ ...prev, isPlaying: false }));
      progressMarkComplete(lesson.id);
      return;
    }

    // Breathing room between steps — long enough to feel like a pause
    const breathingPause = Math.round(1500 / state.speed);
    // Stamp this callback with the current generation so that if restart/exit
    // bumps the counter while this callback is already executing, the callback
    // can detect it is stale and bail out without overwriting state.
    const gen = ++autoPlayGenRef.current;

    autoPlayRef.current = setTimeout(async () => {
      if (!isMountedRef.current || autoPlayGenRef.current !== gen) return;
      // Wait for any running step pipeline to finish before advancing.
      // At slower speeds (0.5×), setup + step execution can exceed the
      // breathing pause — without this poll the demo would get permanently stuck.
      while (executingRef.current) {
        await new Promise(r => setTimeout(r, 200));
        if (!isMountedRef.current || autoPlayGenRef.current !== gen) return;
      }
      if (autoPlayGenRef.current !== gen) return;
      const nextIdx = state.stepIndex + 1;
      setState(prev => ({ ...prev, stepIndex: nextIdx }));
      await executeCurrentStep(lesson.steps[nextIdx], state.speed);
      progressSetStep(lesson.id, nextIdx);
    }, breathingPause);

    return () => { if (autoPlayRef.current) clearTimeout(autoPlayRef.current); };
  }, [state.isPlaying, state.stepIndex, state.view, state.selectedLesson, state.speed, executeCurrentStep, progressSetStep, progressMarkComplete]);

  const restartDemo = useCallback(async () => {
    const lesson = state.selectedLesson;
    if (!lesson) return;
    if (autoPlayRef.current) clearTimeout(autoPlayRef.current);
    autoPlayGenRef.current++; // invalidate any already-running auto-play callback
    abortRef.current?.abort();
    setState(prev => ({ ...prev, stepIndex: 0, isPlaying: false }));
    setStepPhase('done');
    const ctx = buildQuietContext();
    if (lesson.cleanup) {
      try { await lesson.cleanup(ctx); } catch (e) { console.warn('[DemoHub] cleanup failed:', e); }
    }
    if (lesson.initialTab) navigateToTab(lesson.initialTab);
    await new Promise(r => setTimeout(r, 350));
    if (lesson.setup) {
      try { await lesson.setup(ctx); } catch (e) { console.warn('[DemoHub] setup failed:', e); }
    }
    if (isMountedRef.current && lesson.steps[0]) {
      await executeCurrentStep(lesson.steps[0], state.speed);
      progress.setLessonStep(lesson.id, 0);
    }
  }, [state.selectedLesson, state.speed, navigateToTab, buildQuietContext, executeCurrentStep, progress]);

  // Exit live mode → run cleanup, then return to concept view
  const exitLiveDemo = useCallback(async () => {
    if (autoPlayRef.current) clearTimeout(autoPlayRef.current);
    autoPlayGenRef.current++; // invalidate any already-running auto-play callback
    abortRef.current?.abort(); // stop any running step pipeline

    // Run lesson cleanup (stop servers, disconnect, reset UI) — quiet, no ripple
    const lesson = state.selectedLesson;
    if (lesson?.cleanup) {
      const ctx = buildQuietContext();
      try { await lesson.cleanup(ctx); } catch (e) { console.warn('[DemoHub] Lesson cleanup failed:', e); }
    }

    setState(prev => ({ ...prev, view: 'concept', isPlaying: false }));
    setStepPhase('done');
  }, [state.selectedLesson, buildQuietContext]);

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
    startLiveDemo,
    exitLiveDemo,
    goToStep,
    nextStep,
    toggleAutoPlay,
    restartDemo,
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
