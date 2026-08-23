/**
 * Phase 10I — Hardening gate acceptance tests.
 *
 * Validates all six Phase 10 acceptance checklist items:
 *   10I-A  Preflight enforcement — client_streaming/bidi_streaming blocked on grpc-web/spring-servlet
 *   10I-B  grpc-web-text and binary content-type interoperability
 *   10I-C  CORS/proxy failure classification and actionable error messages
 *   10I-D  In-flight transport lock — canChangeGrpcTabTransportMode lifecycle coverage
 *   10I-E  Spring Servlet package-qualified path resolution
 *   10I-F  Phase 10 acceptance checklist traceability source-scan
 */
import { describe, it, expect, afterEach } from 'vitest';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import path from 'path';

import pkg from '../../../package.json';
import {
  assertGrpcTransportExecutePreflight,
  assertGrpcTransportCallTypeSupported,
  GrpcWebTransportPreflightError,
  isGrpcTransportCallTypeSupported,
} from './grpcWebTransportContracts';
import {
  encodeGrpcWebTextBody,
  decodeGrpcWebTextBody,
  decodeGrpcWebResponseBody,
  encodeGrpcWebTrailerFrame,
  isGrpcWebTextContentType,
} from './grpcWebFramingCodec';
import {
  classifyBrowserTransportFetchFailure,
  classifyBrowserTransportHttpResponse,
  extractBrowserTransportFailure,
  formatBrowserTransportFailureMessage,
  isBrowserDirectTransportMode,
  mapBrowserTransportFetchFailure,
  shouldSuggestExpressProxyForBrowserFailure,
} from './grpcBrowserTransportErrorMapper';
import { startGrpcStream } from './grpcStreamClient';
import {
  bindGrpcStreamTransportForTab,
  resetGrpcStreamTransportBindingsForTests,
} from './grpcTransportFallback';
import {
  resetGrpcTabTransportRoutingForTests,
  syncGrpcTabTransportMode,
} from './grpcTransportTabRouting';
import {
  buildSpringServletMethodPath,
  resolveSpringServletPathCandidates,
  normalizeSpringServletServiceSegment,
  normalizeSpringServletMethodSegment,
  buildSpringServletMethodUrl,
  buildSpringServletMethodUrls,
} from './grpcSpringServletPathResolver';
import {
  canChangeGrpcTabTransportMode,
  isGrpcLifecycleInFlight,
  createGrpcStudioTab,
} from '@grpc/grpcStudioTypes';

// ── Source-scan helpers ───────────────────────────────────────────────────────
const ROOT = fileURLToPath(new URL('../..', import.meta.url)); // → src/

function readSrc(relPath: string): string {
  return readFileSync(path.join(ROOT, relPath), 'utf-8');
}

// ── Phase 10I-A: Preflight enforcement ───────────────────────────────────────

describe('Phase 10I-A — preflight enforcement: blocked call types on browser-direct transports', () => {
  afterEach(() => {
    resetGrpcTabTransportRoutingForTests();
  });

  it('assertGrpcTransportExecutePreflight throws for client_streaming + grpc-web', () => {
    expect(() =>
      assertGrpcTransportExecutePreflight({ transportMode: 'grpc-web', callType: 'client_streaming' }),
    ).toThrow(GrpcWebTransportPreflightError);
  });

  it('assertGrpcTransportExecutePreflight throws for bidi_streaming + grpc-web', () => {
    expect(() =>
      assertGrpcTransportExecutePreflight({ transportMode: 'grpc-web', callType: 'bidi_streaming' }),
    ).toThrow(GrpcWebTransportPreflightError);
  });

  it('assertGrpcTransportExecutePreflight throws for client_streaming + spring-servlet', () => {
    expect(() =>
      assertGrpcTransportExecutePreflight({ transportMode: 'spring-servlet', callType: 'client_streaming' }),
    ).toThrow(GrpcWebTransportPreflightError);
  });

  it('assertGrpcTransportExecutePreflight throws for bidi_streaming + spring-servlet', () => {
    expect(() =>
      assertGrpcTransportExecutePreflight({ transportMode: 'spring-servlet', callType: 'bidi_streaming' }),
    ).toThrow(GrpcWebTransportPreflightError);
  });

  it('error message for blocked call type includes Switch to Express Proxy hint', () => {
    let caught: unknown;
    try {
      assertGrpcTransportCallTypeSupported('grpc-web', 'client_streaming');
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(GrpcWebTransportPreflightError);
    expect((caught as GrpcWebTransportPreflightError).message).toContain('Switch to Express Proxy');
  });

  it('GrpcWebTransportPreflightError carries correct mode and callType fields', () => {
    let caught: unknown;
    try {
      assertGrpcTransportCallTypeSupported('spring-servlet', 'bidi_streaming');
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(GrpcWebTransportPreflightError);
    const err = caught as GrpcWebTransportPreflightError;
    expect(err.mode).toBe('spring-servlet');
    expect(err.callType).toBe('bidi_streaming');
  });

  it('isGrpcTransportCallTypeSupported returns true for unary + grpc-web', () => {
    expect(isGrpcTransportCallTypeSupported('grpc-web', 'unary')).toBe(true);
  });

  it('isGrpcTransportCallTypeSupported returns true for server_streaming + spring-servlet', () => {
    expect(isGrpcTransportCallTypeSupported('spring-servlet', 'server_streaming')).toBe(true);
  });

  it('isGrpcTransportCallTypeSupported returns true for all call types on express', () => {
    expect(isGrpcTransportCallTypeSupported('express', 'unary')).toBe(true);
    expect(isGrpcTransportCallTypeSupported('express', 'server_streaming')).toBe(true);
    expect(isGrpcTransportCallTypeSupported('express', 'client_streaming')).toBe(true);
    expect(isGrpcTransportCallTypeSupported('express', 'bidi_streaming')).toBe(true);
  });

  it('assertGrpcTransportExecutePreflight does NOT throw for unary + grpc-web', () => {
    expect(() =>
      assertGrpcTransportExecutePreflight({ transportMode: 'grpc-web', callType: 'unary' }),
    ).not.toThrow();
  });

  it('assertGrpcTransportExecutePreflight does NOT throw for server_streaming + spring-servlet', () => {
    expect(() =>
      assertGrpcTransportExecutePreflight({ transportMode: 'spring-servlet', callType: 'server_streaming' }),
    ).not.toThrow();
  });

  it('assertGrpcTransportExecutePreflight does NOT throw for client_streaming + express', () => {
    expect(() =>
      assertGrpcTransportExecutePreflight({ transportMode: 'express', callType: 'client_streaming' }),
    ).not.toThrow();
  });

  it('assertGrpcTransportExecutePreflight throws for mtls + grpc-web', () => {
    expect(() =>
      assertGrpcTransportExecutePreflight({
        transportMode: 'grpc-web',
        callType: 'unary',
        tlsMode: 'mtls',
      }),
    ).toThrow(GrpcWebTransportPreflightError);
  });

  it('isGrpcTransportCallTypeSupported returns false for bidi_streaming + grpc-web', () => {
    expect(isGrpcTransportCallTypeSupported('grpc-web', 'bidi_streaming')).toBe(false);
  });

  it('isGrpcTransportCallTypeSupported returns false for client_streaming + spring-servlet', () => {
    expect(isGrpcTransportCallTypeSupported('spring-servlet', 'client_streaming')).toBe(false);
  });

  it('server_streaming passes execute preflight and stream_start succeeds on grpc-web', async () => {
    resetGrpcTabTransportRoutingForTests();
    syncGrpcTabTransportMode('tab-10i-grpc-web', 'grpc-web');
    expect(() =>
      assertGrpcTransportExecutePreflight({ transportMode: 'grpc-web', callType: 'server_streaming' }),
    ).not.toThrow();
    await expect(startGrpcStream({
      callType: 'server_streaming',
      descriptorKey: '',
      requestId: 'req-10i-grpc-web',
      target: { address: 'example.com:443', tlsMode: 'system' },
      service: 'pkg.Svc',
      method: 'Watch',
      body: {},
      metadata: [],
      auth: { type: 'none' },
    } as never, 'tab-10i-grpc-web')).resolves.toMatchObject({
      ok: true,
      op: 'stream_start',
      data: {
        requestId: 'req-10i-grpc-web',
        tabId: 'tab-10i-grpc-web',
      },
    });
  });

  it('server_streaming passes execute preflight and stream_start succeeds on spring-servlet', async () => {
    resetGrpcTabTransportRoutingForTests();
    syncGrpcTabTransportMode('tab-10i-servlet', 'spring-servlet');
    expect(() =>
      assertGrpcTransportExecutePreflight({ transportMode: 'spring-servlet', callType: 'server_streaming' }),
    ).not.toThrow();
    await expect(startGrpcStream({
      callType: 'server_streaming',
      descriptorKey: '',
      requestId: 'req-10i-servlet',
      target: { address: 'example.com:443', tlsMode: 'system' },
      service: 'pkg.Svc',
      method: 'Watch',
      body: {},
      metadata: [],
      auth: { type: 'none' },
    } as never, 'tab-10i-servlet')).resolves.toMatchObject({
      ok: true,
      op: 'stream_start',
      data: {
        requestId: 'req-10i-servlet',
        tabId: 'tab-10i-servlet',
      },
    });
  });
});

// ── Phase 10I-B: grpc-web-text / binary codec interoperability ────────────────

describe('Phase 10I-B — grpc-web-text and binary content-type interoperability', () => {
  it('encodeGrpcWebTextBody / decodeGrpcWebTextBody round-trip is lossless', () => {
    const original = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x05, 0x0a, 0x03, 0x66, 0x6f, 0x6f]);
    const encoded = encodeGrpcWebTextBody(original);
    expect(typeof encoded).toBe('string');
    const decoded = decodeGrpcWebTextBody(encoded);
    expect(decoded).toEqual(original);
  });

  it('decodeGrpcWebResponseBody parses binary content-type correctly', () => {
    const payload = new TextEncoder().encode('grpc-status: 0\r\n');
    const trailerFrame = encodeGrpcWebTrailerFrame(payload);
    const frames = decodeGrpcWebResponseBody(trailerFrame, 'application/grpc-web+proto');
    expect(frames).toHaveLength(1);
    expect(frames[0]!.flags).toBe(0x80); // trailer frame flag
  });

  it('decodeGrpcWebResponseBody parses grpc-web-text content-type (base64-encoded body)', () => {
    const payload = new TextEncoder().encode('grpc-status: 0\r\n');
    const trailerFrame = encodeGrpcWebTrailerFrame(payload);
    const textEncoded = encodeGrpcWebTextBody(trailerFrame);
    // Pass the base64 string with text content-type
    const frames = decodeGrpcWebResponseBody(textEncoded, 'application/grpc-web-text+proto');
    expect(frames).toHaveLength(1);
    expect(frames[0]!.flags).toBe(0x80);
  });

  it('decodeGrpcWebResponseBody handles empty body without throwing', () => {
    expect(() => decodeGrpcWebResponseBody(new Uint8Array(0), 'application/grpc-web+proto')).not.toThrow();
    const frames = decodeGrpcWebResponseBody(new Uint8Array(0), 'application/grpc-web+proto');
    expect(frames).toEqual([]);
  });

  it('binary and text encoded bodies decode to equivalent frame payloads', () => {
    const payload = new TextEncoder().encode('grpc-status: 0\r\ngrpc-message: OK\r\n');
    const trailerFrame = encodeGrpcWebTrailerFrame(payload);

    const binaryFrames = decodeGrpcWebResponseBody(trailerFrame, 'application/grpc-web+proto');
    const textBody = encodeGrpcWebTextBody(trailerFrame);
    const textFrames = decodeGrpcWebResponseBody(textBody, 'application/grpc-web-text+proto');

    expect(binaryFrames).toHaveLength(1);
    expect(textFrames).toHaveLength(1);
    expect(binaryFrames[0]!.flags).toBe(textFrames[0]!.flags);
    expect(binaryFrames[0]!.payload).toEqual(textFrames[0]!.payload);
  });

  it('decodeGrpcWebResponseBody accepts Uint8Array with grpc-web-text content-type (ASCII→base64 path)', () => {
    // Build a trailer frame, base64-encode it, then convert that base64 string to Uint8Array (ASCII bytes)
    // This exercises the uint8ArrayToAscii → decodeGrpcWebTextBody code path
    const payload = new TextEncoder().encode('grpc-status: 0\r\n');
    const trailerFrame = encodeGrpcWebTrailerFrame(payload);
    const textStr = encodeGrpcWebTextBody(trailerFrame);
    // Simulate the Uint8Array form of the base64 string (ASCII bytes)
    const textAsUint8 = new Uint8Array(textStr.length);
    for (let i = 0; i < textStr.length; i++) {
      textAsUint8[i] = textStr.charCodeAt(i);
    }
    const frames = decodeGrpcWebResponseBody(textAsUint8, 'application/grpc-web-text+proto');
    expect(frames).toHaveLength(1);
    expect(frames[0]!.flags).toBe(0x80);
  });

  it('isGrpcWebTextContentType correctly identifies text vs binary content types', () => {
    expect(isGrpcWebTextContentType('application/grpc-web-text+proto')).toBe(true);
    expect(isGrpcWebTextContentType('application/grpc-web-text')).toBe(true);
    expect(isGrpcWebTextContentType('application/grpc-web+proto')).toBe(false);
    expect(isGrpcWebTextContentType('application/grpc-web')).toBe(false);
    expect(isGrpcWebTextContentType('text/plain')).toBe(false);
  });
});

// ── Phase 10I-C: CORS/proxy failure classification ────────────────────────────

describe('Phase 10I-C — CORS/proxy failures: classification and actionable error messages', () => {
  it('classifyBrowserTransportFetchFailure returns cors for CORS error message', () => {
    expect(
      classifyBrowserTransportFetchFailure({ error: new Error('CORS error: access-control header missing'), transportMode: 'grpc-web' }),
    ).toBe('cors');
  });

  it('classifyBrowserTransportFetchFailure returns cors for cross-origin message', () => {
    expect(
      classifyBrowserTransportFetchFailure({ error: new Error('Cross-Origin Request Blocked'), transportMode: 'grpc-web' }),
    ).toBe('cors');
  });

  it('classifyBrowserTransportFetchFailure returns proxy_unreachable for Failed to fetch', () => {
    expect(
      classifyBrowserTransportFetchFailure({ error: new Error('Failed to fetch'), transportMode: 'grpc-web' }),
    ).toBe('proxy_unreachable');
  });

  it('classifyBrowserTransportFetchFailure returns proxy_unreachable for connection refused', () => {
    expect(
      classifyBrowserTransportFetchFailure({ error: new Error('connection refused to 127.0.0.1:9090'), transportMode: 'spring-servlet' }),
    ).toBe('proxy_unreachable');
  });

  it('classifyBrowserTransportFetchFailure returns protocol_mismatch for unexpected content-type', () => {
    expect(
      classifyBrowserTransportFetchFailure({ error: new Error('unexpected content-type: text/html'), transportMode: 'grpc-web' }),
    ).toBe('protocol_mismatch');
  });

  it('classifyBrowserTransportHttpResponse returns protocol_mismatch for HTML content-type header', () => {
    expect(
      classifyBrowserTransportHttpResponse({ contentType: 'text/html; charset=utf-8', httpStatus: 200, bodyLength: 512, transportMode: 'grpc-web' }),
    ).toBe('protocol_mismatch');
  });

  it('classifyBrowserTransportHttpResponse returns server_status for 503 response', () => {
    expect(
      classifyBrowserTransportHttpResponse({ contentType: 'application/grpc-web+proto', httpStatus: 503, bodyLength: 0, transportMode: 'grpc-web' }),
    ).toBe('server_status');
  });

  it('shouldSuggestExpressProxyForBrowserFailure returns true for cors/proxy_unreachable/protocol_mismatch', () => {
    expect(shouldSuggestExpressProxyForBrowserFailure('cors')).toBe(true);
    expect(shouldSuggestExpressProxyForBrowserFailure('proxy_unreachable')).toBe(true);
    expect(shouldSuggestExpressProxyForBrowserFailure('protocol_mismatch')).toBe(true);
  });

  it('shouldSuggestExpressProxyForBrowserFailure returns false for timeout and server_status', () => {
    expect(shouldSuggestExpressProxyForBrowserFailure('timeout')).toBe(false);
    expect(shouldSuggestExpressProxyForBrowserFailure('server_status')).toBe(false);
  });

  it('formatBrowserTransportFailureMessage returns non-empty string for cors kind', () => {
    const msg = formatBrowserTransportFailureMessage('cors', { transportMode: 'grpc-web' });
    expect(msg).toBeTruthy();
    expect(msg.length).toBeGreaterThan(0);
  });

  it('formatBrowserTransportFailureMessage returns non-empty string for proxy_unreachable kind', () => {
    const msg = formatBrowserTransportFailureMessage('proxy_unreachable', { transportMode: 'spring-servlet' });
    expect(msg).toBeTruthy();
  });

  it('formatBrowserTransportFailureMessage returns non-empty string for protocol_mismatch kind', () => {
    const msg = formatBrowserTransportFailureMessage('protocol_mismatch', { transportMode: 'grpc-web' });
    expect(msg).toBeTruthy();
  });

  it('isBrowserDirectTransportMode returns true for grpc-web and spring-servlet', () => {
    expect(isBrowserDirectTransportMode('grpc-web')).toBe(true);
    expect(isBrowserDirectTransportMode('spring-servlet')).toBe(true);
  });

  it('isBrowserDirectTransportMode returns false for express and tauri', () => {
    expect(isBrowserDirectTransportMode('express')).toBe(false);
    expect(isBrowserDirectTransportMode('tauri')).toBe(false);
  });

  it('mapBrowserTransportFetchFailure maps abortCause timeout to timeout failure kind', () => {
    const err = mapBrowserTransportFetchFailure('call', new Error('aborted'), {
      transportMode: 'grpc-web',
      abortCause: 'timeout',
    });
    const details = extractBrowserTransportFailure(err.toErrorBody());
    expect(details?.browserTransportFailure).toBe('timeout');
    expect(details?.transportMode).toBe('grpc-web');
  });

  it('formatBrowserTransportFailureMessage returns timeout guidance', () => {
    const msg = formatBrowserTransportFailureMessage('timeout', { transportMode: 'spring-servlet' });
    expect(msg).toContain('timed out');
  });
});

// ── Phase 10I-D: In-flight transport lock ─────────────────────────────────────

describe('Phase 10I-D — in-flight transport lock: canChangeGrpcTabTransportMode lifecycle coverage', () => {
  afterEach(() => {
    resetGrpcStreamTransportBindingsForTests();
  });

  it('returns true for idle lifecycle tab', () => {
    const tab = createGrpcStudioTab({ lifecycle: 'idle' });
    expect(canChangeGrpcTabTransportMode(tab)).toBe(true);
  });

  it('returns false for connecting lifecycle', () => {
    const tab = createGrpcStudioTab({ lifecycle: 'connecting' });
    expect(canChangeGrpcTabTransportMode(tab)).toBe(false);
  });

  it('returns false for calling lifecycle', () => {
    const tab = createGrpcStudioTab({ lifecycle: 'calling' });
    expect(canChangeGrpcTabTransportMode(tab)).toBe(false);
  });

  it('returns false when activeRequestId is set', () => {
    const tab = createGrpcStudioTab({ lifecycle: 'idle', activeRequestId: 'req-123' });
    expect(canChangeGrpcTabTransportMode(tab)).toBe(false);
  });

  it('returns false when activeStreamId is set', () => {
    const tab = createGrpcStudioTab({ lifecycle: 'idle', activeStreamId: 'stream-abc' });
    expect(canChangeGrpcTabTransportMode(tab)).toBe(false);
  });

  it('returns false when streamLifecycle is starting', () => {
    const tab = createGrpcStudioTab({ streamLifecycle: 'starting' });
    expect(canChangeGrpcTabTransportMode(tab)).toBe(false);
  });

  it('returns false when streamLifecycle is streaming', () => {
    const tab = createGrpcStudioTab({ streamLifecycle: 'streaming' });
    expect(canChangeGrpcTabTransportMode(tab)).toBe(false);
  });

  it('returns false when streamLifecycle is ending', () => {
    const tab = createGrpcStudioTab({ streamLifecycle: 'ending' });
    expect(canChangeGrpcTabTransportMode(tab)).toBe(false);
  });

  it('returns true for success lifecycle with no active request', () => {
    const tab = createGrpcStudioTab({ lifecycle: 'success' });
    expect(canChangeGrpcTabTransportMode(tab)).toBe(true);
  });

  it('returns true for error lifecycle with no active request', () => {
    const tab = createGrpcStudioTab({ lifecycle: 'error' });
    expect(canChangeGrpcTabTransportMode(tab)).toBe(true);
  });

  it('returns true for cancelled lifecycle with no active request', () => {
    const tab = createGrpcStudioTab({ lifecycle: 'cancelled' });
    expect(canChangeGrpcTabTransportMode(tab)).toBe(true);
  });

  it('isGrpcLifecycleInFlight returns true for connecting and calling', () => {
    expect(isGrpcLifecycleInFlight('connecting')).toBe(true);
    expect(isGrpcLifecycleInFlight('calling')).toBe(true);
  });

  it('isGrpcLifecycleInFlight returns false for idle, success, error, cancelled', () => {
    expect(isGrpcLifecycleInFlight('idle')).toBe(false);
    expect(isGrpcLifecycleInFlight('success')).toBe(false);
    expect(isGrpcLifecycleInFlight('error')).toBe(false);
    expect(isGrpcLifecycleInFlight('cancelled')).toBe(false);
  });

  it('returns false when stream transport binding is active for tab', () => {
    const tab = createGrpcStudioTab();
    bindGrpcStreamTransportForTab(tab.id, 'express');
    expect(canChangeGrpcTabTransportMode(tab)).toBe(false);
  });
});

// ── Phase 10I-E: Spring Servlet path resolution ───────────────────────────────

describe('Phase 10I-E — Spring Servlet: package-qualified service path resolution', () => {
  it('buildSpringServletMethodPath produces /{service}/{method} for simple names', () => {
    expect(buildSpringServletMethodPath('EchoService', 'Echo')).toBe('/EchoService/Echo');
  });

  it('buildSpringServletMethodPath preserves package-qualified service name as-is', () => {
    expect(buildSpringServletMethodPath('com.example.EchoService', 'Echo')).toBe('/com.example.EchoService/Echo');
  });

  it('resolveSpringServletPathCandidates returns canonical path as first element', () => {
    const candidates = resolveSpringServletPathCandidates('com.example.OrderService', 'CreateOrder');
    expect(candidates[0]).toBe('/com.example.OrderService/CreateOrder');
  });

  it('resolveSpringServletPathCandidates returns short-name fallback as second element for package-qualified names', () => {
    const candidates = resolveSpringServletPathCandidates('com.example.OrderService', 'CreateOrder');
    expect(candidates).toHaveLength(2);
    expect(candidates[1]).toBe('/OrderService/CreateOrder');
  });

  it('resolveSpringServletPathCandidates returns only one path for unqualified service name', () => {
    const candidates = resolveSpringServletPathCandidates('OrderService', 'CreateOrder');
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toBe('/OrderService/CreateOrder');
  });

  it('normalizeSpringServletServiceSegment strips leading slashes and dots', () => {
    expect(normalizeSpringServletServiceSegment('/EchoService')).toBe('EchoService');
    expect(normalizeSpringServletServiceSegment('..EchoService')).toBe('EchoService');
  });

  it('normalizeSpringServletServiceSegment throws for path traversal', () => {
    expect(() => normalizeSpringServletServiceSegment('../../etc/passwd')).toThrow();
  });

  it('normalizeSpringServletMethodSegment strips leading slashes from method name', () => {
    expect(normalizeSpringServletMethodSegment('/SayHello')).toBe('SayHello');
    expect(normalizeSpringServletMethodSegment('SayHello')).toBe('SayHello');
  });

  it('normalizeSpringServletMethodSegment throws for path traversal in method name', () => {
    expect(() => normalizeSpringServletMethodSegment('../../../etc/passwd')).toThrow();
  });

  it('buildSpringServletMethodUrls returns canonical then short URL for package-qualified service', () => {
    const urls = buildSpringServletMethodUrls(
      { address: 'localhost:9090', tlsMode: 'disabled' },
      'com.example.OrderService',
      'CreateOrder',
    );
    expect(urls).toEqual([
      'http://localhost:9090/com.example.OrderService/CreateOrder',
      'http://localhost:9090/OrderService/CreateOrder',
    ]);
  });

  it('buildSpringServletMethodUrl uses http scheme when tlsMode is disabled', () => {
    const target = { address: 'localhost:9090', tlsMode: 'disabled' as const };
    const url = buildSpringServletMethodUrl(target, 'EchoService', 'Echo');
    expect(url).toBe('http://localhost:9090/EchoService/Echo');
  });

  it('buildSpringServletMethodUrl uses https scheme when tlsMode is tls', () => {
    const target = { address: 'api.example.com:443', tlsMode: 'tls' as const };
    const url = buildSpringServletMethodUrl(target, 'OrderService', 'CreateOrder');
    expect(url).toBe('https://api.example.com:443/OrderService/CreateOrder');
  });
});

// ── Phase 10I-F: Acceptance checklist traceability source-scan ────────────────

describe('Phase 10I-F — acceptance checklist traceability: all Phase 10 test files present', () => {
  it('grpcPhase10aAcceptance.test.ts exists (transport contracts)', () => {
    expect(() => readSrc('shared/grpc/grpcPhase10aAcceptance.test.ts')).not.toThrow();
  });

  it('grpcPhase10bAcceptance.test.ts exists (transport router)', () => {
    expect(() => readSrc('shared/grpc/grpcPhase10bAcceptance.test.ts')).not.toThrow();
  });

  it('grpcPhase10cAcceptance.test.ts exists (grpc-web framing + unary adapter)', () => {
    expect(() => readSrc('shared/grpc/grpcPhase10cAcceptance.test.ts')).not.toThrow();
  });

  it('grpcPhase10dAcceptance.test.ts exists (Spring Servlet path + unary adapter)', () => {
    expect(() => readSrc('shared/grpc/grpcPhase10dAcceptance.test.ts')).not.toThrow();
  });

  it('grpcPhase10eAcceptance.test.ts exists (browser transport error taxonomy)', () => {
    expect(() => readSrc('shared/grpc/grpcPhase10eAcceptance.test.ts')).not.toThrow();
  });

  it('grpcPhase10fAcceptance.test.ts exists (metadata/auth/TLS normalization)', () => {
    expect(() => readSrc('shared/grpc/grpcPhase10fAcceptance.test.ts')).not.toThrow();
  });

  it('grpcPhase10gAcceptance.test.ts exists (transport selector guardrails)', () => {
    expect(() => readSrc('shared/grpc/grpcPhase10gAcceptance.test.ts')).not.toThrow();
  });

  it('grpcPhase10hAcceptance.test.ts exists (cross-surface parity)', () => {
    expect(() => readSrc('shared/grpc/grpcPhase10hAcceptance.test.ts')).not.toThrow();
  });

  it('grpcWebTransportContracts.ts exports assertGrpcTransportExecutePreflight (checklist item 1)', () => {
    const src = readSrc('shared/grpc/grpcWebTransportContracts.ts');
    expect(src).toContain('export function assertGrpcTransportExecutePreflight');
  });

  it('grpcBrowserTransportErrorMapper.ts exports classifyBrowserTransportFetchFailure (checklist item 4)', () => {
    const src = readSrc('shared/grpc/grpcBrowserTransportErrorMapper.ts');
    expect(src).toContain('export function classifyBrowserTransportFetchFailure');
  });

  it('grpcStudioTypes.ts exports canChangeGrpcTabTransportMode (checklist item 5)', () => {
    const src = readSrc('features/grpc/grpcStudioTypes.ts');
    expect(src).toContain('export function canChangeGrpcTabTransportMode');
  });

  it('grpcSpringServletPathResolver.ts exports buildSpringServletMethodPath (checklist item 6)', () => {
    const src = readSrc('shared/grpc/grpcSpringServletPathResolver.ts');
    expect(src).toContain('export function buildSpringServletMethodPath');
  });

  it('grpc-phase10-runbook.md exists in docs/guides/', () => {
    expect(() => readFileSync(
      path.join(ROOT, '..', 'docs', 'guides', 'grpc-phase10-runbook.md'),
      'utf-8',
    )).not.toThrow();
  });

  it('grpc-phase10-validation-report.md exists in docs/guides/', () => {
    expect(() => readFileSync(
      path.join(ROOT, '..', 'docs', 'guides', 'grpc-phase10-validation-report.md'),
      'utf-8',
    )).not.toThrow();
  });

  it('grpcStudioUnaryCommands.ts wires assertGrpcTransportExecutePreflight in prepareExecuteSnapshot', () => {
    const src = readSrc('features/grpc/hooks/grpcStudioUnaryCommands.ts');
    expect(src).toContain('assertGrpcTransportExecutePreflight');
    expect(src).toContain('createPrepareExecuteSnapshotHandler');
  });

  it('grpcBrowserTransportErrorMapper.ts exports mapBrowserTransportFetchFailure', () => {
    const src = readSrc('shared/grpc/grpcBrowserTransportErrorMapper.ts');
    expect(src).toContain('export function mapBrowserTransportFetchFailure');
  });

  it('grpcWebTrailerNormalize.ts exports normalizeGrpcWebUnaryResponse (checklist item 2)', () => {
    const src = readSrc('shared/grpc/grpcWebTrailerNormalize.ts');
    expect(src).toContain('export function normalizeGrpcWebUnaryResponse');
  });

  it('grpcStreamClient.ts routes browser-direct server streaming through local start handler', () => {
    const src = readSrc('shared/grpc/grpcStreamClient.ts');
    expect(src).toContain('startBrowserDirectServerStream');
    expect(src).toMatch(/request\.callType === 'server_streaming'/);
  });

  it('grpcWebTransportContracts.ts exports assertBrowserDirectTransportTlsSupported', () => {
    const src = readSrc('shared/grpc/grpcWebTransportContracts.ts');
    expect(src).toContain('export function assertBrowserDirectTransportTlsSupported');
  });

  it('useGrpcStreamSession.ts wires prepareExecuteSnapshot before stream_start', () => {
    const src = readSrc('features/grpc/hooks/useGrpcStreamSession.ts');
    expect(src).toContain('prepareExecuteSnapshot');
    expect(src).toContain('assertGrpcTransportDispatchReady');
  });

  it('grpcGrpcSpringServletUnaryClient.ts retries servlet path candidates on HTTP 404', () => {
    const src = readSrc('shared/grpc/grpcGrpcSpringServletUnaryClient.ts');
    expect(src).toContain('buildSpringServletMethodUrls');
    expect(src).toMatch(/isSpringServletPathNotFoundError/);
  });

  it('GrpcTransportPanel.tsx surfaces server streaming deferred hint (Phase 10I)', () => {
    const src = readSrc('features/grpc/components/GrpcTransportPanel.tsx');
    expect(src).toContain('grpc-transport-stream-deferred-hint');
    expect(src).toMatch(/server streaming/i);
  });
});

describe('Phase 10I acceptance checklist', () => {
  it('package.json exposes test:grpc:phase10i', () => {
    expect(pkg.scripts?.['test:grpc:phase10i']).toContain('test-grpc-phase10i.sh');
  });
});
