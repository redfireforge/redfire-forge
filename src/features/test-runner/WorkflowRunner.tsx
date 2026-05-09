import { useState, useEffect, useMemo, useCallback } from 'react';
import type { TestConfig, LoadProfileConfig, CorrelationWaitRunnerConfig, ExecutionTraceOptions } from '../../shared/types';
import type { Workflow, WebhookTriggerNodeData } from '../workflow/types/workflow';
import { useTestExecution } from './hooks/useTestExecution';
import { useWorkflowRunnerConfig } from './hooks/useWorkflowRunnerConfig';
import WorkflowPicker from './components/WorkflowPicker';
import { saveWorkflowRunConfig } from './utils/workflowRunConfigStorage';
import RunnerExecutionConfig from './components/RunnerExecutionConfig';
import LiveProgressPanel from './components/LiveProgressPanel';
import CorrelationWaitConfigPanel from './components/CorrelationWaitConfig';
import WebhookLoadDriverPanel, { type WebhookLoadConfig } from './components/WebhookLoadDriverPanel';
import MultiWebhookTestingPanel, { type WebhookScenario } from './components/MultiWebhookTestingPanel';
import { type PersistedProgress, saveProgress, loadProgress, clearProgress } from './utils/runnerProgressStorage';
import { runWebhookLoadTest, calculateTotalRequests } from '../workflow/engine/webhookLoadDriver';
import { loadWebhookScenarios, saveWebhookScenario, deleteWebhookScenario, fireWebhook, buildPayloadWithCorrelationId } from './utils/webhookScenarioStorage';

interface Props {
  workflows: Workflow[];
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
}

const PROGRESS_KEY = '_workflow_runner_progress';

export default function WorkflowRunner({ workflows, onComplete, initialWorkflowId, onClearInitialWorkflowId, onImportSample, resolvedBaseUrl }: Props) {
  const {
    concurrency, setConcurrency,
    totalTransactions, setTotalTransactions,
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
    configLoaded,
  } = useWorkflowRunnerConfig();

  const [workflowVariables, setWorkflowVariables] = useState<Record<string, string>>({});
  const [savedProgress, setSavedProgress] = useState<PersistedProgress | null>(null);
  const [variablesInitialized, setVariablesInitialized] = useState(false);
  const [correlationWaitConfig, setCorrelationWaitConfig] = useState<CorrelationWaitRunnerConfig | undefined>(undefined);

  const { isRunning, completed, total, liveSummary, profileMeta, timeSeries, error, execute, abort, finalRun, pendingRun, confirmSavePendingRun, dismissPendingRun, startExternalExecution } = useTestExecution();

  const selectedWorkflow = workflows.find(w => w.id === selectedWorkflowId) ?? null;

  // Handle "Run in Harness" navigation from Workflow Designer - pre-select the workflow
  // Wait for config to be loaded before applying initialWorkflowId to avoid timing issues
  useEffect(() => {
    if (configLoaded && initialWorkflowId && initialWorkflowId !== selectedWorkflowId) {
      const wf = workflows.find(w => w.id === initialWorkflowId);
      if (wf) {
        setSelectedWorkflowId(initialWorkflowId);
        setWorkflowVariables({ ...wf.variables });
        setVariablesInitialized(true);
      }
      onClearInitialWorkflowId?.();
    }
  }, [configLoaded, initialWorkflowId, workflows, selectedWorkflowId, setSelectedWorkflowId, onClearInitialWorkflowId]);

  // Initialize variables when workflow selection is restored from storage
  useEffect(() => {
    if (selectedWorkflow && !variablesInitialized) {
      setWorkflowVariables({ ...selectedWorkflow.variables });
      setVariablesInitialized(true);
    }
  }, [selectedWorkflow, variablesInitialized]);

  // Detect if workflow has CorrelationWait nodes and auto-initialize config
  const hasCorrelationWait = useMemo(() => {
    return selectedWorkflow?.nodes.some(n => n.type === 'correlationWait') ?? false;
  }, [selectedWorkflow]);

  // Detect if workflow has WaitForCondition nodes (for poll throttling)
  const hasWaitForCondition = useMemo(() => {
    return selectedWorkflow?.nodes.some(n => n.type === 'waitForCondition') ?? false;
  }, [selectedWorkflow]);

  // Detect if workflow starts with a Webhook Trigger node (Phase 7c)
  const webhookTriggerNode = useMemo(() => {
    if (!selectedWorkflow) return null;
    const webhookNode = selectedWorkflow.nodes.find(n => n.type === 'webhook');
    if (!webhookNode) return null;

    // Must have outgoing edges (disconnected/orphaned webhook nodes don't count)
    const hasOutgoing = selectedWorkflow.edges.some(e => e.source === webhookNode.id);
    if (!hasOutgoing) return null;

    // Must have no real incoming edges (it's a trigger, not mid-workflow)
    // Ignore edges from orphaned Start nodes (Start nodes that only connect to this webhook)
    const incomingEdges = selectedWorkflow.edges.filter(e => e.target === webhookNode.id);
    const hasRealIncoming = incomingEdges.some(edge => {
      const sourceNode = selectedWorkflow.nodes.find(n => n.id === edge.source);
      if (!sourceNode) return false;
      if (sourceNode.type === 'start') {
        const startOtherOutgoing = selectedWorkflow.edges.filter(
          e => e.source === sourceNode.id && e.target !== webhookNode.id
        );
        if (startOtherOutgoing.length === 0) return false;
      }
      return true;
    });
    if (hasRealIncoming) return null;

    return webhookNode;
  }, [selectedWorkflow]);

  const isWebhookTriggered = webhookTriggerNode !== null;

  // Webhook run mode: 'single' runs workflow once with sample payload, 'load' runs load test
  const [webhookRunMode, setWebhookRunMode] = useState<'single' | 'load'>('single');

  // Webhook load driver config (Phase 7c)
  const [webhookLoadConfig, setWebhookLoadConfig] = useState<WebhookLoadConfig | null>(null);

  // Reset webhook state when switching workflows or when webhook is not detected
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

  // Max concurrent polls config (for WaitForCondition throttling)
  const [maxConcurrentPolls, setMaxConcurrentPolls] = useState(20);

  // Trace capture options (for Results Explorer)
  const [traceOptions, setTraceOptions] = useState<ExecutionTraceOptions>({
    captureFullTrace: false,
    alwaysCaptureFailures: true,
  });

  // Webhook scenarios for multi-webhook testing (Phase 7f)
  const [webhookScenarios, setWebhookScenarios] = useState<WebhookScenario[]>([]);

  // Auto-initialize correlation config when workflow changes
  useEffect(() => {
    if (hasCorrelationWait && !correlationWaitConfig) {
      // Auto-initialize with auto-resume mode (most common for load tests)
      setCorrelationWaitConfig({ mode: 'auto-resume', mockPayloads: {} });
    } else if (!hasCorrelationWait && correlationWaitConfig) {
      // Clear config when switching to workflow without CorrelationWait
      setCorrelationWaitConfig(undefined);
    }
  }, [hasCorrelationWait, correlationWaitConfig, selectedWorkflowId]);

  // Load webhook scenarios when workflow changes (Phase 7f)
  useEffect(() => {
    if (selectedWorkflowId && hasCorrelationWait) {
      setWebhookScenarios(loadWebhookScenarios(selectedWorkflowId));
    } else {
      setWebhookScenarios([]);
    }
  }, [selectedWorkflowId, hasCorrelationWait]);

  const isLoadProfile = executionMode === 'load-profile';

  // Load saved progress on mount
  useEffect(() => {
    setSavedProgress(loadProgress(PROGRESS_KEY));
  }, []);

  // Save progress when run completes
  useEffect(() => {
    if (finalRun && liveSummary && !isRunning) {
      const data: PersistedProgress = {
        summary: liveSummary,
        timeSeries,
        completed,
        total,
        profileMeta,
        isTimeBased: isLoadProfile,
        executionMode,
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

  const handleRun = () => {
    if (!selectedWorkflow) return;

    // If this is a webhook-triggered workflow in load test mode, use the webhook load driver
    if (isWebhookTriggered && webhookRunMode === 'load' && webhookLoadConfig) {
      handleWebhookLoadRun();
      return;
    }

    // For webhook workflows in single mode, or regular workflows, use standard execution
    // Force single transaction for "wait-for-real" mode
    const isWaitForReal = correlationWaitConfig?.mode === 'wait-for-real';

    // Determine base URL: explicit workflow variable > environment config
    const effectiveBaseUrl = workflowVariables.baseUrl?.trim() || resolvedBaseUrl?.trim() || undefined;

    const config: TestConfig = {
      concurrency: isWaitForReal ? 1 : (isLoadProfile ? loadProfile.maxConcurrency : concurrency),
      totalTransactions: isWaitForReal ? 1 : (isLoadProfile ? 0 : totalTransactions),
      scenarioWeights: [],
      executionMode: 'workflow',
      ...(isLoadProfile && !isWaitForReal ? { loadProfile } : {}),
      thinkTime: thinkTime.mode !== 'none' ? thinkTime : undefined,
      timeoutSec: timeoutSec > 0 ? timeoutSec : undefined,
      retryCount: retryCount > 0 ? retryCount : 0,
      retryDelayMs,
      errorPolicy,
      maxErrors,
      maxErrorRate,
      workflowVariables: Object.keys(workflowVariables).length > 0 ? workflowVariables : undefined,
      workflowId: selectedWorkflowId!,
      correlationWaitConfig: hasCorrelationWait ? correlationWaitConfig : undefined,
      maxConcurrentPolls: hasWaitForCondition ? maxConcurrentPolls : undefined,
      traceOptions,
      workflowBaseUrl: effectiveBaseUrl,
    };

    saveWorkflowRunConfig({ workflowId: selectedWorkflowId!, variables: workflowVariables });
    execute(config, [], { projectName: selectedWorkflow.name }, selectedWorkflow, workflows);
  };

  // Webhook load test execution (Phase 7c)
  const handleWebhookLoadRun = async () => {
    if (!selectedWorkflow || !webhookLoadConfig) return;

    const totalReqs = calculateTotalRequests(webhookLoadConfig.rate);
    const captureTraces = traceOptions.captureFullTrace;
    
    // Start external execution tracking with useTestExecution
    const { reportProgress, complete, fail, abortSignal } = startExternalExecution(
      totalReqs,
      { projectName: `Webhook: ${selectedWorkflow.name}` }
    );

    const collectedResults: import('../../../shared/types').RequestResult[] = [];

    try {
      // Register workflow with the webhook server before starting load test
      const serverHost = window.location.hostname || 'localhost';
      const registerUrl = `http://${serverHost}:3001/api/workflows/${selectedWorkflow.id}`;
      try {
        const registerRes = await fetch(registerUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(selectedWorkflow),
        });
        if (!registerRes.ok) {
          throw new Error(`Failed to register workflow: ${registerRes.status} ${registerRes.statusText}`);
        }
      } catch (regErr) {
        // If registration fails, it's likely the server isn't running
        const errMsg = regErr instanceof Error ? regErr.message : String(regErr);
        if (errMsg.includes('Failed to fetch') || errMsg.includes('NetworkError')) {
          fail('Webhook server not running. Start it with: npm run server');
          return;
        }
        throw regErr;
      }

      const loadResult = await runWebhookLoadTest(
        {
          webhookUrl: webhookLoadConfig.webhookUrl,
          method: webhookLoadConfig.method,
          payloadTemplate: webhookLoadConfig.payloadTemplate,
          rate: webhookLoadConfig.rate,
          headers: webhookLoadConfig.headers,
          captureTraces, // Pass trace capture option
        },
        {
          onProgress: (_completed, _total, _rps) => {
            // Progress is now reported on each request completion for accuracy
          },
          onRequestComplete: (result) => {
            collectedResults.push(result);
            // Report progress after each request for accurate UI updates
            reportProgress(collectedResults, collectedResults.length);
          },
        },
        abortSignal,
      );

      // Build execution trace if traces were captured
      let executionTrace: import('../../../shared/types').WorkflowExecutionTrace | undefined;
      if (captureTraces && loadResult.iterationTraces && loadResult.iterationTraces.length > 0) {
        // Collect all traversed edges from all iterations
        const allTraversedEdges = new Set<string>();
        for (const iter of loadResult.iterationTraces) {
          for (const edgeId of iter.traversedEdges || []) {
            allTraversedEdges.add(edgeId);
          }
        }
        
        // Filter out orphaned Start nodes (Start nodes that only connect to the webhook trigger)
        // These are legacy nodes that shouldn't appear in webhook-triggered workflows
        const webhookNodeId = webhookTriggerNode?.id;
        const filteredNodes = selectedWorkflow.nodes.filter(node => {
          if (node.type !== 'start') return true;
          // Check if this Start node only connects to the webhook node
          const outgoingEdges = selectedWorkflow.edges.filter(e => e.source === node.id);
          if (outgoingEdges.length === 0) return false; // Orphaned with no edges
          if (outgoingEdges.length === 1 && outgoingEdges[0].target === webhookNodeId) return false; // Only connects to webhook
          return true;
        });
        
        // Filter out edges from removed Start nodes
        const removedNodeIds = new Set(
          selectedWorkflow.nodes.filter(n => !filteredNodes.includes(n)).map(n => n.id)
        );
        const filteredEdges = selectedWorkflow.edges.filter(
          e => !removedNodeIds.has(e.source) && !removedNodeIds.has(e.target)
        );
        
        executionTrace = {
          workflowId: selectedWorkflow.id,
          workflowName: selectedWorkflow.name,
          iterations: loadResult.iterationTraces,
          traversedEdges: Array.from(allTraversedEdges),
          workflowSnapshot: {
            nodes: filteredNodes,
            edges: filteredEdges,
          },
          totalIterations: loadResult.iterationTraces.length,
          totalDurationMs: loadResult.actualDurationMs,
          fullTraceCaptured: true,
        };
      }

      // Complete and save results
      const config: TestConfig = {
        concurrency: 1,
        totalTransactions: totalReqs,
        scenarioWeights: [],
        executionMode: 'workflow',
        workflowId: selectedWorkflowId!,
        traceOptions: captureTraces ? traceOptions : undefined,
      };
      
      saveWorkflowRunConfig({ workflowId: selectedWorkflowId!, variables: workflowVariables });
      await complete(config, executionTrace);
    } catch (err) {
      if (!abortSignal.aborted) {
        fail(err instanceof Error ? err.message : String(err));
      }
    }
  };

  const handleAbort = () => {
    abort();
  };

  // Webhook scenario handlers (Phase 7f)
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
    // Find the node to get webhook path
    const node = selectedWorkflow?.nodes.find(n => n.id === nodeId);
    if (!node) throw new Error('Node not found');
    
    const nodeData = node.data as import('../workflow/types/workflow').CorrelationWaitNodeData;
    const webhookPath = nodeData.webhookPath || '/webhooks/callback';
    
    // Build resolved payload with correlation ID
    const resolvedPayload = buildPayloadWithCorrelationId(payload, correlationId);
    
    await fireWebhook(correlationId, resolvedPayload, webhookPath);
  }, [selectedWorkflow]);

  const hasLiveProgress = isRunning || liveSummary;
  const showProgress = hasLiveProgress || (!isRunning && savedProgress);

  const displaySummary = liveSummary ?? savedProgress?.summary ?? null;
  const displayTimeSeries = isRunning ? timeSeries : (timeSeries.length > 0 ? timeSeries : savedProgress?.timeSeries ?? []);
  const displayCompleted = hasLiveProgress ? completed : savedProgress?.completed ?? 0;
  const displayTotal = hasLiveProgress ? total : savedProgress?.total ?? 0;
  const displayProfileMeta = profileMeta ?? savedProgress?.profileMeta ?? null;
  const _displayIsTimeBased = hasLiveProgress ? isLoadProfile : savedProgress?.isTimeBased ?? false;
  const displayLoadProfile = hasLiveProgress ? loadProfile : savedProgress?.loadProfile ?? loadProfile;
  const displayThinkTime = hasLiveProgress ? thinkTime : savedProgress?.thinkTime ?? thinkTime;
  const displayExecMode = hasLiveProgress ? 'workflow' : savedProgress?.executionMode ?? 'workflow';
  const displayConc = hasLiveProgress ? concurrency : savedProgress?.concurrency ?? concurrency;

  // Host label for progress panel — show workflow name
  const hostLabel = selectedWorkflow ? `⚡ ${selectedWorkflow.name}` : undefined;

  return (
    <div className="page">
      <div className="page-header">
        <h2>Workflow Runner</h2>
      </div>

      <WorkflowPicker
        workflows={workflows}
        selectedWorkflowId={selectedWorkflowId}
        onWorkflowChange={setSelectedWorkflowId}
        variables={workflowVariables}
        onVariablesChange={setWorkflowVariables}
        disabled={isRunning}
        onImportSample={onImportSample ? (wf) => {
          const newId = onImportSample(wf);
          if (typeof newId === 'string') {
            setSelectedWorkflowId(newId);
            setWorkflowVariables({ ...wf.variables });
          }
        } : undefined}
      />

        {selectedWorkflow && (
          <>
            {/* Webhook run mode selector — shown when workflow starts with webhook trigger */}
            {isWebhookTriggered && (
              <div className="webhook-run-mode-selector">
                <span className="webhook-mode-label">Run Mode:</span>
                <div className="webhook-mode-buttons">
                  <button
                    className={`webhook-mode-btn ${webhookRunMode === 'single' ? 'active' : ''}`}
                    onClick={() => setWebhookRunMode('single')}
                    disabled={isRunning}
                  >
                    Single Run
                  </button>
                  <button
                    className={`webhook-mode-btn ${webhookRunMode === 'load' ? 'active' : ''}`}
                    onClick={() => setWebhookRunMode('load')}
                    disabled={isRunning}
                  >
                    Load Test
                  </button>
                </div>
                <span className="webhook-mode-hint">
                  {webhookRunMode === 'single' 
                    ? '— Run workflow once using sample payload (supports Full Trace)' 
                    : '— Send many requests to webhook endpoint'}
                </span>
              </div>
            )}

            {/* Webhook Load Driver Panel (Phase 7c) — shown when workflow starts with webhook trigger AND in load mode */}
            {isWebhookTriggered && webhookRunMode === 'load' && webhookLoadConfig && webhookTriggerNode && (
              <WebhookLoadDriverPanel
                webhookUrl={webhookLoadConfig.webhookUrl}
                method={webhookLoadConfig.method}
                initialPayload={(webhookTriggerNode.data as WebhookTriggerNodeData).samplePayload || '{}'}
                config={webhookLoadConfig}
                onChange={setWebhookLoadConfig}
                disabled={isRunning}
              />
            )}

          {/* CorrelationWait behavior config — right after workflow selection since it's workflow-specific */}
          {hasCorrelationWait && (
            <CorrelationWaitConfigPanel
              workflow={selectedWorkflow}
              config={correlationWaitConfig}
              onChange={setCorrelationWaitConfig}
              disabled={isRunning}
            />
          )}

          {/* Multi-Webhook Testing Panel (Phase 7f) — shown when in wait-for-real mode with multiple webhooks */}
          {hasCorrelationWait && correlationWaitConfig?.mode === 'wait-for-real' && (
            <MultiWebhookTestingPanel
              workflow={selectedWorkflow}
              isRunning={isRunning}
              onFireWebhook={handleFireWebhook}
              scenarios={webhookScenarios}
              onSaveScenario={handleSaveWebhookScenario}
              onDeleteScenario={handleDeleteWebhookScenario}
            />
          )}

          {/* Execution options - subtle inline row */}
          <div className="wf-runner-inline-options">
            {/* Poll throttle - only shown when workflow has WaitForCondition nodes (non-webhook workflows) */}
            {!isWebhookTriggered && hasWaitForCondition && (
              <div className="wf-inline-option">
                <span className="wf-inline-label">Poll limit</span>
                <input
                  type="number"
                  className="wf-inline-input"
                  min={1}
                  max={100}
                  value={maxConcurrentPolls}
                  onChange={(e) => setMaxConcurrentPolls(Math.max(1, parseInt(e.target.value) || 20))}
                  disabled={isRunning}
                />
                <span className="wf-inline-hint">— max concurrent polls across {concurrency} iterations</span>
              </div>
            )}

            {/* Full trace capture toggle - shown for all workflow types */}
            <label className="wf-inline-toggle">
              <input
                type="checkbox"
                checked={traceOptions.captureFullTrace}
                onChange={(e) => setTraceOptions(prev => ({ ...prev, captureFullTrace: e.target.checked }))}
                disabled={isRunning}
              />
              <span className="wf-inline-toggle-label">Full trace</span>
            </label>
            <span className="wf-inline-hint">— capture request/response details for Results Explorer {traceOptions.captureFullTrace && <span className="wf-inline-warn">(≤100 iterations recommended)</span>}</span>

            {/* Trace sampling toggle */}
            {traceOptions.captureFullTrace && (
              <div className="wf-sampling-config">
                <div className="wf-sampling-row">
                  <label className="wf-inline-toggle">
                    <input
                      type="checkbox"
                      checked={traceOptions.samplingEnabled !== false}
                      onChange={(e) => setTraceOptions(prev => ({ ...prev, samplingEnabled: e.target.checked }))}
                      disabled={isRunning}
                    />
                    <span className="wf-inline-toggle-label">Trace sampling</span>
                  </label>
                  <span className="wf-inline-hint">— keep only a subset of iteration traces for large runs</span>
                </div>
                {traceOptions.samplingEnabled !== false && (
                  <div className="wf-sampling-threshold">
                    <label className="wf-inline-label">
                      Threshold:
                      <input
                        type="number"
                        min={10}
                        max={1000}
                        step={10}
                        value={traceOptions.samplingThreshold ?? 50}
                        onChange={(e) => setTraceOptions(prev => ({ ...prev, samplingThreshold: Math.max(10, parseInt(e.target.value) || 50) }))}
                        disabled={isRunning}
                        className="wf-sampling-threshold-input"
                      />
                    </label>
                    <span className="wf-inline-hint">iterations — full traces kept for runs above this count</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Execution settings (concurrency, iterations, etc.) — hidden for webhook load test mode */}
          {(!isWebhookTriggered || webhookRunMode === 'single') && (
          <div className="workflow-runner-config-section">
            <RunnerExecutionConfig
              executionMode={executionMode}
              onExecutionModeChange={setExecutionMode}
              concurrency={concurrency}
              onConcurrencyChange={setConcurrency}
              totalTransactions={totalTransactions}
              onTotalTransactionsChange={setTotalTransactions}
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
              activeTestCount={1}
              isRunning={isRunning}
              forceSingleTransaction={correlationWaitConfig?.mode === 'wait-for-real'}
              namePrefix="workflow-runner"
            />
          </div>
          )}

          {/* Run/Stop buttons */}
          <div className="config-form" style={{ marginTop: 16 }}>
            <div className="form-actions">
              {!isRunning ? (
                <button className="btn btn-primary btn-lg" onClick={handleRun}>
                  {isWebhookTriggered 
                    ? (webhookRunMode === 'load' ? '🔗 Run Webhook Load Test' : '▶ Run Workflow')
                    : '▶ Run Workflow'}
                </button>
              ) : (
                <button className="btn btn-danger btn-lg" onClick={handleAbort}>
                  ■ Stop
                </button>
              )}
            </div>
          </div>
        </>
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
