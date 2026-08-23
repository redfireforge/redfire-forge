import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  GQL6_DEMO_GLOBAL_AUTH_PROFILE_ID,
  GQL6_DEMO_GLOBAL_AUTH_PROFILE_NAME,
  purgeGqlDemoGlobalAuthProfilesFromStorage,
} from './gqlDemoGlobalAuthProfiles';

vi.mock('../../../shared/utils/storage', () => ({
  loadGlobalAuthProfiles: vi.fn(),
  saveGlobalAuthProfiles: vi.fn(() => Promise.resolve()),
}));

import { loadGlobalAuthProfiles, saveGlobalAuthProfiles } from '@shared/utils/storage';

describe('gqlDemoGlobalAuthProfiles', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it('removes profiles that match demo id or name', async () => {
    vi.mocked(loadGlobalAuthProfiles).mockResolvedValue([
      { id: 'other', name: 'Prod OAuth', auth: { type: 'oauth2' } },
      { id: GQL6_DEMO_GLOBAL_AUTH_PROFILE_ID, name: GQL6_DEMO_GLOBAL_AUTH_PROFILE_NAME, auth: { type: 'bearer', token: 'a' } },
      { id: 'duplicate-id', name: GQL6_DEMO_GLOBAL_AUTH_PROFILE_NAME, auth: { type: 'bearer', token: 'b' } },
    ]);

    const removed = await purgeGqlDemoGlobalAuthProfilesFromStorage();

    expect(removed).toBe(2);
    expect(saveGlobalAuthProfiles).toHaveBeenCalledWith([
      { id: 'other', name: 'Prod OAuth', auth: { type: 'oauth2' } },
    ]);
  });

  it('is a no-op when no demo profiles exist', async () => {
    vi.mocked(loadGlobalAuthProfiles).mockResolvedValue([
      { id: 'other', name: 'Prod OAuth', auth: { type: 'oauth2' } },
    ]);

    const removed = await purgeGqlDemoGlobalAuthProfilesFromStorage();

    expect(removed).toBe(0);
    expect(saveGlobalAuthProfiles).not.toHaveBeenCalled();
  });
  
  it('accepts an explicit empty spec list and removes nothing', async () => {
    vi.mocked(loadGlobalAuthProfiles).mockResolvedValue([
      { id: GQL6_DEMO_GLOBAL_AUTH_PROFILE_ID, name: GQL6_DEMO_GLOBAL_AUTH_PROFILE_NAME, auth: { type: 'bearer', token: 'a' } },
    ]);
    const removed = await purgeGqlDemoGlobalAuthProfilesFromStorage([]);
    expect(removed).toBe(0);
    expect(saveGlobalAuthProfiles).not.toHaveBeenCalled();
  });
});
