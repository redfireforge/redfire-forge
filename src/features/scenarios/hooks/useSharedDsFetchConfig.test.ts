/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSharedDsFetchConfig } from './useSharedDsFetchConfig';
import { parseCurl } from '../../../shared/utils/curlParser';
import type { SharedDataSource, DataSource, Scenario } from '../../../shared/types';

vi.mock('../../../shared/utils/curlParser', () => ({
  parseCurl: vi.fn((_input: string) => ({
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
    resetAllMocks();
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

  it('handleFetchAuthTypeChange accepts digest', () => {
    const { result } = renderHook(() => useSharedDsFetchConfig(sources[0], sources, onUpdate));
    act(() => result.current.handleFetchAuthTypeChange('digest'));
    expect(onUpdate.mock.calls[0][0][0].fetchConfig.auth.type).toBe('digest');
  });

  it('handleFetchAuthTypeChange accepts oauth2', () => {
    const { result } = renderHook(() => useSharedDsFetchConfig(sources[0], sources, onUpdate));
    act(() => result.current.handleFetchAuthTypeChange('oauth2'));
    expect(onUpdate.mock.calls[0][0][0].fetchConfig.auth.type).toBe('oauth2');
  });

  it('handleFetchAuthTypeChange accepts apikey', () => {
    const { result } = renderHook(() => useSharedDsFetchConfig(sources[0], sources, onUpdate));
    act(() => result.current.handleFetchAuthTypeChange('apikey'));
    expect(onUpdate.mock.calls[0][0][0].fetchConfig.auth.type).toBe('apikey');
  });

  it('handleFetchAuthPatch starts from none auth when config omits auth block', () => {
    const ds = makeSharedDs({
      fetchConfig: { ...sources[0].fetchConfig!, auth: undefined },
    });
    const { result } = renderHook(() => useSharedDsFetchConfig(ds, [ds], onUpdate));
    act(() => result.current.handleFetchAuthPatch({ username: 'me' }));
    const updated = onUpdate.mock.calls[0][0];
    expect(updated[0].fetchConfig.auth).toMatchObject({
      type: 'none',
      username: 'me',
    });
  });

  it('handleFetchAuthPatch patches existing auth fields', () => {
    const ds = makeSharedDs({
      fetchConfig: { ...sources[0].fetchConfig!, auth: { type: 'bearer', token: 'old' } },
    });
    const { result } = renderHook(() => useSharedDsFetchConfig(ds, [ds], onUpdate));
    act(() => result.current.handleFetchAuthPatch({ token: 'new-token' }));
    const updated = onUpdate.mock.calls[0][0];
    expect(updated[0].fetchConfig.auth.token).toBe('new-token');
  });

  it('handleImportCurl merges parsed.basic auth together with curl metadata', () => {
    vi.mocked(parseCurl).mockReturnValueOnce({
      url: 'https://auth.example',
      method: 'GET',
      headers: [{ key: 'Accept', value: 'json' }],
      body: undefined,
      bodyType: undefined,
      auth: { type: 'basic', username: 'alice', password: 'secret' },
    });
    const { result } = renderHook(() => useSharedDsFetchConfig(sources[0], sources, onUpdate));
    act(() => result.current.handleCurlInputChange('curl -u alice:secret https://auth.example'));
    act(() => result.current.handleImportCurl());
    const updated = onUpdate.mock.calls.at(-1)?.[0];
    expect(updated?.[0].fetchConfig.auth).toMatchObject({
      type: 'basic',
      username: 'alice',
      password: 'secret',
    });
  });

  it('handleImportCurl keeps configured URL when parse returns no url property', () => {
    vi.mocked(parseCurl).mockReturnValueOnce({
      method: 'POST',
      headers: [{ key: 'X', value: 'y' }],
      body: '',
      bodyType: undefined,
      auth: undefined,
    } satisfies Partial<Scenario>);
    const { result } = renderHook(() => useSharedDsFetchConfig(sources[0], sources, onUpdate));
    act(() => result.current.handleCurlInputChange('curl ambiguous'));
    act(() => result.current.handleImportCurl());
    const updated = onUpdate.mock.calls.at(-1)?.[0];
    expect(updated?.[0].fetchConfig.url).toBe('https://api.example.com');
  });

  it('handleImportCurl leaves Digest-style Authorization headers in header list', () => {
    vi.mocked(parseCurl).mockReturnValueOnce({
      url: 'https://secure.example.com',
      method: 'GET',
      headers: [{ key: 'Authorization', value: 'Digest username="guest"' }],
      body: undefined,
      bodyType: undefined,
      auth: undefined,
    });
    const { result } = renderHook(() => useSharedDsFetchConfig(sources[0], sources, onUpdate));
    act(() => result.current.handleCurlInputChange('curl https://secure.example.com'));
    act(() => result.current.handleImportCurl());
    const updated = onUpdate.mock.calls.at(-1)?.[0];
    const hdr = updated?.[0].fetchConfig.headers?.find((h) => h.key.toLowerCase() === 'authorization');
    expect(hdr?.value).toContain('Digest');
    expect(updated?.[0].fetchConfig.auth.type).toBe('none');
  });

  it('handleFetchAuthTypeChange accepts inherit variant', () => {
    const { result } = renderHook(() => useSharedDsFetchConfig(sources[0], sources, onUpdate));
    act(() => result.current.handleFetchAuthTypeChange('inherit'));
    const updated = onUpdate.mock.calls[0][0];
    expect(updated[0].fetchConfig.auth.type).toBe('inherit');
  });

  it('handleImportCurl uses explicit parsed bodyType over inferred default', () => {
    vi.mocked(parseCurl).mockReturnValueOnce({
      url: 'https://explicit-type.example/post',
      method: 'POST',
      headers: [],
      body: '{"a":true}',
      bodyType: 'text',
      auth: undefined,
    });
    const { result } = renderHook(() => useSharedDsFetchConfig(sources[0], sources, onUpdate));
    act(() => result.current.handleCurlInputChange('curl -d stuff https://explicit-type.example/post'));
    act(() => result.current.handleImportCurl());
    const updated = onUpdate.mock.calls.at(-1)?.[0];
    expect(updated?.[0].fetchConfig.bodyType).toBe('text');
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

  it('handleImportCurl removes Authorization after Bearer hoist but retains other parsed headers', () => {
    vi.mocked(parseCurl).mockReturnValueOnce({
      url: 'https://multi.example',
      method: 'GET',
      headers: [
        { key: 'Authorization', value: 'Bearer keep' },
        { key: 'X-Req-Id', value: 'trace' },
      ],
      body: undefined,
      bodyType: undefined,
      auth: undefined,
    });
    const { result } = renderHook(() => useSharedDsFetchConfig(sources[0], sources, onUpdate));
    act(() => result.current.handleCurlInputChange('curl https://multi.example'));
    act(() => result.current.handleImportCurl());
    const updated = onUpdate.mock.calls.at(-1)?.[0];
    expect(updated?.[0].fetchConfig.auth).toMatchObject({ type: 'bearer', token: 'keep' });
    expect(updated?.[0].fetchConfig.headers).toEqual([{ key: 'X-Req-Id', value: 'trace' }]);
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

  it('handleImportCurl falls back method for HEAD when not allowed', () => {
    const ds = makeSharedDs({
      fetchConfig: { ...sources[0].fetchConfig!, method: 'PUT' },
    });
    vi.mocked(parseCurl).mockReturnValueOnce({
      url: 'https://head.example',
      method: 'HEAD',
      headers: [{ key: 'Accept', value: '*/*' }],
      body: undefined,
      bodyType: undefined,
      auth: undefined,
    });
    const { result } = renderHook(() => useSharedDsFetchConfig(ds, [ds], onUpdate));
    act(() => result.current.handleCurlInputChange('curl -I https://head.example'));
    act(() => result.current.handleImportCurl());
    const updated = onUpdate.mock.calls.at(-1)?.[0];
    expect(updated?.[0].fetchConfig.method).toBe('PUT');
  });

  it('handleImportCurl infers json body type when parsed body present but bodyType omitted', () => {
    const ds = makeSharedDs({
      fetchConfig: { ...sources[0].fetchConfig!, bodyType: undefined },
    });
    vi.mocked(parseCurl).mockReturnValueOnce({
      url: 'https://json-body.example/post',
      method: 'POST',
      headers: [],
      body: '{"x":true}',
      bodyType: undefined,
      auth: undefined,
    });
    const { result } = renderHook(() => useSharedDsFetchConfig(ds, [ds], onUpdate));
    act(() => result.current.handleCurlInputChange('curl -d \'{"x":true}\' https://json-body.example/post'));
    act(() => result.current.handleImportCurl());
    const updated = onUpdate.mock.calls.at(-1)?.[0];
    expect(updated?.[0].fetchConfig.bodyType).toBe('json');
  });

  it('handleImportCurl does not hoist Authorization when Bearer token is empty', () => {
    vi.mocked(parseCurl).mockReturnValueOnce({
      url: 'https://empty-bearer.example',
      method: 'GET',
      headers: [{ key: 'Authorization', value: 'Bearer   ' }],
      body: undefined,
      bodyType: undefined,
      auth: undefined,
    });
    const { result } = renderHook(() => useSharedDsFetchConfig(sources[0], sources, onUpdate));
    act(() => result.current.handleCurlInputChange('curl https://empty-bearer.example'));
    act(() => result.current.handleImportCurl());
    const updated = onUpdate.mock.calls.at(-1)?.[0];
    expect(updated?.[0].fetchConfig.auth.type).toBe('none');
    const authHdr = updated?.[0].fetchConfig.headers?.find((h) => h.key.trim().toLowerCase() === 'authorization');
    expect(authHdr?.value).toContain('Bearer');
  });

  it('handleImportCurl clears Authorization header placeholders when Bearer was sole header', () => {
    vi.mocked(parseCurl).mockReturnValueOnce({
      url: 'https://solo-auth.example',
      method: 'GET',
      headers: [{ key: 'Authorization', value: 'Bearer lone' }],
      body: undefined,
      bodyType: undefined,
      auth: undefined,
    });
    const { result } = renderHook(() => useSharedDsFetchConfig(sources[0], sources, onUpdate));
    act(() => result.current.handleCurlInputChange('curl https://solo-auth.example'));
    act(() => result.current.handleImportCurl());
    expect(onUpdate.mock.calls.at(-1)?.[0]?.[0].fetchConfig.headers).toEqual([{ key: '', value: '' }]);
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

  it('handleImportCurl uses existing headers when parse omits headers', () => {
    vi.mocked(parseCurl).mockReturnValueOnce({
      url: 'https://no-headers.example',
      method: 'GET',
      headers: undefined,
      body: undefined,
      bodyType: undefined,
      auth: { type: 'basic', username: 'a', password: 'b' },
    } satisfies Partial<Scenario>);
    const { result } = renderHook(() => useSharedDsFetchConfig(sources[0], sources, onUpdate));
    act(() => result.current.handleCurlInputChange('curl https://no-headers.example'));
    act(() => result.current.handleImportCurl());
    const updated = onUpdate.mock.calls.at(-1)?.[0];
    expect(updated?.[0].fetchConfig.headers).toEqual([{ key: '', value: '' }]);
    expect(updated?.[0].fetchConfig.auth.type).toBe('basic');
  });

  it('handleCurlInputChange only updates local state when nothing is selected', () => {
    const { result } = renderHook(() => useSharedDsFetchConfig(undefined, sources, onUpdate));
    act(() => result.current.handleCurlInputChange('orphan curl'));
    expect(result.current.curlInput).toBe('orphan curl');
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('handleCurlInputChange writes rawCurl into the selected fetch config', () => {
    const ds = sources[0];
    const { result } = renderHook(() => useSharedDsFetchConfig(ds, sources, onUpdate));
    onUpdate.mockClear();
    act(() => result.current.handleCurlInputChange('curl https://persist.example'));
    expect(onUpdate).toHaveBeenCalledTimes(1);
    const blob = onUpdate.mock.calls[0][0][0].fetchConfig;
    expect(blob.rawCurl).toBe('curl https://persist.example');
  });

  it('does nothing when no selected source', () => {
    const { result } = renderHook(() => useSharedDsFetchConfig(undefined, sources, onUpdate));
    act(() => result.current.handleFetchConfigChange({ url: 'x' }));
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('syncs curl input when selection changes', () => {
    const dsA = makeSharedDs({ id: 'a', fetchConfig: { ...sources[0].fetchConfig!, rawCurl: 'curl A' } });
    const dsB = makeSharedDs({ id: 'b', fetchConfig: { ...sources[0].fetchConfig!, rawCurl: 'curl B' } });
    const pool = [dsA, dsB];
    const { result, rerender } = renderHook(
      ({ selected }) => useSharedDsFetchConfig(selected, pool, onUpdate),
      { initialProps: { selected: dsA as SharedDataSource | undefined } },
    );
    expect(result.current.curlInput).toBe('curl A');
    rerender({ selected: dsB });
    expect(result.current.curlInput).toBe('curl B');
  });

  it('handleImportCurl keeps existing headers when parse returns empty header list', () => {
    vi.mocked(parseCurl).mockReturnValueOnce({
      url: 'https://parsed.example.com',
      method: 'GET',
      headers: [],
      body: undefined,
      bodyType: undefined,
      auth: undefined,
    });
    const { result } = renderHook(() => useSharedDsFetchConfig(sources[0], sources, onUpdate));
    act(() => result.current.handleCurlInputChange('curl https://x'));
    act(() => result.current.handleImportCurl());
    const updated = onUpdate.mock.calls.at(-1)?.[0];
    expect(updated?.[0].fetchConfig.headers).toEqual([{ key: '', value: '' }]);
  });

  it('handleRemoveFetchHeader leaves a placeholder row when removing the last real header', () => {
    const ds = makeSharedDs({
      fetchConfig: { ...sources[0].fetchConfig!, headers: [{ key: 'Only', value: '1' }] },
    });
    const { result } = renderHook(() => useSharedDsFetchConfig(ds, [ds], onUpdate));
    act(() => result.current.handleRemoveFetchHeader(0));
    const updated = onUpdate.mock.calls[0][0];
    expect(updated[0].fetchConfig.headers).toEqual([{ key: '', value: '' }]);
  });

  it('is no-op for header/auth handlers when nothing is selected', () => {
    const { result } = renderHook(() => useSharedDsFetchConfig(undefined, sources, onUpdate));
    act(() => result.current.handleAddFetchHeader());
    act(() => result.current.handleRemoveFetchHeader(0));
    act(() => result.current.handleFetchHeaderChange(0, 'key', 'x'));
    act(() => result.current.handleFetchAuthTypeChange('basic'));
    act(() => result.current.handleFetchAuthPatch({ user: 'u' }));
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('does not import curl when no shared source is selected', () => {
    const { result } = renderHook(() => useSharedDsFetchConfig(undefined, sources, onUpdate));
    act(() => result.current.handleCurlInputChange('curl https://x'));
    act(() => result.current.handleImportCurl());
    expect(parseCurl).not.toHaveBeenCalled();
  });

  it('handleFetchConfigChange merges with defaultFetchConfig when fetchConfig is missing', () => {
    const ds = makeSharedDs({ fetchConfig: undefined });
    const { result } = renderHook(() => useSharedDsFetchConfig(ds, [ds], onUpdate));
    act(() => result.current.handleFetchConfigChange({ url: 'https://merged.example' }));
    const updated = onUpdate.mock.calls[0][0][0];
    expect(updated.fetchConfig?.url).toBe('https://merged.example');
    expect(updated.fetchConfig?.headers).toEqual([{ key: '', value: '' }]);
  });

  it('handleFetchConfigChange leaves non-selected sources unchanged', () => {
    const dsA = makeSharedDs({ id: 'a', name: 'A' });
    const dsB = makeSharedDs({ id: 'b', name: 'B' });
    const pool = [dsA, dsB];
    const { result } = renderHook(() => useSharedDsFetchConfig(dsA, pool, onUpdate));
    act(() => result.current.handleFetchConfigChange({ url: 'https://only-a.example' }));
    const updated = onUpdate.mock.calls[0][0];
    expect(updated.find((d) => d.id === 'a')?.fetchConfig?.url).toBe('https://only-a.example');
    expect(updated.find((d) => d.id === 'b')).toEqual(dsB);
  });

  it('handleFetchHeaderChange uses default headers when fetchConfig is missing', () => {
    const ds = makeSharedDs({ fetchConfig: undefined });
    const { result } = renderHook(() => useSharedDsFetchConfig(ds, [ds], onUpdate));
    act(() => result.current.handleFetchHeaderChange(0, 'key', 'X-Custom'));
    expect(onUpdate.mock.calls[0][0][0].fetchConfig?.headers?.[0]).toEqual({ key: 'X-Custom', value: '' });
  });

  it('handleAddFetchHeader uses defaultFetchConfig when fetchConfig is missing', () => {
    const ds = makeSharedDs({ fetchConfig: undefined });
    const { result } = renderHook(() => useSharedDsFetchConfig(ds, [ds], onUpdate));
    act(() => result.current.handleAddFetchHeader());
    expect(onUpdate.mock.calls[0][0][0].fetchConfig?.headers?.length).toBe(2);
  });

  it('handleRemoveFetchHeader uses defaultFetchConfig when fetchConfig is missing', () => {
    const ds = makeSharedDs({ fetchConfig: undefined });
    const { result } = renderHook(() => useSharedDsFetchConfig(ds, [ds], onUpdate));
    act(() => result.current.handleRemoveFetchHeader(0));
    expect(onUpdate.mock.calls[0][0][0].fetchConfig?.headers).toEqual([{ key: '', value: '' }]);
  });

  it('handleImportCurl falls back to GET when no fetchConfig and parsed method is invalid', () => {
    const ds = makeSharedDs({ fetchConfig: undefined });
    vi.mocked(parseCurl).mockReturnValueOnce({
      url: 'https://m.example',
      method: 'TRACE',
      headers: [{ key: 'Accept', value: '*/*' }],
      body: undefined,
      bodyType: undefined,
      auth: undefined,
    });
    const { result } = renderHook(() => useSharedDsFetchConfig(ds, [ds], onUpdate));
    act(() => result.current.handleCurlInputChange('curl -X TRACE https://m.example'));
    act(() => result.current.handleImportCurl());
    expect(onUpdate.mock.calls.at(-1)?.[0]?.[0].fetchConfig?.method).toBe('GET');
  });

  it('handleImportCurl falls back to placeholder headers when parse omits headers and source has no fetchConfig', () => {
    const ds = makeSharedDs({ fetchConfig: undefined });
    vi.mocked(parseCurl).mockReturnValueOnce({
      url: 'https://h.example',
      method: 'GET',
      headers: undefined,
      body: undefined,
      bodyType: undefined,
      auth: undefined,
    } satisfies Partial<Scenario>);
    const { result } = renderHook(() => useSharedDsFetchConfig(ds, [ds], onUpdate));
    act(() => result.current.handleCurlInputChange('curl https://h.example'));
    act(() => result.current.handleImportCurl());
    expect(onUpdate.mock.calls.at(-1)?.[0]?.[0].fetchConfig?.headers).toEqual([{ key: '', value: '' }]);
  });

  it('handleImportCurl defaults auth to none when parse and source have no auth', () => {
    const ds = makeSharedDs({ fetchConfig: undefined });
    vi.mocked(parseCurl).mockReturnValueOnce({
      url: 'https://auth-none.example',
      method: 'GET',
      headers: [{ key: 'Accept', value: 'json' }],
      body: undefined,
      bodyType: undefined,
      auth: undefined,
    });
    const { result } = renderHook(() => useSharedDsFetchConfig(ds, [ds], onUpdate));
    act(() => result.current.handleCurlInputChange('curl https://auth-none.example'));
    act(() => result.current.handleImportCurl());
    expect(onUpdate.mock.calls.at(-1)?.[0]?.[0].fetchConfig?.auth).toEqual({ type: 'none' });
  });

  it('handleImportCurl uses empty url and body when parse and fetchConfig omit them', () => {
    const ds = makeSharedDs({ fetchConfig: undefined });
    vi.mocked(parseCurl).mockReturnValueOnce({
      method: 'GET',
      headers: [{ key: 'X', value: 'y' }],
      body: undefined,
      bodyType: undefined,
      auth: undefined,
    } satisfies Partial<Scenario>);
    const { result } = renderHook(() => useSharedDsFetchConfig(ds, [ds], onUpdate));
    act(() => result.current.handleCurlInputChange('curl'));
    act(() => result.current.handleImportCurl());
    const cfg = onUpdate.mock.calls.at(-1)?.[0]?.[0].fetchConfig;
    expect(cfg?.url).toBe('');
    expect(cfg?.body).toBe('');
  });

  it('handleImportCurl infers bodyType none when no body and no explicit bodyType anywhere', () => {
    const ds = makeSharedDs({
      fetchConfig: { ...sources[0].fetchConfig!, bodyType: undefined, body: '' },
    });
    vi.mocked(parseCurl).mockReturnValueOnce({
      url: 'https://bt.example',
      method: 'GET',
      headers: [],
      body: undefined,
      bodyType: undefined,
      auth: undefined,
    });
    const { result } = renderHook(() => useSharedDsFetchConfig(ds, [ds], onUpdate));
    act(() => result.current.handleCurlInputChange('curl https://bt.example'));
    act(() => result.current.handleImportCurl());
    expect(onUpdate.mock.calls.at(-1)?.[0]?.[0].fetchConfig?.bodyType).toBe('none');
  });

  it('handleCurlInputChange merges with defaultFetchConfig when fetchConfig is missing', () => {
    const ds = makeSharedDs({ fetchConfig: undefined });
    const { result } = renderHook(() => useSharedDsFetchConfig(ds, [ds], onUpdate));
    act(() => result.current.handleCurlInputChange('curl https://raw.example'));
    const cfg = onUpdate.mock.calls[0][0][0].fetchConfig;
    expect(cfg?.rawCurl).toBe('curl https://raw.example');
    expect(cfg?.headers).toEqual([{ key: '', value: '' }]);
  });

  it('handleFetchAuthPatch uses default none auth when auth property is absent', () => {
    const ds = makeSharedDs({
      fetchConfig: {
        url: 'https://api.example.com',
        method: 'GET',
        headers: [{ key: '', value: '' }],
        body: '',
        bodyType: 'none',
      } as SharedDataSource['fetchConfig'],
    });
    const { result } = renderHook(() => useSharedDsFetchConfig(ds, [ds], onUpdate));
    expect(ds.fetchConfig).toBeDefined();
    expect('auth' in (ds.fetchConfig as object)).toBe(false);
    act(() => result.current.handleFetchAuthPatch({ token: 't' }));
    expect(onUpdate.mock.calls[0][0][0].fetchConfig?.auth).toMatchObject({
      type: 'none',
      token: 't',
    });
  });
});
