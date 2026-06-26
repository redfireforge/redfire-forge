import { describe, it, expect } from 'vitest';
import {
  GQL_MODAL_LOCK_OPEN,
  resolveGqlModalLockForStepHighlight,
} from './gqlModalLockBridge';
import { GQL } from '@shared/selectors';

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
});
