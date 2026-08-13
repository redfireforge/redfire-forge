/**
 * Phase 7D/7E — connection-level fault delivery for API Mock listeners.
 * Applies timeout / close / reset / malformed / dribble behaviors on a live socket.
 */
import type http from 'node:http';
import type { ApiMockBehaviorV1, ApiMockFaultKind } from '../../src/shared/api-mock/contracts.js';

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

/**
 * Deliver a response or fault. Resolves when the socket action finishes
 * (or after the timeout hold destroys the socket).
 */
export function deliverWithFault(input: FaultDeliveryInput): Promise<FaultDeliveryResult> {
  const { req, res, fault, behavior, longRunningMaxMs, status, headers, body } = input;
  const socket = req.socket;

  if (!fault || fault === 'none') {
    if (!res.headersSent) {
      res.writeHead(status, headers);
      res.end(body);
    }
    return Promise.resolve({ outcome: 'matched', status, body, completedHttp: true });
  }

  if (fault === 'timeout') {
    const holdMs = Math.max(1, Math.min(behavior.longRunningMs ?? longRunningMaxMs, longRunningMaxMs));
    return new Promise(resolve => {
      const timer = setTimeout(() => {
        try { socket.destroy(); } catch { /* ignore */ }
        resolve({ outcome: 'fault', status: 0, body: '', completedHttp: false });
      }, holdMs);
      socket.once('close', () => clearTimeout(timer));
    });
  }

  if (fault === 'reset') {
    try { socket.destroy(); } catch { /* ignore */ }
    return Promise.resolve({ outcome: 'fault', status: 0, body: '', completedHttp: false });
  }

  if (fault === 'close') {
    try {
      // Abrupt empty close: end without writing a status line when possible.
      if (!res.headersSent) res.end();
      else res.end();
    } catch {
      try { socket.destroy(); } catch { /* ignore */ }
    }
    return Promise.resolve({ outcome: 'fault', status: 0, body: '', completedHttp: false });
  }

  if (fault === 'malformed') {
    try {
      // Bypass HTTP framing — write invalid bytes and destroy.
      socket.write('HTTP/1.1 BROKEN\r\nNot-A-Header\r\n\r\n{{{');
      socket.destroy();
    } catch { /* ignore */ }
    return Promise.resolve({ outcome: 'fault', status: 0, body: '', completedHttp: false });
  }

  // dribble
  const schedule = behavior.chunkSchedule?.length
    ? behavior.chunkSchedule
    : [
      { afterMs: 20, body: body.slice(0, Math.ceil(body.length / 2)) },
      { afterMs: 40, body: body.slice(Math.ceil(body.length / 2)) },
    ];

  return new Promise(resolve => {
    if (!res.headersSent) {
      res.writeHead(status, { ...headers, 'Transfer-Encoding': 'chunked' });
    }
    let i = 0;
    const writeNext = () => {
      if (i >= schedule.length) {
        res.end();
        resolve({ outcome: 'fault', status, body, completedHttp: true });
        return;
      }
      const chunk = schedule[i];
      i += 1;
      setTimeout(() => {
        try {
          if (!res.writableEnded) res.write(chunk.body);
          writeNext();
        } catch {
          try { socket.destroy(); } catch { /* ignore */ }
          resolve({ outcome: 'fault', status, body, completedHttp: false });
        }
      }, Math.max(0, chunk.afterMs));
    };
    writeNext();
  });
}
