import type { TestConfig, Scenario, RequestResult } from '../shared/types';
import type { ProgressMeta } from './executor';
import type { MainToWorkerMessage, WorkerToMainMessage } from './workerProtocol';
import { httpFetch } from '../shared/utils/httpClient';
import { isTauri } from '../shared/utils/platform';

type ProgressCallback = (
  completed: number,
  total: number,
  results: RequestResult[],
  meta?: ProgressMeta,
) => void;

/**
 * Run a test inside a Web Worker. Has the same signature as `runTest`
 * so it can be used as a drop-in replacement.
 *
 * - Browser mode: the worker uses fetch(/__proxy) directly.
 * - Tauri mode:  HTTP requests are proxied through the main thread
 *   via postMessage so the Tauri HTTP plugin (main-thread only) is used.
 */
export function runTestInWorker(
  config: TestConfig,
  scenarios: Scenario[],
  onProgress: ProgressCallback,
  abortSignal?: AbortSignal,
): Promise<RequestResult[]> {
  return new Promise<RequestResult[]>((resolve, reject) => {
    const allResults: RequestResult[] = [];

    const worker = new Worker(
      new URL('./executionWorker.ts', import.meta.url),
      { type: 'module' },
    );

    let settled = false;

    function cleanup() {
      worker.removeEventListener('message', onMessage);
      worker.terminate();
    }

    function onMessage(e: MessageEvent<WorkerToMainMessage>) {
      const msg = e.data;

      switch (msg.type) {
        case 'progress':
          allResults.push(...msg.newResults);
          onProgress(msg.completed, msg.total, allResults, msg.meta);
          break;

        case 'done':
          allResults.push(...msg.newResults);
          settled = true;
          cleanup();
          resolve(allResults);
          break;

        case 'error':
          settled = true;
          cleanup();
          reject(new Error(msg.message));
          break;

        case 'http-request':
          httpFetch(msg.url, msg.method, msg.headers, msg.body)
            .then((response) => {
              worker.postMessage({
                type: 'http-response',
                id: msg.id,
                response,
              } satisfies MainToWorkerMessage);
            })
            .catch((err) => {
              worker.postMessage({
                type: 'http-response',
                id: msg.id,
                response: {
                  status: 0,
                  statusText: '',
                  headers: {},
                  body: '',
                  error: err instanceof Error ? err.message : String(err),
                },
              } satisfies MainToWorkerMessage);
            });
          break;
      }
    }

    worker.addEventListener('message', onMessage);

    worker.addEventListener('error', (e) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(e.message || 'Worker error'));
    });

    if (abortSignal) {
      if (abortSignal.aborted) {
        cleanup();
        reject(new Error('Aborted'));
        return;
      }
      abortSignal.addEventListener('abort', () => {
        worker.postMessage({ type: 'abort' } satisfies MainToWorkerMessage);
      }, { once: true });
    }

    worker.postMessage({
      type: 'start',
      config,
      scenarios,
      useTauriProxy: isTauri(),
    } satisfies MainToWorkerMessage);
  });
}
