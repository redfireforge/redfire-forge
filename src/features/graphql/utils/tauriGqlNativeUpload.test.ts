/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { serializeFormDataForNativeUpload, tauriGqlNativeUpload } from './tauriGqlNativeUpload';

const mockInvoke = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

describe('serializeFormDataForNativeUpload', () => {
  it('serializes field and file parts', async () => {
    const form = new FormData();
    form.append('operations', '{"query":"mutation {m}"}');
    form.append('map', '{"0":["variables.file"]}');
    const file = new File(['hello'], 'test.txt', { type: 'text/plain' });
    form.append('0', file);

    const parts = await serializeFormDataForNativeUpload(form);
    expect(parts).toHaveLength(3);
    expect(parts[0]).toEqual({
      kind: 'field',
      name: 'operations',
      value: '{"query":"mutation {m}"}',
    });
    expect(parts[2]?.kind).toBe('file');
    expect(parts[2]?.filename).toBe('test.txt');
    expect(parts[2]?.dataBase64).toBeTruthy();
  });
});

describe('tauriGqlNativeUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      body: '{"data":{"upload":"ok"}}',
    });
  });

  it('invokes gql_http_upload with serialized multipart parts and TLS', async () => {
    const form = new FormData();
    form.append('operations', '{"query":"mutation {m}"}');

    await tauriGqlNativeUpload(
      'https://localhost:4445/graphql',
      form,
      { Authorization: 'Bearer token' },
      undefined,
      {
        caCert: '-----BEGIN CERTIFICATE-----\nca',
        clientCert: '-----BEGIN CERTIFICATE-----\nclient',
        clientKey: '-----BEGIN PRIVATE KEY-----\nkey',
      },
    );

    expect(mockInvoke).toHaveBeenCalledWith('gql_http_upload', {
      request: expect.objectContaining({
        url: 'https://localhost:4445/graphql',
        headers: { Authorization: 'Bearer token' },
        parts: expect.arrayContaining([
          expect.objectContaining({ kind: 'field', name: 'operations' }),
        ]),
        caCert: '-----BEGIN CERTIFICATE-----\nca',
        clientCert: '-----BEGIN CERTIFICATE-----\nclient',
        clientKey: '-----BEGIN PRIVATE KEY-----\nkey',
      }),
    });
  });

  it('returns Aborted when signal is already aborted', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const result = await tauriGqlNativeUpload(
      'https://localhost/graphql',
      new FormData(),
      {},
      ctrl.signal,
      { skipTlsVerify: true },
    );
    expect(result.error).toBe('Aborted');
    expect(mockInvoke).not.toHaveBeenCalled();
  });
});
