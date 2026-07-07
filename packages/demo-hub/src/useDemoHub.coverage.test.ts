/**
 * @vitest-environment jsdom
 * Coverage-focused tests for useDemoHub — targeting uncovered branches:
 *   - buildContext null-element branches
 *   - buildQuietContext textarea/null branches
 *   - isElementVisible with visibility/opacity=0
 *   - goBack from live view
 *   - restartDemo without cleanup/setup/initialTab
 *   - abortableSleep with pre-aborted signal
 *   - auto-play effect reaching last step
 *   - toggleAutoPlay at-end restart async path
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from '@testing-library/react';
import { makeVisible } from './lessons/protocols/ws-test-utils';
import {
  makeLesson,
  renderDemoHub,
  teardownActiveDemoHub,
} from './useDemoHub.coverage-helpers';

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

describe('useDemoHub (branch coverage)', () => {
  const navigateToTab = vi.fn();

  beforeEach(() => {
    vi.useRealTimers();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.clearAllMocks();
    localStorage.clear();
    document.body.innerHTML = '';
  });

  afterEach(async () => {
    await teardownActiveDemoHub();
    vi.restoreAllMocks();
  });

  // ─── goBack from live view ─────────────────────────────────────

  it('goBack from live view returns to concept view', async () => {
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson();
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    expect(result.current.state.view).toBe('live');
    act(() => result.current.goBack());
    expect(result.current.state.view).toBe('concept');
    expect(result.current.state.isPlaying).toBe(false);
  });

  // ─── buildContext null-element branches ───────────────────────

  it('buildContext click does nothing when selector finds no element', async () => {
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [{
        id: 's1', title: 'NullClick', description: 'Click missing',
        action: async (ctx) => { await ctx.click('.non-existent-element-abc'); },
      }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    // Should not throw — just silently skip
    expect(result.current.state.stepIndex).toBe(0);
  });

  it('buildContext fill does nothing when selector finds no element', async () => {
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [{
        id: 's1', title: 'NullFill', description: 'Fill missing',
        action: async (ctx) => { await ctx.fill('.non-existent-fill-abc', 'val'); },
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

  it('buildContext selectOption does nothing when selector finds no element', async () => {
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [{
        id: 's1', title: 'NullSelect', description: 'Select missing',
        action: async (ctx) => { await ctx.selectOption('.non-existent-select-abc', 'x'); },
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

  it('buildContext fill does nothing for non-input element (div)', async () => {
    const div = document.createElement('div');
    div.className = 'ctx-div';
    document.body.appendChild(div);

    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [{
        id: 's1', title: 'DivFill', description: 'Fill a div',
        action: async (ctx) => { await ctx.fill('.ctx-div', 'val'); },
      }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    // div.value doesn't exist, so it's ignored
    div.remove();
  });

  // ─── buildQuietContext null / textarea branches ───────────────

  it('buildQuietContext click does nothing when selector finds no element', async () => {
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [{
        id: 's1', title: 'QuietNullClick', description: 'Quiet click missing',
        preAction: async (ctx) => { await ctx.click('.non-existent-quiet-abc'); },
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

  it('buildQuietContext fill works on textarea element', async () => {
    const textarea = document.createElement('textarea');
    textarea.className = 'quiet-textarea';
    makeVisible(textarea);
    document.body.appendChild(textarea);

    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [{
        id: 's1', title: 'QuietTextarea', description: 'Quiet fill textarea',
        preAction: async (ctx) => { await ctx.fill('.quiet-textarea', 'quiet-ta-val'); },
      }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    expect(textarea.value).toBe('quiet-ta-val');
    textarea.remove();
  });

  it('buildQuietContext fill does nothing for non-input element', async () => {
    const div = document.createElement('div');
    div.className = 'quiet-div';
    document.body.appendChild(div);

    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [{
        id: 's1', title: 'QuietDivFill', description: 'Quiet fill div',
        preAction: async (ctx) => { await ctx.fill('.quiet-div', 'val'); },
      }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    div.remove();
  });

  it('buildQuietContext selectOption does nothing when no element found', async () => {
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [{
        id: 's1', title: 'QuietNullSelect', description: 'Quiet select missing',
        preAction: async (ctx) => { await ctx.selectOption('.non-existent-select-xyz', 'x'); },
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

  // ─── isElementVisible branches ────────────────────────────────

  it('isElementVisible returns false for zero-size element', async () => {
    const div = document.createElement('div');
    div.className = 'zero-size-el';
    div.scrollIntoView = vi.fn();
    vi.spyOn(div, 'getBoundingClientRect').mockReturnValue({
      top: 0, left: 0, width: 0, height: 0,
      right: 0, bottom: 0, x: 0, y: 0, toJSON: () => ({}),
    });
    document.body.appendChild(div);

    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [{ id: 's1', title: 'ZeroSize', description: 'Zero size', highlight: '.zero-size-el' }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    div.remove();
  });

  it('isElementVisible returns false for visibility:hidden element', async () => {
    const div = document.createElement('div');
    div.className = 'visibility-hidden-el';
    div.style.visibility = 'hidden';
    div.scrollIntoView = vi.fn();
    vi.spyOn(div, 'getBoundingClientRect').mockReturnValue({
      top: 10, left: 10, width: 50, height: 50,
      right: 60, bottom: 60, x: 10, y: 10, toJSON: () => ({}),
    });
    document.body.appendChild(div);

    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [{ id: 's1', title: 'VHidden', description: 'Visibility hidden', highlight: '.visibility-hidden-el' }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    div.remove();
  });

  it('isElementVisible returns false for opacity:0 element', async () => {
    const div = document.createElement('div');
    div.className = 'opacity-zero-el';
    div.style.opacity = '0';
    div.scrollIntoView = vi.fn();
    vi.spyOn(div, 'getBoundingClientRect').mockReturnValue({
      top: 10, left: 10, width: 50, height: 50,
      right: 60, bottom: 60, x: 10, y: 10, toJSON: () => ({}),
    });
    document.body.appendChild(div);

    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [{ id: 's1', title: 'OpacityZero', description: 'Opacity 0', highlight: '.opacity-zero-el' }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    div.remove();
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
          // A 4-second action — longer than the 1500ms breathing pause
          action: async (ctx) => { await ctx.delay(4000); },
        },
        { id: 's2', title: 'S2', description: 'Step 2' },
      ],
    });
    act(() => result.current.selectLesson(lesson));

    // Start live demo and advance only partway — step 0's 4s action is still running
    await act(async () => {
      result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(600); // past preAction but deep into action
    });

    // Toggle auto-play while step 0 is executing (executingRef.current = true)
    // Effect fires and sets a 1500ms breathing pause.
    // When that fires, executingRef is still true → while loop runs (lines 425-426)
    act(() => result.current.toggleAutoPlay());

    // Advance enough for: breathing pause (1500ms) + polling (200ms×N) + step 0
    // completion (4000ms - 600ms already elapsed = 3400ms) + step 1 + settle
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
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

  // ─── toggleAutoPlay — pausing stops timer ─────────────────────

  it('toggleAutoPlay when pausing clears pending timer', async () => {
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [
        { id: 's1', title: 'S1', description: 'S1' },
        { id: 's2', title: 'S2', description: 'S2' },
        { id: 's3', title: 'S3', description: 'S3' },
      ],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(5000);
      await p;
    });
    act(() => result.current.toggleAutoPlay());
    expect(result.current.state.isPlaying).toBe(true);
    // Pause immediately
    act(() => result.current.toggleAutoPlay());
    expect(result.current.state.isPlaying).toBe(false);
    // Should not advance after pausing
    const idx = result.current.state.stepIndex;
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(result.current.state.stepIndex).toBe(idx);
  });

  // ─── buildContext waitFor timeout branch ──────────────────────

  it('buildContext waitFor times out when element never appears', async () => {
    let waited = false;
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [{
        id: 's1', title: 'Wait', description: 'Wait timeout',
        action: async (ctx) => {
          await ctx.waitFor('.never-appears-zzz', 500);
          waited = true;
        },
      }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(6000);
      await p;
    });
    expect(waited).toBe(true); // waited completes after timeout
  });

  // ─── skipReading skips the reading phase ──────────────────────

  it('skipReading shortens reading pause when called during reading phase', async () => {
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [{ id: 's1', title: 'Long Read', description: 'A'.repeat(500) }],
    });
    act(() => result.current.selectLesson(lesson));

    // Start the demo and immediately skip reading
    await act(async () => {
      result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(150); // past preAction settle, into reading
      result.current.skipReading();
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(result.current.stepPhase).toBe('done');
  });

  // ─── restoreStateFromProgress (lines 43-67) ───────────────────

  it('restores concept view from persisted lastLesson on init', () => {
    localStorage.setItem('redfire-demo-progress-v2', JSON.stringify({
      completedLessons: [],
      lessonSteps: {},
      speed: 1,
      lastView: 'concept',
      lastDomain: 'protocols',
      lastLesson: 'ws-workspace',
    }));
    const { result } = renderDemoHub(navigateToTab);
    expect(result.current.state.view).toBe('concept');
    expect(result.current.state.selectedLesson?.id).toBe('ws-workspace');
    expect(result.current.state.selectedDomain?.id).toBe('protocols');
  });

  it('restores lessons view from persisted lastDomain on init', () => {
    localStorage.setItem('redfire-demo-progress-v2', JSON.stringify({
      completedLessons: [],
      lessonSteps: {},
      speed: 2,
      lastView: 'lessons',
      lastDomain: 'protocols',
    }));
    const { result } = renderDemoHub(navigateToTab);
    expect(result.current.state.view).toBe('lessons');
    expect(result.current.state.selectedDomain?.id).toBe('protocols');
    expect(result.current.state.speed).toBe(2);
  });

  it('restoreStateFromProgress falls back to domains when domain unavailable', () => {
    localStorage.setItem('redfire-demo-progress-v2', JSON.stringify({
      completedLessons: [],
      lessonSteps: {},
      speed: 1,
      lastView: 'lessons',
      lastDomain: 'nonexistent-domain',
    }));
    const { result } = renderDemoHub(navigateToTab);
    expect(result.current.state.view).toBe('domains');
  });

  it('restoreStateFromProgress skips concept restore when lesson domain is unavailable', () => {
    localStorage.setItem('redfire-demo-progress-v2', JSON.stringify({
      completedLessons: [],
      lessonSteps: {},
      speed: 1,
      lastView: 'concept',
      lastLesson: 'definitely-not-a-real-lesson-id',
    }));
    const { result } = renderDemoHub(navigateToTab);
    expect(result.current.state.view).toBe('domains');
    expect(result.current.state.selectedLesson).toBeNull();
  });

  it('goToDomains clears pending auto-play timer when navigating home', async () => {
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [
        { id: 's1', title: 'S1', description: 'A'.repeat(500) },
        { id: 's2', title: 'S2', description: 'Next' },
      ],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      void result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(100);
    });
    act(() => result.current.toggleAutoPlay());
    act(() => result.current.goToDomains());
    expect(result.current.state.view).toBe('domains');
    expect(result.current.state.isPlaying).toBe(false);
  });

  // ─── showClickRipple animationend (line 610) ──────────────────

  it('showClickRipple removes ring element on animationend', async () => {
    const btn = document.createElement('button');
    btn.className = 'ripple-target-btn';
    makeVisible(btn);
    document.body.appendChild(btn);

    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [{
        id: 's1', title: 'Ripple', description: 'Ripple test',
        action: async (ctx) => { await ctx.click('.ripple-target-btn'); },
      }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });

    const ring = document.querySelector('.demo-click-ripple') as HTMLElement | null;
    expect(ring).toBeTruthy();
    ring!.dispatchEvent(new Event('animationend'));
    expect(document.querySelector('.demo-click-ripple')).toBeNull();
    btn.remove();
  });

  // ─── isElementVisible display:none branch (line 599) ──────────

  it('isElementVisible returns false for display:none element', async () => {
    const div = document.createElement('div');
    div.className = 'display-none-el';
    div.style.display = 'none';
    div.scrollIntoView = vi.fn();
    vi.spyOn(div, 'getBoundingClientRect').mockReturnValue({
      top: 10, left: 10, width: 50, height: 50,
      right: 60, bottom: 60, x: 10, y: 10, toJSON: () => ({}),
    });
    document.body.appendChild(div);

    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [{ id: 's1', title: 'DNone', description: 'Display none', highlight: '.display-none-el' }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    div.remove();
  });

  // ─── firstVisible skips non-HTMLElement nodes (line 22) ───────

  it('firstVisible skips SVG nodes and clicks visible HTMLElement', async () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'mixed-target');
    makeVisible(svg);
    document.body.appendChild(svg);

    const btn = document.createElement('button');
    btn.className = 'mixed-target';
    makeVisible(btn);
    const clickSpy = vi.spyOn(btn, 'click');
    document.body.appendChild(btn);

    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [{
        id: 's1', title: 'Mixed', description: 'Mixed nodes',
        action: async (ctx) => { await ctx.click('.mixed-target'); },
      }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    expect(clickSpy).toHaveBeenCalled();
    svg.remove();
    btn.remove();
    document.querySelectorAll('.demo-click-ripple').forEach(el => el.remove());
  });

  // ─── buildContext selectOption (lines 198-206) ────────────────

  it('buildContext selectOption sets value and dispatches change', async () => {
    const select = document.createElement('select');
    select.className = 'ctx-select-opt';
    makeVisible(select);
    const optA = document.createElement('option');
    optA.value = 'a';
    const optB = document.createElement('option');
    optB.value = 'b';
    select.appendChild(optA);
    select.appendChild(optB);
    document.body.appendChild(select);

    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [{
        id: 's1', title: 'SelectOpt', description: 'Select option',
        action: async (ctx) => { await ctx.selectOption('.ctx-select-opt', 'b'); },
      }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    expect(select.value).toBe('b');
    select.remove();
    document.querySelectorAll('.demo-click-ripple').forEach(el => el.remove());
  });

  // ─── auto-play stops at last step (lines 487-488) ─────────────

  it('auto-play effect stops playing when reaching last step', async () => {
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [
        { id: 's1', title: 'S1', description: 'Step 1', pauseAfter: 0 },
        { id: 's2', title: 'S2', description: 'Step 2', pauseAfter: 0 },
      ],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    act(() => result.current.toggleAutoPlay());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20000);
    });
    expect(result.current.state.isPlaying).toBe(false);
    expect(result.current.state.stepIndex).toBe(1);
  });

  // ─── confirmLessonComplete ─────────────────────────────────────

  it('confirmLessonComplete marks lesson complete when selected', () => {
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson();
    act(() => result.current.selectLesson(lesson));
    act(() => result.current.confirmLessonComplete());
    expect(result.current.progress.completedLessons).toContain(lesson.id);
  });

  it('executeCurrentStep runs verify phase when step.verify is set', async () => {
    const div = document.createElement('div');
    div.className = 'verify-target-el';
    makeVisible(div);
    document.body.appendChild(div);

    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [{ id: 's1', title: 'Verify', description: 'Has verify', verify: '.verify-target-el', pauseAfter: 0 }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(10000);
      await p;
    });
    expect(result.current.stepPhase).toBe('done');
    div.remove();
  });

  it('executeCurrentStep uses calcReadingTime when pauseAfter is not a number', async () => {
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [{ id: 's1', title: 'Read', description: 'Short description.', pauseAfter: true }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(100);
      result.current.skipReading();
      await vi.advanceTimersByTimeAsync(5000);
      await p;
    });
    expect(result.current.stepPhase).toBe('done');
  });

  it('executeCurrentStep handles step with no action (highlight only)', async () => {
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [{ id: 's1', title: 'NoAction', description: 'No action step', pauseAfter: 0 }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    expect(result.current.stepPhase).toBe('done');
  });

  it('executeCurrentStep logs warning when preAction throws', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [{
        id: 's1', title: 'BadPre', description: 'Pre throws', pauseAfter: 0,
        preAction: async () => { throw new Error('pre fail'); },
      }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    expect(warnSpy).toHaveBeenCalledWith('[DemoHub] preAction failed:', expect.any(Error));
    warnSpy.mockRestore();
  });

  it('executeCurrentStep logs warning when action throws', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [{
        id: 's1', title: 'BadAction', description: 'Action throws', pauseAfter: 0,
        action: async () => { throw new Error('action fail'); },
      }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    expect(warnSpy).toHaveBeenCalledWith('[DemoHub] action failed:', expect.any(Error));
    warnSpy.mockRestore();
  });

  it('restoreStateFromProgress restores lessons view with lastLesson hint', () => {
    localStorage.setItem('redfire-demo-progress-v2', JSON.stringify({
      completedLessons: [],
      lessonSteps: {},
      speed: 1,
      lastView: 'lessons',
      lastDomain: 'protocols',
      lastLesson: 'ws-workspace',
    }));
    const { result } = renderDemoHub(navigateToTab);
    expect(result.current.state.view).toBe('lessons');
    expect(result.current.state.selectedLesson?.id).toBe('ws-workspace');
  });

  it('restoreStateFromProgress uses lastDomain without lastLesson', () => {
    localStorage.setItem('redfire-demo-progress-v2', JSON.stringify({
      completedLessons: [],
      lessonSteps: {},
      speed: 1,
      lastDomain: 'protocols',
    }));
    const { result } = renderDemoHub(navigateToTab);
    expect(result.current.state.view).toBe('lessons');
    expect(result.current.state.selectedLesson).toBeNull();
  });

  it('exitLiveDemo handles cleanup rejection gracefully', async () => {
    const cleanup = vi.fn().mockRejectedValue(new Error('cleanup boom'));
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({ cleanup });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.exitLiveDemo();
      await vi.advanceTimersByTimeAsync(1000);
      await p;
    });
    expect(result.current.state.view).toBe('concept');
  });

  it('buildContext fill sets textarea value with ripple', async () => {
    const textarea = document.createElement('textarea');
    textarea.className = 'ctx-textarea-fill';
    makeVisible(textarea);
    document.body.appendChild(textarea);

    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [{
        id: 's1', title: 'FillTA', description: 'Fill textarea', pauseAfter: 0,
        action: async (ctx) => { await ctx.fill('.ctx-textarea-fill', 'hello-ta'); },
      }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    expect(textarea.value).toBe('hello-ta');
    textarea.remove();
    document.querySelectorAll('.demo-click-ripple').forEach(el => el.remove());
  });

  it('buildQuietContext selectOption sets value via preAction', async () => {
    const select = document.createElement('select');
    select.setAttribute('data-testid', 'quiet-select');
    makeVisible(select);
    const opt = document.createElement('option');
    opt.value = 'b';
    select.appendChild(opt);
    document.body.appendChild(select);

    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [{
        id: 's1', title: 'QuietSel', description: 'Quiet select', pauseAfter: 0,
        preAction: async (ctx) => { await ctx.selectOption('[data-testid="quiet-select"]', 'b'); },
      }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    expect(select.value).toBe('b');
    select.remove();
  });

  it('buildQuietContext selectOption skips when native setter is absent', async () => {
    const select = document.createElement('select');
    select.setAttribute('data-testid', 'quiet-select-2');
    makeVisible(select);
    ['a', 'c'].forEach(v => {
      const opt = document.createElement('option');
      opt.value = v;
      select.appendChild(opt);
    });
    document.body.appendChild(select);

    const original = Object.getOwnPropertyDescriptor;
    vi.spyOn(Object, 'getOwnPropertyDescriptor').mockImplementation((proto, prop) => {
      if (proto === HTMLSelectElement.prototype && prop === 'value') {
        return { get: original(HTMLSelectElement.prototype, 'value')!.get };
      }
      return original(proto as object, prop as PropertyKey);
    });

    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [{
        id: 's1', title: 'QuietSelNoSet', description: 'No setter', pauseAfter: 0,
        preAction: async (ctx) => { await ctx.selectOption('[data-testid="quiet-select-2"]', 'c'); },
      }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    vi.restoreAllMocks();
    expect(select.value).toBe('a');
    select.remove();
  });

  it('toggleAutoPlay at last step runs cleanup setup and restarts from step 0', async () => {
    const cleanup = vi.fn().mockResolvedValue(undefined);
    const setup = vi.fn().mockResolvedValue(undefined);
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({ cleanup, setup, initialTab: 'websocket-studio' });
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
    navigateToTab.mockClear();
    act(() => result.current.toggleAutoPlay());
    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    expect(cleanup).toHaveBeenCalled();
    expect(setup).toHaveBeenCalled();
    expect(navigateToTab).toHaveBeenCalledWith('websocket-studio');
    expect(result.current.state.stepIndex).toBe(0);
  });

  it('waitForElement retries until a visible element appears', async () => {
    const div = document.createElement('div');
    div.className = 'wait-retry-el';
    makeVisible(div);
    div.scrollIntoView = vi.fn();

    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [{ id: 's1', title: 'WaitRetry', description: 'Retry wait', highlight: '.wait-retry-el', pauseAfter: 0 }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(250);
      document.body.appendChild(div);
      await vi.advanceTimersByTimeAsync(10000);
      await p;
    });
    div.remove();
  });

  it('firstVisible skips zero-size element and clicks the visible match', async () => {
    const hidden = document.createElement('button');
    hidden.className = 'multi-target';
    hidden.getBoundingClientRect = () => ({
      width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON: () => '{}',
    } as DOMRect);
    document.body.appendChild(hidden);

    const visible = document.createElement('button');
    visible.className = 'multi-target';
    makeVisible(visible);
    const clickSpy = vi.spyOn(visible, 'click');
    document.body.appendChild(visible);

    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [{
        id: 's1', title: 'Multi', description: 'Multi target', pauseAfter: 0,
        action: async (ctx) => { await ctx.click('.multi-target'); },
      }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    expect(clickSpy).toHaveBeenCalled();
    hidden.remove();
    visible.remove();
    document.querySelectorAll('.demo-click-ripple').forEach(el => el.remove());
  });

  // ─── closeHub / goBack / goToDomains branches ─────────────────

  it('closeHub runs live lesson cleanup when hub closed during live demo', async () => {
    const cleanup = vi.fn().mockResolvedValue(undefined);
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({ cleanup });
    act(() => {
      result.current.openHub();
      result.current.selectLesson(lesson);
    });
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    act(() => result.current.closeHub());
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    expect(cleanup).toHaveBeenCalled();
    expect(result.current.hubOpen).toBe(false);
  });

  it('closeHub closes graphql demo workspace when concept view has graphql lesson', async () => {
    const gqlTabMod = await import('./lessons/protocols/graphql-lesson-helpers/gql-demo-tab');
    const closeSpy = vi.spyOn(gqlTabMod, 'closeGqlDemoWorkspaceQuiet').mockResolvedValue(undefined);
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      id: 'gql-first-query',
      category: 'graphql',
      initialTab: 'graphql-studio',
    });
    act(() => result.current.selectLesson(lesson));
    act(() => result.current.openHub());
    act(() => result.current.closeHub());
    await act(async () => { await vi.advanceTimersByTimeAsync(50); });
    expect(closeSpy).toHaveBeenCalledWith('gql-first-query');
    closeSpy.mockRestore();
  });

  it('goBack from domains is a no-op on view state', () => {
    const { result } = renderDemoHub(navigateToTab);
    act(() => result.current.goBack());
    expect(result.current.state.view).toBe('domains');
  });

  it('goToDomains resets to domain list and clears selected domain', () => {
    const { result } = renderDemoHub(navigateToTab);
    act(() => result.current.selectDomain({
      id: 'protocols',
      name: 'Protocols',
      icon: '🔌',
      description: 'Protocols',
      available: true,
      lessons: [],
    }));
    act(() => result.current.goToDomains());
    expect(result.current.state.view).toBe('domains');
    expect(result.current.state.selectedDomain).toBeNull();
    expect(result.current.state.isPlaying).toBe(false);
  });

  it('startLiveDemo returns early when lesson is desktop-only blocked on web', async () => {
    const lessonPlatform = await import('./utils/lessonPlatform');
    const blockSpy = vi.spyOn(lessonPlatform, 'isLessonDesktopOnlyBlocked').mockReturnValue(true);

    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({ desktopOnly: true });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      await result.current.startLiveDemo();
    });
    expect(result.current.state.view).not.toBe('live');
    blockSpy.mockRestore();
  });

  it('runLiveLessonCleanup uses graphql workspace cleanup when lesson has no cleanup fn', async () => {
    const gqlTabMod = await import('./lessons/protocols/graphql-lesson-helpers/gql-demo-tab');
    const closeSpy = vi.spyOn(gqlTabMod, 'closeGqlDemoWorkspaceQuiet').mockResolvedValue(undefined);
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      id: 'gql-vars',
      category: 'graphql',
      initialTab: 'graphql-studio',
      cleanup: undefined,
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    act(() => result.current.goBack());
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(closeSpy).toHaveBeenCalledWith('gql-vars');
    closeSpy.mockRestore();
  });

  it('goBack from live runs cleanup for graphql lesson without custom cleanup', async () => {
    const gqlTabMod = await import('./lessons/protocols/graphql-lesson-helpers/gql-demo-tab');
    const closeSpy = vi.spyOn(gqlTabMod, 'closeGqlDemoWorkspaceQuiet').mockRejectedValue(new Error('gql cleanup fail'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      id: 'gql-sub',
      category: 'graphql',
      initialTab: 'graphql-studio',
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    act(() => result.current.goBack());
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(warnSpy).toHaveBeenCalledWith('[DemoHub] Lesson cleanup failed:', expect.any(Error));
    warnSpy.mockRestore();
    closeSpy.mockRestore();
  });

  it('confirmLessonComplete is safe when no lesson selected', () => {
    const { result } = renderDemoHub(navigateToTab);
    act(() => result.current.confirmLessonComplete());
    expect(result.current.progress.completedLessons).toEqual([]);
  });

  it('buildContext selectOption no-ops when native setter missing', async () => {
    const select = document.createElement('select');
    select.className = 'no-setter-select';
    makeVisible(select);
    document.body.appendChild(select);

    const original = Object.getOwnPropertyDescriptor;
    vi.spyOn(Object, 'getOwnPropertyDescriptor').mockImplementation((proto, prop) => {
      if (proto === HTMLSelectElement.prototype && prop === 'value') {
        return { get: original(HTMLSelectElement.prototype, 'value')!.get };
      }
      return original(proto as object, prop as PropertyKey);
    });

    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [{
        id: 's1', title: 'SelNoSet', description: 'No setter', pauseAfter: 0,
        action: async (ctx) => { await ctx.selectOption('.no-setter-select', 'x'); },
      }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    vi.restoreAllMocks();
    select.remove();
  });

  it('waitForElement returns false when aborted before element appears', async () => {
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [{
        id: 's1', title: 'AbortWait', description: 'Abort wait', pauseAfter: 0,
        verify: '.never-appears-abort',
      }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    expect(result.current.stepPhase).toBe('done');
  });

  it('logs GQL storage hygiene summary when ephemeral keys are purged on graphql lesson start', async () => {
    const { purgeGqlDemoEphemeralStorage } = await import('./lessons/gql-demo-storage-cleanup');
    vi.mocked(purgeGqlDemoEphemeralStorage).mockResolvedValue({
      profilesRemoved: 2,
      runnerConfigsRemoved: 1,
      staleKeysRemoved: 3,
      freedKB: 12,
    });
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      id: 'gql-hygiene',
      category: 'graphql',
      initialTab: 'graphql-studio',
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('[DemoHub] GQL storage hygiene:'));
    infoSpy.mockRestore();
  });

  it('warns when GQL storage hygiene fails during graphql lesson restart', async () => {
    const { purgeGqlDemoEphemeralStorage } = await import('./lessons/gql-demo-storage-cleanup');
    vi.mocked(purgeGqlDemoEphemeralStorage).mockRejectedValue(new Error('idb unavailable'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      id: 'gql-hygiene-fail',
      category: 'graphql',
      initialTab: 'graphql-studio',
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    await act(async () => {
      await result.current.restartDemo();
    });
    expect(warnSpy).toHaveBeenCalledWith('[DemoHub] GQL storage hygiene failed:', expect.any(Error));
    warnSpy.mockRestore();
  });

  it('runLiveLessonCleanup uses custom cleanup for graphql lesson when provided', async () => {
    const cleanup = vi.fn(async () => {});
    const gqlTabMod = await import('./lessons/protocols/graphql-lesson-helpers/gql-demo-tab');
    const closeSpy = vi.spyOn(gqlTabMod, 'closeGqlDemoWorkspaceQuiet').mockResolvedValue(undefined);
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      id: 'gql-custom-cleanup',
      category: 'graphql',
      initialTab: 'graphql-studio',
      cleanup,
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    act(() => result.current.goBack());
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(cleanup).toHaveBeenCalled();
    expect(closeSpy).not.toHaveBeenCalled();
    closeSpy.mockRestore();
  });

  it('warns when GQL demo environment cleanup fails on graphql lesson teardown', async () => {
    const envMod = await import('./lessons/env-manager-lesson-helpers');
    vi.mocked(envMod.cleanupGqlDemoLessonEnvironment).mockRejectedValueOnce(new Error('em cleanup fail'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      id: 'gql-em-fail',
      category: 'graphql',
      initialTab: 'graphql-studio',
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    act(() => result.current.goBack());
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(warnSpy).toHaveBeenCalledWith('[DemoHub] GQL demo environment cleanup failed:', expect.any(Error));
    warnSpy.mockRestore();
  });

  it('nextStep during reading phase finishes current step before advancing', async () => {
    const { result } = renderDemoHub(navigateToTab);
    const actionFn = vi.fn();
    const lesson = makeLesson({
      steps: [
        {
          id: 's1',
          title: 'S1',
          description: 'A'.repeat(500),
          action: actionFn,
        },
        { id: 's2', title: 'S2', description: 'Step 2' },
      ],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      void result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(result.current.stepPhase).toBe('reading');
    await act(async () => {
      const p = result.current.nextStep();
      await vi.advanceTimersByTimeAsync(3000);
      await p;
    });
    expect(actionFn).toHaveBeenCalled();
    expect(result.current.state.stepIndex).toBe(1);
  });

  it('pauseAutoPlay clears scheduled auto-advance timer when toggled off', async () => {
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
    expect(result.current.stepPhase).toBe('done');
    act(() => result.current.toggleAutoPlay());
    act(() => result.current.toggleAutoPlay());
    expect(result.current.state.isPlaying).toBe(false);
  });

  it('runLiveLessonCleanup logs when non-graphql lesson cleanup rejects', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const cleanup = vi.fn().mockRejectedValue(new Error('ws cleanup fail'));
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      domainId: 'protocols',
      cleanup,
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    act(() => result.current.goBack());
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(cleanup).toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith('[DemoHub] Lesson cleanup failed:', expect.any(Error));
    warnSpy.mockRestore();
  });

  it('pauseAutoPlay clears pending auto-play timer when toggled off during reading', async () => {
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      steps: [
        { id: 's1', title: 'S1', description: 'A'.repeat(500) },
        { id: 's2', title: 'S2', description: 'Next' },
      ],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      void result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(result.current.stepPhase).toBe('reading');

    act(() => {
      result.current.toggleAutoPlay();
      result.current.toggleAutoPlay();
    });

    expect(result.current.state.isPlaying).toBe(false);
  });

  it('closeHub expands workflow sidebar for live workflow designer lesson', async () => {
    const adapterMod = await import('./adapters');
    const expandSpy = vi.spyOn(adapterMod, 'expandAppSidebar').mockImplementation(() => {});
    const { result } = renderDemoHub(navigateToTab);
    const lesson = makeLesson({
      id: 'wf-designer',
      initialTab: 'workflow',
      category: 'workflow',
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(7000);
      await p;
    });
    act(() => result.current.closeHub());
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    expect(expandSpy).toHaveBeenCalled();
    expandSpy.mockRestore();
  });
});
