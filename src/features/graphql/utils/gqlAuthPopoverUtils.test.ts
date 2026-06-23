import { describe, it, expect } from 'vitest';
import {
  AUTH_TYPE_INHERIT_WORKSPACE,
  AUTH_TYPE_NONE,
  buildAuthTypeOptions,
  popoverShowsAuthOverride,
  storedAuthToPopoverType,
} from './gqlAuthPopoverUtils';

describe('gqlAuthPopoverUtils (Phase 6H Slice 3)', () => {
  it('storedAuthToPopoverType maps tab inherit workspace', () => {
    expect(storedAuthToPopoverType(undefined, 'tab')).toBe(AUTH_TYPE_INHERIT_WORKSPACE);
  });

  it('storedAuthToPopoverType maps page null to No Auth', () => {
    expect(storedAuthToPopoverType(null, 'page')).toBe(AUTH_TYPE_NONE);
    expect(storedAuthToPopoverType(undefined, 'page')).toBe(AUTH_TYPE_NONE);
  });

  it('storedAuthToPopoverType maps tab explicit null to No Auth', () => {
    expect(storedAuthToPopoverType(null, 'tab')).toBe(AUTH_TYPE_NONE);
  });

  it('storedAuthToPopoverType maps inherit-global', () => {
    expect(
      storedAuthToPopoverType({ type: 'inherit', globalProfileId: 'p1' }, 'tab'),
    ).toBe('inherit');
  });

  it('buildAuthTypeOptions includes inherit workspace for tab scope only', () => {
    const tabOpts = buildAuthTypeOptions([], 'tab').map((o) => o.value);
    expect(tabOpts[0]).toBe(AUTH_TYPE_INHERIT_WORKSPACE);
    const pageOpts = buildAuthTypeOptions([], 'page').map((o) => o.value);
    expect(pageOpts[0]).toBe(AUTH_TYPE_NONE);
    expect(pageOpts).not.toContain(AUTH_TYPE_INHERIT_WORKSPACE);
  });

  it('popoverShowsAuthOverride is false for tab inherit workspace', () => {
    expect(popoverShowsAuthOverride(undefined, 'tab')).toBe(false);
    expect(popoverShowsAuthOverride({ type: 'inherit' }, 'tab')).toBe(false);
  });

  it('popoverShowsAuthOverride is true for tab explicit override', () => {
    expect(popoverShowsAuthOverride(null, 'tab')).toBe(true);
    expect(popoverShowsAuthOverride({ type: 'bearer', token: 'x' }, 'tab')).toBe(true);
    expect(
      popoverShowsAuthOverride({ type: 'inherit', globalProfileId: 'p1' }, 'tab'),
    ).toBe(true);
  });
});
