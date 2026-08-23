import { describe, expect, it, vi } from 'vitest';
import { MockWorker, createWorkerCtor, makeConfig, makeResult, makeScenario } from './workerBridgeMocks';

describe('workerBridgeMocks coverage gaps', () => {
  it('removes listeners, tolerates missing listeners, and dispatches error events', () => {
    const worker = new MockWorker();
    const messageListener = vi.fn();
    const errorListener = vi.fn();

    worker.removeEventListener('message', messageListener);
    worker.simulateMessage({ type: 'done', newResults: [] });
    worker.simulateError('no listeners yet');

    worker.addEventListener('message', messageListener);
    worker.addEventListener('error', errorListener);

    worker.simulateMessage({ type: 'progress', completed: 1, total: 2, newResults: [makeResult('r1')] });
    expect(messageListener).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'progress' }) }),
    );

    worker.simulateError('boom', 'worker.js');
    expect(errorListener).toHaveBeenCalledWith({ message: 'boom', filename: 'worker.js' });

    worker.removeEventListener('message', messageListener);
    worker.removeEventListener('error', errorListener);
    messageListener.mockClear();
    errorListener.mockClear();

    worker.simulateMessage({ type: 'done', newResults: [] });
    worker.simulateError('after removal');
    expect(messageListener).not.toHaveBeenCalled();
    expect(errorListener).not.toHaveBeenCalled();
  });

  it('finds start postMessage payloads and worker ctor populates tracker', () => {
    const worker = new MockWorker();
    expect(worker.getStartMessage()).toBeUndefined();

    worker.postMessage({ type: 'abort' });
    worker.postMessage({ type: 'start', config: makeConfig(), scenarios: [makeScenario()], useTauriProxy: false });
    expect(worker.getStartMessage()).toEqual(
      expect.objectContaining({ type: 'start', useTauriProxy: false }),
    );

    const tracker = { current: undefined as MockWorker | undefined, all: [] as MockWorker[] };
    const WorkerCtor = createWorkerCtor(tracker);
    const constructed = new (WorkerCtor as unknown as { new (): MockWorker })();

    expect(tracker.current).toBeDefined();
    expect(tracker.all).toHaveLength(1);
    expect(constructed.postMessage).toBe(tracker.current?.postMessage);
    expect(constructed.terminate).toBe(tracker.current?.terminate);
  });
});