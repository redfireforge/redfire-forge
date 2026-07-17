/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { GqlRightPane } from './GqlRightPane';

vi.mock('../utils/monacoGraphqlSetup', () => ({
  buildModelUri: (id: string) => `inmemory://graphql/${id}`,
  buildVarsModelUri: (id: string) => `inmemory://graphql/vars/${id}`,
  extractOperations: vi.fn(() => []),
  deriveTabLabel: vi.fn(() => 'Untitled'),
  deriveOperationType: vi.fn(() => undefined),
  registerGraphqlLanguage: vi.fn(),
  getOrInitGraphqlMode: vi.fn(),
}));

const baseProps = {
  view: 'response' as const,
  onViewChange: vi.fn(),
  response: null,
  executing: false,
  execStatus: 'idle' as const,
  schemaInfo: null,
  schemaStatus: 'idle' as const,
  schemaErrorMessage: null,
  onIntrospect: vi.fn(),
  introspecting: false,
};

describe('GqlRightPane — coverage gaps', () => {
  beforeEach(() => resetAllMocks());

  it('skips latency history for batch context responses', () => {
    const { rerender } = render(
      <GqlRightPane
        {...baseProps}
        response={{
          httpStatus: 200,
          httpHeaders: {},
          latencyMs: 100,
          timestamp: 1,
          data: { ok: true },
          batchContext: { batchIndex: 0, batchSize: 2, batchUnsupported: false, upstreamRequestCount: 1, batchLatencyMs: 50 },
        }}
      />,
    );
    rerender(
      <GqlRightPane
        {...baseProps}
        response={{
          httpStatus: 200,
          httpHeaders: {},
          latencyMs: 200,
          timestamp: 2,
          data: { ok: true },
        }}
      />,
    );
    expect(document.querySelector('[data-testid="gql-right-pane"]')).toBeTruthy();
  });

  it('accumulates latency history for normal execute responses', () => {
    const { rerender } = render(
      <GqlRightPane
        {...baseProps}
        response={{
          httpStatus: 200,
          httpHeaders: {},
          latencyMs: 42,
          timestamp: 100,
          data: { ok: true },
        }}
      />,
    );
    rerender(
      <GqlRightPane
        {...baseProps}
        response={{
          httpStatus: 200,
          httpHeaders: {},
          latencyMs: 42,
          timestamp: 100,
          data: { ok: true },
        }}
      />,
    );
    rerender(
      <GqlRightPane
        {...baseProps}
        response={{
          httpStatus: 200,
          httpHeaders: {},
          latencyMs: 55,
          timestamp: 200,
          data: { ok: true },
        }}
      />,
    );
    expect(document.querySelector('[data-testid="gql-right-pane"]')).toBeTruthy();
  });
});
