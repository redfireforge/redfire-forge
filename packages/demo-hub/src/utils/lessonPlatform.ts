import { isTauri } from '@shared/utils/platform';
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

/**
 * True when a Docker-dependent lesson is being viewed in a hosted web environment.
 * In this case the PrerequisiteGate should be replaced with DesktopOnlyGate
 * because users cannot run local Docker backends against a cloud-hosted demo.
 *
 * Localhost / 127.0.0.1 / ::1 are treated as local dev — Docker lessons run
 * normally there since the developer can spin up Docker on their own machine.
 */
export function isDockerLessonBlockedOnWeb(lesson: DemoLesson): boolean {
  if (isGql13E2eDesktopShim()) return false;
  if (isTauri()) return false;

  // On localhost, Docker is available — let PrerequisiteGate handle it normally
  if (typeof window !== 'undefined') {
    const { hostname } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return false;
    }
  }

  return Boolean(
    lesson.dockerEndpoint || (lesson.dockerEndpoints && lesson.dockerEndpoints.length > 0),
  );
}
