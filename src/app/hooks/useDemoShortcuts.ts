import { useEffect, type RefObject } from 'react';
import type { Tab } from '../utils/appTabUtils';
import type { StepPhase } from '../../features/demo-player/types';
import { shouldIgnoreDemoShortcuts, shouldAllowDemoPlayPauseShortcut } from '../../features/demo-player/demoShortcutUtils';

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
    exitLiveDemo: () => void;
    nextStep: () => void;
    toggleAutoPlay: () => void;
  },
  activeTab: Tab,
  setActiveTab: (tab: Tab) => void,
  suppressLiveTabExitRef?: RefObject<boolean>,
) {
  const { view, selectedLesson } = demoHub.state;
  const { exitLiveDemo } = demoHub;

  // Auto-exit live demo when user manually navigates away from the target tab.
  // Lessons that navigate to additional tabs declare them in `allowedTabs` to
  // suppress the auto-exit guard for those destinations.
  useEffect(() => {
    if (view !== 'live' || !selectedLesson?.initialTab) return;
    if (suppressLiveTabExitRef?.current) return;

    const targetTab = selectedLesson.initialTab;
    const allowedTabs = selectedLesson.allowedTabs ?? [];
    if (activeTab === targetTab || allowedTabs.includes(activeTab)) return;
    // startLiveDemo navigates away from demo-hub; a brief stale activeTab here is not a user exit.
    if (activeTab === 'demo-hub' && targetTab !== 'demo-hub') return;

    exitLiveDemo();
  }, [activeTab, view, selectedLesson, exitLiveDemo, suppressLiveTabExitRef]);

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
        setActiveTab('demo-hub');
        return;
      }

      // Live mode shortcuts — never steal Space/→/Esc from editors or form fields.
      if (demoHub.state.view === 'live') {
        switch (e.key) {
          case 'Escape':
            e.preventDefault();
            demoHub.exitLiveDemo();
            setActiveTab('demo-hub');
            break;
          case 'ArrowRight':
            // Only allow skipping to next step during reading or done phases;
            // action/verify/pre phases must not be interrupted by keyboard.
            if (demoHub.stepPhase === 'reading' || demoHub.stepPhase === 'done') {
              e.preventDefault();
              demoHub.nextStep();
            }
            break;
          case ' ':
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
