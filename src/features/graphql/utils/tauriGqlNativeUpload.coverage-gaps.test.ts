/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { serializeFormDataForNativeUpload, tauriGqlNativeUpload } from './tauriGqlNativeUpload';

const mockInvoke = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

describe('serializeFormDataForNativeUpload — bytesToBase64 fallback', () => {
  const savedBtoa = globalThis.btoa;

  afterEach(() => {
    globalThis.btoa = savedBtoa;
  });

  it('uses Buffer when btoa is unavailable', async () => {
    // @ts-expect-error — simulate Node-only environment
    globalThis.btoa = undefined;
    const form = new FormData();
    const file = new File(['hi'], 'a.bin', { type: 'application/octet-stream' });
    form.append('0', file);
    const parts = await serializeFormDataForNativeUpload(form);
    expect(parts[0]?.kind).toBe('file');
    expect(parts[0]?.dataBase64).toBe(Buffer.from('hi').toString('base64'));
  });
});

describe('tauriGqlNativeUpload — signal, headers, and error paths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: {},
      body: '{"data":{}}',
    });
  });

  it('strips content-type from forwarded headers', async () => {
    const form = new FormData();
    form.append('operations', '{}');
    await tauriGqlNativeUpload(
      'https://x/graphql',
      form,
      { 'Content-Type': 'multipart/form-data', Authorization: 'Bearer x' },
      undefined,
      { skipTlsVerify: true },
    );
    expect(mockInvoke).toHaveBeenCalledWith('gql_http_upload', {
      request: expect.objectContaining({
        headers: { Authorization: 'Bearer x' },
      }),
    });
  });

  it('returns success without signal', async () => {
    const result = await tauriGqlNativeUpload(
      'https://x/graphql',
      new FormData(),
      {},
      undefined,
      { skipTlsVerify: true },
    );
    expect(result.status).toBe(200);
  });

  it('returns error when invoke throws without signal', async () => {
    mockInvoke.mockRejectedValue(new Error('rust error'));
    const result = await tauriGqlNativeUpload(
      'https://x/graphql',
      new FormData(),
      {},
      undefined,
      { skipTlsVerify: true },
    );
    expect(result.error).toBe('rust error');
  });

  it('returns generic error for non-Error throw without signal', async () => {
    mockInvoke.mockRejectedValue(null);
    const result = await tauriGqlNativeUpload(
      'https://x/graphql',
      new FormData(),
      {},
      undefined,
      { skipTlsVerify: true },
    );
    expect(result.error).toBe('Native GraphQL upload request failed');
  });

  it('resolves with response when signal present', async () => {
    const ctrl = new AbortController();
    const result = await tauriGqlNativeUpload(
      'https://x/graphql',
      new FormData(),
      {},
      ctrl.signal,
      { skipTlsVerify: true },
    );
    expect(result.status).toBe(200);
  });

  it('returns Aborted when signal aborts before resolve', async () => {
    let resolveInvoke!: (v: unknown) => void;
    mockInvoke.mockReturnValue(
      new Promise((resolve) => {
        resolveInvoke = resolve;
      }),
    );
    const ctrl = new AbortController();
    const promise = tauriGqlNativeUpload(
      'https://x/graphql',
      new FormData(),
      {},
      ctrl.signal,
      { skipTlsVerify: true },
    );
    ctrl.abort();
    resolveInvoke({ status: 200, statusText: 'OK', headers: {}, body: 'late' });
    expect((await promise).error).toBe('Aborted');
  });

  it('returns error when invoke rejects with signal', async () => {
    mockInvoke.mockRejectedValue(new Error('reject'));
    const ctrl = new AbortController();
    const result = await tauriGqlNativeUpload(
      'https://x/graphql',
      new FormData(),
      {},
      ctrl.signal,
      { skipTlsVerify: true },
    );
    expect(result.error).toBe('reject');
  });

  it('returns Aborted when signal aborted after reject', async () => {
    mockInvoke.mockRejectedValue(new Error('fail'));
    const ctrl = new AbortController();
    const promise = tauriGqlNativeUpload(
      'https://x/graphql',
      new FormData(),
      {},
      ctrl.signal,
      { skipTlsVerify: true },
    );
    ctrl.abort();
    expect((await promise).error).toBe('Aborted');
  });

  it('returns Aborted when signal already aborted before invoke', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const result = await tauriGqlNativeUpload(
      'https://x/graphql',
      new FormData(),
      {},
      ctrl.signal,
      { skipTlsVerify: true },
    );
    expect(result.error).toBe('Aborted');
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('serializeFormDataForNativeUpload handles string field entries', async () => {
    const form = new FormData();
    form.append('operations', '{"query":"{}"}');
    const parts = await serializeFormDataForNativeUpload(form);
    expect(parts).toEqual([{ kind: 'field', name: 'operations', value: '{"query":"{}"}' }]);
  });

  it('returns generic error for non-Error reject with signal present', async () => {
    mockInvoke.mockRejectedValue('string-fail');
    const ctrl = new AbortController();
    const result = await tauriGqlNativeUpload(
      'https://x/graphql',
      new FormData(),
      {},
      ctrl.signal,
      { skipTlsVerify: true },
    );
    expect(result.error).toBe('Native GraphQL upload request failed');
  });

  it('serializeFormDataForNativeUpload uses btoa when available', async () => {
    const form = new FormData();
    form.append('0', new File(['ab'], 'f.bin', { type: 'application/octet-stream' }));
    const parts = await serializeFormDataForNativeUpload(form);
    expect(parts[0]?.dataBase64).toBe(btoa(String.fromCharCode(97, 98)));
  });

  it('strips content-type header case-insensitively', async () => {
    await tauriGqlNativeUpload(
      'https://x/graphql',
      new FormData(),
      { 'content-type': 'multipart/form-data', 'X-Custom': '1' },
      undefined,
      { skipTlsVerify: true },
    );
    expect(mockInvoke).toHaveBeenCalledWith('gql_http_upload', {
      request: expect.objectContaining({
        headers: { 'X-Custom': '1' },
      }),
    });
  });

  it('returns Aborted when onAbort listener fires during pending invoke', async () => {
    mockInvoke.mockReturnValue(new Promise(() => {}));
    const signal = {
      aborted: false,
      addEventListener(type: string, listener: EventListenerOrObserver) {
        if (type === 'abort' && typeof listener === 'function') {
          queueMicrotask(() => listener(new Event('abort')));
        }
      },
      removeEventListener: vi.fn(),
    } as unknown as AbortSignal;

    const result = await tauriGqlNativeUpload(
      'https://x/graphql',
      new FormData(),
      {},
      signal,
      { skipTlsVerify: true },
    );
    expect(result.error).toBe('Aborted');
  });

  it('resolves success with signal when not aborted after invoke', async () => {
    const ctrl = new AbortController();
    const result = await tauriGqlNativeUpload(
      'https://x/graphql',
      new FormData(),
      {},
      ctrl.signal,
      { skipTlsVerify: true },
    );
    expect(result.status).toBe(200);
    expect(result.error).toBeUndefined();
  });
});
