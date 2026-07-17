import { describe, it, expect, vi } from 'vitest';
import { createRfContext, runScript, NoOpStore } from './preRequestScriptRunner';

describe('preRequestScriptRunner — coverage gaps', () => {
  it('capture stringifies circular objects without throwing', async () => {
    const { rf, getLogs } = createRfContext({
      envSnapshot: {},
      persistEnv: vi.fn(),
      collectionVarsSnapshot: {},
      mutableHeaders: {},
      store: new Map(),
      operation: { name: 'Q', type: 'query', variables: {} },
    });
    const circular: Record<string, unknown> = { a: 1 };
    circular.self = circular;
    rf.log(circular);
    expect(getLogs()[0]?.message).toContain('[object Object]');
  });

  it('runScript throws non-Error parse failures as Error', async () => {
    const { rf } = createRfContext({
      envSnapshot: {},
      persistEnv: vi.fn(),
      collectionVarsSnapshot: {},
      mutableHeaders: {},
      store: new Map(),
      operation: { name: 'Q', type: 'query', variables: {} },
    });
    await expect(runScript('const x = {{{', rf, 1000)).rejects.toBeInstanceOf(Error);
  });

  it('NoOpStore set returns this for chaining', () => {
    const store = new NoOpStore();
    expect(store.set('k', 1)).toBe(store);
  });
});
