import { describe, expect, it, vi } from 'vitest';
import {
  isolateApiMockServerId,
  resolveApiMockDefinition,
  resolveStartOptions,
} from './apiMockWorkflowDefinitionResolver';
import { DEFAULT_SETTINGS, createDefaultResponse } from '../../../shared/api-mock/defaults';

const ts = '2026-08-12T00:00:00.000Z';

function makeServer(id = 'srv-1') {
  return {
    id,
    name: 'Users',
    enabled: true,
    host: '127.0.0.1',
    port: 4600,
    basePath: '',
    folders: [],
    variables: [],
    samples: [],
    routes: [{
      id: 'r1',
      name: 'Hello',
      enabled: true,
      method: 'GET' as const,
      path: { kind: 'exact' as const, value: '/hello' },
      priority: 10,
      predicates: { id: 'pg', combinator: 'all' as const, children: [] },
      responseMode: 'rules' as const,
      responses: [createDefaultResponse('resp-1')],
      tags: [],
      createdAt: ts,
      updatedAt: ts,
    }],
    settings: { ...DEFAULT_SETTINGS },
    createdAt: ts,
    updatedAt: ts,
  };
}

describe('apiMockWorkflowDefinitionResolver', () => {
  it('isolates server ids', () => {
    expect(isolateApiMockServerId('srv-1', 'exec-abc!')).toBe('srv-1__run_exec-abc');
  });

  it('loads workspace definition with port override + isolation', async () => {
    const loadWorkspace = vi.fn(async () => ({ servers: [makeServer()], activeServerId: 'srv-1' }));
    const resolved = await resolveApiMockDefinition({
      serverId: 'srv-1',
      portOverride: 4700,
      isolateRun: true,
      runId: 'run1',
      loadWorkspace,
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.definition.port).toBe(4700);
    expect(resolved.definition.id).toBe('srv-1__run_run1');
    expect(resolved.workspaceServerId).toBe('srv-1');
  });

  it('fails when server is missing', async () => {
    const resolved = await resolveApiMockDefinition({
      serverId: 'missing',
      loadWorkspace: async () => ({ servers: [] }),
    });
    expect(resolved.ok).toBe(false);
  });

  it('rejects empty server ids and invalid definitions', async () => {
    expect(await resolveApiMockDefinition({ serverId: '  ' })).toEqual({
      ok: false,
      error: 'serverId is required',
    });

    const invalid = makeServer('bad');
    invalid.name = '';
    const resolved = await resolveApiMockDefinition({
      serverId: 'bad',
      loadWorkspace: async () => ({ servers: [invalid] }),
    });
    expect(resolved.ok).toBe(false);
    if (resolved.ok) return;
    expect(resolved.error.length).toBeGreaterThan(0);
  });

  it('skips invalid port overrides and run isolation when disabled', async () => {
    const resolved = await resolveApiMockDefinition({
      serverId: 'srv-1',
      portOverride: 80,
      isolateRun: false,
      runId: 'run1',
      loadWorkspace: async () => ({ servers: [makeServer()] }),
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.definition.port).toBe(4600);
    expect(resolved.definition.id).toBe('srv-1');
  });

  it('uses a fallback run token when the run id sanitizes to empty', () => {
    expect(isolateApiMockServerId('srv-1', '!!!')).toBe('srv-1__run_run');
  });

  it('maps start node options with defaults', () => {
    expect(resolveStartOptions({ label: 'Start', serverId: 'srv-1' })).toEqual({
      serverId: 'srv-1',
      portOverride: undefined,
      isolateRun: true,
    });
    expect(resolveStartOptions({
      label: 'Start',
      serverId: 'srv-1',
      portOverride: 4700,
      isolateRun: false,
    })).toEqual({
      serverId: 'srv-1',
      portOverride: 4700,
      isolateRun: false,
    });
  });
});
