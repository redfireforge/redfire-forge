import { beforeEach, describe, expect, it, vi } from 'vitest';

const stop = vi.fn();
vi.mock('../../api-mock/apiMockControlClient', () => ({
  apiMockControlClient: {
    stop: (...args: unknown[]) => stop(...args),
  },
}));

import {
  cleanupApiMockServersForRun,
  clearApiMockRunRegistry,
  listApiMockServersForRun,
  registerApiMockServerForRun,
} from './apiMockRunIsolation';

describe('apiMockRunIsolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearApiMockRunRegistry('run-a');
    clearApiMockRunRegistry('run-b');
    stop.mockResolvedValue({ ok: true, data: {} });
  });

  it('isolates server ids per run and cleans them up', async () => {
    registerApiMockServerForRun('run-a', 'srv-a__run_run-a');
    registerApiMockServerForRun('run-b', 'srv-b__run_run-b');
    expect(listApiMockServersForRun('run-a')).toEqual(['srv-a__run_run-a']);

    const cleaned = await cleanupApiMockServersForRun('run-a');
    expect(cleaned.stopped).toEqual(['srv-a__run_run-a']);
    expect(listApiMockServersForRun('run-a')).toEqual([]);
    expect(listApiMockServersForRun('run-b')).toEqual(['srv-b__run_run-b']);
  });

  it('ignores empty registry keys and records stop failures', async () => {
    registerApiMockServerForRun('', 'srv-x');
    registerApiMockServerForRun('run-c', '');
    expect(listApiMockServersForRun('run-c')).toEqual([]);
    expect(listApiMockServersForRun('missing')).toEqual([]);

    registerApiMockServerForRun('run-c', 'srv-c1');
    registerApiMockServerForRun('run-c', 'srv-c2');
    stop.mockResolvedValueOnce({ ok: true, data: {} });
    stop.mockResolvedValueOnce({ ok: false, error: { message: 'not running' } });
    const cleaned = await cleanupApiMockServersForRun('run-c');
    expect(cleaned.stopped).toEqual(['srv-c1']);
    expect(cleaned.errors).toEqual(['srv-c2: not running']);
    expect(listApiMockServersForRun('run-c')).toEqual([]);
  });
});
