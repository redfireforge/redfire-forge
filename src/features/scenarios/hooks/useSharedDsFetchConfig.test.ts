/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSharedDsFetchConfig } from './useSharedDsFetchConfig';
import { parseCurl } from '../../../shared/utils/curlParser';
import type { SharedDataSource, DataSource } from '../../../shared/types';

vi.mock('../../../shared/utils/curlParser', () => ({
  parseCurl: vi.fn((input: string) => ({
    url: 'https://parsed.example.com',
    method: 'GET',
    headers: [{ key: 'X-Test', value: 'parsed' }],
    body: undefined,
    bodyType: undefined,
    auth: undefined,
  })),
}));

vi.mock('../utils/dataSourceSetupUtils', () => ({
  buildScenarioFromFetchConfig: vi.fn((_id, _name, cfg, _ds) => ({
    id: _id,
    name: _name,
    url: cfg?.url ?? '',
    method: cfg?.method ?? 'GET',
    headers: [],
    auth: { type: 'none' },
    validation: { mode: 'none' },
    dataSource: _ds,
  })),
}));

function makeSharedDs(overrides: Partial<SharedDataSource> = {}): SharedDataSource {
  return {
    id: 'sds-1',
    name: 'Test DS',
    dataSource: { id: 'dt-1', columns: [], rows: [], source: { type: 'inline' } } as DataSource,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    fetchConfig: {
      url: 'https://api.example.com',
      method: 'GET',
      headers: [{ key: '', value: '' }],
      body: '',
      bodyType: 'none',
      auth: { type: 'none' },
    },
    ...overrides,
  };
}

describe('useSharedDsFetchConfig', () => {
  const sources = [makeSharedDs()];
  let onUpdate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    onUpdate = vi.fn();
  });

  it('initializes curl input from fetchConfig', () => {
    const ds = makeSharedDs({ fetchConfig: { ...sources[0].fetchConfig!, rawCurl: 'curl https://x' } });
    const { result } = renderHook(() => useSharedDsFetchConfig(ds, [ds], onUpdate));
    expect(result.current.curlInput).toBe('curl https://x');
  });

  it('handleFetchConfigChange patches fetch config', () => {
    const { result } = renderHook(() => useSharedDsFetchConfig(sources[0], sources, onUpdate));
    act(() => result.current.handleFetchConfigChange({ url: 'https://new.url' }));
    expect(onUpdate).toHaveBeenCalledTimes(1);
    const updated = onUpdate.mock.calls[0][0];
    expect(updated[0].fetchConfig.url).toBe('https://new.url');
  });

  it('handleFetchHeaderChange updates a specific header', () => {
    const { result } = renderHook(() => useSharedDsFetchConfig(sources[0], sources, onUpdate));
    act(() => result.current.handleFetchHeaderChange(0, 'key', 'Authorization'));
    expect(onUpdate).toHaveBeenCalled();
  });

  it('handleAddFetchHeader adds a new empty header', () => {
    const { result } = renderHook(() => useSharedDsFetchConfig(sources[0], sources, onUpdate));
    act(() => result.current.handleAddFetchHeader());
    const updated = onUpdate.mock.calls[0][0];
    expect(updated[0].fetchConfig.headers.length).toBe(2);
  });

  it('handleRemoveFetchHeader removes a header', () => {
    const ds = makeSharedDs({
      fetchConfig: { ...sources[0].fetchConfig!, headers: [{ key: 'A', value: '1' }, { key: 'B', value: '2' }] },
    });
    const { result } = renderHook(() => useSharedDsFetchConfig(ds, [ds], onUpdate));
    act(() => result.current.handleRemoveFetchHeader(0));
    const updated = onUpdate.mock.calls[0][0];
    expect(updated[0].fetchConfig.headers).toEqual([{ key: 'B', value: '2' }]);
  });

  it('handleFetchAuthTypeChange sets auth type', () => {
    const { result } = renderHook(() => useSharedDsFetchConfig(sources[0], sources, onUpdate));
    act(() => result.current.handleFetchAuthTypeChange('bearer'));
    const updated = onUpdate.mock.calls[0][0];
    expect(updated[0].fetchConfig.auth.type).toBe('bearer');
  });

  it('handleFetchAuthPatch patches auth fields', () => {
    const ds = makeSharedDs({
      fetchConfig: { ...sources[0].fetchConfig!, auth: { type: 'bearer', token: 'old' } },
    });
    const { result } = renderHook(() => useSharedDsFetchConfig(ds, [ds], onUpdate));
    act(() => result.current.handleFetchAuthPatch({ token: 'new-token' }));
    const updated = onUpdate.mock.calls[0][0];
    expect(updated[0].fetchConfig.auth.token).toBe('new-token');
  });

  it('handleImportCurl parses curl and opens wizard', () => {
    const { result } = renderHook(() => useSharedDsFetchConfig(sources[0], sources, onUpdate));
    // Set curl input first
    act(() => result.current.handleCurlInputChange('curl https://api.example.com'));
    onUpdate.mockClear();

    act(() => result.current.handleImportCurl());
    expect(onUpdate).toHaveBeenCalled();
    expect(result.current.showSetupWizard).toBe(true);
    expect(result.current.curlImportExpanded).toBe(false);
  });

  it('handleImportCurl moves Bearer token from Authorization header into auth config', () => {
    vi.mocked(parseCurl).mockReturnValueOnce({
      url: 'https://secure.example.com',
      method: 'GET',
      headers: [{ key: 'Authorization', value: 'Bearer secret-token' }],
      body: undefined,
      bodyType: undefined,
      auth: undefined,
    });
    const { result } = renderHook(() => useSharedDsFetchConfig(sources[0], sources, onUpdate));
    act(() => result.current.handleCurlInputChange('curl -H "Authorization: Bearer secret-token" https://secure.example.com'));
    act(() => result.current.handleImportCurl());
    const updated = onUpdate.mock.calls.at(-1)?.[0];
    expect(updated?.[0].fetchConfig.auth).toEqual({ type: 'bearer', prefix: 'Bearer', token: 'secret-token' });
    const authHeader = updated?.[0].fetchConfig.headers?.some((h) => h.key.trim().toLowerCase() === 'authorization');
    expect(authHeader).toBe(false);
    expect(updated?.[0].fetchConfig.headers).toEqual([{ key: '', value: '' }]);
  });

  it('handleImportCurl keeps non-listed HTTP methods by falling back to existing config method', () => {
    const ds = makeSharedDs({
      fetchConfig: { ...sources[0].fetchConfig!, method: 'POST' },
    });
    vi.mocked(parseCurl).mockReturnValueOnce({
      url: 'https://method.example.com',
      method: 'OPTIONS',
      headers: [{ key: 'X', value: 'y' }],
      body: undefined,
      bodyType: undefined,
      auth: undefined,
    });
    const { result } = renderHook(() => useSharedDsFetchConfig(ds, [ds], onUpdate));
    act(() => result.current.handleCurlInputChange('curl -X OPTIONS https://method.example.com'));
    act(() => result.current.handleImportCurl());
    const updated = onUpdate.mock.calls.at(-1)?.[0];
    expect(updated?.[0].fetchConfig.method).toBe('POST');
  });

  it('handleImportCurl is a no-op when curl input is blank', () => {
    const { result } = renderHook(() => useSharedDsFetchConfig(sources[0], sources, onUpdate));
    onUpdate.mockClear();
    act(() => result.current.handleImportCurl());
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('handleFetchHeaderChange ignores out-of-range index', () => {
    const { result } = renderHook(() => useSharedDsFetchConfig(sources[0], sources, onUpdate));
    onUpdate.mockClear();
    act(() => result.current.handleFetchHeaderChange(5, 'key', 'x'));
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('handleCurlInputChange only updates local state when nothing is selected', () => {
    const { result } = renderHook(() => useSharedDsFetchConfig(undefined, sources, onUpdate));
    act(() => result.current.handleCurlInputChange('orphan curl'));
    expect(result.current.curlInput).toBe('orphan curl');
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('does nothing when no selected source', () => {
    const { result } = renderHook(() => useSharedDsFetchConfig(undefined, sources, onUpdate));
    act(() => result.current.handleFetchConfigChange({ url: 'x' }));
    expect(onUpdate).not.toHaveBeenCalled();
  });
});
