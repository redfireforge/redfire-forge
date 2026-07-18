import { describe, it, expect, vi } from 'vitest';

// Both upgraders return a document WITHOUT an `openapi` field so the adapter's
// version-fallback branch (target-derived default) is exercised deterministically.
vi.mock('@scalar/openapi-upgrader/2.0-to-3.0', () => ({
  upgradeFromTwoToThree: () => ({ info: { title: 't', version: '1' } }),
}));
vi.mock('@scalar/openapi-upgrader', () => ({
  upgrade: () => ({ info: { title: 't', version: '1' } }),
}));

import { runScalarUpgrade } from './scalarEngine';

describe('scalarEngine.runScalarUpgrade — version fallback', () => {
  it('defaults to 3.0.3 when the 2.0→3.0 upgrader omits openapi', async () => {
    const out = await runScalarUpgrade({ swagger: '2.0' }, '3.0');
    expect(out.openapiVersion).toBe('3.0.3');
  });

  it('defaults to 3.1.1 when the root upgrader omits openapi', async () => {
    const out = await runScalarUpgrade({ swagger: '2.0' }, '3.1');
    expect(out.openapiVersion).toBe('3.1.1');
  });

  it('defaults to 3.2.0 when the root upgrader omits openapi (3.2 target)', async () => {
    const out = await runScalarUpgrade({ openapi: '3.1.0' }, '3.2');
    expect(out.openapiVersion).toBe('3.2.0');
  });
});

describe('scalarEngine.runScalarUpgrade — corrects the upstream "3.0.4" bug', () => {
  it('overwrites the real @scalar/openapi-upgrader hardcoded "3.0.4" with the canonical 3.0.3', async () => {
    vi.doMock('@scalar/openapi-upgrader/2.0-to-3.0', () => ({
      // Reproduces the actual upstream behavior: upgradeFromTwoToThree unconditionally
      // sets `openapi: '3.0.4'`, which is not a real published OpenAPI version.
      upgradeFromTwoToThree: () => ({ openapi: '3.0.4', info: { title: 't', version: '1' } }),
    }));
    vi.resetModules();
    const { runScalarUpgrade: freshRunScalarUpgrade } = await import('./scalarEngine');

    const out = await freshRunScalarUpgrade({ swagger: '2.0' }, '3.0');

    expect(out.openapiVersion).toBe('3.0.3');
    expect(out.openapi.openapi).toBe('3.0.3');
  });
});
