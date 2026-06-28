/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { tauriGqlNativeFetch, toHttpResponse } from './tauriGqlNativeFetch';

const mockInvoke = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

describe('toHttpResponse', () => {
  it('maps native response fields', () => {
    expect(
      toHttpResponse({
        status: 201,
        statusText: 'Created',
        headers: { 'x-test': '1' },
        body: '{}',
        error: 'ignored',
      }),
    ).toEqual({
      status: 201,
      statusText: 'Created',
      headers: { 'x-test': '1' },
      body: '{}',
      error: 'ignored',
    });
  });
});

describe('tauriGqlNativeFetch — signal and error paths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns success without signal', async () => {
    mockInvoke.mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: {},
      body: '{"data":{}}',
    });
    const result = await tauriGqlNativeFetch('https://x/graphql', 'POST', {}, '{}', undefined, {
      skipTlsVerify: true,
    });
    expect(result.status).toBe(200);
    expect(result.body).toBe('{"data":{}}');
  });

  it('returns error message when invoke throws without signal', async () => {
    mockInvoke.mockRejectedValue(new Error('network down'));
    const result = await tauriGqlNativeFetch('https://x/graphql', 'POST', {}, '{}', undefined, {
      skipTlsVerify: true,
    });
    expect(result.error).toBe('network down');
    expect(result.status).toBe(0);
  });

  it('returns generic error for non-Error throw without signal', async () => {
    mockInvoke.mockRejectedValue('boom');
    const result = await tauriGqlNativeFetch('https://x/graphql', 'POST', {}, '{}', undefined, {
      skipTlsVerify: true,
    });
    expect(result.error).toBe('Native GraphQL HTTP request failed');
  });

  it('resolves with response when signal is present and invoke succeeds', async () => {
    mockInvoke.mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: {},
      body: 'ok',
    });
    const ctrl = new AbortController();
    const result = await tauriGqlNativeFetch('https://x/graphql', 'POST', {}, '{}', ctrl.signal, {
      skipTlsVerify: true,
    });
    expect(result.status).toBe(200);
    expect(result.body).toBe('ok');
  });

  it('returns Aborted when signal is already aborted at call time', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const result = await tauriGqlNativeFetch('https://x/graphql', 'POST', {}, '{}', ctrl.signal, {
      skipTlsVerify: true,
    });
    expect(result.error).toBe('Aborted');
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('returns Aborted when signal is aborted after invoke resolves', async () => {
    const ctrl = new AbortController();
    mockInvoke.mockImplementation(
      () =>
        new Promise((resolve) => {
          queueMicrotask(() => {
            ctrl.abort();
            resolve({ status: 200, statusText: 'OK', headers: {}, body: 'late' });
          });
        }),
    );
    const result = await tauriGqlNativeFetch('https://x/graphql', 'POST', {}, '{}', ctrl.signal, {
      skipTlsVerify: true,
    });
    expect(result.error).toBe('Aborted');
  });

  it('returns error when invoke rejects with signal present', async () => {
    mockInvoke.mockRejectedValue(new Error('upload fail'));
    const ctrl = new AbortController();
    const result = await tauriGqlNativeFetch('https://x/graphql', 'POST', {}, '{}', ctrl.signal, {
      skipTlsVerify: true,
    });
    expect(result.error).toBe('upload fail');
  });

  it('returns Aborted when signal aborted after invoke rejects', async () => {
    mockInvoke.mockRejectedValue(new Error('fail'));
    const ctrl = new AbortController();
    const promise = tauriGqlNativeFetch('https://x/graphql', 'POST', {}, '{}', ctrl.signal, {
      skipTlsVerify: true,
    });
    ctrl.abort();
    const result = await promise;
    expect(result.error).toBe('Aborted');
  });

  it('returns generic error for non-Error reject with signal', async () => {
    mockInvoke.mockRejectedValue(42);
    const ctrl = new AbortController();
    const result = await tauriGqlNativeFetch('https://x/graphql', 'POST', {}, '{}', ctrl.signal, {
      skipTlsVerify: true,
    });
    expect(result.error).toBe('Native GraphQL HTTP request failed');
  });
});
