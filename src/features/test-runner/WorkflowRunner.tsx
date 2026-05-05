import { useState, useEffect, useRef } from 'react';
import type { TestConfig, LoadProfileConfig } from '../../shared/types';
import type { Workflow } from '../workflow/types/workflow';
import { useTestExecution } from './hooks/useTestExecution';
import { useWorkflowRunnerConfig } from './hooks/useWorkflowRunnerConfig';
import WorkflowPicker, { saveWorkflowRunConfig } from './components/WorkflowPicker';
import RunnerExecutionConfig, { profileLabel } from './components/RunnerExecutionConfig';
import LiveProgressPanel from './components/LiveProgressPanel';
import { type PersistedProgress, saveProgress, loadProgress, clearProgress, thinkTimeLabel } from './utils/runnerProgressStorage';

interface Props {
  workflows: Workflow[];
  /** Called when run completes. Pass 'workflow' to pre-filter results to workflow runs. */
  onComplete: (runType?: 'test' | 'workflow') => void;
}

const PROGRESS_KEY = '_workflow_runner_progress';

export default function WorkflowRunner({ workflows, onComplete }: Props) {
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

  const { isRunning, completed, total, liveSummary, liveResults, profileMeta, timeSeries, error, execute, abort, finalRun, pendingRun, confirmSavePendingRun, dismissPendingRun } = useTestExecution();

  const selectedWorkflow = workflows.find(w => w.id === selectedWorkflowId) ?? null;

  // Initialize variables when workflow selection is restored from storage
  useEffect(() => {
    if (selectedWorkflow && !variablesInitialized) {
      setWorkflowVariables({ ...selectedWorkflow.variables });
      setVariablesInitialized(true);
    }
  }, [selectedWorkflow, variablesInitialized]);
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

    const config: TestConfig = {
      concurrency: isLoadProfile ? loadProfile.maxConcurrency : concurrency,
      totalTransactions: isLoadProfile ? 0 : totalTransactions,
      scenarioWeights: [],
      executionMode: 'workflow',
      ...(isLoadProfile ? { loadProfile } : {}),
      thinkTime: thinkTime.mode !== 'none' ? thinkTime : undefined,
      timeoutSec: timeoutSec > 0 ? timeoutSec : undefined,
      retryCount: retryCount > 0 ? retryCount : 0,
      retryDelayMs,
      errorPolicy,
      maxErrors,
      maxErrorRate,
      workflowVariables: Object.keys(workflowVariables).length > 0 ? workflowVariables : undefined,
      workflowId: selectedWorkflowId!,
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
  const displayIsTimeBased = hasLiveProgress ? isLoadProfile : savedProgress?.isTimeBased ?? false;
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
          executionMode={displayExecMode as any}
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
