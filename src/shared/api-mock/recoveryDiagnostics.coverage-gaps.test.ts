import { afterEach, describe, expect, it, vi } from 'vitest';
import * as migrationModule from './migration';
import * as validationModule from './validation';
import {
  classifyRuntimeError,
  safeLoadWorkspace,
} from './recoveryDiagnostics';
import { DEFAULT_SETTINGS, createDefaultResponse } from './defaults';
import type { ApiMockWorkspaceV1, ApiMockServerDefinitionV1 } from './contracts';

const ts = '2026-08-12T00:00:00.000Z';

function makeServer(id: string): ApiMockServerDefinitionV1 {
  return {
    id,
    name: `Server ${id}`,
    enabled: true,
    host: '127.0.0.1',
    port: 4600,
    basePath: '',
    folders: [],
    variables: [],
    samples: [],
    routes: [{
      id: `${id}-r1`,
      name: 'Route',
      enabled: true,
      method: 'GET',
      path: { kind: 'exact', value: '/test' },
      priority: 10,
      predicates: { id: 'pg', combinator: 'all', children: [] },
      responseMode: 'rules',
      responses: [createDefaultResponse(`${id}-resp`)],
      tags: [],
      createdAt: ts,
      updatedAt: ts,
    }],
    settings: { ...DEFAULT_SETTINGS },
    createdAt: ts,
    updatedAt: ts,
  };
}

function makeWorkspace(): ApiMockWorkspaceV1 {
  return { schemaVersion: 1, activeServerId: 'a', servers: [makeServer('a')], tabOrder: ['a'] } as ApiMockWorkspaceV1;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('recoveryDiagnostics coverage gaps', () => {
  it('fully classifies owned-port errors', () => {
    const diag = classifyRuntimeError(new Error('Port 4600 is owned by server "srv-a"'));
    expect(diag).toMatchObject({
      code: 'MOCK_PORT_OWNED',
      title: 'Port owned by another server',
      message: 'Port 4600 is owned by server "srv-a"',
      recoverable: true,
      retry: false,
    });
  });

  it('returns a corrupt diagnostic when migration throws', () => {
    vi.spyOn(migrationModule, 'migrateWorkspace').mockImplementation(() => {
      throw new Error('boom');
    });
    const result = safeLoadWorkspace({ schemaVersion: 1, servers: [], tabOrder: [] });
    expect(result.ok).toBe(false);
    expect(result.workspace).toBeUndefined();
    expect(result.diagnostics[0].message).toContain('Workspace migration failed: boom');
  });

  it('returns a corrupt diagnostic when validation throws', () => {
    vi.spyOn(validationModule, 'validateWorkspace').mockImplementation(() => {
      throw new Error('bad validate');
    });
    const result = safeLoadWorkspace(makeWorkspace());
    expect(result.ok).toBe(false);
    expect(result.workspace).toBeUndefined();
    expect(result.diagnostics[0].message).toContain('Workspace validation crashed: bad validate');
  });

  it('returns the migrated workspace when validation reports errors', () => {
    vi.spyOn(validationModule, 'validateWorkspace').mockReturnValue([
      { code: 'AMS-TEST', severity: 'error', path: '/servers/0', message: 'broken' },
    ] as any);
    const result = safeLoadWorkspace(makeWorkspace());
    expect(result.ok).toBe(false);
    expect(result.workspace?.servers).toHaveLength(1);
    expect(result.diagnostics[0].code).toBe('AMS-TEST');
  });
});
