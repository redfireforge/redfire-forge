/** Demo Hub — state machine hook (orchestrator). */
import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  DemoHubState,
  DemoDomain,
  DemoLesson,
  HubView,
  StepPhase,
} from './types';
import { useDemoProgress } from './useDemoProgress';
import { isGraphqlStudioLesson, isGrpcStudioLesson, runGrpcStudioLessonTeardown } from './adapters';
import { GQL_MODAL_LOCK_OPEN, syncGqlModalLock } from './adapters/gqlModalLockBridge';
import {
  clearDemoLiveSession,
  persistDemoLiveSession,
} from './demoLiveSession';
import { startDemoLiveGuardHeartbeat, syncDemoLiveGuard } from './demoLiveGuard';
import {
  findLessonById,
  restoreStateFromProgress,
  runGqlStudioLessonTeardown,
} from './useDemoHubHelpers';
import { useDemoHubStudioIsolation } from './useDemoHubStudioIsolation';
import { useDemoHubStepPipeline } from './useDemoHubStepPipeline';
import { createShouldResumeLiveRef, useDemoHubLiveDemo } from './useDemoHubLiveDemo';

export interface UseDemoHubOptions {
  navigateToTab: (tab: string) => void;
}

export function useDemoHub({ navigateToTab }: UseDemoHubOptions) {
  const progress = useDemoProgress();
  const pause = useCallback((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)), []);

  const {
    openIsolatedStudioDemoTabSession,
    closeIsolatedStudioDemoTabSession,
    ensureActiveDemoTabOrCreate,
  } = useDemoHubStudioIsolation(pause);

  const shouldResumeLiveRef = useRef(createShouldResumeLiveRef());
  const [state, setState] = useState<DemoHubState>(() => restoreStateFromProgress(progress.data));
  const [hubOpen, setHubOpen] = useState(false);
  const [stepPhase, setStepPhase] = useState<StepPhase>('done');
  /** True only during start/restart/resume setup — not every mid-lesson Preparing hop. */
  const [isDemoBootstrapping, setIsDemoBootstrapping] = useState(false);

  const autoPlayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);
  const executingRef = useRef(false);
  const skipReadingRef = useRef<(() => void) | null>(null);
  const autoPlayGenRef = useRef(0);
  const suppressLiveTabExitRef = useRef(false);
  const profilesIntroducedInSessionRef = useRef(false);
  const envIntroducedInSessionRef = useRef(false);
  const isPlayingRef = useRef(false);
  const stepPhaseRef = useRef<StepPhase>(stepPhase);

  useEffect(() => {
    isPlayingRef.current = state.isPlaying;
  }, [state.isPlaying]);

  useEffect(() => {
    stepPhaseRef.current = stepPhase;
  }, [stepPhase]);

  const {
    buildQuietContext,
    buildQuietContextRef,
    syncGqlModalLockForLessonStep,
    executeCurrentStep,
    finishCurrentStepFromReading,
    clearGqlIntroSessionFlags,
    resetGqlModalSessionFlags,
  } = useDemoHubStepPipeline({
    navigateToTab,
    selectedLesson: state.selectedLesson,
    stepIndex: state.stepIndex,
    view: state.view,
    setStepPhase,
    onPreparingComplete: () => setIsDemoBootstrapping(false),
    abortRef,
    executingRef,
    skipReadingRef,
    profilesIntroducedInSessionRef,
    envIntroducedInSessionRef,
  });

  const {
    runLiveLessonCleanup,
    startLiveDemo,
    exitLiveDemo,
    goToStep,
    nextStep,
    toggleAutoPlay,
    restartDemo,
    confirmLessonComplete,
  } = useDemoHubLiveDemo({
    navigateToTab,
    pause,
    state,
    setState,
    setStepPhase,
    setIsDemoBootstrapping,
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
  });

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    const autoPlayTimerRef = autoPlayRef;
    return () => {
      if (autoPlayTimerRef.current) clearTimeout(autoPlayTimerRef.current);
    };
  }, [autoPlayRef]);

  useEffect(() => {
    if (state.view === 'live' && state.selectedLesson) {
      persistDemoLiveSession({
        lessonId: state.selectedLesson.id,
        stepIndex: state.stepIndex,
        isPlaying: state.isPlaying,
        speed: state.speed,
        savedAt: Date.now(),
      });
    } else {
      clearDemoLiveSession();
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

  useEffect(() => {
    if (state.view !== 'live' || !state.selectedLesson) {
      void syncDemoLiveGuard(false);
      return;
    }
    return startDemoLiveGuardHeartbeat(state.selectedLesson.id);
  }, [state.view, state.selectedLesson]);

  useEffect(() => {
    if (state.view !== 'live') {
      clearGqlIntroSessionFlags();
      syncGqlModalLock(GQL_MODAL_LOCK_OPEN);
    }
  }, [state.view, clearGqlIntroSessionFlags]);

  const hubVisible = hubOpen && state.view !== 'live';
  const currentLessonRef = state.selectedLesson
    ? findLessonById(state.selectedLesson.id)
    : null;
  const resolvedSelectedLesson = currentLessonRef?.lesson ?? state.selectedLesson;
  const resolvedSelectedDomain = currentLessonRef?.domain ?? state.selectedDomain;

  const openHub = useCallback(() => {
    setHubOpen(true);
    setState(prev => ({ ...prev, view: 'domains' }));
    progress.setLastView('domains');
  }, [progress]);

  const selectDomain = useCallback((domain: DemoDomain) => {
    if (!domain.available) return;
    setState(prev => ({ ...prev, view: 'lessons', selectedDomain: domain, selectedLesson: null }));
    progress.setLastDomain(domain.id);
    progress.setLastView('lessons');
  }, [progress]);

  const selectLesson = useCallback((lesson: DemoLesson) => {
    setState(prev => ({ ...prev, view: 'concept', selectedLesson: lesson, stepIndex: 0 }));
    progress.setLastLesson(lesson.id);
    progress.setLastView('concept');
  }, [progress]);

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
    } else if (lesson && isGrpcStudioLesson(lesson)) {
      void runGrpcStudioLessonTeardown(lesson, buildQuietContextRef.current());
    }
    setHubOpen(false);
    setState(prev => ({ ...prev, isPlaying: false }));
  }, [state.view, state.selectedLesson, runLiveLessonCleanup, buildQuietContextRef]);

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

  const { resetLesson, resetProgress, resetLessons } = progress;

  // Must be declared with other hooks — never inside the return object (HMR-safe).
  const skipReading = useCallback(() => {
    skipReadingRef.current?.();
  }, []);

  return {
    state: {
      ...state,
      selectedDomain: resolvedSelectedDomain,
      selectedLesson: resolvedSelectedLesson,
    },
    hubOpen,
    hubVisible,
    stepPhase,
    isDemoBootstrapping,
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
    resetLessons,
    setLastCategory: progress.setLastCategory,
    skipReading,
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
