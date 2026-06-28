import { describe, it, expect } from 'vitest';
import { resolveStudioResponsePaneState } from './graphqlStudioPageResponsePane';

describe('resolveStudioResponsePaneState', () => {
  const base = {
    response: { data: { hello: 'world' } } as never,
    execStatus: 'success' as const,
    executing: false,
  };

  it('returns base state when batch is not executing on the active tab', () => {
    expect(
      resolveStudioResponsePaneState(base, false, 'tab-1', new Set(['tab-1'])),
    ).toEqual(base);
  });

  it('forces loading state when batch is executing on the active tab', () => {
    expect(
      resolveStudioResponsePaneState(base, true, 'tab-1', new Set(['tab-1'])),
    ).toEqual({ response: null, execStatus: 'loading', executing: true });
  });

  it('returns base state when active tab is not in the batch set', () => {
    expect(
      resolveStudioResponsePaneState(base, true, 'tab-2', new Set(['tab-1'])),
    ).toEqual(base);
  });
});
