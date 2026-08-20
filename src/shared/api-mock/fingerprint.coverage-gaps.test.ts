import { afterEach, describe, expect, it, vi } from 'vitest';
import { computeDefinitionFingerprint } from './fingerprint';
import { DEFAULT_SETTINGS, createDefaultResponse } from './defaults';
import type { ApiMockServerDefinitionV1 } from './contracts';

const ts = '2026-08-12T00:00:00.000Z';

function makeServer(id = 'srv-1'): ApiMockServerDefinitionV1 {
  return {
    id,
    name: 'Test',
    enabled: true,
    host: '127.0.0.1',
    port: 4600,
    basePath: '',
    folders: [],
    routes: [{
      id: 'route-1',
      name: 'Test',
      enabled: true,
      method: 'GET',
      path: { kind: 'exact', value: '/test' },
      priority: 10,
      predicates: { id: 'pg-1', combinator: 'all', children: [] },
      responseMode: 'rules',
      responses: [createDefaultResponse('resp-1')],
      tags: ['tag1'],
      createdAt: ts,
      updatedAt: ts,
    }],
    samples: [],
    variables: [],
    settings: { ...DEFAULT_SETTINGS },
    createdAt: ts,
    updatedAt: ts,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fingerprint coverage gaps', () => {
  it('falls back to sync SHA-256 when webcrypto subtle digest is unavailable', async () => {
    const originalCrypto = globalThis.crypto;
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: { ...originalCrypto, subtle: undefined },
    });

    try {
      const fp = await computeDefinitionFingerprint(makeServer());
      expect(fp).toMatch(/^[0-9a-f]{64}$/);
    } finally {
      Object.defineProperty(globalThis, 'crypto', {
        configurable: true,
        value: originalCrypto,
      });
    }
  });
});
