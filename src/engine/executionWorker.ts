import type { MainToWorkerMessage, WorkerToMainMessage } from './workerProtocol';
import type { HttpResponse } from '../shared/utils/httpClient';
import { httpFetchViaViteProxy, setHttpTransport } from '../shared/utils/httpClient';
import { runTest } from './executor';

interface WorkerContext {
  postMessage: (msg: WorkerToMainMessage) => void;
  addEventListener: (
    type: 'message',
    listener: (e: MessageEvent<MainToWorkerMessage>) => void,
  ) => void;
}

const ctx = self as unknown as WorkerContext;

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
        const results = await runTest(
          msg.config,
          msg.scenarios,
          (completed, total, allResults, meta) => {
            const newResults = allResults.slice(lastSentCount);
            lastSentCount = allResults.length;
            postMsg({ type: 'progress', completed, total, newResults, meta });
          },
          abortController.signal,
        );
        const finalNew = results.slice(lastSentCount);
        lastSentCount = results.length;
        postMsg({ type: 'done', newResults: finalNew });
      } catch (err) {
        postMsg({ type: 'error', message: err instanceof Error ? err.message : String(err) });
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
