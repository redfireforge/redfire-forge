/**
 * Phase 7D/7E — connection-level fault delivery for API Mock listeners.
 * Applies timeout / close / reset / malformed / dribble behaviors on a live socket.
 */
import type http from 'node:http';
import type { ApiMockBehaviorV1, ApiMockFaultKind } from '../../src/shared/api-mock/contracts.js';
import { stripHopByHopHeaders } from '../../src/shared/api-mock/proxyPolicy.js';

export interface FaultDeliveryInput {
  req: http.IncomingMessage;
  res: http.ServerResponse;
  fault: ApiMockFaultKind;
  behavior: ApiMockBehaviorV1;
  /** Safety cap for timeout / long-running holds (ms). */
  longRunningMaxMs: number;
  /** Normal response payload used when fault is none or as dribble source. */
  status: number;
  headers: Record<string, string | string[]>;
  body: string;
}

export interface FaultDeliveryResult {
  outcome: 'matched' | 'fault';
  status: number;
  body: string;
  /** True when the HTTP response was completed via writeHead/end. */
  completedHttp: boolean;
}

interface FaultStream {
  closed?: boolean;
  close?: (code?: number) => void;
  once?: (ev: string, fn: () => void) => void;
  session?: { destroy?: () => void; socket?: { destroy?: () => void } };
}

function isHttp2(req: http.IncomingMessage): boolean {
  return req.httpVersion === '2.0';
}

function http2Stream(req: http.IncomingMessage): FaultStream | undefined {
  return (req as http.IncomingMessage & { stream?: FaultStream }).stream;
}

function outboundHeaders(
  req: http.IncomingMessage,
  headers: Record<string, string | string[]>,
): Record<string, string | string[]> {
  return isHttp2(req) ? stripHopByHopHeaders(headers) : headers;
}

function connectionAlreadyGone(req: http.IncomingMessage, socket: { destroyed?: boolean }): boolean {
  if (socket.destroyed === true) return true;
  return http2Stream(req)?.closed === true;
}

function closeFaultStream(req: http.IncomingMessage): void {
  try { http2Stream(req)?.close?.(); } catch { /* ignore */ }
}

function destroyFaultConnection(req: http.IncomingMessage): void {
  closeFaultStream(req);
  try { http2Stream(req)?.session?.destroy?.(); } catch { /* ignore */ }
  try { req.socket.destroy(); } catch { /* ignore */ }
}

/**
 * Deliver a response or fault. Resolves when the socket action finishes
 * (or after the timeout hold destroys the socket).
 */
export function deliverWithFault(input: FaultDeliveryInput): Promise<FaultDeliveryResult> {
  const { req, res, fault, behavior, longRunningMaxMs, status, headers, body } = input;
  const socket = req.socket;
  const responseHeaders = outboundHeaders(req, headers);

  if (!fault || fault === 'none') {
    if (!res.headersSent) {
      res.writeHead(status, responseHeaders);
      res.end(body);
    }
    return Promise.resolve({ outcome: 'matched', status, body, completedHttp: true });
  }

  if (fault === 'timeout') {
    const holdMs = Math.max(1, Math.min(behavior.longRunningMs ?? longRunningMaxMs, longRunningMaxMs));
    return new Promise(resolve => {
      let settled = false;
      // Assigned after callbacks are defined so early-settle paths can still clear it safely.
      // eslint-disable-next-line prefer-const
      let timer: ReturnType<typeof setTimeout> | undefined;
      const settle = (destroy: boolean) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        if (destroy) destroyFaultConnection(req);
        resolve({ outcome: 'fault', status: 0, body: '', completedHttp: false });
      };
      socket.once('close', () => settle(false));
      http2Stream(req)?.once?.('close', () => settle(false));
      if (connectionAlreadyGone(req, socket)) {
        settle(false);
        return;
      }
      timer = setTimeout(() => settle(true), holdMs);
    });
  }

  if (fault === 'reset') {
    destroyFaultConnection(req);
    return Promise.resolve({ outcome: 'fault', status: 0, body: '', completedHttp: false });
  }

  if (fault === 'close') {
    if (isHttp2(req)) {
      // res.end() without writeHead still sends HTTP/2 HEADERS with :status 200.
      closeFaultStream(req);
    } else {
      try {
        res.end();
      } catch {
        destroyFaultConnection(req);
      }
    }
    return Promise.resolve({ outcome: 'fault', status: 0, body: '', completedHttp: false });
  }

  if (fault === 'malformed') {
    try {
      if (isHttp2(req)) {
        // HTTP/1.1 garbage on an h2 session corrupts the multiplexed connection.
        destroyFaultConnection(req);
      } else {
        socket.write('HTTP/1.1 BROKEN\r\nNot-A-Header\r\n\r\n{{{');
        socket.destroy();
      }
    } catch { /* ignore */ }
    return Promise.resolve({ outcome: 'fault', status: 0, body: '', completedHttp: false });
  }

  // dribble — HTTP/2 forbids Transfer-Encoding: chunked (DATA frames already chunk).
  const schedule = behavior.chunkSchedule?.length
    ? behavior.chunkSchedule
    : [
      { afterMs: 20, body: body.slice(0, Math.ceil(body.length / 2)) },
      { afterMs: 40, body: body.slice(Math.ceil(body.length / 2)) },
    ];

  return new Promise(resolve => {
    let settled = false;
    const settle = (completedHttp: boolean) => {
      if (settled) return;
      settled = true;
      if (completedHttp) {
        try { res.end(); } catch { /* ignore */ }
        resolve({ outcome: 'fault', status, body, completedHttp: true });
        return;
      }
      // Do not destroy the HTTP/2 session — a RST or failed write on one
      // stream must not reset sibling multiplexed requests.
      if (isHttp2(req)) {
        if (!connectionAlreadyGone(req, socket)) closeFaultStream(req);
      } else {
        destroyFaultConnection(req);
      }
      resolve({ outcome: 'fault', status, body, completedHttp: false });
    };
    socket.once('close', () => settle(false));
    http2Stream(req)?.once?.('close', () => settle(false));
    if (connectionAlreadyGone(req, socket)) {
      settle(false);
      return;
    }
    if (!res.headersSent) {
      try {
        res.writeHead(status, isHttp2(req)
          ? responseHeaders
          : { ...responseHeaders, 'Transfer-Encoding': 'chunked' });
      } catch {
        settle(false);
        return;
      }
    }
    let i = 0;
    const writeNext = () => {
      if (settled) return;
      if (i >= schedule.length) {
        settle(true);
        return;
      }
      const chunk = schedule[i];
      i += 1;
      setTimeout(() => {
        if (settled) return;
        try {
          if (!res.writableEnded) res.write(chunk.body);
          writeNext();
        } catch {
          settle(false);
        }
      }, Math.max(0, chunk.afterMs));
    };
    writeNext();
  });
}
