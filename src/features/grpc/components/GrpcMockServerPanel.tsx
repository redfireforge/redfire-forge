import { useEffect, useRef, useState } from 'react';
import type { UseGrpcStudioAdvancedFeaturesReturn } from '../hooks/useGrpcStudioAdvancedFeatures';
import {
  countEnabledMockRules,
  presentGrpcAdvancedOperationStatus,
  parseGrpcMockRuleSetJsonForBuilder,
  summarizeMockRulePredicate,
} from '../utils/grpcStudioAdvancedModel';
import { GrpcMockRuleBuilderPanel } from './GrpcMockRuleBuilderPanel';
import {
  fetchGrpcMockNetworkListenerLogs,
  supportsGrpcMockNetworkListener,
} from '../utils/grpcMockListenerClient';
import type { GrpcMockListenerLogEntry } from '../../../shared/grpc/grpcMockListenerContracts';
import { highlightJsonTokens } from '../utils/grpcMockJsonHighlight';
import { HighlightedHtmlTextarea } from '../../../shared/components/HighlightedHtmlTextarea';
import { isTauri } from '../../../shared/utils/platform';

export type GrpcMockAuthoringTab = 'builder' | 'json' | 'runtime';

export interface GrpcMockServerPanelProps {
  advanced: UseGrpcStudioAdvancedFeaturesReturn;
}

function mergeListenerLogs(
  previous: GrpcMockListenerLogEntry[],
  incoming: GrpcMockListenerLogEntry[],
): GrpcMockListenerLogEntry[] {
  if (incoming.length === 0) {
    return previous;
  }

  const merged = [...previous, ...incoming].slice(-160);
  const dedupedById = new Map<string, GrpcMockListenerLogEntry>();
  for (const entry of merged) {
    dedupedById.set(String(entry.id), entry);
  }
  return Array.from(dedupedById.values()).slice(-80);
}

export function GrpcMockServerPanel({ advanced }: GrpcMockServerPanelProps) {
  const [authoringTab, setAuthoringTab] = useState<GrpcMockAuthoringTab>('builder');
  const [listenerLogs, setListenerLogs] = useState<GrpcMockListenerLogEntry[]>([]);
  const [builderToolbarHost, setBuilderToolbarHost] = useState<HTMLDivElement | null>(null);
  const logCursorRef = useRef(-1);
  const listenerStatus = advanced.mockServer.listenerStatus;
  const networkSupported = supportsGrpcMockNetworkListener();
  const exposeNetwork = advanced.mockServer.exposeNetworkEndpoint !== false;
  const status = presentGrpcAdvancedOperationStatus(
    advanced.runtime.mockRuntime.status,
    advanced.runtime.mockRuntime.cancellationRequested,
  );
  const parsedForRuntime = parseGrpcMockRuleSetJsonForBuilder(advanced.mockServer.rulesJson);
  const ruleSet = parsedForRuntime.ok ? parsedForRuntime.ruleSet : { rules: [] };
  const enabledCount = countEnabledMockRules(ruleSet);
  const managerState = advanced.mockManagerState;

  useEffect(() => {
    if (!networkSupported || !advanced.mockRunning || authoringTab !== 'runtime') {
      return undefined;
    }
    const tabId = advanced.activeTabId;
    let cancelled = false;
    const poll = async () => {
      try {
        const result = await fetchGrpcMockNetworkListenerLogs(tabId, logCursorRef.current);
        if (cancelled || result.entries.length === 0) return;
        logCursorRef.current = result.nextCursor;
        setListenerLogs((prev) => mergeListenerLogs(prev, result.entries));
      } catch {
        // companion server may be offline during tests
      }
    };
    void poll();
    const timer = setInterval(() => { void poll(); }, 800);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [advanced.mockRunning, authoringTab, networkSupported, advanced.activeTabId]);

  useEffect(() => {
    if (!advanced.mockRunning) {
      setListenerLogs([]);
      logCursorRef.current = -1;
    }
  }, [advanced.mockRunning]);

  return (
    <section className="grpc-advanced-panel" data-testid="grpc-mock-server-panel">
      <header className="grpc-advanced-card__header grpc-mock-header">
        <div className="grpc-mock-header__content">
          <h2 className="grpc-advanced-card__title grpc-mock-header__title-inline">
            Mock server runtime.
            <span className="grpc-mock-header__title-detail">
              Rule evaluator for tab {advanced.activeTabLabel}
              {networkSupported
                ? (
                  isTauri()
                    ? ' - native dialable endpoint for external clients and GRPC-13.'
                    : ' - optional dialable endpoint for external clients and GRPC-13 (web requires companion server: npm run server).'
                )
                : ' - network listener requires the web companion server (npm run server).'}
            </span>
          </h2>

          <div className="grpc-mock-summary-row" aria-label="Mock runtime summary">
            <div className={`grpc-mock-summary-card grpc-mock-summary-card--${status.variant}`}>
              <span className="grpc-mock-summary-card__label">Runtime</span>
              <span className="grpc-mock-summary-card__value">{status.label}</span>
            </div>
            <div className="grpc-mock-summary-card">
              <span className="grpc-mock-summary-card__label">Rules</span>
              <span className="grpc-mock-summary-card__value">
                {enabledCount}/{ruleSet.rules.length} enabled
              </span>
            </div>
            <div className="grpc-mock-summary-card">
              <span className="grpc-mock-summary-card__label">Endpoint mode</span>
              <span className="grpc-mock-summary-card__value">
                {networkSupported
                  ? (exposeNetwork ? 'External + internal' : 'Internal only')
                  : 'Companion required'}
              </span>
            </div>

            {networkSupported && (
              <label className="grpc-mock-network-toggle grpc-mock-network-toggle--inline">
                <input
                  type="checkbox"
                  data-testid="grpc-mock-expose-network"
                  checked={exposeNetwork}
                  disabled={advanced.mockRunning}
                  onChange={(event) => advanced.patchMockExposeNetwork(event.target.checked)}
                />
                <span>Expose network endpoint</span>
              </label>
            )}
          </div>
        </div>
        <div className="grpc-advanced-card__actions grpc-mock-header__actions">
          {listenerStatus?.listenTarget && (
            <div className="grpc-mock-listen-chip-row">
              <span
                className="grpc-advanced-chip grpc-mock-listen-target-chip"
                data-testid="grpc-mock-listen-target"
              >
                <span className="grpc-mock-listen-target-chip__label">Listen</span>
                <span className="grpc-mock-listen-target-chip__value">{listenerStatus.listenTarget}</span>
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                data-testid="grpc-mock-copy-listen-target"
                onClick={() => {
                  if (listenerStatus.listenTarget) {
                    void navigator.clipboard.writeText(listenerStatus.listenTarget);
                  }
                }}
              >
                Copy
              </button>
              {listenerStatus.generation > 0 && (
                <span
                  className="grpc-advanced-chip grpc-mock-listener-generation-chip"
                  data-testid="grpc-mock-listener-generation"
                >
                  Gen {listenerStatus.generation}
                </span>
              )}
            </div>
          )}

          <div className="grpc-mock-header__primary-actions">
            {!advanced.mockRunning ? (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                data-testid="grpc-mock-start-btn"
                onClick={advanced.startMockServer}
                disabled={Boolean(advanced.mockServer.parseError)}
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
        </div>
      </header>

      <div className="grpc-mock-authoring-tabs mock-server-tabs" role="tablist" aria-label="Mock authoring mode">
        <span className="grpc-mock-authoring-tabs__label mock-server-tabs__label">Authoring</span>
        <button
          type="button"
          role="tab"
          aria-selected={authoringTab === 'builder'}
          className={`grpc-mock-authoring-tab mock-server-tab${authoringTab === 'builder' ? ' grpc-mock-authoring-tab--active mock-server-tab--active' : ''}`}
          data-testid="grpc-mock-tab-builder"
          onClick={() => setAuthoringTab('builder')}
        >
          Builder
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={authoringTab === 'json'}
          className={`grpc-mock-authoring-tab mock-server-tab${authoringTab === 'json' ? ' grpc-mock-authoring-tab--active mock-server-tab--active' : ''}`}
          data-testid="grpc-mock-tab-json"
          onClick={() => setAuthoringTab('json')}
        >
          JSON
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={authoringTab === 'runtime'}
          className={`grpc-mock-authoring-tab mock-server-tab${authoringTab === 'runtime' ? ' grpc-mock-authoring-tab--active mock-server-tab--active' : ''}`}
          data-testid="grpc-mock-tab-runtime"
          onClick={() => setAuthoringTab('runtime')}
        >
          Runtime
        </button>
        {authoringTab === 'builder' && (
          <div
            ref={setBuilderToolbarHost}
            className="grpc-mock-authoring-tabs__tools"
            data-testid="grpc-mock-authoring-tools"
          />
        )}
      </div>

      {authoringTab === 'builder' && (
        <GrpcMockRuleBuilderPanel advanced={advanced} toolbarHost={builderToolbarHost} />
      )}

      {authoringTab === 'json' && (
        <div className="grpc-advanced-card grpc-advanced-card__body grpc-mock-json-panel" data-testid="grpc-mock-json-panel">
          <label className="grpc-advanced-field grpc-advanced-field--stacked grpc-mock-json-panel__field">
            <span className="grpc-advanced-field__label">Rules JSON</span>
            <HighlightedHtmlTextarea
              value={advanced.mockServer.rulesJson}
              onChange={(v) => advanced.patchMockRulesJson(v)}
              highlightHtml={highlightJsonTokens}
              rows={16}
              testId="grpc-mock-rules-json"
              wrapTestId="grpc-mock-json-editor"
              ariaLabel="Mock rules JSON"
            />
          </label>

          <div className="grpc-advanced-card__actions">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              data-testid="grpc-mock-export-json"
              disabled={Boolean(advanced.mockServer.parseError)}
              onClick={() => {
                const text = advanced.exportMockRulesJson();
                if (text) void navigator.clipboard.writeText(text);
              }}
            >
              Copy rules JSON
            </button>
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

          {advanced.mockServer.parseError && (
            <p className="grpc-advanced-hint grpc-advanced-hint--error" data-testid="grpc-mock-parse-error">
              {advanced.mockServer.parseError}
            </p>
          )}

          {advanced.advancedExportError && (
            <p
              className="grpc-advanced-hint grpc-advanced-hint--error"
              data-testid="grpc-mock-export-error"
            >
              {advanced.advancedExportError}
            </p>
          )}
        </div>
      )}

      {authoringTab === 'runtime' && (
        <>
          <div className="grpc-advanced-card grpc-advanced-card__body" data-testid="grpc-mock-runtime-panel">
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

            <p className="grpc-advanced-hint grpc-mock-runtime-hint">
              Configure default latency and jitter to simulate service behavior before applying per-rule overrides.
            </p>

            <div className="grpc-mock-latency-row">
              <label className="grpc-mock-latency-field">
                <span className="grpc-mock-latency-field__label">Default Latency (ms)</span>
                <input
                  type="number"
                  min={0}
                  className="grpc-mock-latency-field__input"
                  data-testid="grpc-mock-latency-default"
                  value={advanced.mockServer.latencyPolicy?.defaultLatencyMs ?? ''}
                  onChange={(event) => {
                    const value = Number.parseInt(event.target.value, 10);
                    advanced.patchMockLatency({
                      defaultLatencyMs: Number.isFinite(value) ? value : undefined,
                    });
                  }}
                />
              </label>
              <label className="grpc-mock-latency-field">
                <span className="grpc-mock-latency-field__label">Jitter (ms)</span>
                <input
                  type="number"
                  min={0}
                  className="grpc-mock-latency-field__input"
                  data-testid="grpc-mock-latency-jitter"
                  value={advanced.mockServer.latencyPolicy?.jitterMs ?? ''}
                  onChange={(event) => {
                    const value = Number.parseInt(event.target.value, 10);
                    advanced.patchMockLatency({
                      jitterMs: Number.isFinite(value) ? value : undefined,
                    });
                  }}
                />
              </label>
            </div>

            <div
              className={`grpc-advanced-status grpc-advanced-status--${status.variant}`}
              data-testid="grpc-mock-status"
            >
              Status: {status.label}
              {advanced.runtime.mockRuntime.error?.message && (
                <span className="grpc-advanced-status__detail"> — {advanced.runtime.mockRuntime.error.message}</span>
              )}
            </div>

            {networkSupported && listenerLogs.length > 0 && (
              <div className="grpc-mock-listener-log" data-testid="grpc-mock-listener-log">
                <div className="grpc-mock-listener-log__title">Listener activity</div>
                <ul className="grpc-mock-listener-log__list">
                  {listenerLogs.slice(-12).map((entry) => (
                    <li key={entry.id} data-testid={`grpc-mock-listener-log-${entry.id}`}>
                      <span className="grpc-mock-listener-log__event">{entry.event}</span>
                      {entry.service && entry.method && (
                        <span className="grpc-mock-listener-log__rpc">{entry.service}/{entry.method}</span>
                      )}
                      {entry.ruleName && (
                        <span className="grpc-mock-listener-log__rule">→ {entry.ruleName}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {networkSupported && advanced.mockRunning && listenerLogs.length === 0 && (
              <p className="grpc-advanced-hint grpc-mock-runtime-hint">
                Listener activity will appear here once external clients connect.
              </p>
            )}
          </div>

          <div className="grpc-advanced-card" data-testid="grpc-mock-rules-list">
            <div className="grpc-advanced-card__header">
              <h3 className="grpc-advanced-card__title">
                Rules ({enabledCount} enabled / {ruleSet.rules.length} total)
              </h3>
            </div>
            <div className="grpc-advanced-card__body grpc-advanced-rule-list">
              {ruleSet.rules.length === 0 && (
                <p className="grpc-advanced-hint">No rules configured — unmatched calls return UNIMPLEMENTED.</p>
              )}
              {ruleSet.rules.map((rule) => {
                const hitCount = managerState?.ruleHitCounts?.[rule.id] ?? 0;
                return (
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
                    <div className="grpc-advanced-rule-name">
                      {rule.name}
                      {advanced.mockRunning && (
                        <span
                          className={`grpc-mock-hit-badge${hitCount > 0 ? ' grpc-mock-hit-badge--active' : ''}`}
                          data-testid={`grpc-mock-hit-count-${rule.id}`}
                          title={`${hitCount} hit${hitCount !== 1 ? 's' : ''} since start`}
                        >
                          {hitCount}
                        </span>
                      )}
                    </div>
                    <div className="grpc-advanced-rule-condition">{summarizeMockRulePredicate(rule)}</div>
                  </div>
                </div>
                );
              })}
              {advanced.mockRunning && (managerState?.defaultHitCount ?? 0) + (managerState?.missCount ?? 0) > 0 && (
                <div className="grpc-mock-hit-summary" data-testid="grpc-mock-hit-summary">
                  {(managerState?.defaultHitCount ?? 0) > 0 && (
                    <span className="grpc-mock-hit-summary__item">
                      Default: {managerState?.defaultHitCount ?? 0}
                    </span>
                  )}
                  {(managerState?.missCount ?? 0) > 0 && (
                    <span className="grpc-mock-hit-summary__item grpc-mock-hit-summary__item--miss">
                      No match: {managerState?.missCount ?? 0}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
