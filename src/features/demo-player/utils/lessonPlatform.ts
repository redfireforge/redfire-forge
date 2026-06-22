import { isTauri } from '../../../shared/utils/platform';
import type { DemoLesson } from '../types';

/** Playwright GQL-13 E2E sets this flag to exercise desktop mock flows in Chromium. */
function isGql13E2eDesktopShim(): boolean {
  return typeof window !== 'undefined'
    && (window as unknown as Record<string, unknown>).__RF_E2E_MOCK_DESKTOP__ === true;
}

/** True when a desktop-only lesson cannot be started in the current runtime. */
export function isLessonDesktopOnlyBlocked(lesson: DemoLesson): boolean {
  if (isGql13E2eDesktopShim()) return false;
  return Boolean(lesson.desktopOnly) && !isTauri();
}
