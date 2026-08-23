import type {
  CorrelationWaitRunnerConfig,
  ErrorPolicy,
  ExecutionMode,
  ExecutionTraceOptions,
  LoadProfileConfig,
  SlaTarget,
  ThinkTimeConfig,
} from '@shared/types';
import type { Workflow, WorkflowNode, WebhookTriggerNodeData } from '../workflow/types/workflow';
import RunnerSlaOverridePanel from './components/RunnerSlaOverridePanel';
import CorrelationWaitConfigPanel from './components/CorrelationWaitConfig';
import WebhookLoadDriverPanel, { type WebhookLoadConfig } from './components/WebhookLoadDriverPanel';
import MultiWebhookTestingPanel, { type WebhookScenario } from './components/MultiWebhookTestingPanel';
import RunnerExecutionConfig from './components/RunnerExecutionConfig';
import type { KafkaLoadBanners } from './computeKafkaLoadBanners';

interface SlaTargetWithScope extends SlaTarget {
  scopeLabel: string;
}

interface Props {
  selectedWorkflow: Workflow;
  workflowDefinitionTargets: SlaTargetWithScope[];
  workflowSlaOverrides: SlaTarget[];
  onWorkflowSlaOverridesChange: (targets: SlaTarget[]) => void;
  isWebhookTriggered: boolean;
  webhookRunMode: 'single' | 'load';
  onWebhookRunModeChange: (mode: 'single' | 'load') => void;
  webhookLoadConfig: WebhookLoadConfig | null;
  onWebhookLoadConfigChange: (config: WebhookLoadConfig) => void;
  webhookTriggerNode: WorkflowNode | null;
  hasCorrelationWait: boolean;
  correlationWaitConfig: CorrelationWaitRunnerConfig | undefined;
  onCorrelationWaitConfigChange: (config: CorrelationWaitRunnerConfig | undefined) => void;
  hasWaitForCondition: boolean;
  isRunning: boolean;
  onFireWebhook: (nodeId: string, correlationId: string, payload: Record<string, unknown>) => Promise<void>;
  webhookScenarios: WebhookScenario[];
  onSaveWebhookScenario: (scenario: Omit<WebhookScenario, 'id' | 'createdAt'>) => void;
  onDeleteWebhookScenario: (scenarioId: string) => void;
  maxConcurrentPolls: number;
  onMaxConcurrentPollsChange: (value: number) => void;
  concurrency: number;
  traceOptions: ExecutionTraceOptions;
  onTraceOptionsChange: React.Dispatch<React.SetStateAction<ExecutionTraceOptions>>;
  executionMode: ExecutionMode;
  onExecutionModeChange: (mode: ExecutionMode) => void;
  onConcurrencyChange: React.Dispatch<React.SetStateAction<number>>;
  iterations: number;
  onIterationsChange: React.Dispatch<React.SetStateAction<number>>;
  timeoutSec: number;
  onTimeoutSecChange: React.Dispatch<React.SetStateAction<number>>;
  retryCount: number;
  onRetryCountChange: React.Dispatch<React.SetStateAction<number>>;
  retryDelayMs: number;
  onRetryDelayMsChange: React.Dispatch<React.SetStateAction<number>>;
  errorPolicy: ErrorPolicy;
  onErrorPolicyChange: React.Dispatch<React.SetStateAction<ErrorPolicy>>;
  maxErrors: number;
  onMaxErrorsChange: React.Dispatch<React.SetStateAction<number>>;
  maxErrorRate: number;
  onMaxErrorRateChange: React.Dispatch<React.SetStateAction<number>>;
  loadProfile: LoadProfileConfig;
  onLoadProfileChange: (patch: Partial<LoadProfileConfig>) => void;
  thinkTime: ThinkTimeConfig;
  onThinkTimeChange: (patch: Partial<ThinkTimeConfig>) => void;
  kafkaLoadBanners: KafkaLoadBanners;
  onRun: () => boolean;
  onAbort: () => void;
}

export default function WorkflowRunnerConfigSection({
  selectedWorkflow,
  workflowDefinitionTargets,
  workflowSlaOverrides,
  onWorkflowSlaOverridesChange,
  isWebhookTriggered,
  webhookRunMode,
  onWebhookRunModeChange,
  webhookLoadConfig,
  onWebhookLoadConfigChange,
  webhookTriggerNode,
  hasCorrelationWait,
  correlationWaitConfig,
  onCorrelationWaitConfigChange,
  hasWaitForCondition,
  isRunning,
  onFireWebhook,
  webhookScenarios,
  onSaveWebhookScenario,
  onDeleteWebhookScenario,
  maxConcurrentPolls,
  onMaxConcurrentPollsChange,
  concurrency,
  traceOptions,
  onTraceOptionsChange,
  executionMode,
  onExecutionModeChange,
  onConcurrencyChange,
  iterations,
  onIterationsChange,
  timeoutSec,
  onTimeoutSecChange,
  retryCount,
  onRetryCountChange,
  retryDelayMs,
  onRetryDelayMsChange,
  errorPolicy,
  onErrorPolicyChange,
  maxErrors,
  onMaxErrorsChange,
  maxErrorRate,
  onMaxErrorRateChange,
  loadProfile,
  onLoadProfileChange,
  thinkTime,
  onThinkTimeChange,
  kafkaLoadBanners,
  onRun,
  onAbort,
}: Props) {
  return (
    <>
      <RunnerSlaOverridePanel
        key={selectedWorkflow.id}
        initialTargets={workflowSlaOverrides}
        onSave={onWorkflowSlaOverridesChange}
        definitionTargetCount={selectedWorkflow.slaTargets?.length ?? 0}
        definitionTargets={workflowDefinitionTargets}
        scenarioNames={[]}
        disabled={isRunning}
      />

      {isWebhookTriggered && (
        <div className="webhook-run-mode-selector">
          <span className="webhook-mode-label">Run Mode:</span>
          <div className="webhook-mode-buttons">
            <button
              className={`webhook-mode-btn ${webhookRunMode === 'single' ? 'active' : ''}`}
              onClick={() => onWebhookRunModeChange('single')}
              disabled={isRunning}
            >
              Single Run
            </button>
            <button
              className={`webhook-mode-btn ${webhookRunMode === 'load' ? 'active' : ''}`}
              onClick={() => onWebhookRunModeChange('load')}
              disabled={isRunning}
            >
              Load Test
            </button>
          </div>
          <span className="webhook-mode-hint">
            {webhookRunMode === 'single'
              ? '— Run workflow once using sample payload (supports trace capture)'
              : '— Send many requests to webhook endpoint'}
          </span>
        </div>
      )}

      {isWebhookTriggered && webhookRunMode === 'load' && webhookLoadConfig && webhookTriggerNode && (
        <WebhookLoadDriverPanel
          webhookUrl={webhookLoadConfig.webhookUrl}
          method={webhookLoadConfig.method}
          initialPayload={(webhookTriggerNode.data as WebhookTriggerNodeData).samplePayload || '{}'}
          config={webhookLoadConfig}
          onChange={onWebhookLoadConfigChange}
          disabled={isRunning}
        />
      )}

      {hasCorrelationWait && (
        <CorrelationWaitConfigPanel
          workflow={selectedWorkflow}
          config={correlationWaitConfig}
          onChange={onCorrelationWaitConfigChange}
          disabled={isRunning}
        />
      )}

      {hasCorrelationWait && correlationWaitConfig?.mode === 'wait-for-real' && (
        <MultiWebhookTestingPanel
          workflow={selectedWorkflow}
          isRunning={isRunning}
          onFireWebhook={onFireWebhook}
          scenarios={webhookScenarios}
          onSaveScenario={onSaveWebhookScenario}
          onDeleteScenario={onDeleteWebhookScenario}
        />
      )}

      <div className="workflow-runner-exec-card">
        <div className="workflow-runner-exec-card-header">
          <span className="workflow-runner-exec-card-title">Run configuration</span>
          <span className="workflow-runner-exec-card-sub">Trace depth, execution mode, and resilience</span>
        </div>

        <div className="wf-runner-inline-options wf-runner-inline-options--embedded">
          {!isWebhookTriggered && hasWaitForCondition && (
            <div className="wf-inline-option">
              <span className="wf-inline-label">Poll limit</span>
              <input
                type="number"
                className="wf-inline-input"
                min={1}
                max={100}
                value={maxConcurrentPolls}
                onChange={(e) => onMaxConcurrentPollsChange(Math.max(1, parseInt(e.target.value) || 20))}
                disabled={isRunning}
              />
              <span className="wf-inline-hint">max concurrent polls across {concurrency} iterations</span>
            </div>
          )}

          <div className="wf-inline-option wf-inline-option--trace">
            <span className="runner-exec-label">Trace Level:</span>
            <div className="wf-inline-radio-group">
              {(['minimal', 'standard', 'full', 'debug'] as const).map(level => (
                <label key={level} className="radio-label">
                  <input
                    type="radio"
                    name="wf-traceLevel"
                    checked={(traceOptions.traceLevel ?? (traceOptions.captureFullTrace ? 'full' : 'standard')) === level}
                    onChange={() => {
                      onTraceOptionsChange(prev => ({
                        ...prev,
                        traceLevel: level,
                        captureFullTrace: level === 'full' || level === 'debug',
                      }));
                    }}
                    disabled={isRunning}
                  />
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </label>
              ))}
            </div>
            {(traceOptions.traceLevel === 'full' || traceOptions.traceLevel === 'debug' || (!traceOptions.traceLevel && traceOptions.captureFullTrace)) && (
              <div className="wf-inline-trace-extras">
                <label className="radio-label">
                  <input
                    type="checkbox"
                    checked={traceOptions.samplingEnabled !== false}
                    onChange={(e) => onTraceOptionsChange(prev => ({ ...prev, samplingEnabled: e.target.checked }))}
                    disabled={isRunning}
                  />
                  Sampling
                </label>
                {traceOptions.samplingEnabled !== false && (
                  <input
                    type="number"
                    min={10}
                    max={1000}
                    step={10}
                    value={traceOptions.samplingThreshold ?? 50}
                    onChange={(e) => onTraceOptionsChange(prev => ({ ...prev, samplingThreshold: Math.max(10, parseInt(e.target.value) || 50) }))}
                    disabled={isRunning}
                    className="wf-sampling-threshold-input"
                  />
                )}
                <span className="exec-mode-hint">≤100 iters recommended</span>
              </div>
            )}
          </div>
        </div>

        {(!isWebhookTriggered || webhookRunMode === 'single') && (
          <div className="workflow-runner-config-section">
            <RunnerExecutionConfig
              executionMode={executionMode}
              onExecutionModeChange={onExecutionModeChange}
              concurrency={concurrency}
              onConcurrencyChange={onConcurrencyChange}
              iterations={iterations}
              onIterationsChange={onIterationsChange}
              timeoutSec={timeoutSec}
              onTimeoutSecChange={onTimeoutSecChange}
              retryCount={retryCount}
              onRetryCountChange={onRetryCountChange}
              retryDelayMs={retryDelayMs}
              onRetryDelayMsChange={onRetryDelayMsChange}
              errorPolicy={errorPolicy}
              onErrorPolicyChange={onErrorPolicyChange}
              maxErrors={maxErrors}
              onMaxErrorsChange={onMaxErrorsChange}
              maxErrorRate={maxErrorRate}
              onMaxErrorRateChange={onMaxErrorRateChange}
              loadProfile={loadProfile}
              onLoadProfileChange={onLoadProfileChange}
              thinkTime={thinkTime}
              onThinkTimeChange={(patch) => onThinkTimeChange(patch)}
              activeTestCount={1}
              isRunning={isRunning}
              forceSingleIteration={correlationWaitConfig?.mode === 'wait-for-real'}
              namePrefix="workflow-runner"
            />
          </div>
        )}
      </div>

      {(!isWebhookTriggered || webhookRunMode === 'single') && kafkaLoadBanners.blockNodes.length > 0 && (
        <div className="kafka-load-warning--block">
          <strong>⛔ Cannot run load test:</strong>{' '}
          {kafkaLoadBanners.blockNodes.length === 1
            ? <><strong>{kafkaLoadBanners.blockNodes[0]}</strong> is configured with <strong>wait-for-real</strong> mode, which blocks workflow load tests. Edit the node and change Load Test Behavior to <strong>auto-resume</strong> or <strong>synthetic-inject</strong>.</>
            : <>{kafkaLoadBanners.blockNodes.length} kafkaConsume nodes use <strong>wait-for-real</strong> mode — change them to <strong>auto-resume</strong> or <strong>synthetic-inject</strong>.</>
          }
        </div>
      )}
      {(!isWebhookTriggered || webhookRunMode === 'single') && kafkaLoadBanners.blockNodes.length === 0 && kafkaLoadBanners.infoNodes.length > 0 && (
        <div className="kafka-load-info">
          <strong>ℹ Auto-resume:</strong>{' '}
          {kafkaLoadBanners.infoNodes.length === 1
            ? <><strong>{kafkaLoadBanners.infoNodes[0]}</strong> has no load test behavior set — it will skip the consume and continue (<strong>auto-resume</strong> default) during load tests.</>
            : <>{kafkaLoadBanners.infoNodes.length} kafkaConsume nodes have no load test behavior set — they will auto-resume (skip consume) during load tests.</>
          }
        </div>
      )}

      <div className="workflow-runner-run-bar">
        <div className="form-actions">
          {!isRunning ? (
            <button
              type="button"
              className="btn btn-primary btn-lg"
              data-testid="workflow-runner-run-btn"
              onClick={onRun}
            >
              {isWebhookTriggered
                ? (webhookRunMode === 'load' ? 'Run Webhook Load Test' : '▶ Run Workflow')
                : '▶ Run Workflow'}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-danger btn-lg"
              data-testid="workflow-runner-stop-btn"
              onClick={onAbort}
            >
              ■ Stop
            </button>
          )}
        </div>
      </div>
    </>
  );
}
