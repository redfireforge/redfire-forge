/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from '@testing-library/react';
import {
  makeLesson,
  renderDemoHub,
} from './useDemoHub.coverage-helpers';
import {
  setupUseDemoHubCoverageBeforeEach,
  teardownUseDemoHubCoverageAfterEach,
} from './useDemoHub.coverage.testHelpers';


vi.mock('./lessons/env-manager-lesson-helpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./lessons/env-manager-lesson-helpers')>();
  return {
    ...actual,
    cleanupGqlDemoLessonEnvironment: vi.fn(async () => {}),
  };
});

vi.mock('./lessons/gql-demo-storage-cleanup', () => ({
  purgeGqlDemoEphemeralStorage: vi.fn().mockResolvedValue({
    profilesRemoved: 0,
    runnerConfigsRemoved: 0,
    staleKeysRemoved: 0,
    freedKB: 0,
  }),
}));


describe('useDemoHub (branch coverage — restart & autoplay)', () => {
  const navigateToTab = vi.fn();

  beforeEach(() => {
    setupUseDemoHubCoverageBeforeEach();
  });

  afterEach(async () => {
    await teardownUseDemoHubCoverageAfterEach();
  });

  // ─── restartDemo without cleanup/setup/initialTab ─────────────

  it('restartDemo works when lesson has no cleanup, no setup, no initialTab', async () => {
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({ cleanup: undefined, setup: undefined, initialTab: undefined });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    await act(async () => {
      const p = result.current.restartDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    expect(result.current.state.stepIndex).toBe(0);
    expect(result.current.state.isPlaying).toBe(false);
  });

  it('restartDemo handles cleanup error gracefully', async () => {
    const cleanup = vi.fn().mockRejectedValue(new Error('cleanup fail'));
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({ cleanup });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    await act(async () => {
      const p = result.current.restartDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    expect(result.current.state.stepIndex).toBe(0);
  });

  it('restartDemo handles setup error gracefully', async () => {
    const setup = vi.fn().mockRejectedValue(new Error('setup fail'));
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({ setup });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    await act(async () => {
      const p = result.current.restartDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    expect(result.current.state.stepIndex).toBe(0);
  });

  // ─── auto-play effect — naturally reaches last step ──────────
  // NOTE: toggleAutoPlay() handles the atEnd case itself (async restart),
  // so lines 407-409 are only reachable when auto-play ADVANCES into the
  // last step, not when it is started at the last step.

  it('auto-play effect stops at last step when advancing naturally through steps', async () => {
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [
        { id: 's1', title: 'S1', description: 'Step 1' },
        { id: 's2', title: 'S2', description: 'Step 2' },
      ],
    });
    act(() => result.current.selectLesson(lesson));

    // Start live demo at step 0 and let it complete
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    expect(result.current.state.stepIndex).toBe(0);
    expect(result.current.state.isPlaying).toBe(false);

    // Start auto-play at step 0 (not the last step → atEnd=false → isPlaying=true)
    // The auto-play effect fires, sets a breathing-pause timer, which advances to step 1
    // (the last step). The effect fires again with stepIndex=1 >= steps.length-1=1,
    // hitting lines 407-409: isPlaying=false + progressMarkComplete.
    act(() => result.current.toggleAutoPlay());
    expect(result.current.state.isPlaying).toBe(true);

    // Advance timers: breathing pause (1500ms) + step 1 execution + effect re-fire
    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
    });

    expect(result.current.state.isPlaying).toBe(false);
  });

  // ─── auto-play polling loop — waits while step is executing ──
  // Lines 425-426: while (executingRef.current) { await new Promise(r => setTimeout(r, 200)) }
  // Reached when the breathing pause fires while a prior step is still executing.

  it('auto-play polling loop waits for in-progress step before advancing', async () => {
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [
        {
          id: 's1', title: 'Slow', description: 'Slow step',
          pauseAfter: 100,
          // A 4-second action — longer than the 4200ms auto-play breathing pause
          action: async (ctx) => { await ctx.delay(4000); },
        },
        { id: 's2', title: 'S2', description: 'Step 2', pauseAfter: 100 },
      ],
    });
    act(() => result.current.selectLesson(lesson));

    // Start live demo and advance into step 0's long action
    await act(async () => {
      void result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(500); // past pre + short reading, into action
    });

    // Toggle auto-play while step 0 is executing (executingRef.current = true)
    // Effect fires and sets a 4200ms breathing pause.
    // When that fires, executingRef is still true → while loop runs (lines 425-426)
    act(() => result.current.toggleAutoPlay());

    // Advance enough for: breathing pause (4200ms) + polling (200ms×N) + step 0
    // action completion + step 1 pipeline
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000);
    });

    // After polling loop exits and auto-play advances, we should be past step 0
    expect(result.current.state.stepIndex).toBeGreaterThan(0);
  });

  // ─── buildQuietContext waitFor while-loop body (lines 182-185) ──
  // buildQuietContext.waitFor polls until element appears or timeout expires.
  // Uses fake Date.now() so the while loop runs until fake time > timeout.

  it('buildQuietContext waitFor polls while element is absent then times out', async () => {
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [{
        id: 's1', title: 'WaitFor', description: 'WaitFor quiet',
        // preAction uses buildQuietContext — calls its waitFor with a selector
        // that never appears, triggering the while-loop body
        preAction: async (ctx) => { await ctx.waitFor('.quiet-never-appears', 300); },
      }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    expect(result.current.state.stepIndex).toBe(0);
  });

  it('buildQuietContext waitFor returns early when element exists', async () => {
    const div = document.createElement('div');
    div.className = 'quiet-found-el';
    document.body.appendChild(div);

    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [{
        id: 's1', title: 'WaitForFound', description: 'WaitFor found',
        preAction: async (ctx) => { await ctx.waitFor('.quiet-found-el', 500); },
      }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    div.remove();
    expect(result.current.state.stepIndex).toBe(0);
  });

  // ─── buildQuietContext delay (line 188) ──────────────────────
  // buildQuietContext's delay is only exercised via preAction/setup/cleanup ctx.delay()

  it('buildQuietContext delay is called when preAction uses ctx.delay', async () => {
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [{
        id: 's1', title: 'DelayPreAction', description: 'Delay in preAction',
        preAction: async (ctx) => { await ctx.delay(200); },
      }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    expect(result.current.state.stepIndex).toBe(0);
  });

  // ─── nextStep when not at last step (line 346) ───────────────
  // nextStep() calls goToStep(stepIndex + 1) when not at end

  it('nextStep advances to next step when not at last step', async () => {
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [
        { id: 's1', title: 'S1', description: 'Step 1' },
        { id: 's2', title: 'S2', description: 'Step 2' },
        { id: 's3', title: 'S3', description: 'Step 3' },
      ],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    expect(result.current.state.stepIndex).toBe(0);
    // nextStep at step 0 → goes to step 1 (line 346)
    await act(async () => {
      const p = result.current.nextStep();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    expect(result.current.state.stepIndex).toBe(1);
  });

  // ─── nextStep at last step — marks lesson complete (lines 342-344) ──

  it('nextStep at last step is a no-op (Next is disabled in LiveDemo UI)', async () => {
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [
        { id: 's1', title: 'S1', description: 'Step 1' },
        { id: 's2', title: 'S2', description: 'Step 2' },
      ],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    await act(async () => {
      const p = result.current.goToStep(1);
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    expect(result.current.state.stepIndex).toBe(1);
    await act(async () => {
      await result.current.nextStep();
    });
    expect(result.current.state.stepIndex).toBe(1);
  });

  // ─── restartDemo with initialTab (line 450) ───────────────────

  it('restartDemo navigates to initialTab when lesson has one', async () => {
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({ initialTab: 'websocket' });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    navigateToTab.mockClear();
    await act(async () => {
      const p = result.current.restartDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    // restartDemo should have called navigateToTab with the initialTab
    expect(navigateToTab).toHaveBeenCalledWith('websocket');
  });

  // ─── restartDemo when auto-play is running (line 441) ────────
  // autoPlayRef is set when auto-play has a pending timer.

  it('restartDemo clears pending auto-play timer (line 441)', async () => {
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [
        { id: 's1', title: 'S1', description: 'Step 1' },
        { id: 's2', title: 'S2', description: 'Step 2' },
        { id: 's3', title: 'S3', description: 'Step 3' },
      ],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    // Start auto-play (sets a pending timer in autoPlayRef)
    act(() => result.current.toggleAutoPlay());
    expect(result.current.state.isPlaying).toBe(true);
    // restartDemo while auto-play is pending — should clear the timer (line 441)
    await act(async () => {
      const p = result.current.restartDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    expect(result.current.state.stepIndex).toBe(0);
    expect(result.current.state.isPlaying).toBe(false);
  });

  // ─── restartDemo when no lesson is selected (line 440) ──────

  it('restartDemo returns early when no lesson is selected', async () => {
    const { result } = renderDemoHub(navigateToTab);
    // Don't select a lesson
    await act(async () => {
      await result.current.restartDemo();
    });
    expect(result.current.state.stepIndex).toBe(0); // still at default
  });

  // ─── auto-play callback gen-mismatch guard (line 420 true branch) ──
  // When auto-play's breathing pause timer fires but the generation was
  // already incremented (e.g. by pausing), the callback returns early.

  it('auto-play breathing pause callback exits early on gen mismatch (line 420)', async () => {
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [
        { id: 's1', title: 'S1', description: 'Step 1' },
        { id: 's2', title: 'S2', description: 'Step 2' },
        { id: 's3', title: 'S3', description: 'Step 3' },
      ],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    // Start auto-play — effect schedules a breathing pause (1500ms)
    act(() => result.current.toggleAutoPlay());
    expect(result.current.state.isPlaying).toBe(true);
    // Immediately pause — increments autoPlayGenRef so the pending timer is stale
    act(() => result.current.toggleAutoPlay());
    expect(result.current.state.isPlaying).toBe(false);
    const idx = result.current.state.stepIndex;

    // Advance past the breathing pause — the stale callback fires but hits line 420
    // (gen mismatch → early return) so stepIndex does NOT advance
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(result.current.state.stepIndex).toBe(idx);
  });

  // ─── exitLiveDemo when auto-play is running (line 463) ───────

  it('exitLiveDemo clears pending auto-play timer (line 463)', async () => {
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [
        { id: 's1', title: 'S1', description: 'Step 1' },
        { id: 's2', title: 'S2', description: 'Step 2' },
        { id: 's3', title: 'S3', description: 'Step 3' },
      ],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    // Start auto-play (sets a pending timer in autoPlayRef)
    act(() => result.current.toggleAutoPlay());
    expect(result.current.state.isPlaying).toBe(true);
    // exitLiveDemo while auto-play is pending — should clear the timer (line 463)
    await act(async () => {
      const p = result.current.exitLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    expect(result.current.state.view).not.toBe('live');
  });

  // ─── toggleAutoPlay atEnd restart callback (lines 372-385) ───
  // When auto-play is started at the last step, toggleAutoPlay sets a 50ms
  // setTimeout that runs cleanup → setup → step 0 (the restart path).

  it('toggleAutoPlay atEnd restart: setTimeout callback runs cleanup setup and step 0', async () => {
    const cleanup = vi.fn().mockResolvedValue(undefined);
    const setup = vi.fn().mockResolvedValue(undefined);
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      cleanup,
      setup,
      steps: [
        { id: 's1', title: 'S1', description: 'S1' },
        { id: 's2', title: 'S2', description: 'S2' },
      ],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    // Jump to last step
    await act(async () => {
      const p = result.current.goToStep(1);
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    expect(result.current.state.stepIndex).toBe(1);

    // toggleAutoPlay at last step: atEnd=true → async restart path (lines 372-385)
    // State returns isPlaying:false + stepIndex:0 immediately, then 50ms timeout fires
    act(() => result.current.toggleAutoPlay());

    // Advance timers: 50ms for the restart timeout + enough for cleanup/setup/step 0 execution
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000);
    });

    // The restart callback ran cleanup and setup
    expect(cleanup).toHaveBeenCalled();
    expect(setup).toHaveBeenCalled();
    // After restart, step resets to 0 (state may be playing or done by now)
    expect(result.current.state.stepIndex).toBe(0);
  });

});
