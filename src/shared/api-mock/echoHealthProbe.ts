import http from 'node:http';

/** Docker echo used by AM-17 (docker/api-mock). */
export const API_MOCK_ECHO_PORT = 4017;
export const API_MOCK_ECHO_HEALTH_PATH = '/health';

export interface EchoHealthProbeResult {
  ok: boolean;
  statusCode?: number;
  reason?: string;
}

/**
 * Probe the API Mock echo with Node's http client (no HTTP_PROXY).
 * Browser and default `fetch` on this network send 127.0.0.1 through the
 * corporate proxy, which logs CONNECTION_REFUSED in DevTools.
 */
export function probeApiMockEcho(
  timeoutMs = 2500,
  port = API_MOCK_ECHO_PORT,
): Promise<EchoHealthProbeResult> {
  return new Promise((resolve) => {
    const req = http.get({
      hostname: '127.0.0.1',
      port,
      path: API_MOCK_ECHO_HEALTH_PATH,
      timeout: timeoutMs,
    }, (res) => {
      res.resume();
      const statusCode = res.statusCode ?? 0;
      resolve({
        ok: statusCode >= 200 && statusCode < 300,
        statusCode,
        reason: statusCode >= 200 && statusCode < 300 ? undefined : `http_${statusCode}`,
      });
    });
    req.on('error', (err) => resolve({ ok: false, reason: err.message }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, reason: 'timeout' });
    });
  });
}
