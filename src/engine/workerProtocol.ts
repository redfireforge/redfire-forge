import type { TestConfig, Scenario, RequestResult, WorkflowExecutionTrace } from '../shared/types';
import type { HttpResponse } from '../shared/utils/httpClient';
import type { ProgressMeta } from './executor';
import type { Workflow } from '../features/workflow/types/workflow';

/** Messages sent from the main thread to the execution worker. */
export type MainToWorkerMessage =
  | { type: 'start'; config: TestConfig; scenarios: Scenario[]; useTauriProxy: boolean; workflow?: Workflow; workerIndex?: number; totalWorkers?: number; grpcHarnessEnv?: Record<string, string> }
  | { type: 'abort' }
  | { type: 'http-response'; id: string; response: HttpResponse };

/** Messages sent from the execution worker back to the main thread. */
export type WorkerToMainMessage =
  | { type: 'progress'; completed: number; total: number; newResults: RequestResult[]; meta?: ProgressMeta }
  | { type: 'done'; newResults: RequestResult[]; trace?: WorkflowExecutionTrace }
  | { type: 'error'; message: string }
  | { type: 'http-request'; id: string; url: string; method: string; headers: Record<string, string>; body?: string };
