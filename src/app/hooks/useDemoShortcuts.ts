import { useEffect, type RefObject } from 'react';
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

/**
 * Keyboard shortcuts and auto-exit behaviour for the Demo Hub.
 * Extracted from App.tsx to reduce component size.
 */
export function useDemoShortcuts(
  demoHub: {
    state: {
      view: string;
      selectedLesson?: { initialTab?: string; allowedTabs?: string[] } | null;
    };
    stepPhase: StepPhase;
    exitLiveDemo: () => void | Promise<void>;
    nextStep: () => void;
    toggleAutoPlay: () => void;
  },
  _activeTab: Tab,
  setActiveTab: (tab: Tab) => void,
  _suppressLiveTabExitRef?: RefObject<boolean>,
) {
  // Cmd+Shift+D navigates to Demo Hub tab; live mode shortcuts
  useEffect(() => {
    const handleDemoShortcut = (e: KeyboardEvent) => {
      // Ignore keyboard events that were synthetically dispatched by demo action
      // scripts (e.g. pressKeyOnTab in ws-power-user.ts). Those events are marked
      // with __demoAction=true so the shortcut handler does not confuse them with
      // real user input and accidentally advances/reverses the demo step.
      if ((e as KeyboardEvent & { __demoAction?: boolean }).__demoAction) return;
      if (shouldIgnoreDemoShortcuts(e.target)) return;

      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        // During a live demo the hub body is empty — jump to the lesson tab instead.
        if (demoHub.state.view === 'live') {
          const lessonTab = demoHub.state.selectedLesson?.initialTab;
          if (lessonTab) setActiveTab(lessonTab as Tab);
        } else {
          setActiveTab('demo-hub');
        }
        return;
      }

      // Live mode shortcuts — never steal Space/→/Esc from editors or form fields.
      if (demoHub.state.view === 'live') {
        switch (e.key) {
          case 'Escape':
            if (lessonNotesPanelOpenRef.current) return;
            e.preventDefault();
            setActiveTab('demo-hub');
            void Promise.resolve(demoHub.exitLiveDemo()).finally(() => {
              // Keep final destination stable if lesson cleanup navigates elsewhere.
              setActiveTab('demo-hub');
            });
            break;
          case 'ArrowRight':
            // Next only after the step finishes. Reading / Preparing / Acting /
            // Verifying must complete first (skip reading via the phase badge).
            if (demoHub.stepPhase === 'done') {
              e.preventDefault();
              demoHub.nextStep();
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
            demoHub.toggleAutoPlay();
            break;
        }
      }
    };
    window.addEventListener('keydown', handleDemoShortcut);
    return () => window.removeEventListener('keydown', handleDemoShortcut);
  }, [demoHub, setActiveTab]);
}
