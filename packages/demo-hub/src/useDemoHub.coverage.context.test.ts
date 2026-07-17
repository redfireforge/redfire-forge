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


describe('useDemoHub (branch coverage — context)', () => {
  const navigateToTab = vi.fn();

  beforeEach(() => {
    setupUseDemoHubCoverageBeforeEach();
  });

  afterEach(async () => {
    await teardownUseDemoHubCoverageAfterEach();
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
});
