import { useState, useEffect, useMemo } from 'react';
import type { TestConfig, LoadProfileConfig, CorrelationWaitRunnerConfig } from '../../shared/types';
import type { Workflow } from '../workflow/types/workflow';
import { useTestExecution } from './hooks/useTestExecution';
import { useWorkflowRunnerConfig } from './hooks/useWorkflowRunnerConfig';
import WorkflowPicker from './components/WorkflowPicker';
import { saveWorkflowRunConfig } from './utils/workflowRunConfigStorage';
import RunnerExecutionConfig from './components/RunnerExecutionConfig';
import LiveProgressPanel from './components/LiveProgressPanel';
import CorrelationWaitConfigPanel from './components/CorrelationWaitConfig';
import { type PersistedProgress, saveProgress, loadProgress, clearProgress } from './utils/runnerProgressStorage';

interface Props {
  workflows: Workflow[];
  /** Called when run completes. Pass 'workflow' to pre-filter results to workflow runs. */
  onComplete: (runType?: 'test' | 'workflow') => void;
  /** Optional: Pre-select a workflow when navigating from Workflow Designer's "Run in Harness" button. */
  initialWorkflowId?: string | null;
  /** Clear the initialWorkflowId after it has been applied. */
  onClearInitialWorkflowId?: () => void;
}

const PROGRESS_KEY = '_workflow_runner_progress';

export default function WorkflowRunner({ workflows, onComplete, initialWorkflowId, onClearInitialWorkflowId }: Props) {
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
  } = useWorkflowRunnerConfig();

  const [workflowVariables, setWorkflowVariables] = useState<Record<string, string>>({});
  const [savedProgress, setSavedProgress] = useState<PersistedProgress | null>(null);
  const [variablesInitialized, setVariablesInitialized] = useState(false);
  const [correlationWaitConfig, setCorrelationWaitConfig] = useState<CorrelationWaitRunnerConfig | undefined>(undefined);

  const { isRunning, completed, total, liveSummary, profileMeta, timeSeries, error, execute, abort, finalRun, pendingRun, confirmSavePendingRun, dismissPendingRun } = useTestExecution();

  const selectedWorkflow = workflows.find(w => w.id === selectedWorkflowId) ?? null;

  // Handle "Run in Harness" navigation from Workflow Designer - pre-select the workflow
  useEffect(() => {
    if (initialWorkflowId && initialWorkflowId !== selectedWorkflowId) {
      const wf = workflows.find(w => w.id === initialWorkflowId);
      if (wf) {
        setSelectedWorkflowId(initialWorkflowId);
        setWorkflowVariables({ ...wf.variables });
        setVariablesInitialized(true);
      }
      onClearInitialWorkflowId?.();
    }
  }, [initialWorkflowId, workflows, selectedWorkflowId, setSelectedWorkflowId, onClearInitialWorkflowId]);

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

  // Max concurrent polls config (for WaitForCondition throttling)
  const [maxConcurrentPolls, setMaxConcurrentPolls] = useState(20);

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

    // Force single transaction for "wait-for-real" mode
    const isWaitForReal = correlationWaitConfig?.mode === 'wait-for-real';

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
    };

    saveWorkflowRunConfig({ workflowId: selectedWorkflowId!, variables: workflowVariables });
    execute(config, [], { projectName: selectedWorkflow.name }, selectedWorkflow);
  };

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
      />

      {selectedWorkflow && (
        <>
          {/* CorrelationWait behavior config — right after workflow selection since it's workflow-specific */}
          {hasCorrelationWait && (
            <CorrelationWaitConfigPanel
              workflow={selectedWorkflow}
              config={correlationWaitConfig}
              onChange={setCorrelationWaitConfig}
              disabled={isRunning}
            />
          )}

          {/* WaitForCondition poll throttle — prevents poll storms during load tests */}
          {hasWaitForCondition && (
            <div className="config-section wf-runner-poll-throttle-section">
              <div className="config-section-header">
                <span className="config-section-icon">🔄</span>
                <h3>Poll Throttle</h3>
                <span className="config-section-badge">
                  {selectedWorkflow.nodes.filter(n => n.type === 'waitForCondition').length} node{selectedWorkflow.nodes.filter(n => n.type === 'waitForCondition').length > 1 ? 's' : ''}
                </span>
              </div>
              <div className="wf-runner-poll-throttle-field">
                <span className="wf-runner-poll-label-text">Max Concurrent Polls</span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={maxConcurrentPolls}
                  onChange={(e) => setMaxConcurrentPolls(Math.max(1, parseInt(e.target.value) || 20))}
                  disabled={isRunning}
                />
                <span className="wf-runner-poll-hint">
                  Limit simultaneous polls across {concurrency} concurrent iteration{concurrency > 1 ? 's' : ''}
                </span>
              </div>
            </div>
          )}

          {/* Execution settings (concurrency, iterations, etc.) */}
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

          <div className="config-form" style={{ marginTop: 16 }}>
            <div className="form-actions">
              {!isRunning ? (
                <button className="btn btn-primary btn-lg" onClick={handleRun}>
                  ▶ Run Workflow
                </button>
              ) : (
                <button className="btn btn-danger btn-lg" onClick={abort}>
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
