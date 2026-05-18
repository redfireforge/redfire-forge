import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import type { WorkflowRFNode, WorkflowRFEdge } from '../utils/workflowNodeFactory';
import type {
  WorkflowNode,
  HttpNodeData,
  NodeRunStatus,
  WorkflowService,
  WorkflowErrorConfig,
  Workflow,
} from '../types/workflow';
import type { RequestResult, AuthConfig } from '../../../shared/types';
import { isHttpWorkflowNode } from '../utils/workflowVariableHints';
import { cloneWorkflowNodeDataForStorage } from '../utils/workflowNodeMerge';
import { runGraph, type GraphRunCallbacks, type SubWorkflowRunSummary } from '../engine/graphRunner';
import { DebugController } from '../engine/debugController';
import { RemoteCorrelationStore } from '../engine/remoteCorrelationStore';
import { stripTrailingSlash } from '../utils/workflowHostResolve';
import { checkEnvReadiness } from '../utils/workflowEnvReadiness';
import { summarizeRequestFailure } from '../utils/workflowRunErrors';
import type { RunProgress } from '../components/canvas/WorkflowToolbar';
import type { ConsoleLine } from '../../requests/hooks/useResponseCache';
import type { WorkflowRunHistoryEntry } from './useWorkflowRunCache';
import type { CachedWorkflowRun } from './useWorkflowRunCache';
import type { ToastApi } from '../components/WorkflowToastProvider';

interface UseWorkflowExecutionOptions {
  selected: Workflow | null;
  nodes: WorkflowRFNode[];
  nodesRef: React.RefObject<WorkflowRFNode[]>;
  edgesRef: React.RefObject<WorkflowRFEdge[]>;
  workflowVariablesRef: React.RefObject<Record<string, string>>;
  nodeInitialVarsRef: React.RefObject<Record<string, Record<string, string>>>;
  consoleOpenRef: React.RefObject<boolean>;
  consoleRunBehaviorRef: React.RefObject<string>;
  consoleLinesRef: React.RefObject<ConsoleLine[]>;
  resolvedBaseUrl: string;
  selectedEnvId: string;
  environments: { id: string; name: string }[];
  workflowServices: WorkflowService[];
  workflowErrorConfig: WorkflowErrorConfig | undefined;
  resolveHttpBaseUrlForGraph: (data: HttpNodeData) => string | undefined;
  resolveHttpAuthForGraph: (data: HttpNodeData) => AuthConfig | undefined;
  previewWorkflow: Workflow | null;
  workflows: Workflow[];
  // Run cache callbacks
  nodeStatuses: Record<string, NodeRunStatus>;
  setNodeStatuses: (s: Record<string, NodeRunStatus> | ((prev: Record<string, NodeRunStatus>) => Record<string, NodeRunStatus>)) => void;
  lastRunStatus: CachedWorkflowRun['lastRunStatus'];
  setLastRunStatus: (s: CachedWorkflowRun['lastRunStatus']) => void;
  lastRunTime: number | undefined;
  setLastRunTime: (t: number | undefined) => void;
  lastRunError: string | null;
  setLastRunError: (e: string | null) => void;
  setRunVariableSnapshot: (v: Record<string, string> | null) => void;
  pushRunHistory: (entry: Omit<WorkflowRunHistoryEntry, 'id'>) => string;
  clearConsole: () => void;
  pushConsoleLine: (line: ConsoleLine) => void;
  sampleWorkflowCatalog: { id: string; companionFactories?: (() => Workflow)[] }[];
  toast: ToastApi;
}

export function useWorkflowExecution(opts: UseWorkflowExecutionOptions) {
  const {
    selected, nodes, nodesRef, edgesRef,
    workflowVariablesRef, nodeInitialVarsRef,
    consoleOpenRef, consoleRunBehaviorRef, consoleLinesRef,
    resolvedBaseUrl, selectedEnvId, environments,
    workflowServices, workflowErrorConfig,
    resolveHttpBaseUrlForGraph, resolveHttpAuthForGraph,
    previewWorkflow, workflows,
    nodeStatuses, setNodeStatuses,
    lastRunStatus, setLastRunStatus,
    lastRunTime, setLastRunTime,
    setLastRunError,
    setRunVariableSnapshot,
    pushRunHistory, clearConsole, pushConsoleLine,
    sampleWorkflowCatalog, toast,
  } = opts;

  const [isRunning, setIsRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const [lastQuickTestRequestUrl, setLastQuickTestRequestUrl] = useState<string | null>(null);

  // ── Debug Mode ──
  const [isDebugMode, setIsDebugMode] = useState(false);
  const debugControllerRef = useRef<DebugController | null>(null);

  // ── Run elapsed timer ──
  const runStartRef = useRef<number>(0);
  const [runElapsed, setRunElapsed] = useState(0);

  useEffect(() => {
    if (!isRunning) return;
    runStartRef.current = Date.now();
    setRunElapsed(0);
    const iv = window.setInterval(() => setRunElapsed(Date.now() - runStartRef.current), 250);
    return () => window.clearInterval(iv);
  }, [isRunning]);

  const runProgress = useMemo<RunProgress | null>(() => {
    if (lastRunStatus === 'idle') return null;
    // Count progress over executable steps (exclude pure structural/trigger nodes
    // like start/webhook/schedule/end, which never produce a runnable status).
    const NON_EXECUTABLE = new Set(['start', 'webhook', 'schedule', 'end']);
    const executableNodes = nodes.filter(n => !NON_EXECUTABLE.has(n.type ?? ''));
    const totalNodes = executableNodes.length;
    let completed = 0;
    let failed = 0;
    for (const n of executableNodes) {
      const s = nodeStatuses[n.id];
      if (!s) continue;
      if (s.state === 'pass' || s.state === 'fail' || s.state === 'skipped') completed++;
      if (s.state === 'fail') failed++;
    }
    const elapsed = lastRunStatus === 'running' ? runElapsed : (lastRunTime ?? 0);
    return { completed, total: totalNodes, failed, elapsedMs: elapsed, lastRunStatus: lastRunStatus as RunProgress['lastRunStatus'] };
  }, [nodeStatuses, nodes, lastRunStatus, lastRunTime, runElapsed]);

  const failedStepLabel = useMemo(() => {
    if (lastRunStatus !== 'fail') return null;
    for (const n of nodes) {
      if (n.type === 'http' && nodeStatuses[n.id]?.state === 'fail') {
        return (n.data as { label?: string }).label || null;
      }
    }
    return null;
  }, [lastRunStatus, nodes, nodeStatuses]);

  /** Shared logic for both normal and debug workflow runs. */
  const executeWorkflowRun = useCallback((debugController?: DebugController) => {
    if (!selected || nodes.length === 0) return;

    if (selectedEnvId && workflowServices.length) {
      const readiness = checkEnvReadiness(selectedEnvId, workflowServices);
      if (!readiness.ready) {
        const names = readiness.issues.map((i) => i.serviceName).join(', ');
        const envLabel = environments.find((e) => e.id === selectedEnvId)?.name ?? selectedEnvId;
        toast.show('warning', `Some services not configured for "${envLabel}"`, `Missing: ${names}`, 5000);
      }
    }

    setIsRunning(true);
    if (debugController) setIsDebugMode(true);
    setLastRunStatus('running');
    setLastRunError(null);
    setLastQuickTestRequestUrl(null);
    setNodeStatuses({});
    if (consoleRunBehaviorRef.current === 'append' && consoleLinesRef.current.length > 0) {
      pushConsoleLine({ prefix: '---', text: `Run  ·  ${new Date().toLocaleTimeString()}`, ts: Date.now() });
    } else {
      clearConsole();
    }

    abortRef.current = new AbortController();

    const liveWorkflowVariables = workflowVariablesRef.current;
    const wfNodes: WorkflowNode[] = nodesRef.current.map((n) => {
      const base = { id: n.id, type: n.type, position: n.position };
      if (!isHttpWorkflowNode(n)) {
        return { ...base, data: cloneWorkflowNodeDataForStorage(n.data) };
      }
      const d = n.data;
      const refVars = nodeInitialVarsRef.current[n.id];
      const merged: HttpNodeData = {
        ...d,
        initialVariables: { ...liveWorkflowVariables, ...(refVars ?? d.initialVariables ?? {}) },
      };
      return { ...base, data: cloneWorkflowNodeDataForStorage(merged) };
    });
    const wfEdges = edgesRef.current.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? undefined,
      label: typeof e.label === 'string' ? e.label : undefined,
    }));

    const runNodeStatuses: Record<string, NodeRunStatus> = {};
    let runVarSnap: Record<string, string> | null = null;
    const subWorkflowResults: Map<string, SubWorkflowRunSummary> = new Map();
    const callbacks: GraphRunCallbacks = {
      onNodeStateChange: (nodeId, status) => {
        runNodeStatuses[nodeId] = status;
        setNodeStatuses(prev => ({ ...prev, [nodeId]: status }));
      },
      onVariablesChange: (vars) => {
        runVarSnap = vars;
        setRunVariableSnapshot(vars);
      },
      onLog: (line) => { if (consoleOpenRef.current) pushConsoleLine(line); },
      onSubWorkflowComplete: (summary) => {
        subWorkflowResults.set(summary.parentNodeId, summary);
      },
      onComplete: (results: RequestResult[], passed: boolean, durationMs: number) => {
        // If the user already stopped the run, don't override with pass/fail
        if (abortRef.current?.signal.aborted) return;
        setIsRunning(false);
        if (debugController) {
          setIsDebugMode(false);
          debugControllerRef.current = null;
        }
        setLastRunStatus(passed ? 'pass' : 'fail');
        setLastRunTime(durationMs);
        const errorMsg = !passed
          ? (results.find((r) => !r.passed) ? summarizeRequestFailure(results.find((r) => !r.passed)!) : 'One or more steps failed.')
          : null;
        setLastRunError(errorMsg);
        const urlForDebug = results.find((r) => !r.passed)?.url ?? results[results.length - 1]?.url;
        setLastQuickTestRequestUrl(urlForDebug ?? null);
        const stepSummaries = nodesRef.current
          .filter(n => runNodeStatuses[n.id] && (n.type === 'http' || n.type === 'subWorkflow'))
          .map(n => {
            const rs = runNodeStatuses[n.id];
            const base = {
              nodeId: n.id,
              label: (n.data as { label?: string }).label || n.id,
              state: rs.state === 'pass' ? 'pass' as const : rs.state === 'fail' ? 'fail' as const : 'skipped' as const,
              statusCode: rs.statusCode,
              responseTimeMs: rs.responseTimeMs,
              error: rs.error,
            };
            const swResult = subWorkflowResults.get(n.id);
            if (swResult) {
              return {
                ...base,
                childWorkflowName: swResult.childWorkflowName,
                childSteps: swResult.childSteps,
                childDurationMs: swResult.durationMs,
                childAttempt: swResult.attempt,
              };
            }
            return base;
          });
        pushRunHistory({
          timestamp: Date.now(),
          durationMs,
          passed,
          nodeStatuses: { ...runNodeStatuses },
          variableSnapshot: runVarSnap ? { ...runVarSnap } : null,
          stepsExecuted: results.length,
          stepSummaries,
          error: errorMsg,
        });
      },
    };

    const envLayer: Record<string, string> = {};
    if (!workflowServices.length && !previewWorkflow) {
      const bu = resolvedBaseUrl.trim();
      if (bu) envLayer.baseUrl = stripTrailingSlash(bu);
    }

    runGraph(
      wfNodes,
      wfEdges,
      liveWorkflowVariables,
      callbacks,
      abortRef.current.signal,
      envLayer,
      resolveHttpBaseUrlForGraph,
      resolveHttpAuthForGraph,
      debugController,
      workflowErrorConfig,
      (id) => {
        const found = workflows.find((w) => w.id === id);
        if (found) return found;
        if (previewWorkflow) {
          const entry = sampleWorkflowCatalog.find(e => e.id === previewWorkflow.id);
          if (entry?.companionFactories) {
            for (const cf of entry.companionFactories) {
              const companion = cf();
              if (companion.id === id) return companion;
            }
          }
        }
        return undefined;
      },
      new RemoteCorrelationStore(),
      undefined, // loadTestMode
      undefined, // correlationWaitConfig
      undefined, // pollSemaphore
      { traceLevel: 'debug' as const, captureFullTrace: true },
    ).catch(() => {
      // If the user already stopped the run, don't override with 'fail'
      if (abortRef.current?.signal.aborted) return;
      setIsRunning(false);
      if (debugController) {
        setIsDebugMode(false);
        debugControllerRef.current = null;
      }
      setLastRunStatus('fail');
      setLastRunError(debugController ? 'Workflow debug run failed or was interrupted.' : 'Workflow run failed or was interrupted.');
    });
  }, [
    selected, nodes, resolvedBaseUrl,
    resolveHttpBaseUrlForGraph, resolveHttpAuthForGraph,
    selectedEnvId, workflowServices, environments,
    clearConsole, pushConsoleLine, pushRunHistory,
    workflowErrorConfig, setNodeStatuses, setLastRunStatus,
    setLastRunTime, setLastRunError, setRunVariableSnapshot,
    previewWorkflow, workflows, sampleWorkflowCatalog,
    nodesRef, edgesRef, workflowVariablesRef, nodeInitialVarsRef,
    consoleOpenRef, consoleRunBehaviorRef, consoleLinesRef,
    toast,
  ]);

  const handleQuickTest = useCallback(() => {
    if (isRunning) {
      abortRef.current?.abort();
      setIsRunning(false);
      setLastRunStatus('stopped');
      setLastRunError(null);
      return;
    }
    executeWorkflowRun();
  }, [isRunning, executeWorkflowRun, setLastRunStatus, setLastRunError]);

  const handleDebugQuickTest = useCallback(() => {
    if (isRunning) {
      debugControllerRef.current?.stop();
      abortRef.current?.abort();
      setIsRunning(false);
      setIsDebugMode(false);
      debugControllerRef.current = null;
      setLastRunStatus('stopped');
      setLastRunError(null);
      return;
    }
    const dc = new DebugController();
    debugControllerRef.current = dc;
    executeWorkflowRun(dc);
  }, [isRunning, executeWorkflowRun, setLastRunStatus, setLastRunError]);

  const handleDebugStep = useCallback((nodeId: string) => {
    debugControllerRef.current?.stepNode(nodeId);
  }, []);

  const handleDebugStop = useCallback(() => {
    debugControllerRef.current?.stop();
    abortRef.current?.abort();
    // Immediately reset UI state — don't rely solely on onComplete/catch
    setIsRunning(false);
    setIsDebugMode(false);
    debugControllerRef.current = null;
    setLastRunStatus('stopped');
    setLastRunError(null);
  }, [setLastRunStatus, setLastRunError]);

  const handleResetRunStatus = useCallback(() => {
    setNodeStatuses({});
    setLastRunStatus('idle');
    setLastRunTime(undefined);
    setLastRunError(null);
  }, [setNodeStatuses, setLastRunStatus, setLastRunTime, setLastRunError]);

  return {
    isRunning,
    setIsRunning,
    isDebugMode,
    setIsDebugMode,
    debugControllerRef,
    abortRef,
    runProgress,
    failedStepLabel,
    lastQuickTestRequestUrl,
    setLastQuickTestRequestUrl,
    handleQuickTest,
    handleDebugQuickTest,
    handleDebugStep,
    handleDebugStop,
    handleResetRunStatus,
  };
}
