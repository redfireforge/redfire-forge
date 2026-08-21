import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadWorkspace = vi.fn();
const list = vi.fn();
const status = vi.fn();
const isTauri = vi.fn(() => false);

vi.mock('../../api-mock/apiMockPersistence', () => ({
  loadApiMockWorkspace: (...args: unknown[]) => loadWorkspace(...args),
}));

vi.mock('../../api-mock/apiMockControlClient', () => ({
  apiMockControlClient: {
    list: (...args: unknown[]) => list(...args),
    status: (...args: unknown[]) => status(...args),
  },
}));

vi.mock('../../../shared/utils/platform', () => ({
  isTauri: () => isTauri(),
}));

import {
  fixtureServerLabel,
  fixtureServerStatusLabel,
  loadApiMockFixtureServers,
  loadListenerStates,
} from './apiMockFixtureServers';

describe('apiMockFixtureServers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isTauri.mockReturnValue(false);
  });

  it('formats name, port, and status labels', () => {
    expect(fixtureServerLabel({ name: 'MS1', port: 4801 })).toBe('MS1 (:4801)');
    expect(fixtureServerStatusLabel('running')).toBe('Running');
    expect(fixtureServerStatusLabel('stopped')).toBe('Stopped');
  });

  it('marks listed listeners running and others stopped', async () => {
    loadWorkspace.mockResolvedValue({
      servers: [
        { id: 'srv-a', name: 'MS1', port: 4801 },
        { id: 'srv-b', name: 'MS2', port: 4600 },
      ],
    });
    list.mockResolvedValue({
      ok: true,
      data: [{ serverId: 'srv-b', state: 'running', port: 4600, generation: 1 }],
    });

    await expect(loadApiMockFixtureServers()).resolves.toEqual([
      { id: 'srv-a', name: 'MS1', port: 4801, status: 'stopped' },
      { id: 'srv-b', name: 'MS2', port: 4600, status: 'running' },
    ]);
  });

  it('treats a failed list as all stopped', async () => {
    loadWorkspace.mockResolvedValue({
      servers: [{ id: 'srv-a', name: 'MS1', port: 4801 }],
    });
    list.mockResolvedValue({ ok: false, error: { message: 'down' } });

    await expect(loadApiMockFixtureServers()).resolves.toEqual([
      { id: 'srv-a', name: 'MS1', port: 4801, status: 'stopped' },
    ]);
  });

  it('returns an empty list when the workspace has no servers', async () => {
    loadWorkspace.mockResolvedValue({ servers: [] });
    await expect(loadApiMockFixtureServers()).resolves.toEqual([]);
    expect(list).not.toHaveBeenCalled();
  });

  it('uses per-server status on Tauri', async () => {
    isTauri.mockReturnValue(true);
    status
      .mockResolvedValueOnce({ ok: true, data: { state: 'running' } })
      .mockResolvedValueOnce({ ok: false });

    const states = await loadListenerStates(['srv-a', 'srv-b']);
    expect(states.get('srv-a')).toBe('running');
    expect(states.get('srv-b')).toBe('stopped');
    expect(list).not.toHaveBeenCalled();
  });
});
