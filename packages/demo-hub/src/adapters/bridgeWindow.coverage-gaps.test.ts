/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { getDemoBridgeWindow, type DemoBridgeWindow } from './bridgeWindow';

describe('bridgeWindow coverage gaps', () => {
  it('returns window and exposes optional demo bridge slots', () => {
    const bridge: DemoBridgeWindow = getDemoBridgeWindow();
    expect(bridge).toBe(window);

    const openProfile = () => true;
    bridge.__demoOpenGqlProfileModal = openProfile;
    expect(bridge.__demoOpenGqlProfileModal?.()).toBe(true);

    bridge.__demoUpsertWorkspaceDefaults?.({ grpcHost: 'localhost:50051' });
    bridge.__demoRemoveWorkspaceDefaults?.(['grpcHost']);

    delete bridge.__demoOpenGqlProfileModal;
  });
});
