import { describe, it, expect } from 'vitest';
import { resolveStoredAuthForPanel, resolveUsesPageDefaultAuth } from './graphqlStudioPagePanelAuth';

describe('resolveUsesPageDefaultAuth', () => {
  it('returns true for a single tab without overrides or profile link', () => {
    expect(resolveUsesPageDefaultAuth(1, false, false)).toBe(true);
  });

  it('returns false when multiple tabs exist', () => {
    expect(resolveUsesPageDefaultAuth(2, false, false)).toBe(false);
  });

  it('returns false when tab auth override is active', () => {
    expect(resolveUsesPageDefaultAuth(1, true, false)).toBe(false);
  });
});

describe('resolveStoredAuthForPanel', () => {
  it('returns page auth when using page defaults', () => {
    const pageAuth = { type: 'none' as const };
    expect(resolveStoredAuthForPanel(true, pageAuth, false, null, null)).toBe(pageAuth);
  });

  it('prefers explicit tab auth over linked profile auth', () => {
    const tabAuth = { type: 'bearer' as const, token: 'tab' };
    const profileAuth = { type: 'bearer' as const, token: 'profile' };
    expect(resolveStoredAuthForPanel(false, null, true, tabAuth, profileAuth)).toBe(tabAuth);
  });

  it('falls back to linked profile auth when tab auth is undefined', () => {
    const profileAuth = { type: 'bearer' as const, token: 'profile' };
    expect(resolveStoredAuthForPanel(false, null, false, undefined, profileAuth)).toBe(profileAuth);
  });
});
