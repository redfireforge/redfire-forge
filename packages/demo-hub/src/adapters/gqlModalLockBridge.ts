/** Demo-player bridge: lock GraphQL Studio connection-bar modals per lesson step. */

import { getDemoBridgeWindow } from './bridgeWindow';

export interface GqlModalLockState {
  envAllowed: boolean;
  profileAllowed: boolean;
}

export const GQL_MODAL_LOCK_OPEN: GqlModalLockState = {
  envAllowed: true,
  profileAllowed: true,
};

export interface GqlModalLockStepHints {
  id?: string;
  highlight?: string;
  verify?: string;
}

/** First step id per lesson after which the Profiles bookmark stays unlocked. */
export const LESSON_PROFILE_INTRO_STEP_ID: Record<string, string> = {
  'gql-auth-headers': 'gql6-profile',
  'gql-multi-tab': 'gql14-profiles-save',
};

/** First step id per lesson after which the Env badge stays unlocked for the session. */
export const LESSON_ENV_INTRO_STEP_ID: Record<string, string> = {
  'gql-auth-headers': 'gql6-env',
};

function combinedSelectorHints(highlight?: string, verify?: string): string {
  return `${highlight ?? ''} ${verify ?? ''}`;
}

function hintsAllowEnv(highlight?: string, verify?: string): boolean {
  const hints = combinedSelectorHints(highlight, verify);
  return hints.includes('gql-env-badge') || hints.includes('gql-env-modal');
}

function hintsAllowProfile(highlight?: string, verify?: string): boolean {
  const hints = combinedSelectorHints(highlight, verify);
  return hints.includes('gql-profile-badge') || hints.includes('gql-profile-modal');
}

export function getProfileIntroStepIndex(
  lessonId: string,
  steps: ReadonlyArray<{ id?: string }>,
): number {
  const introId = LESSON_PROFILE_INTRO_STEP_ID[lessonId];
  if (!introId) return -1;
  return steps.findIndex((s) => s.id === introId);
}

export function getEnvIntroStepIndex(
  lessonId: string,
  steps: ReadonlyArray<{ id?: string }>,
): number {
  const introId = LESSON_ENV_INTRO_STEP_ID[lessonId];
  if (!introId) return -1;
  return steps.findIndex((s) => s.id === introId);
}

/** Only the step's spotlight target may open its modal during a live demo. */
export function resolveGqlModalLockForStepHighlight(highlight?: string): GqlModalLockState {
  return resolveGqlModalLockForStep({ highlight });
}

/** Resolve Env / Profiles modal lock from step spotlight, verify selector, and step id. */
export function resolveGqlModalLockForStep(step: GqlModalLockStepHints): GqlModalLockState {
  const { id, highlight, verify } = step;
  if (!highlight && !verify && !id) {
    return { envAllowed: false, profileAllowed: false };
  }
  return {
    envAllowed: hintsAllowEnv(highlight, verify),
    profileAllowed: hintsAllowProfile(highlight, verify),
  };
}

export interface ResolveGqlModalLockForLessonStepOptions {
  step: GqlModalLockStepHints;
  lessonId?: string;
  stepIndex?: number;
  steps?: ReadonlyArray<{ id?: string }>;
  /** True once the viewer reached the profile-save step in this live session. */
  profilesIntroducedInSession?: boolean;
  /** True once the viewer reached the env-setup step in this live session. */
  envIntroducedInSession?: boolean;
}

/**
 * Lesson-aware lock: Env and Profiles stay clickable throughout live demos so viewers
 * can inspect variables and connection profiles at any time.
 */
export function resolveGqlModalLockForLessonStep(
  _options: ResolveGqlModalLockForLessonStepOptions,
): GqlModalLockState {
  return GQL_MODAL_LOCK_OPEN;
}

export function readGqlModalLockState(): GqlModalLockState {
  return getDemoBridgeWindow().__demoGqlModalLockState ?? GQL_MODAL_LOCK_OPEN;
}

export function normalizeGqlModalLockForPublish(_lock: GqlModalLockState): GqlModalLockState {
  return GQL_MODAL_LOCK_OPEN;
}

export function syncGqlModalLock(lock: GqlModalLockState): void {
  const normalized = normalizeGqlModalLockForPublish(lock);
  const w = getDemoBridgeWindow();
  w.__demoGqlModalLockState = normalized;
  w.__demoSetGqlModalLock?.(normalized);
}

/** Lesson automation: open Profiles modal without clicking the (possibly disabled) badge. */
export function openGqlProfileModal(): boolean {
  return getDemoBridgeWindow().__demoOpenGqlProfileModal?.() ?? false;
}
