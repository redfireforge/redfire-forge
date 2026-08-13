import { describe, expect, it } from 'vitest';
import {
  draftFingerprint,
  mergeRecordedDraftsIntoRoutes,
  proxiedExchangeToDraft,
  toRecordedDraft,
  nativeCaptureToDraft,
  redactHeaderMap,
  routeFingerprintFromRoute,
} from './proxyRecording';
import { createDefaultResponse, DEFAULT_SETTINGS } from './defaults';
import type { ApiMockCapturedRequestV1, ApiMockRouteV1 } from './contracts';
import type { NativeProxyCaptureV1 } from './proxyRecording';

const ts = '2026-08-12T12:00:00.000Z';

function makeRequest(overrides: Partial<ApiMockCapturedRequestV1> = {}): ApiMockCapturedRequestV1 {
  return {
    method: 'GET',
    path: '/users/1',
    rawPath: '/users/1',
    headers: { authorization: ['Bearer secret'], accept: ['application/json'] },
    query: {},
    cookies: {},
    body: null,
    bodyTruncated: false,
    receivedAt: ts,
    ...overrides,
  };
}

describe('proxyRecording', () => {
  it('redacts secret headers with scheme preserved', () => {
    const out = redactHeaderMap({ Authorization: 'Bearer tok', Accept: 'json' });
    expect(out.Authorization).toBe('Bearer [REDACTED]');
    expect(out.Accept).toBe('json');
  });

  it('redacts without preserving scheme and joins array header values', () => {
    const out = redactHeaderMap(
      { Authorization: ['Basic abc', 'extra'], 'X-Api-Key': 'k' },
      ['authorization', 'x-api-key'],
      false,
    );
    expect(out.Authorization).toBe('[REDACTED]');
    expect(out['X-Api-Key']).toBe('[REDACTED]');
  });

  it('redacts secret values that have no auth scheme token', () => {
    const out = redactHeaderMap({ Authorization: 'secret-only' });
    expect(out.Authorization).toBe('[REDACTED]');
  });

  it('builds inactive draft with response body and redaction diagnostic', () => {
    const conversion = proxiedExchangeToDraft(
      makeRequest(),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: '{"id":1}',
        contentType: 'application/json',
      },
      DEFAULT_SETTINGS,
    );
    expect(conversion.route.enabled).toBe(false);
    expect(conversion.route.responses[0]?.status).toBe(200);
    expect(conversion.route.responses[0]?.body.content).toContain('id');
    expect(conversion.diagnostics.some(d => d.code === 'AMS-REDACTION-SECRET-DETECTED')).toBe(true);
  });

  it('maps query params and resolves content-type from response headers', () => {
    const conversion = proxiedExchangeToDraft(
      makeRequest({
        headers: { accept: ['application/json'] },
        query: { q: ['one'], page: '2' },
      }),
      {
        status: 201,
        headers: { 'Content-Type': ['application/json', 'charset=utf-8'] },
        body: '{"ok":true}',
      },
      DEFAULT_SETTINGS,
    );
    expect(conversion.route.responses[0]?.status).toBe(201);
    expect(conversion.route.responses[0]?.body.contentType).toBe('application/json');
    expect(conversion.diagnostics.some(d => d.code === 'AMS-REDACTION-SECRET-DETECTED')).toBe(false);
  });

  it('uses explicit response contentType when provided', () => {
    const conversion = proxiedExchangeToDraft(
      makeRequest({ headers: { accept: ['text/plain'] } }),
      { status: 200, headers: {}, body: 'ok', contentType: 'text/plain' },
      DEFAULT_SETTINGS,
    );
    expect(conversion.route.responses[0]?.body.contentType).toBe('text/plain');
  });

  it('defaults redaction settings and resolves lowercase content-type arrays', () => {
    const conversion = proxiedExchangeToDraft(
      makeRequest({
        query: { empty: [] },
        body: '{"a":1}',
        headers: { accept: ['application/json'], 'content-type': ['application/json'] },
      }),
      {
        status: 200,
        headers: { 'content-type': ['text/plain'] },
        body: 'plain',
      },
    );
    expect(conversion.route.responses[0]?.body.contentType).toBe('text/plain');
  });

  it('honours custom redaction settings from server config', () => {
    const conversion = proxiedExchangeToDraft(
      makeRequest({ headers: { 'x-custom': 'secret' } }),
      { status: 200, headers: {}, body: '{}' },
      {
        ...DEFAULT_SETTINGS,
        redaction: { headerNames: ['x-custom'], preserveScheme: false },
      },
    );
    expect(conversion.diagnostics.some(d => d.code === 'AMS-REDACTION-SECRET-DETECTED')).toBe(true);
  });

  it('dedupes drafts by fingerprint when merging', () => {
    const conversion = proxiedExchangeToDraft(
      makeRequest(),
      { status: 200, headers: {}, body: '{}' },
      DEFAULT_SETTINGS,
    );
    const fp = draftFingerprint('GET', '/users/1', 200);
    const draft = toRecordedDraft(conversion, fp, ts);
    const existing: ApiMockRouteV1[] = [{
      ...conversion.route,
      id: 'existing',
      responses: [{ ...createDefaultResponse('r'), status: 200 }],
    }];
    const merged = mergeRecordedDraftsIntoRoutes(existing, [draft]);
    expect(merged.added).toBe(0);
    expect(merged.skipped).toBe(1);

    const empty = mergeRecordedDraftsIntoRoutes([], [draft]);
    expect(empty.added).toBe(1);
    expect(empty.routes[0].enabled).toBe(false);
  });

  it('builds route fingerprints and default recorded draft timestamps', () => {
    const conversion = proxiedExchangeToDraft(
      makeRequest({ headers: { accept: ['application/json'] } }),
      { status: 404, headers: {}, body: 'missing' },
      DEFAULT_SETTINGS,
    );
    const route = {
      ...conversion.route,
      responses: [
        { ...createDefaultResponse('off'), enabled: false, status: 500 },
        { ...createDefaultResponse('on'), enabled: true, status: 404 },
      ],
    };
    expect(routeFingerprintFromRoute(route)).toBe('GET /users/1 → 404');

    const firstOnly = {
      ...conversion.route,
      responses: [{ ...createDefaultResponse('only'), enabled: false, status: 503 }],
    };
    expect(routeFingerprintFromRoute(firstOnly)).toBe('GET /users/1 → 503');

    const none = { ...conversion.route, responses: [] as ApiMockRouteV1['responses'] };
    expect(routeFingerprintFromRoute(none)).toBe('GET /users/1 → 200');

    const draft = toRecordedDraft(conversion, 'fp');
    expect(draft.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('converts a native capture while preserving id and recordedAt', () => {
    const capture = {
      id: 'rec-native01',
      fingerprint: 'GET /users/1 → 200',
      recordedAt: ts,
      request: makeRequest(),
      response: { status: 200, headers: { 'content-type': 'application/json' }, body: '{"id":1}' },
      redaction: DEFAULT_SETTINGS.redaction,
    };
    const draft = nativeCaptureToDraft(capture);
    expect(draft?.id).toBe('rec-native01');
    expect(draft?.recordedAt).toBe(ts);
    expect(draft?.fingerprint).toBe('GET /users/1 → 200');
    expect(draft?.route.enabled).toBe(false);
    expect(draft?.diagnostics.some(d => d.code === 'AMS-REDACTION-SECRET-DETECTED')).toBe(true);
  });

  it('returns null when a native capture cannot be converted', () => {
    expect(nativeCaptureToDraft({} as NativeProxyCaptureV1)).toBeNull();
  });
});
