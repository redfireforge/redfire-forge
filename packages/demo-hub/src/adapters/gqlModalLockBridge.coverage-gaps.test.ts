/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import {
  getEnvIntroStepIndex,
  getProfileIntroStepIndex,
  openGqlProfileModal,
  readGqlModalLockState,
  resolveGqlModalLockForLessonStep,
  resolveGqlModalLockForStep,
} from './gqlModalLockBridge';
import { GQL } from '@shared/selectors';

describe('gqlModalLockBridge — coverage gaps', () => {
  it('resolveGqlModalLockForStep locks both when no hints', () => {
    expect(resolveGqlModalLockForStep({})).toEqual({
      envAllowed: false,
      profileAllowed: false,
    });
  });

  it('resolveGqlModalLockForStep allows env from verify selector', () => {
    expect(resolveGqlModalLockForStep({ verify: GQL.ENV_MODAL })).toEqual({
      envAllowed: true,
      profileAllowed: false,
    });
  });

  it('resolveGqlModalLockForStep allows profile from verify selector', () => {
    expect(resolveGqlModalLockForStep({ verify: GQL.PROFILE_MODAL })).toEqual({
      envAllowed: false,
      profileAllowed: true,
    });
  });

  it('getProfileIntroStepIndex returns -1 for unknown lesson', () => {
    expect(getProfileIntroStepIndex('unknown', [{ id: 'a' }])).toBe(-1);
  });

  it('getEnvIntroStepIndex returns index for gql-auth-headers', () => {
    const steps = [{ id: 'gql6-intro' }, { id: 'gql6-env' }];
    expect(getEnvIntroStepIndex('gql-auth-headers', steps)).toBe(1);
  });

  it('resolveGqlModalLockForLessonStep always opens modals', () => {
    expect(resolveGqlModalLockForLessonStep({ step: { id: 'x' } })).toEqual({
      envAllowed: true,
      profileAllowed: true,
    });
  });

  it('readGqlModalLockState falls back to open when bridge unset', () => {
    delete (window as unknown as Record<string, unknown>).__demoGqlModalLockState;
    expect(readGqlModalLockState()).toEqual({ envAllowed: true, profileAllowed: true });
  });

  it('openGqlProfileModal returns false when bridge missing', () => {
    delete (window as unknown as Record<string, unknown>).__demoOpenGqlProfileModal;
    expect(openGqlProfileModal()).toBe(false);
  });
});
