import { describe, it, expect, vi } from 'vitest';

// Simulate a build/bundle failure: importing oas-validator throws. The lint module
// must degrade gracefully (never break conversion).
vi.mock('oas-validator', () => { throw new Error('bundling failed'); });

import { lintOpenApi } from './openApiLint';

describe('lintOpenApi — import failure', () => {
  it('marks the result unavailable when the validator cannot be imported', async () => {
    const r = await lintOpenApi({ openapi: '3.0.3' }, '3.0.4');
    expect(r.unavailable).toBe(true);
    expect(r.supported).toBe(false);
    expect(r.clean).toBe(true);
    expect(r.findings).toEqual([]);
  });
});
