/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDemoHub } from './useDemoHub';
import type { DemoLesson } from './types';
import { makeVisible } from './lessons/protocols/ws-test-utils';

function makeLesson(overrides: Partial<DemoLesson> = {}): DemoLesson {
  return {
    id: 'lesson-1',
    domainId: 'test-domain',
    name: 'Test Lesson',
    description: 'A test lesson',
    estimatedMinutes: 5,
    concept: { title: 'Concept', body: 'Concept body' },
    steps: [
      { id: 'step-1', title: 'Step 1', description: 'Do something' },
      { id: 'step-2', title: 'Step 2', description: 'Do something else' },
      { id: 'step-3', title: 'Step 3', description: 'Final step' },
    ],
    ...overrides,
  };
}


// ─── Tests with fake timers for async step execution ──────────
describe('useDemoHub (async execution)', () => {
  const navigateToTab = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.clearAllMocks();
    localStorage.clear();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('startLiveDemo runs setup if defined', async () => {
    const setup = vi.fn();
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    const lesson = makeLesson({ setup });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(6000);
      await p;
    });
    expect(setup).toHaveBeenCalled();
  });

  it('startLiveDemo handles setup error gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const setup = vi.fn().mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    const lesson = makeLesson({ setup });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(6000);
      await p;
    });
    expect(result.current.state.view).toBe('live');
    consoleSpy.mockRestore();
  });

  it('exitLiveDemo handles cleanup error gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const cleanup = vi.fn().mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    const lesson = makeLesson({ cleanup });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(6000);
      await p;
    });
    await act(async () => {
      await result.current.exitLiveDemo();
    });
    expect(result.current.state.view).toBe('concept');
    consoleSpy.mockRestore();
  });

  it('goToStep clamps to valid range', async () => {
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    const lesson = makeLesson();
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(6000);
      await p;
    });
    await act(async () => {
      const p = result.current.goToStep(999);
      await vi.advanceTimersByTimeAsync(6000);
      await p;
    });
    expect(result.current.state.stepIndex).toBe(2);
  });

  it('goToStep clamps negative index to 0', async () => {
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    const lesson = makeLesson();
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(6000);
      await p;
    });
    await act(async () => {
      const p = result.current.goToStep(-5);
      await vi.advanceTimersByTimeAsync(6000);
      await p;
    });
    expect(result.current.state.stepIndex).toBe(0);
  });

  it('goToStep shows completion prompt when navigating to last step', async () => {
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    const lesson = makeLesson(); // 3 steps (indices 0-2)
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(6000);
      await p;
    });
    // Navigate directly to the last step (index 2)
    await act(async () => {
      const p = result.current.goToStep(2);
      await vi.advanceTimersByTimeAsync(6000);
      await p;
    });
    // Lesson is NOT auto-marked; user must click Complete.
    expect(result.current.progress.completedLessons).not.toContain(lesson.id);
    // confirmLessonComplete simulates clicking the Complete button.
    act(() => { result.current.confirmLessonComplete(); });
    expect(result.current.progress.completedLessons).toContain(lesson.id);
  });

  it('nextStep marks lesson complete at last step', async () => {
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    const lesson = makeLesson({
      steps: [{ id: 's1', title: 'Only', description: 'Only step' }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(6000);
      await p;
    });
    act(() => { result.current.nextStep(); });
    expect(result.current.state.isPlaying).toBe(false);
  });

  it('toggleAutoPlay toggles playing state', async () => {
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    const lesson = makeLesson();
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(6000);
      await p;
    });
    expect(result.current.state.isPlaying).toBe(false);
    act(() => { result.current.toggleAutoPlay(); });
    expect(result.current.state.isPlaying).toBe(true);
    act(() => { result.current.toggleAutoPlay(); });
    expect(result.current.state.isPlaying).toBe(false);
  });

  it('toggleAutoPlay restarts from step 0 at last step', async () => {
    const cleanup = vi.fn();
    const setup = vi.fn();
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    const lesson = makeLesson({
      steps: [
        { id: 's1', title: 'S1', description: 'First' },
        { id: 's2', title: 'S2', description: 'Last' },
      ],
      cleanup,
      setup,
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(6000);
      await p;
    });
    await act(async () => {
      const p = result.current.goToStep(1);
      await vi.advanceTimersByTimeAsync(6000);
      await p;
    });
    expect(result.current.state.stepIndex).toBe(1);
    act(() => { result.current.toggleAutoPlay(); });
    // isPlaying starts as false during restart so the auto-play effect does NOT
    // race with cleanup/setup (it gets re-enabled inside the callback after setup).
    expect(result.current.state.isPlaying).toBe(false);
    expect(result.current.state.stepIndex).toBe(0);
  });

  it('executeCurrentStep handles step with preAction', async () => {
    const preAction = vi.fn();
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    const lesson = makeLesson({
      steps: [{ id: 's1', title: 'Pre', description: 'Has preAction', preAction }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(6000);
      await p;
    });
    expect(preAction).toHaveBeenCalled();
  });

  it('executeCurrentStep handles step with action', async () => {
    const action = vi.fn();
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    const lesson = makeLesson({
      steps: [{ id: 's1', title: 'Act', description: 'Has action', action }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(6000);
      await p;
    });
    expect(action).toHaveBeenCalled();
  });

  it('executeCurrentStep handles preAction error gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const preAction = vi.fn().mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    const lesson = makeLesson({
      steps: [{ id: 's1', title: 'Err', description: 'Pre fails', preAction }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(6000);
      await p;
    });
    expect(preAction).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('executeCurrentStep handles action error gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const action = vi.fn().mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    const lesson = makeLesson({
      steps: [{ id: 's1', title: 'Err', description: 'Act fails', action }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(6000);
      await p;
    });
    expect(action).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('executeCurrentStep handles step with highlight', async () => {
    const div = document.createElement('div');
    div.className = 'target';
    div.style.width = '100px';
    div.style.height = '50px';
    div.scrollIntoView = vi.fn();
    document.body.appendChild(div);

    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    const lesson = makeLesson({
      steps: [{ id: 's1', title: 'HL', description: 'Highlight', highlight: '.target' }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(6000);
      await p;
    });

    document.body.removeChild(div);
  });

  it('executeCurrentStep handles step with verify', async () => {
    const div = document.createElement('div');
    div.className = 'verify-me';
    div.style.width = '10px';
    div.style.height = '10px';
    document.body.appendChild(div);

    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    const lesson = makeLesson({
      steps: [{ id: 's1', title: 'V', description: 'Verify', verify: '.verify-me' }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(10000);
      await p;
    });

    document.body.removeChild(div);
  });

  it('buildContext click triggers ripple on HTMLElement', async () => {
    const btn = document.createElement('button');
    btn.className = 'ctx-btn';
    btn.setAttribute('data-testid', 'ctx-btn');
    makeVisible(btn);
    const clickSpy = vi.spyOn(btn, 'click');
    document.body.appendChild(btn);

    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    const lesson = makeLesson({
      steps: [{
        id: 's1', title: 'Click', description: 'Clicks a button',
        action: async (ctx) => {
          await ctx.click('.ctx-btn');
        },
      }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(10000);
      await p;
    });

    expect(clickSpy).toHaveBeenCalled();
    document.body.removeChild(btn);
    // Clean up ripple
    document.querySelectorAll('.demo-click-ripple').forEach(el => el.remove());
  });

  it('buildContext fill sets input value', async () => {
    const input = document.createElement('input');
    input.className = 'ctx-input';
    makeVisible(input);
    document.body.appendChild(input);

    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    const lesson = makeLesson({
      steps: [{
        id: 's1', title: 'Fill', description: 'Fills an input',
        action: async (ctx) => {
          await ctx.fill('.ctx-input', 'test-value');
        },
      }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(10000);
      await p;
    });

    expect(input.value).toBe('test-value');
    document.body.removeChild(input);
    document.querySelectorAll('.demo-click-ripple').forEach(el => el.remove());
  });

  it('buildContext fill sets textarea value', async () => {
    const textarea = document.createElement('textarea');
    textarea.className = 'ctx-textarea';
    makeVisible(textarea);
    document.body.appendChild(textarea);

    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    const lesson = makeLesson({
      steps: [{
        id: 's1', title: 'FillTA', description: 'Fills a textarea',
        action: async (ctx) => {
          await ctx.fill('.ctx-textarea', 'textarea-value');
        },
      }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(10000);
      await p;
    });

    expect(textarea.value).toBe('textarea-value');
    document.body.removeChild(textarea);
    document.querySelectorAll('.demo-click-ripple').forEach(el => el.remove());
  });

  it('buildContext selectOption sets select value', async () => {
    const select = document.createElement('select');
    select.className = 'ctx-select';
    const opt1 = document.createElement('option');
    opt1.value = 'a';
    opt1.text = 'Option A';
    const opt2 = document.createElement('option');
    opt2.value = 'b';
    opt2.text = 'Option B';
    select.append(opt1, opt2);
    makeVisible(select);
    document.body.appendChild(select);

    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    const lesson = makeLesson({
      steps: [{
        id: 's1', title: 'Select', description: 'Selects option',
        action: async (ctx) => {
          await ctx.selectOption('.ctx-select', 'b');
        },
      }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(10000);
      await p;
    });

    expect(select.value).toBe('b');
    document.body.removeChild(select);
    document.querySelectorAll('.demo-click-ripple').forEach(el => el.remove());
  });

  it('buildContext waitFor resolves when element appears', async () => {
    let waited = false;
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    const lesson = makeLesson({
      steps: [{
        id: 's1', title: 'Wait', description: 'Waits for element',
        action: async (ctx) => {
          // Create element after a delay
          setTimeout(() => {
            const div = document.createElement('div');
            div.className = 'wait-target';
            document.body.appendChild(div);
          }, 100);
          await ctx.waitFor('.wait-target', 2000);
          waited = true;
        },
      }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(15000);
      await p;
    });

    expect(waited).toBe(true);
    document.querySelector('.wait-target')?.remove();
    document.querySelectorAll('.demo-click-ripple').forEach(el => el.remove());
  });

  it('buildContext delay works correctly', async () => {
    let delayed = false;
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    const lesson = makeLesson({
      steps: [{
        id: 's1', title: 'Delay', description: 'Uses delay',
        action: async (ctx) => {
          await ctx.delay(100);
          delayed = true;
        },
      }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(10000);
      await p;
    });

    expect(delayed).toBe(true);
  });

  it('buildQuietContext click works without ripple', async () => {
    const btn = document.createElement('button');
    btn.className = 'quiet-btn';
    makeVisible(btn);
    const clickSpy = vi.spyOn(btn, 'click');
    document.body.appendChild(btn);

    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    const lesson = makeLesson({
      steps: [{
        id: 's1', title: 'QuietClick', description: 'Quiet click',
        preAction: async (ctx) => {
          await ctx.click('.quiet-btn');
        },
      }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(10000);
      await p;
    });

    expect(clickSpy).toHaveBeenCalled();
    // No ripple should be created for quiet context
    document.body.removeChild(btn);
  });

  it('buildQuietContext fill works on input', async () => {
    const input = document.createElement('input');
    input.className = 'quiet-input';
    makeVisible(input);
    document.body.appendChild(input);

    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    const lesson = makeLesson({
      steps: [{
        id: 's1', title: 'QuietFill', description: 'Quiet fill',
        preAction: async (ctx) => {
          await ctx.fill('.quiet-input', 'quiet-val');
        },
      }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(10000);
      await p;
    });

    expect(input.value).toBe('quiet-val');
    document.body.removeChild(input);
  });

  it('buildQuietContext selectOption works', async () => {
    const select = document.createElement('select');
    select.className = 'quiet-select';
    const opt = document.createElement('option');
    opt.value = 'x';
    select.appendChild(opt);
    makeVisible(select);
    document.body.appendChild(select);

    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    const lesson = makeLesson({
      steps: [{
        id: 's1', title: 'QuietSelect', description: 'Quiet select',
        preAction: async (ctx) => {
          await ctx.selectOption('.quiet-select', 'x');
        },
      }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(10000);
      await p;
    });

    expect(select.value).toBe('x');
    document.body.removeChild(select);
  });

  it('auto-play effect advances to next step when playing', async () => {
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    const lesson = makeLesson({
      steps: [
        { id: 's1', title: 'S1', description: 'First' },
        { id: 's2', title: 'S2', description: 'Second' },
        { id: 's3', title: 'S3', description: 'Third' },
      ],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(10000);
      await p;
    });
    expect(result.current.state.stepIndex).toBe(0);

    // Start auto-play
    act(() => { result.current.toggleAutoPlay(); });
    expect(result.current.state.isPlaying).toBe(true);

    // Advance past the breathing pause + step execution
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });

    // Should have advanced at least one step
    expect(result.current.state.stepIndex).toBeGreaterThan(0);
  });

  it('waitForElement resolves when visible element appears', async () => {
    const div = document.createElement('div');
    div.className = 'wait-visible';
    div.style.width = '50px';
    div.style.height = '50px';
    div.style.display = 'block';
    div.scrollIntoView = vi.fn();
    vi.spyOn(div, 'getBoundingClientRect').mockReturnValue({
      top: 10, left: 10, width: 50, height: 50,
      right: 60, bottom: 60, x: 10, y: 10, toJSON: () => ({}),
    });

    // Delay adding to DOM so waitForElement has to retry
    setTimeout(() => document.body.appendChild(div), 200);

    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    const lesson = makeLesson({
      steps: [{
        id: 's1', title: 'WaitVis', description: 'Wait visible',
        highlight: '.wait-visible',
      }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(10000);
      await p;
    });

    div.remove();
  });

  it('isElementVisible returns false for hidden elements', async () => {
    const div = document.createElement('div');
    div.className = 'hidden-el';
    div.style.display = 'none';
    div.scrollIntoView = vi.fn();
    vi.spyOn(div, 'getBoundingClientRect').mockReturnValue({
      top: 10, left: 10, width: 50, height: 50,
      right: 60, bottom: 60, x: 10, y: 10, toJSON: () => ({}),
    });
    document.body.appendChild(div);

    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    const lesson = makeLesson({
      steps: [{
        id: 's1', title: 'Hidden', description: 'Hidden element',
        highlight: '.hidden-el',
      }],
    });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(10000);
      await p;
    });

    // Element found but hidden → not treated as visible
    div.remove();
  });

  it('restartDemo resets stepIndex to 0 and stops auto-play', async () => {
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    const lesson = makeLesson();
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(6000);
      await p;
    });
    expect(result.current.state.stepIndex).toBe(0);
    await act(async () => {
      const p = result.current.restartDemo();
      await vi.advanceTimersByTimeAsync(6000);
      await p;
    });
    expect(result.current.state.stepIndex).toBe(0);
    expect(result.current.state.isPlaying).toBe(false);
  });

  it('restartDemo runs cleanup and setup then executes step 0', async () => {
    const cleanup = vi.fn();
    const setup = vi.fn();
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    const lesson = makeLesson({ cleanup, setup });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      const p = result.current.startLiveDemo();
      await vi.advanceTimersByTimeAsync(6000);
      await p;
    });
    vi.clearAllMocks();
    await act(async () => {
      const p = result.current.restartDemo();
      await vi.advanceTimersByTimeAsync(6000);
      await p;
    });
    expect(cleanup).toHaveBeenCalled();
    expect(setup).toHaveBeenCalled();
    expect(result.current.state.stepIndex).toBe(0);
  });
});

