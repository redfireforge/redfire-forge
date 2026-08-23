import { useState } from 'react';
import { serializeGrpcMockBuilderModelToRuleSet } from '../../utils/grpcMockRuleBuilderModel';
import type { GrpcMockBuilderModel } from '../../utils/grpcMockRuleBuilderModel';
import { evaluateGrpcMockRuleSet } from '@shared/grpc/grpcMockRuleEvaluatorCore';
import type { GrpcMockEvaluationContext, GrpcMockRuleEvaluationResult } from '@shared/grpc/grpcMockRuleContracts';

export interface GrpcMockRuleTesterProps {
  builderModel: GrpcMockBuilderModel;
  ruleId: string;
  onClose: () => void;
}

interface RuleTesterState {
  service: string;
  method: string;
  metadataEntries: Array<{ key: string; value: string }>;
  bodyText: string;
}

function createDefaultTesterState(): RuleTesterState {
  return { service: '', method: '', metadataEntries: [{ key: '', value: '' }], bodyText: '{}' };
}

export function GrpcMockRuleTester({
  builderModel,
  ruleId,
  onClose,
}: GrpcMockRuleTesterProps) {
  const [state, setState] = useState<RuleTesterState>(createDefaultTesterState);
  const [result, setResult] = useState<GrpcMockRuleEvaluationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runTest = () => {
    try {
      const metadata: Record<string, string> = {};
      for (const entry of state.metadataEntries) {
        if (entry.key.trim()) metadata[entry.key.trim()] = entry.value;
      }
      let requestBody: unknown = {};
      try {
        requestBody = state.bodyText.trim() ? JSON.parse(state.bodyText) : {};
      } catch {
        setError('Invalid JSON in request body');
        setResult(null);
        return;
      }
      const context: GrpcMockEvaluationContext = {
        service: state.service,
        method: state.method,
        callType: 'unary',
        metadata,
        requestBody,
      };
      const ruleSet = serializeGrpcMockBuilderModelToRuleSet(builderModel);
      const evalResult = evaluateGrpcMockRuleSet(ruleSet, context);
      setResult(evalResult);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setResult(null);
    }
  };

  return (
    <div className="grpc-mock-builder-tester grpc-mock-builder-tester--modal" data-testid={`grpc-mock-builder-tester-${ruleId}`}>
      <p className="grpc-mock-builder-tester__intro">
        Simulate a gRPC request against the current mock rules without leaving the builder.
      </p>

      <section className="grpc-mock-builder-tester__section grpc-mock-builder-tester__section--request">
        <div className="grpc-mock-builder-tester__section-title">Request</div>
        <div className="grpc-mock-builder-tester__fields">
          <label className="grpc-mock-builder-field grpc-mock-builder-tester__field">
            <span className="grpc-mock-builder-field__label">Service</span>
            <input
              className="grpc-mock-builder-input"
              data-testid={`grpc-mock-tester-service-${ruleId}`}
              placeholder="e.g. helloworld.Greeter"
              value={state.service}
              onChange={(e) => setState((s) => ({ ...s, service: e.target.value }))}
            />
          </label>
          <label className="grpc-mock-builder-field grpc-mock-builder-tester__field">
            <span className="grpc-mock-builder-field__label">Method</span>
            <input
              className="grpc-mock-builder-input"
              data-testid={`grpc-mock-tester-method-${ruleId}`}
              placeholder="e.g. SayHello"
              value={state.method}
              onChange={(e) => setState((s) => ({ ...s, method: e.target.value }))}
            />
          </label>
        </div>
      </section>

      <section className="grpc-mock-builder-tester__section">
        <div className="grpc-mock-builder-tester__section-title">Metadata</div>
        <div className="grpc-mock-builder-tester__metadata">
          {state.metadataEntries.map((entry, idx) => (
            <div key={idx} className="grpc-mock-builder-tester__metadata-row">
              <input
                className="grpc-mock-builder-input"
                placeholder="key"
                value={entry.key}
                data-testid={`grpc-mock-tester-meta-key-${ruleId}-${idx}`}
                onChange={(e) => {
                  const entries = [...state.metadataEntries];
                  entries[idx] = { ...entries[idx], key: e.target.value };
                  setState((s) => ({ ...s, metadataEntries: entries }));
                }}
              />
              <div className="grpc-mock-builder-tester__metadata-value-group">
                <input
                  className="grpc-mock-builder-input"
                  placeholder="value"
                  value={entry.value}
                  data-testid={`grpc-mock-tester-meta-val-${ruleId}-${idx}`}
                  onChange={(e) => {
                    const entries = [...state.metadataEntries];
                    entries[idx] = { ...entries[idx], value: e.target.value };
                    setState((s) => ({ ...s, metadataEntries: entries }));
                  }}
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-xs grpc-mock-builder-tester__remove-meta grpc-mock-builder-tester__remove-meta-badge"
                  aria-label={`Remove metadata row ${idx + 1}`}
                  title="Remove metadata row"
                  onClick={() => {
                    const entries = state.metadataEntries.filter((_, i) => i !== idx);
                    setState((s) => ({ ...s, metadataEntries: entries.length ? entries : [{ key: '', value: '' }] }));
                  }}
                >
                  <span aria-hidden="true">×</span>
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            className="btn btn-ghost btn-xs grpc-mock-builder-tester__add-meta"
            data-testid={`grpc-mock-tester-add-meta-${ruleId}`}
            onClick={() => setState((s) => ({ ...s, metadataEntries: [...s.metadataEntries, { key: '', value: '' }] }))}
          >
            + Add metadata
          </button>
        </div>
      </section>

      <section className="grpc-mock-builder-tester__section grpc-mock-builder-tester__section--body">
        <label className="grpc-mock-builder-field grpc-mock-builder-field--stacked">
          <span className="grpc-mock-builder-field__label">Request body (JSON)</span>
          <textarea
            className="grpc-mock-builder-textarea grpc-mock-builder-tester__body"
            rows={5}
            data-testid={`grpc-mock-tester-body-${ruleId}`}
            value={state.bodyText}
            onChange={(e) => setState((s) => ({ ...s, bodyText: e.target.value }))}
          />
        </label>
      </section>

      <div className="grpc-mock-builder-tester__actions">
        <button
          type="button"
          className="btn btn-primary btn-sm grpc-mock-builder-tester__action-btn grpc-mock-builder-tester__action-btn--run"
          data-testid={`grpc-mock-tester-run-${ruleId}`}
          onClick={runTest}
        >
          Run test
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm grpc-mock-builder-tester__action-btn grpc-mock-builder-tester__action-btn--close"
          data-testid="grpc-mock-tester-close"
          onClick={onClose}
        >
          Close
        </button>
      </div>

      {error && (
        <div className="grpc-mock-builder-tester__result grpc-mock-builder-tester__result--error" data-testid={`grpc-mock-tester-error-${ruleId}`}>
          ❌ {error}
        </div>
      )}

      {result && (
        <div
          className={`grpc-mock-builder-tester__result ${result.matched && result.ruleId === ruleId ? 'grpc-mock-builder-tester__result--match' : result.matched ? 'grpc-mock-builder-tester__result--other' : 'grpc-mock-builder-tester__result--miss'}`}
          data-testid={`grpc-mock-tester-result-${ruleId}`}
        >
          {result.matched && result.ruleId === ruleId && (
            <span>✅ <strong>This rule matched!</strong> Response status: {result.response?.statusCode ?? 0}</span>
          )}
          {result.matched && result.ruleId !== ruleId && (
            <span>↗️ Another rule matched: <strong>{result.ruleName ?? result.ruleId}</strong></span>
          )}
          {!result.matched && result.usedDefault && (
            <span>⚪ No rule matched — default response used</span>
          )}
          {!result.matched && !result.usedDefault && (
            <span>❌ No rule matched — miss</span>
          )}
          {result.fallthroughChain.length > 0 && (
            <div className="grpc-mock-builder-tester__chain">
              Fallthrough chain: {result.fallthroughChain.join(' → ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
