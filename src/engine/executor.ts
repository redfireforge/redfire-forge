import type { TestConfig, Scenario, RequestResult, Microservice, GlobalAuthProfile } from '@shared/types';
import type { Workflow, HttpNodeData } from '@workflow/types/workflow';
import { httpFetch, type HttpResponse } from '@shared/utils/httpClient';
import { getEffectiveBodyType } from '@shared/utils/bodySerializer';
import { resolveAuthHeaders } from '@shared/utils/authHeaders';
import { TokenManager } from './tokenManager';
import { CircuitBreaker } from './circuitBreaker';
import { runSequential, runBatch, runPool, resetResultIdCounter, clearPrepCache, type RunOpts } from './requestExecution';
import { executeKafkaAction } from './kafkaExecution';
import { executeWsAction } from './wsExecution';
import { executeGrpcAction } from './grpcExecution';
import { loadGrpcConnectionProfilesFromStorage } from './grpcConnectionProfileHydration';
import { buildGrpcHarnessOperations } from '@shared/grpc/buildGrpcHarnessOperations';
import { isWsActionType } from '@shared/types';
import { isGrpcHarnessScenario, validateGrpcHarnessActionConfig } from '@shared/utils/grpcHarnessScenarioContracts';
import { runLoadProfile } from './loadProfileRunner';
import { createThinkTimeDelay } from './thinkTime';
import { runWorkflow, runWorkflowLoad, runGraphLoad, VariableContext } from '@workflow/engine';
import type { KafkaNodeOperations, WsNodeOperations } from '@workflow/engine/graphRunnerNodeHandlerContext';
import { expandQueue } from './dataSourceExpander';
import { computeAllocation } from './allocationEngine';
import { resolveHttpNodeBaseUrl, resolveServiceAuth } from '@workflow/utils/workflowHostResolve';

export interface StreamingMetrics {
  p50: number;
  p95: number;
  p99: number;
  p999: number;
  min: number;
  max: number;
  avg: number;
  total: number;
  errors: number;
  tps: number;
}

export interface ProgressMeta {
  elapsedMs: number;
  targetConcurrency: number;
  currentInFlight: number;
  durationMs: number;
  /** Running average of iteration durations (ms) — workflow mode only. */
  avgIterationTimeMs?: number;
  /** Streaming percentile metrics from Rust HDR histogram (Rust executor only). */
  metrics?: StreamingMetrics;
  /** Current target RPS (constant-arrival mode only). */
  targetRps?: number;
  /** Current actual achieved RPS (constant-arrival mode only). */
  actualRps?: number;
  /** Total dropped requests due to backpressure (constant-arrival mode only). */
  droppedRequests?: number;
}

type ProgressCallback = (completed: number, total: number, results: RequestResult[], meta?: ProgressMeta) => void;

export async function proxyFetch(
  url: string,
  method: string,
  headers: Record<string, string>,
  body?: string
): Promise<HttpResponse> {
  return httpFetch(url, method, headers, body);
}

export function buildHeaders(scenario: Scenario, token?: string, contentType?: string | null): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const h of scenario.headers) {
    const key = h.key.trim();
    if (!key) continue;
    if (key.toLowerCase() === 'authorization' && scenario.auth?.type !== 'none') continue;
    headers[key] = h.value;
  }
  Object.assign(headers, resolveAuthHeaders(scenario.auth ?? { type: 'none' }, token));
  const bt = getEffectiveBodyType(scenario);
  if (contentType) {
    if (bt === 'form-data') {
      headers['Content-Type'] = contentType;
    } else if (!headers['Content-Type']) {
      headers['Content-Type'] = contentType;
    }
  }
  return headers;
}

export function buildUrl(scenario: Scenario): string {
  const auth = scenario.auth;
  if (auth.type === 'apikey' && auth.apiKeyIn === 'query' && auth.apiKeyName && auth.apiKeyValue) {
    const url = new URL(scenario.url);
    url.searchParams.set(auth.apiKeyName, auth.apiKeyValue);
    return url.toString();
  }
  return scenario.url;
}
export { CircuitBreaker } from './circuitBreaker';
export { getTargetConcurrency } from './loadProfileRunner';

export interface TestResult {
  results: RequestResult[];
  /** Execution trace for workflow runs (Phase 7e) */
  trace?: import('../shared/types').WorkflowExecutionTrace;
}

export interface WorkflowResolverData {
  microservices?: Microservice[];
  globalAuthProfiles?: GlobalAuthProfile[];
  selectedEnvId?: string;
  /** Selected microservice id for gRPC harness `{{grpcHost}}` resolution in workflow runs. */
  selectedSvcId?: string;
}

export async function runTest(
  config: TestConfig,
  scenarios: Scenario[],
  onProgress: ProgressCallback,
  abortSignal?: AbortSignal,
  /** Optional workflow for graph-based execution (when config.workflowId is set). */
  workflow?: Workflow,
  /** Resolver for sub-workflow nodes — returns the child workflow by ID. */
  resolveSubWorkflow?: (workflowId: string) => Workflow | undefined,
  /** Worker index for result ID prefixing in multi-worker mode. */
  workerIndex?: number,
  /** Data needed for per-node service/auth resolution in workflow runs. */
  workflowResolverData?: WorkflowResolverData,
  /** Kafka operations for Kafka produce/consume nodes in workflow execution. */
  kafkaOperations?: KafkaNodeOperations,
  /** WebSocket operations for WS nodes in workflow execution. */
  wsOperations?: WsNodeOperations,
  /** gRPC operations for grpcUnary/grpcServerStream nodes in workflow execution. */
  grpcOperations?: import('../features/workflow/engine/graphRunnerNodeHandlerContext').GrpcNodeOperations,
  /** Env map for gRPC harness `{{grpcHost}}` template resolution. */
  grpcHarnessEnv?: Record<string, string>,
): Promise<TestResult> {
  resetResultIdCounter(workerIndex);
  clearPrepCache();
  const tokenManager = new TokenManager();
  const timeoutMs = (config.timeoutSec ?? 0) > 0 ? (config.timeoutSec! * 1000) : undefined;
  const retryCount = config.retryCount ?? 0;
  const retryDelayMs = config.retryDelayMs ?? 1000;
  const breaker = new CircuitBreaker(
    config.errorPolicy ?? 'continue',
    config.maxErrors ?? 10,
    config.maxErrorRate ?? 50
  );

  // Determine active scenarios from weights (weight > 0 = selected)
  const activeIds = new Set(
    config.scenarioWeights.filter((w) => w.weight > 0).map((w) => w.scenarioId),
  );
  const activeScenarios = activeIds.size > 0
    ? scenarios.filter((s) => activeIds.has(s.id))
    : scenarios;

  // Detect kind from scenarios — parameterized if any have data sources
  const kind = activeScenarios.some((s) => s.dataSource || s.sharedDataSourceId)
    ? 'parameterized' as const
    : 'standard' as const;

  // Use allocation engine for deterministic per-test iterations
  const allocation = computeAllocation(activeScenarios, config.iterations, kind);

  // Build queue from allocation results
  const queue: Scenario[] = [];
  for (const item of allocation.items) {
    const scenario = activeScenarios.find((s) => s.id === item.testId);
    if (!scenario) continue;
    for (let i = 0; i < item.iterations; i++) queue.push(scenario);
  }

  // Shuffle for realistic load distribution
  for (let i = queue.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [queue[i], queue[j]] = [queue[j], queue[i]];
  }

  // Expand data sources — no post-expansion cap (what you configure is what runs)
  const expandedQueue = expandQueue(queue);

  const mode = config.executionMode ?? 'batch';
  const getThinkTimeMs = createThinkTimeDelay(config.thinkTime);
  const harnessOps = buildGrpcHarnessOperations();
  const hydratedGrpcProfiles = loadGrpcConnectionProfilesFromStorage();
  const grpcRuntimeOverrides = hydratedGrpcProfiles.length > 0
    ? { profiles: hydratedGrpcProfiles }
    : undefined;
  const opts: RunOpts = {
    tokenManager, timeoutMs, retryCount, retryDelayMs, breaker, onProgress, abortSignal, getThinkTimeMs,
    grpcHarnessEnv,
    executeNonHttp: (scenario: Scenario) => {
      const at = scenario.actionType ?? 'http';
      if (at === 'kafkaProduce' || at === 'kafkaConsume') {
        if (!kafkaOperations) throw new Error('Kafka operations not available for action type: ' + at);
        return executeKafkaAction(scenario, kafkaOperations, timeoutMs);
      }
      if (isWsActionType(at)) {
        if (!wsOperations) throw new Error('WS operations not available for action type: ' + at);
        return executeWsAction(scenario, wsOperations, timeoutMs);
      }
      if (at === 'grpcCall' || isGrpcHarnessScenario(scenario)) {
        const configErrors = validateGrpcHarnessActionConfig(scenario);
        if (configErrors.length > 0) {
          throw new Error(`Invalid gRPC harness scenario: ${configErrors.join('; ')}`);
        }
        return executeGrpcAction(scenario, harnessOps, {
          abortSignal,
          grpcHarnessEnv,
          runtimeOverrides: grpcRuntimeOverrides,
        });
      }
      throw new Error(`Unknown non-HTTP action type: '${at}'`);
    },
  };

  // Graph-based workflow path — graphRunner handles its own WS cleanup internally
  if (mode === 'workflow' && workflow && config.workflowId) {
    const iterations = config.iterations || 1;
    const envLayer = config.workflowBaseUrl
      ? { baseUrl: config.workflowBaseUrl }
      : undefined;
    const wfServices = workflow.services ?? [];
    const wfMicroservices = workflowResolverData?.microservices ?? [];
    const wfGlobalAuth = workflowResolverData?.globalAuthProfiles ?? [];
    const wfEnvId = workflowResolverData?.selectedEnvId;

    const resolveBaseUrl = wfServices.length > 0
      ? (data: HttpNodeData) => resolveHttpNodeBaseUrl(data, wfMicroservices, undefined, wfServices, wfEnvId)
      : undefined;

    const resolveAuth = wfServices.length > 0
      ? (data: HttpNodeData): Scenario['auth'] | undefined => {
          const authType = data.scenario?.auth?.type;
          if (authType && authType !== 'inherit') return undefined;
          return resolveServiceAuth(data, wfServices, wfEnvId, wfMicroservices, wfGlobalAuth) ?? undefined;
        }
      : undefined;

    return runGraphLoad(workflow, {
      iterations,
      concurrency: config.concurrency,
      initialVariables: config.workflowVariables,
      breaker,
      abortSignal,
      onProgress,
      correlationWaitConfig: config.correlationWaitConfig,
      maxConcurrentPolls: config.maxConcurrentPolls,
      traceOptions: config.traceOptions,
      environmentLayer: envLayer,
      resolveSubWorkflow,
      resolveHttpBaseUrl: resolveBaseUrl,
      resolveHttpAuth: resolveAuth,
      kafkaOperations,
      wsOperations,
      grpcOperations,
    });
  }

  // All non-graph paths: legacy workflow, harness (sequential/batch/pool/load-profile)
  try {
    if (mode === 'workflow') {
      const ctx = new VariableContext(config.workflowVariables);
      const iterations = config.iterations || 1;
      if (iterations <= 1) {
        return { results: await runWorkflow(scenarios, opts, ctx) };
      }
      return { results: await runWorkflowLoad(scenarios, iterations, config.concurrency, opts, ctx) };
    }
    if (mode === 'load-profile' && config.loadProfile) {
      return { results: await runLoadProfile(config.loadProfile, scenarios, config.scenarioWeights, opts) };
    }
    if (mode === 'sequential') {
      return { results: await runSequential(expandedQueue, opts) };
    }
    if (mode === 'pool') {
      return { results: await runPool(expandedQueue, config.concurrency, opts) };
    }
    return { results: await runBatch(expandedQueue, config.concurrency, opts) };
  } finally {
    if (wsOperations) {
      await wsOperations.disconnectAll().catch(() => { /* best-effort cleanup */ });
    }
  }
}
