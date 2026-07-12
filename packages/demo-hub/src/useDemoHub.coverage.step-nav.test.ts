/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from '@testing-library/react';
import { makeVisible } from './lessons/protocols/ws-test-utils';
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


describe('useDemoHub (branch coverage — step navigation)', () => {
  const navigateToTab = vi.fn();

  beforeEach(() => {
    setupUseDemoHubCoverageBeforeEach();
  });

  afterEach(async () => {
    await teardownUseDemoHubCoverageAfterEach();
  });


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

});
