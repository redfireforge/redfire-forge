import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockedIsTauri = vi.fn(() => false);
const mockedIsNode = vi.fn(() => false);

vi.mock('./platform', () => ({
  isTauri: () => mockedIsTauri(),
  isNode: () => mockedIsNode(),
}));

const mockTFetch = vi.fn();
vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: (...args: unknown[]) => mockTFetch(...args),
}));

import { httpFetch } from './httpClient';

describe('httpFetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedIsTauri.mockReturnValue(false);
    mockedIsNode.mockReturnValue(false);
    globalThis.fetch = vi.fn();
  });

  describe('browser proxy mode', () => {
    it('sends request through proxy', async () => {
      (globalThis.fetch as any).mockResolvedValueOnce({
        json: () => Promise.resolve({ status: 200, statusText: 'OK', headers: {}, body: 'ok' }),
      });

      const result = await httpFetch('http://example.com', 'GET', {});
      expect(globalThis.fetch).toHaveBeenCalledWith('/__proxy', expect.objectContaining({ method: 'POST' }));
      expect(result.status).toBe(200);
    });

    it('includes body in proxy payload', async () => {
      (globalThis.fetch as any).mockResolvedValueOnce({
        json: () => Promise.resolve({ status: 201, statusText: 'Created', headers: {}, body: '{}' }),
      });

      await httpFetch('http://example.com/api', 'POST', { 'Content-Type': 'application/json' }, '{"a":1}');
      const call = (globalThis.fetch as any).mock.calls[0];
      const parsed = JSON.parse(call[1].body);
      expect(parsed.url).toBe('http://example.com/api');
      expect(parsed.method).toBe('POST');
      expect(parsed.body).toBe('{"a":1}');
    });
  });

  describe('tauri mode', () => {
    beforeEach(() => {
      mockedIsTauri.mockReturnValue(true);
    });

    it('uses tauri fetch plugin', async () => {
      const mockHeaders = new Map([['content-type', 'application/json']]);
      mockTFetch.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        headers: { forEach: (fn: (v: string, k: string) => void) => mockHeaders.forEach((v, k) => fn(v, k)) },
        text: () => Promise.resolve('{"result":"ok"}'),
      });

      const result = await httpFetch('http://example.com', 'GET', {});
      expect(result.status).toBe(200);
      expect(result.body).toBe('{"result":"ok"}');
      expect(result.headers['content-type']).toBe('application/json');
    });

    it('does not attach body to GET requests', async () => {
      const mockHeaders = new Map();
      mockTFetch.mockResolvedValueOnce({
        status: 200, statusText: 'OK',
        headers: { forEach: (fn: (v: string, k: string) => void) => mockHeaders.forEach((v, k) => fn(v, k)) },
        text: () => Promise.resolve(''),
      });

      await httpFetch('http://example.com', 'GET', {}, 'should-be-ignored');
      expect(mockTFetch).toHaveBeenCalledWith('http://example.com', expect.not.objectContaining({ body: 'should-be-ignored' }));
    });

    it('includes body for POST requests', async () => {
      const mockHeaders = new Map();
      mockTFetch.mockResolvedValueOnce({
        status: 201, statusText: 'Created',
        headers: { forEach: (fn: (v: string, k: string) => void) => mockHeaders.forEach((v, k) => fn(v, k)) },
        text: () => Promise.resolve('ok'),
      });

      await httpFetch('http://example.com', 'POST', {}, '{"data":1}');
      expect(mockTFetch).toHaveBeenCalledWith('http://example.com', expect.objectContaining({ body: '{"data":1}' }));
    });

    it('returns error response on network failure', async () => {
      mockTFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await httpFetch('http://example.com', 'GET', {});
      expect(result.status).toBe(0);
      expect(result.error).toBe('Connection refused');
    });
  });

  describe('node mode', () => {
    beforeEach(() => {
      mockedIsNode.mockReturnValue(true);
    });

    it('uses global fetch in node mode', async () => {
      const mockHeaders = new Map([['x-custom', 'value']]);
      (globalThis.fetch as any).mockResolvedValueOnce({
        status: 200, statusText: 'OK',
        headers: { forEach: (fn: (v: string, k: string) => void) => mockHeaders.forEach((v, k) => fn(v, k)) },
        text: () => Promise.resolve('node-response'),
      });

      const result = await httpFetch('http://example.com/api', 'GET', { 'Accept': 'application/json' });
      expect(result.status).toBe(200);
      expect(result.body).toBe('node-response');
    });

    it('handles node fetch errors', async () => {
      (globalThis.fetch as any).mockRejectedValueOnce(new Error('DNS lookup failed'));

      const result = await httpFetch('http://example.com', 'GET', {});
      expect(result.status).toBe(0);
      expect(result.error).toBe('DNS lookup failed');
    });
  });
});
