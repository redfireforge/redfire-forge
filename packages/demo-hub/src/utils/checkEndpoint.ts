/**
 * Probes whether a server endpoint is reachable before starting a Docker-dependent lesson.
 *
 * Strategy (in order):
 *  1. HTTP GET to `<httpBase>/health` — fast, reliable, works for servers that expose it.
 *  2. WebSocket handshake to the raw URL — fallback for WS-only endpoints.
 *
 * Returns true as soon as either probe succeeds, false if both time out or error.
 */
function loopbackProbeCandidates(url: string): string[] {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]') {
      const localhost = new URL(parsed.toString());
      localhost.hostname = 'localhost';
      const ipv4 = new URL(parsed.toString());
      ipv4.hostname = '127.0.0.1';
      const ordered = [localhost.toString(), ipv4.toString()];
      return [...new Set(ordered)];
    }
  } catch {
    /* fall back to original URL */
  }
  return [url];
}

function isSpringActuatorHealthUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const isLoopback = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
    return isLoopback && parsed.port === '8080' && parsed.pathname === '/actuator/health';
  } catch {
    return false;
  }
}

/** Try an HTTP GET health check. Resolves true on any 2xx response. */
async function checkHttp(url: string, timeoutMs: number): Promise<boolean> {
  const candidates = loopbackProbeCandidates(url);
  for (const probeUrl of candidates) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(probeUrl, { signal: controller.signal, mode: 'no-cors' });
      // no-cors means opaque response — if fetch didn't throw, the server is up
      void res;
      return true;
    } catch {
      // try the next loopback candidate before failing
    } finally {
      clearTimeout(timer);
    }
  }
  return false;
}

/** Try a WebSocket handshake. Resolves true on open, false on error or timeout. */
async function checkWs(url: string, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (v: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { ws.close(); } catch { /* ignore */ }
      resolve(v);
    };
    const ws = new WebSocket(url);
    const timer = setTimeout(() => settle(false), timeoutMs);
    ws.onopen  = () => settle(true);
    ws.onerror = () => settle(false);
  });
}

/**
 * Derives an HTTP health URL from a WS endpoint URL.
 * e.g. ws://localhost:3100/socket.io/... → http://127.0.0.1:3100/health
 */
function wsToHttpHealth(wsUrl: string): string {
  try {
    const parsed = new URL(wsUrl);
    parsed.protocol = 'http:';
    parsed.pathname = '/health';
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return `${wsUrl.replace(/^wss?:\/\//, 'http://').split('/')[0]}/health`;
  }
}

/**
 * Check whether a server endpoint is reachable.
 *
 * @param url      WebSocket or HTTP URL to probe (e.g. ws://localhost:3100/...)
 * @param timeoutMs Per-probe timeout in ms (default 3000)
 */
export async function checkEndpoint(url: string, timeoutMs = 3000): Promise<boolean> {
  if (url.startsWith('http')) {
    // Some environments block direct browser probes to Spring's actuator on :8080.
    // Use the local Express server as a same-origin proxy health check first.
    if (isSpringActuatorHealthUrl(url)) {
      const proxied = await checkHttp('http://localhost:3001/health/spring', timeoutMs);
      if (proxied) return true;
    }
    return checkHttp(url, timeoutMs);
  }

  // WS endpoint: try HTTP health first (faster), then raw WS handshake
  const httpResult = await checkHttp(wsToHttpHealth(url), timeoutMs);
  if (httpResult) return true;
  return checkWs(url, timeoutMs);
}
