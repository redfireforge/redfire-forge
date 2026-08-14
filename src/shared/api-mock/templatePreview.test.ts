import { describe, expect, it } from 'vitest';
import type { ApiMockRouteV1 } from './contracts';
import {
  PREVIEW_SAMPLE_ID,
  PREVIEW_SAMPLE_SKU,
  PREVIEW_SAMPLE_TENANT,
  buildPreviewTemplateContext,
  isTemplateBody,
  previewResponseBody,
  samplePathFromPattern,
} from './templatePreview';

const route: Pick<ApiMockRouteV1, 'method' | 'path'> = {
  method: 'GET',
  path: { kind: 'parameterized', value: '/products/:id' },
};

describe('templatePreview', () => {
  it('detects template expressions', () => {
    expect(isTemplateBody('{"id":"static"}')).toBe(false);
    expect(isTemplateBody("{\"id\":\"{{pathParam 'id'}}\"}")).toBe(true);
  });

  it('fills path parameters with the sample id', () => {
    expect(samplePathFromPattern('/products/:id')).toBe(`/products/${PREVIEW_SAMPLE_ID}`);
    expect(samplePathFromPattern('/orders/{orderId}/lines')).toBe(`/orders/${PREVIEW_SAMPLE_ID}/lines`);
    expect(samplePathFromPattern('/health')).toBe('/health');
  });

  it('builds a sample request the helpers can echo', () => {
    const ctx = buildPreviewTemplateContext(route, [{ id: 'v1', key: 'tenant', value: 'acme', sensitive: false }]);
    expect(ctx.request.path).toBe('/products/42');
    expect(ctx.request.pathParams).toEqual({ id: PREVIEW_SAMPLE_ID });
    expect(ctx.request.query.sku).toEqual([PREVIEW_SAMPLE_SKU]);
    expect(ctx.request.headers['x-tenant']).toEqual([PREVIEW_SAMPLE_TENANT]);
    expect(ctx.request.cookies.session).toBe('abc');
    expect(ctx.variables.tenant).toBe('acme');
  });

  it('pretty-prints static JSON without evaluating', () => {
    const result = previewResponseBody('{"id":"static"}', 'application/json', route);
    expect(result.isTemplate).toBe(false);
    expect(result.errors).toEqual([]);
    expect(result.text).toContain('"id": "static"');
  });

  it('returns invalid JSON templates as rendered text', () => {
    const result = previewResponseBody("id={{pathParam 'id'}}", 'application/json', route);
    expect(result.isTemplate).toBe(true);
    expect(result.text).toBe('id=42');
  });

  it('leaves non-JSON bodies unformatted', () => {
    expect(previewResponseBody('<ok/>', 'application/xml', route).text).toBe('<ok/>');
    expect(previewResponseBody('plain', undefined, route).text).toBe('plain');
  });

  it('skips variables with an empty key', () => {
    const ctx = buildPreviewTemplateContext(route, [
      { id: 'v0', key: '', value: 'ignored', sensitive: false },
      { id: 'v1', key: 'tenant', value: 'acme', sensitive: false },
    ]);
    expect(ctx.variables).toEqual({ tenant: 'acme' });
  });

  it('falls back to / when the path is empty', () => {
    expect(samplePathFromPattern('')).toBe('');
    const ctx = buildPreviewTemplateContext({ method: 'GET', path: { kind: 'exact', value: '' } });
    expect(ctx.request.path).toBe('/');
    const result = previewResponseBody('{}', 'application/json', { method: 'ANY', path: { kind: 'exact', value: '' } });
    expect(result.samplePath).toBe('/');
    expect(result.sampleMethod).toBe('GET');
  });

  it('keeps an empty body empty', () => {
    expect(previewResponseBody('', 'application/json', route).text).toBe('');
    expect(previewResponseBody("{{query 'missing'}}", 'application/json', route).text).toBe('');
  });

  it('renders pathParam, query, header, cookie, jsonPath, and variables', () => {
    const body = JSON.stringify({
      id: "{{pathParam 'id'}}",
      sku: "{{query 'sku'}}",
      tenantHeader: "{{header 'x-tenant'}}",
      session: "{{cookie 'session'}}",
      itemSku: "{{jsonPath '$.items[0].sku'}}",
      tenant: '{{variables.tenant}}',
    });
    const result = previewResponseBody(body, 'application/json', route, [
      { id: 'v1', key: 'tenant', value: 'acme', sensitive: false },
    ]);
    expect(result.isTemplate).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.text).toContain(`"id": "${PREVIEW_SAMPLE_ID}"`);
    expect(result.text).toContain(`"sku": "${PREVIEW_SAMPLE_SKU}"`);
    expect(result.text).toContain(`"tenantHeader": "${PREVIEW_SAMPLE_TENANT}"`);
    expect(result.text).toContain('"session": "abc"');
    expect(result.text).toContain(`"itemSku": "${PREVIEW_SAMPLE_SKU}"`);
    expect(result.text).toContain('"tenant": "acme"');
    expect(result.samplePath).toBe('/products/42');
  });

  it('surfaces unknown helpers instead of emptying the body', () => {
    const result = previewResponseBody("{\"oops\":\"{{faker 'not.a.path'}}\"}", 'application/json', route);
    expect(result.errors.some(e => e.includes('Unknown faker helper'))).toBe(true);
    expect(result.text).toContain('"oops"');
  });

  it('treats ANY as GET in the sample request', () => {
    const ctx = buildPreviewTemplateContext({ method: 'ANY', path: { kind: 'exact', value: '/health' } });
    expect(ctx.request.method).toBe('GET');
  });
});
