/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  GQL_MODAL_LOCK_OPEN,
  getEnvIntroStepIndex,
  getProfileIntroStepIndex,
  openGqlProfileModal,
  resolveGqlModalLockForLessonStep,
  resolveGqlModalLockForStep,
  resolveGqlModalLockForStepHighlight,
} from './gqlModalLockBridge';
import { GQL } from '@shared/selectors';

const GQL6_STEPS = [
  { id: 'gql6-intro' },
  { id: 'gql6-env' },
  { id: 'gql6-bearer-config' },
  { id: 'gql6-bearer-observe' },
  { id: 'gql6-apikey-config' },
  { id: 'gql6-apikey-observe' },
  { id: 'gql6-basic-config' },
  { id: 'gql6-basic-observe' },
  { id: 'gql6-oauth' },
  { id: 'gql6-inherit-config' },
  { id: 'gql6-inherit-observe' },
  { id: 'gql6-profile' },
  { id: 'gql6-subscription-exec' },
  { id: 'gql6-subscription-observe' },
];

describe('gqlModalLockBridge', () => {
  it('opens all modals when demo is not restricting', () => {
    expect(GQL_MODAL_LOCK_OPEN).toEqual({ envAllowed: true, profileAllowed: true });
  });

  it('allows only env modal on env badge spotlight', () => {
    expect(resolveGqlModalLockForStepHighlight(GQL.ENV_BADGE)).toEqual({
      envAllowed: true,
      profileAllowed: false,
    });
  });

  it('allows only profile modal on profile badge spotlight', () => {
    expect(resolveGqlModalLockForStepHighlight(GQL.PROFILE_BADGE)).toEqual({
      envAllowed: false,
      profileAllowed: true,
    });
  });

  it('locks both modals when highlight is unrelated', () => {
    expect(resolveGqlModalLockForStepHighlight(GQL.EXECUTE_BTN)).toEqual({
      envAllowed: false,
      profileAllowed: false,
    });
  });

  it('allows profile modal when verify targets the modal', () => {
    expect(resolveGqlModalLockForStep({
      highlight: GQL.EXECUTE_BTN,
      verify: GQL.PROFILE_MODAL,
    })).toEqual({
      envAllowed: false,
      profileAllowed: true,
    });
  });

  it('finds profile intro step index for gql-auth-headers', () => {
    expect(getProfileIntroStepIndex('gql-auth-headers', GQL6_STEPS)).toBe(11);
  });

  it('returns -1 for lessons without a profile intro step', () => {
    expect(getProfileIntroStepIndex('gql-first-query', [{ id: 'intro' }])).toBe(-1);
  });

  it('finds env intro step index for gql-auth-headers', () => {
    expect(getEnvIntroStepIndex('gql-auth-headers', GQL6_STEPS)).toBe(1);
  });

  it('returns -1 for lessons without an env intro step', () => {
    expect(getEnvIntroStepIndex('gql-first-query', [{ id: 'intro' }])).toBe(-1);
  });

  describe('resolveGqlModalLockForLessonStep', () => {
    it('always keeps env and profiles unlocked during live demos', () => {
      expect(resolveGqlModalLockForLessonStep({
        step: { id: 'gql6-intro', highlight: GQL.AUTH_BADGE_BTN },
        lessonId: 'gql-auth-headers',
        stepIndex: 0,
        steps: GQL6_STEPS,
      })).toEqual(GQL_MODAL_LOCK_OPEN);

      expect(resolveGqlModalLockForLessonStep({
        step: { id: 'gql6-bearer-config', highlight: GQL.AUTH_BEARER_INPUT },
        lessonId: 'gql-auth-headers',
        stepIndex: 2,
        steps: GQL6_STEPS,
      })).toEqual(GQL_MODAL_LOCK_OPEN);

      expect(resolveGqlModalLockForLessonStep({
        step: { id: 'gql14-per-tab-auth', highlight: GQL.EXECUTE_BTN },
        lessonId: 'gql-multi-tab',
        stepIndex: 1,
        steps: [{ id: 'gql14-intro' }, { id: 'gql14-per-tab-auth' }],
      })).toEqual(GQL_MODAL_LOCK_OPEN);
    });
  });

  describe('syncGqlModalLock', () => {
    it('always publishes open lock even when caller passes false', async () => {
      const { syncGqlModalLock, normalizeGqlModalLockForPublish } = await import('./gqlModalLockBridge');
      expect(normalizeGqlModalLockForPublish({ envAllowed: false, profileAllowed: false })).toEqual(
        GQL_MODAL_LOCK_OPEN,
      );
      syncGqlModalLock({ envAllowed: false, profileAllowed: false });
      expect((window as unknown as Record<string, unknown>).__demoGqlModalLockState).toEqual(
        GQL_MODAL_LOCK_OPEN,
      );
    });
  });

  describe('openGqlProfileModal', () => {
    beforeEach(() => {
      delete (window as unknown as Record<string, unknown>).__demoOpenGqlProfileModal;
    });

    afterEach(() => {
      delete (window as unknown as Record<string, unknown>).__demoOpenGqlProfileModal;
    });

    it('returns false when bridge is not mounted', () => {
      expect(openGqlProfileModal()).toBe(false);
    });

    it('delegates to window bridge when mounted', () => {
      const open = vi.fn(() => true);
      (window as unknown as Record<string, unknown>).__demoOpenGqlProfileModal = open;
      expect(openGqlProfileModal()).toBe(true);
      expect(open).toHaveBeenCalled();
    });
  });
});
