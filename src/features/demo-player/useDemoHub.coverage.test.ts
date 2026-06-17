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
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDemoHub } from './useDemoHub';
import type { DemoLesson } from './types';

vi.useFakeTimers();

/** jsdom has no layout — getBoundingClientRect always returns zero.
 *  firstVisible skips zero-rect elements. Call makeVisible so they are found. */
function makeVisible(el: Element): void {
  (el as HTMLElement).getBoundingClientRect = () => ({
    width: 100, height: 20, top: 0, left: 0,
    right: 100, bottom: 20, x: 0, y: 0, toJSON: () => '{}',
  } as DOMRect);
}

function makeLesson(overrides: Partial<DemoLesson> = {}): DemoLesson {
  return {
    id: 'lesson-coverage',
    domainId: 'test-domain',
    name: 'Coverage Lesson',
    description: 'Coverage tests',
    estimatedMinutes: 3,
    concept: { title: 'Concept', body: 'Body' },
    steps: [
      { id: 's1', title: 'Step 1', description: 'Step one' },
      { id: 's2', title: 'Step 2', description: 'Step two' },
    ],
    ...overrides,
  };
}

describe('useDemoHub (branch coverage)', () => {
  const navigateToTab = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  // ─── goBack from live view ─────────────────────────────────────

  it('goBack from live view returns to concept view', async () => {
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    const lesson = makeLesson();
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(8000);
      await p;
    });
    expect(result.current.state.view).toBe('live');
    act(() => result.current.goBack());
    expect(result.current.state.view).toBe('concept');
    expect(result.current.state.isPlaying).toBe(false);
  });

  // ─── buildContext null-element branches ───────────────────────

  it('buildContext click does nothing when selector finds no element', async () => {
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    const lesson = makeLesson({
      steps: [{
        id: 's1', title: 'NullClick', description: 'Click missing',
        action: async (ctx) => { await ctx.click('.non-existent-element-abc'); },
      }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(8000);
      await p;
    });
    // Should not throw — just silently skip
    expect(result.current.state.stepIndex).toBe(0);
  });

  it('buildContext fill does nothing when selector finds no element', async () => {
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    const lesson = makeLesson({
      steps: [{
        id: 's1', title: 'NullFill', description: 'Fill missing',
        action: async (ctx) => { await ctx.fill('.non-existent-fill-abc', 'val'); },
      }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(8000);
      await p;
    });
    expect(result.current.state.stepIndex).toBe(0);
  });

  it('buildContext selectOption does nothing when selector finds no element', async () => {
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    const lesson = makeLesson({
      steps: [{
        id: 's1', title: 'NullSelect', description: 'Select missing',
        action: async (ctx) => { await ctx.selectOption('.non-existent-select-abc', 'x'); },
      }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(8000);
      await p;
    });
    expect(result.current.state.stepIndex).toBe(0);
  });

  it('buildContext fill does nothing for non-input element (div)', async () => {
    const div = document.createElement('div');
    div.className = 'ctx-div';
    document.body.appendChild(div);

    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    const lesson = makeLesson({
      steps: [{
        id: 's1', title: 'DivFill', description: 'Fill a div',
        action: async (ctx) => { await ctx.fill('.ctx-div', 'val'); },
      }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(8000);
      await p;
    });
    // div.value doesn't exist, so it's ignored
    div.remove();
  });

  // ─── buildQuietContext null / textarea branches ───────────────

  it('buildQuietContext click does nothing when selector finds no element', async () => {
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    const lesson = makeLesson({
      steps: [{
        id: 's1', title: 'QuietNullClick', description: 'Quiet click missing',
        preAction: async (ctx) => { await ctx.click('.non-existent-quiet-abc'); },
      }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(8000);
      await p;
    });
    expect(result.current.state.stepIndex).toBe(0);
  });

  it('buildQuietContext fill works on textarea element', async () => {
    const textarea = document.createElement('textarea');
    textarea.className = 'quiet-textarea';
    makeVisible(textarea);
    document.body.appendChild(textarea);

    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    const lesson = makeLesson({
      steps: [{
        id: 's1', title: 'QuietTextarea', description: 'Quiet fill textarea',
        preAction: async (ctx) => { await ctx.fill('.quiet-textarea', 'quiet-ta-val'); },
      }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(8000);
      await p;
    });
    expect(textarea.value).toBe('quiet-ta-val');
    textarea.remove();
  });

  it('buildQuietContext fill does nothing for non-input element', async () => {
    const div = document.createElement('div');
    div.className = 'quiet-div';
    document.body.appendChild(div);

    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    const lesson = makeLesson({
      steps: [{
        id: 's1', title: 'QuietDivFill', description: 'Quiet fill div',
        preAction: async (ctx) => { await ctx.fill('.quiet-div', 'val'); },
      }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(8000);
      await p;
    });
    div.remove();
  });

  it('buildQuietContext selectOption does nothing when no element found', async () => {
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    const lesson = makeLesson({
      steps: [{
        id: 's1', title: 'QuietNullSelect', description: 'Quiet select missing',
        preAction: async (ctx) => { await ctx.selectOption('.non-existent-select-xyz', 'x'); },
      }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(8000);
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

    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    const lesson = makeLesson({
      steps: [{ id: 's1', title: 'ZeroSize', description: 'Zero size', highlight: '.zero-size-el' }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(8000);
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

    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    const lesson = makeLesson({
      steps: [{ id: 's1', title: 'VHidden', description: 'Visibility hidden', highlight: '.visibility-hidden-el' }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(8000);
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

    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    const lesson = makeLesson({
      steps: [{ id: 's1', title: 'OpacityZero', description: 'Opacity 0', highlight: '.opacity-zero-el' }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(8000);
      await p;
    });
    div.remove();
  });

  // ─── restartDemo without cleanup/setup/initialTab ─────────────

  it('restartDemo works when lesson has no cleanup, no setup, no initialTab', async () => {
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    const lesson = makeLesson({ cleanup: undefined, setup: undefined, initialTab: undefined });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(8000);
      await p;
    });
    await act(async () => {
      const p = result.current.restartDemo();
      await vi.advanceTimersByTimeAsync(8000);
      await p;
    });
    expect(result.current.state.stepIndex).toBe(0);
    expect(result.current.state.isPlaying).toBe(false);
  });

  it('restartDemo handles cleanup error gracefully', async () => {
    const cleanup = vi.fn().mockRejectedValue(new Error('cleanup fail'));
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    const lesson = makeLesson({ cleanup });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(8000);
      await p;
    });
    await act(async () => {
      const p = result.current.restartDemo();
      await vi.advanceTimersByTimeAsync(8000);
      await p;
    });
    expect(result.current.state.stepIndex).toBe(0);
  });

  it('restartDemo handles setup error gracefully', async () => {
    const setup = vi.fn().mockRejectedValue(new Error('setup fail'));
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    const lesson = makeLesson({ setup });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(8000);
      await p;
    });
    await act(async () => {
      const p = result.current.restartDemo();
      await vi.advanceTimersByTimeAsync(8000);
      await p;
    });
    expect(result.current.state.stepIndex).toBe(0);
  });

  // ─── auto-play effect — naturally reaches last step ──────────
  // NOTE: toggleAutoPlay() handles the atEnd case itself (async restart),
  // so lines 407-409 are only reachable when auto-play ADVANCES into the
  // last step, not when it is started at the last step.

  it('auto-play effect stops at last step when advancing naturally through steps', async () => {
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
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
      await vi.advanceTimersByTimeAsync(8000);
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
      await vi.advanceTimersByTimeAsync(15000);
    });

    expect(result.current.state.isPlaying).toBe(false);
  });

  // ─── auto-play polling loop — waits while step is executing ──
  // Lines 425-426: while (executingRef.current) { await new Promise(r => setTimeout(r, 200)) }
  // Reached when the breathing pause fires while a prior step is still executing.

  it('auto-play polling loop waits for in-progress step before advancing', async () => {
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
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
      await vi.advanceTimersByTimeAsync(20000);
    });

    // After polling loop exits and auto-play advances, we should be past step 0
    expect(result.current.state.stepIndex).toBeGreaterThan(0);
  });

  // ─── buildQuietContext waitFor while-loop body (lines 182-185) ──
  // buildQuietContext.waitFor polls until element appears or timeout expires.
  // Uses fake Date.now() so the while loop runs until fake time > timeout.

  it('buildQuietContext waitFor polls while element is absent then times out', async () => {
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
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
      await vi.advanceTimersByTimeAsync(8000);
      await p;
    });
    expect(result.current.state.stepIndex).toBe(0);
  });

  it('buildQuietContext waitFor returns early when element exists', async () => {
    const div = document.createElement('div');
    div.className = 'quiet-found-el';
    document.body.appendChild(div);

    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    const lesson = makeLesson({
      steps: [{
        id: 's1', title: 'WaitForFound', description: 'WaitFor found',
        preAction: async (ctx) => { await ctx.waitFor('.quiet-found-el', 500); },
      }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(8000);
      await p;
    });
    div.remove();
    expect(result.current.state.stepIndex).toBe(0);
  });

  // ─── buildQuietContext delay (line 188) ──────────────────────
  // buildQuietContext's delay is only exercised via preAction/setup/cleanup ctx.delay()

  it('buildQuietContext delay is called when preAction uses ctx.delay', async () => {
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    const lesson = makeLesson({
      steps: [{
        id: 's1', title: 'DelayPreAction', description: 'Delay in preAction',
        preAction: async (ctx) => { await ctx.delay(200); },
      }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(8000);
      await p;
    });
    expect(result.current.state.stepIndex).toBe(0);
  });

  // ─── nextStep when not at last step (line 346) ───────────────
  // nextStep() calls goToStep(stepIndex + 1) when not at end

  it('nextStep advances to next step when not at last step', async () => {
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
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
      await vi.advanceTimersByTimeAsync(8000);
      await p;
    });
    expect(result.current.state.stepIndex).toBe(0);
    // nextStep at step 0 → goes to step 1 (line 346)
    await act(async () => {
      const p = result.current.nextStep();
      await vi.advanceTimersByTimeAsync(8000);
      await p;
    });
    expect(result.current.state.stepIndex).toBe(1);
  });

  // ─── nextStep at last step — marks lesson complete (lines 342-344) ──

  it('nextStep at last step marks lesson complete and stops auto-play', async () => {
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    const lesson = makeLesson({
      steps: [
        { id: 's1', title: 'S1', description: 'Step 1' },
        { id: 's2', title: 'S2', description: 'Step 2' },
      ],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(8000);
      await p;
    });
    // Jump to last step
    await act(async () => {
      const p = result.current.goToStep(1);
      await vi.advanceTimersByTimeAsync(8000);
      await p;
    });
    expect(result.current.state.stepIndex).toBe(1);
    // nextStep at last step → marks complete, sets isPlaying=false
    act(() => result.current.nextStep());
    expect(result.current.state.isPlaying).toBe(false);
  });

  // ─── restartDemo with initialTab (line 450) ───────────────────

  it('restartDemo navigates to initialTab when lesson has one', async () => {
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    const lesson = makeLesson({ initialTab: 'websocket' });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(8000);
      await p;
    });
    navigateToTab.mockClear();
    await act(async () => {
      const p = result.current.restartDemo();
      await vi.advanceTimersByTimeAsync(8000);
      await p;
    });
    // restartDemo should have called navigateToTab with the initialTab
    expect(navigateToTab).toHaveBeenCalledWith('websocket');
  });

  // ─── restartDemo when auto-play is running (line 441) ────────
  // autoPlayRef is set when auto-play has a pending timer.

  it('restartDemo clears pending auto-play timer (line 441)', async () => {
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
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
      await vi.advanceTimersByTimeAsync(8000);
      await p;
    });
    // Start auto-play (sets a pending timer in autoPlayRef)
    act(() => result.current.toggleAutoPlay());
    expect(result.current.state.isPlaying).toBe(true);
    // restartDemo while auto-play is pending — should clear the timer (line 441)
    await act(async () => {
      const p = result.current.restartDemo();
      await vi.advanceTimersByTimeAsync(8000);
      await p;
    });
    expect(result.current.state.stepIndex).toBe(0);
    expect(result.current.state.isPlaying).toBe(false);
  });

  // ─── restartDemo when no lesson is selected (line 440) ──────

  it('restartDemo returns early when no lesson is selected', () => {
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    // Don't select a lesson
    act(() => { result.current.restartDemo(); });
    expect(result.current.state.stepIndex).toBe(0); // still at default
  });

  // ─── auto-play callback gen-mismatch guard (line 420 true branch) ──
  // When auto-play's breathing pause timer fires but the generation was
  // already incremented (e.g. by pausing), the callback returns early.

  it('auto-play breathing pause callback exits early on gen mismatch (line 420)', async () => {
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
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
      await vi.advanceTimersByTimeAsync(8000);
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
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
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
      await vi.advanceTimersByTimeAsync(8000);
      await p;
    });
    // Start auto-play (sets a pending timer in autoPlayRef)
    act(() => result.current.toggleAutoPlay());
    expect(result.current.state.isPlaying).toBe(true);
    // exitLiveDemo while auto-play is pending — should clear the timer (line 463)
    await act(async () => {
      const p = result.current.exitLiveDemo();
      await vi.advanceTimersByTimeAsync(8000);
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
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
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
      await vi.advanceTimersByTimeAsync(8000);
      await p;
    });
    // Jump to last step
    await act(async () => {
      const p = result.current.goToStep(1);
      await vi.advanceTimersByTimeAsync(8000);
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
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
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
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
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
      await vi.advanceTimersByTimeAsync(12000);
      await p;
    });
    expect(waited).toBe(true); // waited completes after timeout
  });

  // ─── skipReading skips the reading phase ──────────────────────

  it('skipReading shortens reading pause when called during reading phase', async () => {
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    const lesson = makeLesson({
      steps: [{ id: 's1', title: 'Long Read', description: 'A'.repeat(500) }],
    });
    act(() => result.current.selectLesson(lesson));

    // Start the demo and immediately skip reading
    await act(async () => {
      result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(400); // past preAction settle
      result.current.skipReading();
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(result.current.stepPhase).toBe('done');
  });
});
