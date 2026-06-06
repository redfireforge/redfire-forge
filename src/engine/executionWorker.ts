import type { MainToWorkerMessage, WorkerToMainMessage } from './workerProtocol';
import type { HttpResponse } from '../shared/utils/httpClient';
import { httpFetchViaViteProxy, setHttpTransport } from '../shared/utils/httpClient';
import { runTest } from './executor';
import { toErrorMessage } from '../shared/utils/helpers';
import { buildKafkaNodeOperations } from '../shared/kafka/buildKafkaNodeOperations';

interface WorkerContext {
  postMessage: (msg: WorkerToMainMessage) => void;
  addEventListener: (
    type: 'message',
    listener: (e: MessageEvent<MainToWorkerMessage>) => void,
  ) => void;
}

const ctx = self as unknown as WorkerContext;

self.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
  try {
    ctx.postMessage({
      type: 'error',
      message: `Unhandled rejection in worker: ${e.reason?.message ?? String(e.reason)}`,
    });
  } catch { /* cannot communicate back */ }
});

const pendingHttp = new Map<string, (response: HttpResponse) => void>();
let abortController: AbortController | null = null;
let lastSentCount = 0;

function postMsg(msg: WorkerToMainMessage): void {
  ctx.postMessage(msg);
}

function setupBrowserTransport(): void {
  setHttpTransport(httpFetchViaViteProxy);
}

function setupTauriTransport(): void {
  setHttpTransport((url, method, headers, body) => {
    const id = crypto.randomUUID();
    return new Promise<HttpResponse>((resolve) => {
      pendingHttp.set(id, resolve);
      postMsg({ type: 'http-request', id, url, method, headers, body });
    });
  });
}

ctx.addEventListener('message', async (e: MessageEvent<MainToWorkerMessage>) => {
  const msg = e.data;

  switch (msg.type) {
    case 'start': {
      lastSentCount = 0;
      abortController = new AbortController();

      if (msg.useTauriProxy) {
        setupTauriTransport();
      } else {
        setupBrowserTransport();
      }

      try {
        let lastProgressPost = -Infinity;
        let pendingNewResults: import('../shared/types').RequestResult[] = [];
        let hasPending = false;
        let pendingCompleted = 0;
        let pendingTotal = 0;
        let pendingMeta: import('./executor').ProgressMeta | undefined;
        const PROGRESS_THROTTLE_MS = 250;

        const testResult = await runTest(
          msg.config,
          msg.scenarios,
          (completed, total, allResults, meta) => {
            const newResults = allResults.slice(lastSentCount);
            lastSentCount = allResults.length;
            const now = performance.now();
            if (now - lastProgressPost >= PROGRESS_THROTTLE_MS) {
              lastProgressPost = now;
              const batch = hasPending ? [...pendingNewResults, ...newResults] : newResults;
              hasPending = false;
              pendingNewResults = [];
              postMsg({ type: 'progress', completed, total, newResults: batch, meta });
            } else {
              pendingNewResults.push(...newResults);
              hasPending = true;
              pendingCompleted = completed;
              pendingTotal = total;
              pendingMeta = meta;
            }
          },
          abortController.signal,
          msg.workflow,
          undefined,
          msg.workerIndex,
          undefined,
          msg.workflow ? buildKafkaNodeOperations() : undefined,
        );
        if (hasPending) {
          postMsg({ type: 'progress', completed: pendingCompleted, total: pendingTotal, newResults: pendingNewResults, meta: pendingMeta });
        }
        const finalNew = testResult.results.slice(lastSentCount);
        lastSentCount = testResult.results.length;
        postMsg({ type: 'done', newResults: finalNew, trace: testResult.trace });
      } catch (err) {
        postMsg({ type: 'error', message: toErrorMessage(err) });
      }
      break;
    }

    case 'abort':
      abortController?.abort();
      break;

    case 'http-response': {
      const resolver = pendingHttp.get(msg.id);
      if (resolver) {
        pendingHttp.delete(msg.id);
        resolver(msg.response);
      }
      break;
    }
  }
});
