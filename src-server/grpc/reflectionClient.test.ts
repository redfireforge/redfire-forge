/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { GrpcReflectionClient } from './reflectionClient.js';

describe('reflectionClient', () => {
  it('rejects in-process targets before dialing', async () => {
    const client = new GrpcReflectionClient();
    await expect(client.fetchReflectionRoot({
      address: 'in-process:demo',
      timeoutMs: 1000,
    })).rejects.toThrow(/not dialable/);
  });

  it('rejects invalid target addresses', async () => {
    const client = new GrpcReflectionClient();
    await expect(client.fetchReflectionRoot({
      address: 'not-a-target',
      timeoutMs: 1000,
    })).rejects.toThrow(/host:port/);
  });
});
