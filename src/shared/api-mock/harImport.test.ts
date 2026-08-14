import { describe, expect, it } from 'vitest';
import { parseHarEntries } from './harImport';
import { HAR_IMPORT_LIMITS } from './proxyContracts';

function harDoc(entries: unknown[]) {
  return JSON.stringify({ log: { version: '1.2', entries } });
}

describe('parseHarEntries', () => {
  it('parses entries and redacts secrets', () => {
    const text = harDoc([{
      request: {
        method: 'POST',
        url: 'https://api.example.com/v1/users?active=1',
        headers: [
          { name: 'Authorization', value: 'Bearer secret' },
          { name: 'Content-Type', value: 'application/json' },
        ],
        postData: { text: '{"name":"Ada"}', mimeType: 'application/json' },
      },
      response: {
        status: 201,
        headers: [{ name: 'Content-Type', value: 'application/json' }],
        content: { text: '{"id":1}', mimeType: 'application/json' },
      },
    }]);
    const batch = parseHarEntries(text);
    expect(batch.sources).toHaveLength(1);
    expect(batch.sources[0].method).toBe('POST');
    expect(batch.sources[0].path).toBe('/v1/users');
    expect(batch.sources[0].headers?.Authorization).toBe('[REDACTED]');
    expect(batch.sources[0].headers?.['Content-Type']).toBe('application/json');
    expect(batch.sources[0].status).toBe(201);
    expect(batch.diagnostics.some(d => d.code === 'AMS-REDACTION-SECRET-DETECTED')).toBe(true);
  });

  it('rejects invalid JSON and empty logs', () => {
    expect(parseHarEntries('{').diagnostics[0].code).toBe('AMS-IMPORT-PARSE');
    expect(parseHarEntries(JSON.stringify({ log: { entries: [] } })).diagnostics[0].code).toBe('AMS-IMPORT-EMPTY');
  });

  it('rejects oversized HARs', () => {
    const batch = parseHarEntries('{}', HAR_IMPORT_LIMITS.maxFileBytes + 1);
    expect(batch.diagnostics[0].code).toBe('AMS-IMPORT-HAR-TOO-LARGE');
  });

  it('skips bad entries and truncates above maxEntries', () => {
    const entries = Array.from({ length: HAR_IMPORT_LIMITS.maxEntries + 2 }, (_, i) => ({
      request: { method: 'GET', url: `https://example.com/i/${i}` },
      response: { status: 200, content: { text: 'ok' } },
    }));
    entries[0] = { request: { method: 'GET', url: 'not-a-url' }, response: { status: 200, content: { text: 'x' } } } as never;
    const batch = parseHarEntries(harDoc(entries));
    expect(batch.sources.length).toBeLessThanOrEqual(HAR_IMPORT_LIMITS.maxEntries);
    expect(batch.lossReport.some(l => l.includes('Truncated'))).toBe(true);
    expect(batch.lossReport.some(l => l.includes('invalid URL'))).toBe(true);
  });

  it('skips entries missing method or url and resolves mime types', () => {
    const batch = parseHarEntries(harDoc([
      { request: { url: 'https://example.com/a' }, response: { status: 200, content: { text: 'x' } } },
      {
        request: { method: 'POST', url: 'https://example.com/b' },
        response: { status: 200, content: { text: '{"ok":true}', mimeType: 'application/json' } },
      },
      {
        request: {
          method: 'GET',
          url: 'https://example.com/c',
          headers: [{ name: '', value: 'skip' }, { name: 'Accept', value: 'json' }],
          postData: { mimeType: 'text/plain' },
        },
        response: { status: 200 },
      },
    ]));
    expect(batch.lossReport.some(l => l.includes('missing method/url'))).toBe(true);
    expect(batch.sources.find(s => s.path === '/b')?.responseContentType).toBe('application/json');
    expect(batch.sources.find(s => s.path === '/c')?.responseContentType).toBe('text/plain');
    expect(batch.diagnostics.some(d => d.message.includes('entries'))).toBe(true);
  });
});
