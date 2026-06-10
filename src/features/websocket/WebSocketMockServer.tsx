import { useCallback, useEffect, useMemo, useState } from 'react';
import type { WsMockRule, WsMockMatchType, WsMockResponseType, WsMockFallbackMode } from '../../shared/websocket/types';
import { evaluateRules } from './wsMockRuleEngine';
import type { UseWebSocketMockServerReturn } from './useWebSocketMockServer';

interface WebSocketMockServerProps {
  mock: UseWebSocketMockServerReturn;
}

const MATCH_TYPES: { value: WsMockMatchType; label: string }[] = [
  { value: 'any', label: 'Any' },
  { value: 'exact', label: 'Exact' },
  { value: 'contains', label: 'Contains' },
  { value: 'regex', label: 'Regex' },
  { value: 'jsonpath', label: 'JSONPath' },
];

const RESPONSE_TYPES: { value: WsMockResponseType; label: string }[] = [
  { value: 'echo', label: 'Echo' },
  { value: 'static', label: 'Static' },
  { value: 'template', label: 'Template' },
  { value: 'close', label: 'Close' },
];

const FALLBACK_MODES: { value: WsMockFallbackMode; label: string }[] = [
  { value: 'echo', label: 'Echo back' },
  { value: 'ignore', label: 'Ignore' },
  { value: 'close', label: 'Close connection' },
];

let ruleCounter = 0;

function createEmptyRule(): WsMockRule {
  ruleCounter++;
  return {
    id: `rule-${Date.now()}-${ruleCounter}`,
    name: `Rule ${ruleCounter}`,
    enabled: true,
    match: { type: 'any', pattern: '' },
    response: { type: 'echo' },
  };
}

export function WebSocketMockServer({ mock }: WebSocketMockServerProps) {
  const { status, logs, rules, config, starting } = mock;
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [broadcastText, setBroadcastText] = useState('');
  const [testInput, setTestInput] = useState('');
  const [portInput, setPortInput] = useState(String(config.port));

  useEffect(() => {
    setPortInput(String(config.port));
  }, [config.port]);

  const portValid = useMemo(() => {
    const n = parseInt(portInput, 10);
    return !isNaN(n) && n >= 1024 && n <= 65535;
  }, [portInput]);

  const handlePortChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPortInput(e.target.value);
    const n = parseInt(e.target.value, 10);
    if (!isNaN(n) && n >= 1024 && n <= 65535) {
      mock.setConfig({ ...config, fallback: config.fallback, port: n });
    }
  }, [mock, config]);

  const handleFallbackChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextFallback = e.target.value as WsMockFallbackMode;
    mock.setConfig({ ...config, fallback: nextFallback });
    if (status.running) {
      void mock.pushRulesToServer(rules, nextFallback);
    }
  }, [mock, config, status.running, rules]);

  const handleStart = useCallback(async () => {
    try {
      await mock.start();
    } catch { /* error shown via status.error */ }
  }, [mock]);

  const handleStop = useCallback(async () => {
    try {
      await mock.stop();
    } catch { /* ignore */ }
  }, [mock]);

  const handleBroadcast = useCallback(async () => {
    if (!broadcastText.trim()) return;
    try {
      await mock.broadcast(broadcastText);
      setBroadcastText('');
    } catch { /* ignore */ }
  }, [mock, broadcastText]);

  const updateRules = useCallback((next: WsMockRule[]) => {
    mock.setRules(next);
    if (status.running) {
      void mock.pushRulesToServer(next, config.fallback);
    }
  }, [mock, status.running, config.fallback]);

  const handleAddRule = useCallback(() => {
    const newRule = createEmptyRule();
    updateRules([...rules, newRule]);
    setEditingRuleId(newRule.id);
  }, [updateRules, rules]);

  const handleDeleteRule = useCallback((id: string) => {
    updateRules(rules.filter((r) => r.id !== id));
    if (editingRuleId === id) setEditingRuleId(null);
  }, [updateRules, rules, editingRuleId]);

  const handleToggleRule = useCallback((id: string) => {
    updateRules(rules.map((r) => r.id === id ? { ...r, enabled: !r.enabled } : r));
  }, [updateRules, rules]);

  const handleUpdateRule = useCallback((id: string, patch: Partial<WsMockRule>) => {
    updateRules(rules.map((r) => r.id === id ? { ...r, ...patch } : r));
  }, [updateRules, rules]);

  const handleMoveRule = useCallback((id: string, direction: 'up' | 'down') => {
    const idx = rules.findIndex((r) => r.id === id);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= rules.length) return;
    const next = [...rules];
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    updateRules(next);
  }, [updateRules, rules]);

  const testResult = useMemo(() => {
    if (!testInput.trim()) return null;
    return evaluateRules(rules, testInput, config.fallback);
  }, [testInput, rules, config.fallback]);

  const reversedLogs = useMemo(() => [...logs].reverse(), [logs]);

  return (
    <div className="ws-mock-container" data-testid="mock-server-panel">
      {/* Header */}
      <div className="ws-mock-header">
        <div className="ws-mock-header-left">
          <span
            className={`ws-mock-status-dot ${status.running ? 'running' : 'stopped'}`}
            aria-label={status.running ? 'Server running' : 'Server stopped'}
          />
          <span className="ws-mock-status-label" data-testid="mock-status-label">
            {status.running ? `Running on :${status.port}` : 'Stopped'}
          </span>
          {status.running && (
            <span className="ws-mock-client-count" data-testid="mock-client-count">
              {status.clientCount} client{status.clientCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="ws-mock-header-actions">
          {!status.running ? (
            <button
              className="ws-mock-start-btn"
              onClick={handleStart}
              disabled={starting || !portValid}
              data-testid="mock-start-btn"
            >
              {starting ? 'Starting\u2026' : 'Start Server'}
            </button>
          ) : (
            <button className="ws-mock-stop-btn" onClick={handleStop} data-testid="mock-stop-btn">
              Stop Server
            </button>
          )}
        </div>
      </div>

      {status.error && (
        <div className="ws-mock-error" role="alert" data-testid="mock-error">
          {status.error}
        </div>
      )}

      {/* Config */}
      <div className="ws-mock-config">
        <label className="ws-mock-config-label">
          Port:
          <input
            className={`ws-mock-port-input ${portValid ? '' : 'invalid'}`}
            type="number"
            value={portInput}
            onChange={handlePortChange}
            disabled={status.running}
            min={1024}
            max={65535}
            data-testid="mock-port-input"
          />
        </label>
        <label className="ws-mock-config-label">
          Fallback:
          <select
            className="ws-mock-fallback-select"
            value={config.fallback}
            onChange={handleFallbackChange}
            data-testid="mock-fallback-select"
          >
            {FALLBACK_MODES.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Connected clients */}
      {status.running && status.clients.length > 0 && (
        <div className="ws-mock-clients" data-testid="mock-clients">
          <div className="ws-mock-section-title">Connected Clients</div>
          {status.clients.map((c) => (
            <div key={c.id} className="ws-mock-client-row" data-testid={`mock-client-${c.id}`}>
              <span className="ws-mock-client-id">{c.id}</span>
              <span className="ws-mock-client-addr">{c.remoteAddress ?? '—'}</span>
              <span className="ws-mock-client-msgs">{c.messageCount} msgs</span>
            </div>
          ))}
        </div>
      )}

      {/* Broadcast */}
      {status.running && (
        <div className="ws-mock-broadcast" data-testid="mock-broadcast">
          <input
            className="ws-mock-broadcast-input"
            type="text"
            value={broadcastText}
            onChange={(e) => setBroadcastText(e.target.value)}
            placeholder="Broadcast message to all clients\u2026"
            onKeyDown={(e) => { if (e.key === 'Enter') handleBroadcast(); }}
            data-testid="mock-broadcast-input"
          />
          <button
            className="ws-mock-broadcast-btn"
            onClick={handleBroadcast}
            disabled={!broadcastText.trim() || status.clientCount === 0}
            data-testid="mock-broadcast-btn"
          >
            Send
          </button>
        </div>
      )}

      {/* Rules */}
      <div className="ws-mock-rules-section">
        <div className="ws-mock-section-header">
          <span className="ws-mock-section-title">Response Rules</span>
          <button className="ws-mock-add-rule-btn" onClick={handleAddRule} data-testid="mock-add-rule">
            + Add Rule
          </button>
        </div>

        {rules.length === 0 && (
          <div className="ws-mock-empty-rules" data-testid="mock-empty-rules">
            No rules configured. Fallback mode ({config.fallback}) will apply to all messages.
          </div>
        )}

        {rules.map((rule, idx) => (
          <div
            key={rule.id}
            className={`ws-mock-rule ${rule.enabled ? '' : 'disabled'} ${editingRuleId === rule.id ? 'editing' : ''}`}
            data-testid={`mock-rule-${rule.id}`}
          >
            <div className="ws-mock-rule-header">
              <input
                type="checkbox"
                checked={rule.enabled}
                onChange={() => handleToggleRule(rule.id)}
                aria-label={`Enable ${rule.name}`}
                data-testid={`rule-toggle-${rule.id}`}
              />
              <button
                type="button"
                className="ws-mock-rule-name"
                onClick={() => setEditingRuleId(editingRuleId === rule.id ? null : rule.id)}
                aria-expanded={editingRuleId === rule.id}
                aria-label={`Edit ${rule.name}`}
              >
                {rule.name}
              </button>
              <span className="ws-mock-rule-summary">
                {rule.match.type}{rule.match.type !== 'any' ? `: ${rule.match.pattern.slice(0, 30)}${rule.match.pattern.length > 30 ? '\u2026' : ''}` : ''}
                {' → '}
                {rule.response.type}
                {rule.response.delay ? ` (+${rule.response.delay}ms)` : ''}
              </span>
              <div className="ws-mock-rule-actions">
                <button
                  className="ws-mock-rule-action-btn"
                  onClick={() => handleMoveRule(rule.id, 'up')}
                  disabled={idx === 0}
                  title="Move up"
                  aria-label={`Move ${rule.name} up`}
                >▲</button>
                <button
                  className="ws-mock-rule-action-btn"
                  onClick={() => handleMoveRule(rule.id, 'down')}
                  disabled={idx === rules.length - 1}
                  title="Move down"
                  aria-label={`Move ${rule.name} down`}
                >▼</button>
                <button
                  className="ws-mock-rule-action-btn ws-mock-rule-delete"
                  onClick={() => handleDeleteRule(rule.id)}
                  title="Delete rule"
                  aria-label={`Delete ${rule.name}`}
                  data-testid={`rule-delete-${rule.id}`}
                >×</button>
              </div>
            </div>

            {editingRuleId === rule.id && (
              <div className="ws-mock-rule-editor" data-testid={`rule-editor-${rule.id}`}>
                <label className="ws-mock-editor-label">
                  Name:
                  <input
                    className="ws-mock-editor-input"
                    type="text"
                    value={rule.name}
                    onChange={(e) => handleUpdateRule(rule.id, { name: e.target.value })}
                    data-testid={`rule-name-${rule.id}`}
                  />
                </label>

                <div className="ws-mock-editor-row">
                  <label className="ws-mock-editor-label">
                    Match:
                    <select
                      className="ws-mock-editor-select"
                      value={rule.match.type}
                      onChange={(e) => handleUpdateRule(rule.id, {
                        match: { ...rule.match, type: e.target.value as WsMockMatchType },
                      })}
                      data-testid={`rule-match-type-${rule.id}`}
                    >
                      {MATCH_TYPES.map((m) => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </label>
                  {rule.match.type !== 'any' && (
                    <input
                      className="ws-mock-editor-input ws-mock-editor-pattern"
                      type="text"
                      value={rule.match.pattern}
                      onChange={(e) => handleUpdateRule(rule.id, {
                        match: { ...rule.match, pattern: e.target.value },
                      })}
                      placeholder={
                        rule.match.type === 'regex' ? 'e.g. hello.*'
                          : rule.match.type === 'jsonpath' ? 'e.g. $.type=ping'
                            : 'Pattern\u2026'
                      }
                      data-testid={`rule-match-pattern-${rule.id}`}
                    />
                  )}
                </div>

                <div className="ws-mock-editor-row">
                  <label className="ws-mock-editor-label">
                    Response:
                    <select
                      className="ws-mock-editor-select"
                      value={rule.response.type}
                      onChange={(e) => handleUpdateRule(rule.id, {
                        response: { ...rule.response, type: e.target.value as WsMockResponseType },
                      })}
                      data-testid={`rule-response-type-${rule.id}`}
                    >
                      {RESPONSE_TYPES.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </label>
                  {(rule.response.type === 'static' || rule.response.type === 'template') && (
                    <textarea
                      className="ws-mock-editor-textarea"
                      value={rule.response.data ?? ''}
                      onChange={(e) => handleUpdateRule(rule.id, {
                        response: { ...rule.response, data: e.target.value },
                      })}
                      placeholder={
                        rule.response.type === 'template'
                          ? '{"status":"ok","ts":"{{timestamp}}","client":"{{clientId}}"}'
                          : 'Response data\u2026'
                      }
                      rows={2}
                      data-testid={`rule-response-data-${rule.id}`}
                    />
                  )}
                  {rule.response.type === 'close' && (
                    <div className="ws-mock-editor-close-fields">
                      <input
                        className="ws-mock-editor-input ws-mock-editor-close-code"
                        type="number"
                        value={rule.response.closeCode ?? 1000}
                        onChange={(e) => handleUpdateRule(rule.id, {
                          response: { ...rule.response, closeCode: parseInt(e.target.value, 10) || 1000 },
                        })}
                        placeholder="Code"
                        data-testid={`rule-close-code-${rule.id}`}
                      />
                      <input
                        className="ws-mock-editor-input"
                        type="text"
                        value={rule.response.closeReason ?? ''}
                        onChange={(e) => handleUpdateRule(rule.id, {
                          response: { ...rule.response, closeReason: e.target.value },
                        })}
                        placeholder="Reason"
                        data-testid={`rule-close-reason-${rule.id}`}
                      />
                    </div>
                  )}
                </div>

                <label className="ws-mock-editor-label">
                  Delay (ms):
                  <input
                    className="ws-mock-editor-input ws-mock-editor-delay"
                    type="number"
                    value={rule.response.delay ?? 0}
                    onChange={(e) => handleUpdateRule(rule.id, {
                      response: { ...rule.response, delay: Math.max(0, Math.min(10000, parseInt(e.target.value, 10) || 0)) },
                    })}
                    min={0}
                    max={10000}
                    data-testid={`rule-delay-${rule.id}`}
                  />
                </label>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Rule Test */}
      <div className="ws-mock-test-section" data-testid="mock-test-section">
        <div className="ws-mock-section-title">Test Rules</div>
        <div className="ws-mock-test-row">
          <input
            className="ws-mock-test-input"
            type="text"
            value={testInput}
            onChange={(e) => setTestInput(e.target.value)}
            placeholder="Type a sample message to test rule matching\u2026"
            data-testid="mock-test-input"
          />
        </div>
        {testResult && (
          <div className={`ws-mock-test-result ${testResult.matched ? 'matched' : 'fallback'}`} data-testid="mock-test-result">
            {testResult.matched
              ? <>Matched rule: <strong>{testResult.rule?.name}</strong> → {testResult.response?.type}</>
              : <>No rule matched → fallback: <strong>{config.fallback}</strong></>
            }
          </div>
        )}
      </div>

      {/* Activity Log */}
      <div className="ws-mock-log-section">
        <div className="ws-mock-section-header">
          <span className="ws-mock-section-title">Activity Log</span>
          {logs.length > 0 && (
            <button className="ws-mock-clear-log-btn" onClick={mock.clearLogs} data-testid="mock-clear-log">
              Clear
            </button>
          )}
        </div>
        <div className="ws-mock-log" data-testid="mock-log">
          {reversedLogs.length === 0 && (
            <div className="ws-mock-log-empty">No activity yet</div>
          )}
          {reversedLogs.map((entry) => (
            <div key={entry.id} className={`ws-mock-log-entry ws-mock-log-${entry.event}`} data-testid={`mock-log-${entry.id}`}>
              <span className="ws-mock-log-ts">
                {new Date(entry.ts).toLocaleTimeString()}
              </span>
              <span className="ws-mock-log-event">{entry.event}</span>
              {entry.clientId && <span className="ws-mock-log-client">[{entry.clientId}]</span>}
              {entry.ruleName && <span className="ws-mock-log-rule">{entry.ruleName}</span>}
              {entry.data && <span className="ws-mock-log-data">{entry.data}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
