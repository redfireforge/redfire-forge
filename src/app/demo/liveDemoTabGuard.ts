import type { DemoHubLessonRef } from './demoHubApi';

/**
 * Whether switching to `tab` during live mode should tear down the demo overlay.
 * Returns false for same-tab re-selection (e.g. workflow sidebar pick) and for
 * lesson-declared initial/allowed tabs.
 */
export function shouldExitLiveDemoForTabChange(
  tab: string,
  activeTab: string,
  lesson: DemoHubLessonRef | null | undefined,
): boolean {
  if (tab === activeTab) return false;
  if (lesson?.initialTab === tab) return false;
  if (lesson?.allowedTabs?.includes(tab)) return false;
  return true;
}
