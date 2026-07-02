/**
 * Phase 10H — Cross-surface result envelope parity acceptance tests.
 *
 * Sub-phase coverage:
 *   10H-A  normalizeGrpcWebUnaryResponse — status / trailer / header field contract
 *   10H-B  GrpcCallResult required-field contract (source-scan) for grpc-web and spring-servlet clients
 *   10H-C  Harness trailer normalization parity with browser transport lowercase trailer outputs
 *   10H-D  Source-scan: adapter dispatchReady flags and stream-client boundary guards
 *   checklist  package.json test:grpc:phase10h gate traceability
 */
import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import path from 'path';

import pkg from '../../../package.json';
import { normalizeGrpcWebUnaryResponse } from './grpcWebTrailerNormalize';
import { encodeGrpcWebDataFrame, encodeGrpcWebTrailerFrame } from './grpcWebFramingCodec';
import {
  normalizeGrpcHarnessTrailers,
  resolveGrpcHarnessTrailerValue,
} from './grpcHarnessTrailerNormalize';
import { evaluateGrpcHarnessAssertions } from './grpcHarnessAssertEngine';
import { evaluateGrpcWorkflowAssertions } from '../../features/workflow/utils/grpcWorkflowAssertEngine';

// ── Source-scan helpers ───────────────────────────────────────────────────────
const ROOT = fileURLToPath(new URL('../..', import.meta.url)); // → src/

function readSrc(relPath: string): string {
  return readFileSync(path.join(ROOT, relPath), 'utf-8');
}

// ── Test helpers ──────────────────────────────────────────────────────────────

/** Build a Headers instance from a plain object for normalizeGrpcWebUnaryResponse input. */
function makeHeaders(entries: Record<string, string>): Headers {
  const h = new Headers();
  for (const [k, v] of Object.entries(entries)) {
    h.append(k, v);
  }
  return h;
}

/**
 * Encode a trailer block as a grpc-web trailer frame (type 0x80).
 * Uses the codec's own encoder for correctness parity with the production path.
 */
function trailerFrame(trailerText: string): Uint8Array {
  const payload = new TextEncoder().encode(trailerText);
  return encodeGrpcWebTrailerFrame(payload);
}

// ── Phase 10H-A: normalizeGrpcWebUnaryResponse — status and trailer/header fields ─────

describe('Phase 10H-A — normalizeGrpcWebUnaryResponse: canonical status + trailer mapping', () => {
  it('returns status 0 when no grpc-status is present in headers or trailer', () => {
    const body = trailerFrame('x-custom: value\r\n');
    const result = normalizeGrpcWebUnaryResponse({
      responseHeaders: makeHeaders({ 'content-type': 'application/grpc-web+proto' }),
      body,
      contentType: 'application/grpc-web+proto',
    });
    expect(result.status).toBe(0);
  });

  it('reads grpc-status and grpc-message from in-body trailer frame', () => {
    const body = trailerFrame('grpc-status: 3\r\ngrpc-message: INVALID_ARGUMENT\r\n');
    const result = normalizeGrpcWebUnaryResponse({
      responseHeaders: makeHeaders({ 'content-type': 'application/grpc-web+proto' }),
      body,
      contentType: 'application/grpc-web+proto',
    });
    expect(result.status).toBe(3);
    expect(result.statusMessage).toBe('INVALID_ARGUMENT');
  });

  it('reads grpc-status from HTTP response headers (Envoy / nginx proxy pattern)', () => {
    const result = normalizeGrpcWebUnaryResponse({
      responseHeaders: makeHeaders({
        'content-type': 'application/grpc-web+proto',
        'grpc-status': '14',
        'grpc-message': 'UNAVAILABLE',
      }),
      body: new Uint8Array(0),
      contentType: 'application/grpc-web+proto',
    });
    expect(result.status).toBe(14);
    expect(result.statusMessage).toBe('UNAVAILABLE');
  });

  it('prefers HTTP response header grpc-status when header and trailer frame disagree', () => {
    const body = trailerFrame('grpc-status: 7\r\ngrpc-message: permission%20denied\r\n');
    const result = normalizeGrpcWebUnaryResponse({
      responseHeaders: makeHeaders({
        'content-type': 'application/grpc-web+proto',
        'grpc-status': '0',
        'grpc-message': '',
      }),
      body,
      contentType: 'application/grpc-web+proto',
    });
    expect(result.status).toBe(0);
    expect(result.statusMessage).toBe('OK');
  });

  it('falls back to in-body trailer frame grpc-status when HTTP header is absent', () => {
    const body = trailerFrame('grpc-status: 7\r\ngrpc-message: permission%20denied\r\n');
    const result = normalizeGrpcWebUnaryResponse({
      responseHeaders: makeHeaders({ 'content-type': 'application/grpc-web+proto' }),
      body,
      contentType: 'application/grpc-web+proto',
    });
    expect(result.status).toBe(7);
    expect(result.statusMessage).toBe('permission denied');
  });

  it('extracts data payloads from grpc-web data frames', () => {
    const payload = new Uint8Array([0x0a, 0x02, 0x68, 0x69]);
    const body = encodeGrpcWebDataFrame(payload);
    const result = normalizeGrpcWebUnaryResponse({
      responseHeaders: makeHeaders({
        'content-type': 'application/grpc-web+proto',
        'grpc-status': '0',
      }),
      body,
      contentType: 'application/grpc-web+proto',
    });
    expect(Array.from(result.dataPayloads[0] ?? [])).toEqual(Array.from(payload));
  });

  it('normalizes trailer keys to lowercase', () => {
    const body = trailerFrame('X-Custom-Trace: abc123\r\ngrpc-status: 0\r\n');
    const result = normalizeGrpcWebUnaryResponse({
      responseHeaders: makeHeaders({ 'content-type': 'application/grpc-web+proto' }),
      body,
      contentType: 'application/grpc-web+proto',
    });
    expect(result.trailers['x-custom-trace']).toBe('abc123');
    expect(result.trailers['X-Custom-Trace']).toBeUndefined();
  });

  it('strips grpc-status and grpc-message from returned trailers (promoted to status fields)', () => {
    const body = trailerFrame('grpc-status: 0\r\ngrpc-message: OK\r\nx-trace: t1\r\n');
    const result = normalizeGrpcWebUnaryResponse({
      responseHeaders: makeHeaders({ 'content-type': 'application/grpc-web+proto' }),
      body,
      contentType: 'application/grpc-web+proto',
    });
    expect(result.trailers['grpc-status']).toBeUndefined();
    expect(result.trailers['grpc-message']).toBeUndefined();
    expect(result.trailers['x-trace']).toBe('t1');
  });

  it('strips grpc-* keys from returned response headers (grpc-encoding, grpc-status)', () => {
    const result = normalizeGrpcWebUnaryResponse({
      responseHeaders: makeHeaders({
        'content-type': 'application/grpc-web+proto',
        'grpc-encoding': 'identity',
        'grpc-status': '0',
        'x-request-id': 'req-xyz',
      }),
      body: new Uint8Array(0),
      contentType: 'application/grpc-web+proto',
    });
    expect(result.headers['grpc-encoding']).toBeUndefined();
    expect(result.headers['grpc-status']).toBeUndefined();
    expect(result.headers['x-request-id']).toBe('req-xyz');
  });

  it('percent-decodes grpc-message to human-readable string', () => {
    const body = trailerFrame('grpc-status: 3\r\ngrpc-message: Field%20name%20required\r\n');
    const result = normalizeGrpcWebUnaryResponse({
      responseHeaders: makeHeaders({ 'content-type': 'application/grpc-web+proto' }),
      body,
      contentType: 'application/grpc-web+proto',
    });
    expect(result.statusMessage).toBe('Field name required');
  });

  it('merges grpc-* and -bin HTTP response headers into returned trailers', () => {
    const body = trailerFrame('x-trace: from-body\r\ngrpc-status: 0\r\n');
    const result = normalizeGrpcWebUnaryResponse({
      responseHeaders: makeHeaders({
        'content-type': 'application/grpc-web+proto',
        'grpc-status': '0',
        'grpc-message': '',
        'x-request-bin': 'YmFzZTY0',
      }),
      body,
      contentType: 'application/grpc-web+proto',
    });
    expect(result.trailers['x-request-bin']).toBe('YmFzZTY0');
    expect(result.trailers['x-trace']).toBe('from-body');
  });

  it('prefers HTTP grpc-message when header and trailer frame messages disagree', () => {
    const body = trailerFrame('grpc-status: 3\r\ngrpc-message: trailer%20message\r\n');
    const result = normalizeGrpcWebUnaryResponse({
      responseHeaders: makeHeaders({
        'content-type': 'application/grpc-web+proto',
        'grpc-status': '3',
        'grpc-message': 'header%20message',
      }),
      body,
      contentType: 'application/grpc-web+proto',
    });
    expect(result.status).toBe(3);
    expect(result.statusMessage).toBe('header message');
  });

  it('maps invalid grpc-status values to UNKNOWN (status 2)', () => {
    const body = trailerFrame('grpc-status: not-a-number\r\ngrpc-message: bad%20status\r\n');
    const result = normalizeGrpcWebUnaryResponse({
      responseHeaders: makeHeaders({ 'content-type': 'application/grpc-web+proto' }),
      body,
      contentType: 'application/grpc-web+proto',
    });
    expect(result.status).toBe(2);
    expect(result.statusMessage).toBe('bad status');
  });

  it('returns empty trailers and preserves non-grpc headers for an empty body', () => {
    const result = normalizeGrpcWebUnaryResponse({
      responseHeaders: makeHeaders({ 'content-type': 'application/grpc-web+proto' }),
      body: new Uint8Array(0),
      contentType: 'application/grpc-web+proto',
    });
    expect(result.trailers).toEqual({});
    // content-type is a non-grpc header — it is preserved in responseHeaders
    expect(result.headers['content-type']).toBe('application/grpc-web+proto');
    expect(result.headers['grpc-status']).toBeUndefined();
    expect(result.dataPayloads).toEqual([]);
  });
});

// ── Phase 10H-B: GrpcCallResult contract — source-scan for required fields ────

describe('Phase 10H-B — GrpcCallResult contract: browser transport clients declare all required fields', () => {
  it('grpcGrpcWebUnaryClient.ts declares callType field as unary in result', () => {
    const src = readSrc('shared/grpc/grpcGrpcWebUnaryClient.ts');
    expect(src).toContain("callType: 'unary'");
  });

  it('grpcGrpcWebUnaryClient.ts sets transportUsed to grpc-web', () => {
    const src = readSrc('shared/grpc/grpcGrpcWebUnaryClient.ts');
    expect(src).toContain("transportUsed: 'grpc-web'");
  });

  it('grpcGrpcWebUnaryClient.ts sets durationMs in result', () => {
    const src = readSrc('shared/grpc/grpcGrpcWebUnaryClient.ts');
    expect(src).toContain('durationMs');
  });

  it('grpcGrpcWebUnaryClient.ts assembles all canonical GrpcCallResult envelope fields', () => {
    const src = readSrc('shared/grpc/grpcGrpcWebUnaryClient.ts');
    for (const field of ['status:', 'statusMessage:', 'headers:', 'trailers:', 'body:'] as const) {
      expect(src).toContain(field);
    }
  });

  it('grpcGrpcWebUnaryClient.ts sets errorDetail on non-zero status', () => {
    const src = readSrc('shared/grpc/grpcGrpcWebUnaryClient.ts');
    expect(src).toContain('errorDetail');
  });

  it('grpcGrpcSpringServletUnaryClient.ts declares callType field as unary in result', () => {
    const src = readSrc('shared/grpc/grpcGrpcSpringServletUnaryClient.ts');
    expect(src).toContain("callType: 'unary'");
  });

  it('grpcGrpcSpringServletUnaryClient.ts sets transportUsed to spring-servlet', () => {
    const src = readSrc('shared/grpc/grpcGrpcSpringServletUnaryClient.ts');
    expect(src).toContain("transportUsed: 'spring-servlet'");
  });

  it('grpcGrpcSpringServletUnaryClient.ts sets durationMs in result', () => {
    const src = readSrc('shared/grpc/grpcGrpcSpringServletUnaryClient.ts');
    expect(src).toContain('durationMs');
  });

  it('grpcGrpcSpringServletUnaryClient.ts assembles all canonical GrpcCallResult envelope fields', () => {
    const src = readSrc('shared/grpc/grpcGrpcSpringServletUnaryClient.ts');
    for (const field of ['status:', 'statusMessage:', 'headers:', 'trailers:', 'body:'] as const) {
      expect(src).toContain(field);
    }
  });

  it('grpcGrpcSpringServletUnaryClient.ts sets errorDetail on non-zero status', () => {
    const src = readSrc('shared/grpc/grpcGrpcSpringServletUnaryClient.ts');
    expect(src).toContain('errorDetail');
  });

  it('grpcGrpcWebUnaryClient.ts uses normalizeGrpcWebUnaryResponse for canonical field mapping', () => {
    const src = readSrc('shared/grpc/grpcGrpcWebUnaryClient.ts');
    expect(src).toContain('normalizeGrpcWebUnaryResponse');
  });

  it('grpcGrpcSpringServletUnaryClient.ts uses normalizeGrpcWebUnaryResponse for canonical field mapping', () => {
    const src = readSrc('shared/grpc/grpcGrpcSpringServletUnaryClient.ts');
    // spring-servlet reuses the same normalizer for trailer/header field mapping
    expect(src).toContain('normalizeGrpcWebUnaryResponse');
  });

  it('grpcBrowserTransportAdapters.ts: express adapter attaches transportUsed on unary results', () => {
    const src = readSrc('shared/grpc/grpcBrowserTransportAdapters.ts');
    expect(src).toContain("attachUnaryTransportMeta(envelope.data, 'express'");
  });

  it('grpcNativeTauriTransport.ts maps native unary results to canonical GrpcCallResult fields', () => {
    const src = readSrc('shared/grpc/grpcNativeTauriTransport.ts');
    expect(src).toContain("callType: 'unary'");
    expect(src).toContain('statusMessage');
    expect(src).toContain('trailers');
    expect(src).toContain('durationMs');
    expect(src).toContain('transportUsed');
  });

  it('grpcBrowserTransportAdapters.ts: tauri adapter attaches transportUsed on unary results', () => {
    const src = readSrc('shared/grpc/grpcBrowserTransportAdapters.ts');
    expect(src).toContain("attachUnaryTransportMeta(\n        mapGrpcTauriUnaryResultToCallResult(nativeResult),\n        'tauri',");
  });

  it('grpcWorkflowOutputAdapter.ts consumes grpc status fields without transport-specific branching', () => {
    const src = readSrc('features/workflow/utils/grpcWorkflowOutputAdapter.ts');
    expect(src).toContain('stepResult.grpcStatus');
    expect(src).toContain('stepResult.grpcStatusMessage');
    expect(src).not.toMatch(/grpc-web|spring-servlet|transportUsed/);
  });
});

// ── Phase 10H-C: Harness trailer normalization parity ────────────────────────

describe('Phase 10H-C — harness trailer normalization: parity with browser transport outputs', () => {
  it('preserves already-lowercase trailer keys (as produced by normalizeGrpcWebUnaryResponse)', () => {
    const trailers = { 'x-trace': 'abc', 'grpc-status': '0' };
    const result = normalizeGrpcHarnessTrailers(trailers);
    expect(result).toEqual({ 'x-trace': 'abc', 'grpc-status': '0' });
  });

  it('lowercases uppercase trailer keys for stable lookup parity', () => {
    const trailers = { 'X-Trace-ID': 'abc', 'GRPC-STATUS': '0' };
    const result = normalizeGrpcHarnessTrailers(trailers);
    expect(result?.['x-trace-id']).toBe('abc');
    expect(result?.['grpc-status']).toBe('0');
    expect(result?.['X-Trace-ID']).toBeUndefined();
  });

  it('returns undefined for an undefined trailer map', () => {
    expect(normalizeGrpcHarnessTrailers(undefined)).toBeUndefined();
  });

  it('resolveGrpcHarnessTrailerValue finds value with exact lowercase key', () => {
    const trailers = { 'x-trace-id': 'abc123' };
    expect(resolveGrpcHarnessTrailerValue(trailers, 'x-trace-id')).toBe('abc123');
  });

  it('resolveGrpcHarnessTrailerValue finds value with mixed-case lookup key (case-insensitive)', () => {
    const trailers = { 'x-trace-id': 'abc123' };
    expect(resolveGrpcHarnessTrailerValue(trailers, 'X-Trace-ID')).toBe('abc123');
  });

  it('resolveGrpcHarnessTrailerValue returns undefined for a missing key', () => {
    const trailers = { 'x-trace-id': 'abc123' };
    expect(resolveGrpcHarnessTrailerValue(trailers, 'x-missing')).toBeUndefined();
  });

  it('resolveGrpcHarnessTrailerValue returns undefined for an undefined trailer map', () => {
    expect(resolveGrpcHarnessTrailerValue(undefined, 'x-trace-id')).toBeUndefined();
  });

  it('resolveGrpcHarnessTrailerValue resolves trailers produced by normalizeGrpcWebUnaryResponse', () => {
    const body = trailerFrame('grpc-status: 0\r\ngrpc-message: OK\r\nx-trace-id: abc123\r\n');
    const normalized = normalizeGrpcWebUnaryResponse({
      responseHeaders: makeHeaders({ 'content-type': 'application/grpc-web+proto' }),
      body,
      contentType: 'application/grpc-web+proto',
    });
    expect(resolveGrpcHarnessTrailerValue(normalized.trailers, 'X-Trace-ID')).toBe('abc123');
  });

  it('grpcHarnessAssertEngine.ts resolves grpcTrailer assertions via resolveGrpcHarnessTrailerValue', () => {
    const src = readSrc('shared/grpc/grpcHarnessAssertEngine.ts');
    expect(src).toContain('resolveGrpcHarnessTrailerValue');
    expect(src).toContain('grpcTrailer');
    expect(src).not.toMatch(/function resolveTrailerValue/);
  });

  it('grpcWorkflowAssertEngine.ts resolves grpcTrailer assertions via resolveGrpcHarnessTrailerValue', () => {
    const src = readSrc('features/workflow/utils/grpcWorkflowAssertEngine.ts');
    expect(src).toContain('resolveGrpcHarnessTrailerValue');
    expect(src).toContain('grpcTrailer');
    expect(src).not.toMatch(/function resolveTrailerValue/);
  });

  it('harness grpcTrailer assertions resolve normalized browser transport trailer keys', () => {
    const body = trailerFrame('grpc-status: 0\r\ngrpc-message: OK\r\nx-trace-id: abc123\r\n');
    const normalized = normalizeGrpcWebUnaryResponse({
      responseHeaders: makeHeaders({ 'content-type': 'application/grpc-web+proto' }),
      body,
      contentType: 'application/grpc-web+proto',
    });
    const outcome = {
      callType: 'unary' as const,
      passed: true,
      grpcStatus: 0,
      durationMs: 5,
      body: {},
      trailers: normalized.trailers,
      attempts: 1,
    };
    expect(evaluateGrpcHarnessAssertions(outcome, [{
      grpcTrailer: 'X-Trace-ID',
      equals: 'abc123',
    }]).passed).toBe(true);
  });

  it('workflow grpcTrailer assertions resolve normalized browser transport trailer keys', () => {
    const body = trailerFrame('grpc-status: 0\r\ngrpc-message: OK\r\nx-trace-id: abc123\r\n');
    const normalized = normalizeGrpcWebUnaryResponse({
      responseHeaders: makeHeaders({ 'content-type': 'application/grpc-web+proto' }),
      body,
      contentType: 'application/grpc-web+proto',
    });
    const outcome = evaluateGrpcWorkflowAssertions(
      {
        nodeId: 'wf-node-1',
        callType: 'unary',
        status: 'success',
        grpcStatus: 0,
        durationMs: 12,
        trailers: normalized.trailers,
      },
      [{ grpcTrailer: 'X-Trace-ID', equals: 'abc123' }],
    );
    expect(outcome.passed).toBe(true);
  });
});

// ── Phase 10H-D: Source-scan — adapter readiness and streaming boundary guards ─

describe('Phase 10H-D — source-scan: adapter readiness and streaming boundary guards', () => {
  it('grpcBrowserTransportAdapters.ts: grpc-web adapter declares dispatchReady: true (Phase 10C)', () => {
    const src = readSrc('shared/grpc/grpcBrowserTransportAdapters.ts');
    const grpcWebSection = src.slice(
      src.indexOf('function createGrpcWebAdapter'),
      src.indexOf('function createSpringServletAdapter'),
    );
    expect(grpcWebSection).toContain("mode: 'grpc-web'");
    expect(grpcWebSection).toContain('dispatchReady: true');
    expect(grpcWebSection).toContain('invokeGrpcWebUnary');
  });

  it('grpcBrowserTransportAdapters.ts: spring-servlet adapter is registered in the adapters map', () => {
    const src = readSrc('shared/grpc/grpcBrowserTransportAdapters.ts');
    expect(src).toContain("mode: 'spring-servlet'");
  });

  it('grpcBrowserTransportAdapters.ts: spring-servlet adapter declares dispatchReady: true (Phase 10D)', () => {
    const src = readSrc('shared/grpc/grpcBrowserTransportAdapters.ts');
    const springSection = src.slice(src.indexOf("mode: 'spring-servlet'"));
    expect(springSection).toContain('dispatchReady: true');
  });

  it('grpcBrowserTransportAdapters.ts: grpc-web invokeUnary calls the client (not a stub)', () => {
    const src = readSrc('shared/grpc/grpcBrowserTransportAdapters.ts');
    expect(src).toContain('invokeGrpcWebUnary');
  });

  it('grpcBrowserTransportAdapters.ts: spring-servlet invokeUnary calls the client (not a stub)', () => {
    const src = readSrc('shared/grpc/grpcBrowserTransportAdapters.ts');
    expect(src).toContain('invokeGrpcSpringServletUnary');
  });

  it('grpcBrowserTransportAdapters.ts: grpc-web adapter omits startStream (Phase 10H streaming boundary)', () => {
    const src = readSrc('shared/grpc/grpcBrowserTransportAdapters.ts');
    const grpcWebSection = src.slice(
      src.indexOf('function createGrpcWebAdapter'),
      src.indexOf('function createSpringServletAdapter'),
    );
    expect(grpcWebSection).not.toContain('startStream');
  });

  it('grpcBrowserTransportAdapters.ts: spring-servlet adapter omits startStream (Phase 10H streaming boundary)', () => {
    const src = readSrc('shared/grpc/grpcBrowserTransportAdapters.ts');
    const springSection = src.slice(
      src.indexOf('function createSpringServletAdapter'),
      src.indexOf('const EXPRESS_ADAPTER'),
    );
    expect(springSection).not.toContain('startStream');
  });

  it('grpcBrowserTransportAdapters.ts: express adapter retains startStream for server streaming', () => {
    const src = readSrc('shared/grpc/grpcBrowserTransportAdapters.ts');
    const expressSection = src.slice(
      src.indexOf('function createExpressAdapter'),
      src.indexOf('function createTauriAdapter'),
    );
    expect(expressSection).toContain('dispatchReady: true');
    expect(expressSection).toContain('startStream');
  });

  it('grpcStreamClient.ts: routes grpc-web server streaming to browser-direct start handler', () => {
    const src = readSrc('shared/grpc/grpcStreamClient.ts');
    expect(src).toContain("'grpc-web'");
    expect(src).toContain('startBrowserDirectServerStream');
  });

  it('grpcStreamClient.ts: routes spring-servlet server streaming to browser-direct start handler', () => {
    const src = readSrc('shared/grpc/grpcStreamClient.ts');
    expect(src).toContain("'spring-servlet'");
    expect(src).toContain('startBrowserDirectServerStream');
  });

  it('grpcWebTrailerNormalize.ts: normalizeGrpcWebUnaryResponse is exported', () => {
    const src = readSrc('shared/grpc/grpcWebTrailerNormalize.ts');
    expect(src).toContain('export function normalizeGrpcWebUnaryResponse');
  });

  it('grpcBrowserTransportRouter.ts: resolveGrpcBrowserTransportAdapter is exported for downstream use', () => {
    const src = readSrc('shared/grpc/grpcBrowserTransportRouter.ts');
    expect(src).toContain('export function resolveGrpcBrowserTransportAdapter');
  });

  it('grpcBrowserTransportAdapters.ts: GRPC_BROWSER_TRANSPORT_ADAPTERS map includes all four modes', () => {
    const src = readSrc('shared/grpc/grpcBrowserTransportAdapters.ts');
    expect(src).toContain('GRPC_BROWSER_TRANSPORT_ADAPTERS');
    expect(src).toContain("express:");
    expect(src).toContain("tauri:");
    // grpc-web and spring-servlet are present (single-quoted keys with hyphens)
    expect(src).toContain("'grpc-web':");
    expect(src).toContain("'spring-servlet':");
  });
});

describe('Phase 10H acceptance checklist', () => {
  it('package.json exposes test:grpc:phase10h', () => {
    expect(pkg.scripts?.['test:grpc:phase10h']).toContain('test-grpc-phase10h.sh');
  });
});
