import { describe, expect, it } from 'vitest';
import { analyzeNativeUnsupported, NATIVE_UNAVAILABLE_OPERATORS } from './nativeCapabilities';
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

  it('does not warn about native HTTPS HTTP/2', () => {
    const codes = analyzeNativeUnsupported(def({
      settings: {
        ...DEFAULT_SETTINGS,
        tls: { enabled: true, certPem: 'c', keyPem: 'k', passphrase: 'x' },
      },
    })).map(w => w.code);
    expect(codes).not.toContain('NATIVE_NO_HTTP2');
    expect(codes).not.toContain('NATIVE_NO_KEY_PASSPHRASE');
  });

  it('does not warn when proxy is enabled but fallback is not proxy', () => {
    const codes = analyzeNativeUnsupported(def({
      settings: {
        ...DEFAULT_SETTINGS,
        proxy: { ...DEFAULT_SETTINGS.proxy!, enabled: true },
      },
    })).map(w => w.code);
    expect(codes).not.toContain('NATIVE_NO_PROXY');
    expect(codes).not.toContain('NATIVE_NO_RECORDING');
  });

  it('does not warn when unmatched proxy would record drafts', () => {
    const codes = analyzeNativeUnsupported(def({
      settings: {
        ...DEFAULT_SETTINGS,
        fallback: { ...DEFAULT_SETTINGS.fallback, mode: 'proxy' },
        proxy: { ...DEFAULT_SETTINGS.proxy!, enabled: true, recordAsDrafts: true },
      },
    })).map(w => w.code);
    expect(codes).not.toContain('NATIVE_NO_RECORDING');
    expect(codes).not.toContain('NATIVE_NO_PROXY');
  });

  it('does not warn NATIVE_NO_RECORDING when recordAsDrafts is off', () => {
    const codes = analyzeNativeUnsupported(def({
      settings: {
        ...DEFAULT_SETTINGS,
        fallback: { ...DEFAULT_SETTINGS.fallback, mode: 'proxy' },
        proxy: { ...DEFAULT_SETTINGS.proxy!, enabled: true, recordAsDrafts: false },
      },
    })).map(w => w.code);
    expect(codes).not.toContain('NATIVE_NO_RECORDING');
    expect(codes).not.toContain('NATIVE_NO_PROXY');
  });

  it('does not warn for xpath, xmlSchema, multipart, faker, or dribble', () => {
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
    expect(codes).not.toContain('NATIVE_UNAVAILABLE_OPERATOR');
    expect(codes).not.toContain('NATIVE_LIMITED_FAULTS');
    expect(codes).not.toContain('NATIVE_NO_FAKER');
  });

  it('does not warn for settings callback allowlist', () => {
    const codes = analyzeNativeUnsupported(def({
      settings: { ...DEFAULT_SETTINGS, callbacks: { allowlist: ['https://hook.test'] } },
    })).map(w => w.code);
    expect(codes).not.toContain('NATIVE_NO_CALLBACKS');
  });

  it('does not warn for malformed faults or HTTPS HTTP/2', () => {
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
    expect(codes).not.toContain('NATIVE_NO_HTTP2');
    expect(codes).not.toContain('NATIVE_LIMITED_FAULTS');
    expect(codes).not.toContain('NATIVE_NO_KEY_PASSPHRASE');
  });

  it('implemented features have no native warnings', () => {
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
    expect(codes).toEqual([]);
    expect(codes).not.toContain('NATIVE_NO_RECORDING');
    expect(codes).not.toContain('NATIVE_NO_CALLBACKS');
    expect(codes).not.toContain('NATIVE_NO_JOURNAL_DISK');
    expect(codes).not.toContain('NATIVE_LIMITED_FAULTS');
    expect(codes).not.toContain('NATIVE_UNAVAILABLE_OPERATOR');
    expect(codes).not.toContain('NATIVE_NO_TRANSFORMS');
    expect(codes).not.toContain('NATIVE_NO_FAKER');
    expect(codes).not.toContain('NATIVE_NO_PROXY');
  });

  it('reports unsupported operators when configured', () => {
    const operators = NATIVE_UNAVAILABLE_OPERATORS as string[];
    operators.push('jsonSchema');
    try {
      const codes = analyzeNativeUnsupported(def({
        routes: [{
          id: 'r', name: 'R', enabled: true, method: 'GET',
          path: { kind: 'exact', value: '/' },
          priority: 10,
          predicates: { id: 'g', combinator: 'all', children: [
            { id: 'p', source: 'body', operator: 'jsonSchema', expected: '{}' },
          ] },
          responseMode: 'rules',
          responses: [{
            id: 'v', name: 'V', enabled: true, isDefault: true, status: 200,
            headers: [], cookies: [],
            body: { kind: 'none', content: '' },
            behavior: { delayMs: 0, jitterMs: 0 },
          }],
          tags: [], createdAt: ts, updatedAt: ts,
        }],
      }));

      expect(codes).toEqual([
        expect.objectContaining({
          code: 'NATIVE_UNAVAILABLE_OPERATOR',
          message: expect.stringContaining('jsonSchema'),
        }),
      ]);
    } finally {
      operators.pop();
    }
  });
});
