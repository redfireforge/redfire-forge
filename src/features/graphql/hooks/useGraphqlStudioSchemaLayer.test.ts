/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGraphqlStudioSchemaLayer } from './useGraphqlStudioSchemaLayer';
import { useGraphqlSchema } from './useGraphqlSchema';
import { loadCachedGraphqlSchemaSdl } from '../utils/graphqlSchemaCache';

const introspectMock = vi.fn();

vi.mock('./useGraphqlSchema', () => ({
  useGraphqlSchema: vi.fn(),
}));

vi.mock('./useGraphqlMockServer', () => ({
  useGraphqlMockServer: vi.fn(() => ({ enabled: false })),
}));

vi.mock('./useGraphqlSchemaSnapshots', () => ({
  useGraphqlSchemaSnapshots: vi.fn(() => ({
    snapshots: [],
    deprecatedUsages: [],
    diffModal: null,
    setDiffModal: vi.fn(),
    schemaDiffToast: null,
    setSchemaDiffToast: vi.fn(),
    toastBaselineSnapshotIdRef: { current: null },
    handleSaveSnapshot: vi.fn(),
    handleDeleteSnapshot: vi.fn(),
    handleClearOlderSnapshots: vi.fn(),
    handleOpenDiff: vi.fn(),
    handleAcknowledge: vi.fn(),
    handleUnacknowledge: vi.fn(),
  })),
}));

vi.mock('../utils/graphqlSchemaCache', () => ({
  loadCachedGraphqlSchemaSdl: vi.fn(() => null),
}));

vi.mock('../utils/monacoGraphqlSetup', () => ({
  setGraphqlSchema: vi.fn(),
  clearGraphqlSchema: vi.fn(),
}));

const mockUseGraphqlSchema = vi.mocked(useGraphqlSchema);
const mockLoadCached = vi.mocked(loadCachedGraphqlSchemaSdl);

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    tabSchemaConnectionId: 'conn-1',
    resolvedTabEndpointForSchema: 'http://localhost:4010/graphql',
    schemaHeaders: {},
    resolvedTabPollingIntervalMs: 0,
    resolvedTabSkipTlsVerify: false,
    resolvedTabTls: {},
    hasPendingProfileEndpoint: false,
    hasActiveTabEndpointOverride: false,
    pageDefaultEndpointResolved: 'http://localhost:4010/graphql',
    historyConnectionId: null,
    collectionTrees: [],
    onIntrospectComplete: vi.fn(),
    ...overrides,
  };
}

describe('useGraphqlStudioSchemaLayer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseGraphqlSchema.mockReturnValue({
      status: 'loaded',
      schemaInfo: { sdl: 'type Query { hello: String }' } as never,
      rawIntrospection: { __schema: { types: [] } },
      errorMessage: null,
      introspecting: false,
      introspect: introspectMock,
      pollErrorMessage: null,
    });
  });

  it('skips introspect when profile endpoint is pending', () => {
    const { result } = renderHook(() =>
      useGraphqlStudioSchemaLayer(baseInput({ hasPendingProfileEndpoint: true })),
    );
    act(() => { result.current.handleIntrospect(); });
    expect(introspectMock).not.toHaveBeenCalled();
  });

  it('calls introspect when profile endpoint is not pending', () => {
    const { result } = renderHook(() =>
      useGraphqlStudioSchemaLayer(baseInput()),
    );
    act(() => { result.current.handleIntrospect(); });
    expect(introspectMock).toHaveBeenCalledOnce();
  });

  it('falls back to cached SDL when live schema is empty', () => {
    mockLoadCached.mockReturnValue('type Query { cached: String }');
    mockUseGraphqlSchema.mockReturnValue({
      status: 'idle',
      schemaInfo: null,
      rawIntrospection: null,
      errorMessage: null,
      introspecting: false,
      introspect: introspectMock,
      pollErrorMessage: null,
    });

    renderHook(() => useGraphqlStudioSchemaLayer(baseInput()));
    expect(mockLoadCached).toHaveBeenCalled();
  });

  it('reuses last live SDL when mock endpoint has no fresh introspection', () => {
    mockUseGraphqlSchema.mockReturnValue({
      status: 'loaded',
      schemaInfo: { sdl: 'type Query { live: String }' } as never,
      rawIntrospection: null,
      errorMessage: null,
      introspecting: false,
      introspect: introspectMock,
      pollErrorMessage: null,
    });

    const { rerender } = renderHook(
      (props) => useGraphqlStudioSchemaLayer(props),
      { initialProps: baseInput({ resolvedTabEndpointForSchema: 'http://localhost:4010/graphql' }) },
    );

    mockUseGraphqlSchema.mockReturnValue({
      status: 'loaded',
      schemaInfo: null,
      rawIntrospection: null,
      errorMessage: null,
      introspecting: false,
      introspect: introspectMock,
      pollErrorMessage: null,
    });

    rerender(baseInput({
      resolvedTabEndpointForSchema: 'mock://local/graphql',
    }));

    expect(mockLoadCached).toHaveBeenCalled();
  });

  it('maps introspection-disabled status to connection bar error', () => {
    mockUseGraphqlSchema.mockReturnValue({
      status: 'introspection-disabled',
      schemaInfo: null,
      rawIntrospection: null,
      errorMessage: 'disabled',
      introspecting: false,
      introspect: introspectMock,
      pollErrorMessage: null,
    });
    const { result } = renderHook(() => useGraphqlStudioSchemaLayer(baseInput()));
    expect(result.current.connectionBarSchemaStatus).toBe('error');
  });

  it('maps connectionBarSchemaStatus for error and none states', () => {
    mockUseGraphqlSchema.mockReturnValue({
      status: 'error',
      schemaInfo: null,
      rawIntrospection: null,
      errorMessage: 'fail',
      introspecting: false,
      introspect: introspectMock,
      pollErrorMessage: null,
    });
    const { result: errResult } = renderHook(() => useGraphqlStudioSchemaLayer(baseInput()));
    expect(errResult.current.connectionBarSchemaStatus).toBe('error');

    mockUseGraphqlSchema.mockReturnValue({
      status: 'idle',
      schemaInfo: null,
      rawIntrospection: null,
      errorMessage: null,
      introspecting: false,
      introspect: introspectMock,
      pollErrorMessage: null,
    });
    const { result: idleResult } = renderHook(() => useGraphqlStudioSchemaLayer(baseInput()));
    expect(idleResult.current.connectionBarSchemaStatus).toBe('none');
  });
});
