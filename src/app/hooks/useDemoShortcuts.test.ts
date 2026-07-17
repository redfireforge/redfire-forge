/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDemoShortcuts } from './useDemoShortcuts';
import type { Tab } from '../utils/appTabUtils';
import type { StepPhase } from '@redfireforge/demo-hub/types';
import { lessonNotesPanelOpenRef } from '@redfireforge/demo-hub/LessonNotesContext';

function makeDemoHub(overrides: Partial<{
  state: { view: string; selectedLesson?: { initialTab?: string } | null };
  stepPhase: StepPhase;
  exitLiveDemo: () => void;
  nextStep: () => void;
  toggleAutoPlay: () => void;
}> = {}) {
  return {
    state: {
      view: 'domains',
      selectedLesson: null,
    },
    stepPhase: 'done' as StepPhase,
    exitLiveDemo: vi.fn(),
    nextStep: vi.fn(),
    toggleAutoPlay: vi.fn(),
    ...overrides,
  };
}

describe('useDemoShortcuts', () => {
  let activeTab: Tab;
  let setActiveTab: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    activeTab = 'demo-hub' as Tab;
    setActiveTab = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers keydown listener on mount', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const hub = makeDemoHub();
    renderHook(() => useDemoShortcuts(hub, activeTab, setActiveTab));
    expect(addSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('removes keydown listener on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const hub = makeDemoHub();
    const { unmount } = renderHook(() => useDemoShortcuts(hub, activeTab, setActiveTab));
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('Cmd+Shift+D navigates to demo-hub tab', () => {
    const hub = makeDemoHub();
    renderHook(() => useDemoShortcuts(hub, activeTab, setActiveTab));

    const event = new KeyboardEvent('keydown', {
      key: 'D',
      metaKey: true,
      shiftKey: true,
      bubbles: true,
    });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    window.dispatchEvent(event);

    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(setActiveTab).toHaveBeenCalledWith('demo-hub');
  });

  it('Cmd+Shift+D during live demo navigates to lesson initial tab', () => {
    const hub = makeDemoHub({
      state: { view: 'live', selectedLesson: { initialTab: 'workflow-runner' } },
    });
    renderHook(() => useDemoShortcuts(hub, 'results' as Tab, setActiveTab));

    const event = new KeyboardEvent('keydown', {
      key: 'D',
      metaKey: true,
      shiftKey: true,
      bubbles: true,
    });
    window.dispatchEvent(event);

    expect(setActiveTab).toHaveBeenCalledWith('workflow-runner');
  });

  it('Ctrl+Shift+D navigates to demo-hub tab', () => {
    const hub = makeDemoHub();
    renderHook(() => useDemoShortcuts(hub, activeTab, setActiveTab));

    const event = new KeyboardEvent('keydown', {
      key: 'D',
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
    });
    window.dispatchEvent(event);

    expect(setActiveTab).toHaveBeenCalledWith('demo-hub');
  });

  it('Escape in live mode exits demo and navigates to demo-hub', () => {
    const hub = makeDemoHub({ state: { view: 'live', selectedLesson: { initialTab: 'demo-hub' } } });
    renderHook(() => useDemoShortcuts(hub, 'demo-hub' as Tab, setActiveTab));

    const event = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
    });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    window.dispatchEvent(event);

    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(hub.exitLiveDemo).toHaveBeenCalled();
    expect(setActiveTab).toHaveBeenCalledWith('demo-hub');
  });

  it('ArrowRight in live mode calls nextStep when in reading phase', () => {
    const hub = makeDemoHub({
      state: { view: 'live', selectedLesson: { initialTab: 'demo-hub' } },
      stepPhase: 'reading',
    });
    renderHook(() => useDemoShortcuts(hub, 'demo-hub' as Tab, setActiveTab));

    const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true });
    window.dispatchEvent(event);

    expect(hub.nextStep).toHaveBeenCalled();
  });

  it('ArrowRight in live mode calls nextStep when in done phase', () => {
    const hub = makeDemoHub({
      state: { view: 'live', selectedLesson: { initialTab: 'demo-hub' } },
      stepPhase: 'done',
    });
    renderHook(() => useDemoShortcuts(hub, 'demo-hub' as Tab, setActiveTab));

    const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true });
    window.dispatchEvent(event);

    expect(hub.nextStep).toHaveBeenCalled();
  });

  it('ArrowRight in live mode does NOT call nextStep during action phase', () => {
    const hub = makeDemoHub({
      state: { view: 'live', selectedLesson: { initialTab: 'demo-hub' } },
      stepPhase: 'action',
    });
    renderHook(() => useDemoShortcuts(hub, 'demo-hub' as Tab, setActiveTab));

    const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true });
    window.dispatchEvent(event);

    expect(hub.nextStep).not.toHaveBeenCalled();
  });

  it('ArrowLeft in live mode is no longer handled (back navigation removed)', () => {
    const hub = makeDemoHub({ state: { view: 'live', selectedLesson: { initialTab: 'demo-hub' } } });
    renderHook(() => useDemoShortcuts(hub, 'demo-hub' as Tab, setActiveTab));

    const event = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true });
    window.dispatchEvent(event);

    // Back navigation has been removed — nextStep should not be called either
    expect(hub.nextStep).not.toHaveBeenCalled();
  });

  it('Space in live mode calls toggleAutoPlay when focus is on demo panel', () => {
    const hub = makeDemoHub({ state: { view: 'live', selectedLesson: { initialTab: 'demo-hub' } } });
    renderHook(() => useDemoShortcuts(hub, 'demo-hub' as Tab, setActiveTab));

    document.body.innerHTML = '<div class="demo-live-panel"><button class="demo-live-play-btn">▶</button></div>';
    const btn = document.querySelector('.demo-live-play-btn') as HTMLButtonElement;
    btn.focus();

    const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true });
    Object.defineProperty(event, 'target', { value: btn });
    window.dispatchEvent(event);

    expect(hub.toggleAutoPlay).toHaveBeenCalled();
  });

  it('does not fire shortcuts when target is INPUT', () => {
    const hub = makeDemoHub({ state: { view: 'live', selectedLesson: { initialTab: 'demo-hub' } } });
    renderHook(() => useDemoShortcuts(hub, 'demo-hub' as Tab, setActiveTab));

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    const event = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
    });
    Object.defineProperty(event, 'target', { value: input });
    window.dispatchEvent(event);

    expect(hub.nextStep).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });

  it('does not fire shortcuts when target is TEXTAREA', () => {
    const hub = makeDemoHub({ state: { view: 'live', selectedLesson: { initialTab: 'demo-hub' } } });
    renderHook(() => useDemoShortcuts(hub, 'demo-hub' as Tab, setActiveTab));

    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);

    const event = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
    });
    Object.defineProperty(event, 'target', { value: textarea });
    window.dispatchEvent(event);

    expect(hub.exitLiveDemo).not.toHaveBeenCalled();
    document.body.removeChild(textarea);
  });

  it('does not fire Space play/pause when typing inside Monaco editor', () => {
    const hub = makeDemoHub({ state: { view: 'live', selectedLesson: { initialTab: 'demo-hub' } } });
    renderHook(() => useDemoShortcuts(hub, 'demo-hub' as Tab, setActiveTab));

    document.body.innerHTML = `
      <div class="demo-live-panel"></div>
      <div class="gql-editor-wrapper">
        <div class="monaco-editor focused">
          <div class="native-edit-context" tabindex="0"></div>
        </div>
      </div>
    `;
    const editContext = document.querySelector('.native-edit-context') as HTMLDivElement;
    editContext.focus();

    const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true });
    Object.defineProperty(event, 'target', { value: editContext });
    window.dispatchEvent(event);

    expect(hub.toggleAutoPlay).not.toHaveBeenCalled();
  });

  it('does not fire ArrowRight next-step when Monaco editor is focused', () => {
    const hub = makeDemoHub({
      state: { view: 'live', selectedLesson: { initialTab: 'demo-hub' } },
      stepPhase: 'reading',
    });
    renderHook(() => useDemoShortcuts(hub, 'demo-hub' as Tab, setActiveTab));

    document.body.innerHTML = `
      <div class="monaco-editor">
        <textarea class="inputarea"></textarea>
      </div>
    `;
    const textarea = document.querySelector('textarea.inputarea') as HTMLTextAreaElement;
    textarea.focus();

    const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true });
    Object.defineProperty(event, 'target', { value: document.body });
    window.dispatchEvent(event);

    expect(hub.nextStep).not.toHaveBeenCalled();
  });

  it('ignores keyboard events marked as demo-synthetic (__demoAction=true)', () => {
    const hub = makeDemoHub({ state: { view: 'live', selectedLesson: { initialTab: 'demo-hub' } } });
    renderHook(() => useDemoShortcuts(hub, 'demo-hub' as Tab, setActiveTab));

    // Simulate the ArrowRight event that step 3 (pu-kbd-arrow) dispatches
    const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true });
    (event as KeyboardEvent & { __demoAction?: boolean }).__demoAction = true;
    window.dispatchEvent(event);

    expect(hub.nextStep).not.toHaveBeenCalled();
  });

  it('ignores unrecognized keys in live mode', () => {
    const hub = makeDemoHub({ state: { view: 'live', selectedLesson: { initialTab: 'demo-hub' } } });
    renderHook(() => useDemoShortcuts(hub, 'demo-hub' as Tab, setActiveTab));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(hub.exitLiveDemo).not.toHaveBeenCalled();
    expect(hub.nextStep).not.toHaveBeenCalled();
    expect(hub.toggleAutoPlay).not.toHaveBeenCalled();
  });

  it('live mode shortcuts do nothing when not in live view', () => {
    const hub = makeDemoHub({ state: { view: 'domains' } });
    renderHook(() => useDemoShortcuts(hub, activeTab, setActiveTab));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));

    expect(hub.exitLiveDemo).not.toHaveBeenCalled();
    expect(hub.nextStep).not.toHaveBeenCalled();
    expect(hub.toggleAutoPlay).not.toHaveBeenCalled();
  });

  it('does not exit live demo on Escape while lesson notes panel is open', () => {
    const hub = makeDemoHub({
      state: { view: 'live', selectedLesson: { initialTab: 'workflow' } },
    });
    renderHook(() => useDemoShortcuts(hub, activeTab, setActiveTab));
    lessonNotesPanelOpenRef.current = true;

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(hub.exitLiveDemo).not.toHaveBeenCalled();
    lessonNotesPanelOpenRef.current = false;
  });
});
