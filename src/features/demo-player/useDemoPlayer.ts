/** Demo Player — React hook for state management */
import { useState, useCallback, useRef, useEffect } from 'react';
import type { DemoSuite, DemoPlayerState, DemoActionContext } from './types-v1';

const STORAGE_KEY = 'redfire-demo-player-v1';

function loadPersistedState(): { lastSuiteId?: string; playSpeed?: number } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function persistState(state: { lastSuiteId?: string; playSpeed?: number }) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* noop */ }
}

export function useDemoPlayer(navigateToTab: (tab: string) => void) {
  const persisted = loadPersistedState();

  const [state, setState] = useState<DemoPlayerState>({
    suite: null,
    stepIndex: 0,
    isOpen: false,
    isPlaying: false,
    playSpeed: persisted.playSpeed ?? 3,
  });

  const autoPlayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // Clear auto-play on unmount
  useEffect(() => {
    return () => { if (autoPlayRef.current) clearTimeout(autoPlayRef.current); };
  }, []);

  // Build action context for step execution
  const buildContext = useCallback((): DemoActionContext => ({
    navigateToTab,
    click: async (selector: string) => {
      const el = document.querySelector(selector);
      if (el instanceof HTMLElement) el.click();
    },
    fill: async (selector: string, value: string) => {
      const el = document.querySelector(selector);
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        const nativeSet = Object.getOwnPropertyDescriptor(
          el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
          'value',
        )?.set;
        nativeSet?.call(el, value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    },
    selectOption: async (selector: string, value: string) => {
      const el = document.querySelector(selector) as HTMLSelectElement | null;
      if (el) {
        el.value = value;
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

  const executeStep = useCallback(async (suite: DemoSuite, index: number) => {
    const step = suite.steps[index];
    if (!step) return;
    const ctx = buildContext();

    if (step.action) {
      try { await step.action(ctx); } catch (e) { console.warn('[DemoPlayer] Step action failed:', e); }
    }

    // Scroll highlighted element into view
    if (step.highlight) {
      await ctx.delay(200);
      const el = document.querySelector(step.highlight);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [buildContext]);

  const startSuite = useCallback(async (suite: DemoSuite) => {
    if (autoPlayRef.current) clearTimeout(autoPlayRef.current);

    // Navigate to initial tab if specified
    if (suite.initialTab) navigateToTab(suite.initialTab);

    setState(prev => ({
      ...prev,
      suite,
      stepIndex: 0,
      isOpen: true,
      isPlaying: false,
    }));

    persistState({ lastSuiteId: suite.id, playSpeed: state.playSpeed });
    await new Promise(r => setTimeout(r, 300)); // let navigation settle
    await executeStep(suite, 0);
  }, [navigateToTab, state.playSpeed, executeStep]);

  const goToStep = useCallback(async (index: number) => {
    if (!state.suite) return;
    const clamped = Math.max(0, Math.min(index, state.suite.steps.length - 1));
    setState(prev => ({ ...prev, stepIndex: clamped, isPlaying: false }));
    if (autoPlayRef.current) clearTimeout(autoPlayRef.current);
    await executeStep(state.suite, clamped);
  }, [state.suite, executeStep]);

  const next = useCallback(() => {
    if (!state.suite || state.stepIndex >= state.suite.steps.length - 1) return;
    goToStep(state.stepIndex + 1);
  }, [state.suite, state.stepIndex, goToStep]);

  const prev = useCallback(() => {
    if (!state.suite || state.stepIndex <= 0) return;
    goToStep(state.stepIndex - 1);
  }, [state.suite, state.stepIndex, goToStep]);

  const toggleAutoPlay = useCallback(() => {
    setState(prev => {
      const newPlaying = !prev.isPlaying;
      if (!newPlaying && autoPlayRef.current) {
        clearTimeout(autoPlayRef.current);
        autoPlayRef.current = null;
      }
      return { ...prev, isPlaying: newPlaying };
    });
  }, []);

  // Auto-play effect
  useEffect(() => {
    if (!state.isPlaying || !state.suite) return;
    if (state.stepIndex >= state.suite.steps.length - 1) {
      setState(prev => ({ ...prev, isPlaying: false }));
      return;
    }

    const step = state.suite.steps[state.stepIndex];
    const delay = (step.pauseAfter ?? state.playSpeed * 1000);

    autoPlayRef.current = setTimeout(async () => {
      if (!isMountedRef.current) return;
      const nextIdx = state.stepIndex + 1;
      setState(prev => ({ ...prev, stepIndex: nextIdx }));
      await executeStep(state.suite!, nextIdx);
    }, delay);

    return () => { if (autoPlayRef.current) clearTimeout(autoPlayRef.current); };
  }, [state.isPlaying, state.stepIndex, state.suite, state.playSpeed, executeStep]);

  const setPlaySpeed = useCallback((speed: number) => {
    setState(prev => ({ ...prev, playSpeed: speed }));
    persistState({ lastSuiteId: state.suite?.id, playSpeed: speed });
  }, [state.suite]);

  const close = useCallback(() => {
    if (autoPlayRef.current) clearTimeout(autoPlayRef.current);
    setState(prev => ({ ...prev, isOpen: false, isPlaying: false, suite: null }));
  }, []);

  return {
    state,
    startSuite,
    goToStep,
    next,
    prev,
    toggleAutoPlay,
    setPlaySpeed,
    close,
  };
}
