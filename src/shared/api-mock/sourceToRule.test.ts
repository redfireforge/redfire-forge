import { describe, it, expect } from 'vitest';
import { convertSourceToRule, convertBatch, type SourceRequest, type ConversionOptions } from './sourceToRule';

const opts: ConversionOptions = { sourceKind: 'curl', sourceLabel: 'test' };

describe('convertSourceToRule', () => {
  it('converts a simple GET to an inactive route', () => {
    const input: SourceRequest = { method: 'GET', path: '/users' };
    const result = convertSourceToRule(input, opts);
    expect(result.route.method).toBe('GET');
    expect(result.route.path.value).toBe('/users');
    expect(result.route.enabled).toBe(false);
    expect(result.route.responseMode).toBe('rules');
    expect(result.route.responses).toHaveLength(1);
  });

  it('creates a matching sample with expected outcome', () => {
    const result = convertSourceToRule({ method: 'POST', path: '/data' }, opts);
    expect(result.sample.routeId).toBe(result.route.id);
    expect(result.sample.expected?.outcome).toBe('matched');
    expect(result.sample.request.method).toBe('POST');
  });

  it('normalizes method to uppercase', () => {
    const result = convertSourceToRule({ method: 'post', path: '/' }, opts);
    expect(result.route.method).toBe('POST');
  });

  it('warns on unknown method', () => {
    const result = convertSourceToRule({ method: 'PURGE', path: '/' }, opts);
    expect(result.route.method).toBe('GET');
    expect(result.diagnostics.some(d => d.code === 'AMS-IMPORT-UNSUPPORTED-FIELD')).toBe(true);
  });

  it('adds exact header predicates', () => {
    const input: SourceRequest = { method: 'GET', path: '/', headers: { 'X-Tenant': 'acme', 'Accept': 'application/json' } };
    const result = convertSourceToRule(input, opts);
    const preds = result.route.predicates.children;
    expect(preds.length).toBeGreaterThanOrEqual(1);
    expect(preds.some(p => 'selector' in p && p.selector === 'accept')).toBe(true);
  });

  it('skips host, user-agent, content-length headers', () => {
    const input: SourceRequest = { method: 'GET', path: '/', headers: { Host: 'example.com', 'User-Agent': 'curl', 'Content-Length': '42', 'X-Custom': 'val' } };
    const result = convertSourceToRule(input, opts);
    const preds = result.route.predicates.children.filter(p => 'selector' in p);
    expect(preds).toHaveLength(1);
  });

  it('warns about authorization secrets', () => {
    const input: SourceRequest = { method: 'GET', path: '/', headers: { Authorization: 'Bearer tok' }, authScheme: 'Bearer' };
    const result = convertSourceToRule(input, opts);
    expect(result.diagnostics.some(d => d.message.includes('secret'))).toBe(true);
  });

  it('creates json_subset predicate for JSON body', () => {
    const input: SourceRequest = { method: 'POST', path: '/', body: '{"name":"Alice"}', contentType: 'application/json' };
    const result = convertSourceToRule(input, opts);
    const bodyPred = result.route.predicates.children.find(p => 'source' in p && p.source === 'body');
    expect(bodyPred).toBeDefined();
    expect('operator' in bodyPred! && bodyPred.operator).toBe('json_subset');
  });

  it('falls back to exact match for invalid JSON body', () => {
    const input: SourceRequest = { method: 'POST', path: '/', body: 'not json', contentType: 'application/json' };
    const result = convertSourceToRule(input, opts);
    expect(result.diagnostics.some(d => d.code === 'AMS-IMPORT-LOSS')).toBe(true);
    const bodyPred = result.route.predicates.children.find(p => 'source' in p && p.source === 'body');
    expect('operator' in bodyPred! && bodyPred.operator).toBe('exact');
  });

  it('uses custom priority and status', () => {
    const result = convertSourceToRule({ method: 'GET', path: '/' }, { ...opts, defaultPriority: 50, defaultStatus: 201 });
    expect(result.route.priority).toBe(50);
    expect(result.route.responses[0].status).toBe(201);
  });

  it('assigns to folder when provided', () => {
    const result = convertSourceToRule({ method: 'GET', path: '/' }, { ...opts, folderId: 'folder-1' });
    expect(result.route.folderId).toBe('folder-1');
  });

  it('sets source metadata', () => {
    const result = convertSourceToRule({ method: 'GET', path: '/' }, opts);
    expect(result.source.kind).toBe('curl');
    expect(result.source.label).toBe('test');
    expect(result.source.importedAt).toBeTruthy();
  });

  it('produces query in sample rawPath', () => {
    const input: SourceRequest = { method: 'GET', path: '/search', query: { q: 'hello' } };
    const result = convertSourceToRule(input, opts);
    expect(result.sample.request.rawPath).toContain('q=hello');
  });
});

describe('convertBatch', () => {
  it('converts multiple inputs', () => {
    const inputs: SourceRequest[] = [
      { method: 'GET', path: '/a' },
      { method: 'POST', path: '/b' },
    ];
    const results = convertBatch(inputs, opts);
    expect(results).toHaveLength(2);
    expect(results[0].route.path.value).toBe('/a');
    expect(results[1].route.path.value).toBe('/b');
  });

  it('each route gets a unique ID', () => {
    const results = convertBatch([{ method: 'GET', path: '/' }, { method: 'GET', path: '/' }], opts);
    expect(results[0].route.id).not.toBe(results[1].route.id);
  });
});
