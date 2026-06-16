/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDemoHub } from './useDemoHub';
import type { DemoDomain, DemoLesson } from './types';

function makeDomain(overrides: Partial<DemoDomain> = {}): DemoDomain {
  return {
    id: 'test-domain',
    name: 'Test Domain',
    icon: '🧪',
    description: 'Test domain',
    available: true,
    lessons: [],
    ...overrides,
  };
}

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

describe('useDemoHub', () => {
  const navigateToTab = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('initializes with domains view', () => {
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    expect(result.current.state.view).toBe('domains');
    expect(result.current.state.selectedDomain).toBeNull();
    expect(result.current.state.selectedLesson).toBeNull();
    expect(result.current.state.isPlaying).toBe(false);
  });

  it('opens and closes hub', () => {
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    act(() => result.current.openHub());
    expect(result.current.hubOpen).toBe(true);
    act(() => result.current.closeHub());
    expect(result.current.hubOpen).toBe(false);
  });

  it('selectDomain transitions to lessons view', () => {
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    const domain = makeDomain();
    act(() => result.current.selectDomain(domain));
    expect(result.current.state.view).toBe('lessons');
    expect(result.current.state.selectedDomain).toEqual(domain);
  });

  it('selectDomain ignores unavailable domains', () => {
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    const domain = makeDomain({ available: false });
    act(() => result.current.selectDomain(domain));
    expect(result.current.state.view).toBe('domains');
  });

  it('selectLesson transitions to concept view', () => {
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    const lesson = makeLesson();
    act(() => result.current.selectLesson(lesson));
    expect(result.current.state.view).toBe('concept');
    expect(result.current.state.selectedLesson).toEqual(lesson);
    expect(result.current.state.stepIndex).toBe(0);
  });

  it('goBack navigates from lessons to domains', () => {
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    act(() => result.current.selectDomain(makeDomain()));
    expect(result.current.state.view).toBe('lessons');
    act(() => result.current.goBack());
    expect(result.current.state.view).toBe('domains');
    expect(result.current.state.selectedDomain).toBeNull();
  });

  it('goBack navigates from concept to lessons', () => {
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    act(() => result.current.selectDomain(makeDomain()));
    act(() => result.current.selectLesson(makeLesson()));
    expect(result.current.state.view).toBe('concept');
    act(() => result.current.goBack());
    expect(result.current.state.view).toBe('lessons');
  });

  it('restartDemo is exposed on the hook and setSpeed/prevStep are not', () => {
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    expect(typeof result.current.restartDemo).toBe('function');
    const hub = result.current as Record<string, unknown>;
    expect(hub['setSpeed']).toBeUndefined();
    expect(hub['prevStep']).toBeUndefined();
  });

  it('hubVisible is true when hub is open and not in live view', () => {
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    expect(result.current.hubVisible).toBe(false);
    act(() => result.current.openHub());
    expect(result.current.hubVisible).toBe(true);
  });

  it('closeHub stops playback', () => {
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    act(() => result.current.openHub());
    act(() => result.current.closeHub());
    expect(result.current.state.isPlaying).toBe(false);
    expect(result.current.hubOpen).toBe(false);
  });

  it('startLiveDemo transitions to live view', async () => {
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    const lesson = makeLesson({ initialTab: 'scenarios' });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      await result.current.startLiveDemo();
    });
    expect(result.current.state.view).toBe('live');
    expect(result.current.state.stepIndex).toBe(0);
  });

  it('startLiveDemo does nothing without a selected lesson', async () => {
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    await act(async () => {
      await result.current.startLiveDemo();
    });
    expect(result.current.state.view).toBe('domains');
  });

  it('exitLiveDemo returns to concept view', async () => {
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    const lesson = makeLesson({ initialTab: 'scenarios' });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      await result.current.startLiveDemo();
    });
    await act(async () => {
      await result.current.exitLiveDemo();
    });
    expect(result.current.state.view).toBe('concept');
    expect(result.current.state.isPlaying).toBe(false);
  });

  it('restartDemo is exposed on the hook; setSpeed and prevStep are not', () => {
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    expect(typeof result.current.restartDemo).toBe('function');
    const hub = result.current as Record<string, unknown>;
    expect(hub['setSpeed']).toBeUndefined();
    expect(hub['prevStep']).toBeUndefined();
  });

  it('startLiveDemo navigates to initialTab', async () => {
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    const lesson = makeLesson({ initialTab: 'websocket-studio' });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      await result.current.startLiveDemo();
    });
    expect(navigateToTab).toHaveBeenCalledWith('websocket-studio');
  });

  it('exitLiveDemo runs cleanup if defined', async () => {
    const cleanup = vi.fn();
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    const lesson = makeLesson({ cleanup });
    act(() => result.current.selectLesson(lesson));
    await act(async () => {
      await result.current.startLiveDemo();
    });
    await act(async () => {
      await result.current.exitLiveDemo();
    });
    expect(cleanup).toHaveBeenCalled();
  });

  it('skipReading does not throw when no reading phase is active', () => {
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    expect(() => result.current.skipReading()).not.toThrow();
  });

  it('goBack from domains view is a no-op', () => {
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    expect(result.current.state.view).toBe('domains');
    act(() => result.current.goBack());
    expect(result.current.state.view).toBe('domains');
  });

  it('stepPhase starts as done', () => {
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    expect(result.current.stepPhase).toBe('done');
  });

  it('nextStep does nothing without selected lesson', () => {
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    act(() => { result.current.nextStep(); });
    expect(result.current.state.view).toBe('domains');
  });

  it('goToStep does nothing without selected lesson', async () => {
    const { result } = renderHook(() => useDemoHub({ navigateToTab }));
    await act(async () => { await result.current.goToStep(1); });
    expect(result.current.state.view).toBe('domains');
  });

});

