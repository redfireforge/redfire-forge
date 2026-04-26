/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach } from 'vitest';
import { supportsWorkers } from './platform';

describe('supportsWorkers', () => {
  const originalWorker = globalThis.Worker;

  afterEach(() => {
    if (originalWorker) {
      globalThis.Worker = originalWorker;
    } else {
      delete (globalThis as unknown as Record<string, unknown>).Worker;
    }
  });

  it('returns true when Worker is defined', () => {
    (globalThis as unknown as Record<string, unknown>).Worker = class {};
    expect(supportsWorkers()).toBe(true);
  });

  it('returns false when Worker is undefined', () => {
    delete (globalThis as unknown as Record<string, unknown>).Worker;
    expect(supportsWorkers()).toBe(false);
  });
});
