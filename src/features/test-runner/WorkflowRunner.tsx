import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { CorrelationWaitRunnerConfig, LoadProfileConfig, SlaTarget, WorkflowExecutionTrace } from '../../shared/types';
import type { Workflow, WorkflowFolder, WebhookTriggerNodeData } from '../workflow/types/workflow';
import { useTestExecution } from './hooks/useTestExecution';
import { useWorkflowRunnerConfig } from './hooks/useWorkflowRunnerConfig';
import { useWorkflowRunnerBridge } from './hooks/useWorkflowRunnerBridge';
import { useWorkflowRunnerWebhookLoadRun } from './hooks/useWorkflowRunnerWebhookLoadRun';
import WorkflowPicker from './components/WorkflowPicker';
import { saveWorkflowRunConfig } from './utils/workflowRunConfigStorage';
import LiveProgressPanel from './components/LiveProgressPanel';
import { type WebhookLoadConfig } from './components/WebhookLoadDriverPanel';
import { type WebhookScenario } from './components/MultiWebhookTestingPanel';
import { type PersistedProgress, saveProgress, loadProgress, clearProgress } from './utils/runnerProgressStorage';
import { loadWebhookScenarios, saveWebhookScenario, deleteWebhookScenario, fireWebhook, buildPayloadWithCorrelationId } from './utils/webhookScenarioStorage';
import { sampleWorkflowCatalog } from '../../data/galleries/workflows';
import { buildInitialRunnerVariables } from '../workflow/utils/countWorkflowDesignerVariables';
import { buildSlaTargetScopeLabel } from '../results/components/slaEditorUtils';
import { resolveWebhookTriggerNode } from './resolveWebhookTriggerNode';
import { computeKafkaLoadBanners } from './computeKafkaLoadBanners';
import { buildWorkflowRunnerTestConfig } from './buildWorkflowRunnerTestConfig';
import WorkflowRunnerConfigSection from './WorkflowRunnerConfigSection';

interface Props {
  workflows: Workflow[];
  folders?: WorkflowFolder[];
  /** Called when run completes. Pass 'workflow' to pre-filter results to workflow runs. */
  onComplete: (runType?: 'test' | 'workflow') => void;
  /** Optional: Pre-select a workflow when navigating from Workflow Designer's "Run in Harness" button. */
  initialWorkflowId?: string | null;
  /** Clear the initialWorkflowId after it has been applied. */
  onClearInitialWorkflowId?: () => void;
  /** Import a gallery sample workflow into the user's workflow list and auto-select it. */
  onImportSample?: (workflow: Workflow) => string | void;
  /** Resolved base URL from environment config (env + microservice selection). */
  resolvedBaseUrl?: string;
  /** App-level microservice definitions (needed for per-node service URL resolution). */
  microservices?: import('../../shared/types').Microservice[];
  /** App-level global auth profiles (needed for per-node service auth resolution). */
  globalAuthProfiles?: import('../../shared/types').GlobalAuthProfile[];
  /** Currently selected environment ID from the app header. */
  selectedEnvId?: string;
  /** Currently selected microservice ID from the app header (harness gRPC env resolution). */
  selectedSvcId?: string;
  /** Persist SLA target changes back to the workflow definition. */
  onUpdateWorkflow?: (id: string, patch: Partial<Omit<Workflow, 'id' | 'createdAt'>>) => void;
  /** Phase 3C: Pre-populate workflow variables from Kafka consume. */
  initialWorkflowVariables?: Record<string, string> | null;
  /** Phase 3C: Clear initial variables after they have been applied. */
  onClearInitialWorkflowVariables?: () => void;
  /** Phase 3D: Notify parent when workflow output variables are available. */
  onWorkflowOutputAvailable?: (output: Record<string, string>) => void;
}

const PROGRESS_KEY = '_workflow_runner_progress';

export default function WorkflowRunner({ workflows, folders, onComplete, initialWorkflowId, onClearInitialWorkflowId, onImportSample, resolvedBaseUrl, microservices, globalAuthProfiles, selectedEnvId, selectedSvcId, onUpdateWorkflow: _onUpdateWorkflow, initialWorkflowVariables, onClearInitialWorkflowVariables, onWorkflowOutputAvailable }: Props) {
  const {
    concurrency, setConcurrency,
    iterations, setIterations,
    executionMode, setExecutionMode,
    loadProfile, setLoadProfile,
    thinkTime, setThinkTime,
    timeoutSec, setTimeoutSec,
    retryCount, setRetryCount,
    retryDelayMs, setRetryDelayMs,
    errorPolicy, setErrorPolicy,
    maxErrors, setMaxErrors,
    maxErrorRate, setMaxErrorRate,
    selectedWorkflowId, setSelectedWorkflowId,
    traceOptions, setTraceOptions,
    kafkaResultsPublish,
    configLoaded,
  } = useWorkflowRunnerConfig();

  const [workflowVariables, setWorkflowVariables] = useState<Record<string, string>>({});
  const selectedWorkflowIdRef = useRef<string | null>(selectedWorkflowId);
  selectedWorkflowIdRef.current = selectedWorkflowId;
  const workflowVariablesRef = useRef(workflowVariables);
  workflowVariablesRef.current = workflowVariables;
  const [savedProgress, setSavedProgress] = useState<PersistedProgress | null>(null);
  const [variablesInitialized, setVariablesInitialized] = useState(false);
  const [correlationWaitConfig, setCorrelationWaitConfig] = useState<CorrelationWaitRunnerConfig | undefined>(undefined);
  /** Session-scoped SLA override targets — merged with workflow.slaTargets at run time (SLA-B9). */
  const [workflowSlaOverrides, setWorkflowSlaOverrides] = useState<SlaTarget[]>([]);

  const { isRunning, completed, total, liveSummary, profileMeta, timeSeries, error, execute, abort, finalRun, pendingRun, confirmSavePendingRun, dismissPendingRun, startExternalExecution } = useTestExecution(kafkaResultsPublish);

  const isRunningRef = useRef(isRunning);
  isRunningRef.current = isRunning;
  const workflowsRef = useRef(workflows);
  workflowsRef.current = workflows;
  const executionModeRef = useRef(executionMode);
  executionModeRef.current = executionMode;
  const iterationsRef = useRef(iterations);
  iterationsRef.current = iterations;
  const concurrencyRef = useRef(concurrency);
  concurrencyRef.current = concurrency;
  const loadProfileRef = useRef(loadProfile);
  loadProfileRef.current = loadProfile;
  const traceOptionsRef = useRef(traceOptions);
  traceOptionsRef.current = traceOptions;
  const handleRunRef = useRef<() => boolean>(() => false);

  const selectedWorkflow = workflows.find(w => w.id === selectedWorkflowId) ?? null;

  /** Maps workflow definition SLA targets to the shape RunnerSlaOverridePanel expects (with scopeLabel). */
  const workflowDefinitionTargets = useMemo(
    () => (selectedWorkflow?.slaTargets ?? []).map((t) => ({
      ...t,
      scopeLabel: buildSlaTargetScopeLabel(t),
    })),
    [selectedWorkflow?.slaTargets],
  );

  useEffect(() => {
    setWorkflowSlaOverrides([]);
  }, [selectedWorkflowId]);

  useEffect(() => {
    if (!configLoaded || !initialWorkflowId || initialWorkflowId === selectedWorkflowId) return;
    const wf = workflows.find(w => w.id === initialWorkflowId);
    if (!wf) return;
    setSelectedWorkflowId(initialWorkflowId);
    setWorkflowVariables(buildInitialRunnerVariables(wf));
    setVariablesInitialized(true);
    onClearInitialWorkflowId?.();
  }, [configLoaded, initialWorkflowId, workflows, selectedWorkflowId, setSelectedWorkflowId, onClearInitialWorkflowId]);

  useEffect(() => {
    if (!configLoaded || !selectedWorkflowId) return;
    if (workflows.some((w) => w.id === selectedWorkflowId)) return;
    setSelectedWorkflowId(null);
    setVariablesInitialized(false);
  }, [configLoaded, selectedWorkflowId, workflows, setSelectedWorkflowId]);

  useEffect(() => {
    if (selectedWorkflow && !variablesInitialized) {
      setWorkflowVariables(buildInitialRunnerVariables(selectedWorkflow));
      setVariablesInitialized(true);
    }
  }, [selectedWorkflow, variablesInitialized]);

  useEffect(() => {
    if (configLoaded && initialWorkflowVariables) {
      setWorkflowVariables((prev) => ({ ...prev, ...initialWorkflowVariables }));
      onClearInitialWorkflowVariables?.();
    }
  }, [configLoaded, initialWorkflowVariables, onClearInitialWorkflowVariables]);

  useEffect(() => {
    if (!finalRun || !onWorkflowOutputAvailable) return;
    const trace = finalRun.executionTrace as WorkflowExecutionTrace | undefined;
    if (!trace?.iterations?.length) return;
    const lastIter = trace.iterations[trace.iterations.length - 1];
    if (lastIter?.finalVariables && Object.keys(lastIter.finalVariables).length > 0) {
      onWorkflowOutputAvailable(lastIter.finalVariables as Record<string, string>);
    }
  }, [finalRun, onWorkflowOutputAvailable]);

  const hasCorrelationWait = useMemo(() => {
    return selectedWorkflow?.nodes.some(n => n.type === 'correlationWait') ?? false;
  }, [selectedWorkflow]);

  const hasWaitForCondition = useMemo(() => {
    return selectedWorkflow?.nodes.some(n => n.type === 'waitForCondition') ?? false;
  }, [selectedWorkflow]);

  const webhookTriggerNode = useMemo(
    () => resolveWebhookTriggerNode(selectedWorkflow),
    [selectedWorkflow],
  );

  const isWebhookTriggered = webhookTriggerNode !== null;

  const [webhookRunMode, setWebhookRunMode] = useState<'single' | 'load'>('single');
  const [webhookLoadConfig, setWebhookLoadConfig] = useState<WebhookLoadConfig | null>(null);

  useEffect(() => {
    if (isWebhookTriggered && webhookTriggerNode && !webhookLoadConfig) {
      const data = webhookTriggerNode.data as WebhookTriggerNodeData;
      const webhookUrl = `http://localhost:3001/webhooks/${selectedWorkflow!.id}/${webhookTriggerNode.id}`;
      setWebhookLoadConfig({
        webhookUrl,
        method: data.method || 'POST',
        payloadTemplate: data.samplePayload || '{}',
        rate: { mode: 'fixed', rps: 10, durationSec: 60 },
        headers: {},
      });
    } else if (!isWebhookTriggered) {
      setWebhookLoadConfig(null);
      setWebhookRunMode('single');
    }
  }, [isWebhookTriggered, webhookTriggerNode, webhookLoadConfig, selectedWorkflow]);

  const [maxConcurrentPolls, setMaxConcurrentPolls] = useState(20);
  const [webhookScenarios, setWebhookScenarios] = useState<WebhookScenario[]>([]);

  useEffect(() => {
    if (hasCorrelationWait && !correlationWaitConfig) {
      setCorrelationWaitConfig({ mode: 'auto-resume', mockPayloads: {} });
    } else if (!hasCorrelationWait && correlationWaitConfig) {
      setCorrelationWaitConfig(undefined);
    }
  }, [hasCorrelationWait, correlationWaitConfig, selectedWorkflowId]);

  useEffect(() => {
    if (selectedWorkflowId && hasCorrelationWait) {
      setWebhookScenarios(loadWebhookScenarios(selectedWorkflowId));
    } else {
      setWebhookScenarios([]);
    }
  }, [selectedWorkflowId, hasCorrelationWait]);

  const isLoadProfile = executionMode === 'load-profile';

  useEffect(() => {
    setSavedProgress(loadProgress(PROGRESS_KEY));
  }, []);

  useEffect(() => {
    if (finalRun && liveSummary && !isRunning) {
      const data: PersistedProgress = {
        summary: liveSummary,
        timeSeries,
        completed,
        total,
        profileMeta,
        isTimeBased: isLoadProfile,
        executionMode: 'workflow',
        concurrency,
        loadProfile,
        thinkTime: thinkTime.mode !== 'none' ? thinkTime : undefined,
        resultCount: finalRun.results.length,
        durationMs: finalRun.summary.totalDurationMs,
      };
      saveProgress(PROGRESS_KEY, data);
      setSavedProgress(data);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalRun, isRunning]);

  const handleClearProgress = () => {
    clearProgress(PROGRESS_KEY);
    setSavedProgress(null);
  };

  const updateProfile = (patch: Partial<LoadProfileConfig>) => {
    setLoadProfile((prev) => ({ ...prev, ...patch }));
  };

  const handleWebhookLoadRun = useWorkflowRunnerWebhookLoadRun({
    selectedWorkflow,
    selectedWorkflowId,
    webhookLoadConfig,
    webhookTriggerNode,
    workflowVariables,
    traceOptions,
    startExternalExecution,
  });

  const handleRun = (): boolean => {
    const runWorkflowId = selectedWorkflowIdRef.current;
    const runWorkflow = runWorkflowId
      ? workflowsRef.current.find((w) => w.id === runWorkflowId) ?? null
      : null;
    const runVariables = workflowVariablesRef.current;

    if (!runWorkflow || !runWorkflowId) {
      console.warn(
        '[WorkflowRunner] Cannot run — selected workflow id',
        runWorkflowId,
        'is not in the loaded workflow list. Re-select the workflow from the picker.',
      );
      return false;
    }

    if (isWebhookTriggered && webhookRunMode === 'load' && webhookLoadConfig) {
      void handleWebhookLoadRun();
      return true;
    }

    const isWaitForReal = correlationWaitConfig?.mode === 'wait-for-real';
    const runIsLoadProfile = executionModeRef.current === 'load-profile';
    const runLoadProfile = loadProfileRef.current;
    const runConcurrency = concurrencyRef.current;
    const runIterations = iterationsRef.current;

    const config = buildWorkflowRunnerTestConfig({
      runWorkflow,
      runWorkflowId,
      runVariables,
      resolvedBaseUrl,
      isWaitForReal,
      runIsLoadProfile,
      runLoadProfile,
      runConcurrency,
      runIterations,
      thinkTime,
      timeoutSec,
      retryCount,
      retryDelayMs,
      errorPolicy,
      maxErrors,
      maxErrorRate,
      workflowSlaOverrides,
      hasCorrelationWait,
      correlationWaitConfig,
      hasWaitForCondition,
      maxConcurrentPolls,
      traceOptions: traceOptionsRef.current,
    });

    try {
      saveWorkflowRunConfig({ workflowId: runWorkflowId, variables: runVariables });
    } catch (err) {
      console.warn('[WorkflowRunner] Could not save run variable history:', err);
    }

    const resolveSubWorkflow = (id: string) => {
      const found = workflowsRef.current.find(w => w.id === id);
      if (found) return found;
      for (const entry of sampleWorkflowCatalog) {
        if (!entry.companionFactories) continue;
        for (const cf of entry.companionFactories) {
          const companion = cf();
          if (companion.id === id) return companion;
        }
      }
      return undefined;
    };

    void execute(config, [], { projectName: runWorkflow.name }, runWorkflow, resolveSubWorkflow, {
      microservices, globalAuthProfiles, selectedEnvId, selectedSvcId,
    });
    return true;
  };

  handleRunRef.current = handleRun;

  useWorkflowRunnerBridge({
    workflowsRef,
    selectedWorkflowIdRef,
    workflowVariablesRef,
    executionModeRef,
    iterationsRef,
    concurrencyRef,
    traceOptionsRef,
    handleRunRef,
    setSelectedWorkflowId,
    setWorkflowVariables,
    setVariablesInitialized,
    setExecutionMode,
    setIterations,
    setConcurrency,
    setTraceOptions,
  });

  const handleAbort = () => {
    abort();
  };

  const handleSaveWebhookScenario = useCallback((scenario: Omit<WebhookScenario, 'id' | 'createdAt'>) => {
    if (!selectedWorkflowId) return;
    const saved = saveWebhookScenario(selectedWorkflowId, scenario);
    setWebhookScenarios(prev => [...prev, saved]);
  }, [selectedWorkflowId]);

  const handleDeleteWebhookScenario = useCallback((scenarioId: string) => {
    if (!selectedWorkflowId) return;
    deleteWebhookScenario(selectedWorkflowId, scenarioId);
    setWebhookScenarios(prev => prev.filter(s => s.id !== scenarioId));
  }, [selectedWorkflowId]);

  const handleFireWebhook = useCallback(async (nodeId: string, correlationId: string, payload: Record<string, unknown>) => {
    const node = selectedWorkflow?.nodes.find(n => n.id === nodeId);
    if (!node) throw new Error('Node not found');

    const nodeData = node.data as import('../workflow/types/workflow').CorrelationWaitNodeData;
    const webhookPath = nodeData.webhookPath || '/webhooks/callback';

    const resolvedPayload = buildPayloadWithCorrelationId(payload, correlationId);

    await fireWebhook(correlationId, resolvedPayload, webhookPath);
  }, [selectedWorkflow]);

  const kafkaLoadBanners = useMemo(
    () => computeKafkaLoadBanners(selectedWorkflow),
    [selectedWorkflow],
  );

  const hasLiveProgress = isRunning || liveSummary;
  const showProgress = hasLiveProgress || (!isRunning && savedProgress);

  const displaySummary = liveSummary ?? savedProgress?.summary ?? null;
  const displayTimeSeries = isRunning ? timeSeries : (timeSeries.length > 0 ? timeSeries : savedProgress?.timeSeries ?? []);
  const displayCompleted = hasLiveProgress ? completed : savedProgress?.completed ?? 0;
  const displayTotal = hasLiveProgress ? total : savedProgress?.total ?? 0;
  const displayProfileMeta = profileMeta ?? savedProgress?.profileMeta ?? null;
  const displayLoadProfile = hasLiveProgress ? loadProfile : savedProgress?.loadProfile ?? loadProfile;
  const displayThinkTime = hasLiveProgress ? thinkTime : savedProgress?.thinkTime ?? thinkTime;
  const displayExecMode = hasLiveProgress ? 'workflow' : savedProgress?.executionMode ?? 'workflow';
  const displayConc = hasLiveProgress ? concurrency : savedProgress?.concurrency ?? concurrency;

  const hostLabel = selectedWorkflow ? `⚡ ${selectedWorkflow.name}` : undefined;

  return (
    <div className="page">
      <div className="page-header">
        <h2>Workflow Runner</h2>
      </div>

      <WorkflowPicker
        workflows={workflows}
        folders={folders}
        selectedWorkflowId={selectedWorkflowId}
        onWorkflowChange={setSelectedWorkflowId}
        variables={workflowVariables}
        onVariablesChange={setWorkflowVariables}
        disabled={isRunning}
        onImportSample={onImportSample ? (wf) => {
          const newId = onImportSample(wf);
          if (typeof newId === 'string') {
            setSelectedWorkflowId(newId);
            setWorkflowVariables(buildInitialRunnerVariables(wf));
          }
        } : undefined}
      />

      {selectedWorkflow && (
        <WorkflowRunnerConfigSection
          selectedWorkflow={selectedWorkflow}
          workflowDefinitionTargets={workflowDefinitionTargets}
          workflowSlaOverrides={workflowSlaOverrides}
          onWorkflowSlaOverridesChange={setWorkflowSlaOverrides}
          isWebhookTriggered={isWebhookTriggered}
          webhookRunMode={webhookRunMode}
          onWebhookRunModeChange={setWebhookRunMode}
          webhookLoadConfig={webhookLoadConfig}
          onWebhookLoadConfigChange={setWebhookLoadConfig}
          webhookTriggerNode={webhookTriggerNode}
          hasCorrelationWait={hasCorrelationWait}
          correlationWaitConfig={correlationWaitConfig}
          onCorrelationWaitConfigChange={setCorrelationWaitConfig}
          hasWaitForCondition={hasWaitForCondition}
          isRunning={isRunning}
          onFireWebhook={handleFireWebhook}
          webhookScenarios={webhookScenarios}
          onSaveWebhookScenario={handleSaveWebhookScenario}
          onDeleteWebhookScenario={handleDeleteWebhookScenario}
          maxConcurrentPolls={maxConcurrentPolls}
          onMaxConcurrentPollsChange={setMaxConcurrentPolls}
          concurrency={concurrency}
          traceOptions={traceOptions}
          onTraceOptionsChange={setTraceOptions}
          executionMode={executionMode}
          onExecutionModeChange={setExecutionMode}
          onConcurrencyChange={setConcurrency}
          iterations={iterations}
          onIterationsChange={setIterations}
          timeoutSec={timeoutSec}
          onTimeoutSecChange={setTimeoutSec}
          retryCount={retryCount}
          onRetryCountChange={setRetryCount}
          retryDelayMs={retryDelayMs}
          onRetryDelayMsChange={setRetryDelayMs}
          errorPolicy={errorPolicy}
          onErrorPolicyChange={setErrorPolicy}
          maxErrors={maxErrors}
          onMaxErrorsChange={setMaxErrors}
          maxErrorRate={maxErrorRate}
          onMaxErrorRateChange={setMaxErrorRate}
          loadProfile={loadProfile}
          onLoadProfileChange={updateProfile}
          thinkTime={thinkTime}
          onThinkTimeChange={(patch) => setThinkTime((prev) => ({ ...prev, ...patch }))}
          kafkaLoadBanners={kafkaLoadBanners}
          onRun={handleRun}
          onAbort={handleAbort}
        />
      )}

      {showProgress && (
        <LiveProgressPanel
          isRunning={isRunning}
          completed={displayCompleted}
          total={displayTotal}
          summary={displaySummary}
          timeSeries={displayTimeSeries}
          profileMeta={displayProfileMeta}
          executionMode={displayExecMode as 'workflow' | 'load-profile'}
          concurrency={displayConc}
          loadProfile={displayLoadProfile}
          thinkTime={displayThinkTime}
          hostLabel={hostLabel}
          onClear={!isRunning && savedProgress ? handleClearProgress : undefined}
        />
      )}

      {finalRun && !isRunning && (
        <div className="completion-section">
          <div className="completion-banner">
            Workflow completed — {finalRun.results.length} requests in {(finalRun.summary.totalDurationMs / 1000).toFixed(2)}s
          </div>
          <button className="btn btn-primary" onClick={() => onComplete('workflow')}>
            View Full Results →
          </button>
        </div>
      )}
      {!isRunning && !finalRun && savedProgress && (
        <div className="completion-section">
          <div className="completion-banner">
            Last run — {savedProgress.resultCount} requests in {(savedProgress.durationMs / 1000).toFixed(2)}s
          </div>
          <button className="btn btn-primary" onClick={() => onComplete('workflow')}>
            View Full Results →
          </button>
        </div>
      )}

      {error && <div className="error-banner">{error}</div>}

      {pendingRun && (
        <div className="storage-quota-banner">
          <div className="storage-quota-msg">
            <strong>Storage full</strong> — the test completed successfully but could not be saved due to a storage error.
            Would you like to remove old runs and retry?
          </div>
          <div className="storage-quota-actions">
            <button className="btn btn-primary btn-sm" onClick={confirmSavePendingRun}>Yes, remove old runs &amp; save</button>
            <button className="btn btn-sm" onClick={dismissPendingRun}>Discard this run</button>
          </div>
        </div>
      )}
    </div>
  );
}
