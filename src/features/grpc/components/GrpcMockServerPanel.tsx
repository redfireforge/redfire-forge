import type { UseGrpcStudioAdvancedFeaturesReturn } from '../hooks/useGrpcStudioAdvancedFeatures';
import {
  countEnabledMockRules,
  presentGrpcAdvancedOperationStatus,
  parseGrpcMockRuleSetJson,
  summarizeMockRulePredicate,
} from '../utils/grpcStudioAdvancedModel';

export interface GrpcMockServerPanelProps {
  advanced: UseGrpcStudioAdvancedFeaturesReturn;
}

export function GrpcMockServerPanel({ advanced }: GrpcMockServerPanelProps) {
  const status = presentGrpcAdvancedOperationStatus(
    advanced.runtime.mockRuntime.status,
    advanced.runtime.mockRuntime.cancellationRequested,
  );
  const parsed = parseGrpcMockRuleSetJson(advanced.mockServer.rulesJson);
  const ruleSet = parsed.ok ? parsed.ruleSet : { rules: [] };
  const enabledCount = countEnabledMockRules(ruleSet);
  const managerState = advanced.mockManagerState;

  return (
    <section className="grpc-advanced-panel" data-testid="grpc-mock-server-panel">
      <header className="grpc-advanced-card__header">
        <div>
          <h2 className="grpc-advanced-card__title">Mock server runtime</h2>
          <p className="grpc-advanced-card__subtitle">
            In-process rule evaluator for tab {advanced.activeTabLabel} — no network listener in Phase 11G.
          </p>
        </div>
        <div className="grpc-advanced-card__actions">
          {!advanced.mockRunning ? (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              data-testid="grpc-mock-start-btn"
              onClick={advanced.startMockServer}
            >
              Start mock runtime
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-danger btn-sm"
              data-testid="grpc-mock-stop-btn"
              onClick={advanced.stopMockServer}
            >
              Stop
            </button>
          )}
        </div>
      </header>

      <div className="grpc-advanced-card grpc-advanced-card__body">
        <div className="grpc-advanced-chip-row">
          <span className="grpc-advanced-chip" data-testid="grpc-mock-config-source">
            Source: {advanced.resolvedMockConfig.source.replace(/_/g, ' ')}
          </span>
          {managerState?.committed && (
            <span className="grpc-advanced-chip" data-testid="grpc-mock-generation">
              Generation: {managerState.committed.generation}
            </span>
          )}
        </div>

        <div className="grpc-advanced-form-grid grpc-advanced-form-grid--two">
          <label className="grpc-advanced-field">
            <span className="grpc-advanced-field__label">Default latency (ms)</span>
            <input
              type="number"
              min={0}
              className="grpc-advanced-input"
              data-testid="grpc-mock-latency-default"
              value={advanced.mockServer.latencyPolicy?.defaultLatencyMs ?? ''}
              disabled={advanced.mockRunning}
              onChange={(event) => {
                const value = Number.parseInt(event.target.value, 10);
                advanced.patchMockLatency({
                  defaultLatencyMs: Number.isFinite(value) ? value : undefined,
                });
              }}
            />
          </label>
          <label className="grpc-advanced-field">
            <span className="grpc-advanced-field__label">Jitter (ms)</span>
            <input
              type="number"
              min={0}
              className="grpc-advanced-input"
              data-testid="grpc-mock-latency-jitter"
              value={advanced.mockServer.latencyPolicy?.jitterMs ?? ''}
              disabled={advanced.mockRunning}
              onChange={(event) => {
                const value = Number.parseInt(event.target.value, 10);
                advanced.patchMockLatency({
                  jitterMs: Number.isFinite(value) ? value : undefined,
                });
              }}
            />
          </label>
        </div>

        <label className="grpc-advanced-field grpc-advanced-field--stacked">
          <span className="grpc-advanced-field__label">Rules JSON</span>
          <textarea
            className="grpc-advanced-textarea"
            rows={8}
            data-testid="grpc-mock-rules-json"
            value={advanced.mockServer.rulesJson}
            disabled={advanced.mockRunning}
            onChange={(event) => advanced.patchMockRulesJson(event.target.value)}
          />
        </label>

        {advanced.mockServer.parseError && (
          <p className="grpc-advanced-hint grpc-advanced-hint--error" data-testid="grpc-mock-parse-error">
            {advanced.mockServer.parseError}
          </p>
        )}

        <div
          className={`grpc-advanced-status grpc-advanced-status--${status.variant}`}
          data-testid="grpc-mock-status"
        >
          Status: {status.label}
          {advanced.runtime.mockRuntime.error?.message && (
            <span className="grpc-advanced-status__detail"> — {advanced.runtime.mockRuntime.error.message}</span>
          )}
        </div>
      </div>

      <div className="grpc-advanced-card" data-testid="grpc-mock-rules-list">
        <div className="grpc-advanced-card__header">
          <h3 className="grpc-advanced-card__title">
            Rules ({enabledCount} enabled / {ruleSet.rules.length} total)
          </h3>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            data-testid="grpc-mock-reset-rules"
            disabled={advanced.mockRunning}
            onClick={advanced.resetMockRulesToDefault}
          >
            Reset rules
          </button>
        </div>
        <div className="grpc-advanced-card__body grpc-advanced-rule-list">
          {ruleSet.rules.length === 0 && (
            <p className="grpc-advanced-hint">No rules configured — unmatched calls return UNIMPLEMENTED.</p>
          )}
          {ruleSet.rules.map((rule) => (
            <div
              key={rule.id}
              className={`grpc-advanced-rule-item${rule.enabled ? ' grpc-advanced-rule-item--on' : ''}`}
              data-testid={`grpc-mock-rule-${rule.id}`}
            >
              <span
                className={`grpc-advanced-rule-indicator${rule.enabled ? ' grpc-advanced-rule-indicator--on' : ''}`}
                aria-hidden="true"
              />
              <div className="grpc-advanced-rule-body">
                <div className="grpc-advanced-rule-name">{rule.name}</div>
                <div className="grpc-advanced-rule-condition">{summarizeMockRulePredicate(rule)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
