import { describe, expect, it, vi, beforeEach } from 'vitest';

const start = vi.fn();
const stop = vi.fn();
const loadWorkspace = vi.fn();

vi.mock('../../api-mock/apiMockControlClient', () => ({
  apiMockControlClient: {
    start: (...args: unknown[]) => start(...args),
    stop: (...args: unknown[]) => stop(...args),
  },
}));

vi.mock('../../api-mock/apiMockPersistence', () => ({
  loadApiMockWorkspace: (...args: unknown[]) => loadWorkspace(...args),
}));

import { applyApiMockFixtureBaseUrl, setupApiMockFixture, teardownApiMockFixture } from './apiMockTestFixture';
import { DEFAULT_SETTINGS, createDefaultResponse } from '../../../shared/api-mock/defaults';
import { makeScenario } from '../../../test-utils/factories';

const ts = '2026-08-12T00:00:00.000Z';

describe('apiMockTestFixture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadWorkspace.mockResolvedValue({
      servers: [{
        id: 'srv-1', name: 'Users', enabled: true, host: '127.0.0.1', port: 4600, basePath: '',
        folders: [], variables: [], samples: [],
        routes: [{
          id: 'r1', name: 'Hello', enabled: true, method: 'GET',
          path: { kind: 'exact', value: '/hello' }, priority: 10,
          predicates: { id: 'pg', combinator: 'all', children: [] },
          responseMode: 'rules', responses: [createDefaultResponse('resp-1')],
          tags: [], createdAt: ts, updatedAt: ts,
        }],
        settings: { ...DEFAULT_SETTINGS }, createdAt: ts, updatedAt: ts,
      }],
      activeServerId: 'srv-1',
    });
    start.mockResolvedValue({
      ok: true,
      data: { serverId: 'srv-1__run_run1', port: 4600, state: 'running', generation: 1 },
    });
    stop.mockResolvedValue({ ok: true, data: { serverId: 'srv-1__run_run1', port: 4600, state: 'stopped', generation: 1 } });
  });

  it('starts an isolated fixture and tears it down', async () => {
    const setup = await setupApiMockFixture({
      enabled: true,
      serverId: 'srv-1',
      isolateRun: true,
    }, 'run1');
    expect(setup.ok).toBe(true);
    if (!setup.ok) return;
    expect(setup.handle.serverId).toBe('srv-1__run_run1');
    expect(start).toHaveBeenCalled();
    await teardownApiMockFixture(setup.handle);
    expect(stop).toHaveBeenCalled();
  });

  it('rewrites scenario hosts to the mock base URL', () => {
    const scenarios = [makeScenario({ url: 'https://api.example.com/v1/users' })];
    const rewritten = applyApiMockFixtureBaseUrl(scenarios, 'http://127.0.0.1:4600');
    expect(rewritten[0].url).toContain('127.0.0.1:4600');
  });

  it('returns error when fixture is disabled', async () => {
    const result = await setupApiMockFixture({ enabled: false, serverId: 'srv-1' }, 'run1');
    expect(result).toEqual({ ok: false, error: 'API Mock fixture disabled' });
    expect(start).not.toHaveBeenCalled();
  });

  it('returns error when server definition cannot be resolved', async () => {
    const result = await setupApiMockFixture({ enabled: true, serverId: 'missing' }, 'run1');
    expect(result).toEqual({ ok: false, error: 'Mock server "missing" not found in workspace' });
    expect(start).not.toHaveBeenCalled();
  });

  it('returns error when mock server start fails', async () => {
    start.mockResolvedValueOnce({
      ok: false,
      error: { title: 'Port busy', message: '4600 already in use' },
    });
    const result = await setupApiMockFixture({ enabled: true, serverId: 'srv-1' }, 'run1');
    expect(result).toEqual({ ok: false, error: 'Port busy: 4600 already in use' });
  });

  it('passes fixed port override to resolver', async () => {
    await setupApiMockFixture({
      enabled: true,
      serverId: 'srv-1',
      portMode: 'fixed',
      port: 4700,
    }, 'run1');
    expect(start).toHaveBeenCalledWith(expect.objectContaining({ port: 4700 }));
  });

  it('skips teardown when config requests teardown none', async () => {
    const setup = await setupApiMockFixture({ enabled: true, serverId: 'srv-1' }, 'run1');
    expect(setup.ok).toBe(true);
    if (!setup.ok) return;
    await teardownApiMockFixture(setup.handle, { enabled: true, serverId: 'srv-1', teardown: 'none' });
    expect(stop).not.toHaveBeenCalled();
  });

  it('no-ops teardown when handle is undefined', async () => {
    await teardownApiMockFixture(undefined);
    expect(stop).not.toHaveBeenCalled();
  });

  it('leaves scenario URLs unchanged when mock base URL is empty', () => {
    const scenarios = [makeScenario({ url: 'https://api.example.com/v1/users' })];
    const rewritten = applyApiMockFixtureBaseUrl(scenarios, '');
    expect(rewritten[0].url).toBe('https://api.example.com/v1/users');
  });

  it('rewrites relative scenario URLs via replaceHost', () => {
    const scenarios = [makeScenario({ url: '/v1/users' })];
    const rewritten = applyApiMockFixtureBaseUrl(scenarios, 'http://127.0.0.1:4600');
    expect(rewritten[0].url).toBe('http://127.0.0.1:4600/v1/users');
  });

  it('prefixes mock base path when scenario path lacks it', () => {
    const scenarios = [makeScenario({ url: 'https://api.example.com/users' })];
    const rewritten = applyApiMockFixtureBaseUrl(scenarios, 'http://127.0.0.1:4600/mock');
    expect(rewritten[0].url).toBe('http://127.0.0.1:4600/mock/users');
  });

  it('keeps pathname when scenario already includes mock base path', () => {
    const scenarios = [makeScenario({ url: 'https://api.example.com/mock/users' })];
    const rewritten = applyApiMockFixtureBaseUrl(scenarios, 'http://127.0.0.1:4600/mock');
    expect(rewritten[0].url).toBe('http://127.0.0.1:4600/mock/users');
  });

  it('skips base-path rewrite when mock base path is root', () => {
    const scenarios = [makeScenario({ url: 'https://api.example.com/users' })];
    const rewritten = applyApiMockFixtureBaseUrl(scenarios, 'http://127.0.0.1:4600/');
    expect(rewritten[0].url).toBe('http://127.0.0.1:4600/users');
  });

  it('returns original URL when mock base URL is invalid', () => {
    const scenarios = [makeScenario({ url: 'https://api.example.com/v1/users' })];
    const rewritten = applyApiMockFixtureBaseUrl(scenarios, 'not-a-valid-url');
    expect(rewritten[0].url).toBe('https://api.example.com/v1/users');
  });
});
