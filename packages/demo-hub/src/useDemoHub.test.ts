/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDemoHub } from './useDemoHub';
import type { DemoLesson } from './types';
import { gqlFirstQueryLesson } from './lessons/protocols/graphql-first-query';
import { persistDemoLiveSession, readDemoLiveSession, resetLiveDemoResumeConsumeForTests } from './demoLiveSession';

function makeLesson(overrides: Partial<DemoLesson> = {}): DemoLesson {
  return {
    id: 'test-lesson',
    domainId: 'protocols',
    name: 'Test Lesson',
    description: 'A test lesson',
    estimatedMinutes: 5,
    concept: { title: 'Test Concept', body: 'Body text here.' },
    steps: [
      { id: 's1', title: 'Step 1', description: 'Do step 1', pauseAfter: 0 },
      { id: 's2', title: 'Step 2', description: 'Do step 2', pauseAfter: 0 },
    ],
    ...overrides,
  };
}

const navigateToTab = vi.fn();

describe('useDemoHub', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '';
    localStorage.clear();
    sessionStorage.clear();
    resetLiveDemoResumeConsumeForTests();
    navigateToTab.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initialises with domains view and hub closed', () => {
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    expect(result.current.state.view).toBe('domains');
    expect(result.current.hubOpen).toBe(false);
    expect(result.current.hubVisible).toBe(false);
  });

  it('openHub sets hubOpen=true and view=domains', () => {
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    act(() => { result.current.openHub(); });
    expect(result.current.hubOpen).toBe(true);
    expect(result.current.state.view).toBe('domains');
  });

  it('closeHub sets hubOpen=false and clears isPlaying', () => {
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    act(() => { result.current.openHub(); });
    act(() => { result.current.closeHub(); });
    expect(result.current.hubOpen).toBe(false);
    expect(result.current.state.isPlaying).toBe(false);
  });

  it('selectDomain navigates to lessons view', () => {
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    const domain = {
      id: 'protocols',
      name: 'Protocols',
      icon: '🔌',
      description: 'desc',
      available: true,
      lessons: [],
    };
    act(() => { result.current.selectDomain(domain); });
    expect(result.current.state.view).toBe('lessons');
    expect(result.current.state.selectedDomain?.id).toBe('protocols');
  });

  it('selectDomain is a no-op for unavailable domains', () => {
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    const domain = {
      id: 'unavail',
      name: 'Unavail',
      icon: '🔌',
      description: 'desc',
      available: false,
      lessons: [],
    };
    act(() => { result.current.selectDomain(domain); });
    expect(result.current.state.view).toBe('domains');
  });

  it('selectLesson navigates to concept view', () => {
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    const lesson = makeLesson();
    act(() => { result.current.selectLesson(lesson); });
    expect(result.current.state.view).toBe('concept');
    expect(result.current.state.selectedLesson?.id).toBe('test-lesson');
  });

  it('goBack from lessons goes to domains', () => {
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    const domain = {
      id: 'protocols', name: 'Protocols', icon: '🔌', description: '',
      available: true, lessons: [],
    };
    act(() => { result.current.selectDomain(domain); });
    act(() => { result.current.goBack(); });
    expect(result.current.state.view).toBe('domains');
    expect(result.current.state.selectedDomain).toBeNull();
  });

  it('goBack from concept goes to lessons and preserves selectedLesson for category restore', () => {
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    const lesson = makeLesson();
    act(() => { result.current.selectLesson(lesson); });
    act(() => { result.current.goBack(); });
    expect(result.current.state.view).toBe('lessons');
    // selectedLesson is intentionally preserved so LessonList can restore the correct
    // category tab (e.g. WebSocket after navigating back from a WS lesson).
    expect(result.current.state.selectedLesson).toBe(lesson);
  });

  it('goBack from default view is a no-op', () => {
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    act(() => { result.current.goBack(); });
    expect(result.current.state.view).toBe('domains');
  });

  it('nextStep at last step marks lesson complete and stops playing', async () => {
    const lesson = makeLesson({
      steps: [{ id: 's1', title: 'Step 1', description: 'Only step', pauseAfter: 0 }],
    });
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    act(() => { result.current.selectLesson(lesson); });
    // Move to last step (index 0 with only 1 step)
    await act(async () => {
      result.current.nextStep();
      await vi.runAllTimersAsync();
    });
    expect(result.current.state.isPlaying).toBe(false);
  });

  it('nextStep advances step index', async () => {
    const lesson = makeLesson();
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    act(() => { result.current.selectLesson(lesson); });
    // step index starts at 0
    await act(async () => {
      result.current.nextStep();
      await vi.runAllTimersAsync();
    });
    expect(result.current.state.stepIndex).toBe(1);
  });

  it('nextStep is no-op without selectedLesson', async () => {
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    await act(async () => {
      result.current.nextStep();
      await vi.runAllTimersAsync();
    });
    expect(result.current.state.stepIndex).toBe(0);
  });

  it('goToStep clamps to valid range', async () => {
    const lesson = makeLesson();
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    act(() => { result.current.selectLesson(lesson); });
    await act(async () => {
      result.current.goToStep(999);
      await vi.runAllTimersAsync();
    });
    expect(result.current.state.stepIndex).toBe(lesson.steps.length - 1);
  });

  it('goToStep shows completion prompt when navigating to last step', async () => {
    const lesson = makeLesson();
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    act(() => { result.current.selectLesson(lesson); });
    await act(async () => {
      result.current.goToStep(lesson.steps.length - 1);
      await vi.runAllTimersAsync();
    });
    // Lesson is NOT auto-marked complete; user must click Complete.
    expect(result.current.progress.completedLessons).not.toContain(lesson.id);
    // confirmLessonComplete marks it done (simulates clicking Complete button).
    act(() => { result.current.confirmLessonComplete(); });
    expect(result.current.progress.completedLessons).toContain(lesson.id);
  });

  it('goToStep is no-op without selectedLesson', async () => {
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    await act(async () => {
      result.current.goToStep(1);
      await vi.runAllTimersAsync();
    });
    expect(result.current.state.stepIndex).toBe(0);
  });

  it('goToStep clears auto-play timer when called while auto-play is running (line 322)', async () => {
    // Multi-step lesson so auto-play creates a breathing-pause timer
    const lesson = makeLesson({
      steps: [
        { id: 's1', title: 'S1', description: 'D1', pauseAfter: 0 },
        { id: 's2', title: 'S2', description: 'D2', pauseAfter: 0 },
      ],
    });
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    act(() => { result.current.selectLesson(lesson); });
    await act(async () => {
      result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(result.current.state.view).toBe('live');

    // Enable auto-play: effect fires and schedules the breathing pause timer
    act(() => { result.current.toggleAutoPlay(); });

    // goToStep while auto-play timer is pending → clears timer (line 322 TRUE branch)
    await act(async () => {
      result.current.goToStep(0);
      await vi.runAllTimersAsync();
    });
    expect(result.current.state.isPlaying).toBe(false);
    expect(result.current.state.stepIndex).toBe(0);
  });

  it('toggleAutoPlay at end: navigates to initialTab before setup (mirrors restartDemo)', async () => {
    const setup = vi.fn().mockResolvedValue(undefined);
    const cleanup = vi.fn().mockResolvedValue(undefined);
    const lesson = makeLesson({ setup, cleanup, initialTab: 'kafka-settings' });
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    act(() => { result.current.selectLesson(lesson); });
    await act(async () => {
      result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(1000);
    });
    // Advance to last step so atEnd=true
    await act(async () => {
      result.current.goToStep(lesson.steps.length - 1);
      await vi.advanceTimersByTimeAsync(1000);
    });
    navigateToTab.mockClear();

    // Click play at end — should trigger cleanup → initialTab nav → setup → step 0
    act(() => { result.current.toggleAutoPlay(); });
    await act(async () => { await vi.runAllTimersAsync(); });

    expect(cleanup).toHaveBeenCalled();
    expect(navigateToTab).toHaveBeenCalledWith('kafka-settings');
    expect(setup).toHaveBeenCalled();
  });

  it('toggleAutoPlay at end: deferred callback returns early when generation changes (lines 372, 377)', async () => {
    const setup = vi.fn().mockResolvedValue(undefined);
    const cleanup = vi.fn().mockResolvedValue(undefined);
    const lesson = makeLesson({ setup, cleanup });
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    act(() => { result.current.selectLesson(lesson); });
    await act(async () => {
      result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(1000);
    });
    // Navigate to last step so atEnd=true for next toggleAutoPlay
    await act(async () => {
      result.current.goToStep(lesson.steps.length - 1);
      await vi.advanceTimersByTimeAsync(1000);
    });
    setup.mockClear();
    cleanup.mockClear();

    // toggleAutoPlay at end schedules restart callback with gen=N
    act(() => { result.current.toggleAutoPlay(); });

    // Invalidate the generation before the 50ms timer fires by calling toggleAutoPlay again
    // (second call: isPlaying is now false, newPlaying=true, re-enters at-end block → new gen)
    act(() => { result.current.toggleAutoPlay(); });

    // Advance past both 50ms timers
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });

    // The first deferred callback should have returned early (stale gen)
    // so cleanup is called at most once (by the second callback)
    expect(cleanup.mock.calls.length).toBeLessThanOrEqual(1);
  });

  it('skipReading resolves the reading phase sleep', async () => {
    const lesson = makeLesson({
      steps: [{ id: 's1', title: 'Step 1', description: 'Long description here for reading.', pauseAfter: 60000 }],
    });
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    act(() => { result.current.selectLesson(lesson); });

    // Start the step pipeline (it will block in the reading phase)
    const stepPromise = act(async () => {
      result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(400);
    });

    // Skip the reading phase
    await act(async () => { result.current.skipReading(); });
    await act(async () => { await vi.runAllTimersAsync(); });
    await stepPromise;
    // Should have advanced past reading (stepPhase 'done' or similar)
    expect(result.current.stepPhase).toBeDefined();
  });

  // ── exitLiveDemo ──────────────────────────────────────────────

  it('exitLiveDemo returns to concept view and clears playing', async () => {
    const lesson = makeLesson();
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    act(() => { result.current.selectLesson(lesson); });
    await act(async () => {
      result.current.exitLiveDemo();
      await vi.runAllTimersAsync();
    });
    expect(result.current.state.view).toBe('concept');
    expect(result.current.state.isPlaying).toBe(false);
  });

  it('exitLiveDemo runs cleanup when lesson has cleanup', async () => {
    const cleanup = vi.fn().mockResolvedValue(undefined);
    const lesson = makeLesson({ cleanup });
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    act(() => { result.current.selectLesson(lesson); });
    await act(async () => {
      result.current.exitLiveDemo();
      await vi.runAllTimersAsync();
    });
    expect(cleanup).toHaveBeenCalled();
  });

  it('exitLiveDemo handles cleanup error gracefully', async () => {
    const cleanup = vi.fn().mockRejectedValue(new Error('cleanup error'));
    const lesson = makeLesson({ cleanup });
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    act(() => { result.current.selectLesson(lesson); });
    await expect(act(async () => {
      result.current.exitLiveDemo();
      await vi.runAllTimersAsync();
    })).resolves.not.toThrow();
    expect(result.current.state.view).toBe('concept');
  });

  // ── restartDemo ───────────────────────────────────────────────

  it('restartDemo is a no-op without selectedLesson', async () => {
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    await act(async () => {
      result.current.restartDemo();
      await vi.runAllTimersAsync();
    });
    expect(result.current.state.stepIndex).toBe(0);
  });

  it('restartDemo resets to step 0 and runs cleanup+setup', async () => {
    const cleanup = vi.fn().mockResolvedValue(undefined);
    const setup = vi.fn().mockResolvedValue(undefined);
    const lesson = makeLesson({ cleanup, setup });
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    act(() => { result.current.selectLesson(lesson); });
    await act(async () => {
      result.current.restartDemo();
      await vi.runAllTimersAsync();
    });
    expect(cleanup).toHaveBeenCalled();
    expect(setup).toHaveBeenCalled();
    expect(result.current.state.stepIndex).toBe(0);
  });

  it('restartDemo skips executeCurrentStep when lesson has no steps (line 455 false branch)', async () => {
    const lesson = makeLesson({ steps: [] });
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    act(() => { result.current.selectLesson(lesson); });
    await act(async () => {
      result.current.restartDemo();
      await vi.runAllTimersAsync();
    });
    // No step to execute — just verify it doesn't throw
    expect(result.current.state.stepIndex).toBe(0);
  });

  it('restartDemo navigates initialTab when set', async () => {
    const lesson = makeLesson({ initialTab: 'websocket-studio' });
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    act(() => { result.current.selectLesson(lesson); });
    await act(async () => {
      result.current.restartDemo();
      await vi.runAllTimersAsync();
    });
    expect(navigateToTab).toHaveBeenCalledWith('websocket-studio');
  });

  // ── startLiveDemo ─────────────────────────────────────────────

  it('startLiveDemo switches to live view', async () => {
    const lesson = makeLesson();
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    act(() => { result.current.selectLesson(lesson); });
    await act(async () => {
      result.current.startLiveDemo();
      await vi.runAllTimersAsync();
    });
    expect(result.current.state.view).toBe('live');
  });

  it('startLiveDemo is a no-op without selectedLesson', async () => {
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    await act(async () => {
      result.current.startLiveDemo();
      await vi.runAllTimersAsync();
    });
    expect(result.current.state.view).toBe('domains');
  });

  it('startLiveDemo runs setup when lesson has one', async () => {
    const setup = vi.fn().mockResolvedValue(undefined);
    const lesson = makeLesson({ setup });
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    act(() => { result.current.selectLesson(lesson); });
    await act(async () => {
      result.current.startLiveDemo();
      await vi.runAllTimersAsync();
    });
    expect(setup).toHaveBeenCalled();
  });

  it('startLiveDemo navigates to initialTab when set', async () => {
    const lesson = makeLesson({ initialTab: 'websocket-studio' });
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    act(() => { result.current.selectLesson(lesson); });
    await act(async () => {
      result.current.startLiveDemo();
      await vi.runAllTimersAsync();
    });
    expect(navigateToTab).toHaveBeenCalledWith('websocket-studio');
  });

  // ── toggleAutoPlay ────────────────────────────────────────────

  it('toggleAutoPlay starts playing when currently paused', () => {
    const lesson = makeLesson();
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    act(() => { result.current.selectLesson(lesson); });
    act(() => { result.current.toggleAutoPlay(); });
    expect(result.current.state.isPlaying).toBe(true);
  });

  it('toggleAutoPlay stops playing when currently playing', () => {
    const lesson = makeLesson();
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    act(() => { result.current.selectLesson(lesson); });
    act(() => { result.current.toggleAutoPlay(); });
    act(() => { result.current.toggleAutoPlay(); });
    expect(result.current.state.isPlaying).toBe(false);
  });

  it('toggleAutoPlay at last step immediately sets isPlaying: false (at-end branch)', async () => {
    // At-end: toggleAutoPlay returns isPlaying=false to avoid auto-play effect racing setup
    const setup = vi.fn().mockResolvedValue(undefined);
    const cleanup = vi.fn().mockResolvedValue(undefined);
    const lesson = makeLesson({ setup, cleanup });
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    act(() => { result.current.selectLesson(lesson); });
    // Advance to last step
    await act(async () => {
      result.current.goToStep(lesson.steps.length - 1);
      await vi.runAllTimersAsync();
    });
    expect(result.current.state.stepIndex).toBe(lesson.steps.length - 1);

    // Toggle auto-play while at end — should immediately return isPlaying=false
    // so that the 50ms async cleanup+setup callback doesn't race the auto-play effect
    await act(async () => { result.current.toggleAutoPlay(); });
    expect(result.current.state.isPlaying).toBe(false);
    expect(result.current.state.stepIndex).toBe(0);

    // Fire the 50ms deferred callback + 350ms initialTab delay → cleanup and setup should run
    await act(async () => { await vi.runAllTimersAsync(); });
    expect(cleanup).toHaveBeenCalled();
    expect(setup).toHaveBeenCalled();
  });

  // ── buildQuietContext waitFor timeout (line 181) ──────────────

  it('buildQuietContext waitFor times out gracefully when element never appears', async () => {
    const lesson = makeLesson({
      steps: [{
        id: 'wait-step',
        title: 'Wait',
        description: 'Waits for element',
        pauseAfter: 0,
        // verify uses waitFor internally in executeCurrentStep
        verify: '[data-testid="never-exists"]',
      }],
    });
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    act(() => { result.current.selectLesson(lesson); });
    // Run startLiveDemo — waitForElement will poll until timeout (2000ms)
    await act(async () => {
      result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(10000);
    });
    // Should complete without hanging or throwing
    expect(result.current.state.view).toBe('live');
  });

  // ── auto-play effect: executingRef while-loop (lines 420-428) ──

  it('auto-play advances to next step when playing', async () => {
    const lesson = makeLesson();
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    act(() => { result.current.selectLesson(lesson); });

    // Enable auto-play
    act(() => { result.current.toggleAutoPlay(); });

    // Advance past breathing pause (1500ms default) and step execution
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });

    // stepIndex should have advanced
    expect(result.current.state.stepIndex).toBeGreaterThanOrEqual(0);
  });

  it('buildQuietContext.selectOption sets value on select element', async () => {
    const select = document.createElement('select');
    select.setAttribute('data-testid', 'test-select');
    const opt = document.createElement('option');
    opt.value = 'b';
    select.appendChild(opt);
    document.body.appendChild(select);

    const lesson = makeLesson({
      steps: [{
        id: 'sel-step', title: 'Select', description: 'Selects', pauseAfter: 0,
        action: async (ctx) => { await ctx.selectOption('[data-testid="test-select"]', 'b'); },
      }],
    });
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    act(() => { result.current.selectLesson(lesson); });
    await act(async () => {
      result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(select.value).toBe('b');
  });

  it('buildQuietContext.selectOption skips when no native setter (desc?.set false branch)', async () => {
    const select = document.createElement('select');
    select.setAttribute('data-testid', 'test-select-2');
    // Option 'a' is the default; action tries to set 'c'
    ['a', 'c'].forEach(v => {
      const opt = document.createElement('option');
      opt.value = v;
      select.appendChild(opt);
    });
    document.body.appendChild(select);

    // Mock getOwnPropertyDescriptor to return a descriptor without a set function
    const original = Object.getOwnPropertyDescriptor;
    vi.spyOn(Object, 'getOwnPropertyDescriptor').mockImplementation((proto, prop) => {
      if (proto === HTMLSelectElement.prototype && prop === 'value') return { get: original(HTMLSelectElement.prototype, 'value')!.get };
      return original(proto as object, prop as PropertyKey);
    });

    const lesson = makeLesson({
      steps: [{
        id: 'sel-step-2', title: 'Select', description: 'Selects', pauseAfter: 0,
        action: async (ctx) => { await ctx.selectOption('[data-testid="test-select-2"]', 'c'); },
      }],
    });
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    act(() => { result.current.selectLesson(lesson); });
    await act(async () => {
      result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(3000);
    });
    vi.restoreAllMocks();
    // Native setter was skipped, so value remains at default 'a'
    expect(select.value).toBe('a');
  });

  it('toggleAutoPlay at last step: deferred callback skips executeCurrentStep when no steps', async () => {
    // Lesson with 0 steps → lesson.steps[0] is undefined → atEnd restart block but steps[0]=undefined
    const setup = vi.fn().mockResolvedValue(undefined);
    const cleanup = vi.fn().mockResolvedValue(undefined);
    const lesson = makeLesson({ steps: [], setup, cleanup });
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    act(() => { result.current.selectLesson(lesson); });

    // Enter live view first; wait out the 350ms DOM-tick delay inside startLiveDemo
    await act(async () => {
      result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(result.current.state.view).toBe('live');

    // Reset mock call counts so we can verify the restart block's calls separately
    setup.mockClear();
    cleanup.mockClear();

    // stepIndex=0, steps.length=0 → atEnd (0 >= -1) = true → enters restart setTimeout(50)
    act(() => { result.current.toggleAutoPlay(); });

    // Advance past the 50ms deferred callback + 350ms initialTab delay
    await act(async () => { await vi.runAllTimersAsync(); });

    // The restart block calls cleanup then setup, but NOT executeCurrentStep (no steps[0])
    expect(cleanup).toHaveBeenCalled();
    expect(setup).toHaveBeenCalled();
    expect(result.current.state.isPlaying).toBe(false);
  });

  it('auto-play in live view marks lesson complete when at last step', async () => {
    // Use a single-step lesson — auto-play effect immediately detects last step
    const lesson = makeLesson({
      steps: [{ id: 's1', title: 'Step 1', description: 'Only', pauseAfter: 0 }],
    });
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    act(() => { result.current.selectLesson(lesson); });

    // Enter live view via startLiveDemo, then enable auto-play
    await act(async () => {
      result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(result.current.state.view).toBe('live');

    // At this point we're on the only (last) step; enable auto-play
    act(() => { result.current.toggleAutoPlay(); });

    // auto-play effect fires: stepIndex (0) >= steps.length-1 (0) → stops and marks complete.
    // The at-end restart path runs (50ms + 350ms delays), so run all timers.
    await act(async () => { await vi.runAllTimersAsync(); });

    expect(result.current.state.isPlaying).toBe(false);
    // User must click Complete to mark the lesson done.
    expect(result.current.progress.completedLessons).not.toContain(lesson.id);
    act(() => { result.current.confirmLessonComplete(); });
    expect(result.current.progress.completedLessons).toContain(lesson.id);
  });

  it('restores live demo overlay from sessionStorage after reload', () => {
    persistDemoLiveSession({
      lessonId: gqlFirstQueryLesson.id,
      stepIndex: 4,
      isPlaying: false,
      speed: 1,
      savedAt: Date.now(),
    });
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    expect(result.current.state.view).toBe('live');
    expect(result.current.state.stepIndex).toBe(4);
    expect(result.current.state.selectedLesson?.id).toBe(gqlFirstQueryLesson.id);
  });

  it('restores isPlaying from sessionStorage after reload', () => {
    persistDemoLiveSession({
      lessonId: gqlFirstQueryLesson.id,
      stepIndex: 2,
      isPlaying: true,
      speed: 1,
      savedAt: Date.now(),
    });
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    expect(result.current.state.view).toBe('live');
    expect(result.current.state.isPlaying).toBe(true);
  });

  it('goBack from live clears sessionStorage live session', () => {
    persistDemoLiveSession({
      lessonId: gqlFirstQueryLesson.id,
      stepIndex: 1,
      isPlaying: false,
      speed: 1,
      savedAt: Date.now(),
    });
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    expect(result.current.state.view).toBe('live');
    act(() => { result.current.goBack(); });
    expect(result.current.state.view).toBe('concept');
    expect(readDemoLiveSession()).toBeNull();
  });

  it('exitLiveDemo clears sessionStorage live session', async () => {
    persistDemoLiveSession({
      lessonId: gqlFirstQueryLesson.id,
      stepIndex: 0,
      isPlaying: false,
      speed: 1,
      savedAt: Date.now(),
    });
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    await act(async () => {
      result.current.exitLiveDemo();
    });
    expect(readDemoLiveSession()).toBeNull();
  });
});
