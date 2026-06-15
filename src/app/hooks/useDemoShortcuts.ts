import { useEffect } from 'react';
import type { Tab } from '../utils/appTabUtils';

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
    exitLiveDemo: () => void;
    nextStep: () => void;
    prevStep: () => void;
    toggleAutoPlay: () => void;
  },
  activeTab: Tab,
  setActiveTab: (tab: Tab) => void,
) {
  // Auto-exit live demo when user manually navigates away from the target tab.
  // Lessons that navigate to additional tabs declare them in `allowedTabs` to
  // suppress the auto-exit guard for those destinations.
  useEffect(() => {
    if (demoHub.state.view === 'live' && demoHub.state.selectedLesson?.initialTab) {
      const targetTab = demoHub.state.selectedLesson.initialTab;
      const allowedTabs = demoHub.state.selectedLesson.allowedTabs ?? [];
      if (activeTab !== targetTab && !allowedTabs.includes(activeTab)) {
        demoHub.exitLiveDemo();
      }
    }
  }, [activeTab, demoHub]);

  // Cmd+Shift+D navigates to Demo Hub tab; live mode shortcuts
  useEffect(() => {
    const handleDemoShortcut = (e: KeyboardEvent) => {
      // Ignore keyboard events that were synthetically dispatched by demo action
      // scripts (e.g. pressKeyOnTab in ws-power-user.ts). Those events are marked
      // with __demoAction=true so the shortcut handler does not confuse them with
      // real user input and accidentally advances/reverses the demo step.
      if ((e as KeyboardEvent & { __demoAction?: boolean }).__demoAction) return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setActiveTab('demo-hub');
        return;
      }

      // Live mode shortcuts
      if (demoHub.state.view === 'live') {
        switch (e.key) {
          case 'Escape':
            e.preventDefault();
            demoHub.exitLiveDemo();
            setActiveTab('demo-hub');
            break;
          case 'ArrowRight':
            e.preventDefault();
            demoHub.nextStep();
            break;
          case 'ArrowLeft':
            e.preventDefault();
            demoHub.prevStep();
            break;
          case ' ':
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
