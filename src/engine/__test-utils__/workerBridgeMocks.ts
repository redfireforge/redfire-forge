/**
 * Shared mocks for workerBridge test files.
 *
 * Exposes the MockWorker class that emulates the browser Worker API, plus
 * factory helpers. `vi.mock(...)` and `vi.stubGlobal('Worker', WorkerCtor)`
 * remain in each test file (hoisting requirement).
 */
import { vi } from 'vitest';
import type { TestConfig } from '../../shared/types';
import {
  makeScenario as _makeScenario,
  makeResult as _makeResult,
  makeConfig as _makeConfig,
} from '../../test-utils/factories';
import type { MainToWorkerMessage, WorkerToMainMessage } from '../workerProtocol';

export class MockWorker {
  private listeners = new Map<string, Array<(...args: unknown[]) => void>>();
  public postMessage = vi.fn();
  public terminate = vi.fn();

  addEventListener(type: string, fn: (...args: unknown[]) => void) {
    const list = this.listeners.get(type) ?? [];
    list.push(fn);
    this.listeners.set(type, list);
  }

  removeEventListener(type: string, fn: (...args: unknown[]) => void) {
    const list = this.listeners.get(type) ?? [];
    this.listeners.set(type, list.filter((f) => f !== fn));
  }

  simulateMessage(data: WorkerToMainMessage) {
    for (const fn of this.listeners.get('message') ?? []) {
      fn({ data });
    }
  }

  simulateError(message: string) {
    for (const fn of this.listeners.get('error') ?? []) {
      fn({ message });
    }
  }

  getStartMessage(): MainToWorkerMessage | undefined {
    const call = this.postMessage.mock.calls.find(
      (c: unknown[]) => (c[0] as Record<string, unknown>)?.type === 'start',
    );
    return call?.[0];
  }
}

/**
 * Tracker that test files reset in `beforeEach` and that the `WorkerCtor`
 * factory below populates whenever new MockWorker instances are constructed.
 */
export interface WorkerTracker {
  current: MockWorker | undefined;
  all: MockWorker[];
}

export function createWorkerCtor(tracker: WorkerTracker) {
  return function WorkerCtor(this: MockWorker) {
    const instance = new MockWorker();
    tracker.current = instance;
    tracker.all.push(instance);
    Object.assign(this, instance);
    this.postMessage = instance.postMessage;
    this.terminate = instance.terminate;
    this.addEventListener = instance.addEventListener.bind(instance);
    this.removeEventListener = instance.removeEventListener.bind(instance);
    return instance;
  };
}

export const makeConfig = (overrides: Partial<TestConfig> = {}) =>
  _makeConfig({
    concurrency: 2,
    iterations: 5,
    executionMode: 'batch',
    scenarioWeights: [],
    ...overrides,
  });

export const makeScenario = (id = 's1') =>
  _makeScenario({ id, name: `Scenario ${id}` });

export const makeResult = (id: string, passed = true) =>
  _makeResult({
    id,
    passed,
    httpStatus: passed ? 200 : 500,
    responseTimeMs: 50,
    responseBody: '',
  });
