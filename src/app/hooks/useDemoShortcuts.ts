import { useEffect, useRef, type RefObject } from 'react';
import type { Tab } from '../utils/appTabUtils';
import type { StepPhase } from '@redfireforge/demo-hub/types';
import {
  shouldIgnoreDemoShortcuts,
  shouldAllowDemoPlayPauseShortcut,
  hasTypingFocusWithin,
  isMonacoEditorFocused,
  isFocusedMonacoInput,
} from '@redfireforge/demo-hub/demoShortcutUtils';
import { lessonNotesPanelOpenRef } from '@redfireforge/demo-hub/LessonNotesContext';

type DemoHubShortcutState = {
  state: {
    view: string;
    selectedLesson?: { initialTab?: string; allowedTabs?: string[] } | null;
  };
  stepPhase: StepPhase;
  exitLiveDemo: () => void;
  nextStep: () => void;
  toggleAutoPlay: () => void;
};

/**
 * Keyboard shortcuts and auto-exit behaviour for the Demo Hub.
 * Extracted from App.tsx to reduce component size.
 *
 * Uses a ref to hold the latest demoHub handle so the keydown listener is
 * registered only once and never re-triggers React render cycles.
 */
export function useDemoShortcuts(
  demoHub: DemoHubShortcutState,
  _activeTab: Tab,
  setActiveTab: (tab: Tab) => void,
  _suppressLiveTabExitRef?: RefObject<boolean>,
) {
  // Keep the latest hub handle in a ref so the keydown listener stays
  // registered once without depending on the per-render demoHub object.
  const latestDemoHubRef = useRef<DemoHubShortcutState>(demoHub);
  latestDemoHubRef.current = demoHub;

  // Cmd+Shift+D navigates to Demo Hub tab; live mode shortcuts
  useEffect(() => {
    const handleDemoShortcut = (e: KeyboardEvent) => {
      const hub = latestDemoHubRef.current;
      // Ignore keyboard events that were synthetically dispatched by demo action
      // scripts (e.g. pressKeyOnTab in ws-power-user.ts). Those events are marked
      // with __demoAction=true so the shortcut handler does not confuse them with
      // real user input and accidentally advances/reverses the demo step.
      if ((e as KeyboardEvent & { __demoAction?: boolean }).__demoAction) return;
      if (shouldIgnoreDemoShortcuts(e.target)) return;

      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        // During a live demo the hub body is empty — jump to the lesson tab instead.
        if (hub.state.view === 'live') {
          const lessonTab = hub.state.selectedLesson?.initialTab;
          if (lessonTab) setActiveTab(lessonTab as Tab);
        } else {
          setActiveTab('demo-hub');
        }
        return;
      }

      // Live mode shortcuts — never steal Space/→/Esc from editors or form fields.
      if (hub.state.view === 'live') {
        switch (e.key) {
          case 'Escape':
            if (lessonNotesPanelOpenRef.current) return;
            e.preventDefault();
            hub.exitLiveDemo();
            setActiveTab('demo-hub');
            break;
          case 'ArrowRight':
            // Only allow skipping to next step during reading or done phases;
            // action/verify/pre phases must not be interrupted by keyboard.
            if (hub.stepPhase === 'reading' || hub.stepPhase === 'done') {
              e.preventDefault();
              hub.nextStep();
            }
            break;
          case ' ':
            if (
              hasTypingFocusWithin()
              || isMonacoEditorFocused()
              || isFocusedMonacoInput()
            ) {
              return;
            }
            if (
              !shouldAllowDemoPlayPauseShortcut(e.target)
              && !shouldAllowDemoPlayPauseShortcut(document.activeElement)
            ) {
              return;
            }
            e.preventDefault();
            hub.toggleAutoPlay();
            break;
        }
      }
    };
    window.addEventListener('keydown', handleDemoShortcut);
    return () => window.removeEventListener('keydown', handleDemoShortcut);
  }, [setActiveTab]);
}
