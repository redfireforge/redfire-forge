import { describe, expect, it } from 'vitest';
import { analyzeNativeUnsupported } from './nativeCapabilities';
import { DEFAULT_SETTINGS } from './defaults';
import type { ApiMockServerDefinitionV1 } from './contracts';

const ts = '2026-08-13T00:00:00.000Z';

function def(patch: Partial<ApiMockServerDefinitionV1> = {}): ApiMockServerDefinitionV1 {
  return {
    id: 's',
    name: 'S',
    enabled: true,
    host: '127.0.0.1',
    port: 4600,
    basePath: '',
    folders: [],
    variables: [],
    samples: [],
    routes: [],
    settings: { ...DEFAULT_SETTINGS },
    createdAt: ts,
    updatedAt: ts,
    ...patch,
  };
}

describe('analyzeNativeUnsupported', () => {
  it('returns no warnings for a plain HTTP definition', () => {
    expect(analyzeNativeUnsupported(def())).toEqual([]);
  });

  it('warns about native HTTPS HTTP/1.1 and passphrase keys', () => {
    const codes = analyzeNativeUnsupported(def({
      settings: {
        ...DEFAULT_SETTINGS,
        tls: { enabled: true, certPem: 'c', keyPem: 'k', passphrase: 'x' },
      },
    })).map(w => w.code);
    expect(codes).toContain('NATIVE_NO_HTTP2');
    expect(codes).toContain('NATIVE_NO_KEY_PASSPHRASE');
  });

  it('warns when proxy is enabled even if fallback is not proxy', () => {
    const codes = analyzeNativeUnsupported(def({
      settings: {
        ...DEFAULT_SETTINGS,
        proxy: { ...DEFAULT_SETTINGS.proxy!, enabled: true },
      },
    })).map(w => w.code);
    expect(codes).toContain('NATIVE_NO_PROXY');
  });

  it('walks nested predicate groups and variant conditions', () => {
    const ts = '2026-08-13T00:00:00.000Z';
    const codes = analyzeNativeUnsupported(def({
      routes: [{
        id: 'r', name: 'R', enabled: true, method: 'GET',
        path: { kind: 'exact', value: '/' },
        priority: 10,
        predicates: {
          id: 'g', combinator: 'all', children: [{
            id: 'inner', combinator: 'any', children: [
              { id: 'p', source: 'body', operator: 'xmlSchema', expected: '<xs/>' },
            ],
          }],
        },
        responseMode: 'rules',
        responses: [{
          id: 'v', name: 'V', enabled: true, isDefault: true, status: 200,
          headers: [], cookies: [],
          body: { kind: 'json', content: '{{faker.internet.email}}', contentType: 'application/json' },
          behavior: { delayMs: 0, jitterMs: 0, fault: 'dribble', chunkSchedule: [{ afterMs: 1, body: 'x' }] },
          conditions: {
            id: 'cg', combinator: 'all',
            children: [{ id: 'cp', source: 'header', selector: 'x', operator: 'exact', expected: '1' }],
          },
        }],
        tags: [], createdAt: ts, updatedAt: ts,
      }],
    })).map(w => w.code);
    expect(codes).toEqual(expect.arrayContaining(['NATIVE_UNAVAILABLE_OPERATOR', 'NATIVE_NO_FAKER', 'NATIVE_LIMITED_FAULTS']));
  });

  it('warns for settings callback allowlist without route callbacks', () => {
    const codes = analyzeNativeUnsupported(def({
      settings: { ...DEFAULT_SETTINGS, callbacks: { allowlist: ['https://hook.test'] } },
    })).map(w => w.code);
    expect(codes).toContain('NATIVE_NO_CALLBACKS');
  });

  it('warns for malformed faults without other extras', () => {
    const ts = '2026-08-13T00:00:00.000Z';
    const codes = analyzeNativeUnsupported(def({
      settings: { ...DEFAULT_SETTINGS, tls: { enabled: true, certPem: 'c', keyPem: 'k' } },
      routes: [{
        id: 'r', name: 'R', enabled: true, method: 'GET',
        path: { kind: 'exact', value: '/' },
        priority: 10,
        predicates: { id: 'g', combinator: 'all', children: [] },
        responseMode: 'rules',
        responses: [{
          id: 'v', name: 'V', enabled: true, isDefault: true, status: 200,
          headers: [], cookies: [],
          body: { kind: 'none', content: '' },
          behavior: { delayMs: 0, jitterMs: 0, fault: 'malformed' },
        }],
        tags: [], createdAt: ts, updatedAt: ts,
      }],
    })).map(w => w.code);
    expect(codes).toContain('NATIVE_NO_HTTP2');
    expect(codes).toContain('NATIVE_LIMITED_FAULTS');
    expect(codes).not.toContain('NATIVE_NO_KEY_PASSPHRASE');
  });

  it('warns about proxy, callbacks, transforms, disk journal, faker, and limited faults', () => {
    const server = def({
      settings: {
        ...DEFAULT_SETTINGS,
        fallback: { ...DEFAULT_SETTINGS.fallback, mode: 'proxy' },
        proxy: { ...DEFAULT_SETTINGS.proxy!, enabled: true },
        callbacks: { allowlist: ['https://example.test/hook'] },
        journal: { ...DEFAULT_SETTINGS.journal, persistToDisk: true },
      },
      routes: [{
        id: 'r', name: 'R', enabled: true, method: 'GET',
        path: { kind: 'exact', value: '/' },
        priority: 10,
        predicates: { id: 'g', combinator: 'all', children: [
          { id: 'p', source: 'body', operator: 'xpath_exists', expected: '//a' },
        ] },
        responseMode: 'rules',
        responses: [{
          id: 'v', name: 'V', enabled: true, isDefault: true, status: 200,
          headers: [{ id: 'h', key: 'X', value: '{{faker.name}}', enabled: true }],
          cookies: [],
          body: { kind: 'json', content: '{}', contentType: 'application/json' },
          behavior: { delayMs: 0, jitterMs: 0, fault: 'reset' },
          transforms: [{ id: 't', enabled: true, target: 'response', op: 'setStatus', value: '201' }],
          callbacks: [{ id: 'c', enabled: true, url: 'https://example.test/hook', method: 'POST', headers: [], bodyTemplate: '', timeoutMs: 1000, maxRetries: 0 }],
        }],
        tags: [], createdAt: ts, updatedAt: ts,
      }],
    });
    const codes = analyzeNativeUnsupported(server).map(w => w.code);
    expect(codes).toEqual(expect.arrayContaining([
      'NATIVE_NO_PROXY',
      'NATIVE_NO_CALLBACKS',
      'NATIVE_NO_TRANSFORMS',
      'NATIVE_NO_JOURNAL_DISK',
      'NATIVE_NO_FAKER',
      'NATIVE_LIMITED_FAULTS',
      'NATIVE_UNAVAILABLE_OPERATOR',
    ]));
  });
});
