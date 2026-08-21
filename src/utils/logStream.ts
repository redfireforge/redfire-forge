/**
 * Companion log SSE (`GET /api/logs/stream`).
 *
 * Native EventSource retries immediately on every drop. Through the Vite
 * `/api` proxy that shows up as `net::ERR_EMPTY_RESPONSE` spam (idle timeout,
 * companion down, or an empty proxy error). Close the socket ourselves and
 * reconnect with backoff instead.
 */
export const LOG_STREAM_URL = '/api/logs/stream';

const INITIAL_RETRY_MS = 1_000;
const MAX_RETRY_MS = 15_000;
const MAX_FAILURES = 8;

export function subscribeLogStream(onMessage: (data: string) => void): () => void {
  if (typeof EventSource === 'undefined') return () => {};

  let es: EventSource | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  let delayMs = INITIAL_RETRY_MS;
  let failures = 0;

  const clearRetry = () => {
    if (retryTimer == null) return;
    clearTimeout(retryTimer);
    retryTimer = null;
  };

  const connect = () => {
    if (stopped) return;
    try {
      es = new EventSource(LOG_STREAM_URL);
      es.onmessage = (event) => {
        failures = 0;
        delayMs = INITIAL_RETRY_MS;
        onMessage(event.data);
      };
      es.onerror = () => {
        es?.close();
        es = null;
        if (stopped) return;
        failures += 1;
        if (failures >= MAX_FAILURES) return;
        clearRetry();
        retryTimer = setTimeout(() => {
          retryTimer = null;
          connect();
        }, delayMs);
        delayMs = Math.min(delayMs * 2, MAX_RETRY_MS);
      };
    } catch {
      /* EventSource unavailable */
    }
  };

  connect();

  return () => {
    stopped = true;
    clearRetry();
    es?.close();
    es = null;
  };
}
