import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type DragEvent, type KeyboardEvent } from 'react';
import { CustomSelect } from '../../shared/components/CustomSelect';
import type { WsMockRule, WsMockMatchType, WsMockResponseType, WsMockFallbackMode } from '../../shared/websocket/types';
import { formatUptime } from '../../shared/websocket/types';
import { evaluateRules } from './wsMockRuleEngine';
import type { UseWebSocketMockServerReturn, MockServerConfig } from './useWebSocketMockServer';
import { MockActivityLog, MockRuleTester } from './WebSocketMockRulesExtras';

interface WebSocketMockServerProps {
  mock: UseWebSocketMockServerReturn;
  onPortChange?: (port: number) => void;
}

type MockRightTab = 'rules' | 'log';

export interface MockUi {
  mock: UseWebSocketMockServerReturn;
  status: UseWebSocketMockServerReturn['status'];
  logs: UseWebSocketMockServerReturn['logs'];
  rules: WsMockRule[];
  config: MockServerConfig;
  starting: boolean;
  editingRuleId: string | null;
  setEditingRuleId: (id: string | null) => void;
  broadcastText: string;
  setBroadcastText: (v: string) => void;
  testInput: string;
  setTestInput: (v: string) => void;
  rightTab: MockRightTab;
  setRightTab: (t: MockRightTab) => void;
  enabledRuleCount: number;
  startedAt: number | null;
  testResult: ReturnType<typeof evaluateRules> | null;
  reversedLogs: UseWebSocketMockServerReturn['logs'];
  handleFallbackChange: (value: string) => void;
  handleStart: () => void;
  handleStop: () => void;
  handleBroadcast: () => void;
  handleAddRule: () => void;
  handleDeleteRule: (id: string) => void;
  handleToggleRule: (id: string) => void;
  handleUpdateRule: (id: string, patch: Partial<WsMockRule>) => void;
  handleMoveRule: (id: string, direction: 'up' | 'down') => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filteredRules: WsMockRule[];
  dragRuleId: string | null;
  dragOverRuleId: string | null;
  handleDragStart: (ruleId: string) => void;
  handleDragOver: (e: DragEvent<HTMLDivElement>, ruleId: string) => void;
  handleDrop: (e: DragEvent<HTMLDivElement>, targetRuleId: string) => void;
  handleDragEnd: () => void;
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

// eslint-disable-next-line react-refresh/only-export-components
export function useMockServerUi(mock: UseWebSocketMockServerReturn): MockUi {
  const { status, logs, rules, config, starting } = mock;
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [broadcastText, setBroadcastText] = useState('');
  const [testInput, setTestInput] = useState('');
  const [rightTab, setRightTab] = useState<MockRightTab>('rules');
  const [searchQuery, setSearchQuery] = useState('');
  const [dragRuleId, setDragRuleId] = useState<string | null>(null);
  const [dragOverRuleId, setDragOverRuleId] = useState<string | null>(null);
  // Client-side uptime anchor: WsMockStatus carries no startedAt, so we stamp
  // the moment the server transitions to running. The per-second ticker lives
  // in the <MockUptime> leaf so it does not re-render the whole pane.
  const [startedAt, setStartedAt] = useState<number | null>(null);

  useEffect(() => {
    if (status.running) {
      setStartedAt((prev) => prev ?? Date.now());
    } else {
      setStartedAt(null);
    }
  }, [status.running]);

  const handleFallbackChange = useCallback((value: string) => {
    const nextFallback = value as WsMockFallbackMode;
    mock.setConfig({ ...config, fallback: nextFallback });
    if (status.running) {
      void mock.pushRulesToServer(rules, nextFallback);
    }
  }, [mock, config, status.running, rules]);

  const handleStart = useCallback(() => {
    void (async () => {
      try {
        await mock.start();
      } catch { /* error shown via status.error */ }
    })();
  }, [mock]);

  const handleStop = useCallback(() => {
    void (async () => {
      try {
        await mock.stop();
      } catch { /* ignore */ }
    })();
  }, [mock]);

  const handleBroadcast = useCallback(() => {
    if (!broadcastText.trim()) return;
    void (async () => {
      try {
        await mock.broadcast(broadcastText);
        setBroadcastText('');
      } catch { /* ignore */ }
    })();
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

  const handleDragStart = useCallback((ruleId: string) => {
    setDragRuleId(ruleId);
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>, ruleId: string) => {
    e.preventDefault();
    setDragOverRuleId((prev) => (dragRuleId && dragRuleId !== ruleId) ? ruleId : prev);
  }, [dragRuleId]);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>, targetRuleId: string) => {
    e.preventDefault();
    if (!dragRuleId || dragRuleId === targetRuleId) {
      setDragRuleId(null);
      setDragOverRuleId(null);
      return;
    }
    const next = [...rules];
    const fromIdx = next.findIndex((r) => r.id === dragRuleId);
    const toIdx = next.findIndex((r) => r.id === targetRuleId);
    if (fromIdx < 0 || toIdx < 0) {
      setDragRuleId(null);
      setDragOverRuleId(null);
      return;
    }
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    updateRules(next);
    setDragRuleId(null);
    setDragOverRuleId(null);
  }, [dragRuleId, rules, updateRules]);

  const handleDragEnd = useCallback(() => {
    setDragRuleId(null);
    setDragOverRuleId(null);
  }, []);

  const testResult = useMemo(() => {
    if (!testInput.trim()) return null;
    return evaluateRules(rules, testInput, config.fallback);
  }, [testInput, rules, config.fallback]);

  const reversedLogs = useMemo(() => [...logs].reverse(), [logs]);
  const enabledRuleCount = useMemo(() => rules.filter((r) => r.enabled).length, [rules]);

  const filteredRules = useMemo(() => {
    if (!searchQuery.trim()) return rules;
    const q = searchQuery.toLowerCase();
    return rules.filter((r) =>
      r.name.toLowerCase().includes(q) ||
      r.match.type.toLowerCase().includes(q) ||
      r.match.pattern.toLowerCase().includes(q) ||
      r.response.type.toLowerCase().includes(q),
    );
  }, [rules, searchQuery]);

  return {
    mock, status, logs, rules, config, starting,
    editingRuleId, setEditingRuleId,
    broadcastText, setBroadcastText,
    testInput, setTestInput,
    rightTab, setRightTab,
    enabledRuleCount, startedAt,
    testResult, reversedLogs,
    handleFallbackChange,
    handleStart, handleStop, handleBroadcast,
    handleAddRule, handleDeleteRule, handleToggleRule, handleUpdateRule, handleMoveRule,
    searchQuery, setSearchQuery, filteredRules,
    dragRuleId, dragOverRuleId, handleDragStart, handleDragOver, handleDrop, handleDragEnd,
  };
}

function MockUptime({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return <b>{formatUptime(now - startedAt)}</b>;
}

export function WebSocketMockServerBar({
  ui,
  onPortChange,
  clientPortMismatch,
}: {
  ui: MockUi;
  onPortChange?: (port: number) => void;
  /** Set when the Client (this same tab) is connected to a local WS server on
   *  a different port than the one this Mock Server panel is running on —
   *  see WsConnectionTabContent.tsx for the detection logic. */
  clientPortMismatch?: { connectedUrl: string; clientPort: number } | null;
}) {
  const { status, config, starting, enabledRuleCount, startedAt } = ui;
  const canEditPort = !status.running && !starting;

  // Local string state so the user can delete digits and retype freely without
  // the controlled value snapping back on every keystroke.
  const [inputValue, setInputValue] = useState(String(config.port));

  // Keep in sync when the port changes from outside (e.g. parent reassignment).
  useEffect(() => {
    setInputValue(String(config.port));
  }, [config.port]);

  function handlePortInput(e: ChangeEvent<HTMLInputElement>) {
    setInputValue(e.target.value);
  }

  function commitPort() {
    const val = parseInt(inputValue, 10);
    if (!isNaN(val) && val >= 1024 && val <= 65535) {
      onPortChange?.(val);
    } else {
      // Reset display to current valid port on invalid input
      setInputValue(String(config.port));
    }
  }

  function handlePortKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    } else if (e.key === 'Escape') {
      setInputValue(String(config.port));
      (e.target as HTMLInputElement).blur();
    }
  }

  // Derive the URL preview from the local inputValue so it updates as you type
  const previewPort = parseInt(inputValue, 10);
  const urlDisplay = `ws://localhost:${!isNaN(previewPort) ? previewPort : config.port}`;

  return (
    <div className="ws-mock-serverbar-wrap">
      <div className="ws-mock-serverbar">
        <span className="ws-mock-proto">WS</span>
        <input
          className="ws-mock-url"
          type="text"
          value={urlDisplay}
          readOnly
          spellCheck={false}
          aria-label="Mock server URL"
        />
        <input
          className={`ws-mock-port-input${canEditPort ? ' editable' : ''}`}
          type="number"
          value={inputValue}
          readOnly={!canEditPort}
          onChange={canEditPort ? handlePortInput : undefined}
          onBlur={canEditPort ? commitPort : undefined}
          onKeyDown={canEditPort ? handlePortKeyDown : undefined}
          min={1024}
          max={65535}
          title={canEditPort ? 'Type a port number (1024–65535), then press Enter or click away' : 'Stop the server to change the port'}
          aria-label={canEditPort ? 'Mock server port (editable)' : 'Mock server port (stop server to edit)'}
          data-testid="mock-port-input"
        />
        {!status.running ? (
          <button
            className="ws-mock-start-btn"
            onClick={ui.handleStart}
            disabled={starting}
            data-testid="mock-start-btn"
          >
            {starting ? 'Starting\u2026' : 'Start Server'}
          </button>
        ) : (
          <button className="ws-mock-stop-btn" onClick={ui.handleStop} data-testid="mock-stop-btn">
            Stop Server
          </button>
        )}
      </div>

      <div className="ws-mock-statusstrip">
        <span className={`ws-mock-statuspill ${status.running ? 'running' : 'stopped'}`}>
          <span
            className={`ws-mock-status-dot ${status.running ? 'running' : 'stopped'}`}
            aria-label={status.running ? 'Server running' : 'Server stopped'}
          />
          <span className="ws-mock-status-label" data-testid="mock-status-label">
            {status.running ? `Running on :${status.port}` : 'Stopped'}
          </span>
        </span>
        {status.running && (
          <span className="ws-mock-client-count" data-testid="mock-client-count">
            {status.clientCount} client{status.clientCount !== 1 ? 's' : ''}
          </span>
        )}
        <span className="ws-mock-strip-stat">Rules <b>{enabledRuleCount}</b> active</span>
        <span className="ws-mock-strip-stat ws-mock-strip-fallback">
          Fallback
          <CustomSelect
            className="ws-mock-fallback-select"
            value={config.fallback}
            onChange={ui.handleFallbackChange}
            options={FALLBACK_MODES}
            aria-label="Fallback mode"
            data-testid="mock-fallback-select"
          />
        </span>
        <span className="ws-mock-strip-spacer" />
        {status.running && startedAt != null && (
          <span className="ws-mock-strip-stat">Uptime <MockUptime startedAt={startedAt} /></span>
        )}
      </div>

      {status.error && (
        <div className="ws-mock-error" role="alert" data-testid="mock-error">
          {status.error}
        </div>
      )}

      {clientPortMismatch && (
        <div className="ws-mock-port-mismatch" role="alert" data-testid="mock-port-mismatch">
          <span className="ws-mock-port-mismatch-icon" aria-hidden="true">⚠</span>
          Client is connected to <strong>port {clientPortMismatch.clientPort}</strong>, not this
          server (<strong>port {status.port}</strong>). Activity for that connection won't appear
          here — connect the Client to <code>ws://localhost:{status.port}</code> to see it, or
          check other tabs for a server running on port {clientPortMismatch.clientPort}.
        </div>
      )}
    </div>
  );
}

export function WebSocketMockClientsPane({ ui }: { ui: MockUi }) {
  const { status, broadcastText } = ui;
  return (
    <div className="ws-mock-clients-pane">
      <div className="ws-mock-pane-tabs">
        <button type="button" className="ws-mock-pane-tab active">
          Connected Clients
          <span className="ws-mock-pane-badge">{status.clientCount}</span>
        </button>
      </div>

      <div className="ws-mock-clients-body">
        {!status.running ? (
          <div className="ws-mock-clients-empty">Server stopped — start it to accept client connections.</div>
        ) : status.clients.length === 0 ? (
          <div className="ws-mock-clients-empty">No clients connected yet.</div>
        ) : (
          <div className="ws-mock-clients" data-testid="mock-clients">
            {status.clients.map((c) => (
              <div key={c.id} className="ws-mock-client-row" data-testid={`mock-client-${c.id}`}>
                <span className="ws-mock-client-id">{c.id}</span>
                <span className="ws-mock-client-addr">{c.remoteAddress ?? '—'}</span>
                <span className="ws-mock-client-msgs">{c.messageCount} msgs</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {status.running && (
        <div className="ws-mock-broadcast" data-testid="mock-broadcast">
          <input
            className="ws-mock-broadcast-input"
            type="text"
            value={broadcastText}
            onChange={(e) => ui.setBroadcastText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') ui.handleBroadcast(); }}
            placeholder="Broadcast message to all clients…"
            data-testid="mock-broadcast-input"
          />
          <button
            className="ws-mock-broadcast-btn"
            onClick={ui.handleBroadcast}
            disabled={!broadcastText.trim()}
            data-testid="mock-broadcast-btn"
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
}

const MATCH_BADGE_CLASS: Record<WsMockMatchType, string> = {
  any: 'badge-any',
  exact: 'badge-exact',
  contains: 'badge-contains',
  regex: 'badge-regex',
  jsonpath: 'badge-jsonpath',
};
const RESPONSE_BADGE_CLASS: Record<WsMockResponseType, string> = {
  echo: 'badge-echo',
  static: 'badge-static',
  template: 'badge-template',
  close: 'badge-close',
};

function MockRuleCard({ ui, rule, idx }: { ui: MockUi; rule: WsMockRule; idx: number }) {
  const { editingRuleId, rules, dragRuleId, dragOverRuleId } = ui;
  const isOpen = editingRuleId === rule.id;
  return (
    <div
      className={`ws-mock-rule mock-server-rule-card${rule.enabled ? ' mock-server-rule-card--enabled' : ' mock-server-rule-card--disabled'}${!rule.enabled ? ' disabled' : ''} ${isOpen ? 'editing' : ''}${dragRuleId === rule.id ? ' mock-server-rule-card--dragging' : ''}${dragOverRuleId === rule.id ? ' mock-server-rule-card--drop-target' : ''}`}
      data-testid={`mock-rule-${rule.id}`}
      onDragOver={(e) => ui.handleDragOver(e, rule.id)}
      onDrop={(e) => ui.handleDrop(e, rule.id)}
    >
      <div className="ws-mock-rule-header">
        {/* Drag handle */}
        <span
          className="mock-server-drag-handle"
          draggable
          data-testid={`ws-mock-drag-${rule.id}`}
          onDragStart={() => ui.handleDragStart(rule.id)}
          onDragEnd={ui.handleDragEnd}
          title="Drag to reorder"
        >⠿</span>
        {/* Toggle (custom switch) */}
        <label className="ws-mock-rule-toggle-switch" title={rule.enabled ? 'Enabled' : 'Disabled'} data-testid={`rule-toggle-label-${rule.id}`}>
          <input
            type="checkbox"
            checked={rule.enabled}
            onChange={() => ui.handleToggleRule(rule.id)}
            aria-label={`Enable ${rule.name}`}
            data-testid={`rule-toggle-${rule.id}`}
          />
          <span className="ws-mock-toggle-slider" />
        </label>

        {/* Priority badge */}
        <span className="ws-mock-rule-priority" title={`Priority ${idx + 1}`}>
          {idx + 1}
        </span>

        {/* Rule name (click to expand/collapse) */}
        <button
          type="button"
          className="ws-mock-rule-name"
          onClick={() => ui.setEditingRuleId(isOpen ? null : rule.id)}
          aria-expanded={isOpen}
          aria-label={`Edit ${rule.name}`}
        >
          {rule.name}
          <span className={`ws-mock-rule-chevron ${isOpen ? 'open' : ''}`}>›</span>
        </button>

        {/* Type badges */}
        <span className="ws-mock-rule-badges">
          <span className={`ws-mock-type-badge ${MATCH_BADGE_CLASS[rule.match.type]}`}>
            {rule.match.type}
          </span>
          {rule.match.type !== 'any' && rule.match.pattern && (
            <span className="ws-mock-pattern-pill" title={rule.match.pattern}>
              {rule.match.pattern.slice(0, 24)}{rule.match.pattern.length > 24 ? '\u2026' : ''}
            </span>
          )}
          <span className="ws-mock-rule-arrow">→</span>
          <span className={`ws-mock-type-badge ${RESPONSE_BADGE_CLASS[rule.response.type]}`}>
            {rule.response.type}
          </span>
          {rule.response.delay ? (
            <span className="ws-mock-delay-pill">+{rule.response.delay}ms</span>
          ) : null}
        </span>

        {/* Legacy summary for tests (visually hidden) */}
        <span className="ws-mock-rule-summary" aria-hidden="true">
          {rule.match.type}{rule.match.type !== 'any' ? `: ${rule.match.pattern.slice(0, 30)}${rule.match.pattern.length > 30 ? '\u2026' : ''}` : ''}
          {' → '}
          {rule.response.type}
          {rule.response.delay ? ` (+${rule.response.delay}ms)` : ''}
        </span>

        {/* Actions */}
        <div className="ws-mock-rule-actions">
          <button
            className="ws-mock-rule-action-btn ws-mock-rule-move"
            onClick={() => ui.handleMoveRule(rule.id, 'up')}
            disabled={idx === 0}
            title="Move up"
            aria-label={`Move ${rule.name} up`}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 2.5L10 7.5H2L6 2.5Z" fill="currentColor"/></svg>
          </button>
          <button
            className="ws-mock-rule-action-btn ws-mock-rule-move"
            onClick={() => ui.handleMoveRule(rule.id, 'down')}
            disabled={idx === rules.length - 1}
            title="Move down"
            aria-label={`Move ${rule.name} down`}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 9.5L2 4.5H10L6 9.5Z" fill="currentColor"/></svg>
          </button>
          <button
            className="ws-mock-rule-action-btn ws-mock-rule-delete"
            onClick={() => ui.handleDeleteRule(rule.id)}
            title="Delete rule"
            aria-label={`Delete ${rule.name}`}
            data-testid={`rule-delete-${rule.id}`}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 3L9 9M9 3L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="ws-mock-rule-editor" data-testid={`rule-editor-${rule.id}`}>
          <div className="ws-mock-editor-grid">
            <label className="ws-mock-editor-label">Name</label>
            <input
              className="ws-mock-editor-input"
              type="text"
              value={rule.name}
              onChange={(e) => ui.handleUpdateRule(rule.id, { name: e.target.value })}
              data-testid={`rule-name-${rule.id}`}
            />

            <label className="ws-mock-editor-label">Match</label>
            <div className="ws-mock-editor-field-group">
              <CustomSelect
                className="ws-mock-editor-select"
                value={rule.match.type}
                onChange={(v) => ui.handleUpdateRule(rule.id, {
                  match: { ...rule.match, type: v as WsMockMatchType },
                })}
                options={MATCH_TYPES}
                data-testid={`rule-match-type-${rule.id}`}
                aria-label="Match type"
              />
              {rule.match.type !== 'any' && (
                <input
                  className="ws-mock-editor-input ws-mock-editor-pattern"
                  type="text"
                  value={rule.match.pattern}
                  onChange={(e) => ui.handleUpdateRule(rule.id, {
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

            <label className="ws-mock-editor-label">Response</label>
            <div className="ws-mock-editor-field-group">
              <CustomSelect
                className="ws-mock-editor-select"
                value={rule.response.type}
                onChange={(v) => ui.handleUpdateRule(rule.id, {
                  response: { ...rule.response, type: v as WsMockResponseType },
                })}
                options={RESPONSE_TYPES}
                data-testid={`rule-response-type-${rule.id}`}
                aria-label="Response type"
              />
              {(rule.response.type === 'static' || rule.response.type === 'template') && (
                <textarea
                  className="ws-mock-editor-textarea"
                  value={rule.response.data ?? ''}
                  onChange={(e) => ui.handleUpdateRule(rule.id, {
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
                    onChange={(e) => ui.handleUpdateRule(rule.id, {
                      response: { ...rule.response, closeCode: parseInt(e.target.value, 10) || 1000 },
                    })}
                    placeholder="Code"
                    data-testid={`rule-close-code-${rule.id}`}
                  />
                  <input
                    className="ws-mock-editor-input"
                    type="text"
                    value={rule.response.closeReason ?? ''}
                    onChange={(e) => ui.handleUpdateRule(rule.id, {
                      response: { ...rule.response, closeReason: e.target.value },
                    })}
                    placeholder="Reason"
                    data-testid={`rule-close-reason-${rule.id}`}
                  />
                </div>
              )}
            </div>

            <label className="ws-mock-editor-label">Delay</label>
            <div className="ws-mock-editor-field-group ws-mock-editor-delay-group">
              <input
                className="ws-mock-editor-input ws-mock-editor-delay"
                type="number"
                value={rule.response.delay ?? 0}
                onChange={(e) => ui.handleUpdateRule(rule.id, {
                  response: { ...rule.response, delay: Math.max(0, Math.min(10000, parseInt(e.target.value, 10) || 0)) },
                })}
                min={0}
                max={10000}
                data-testid={`rule-delay-${rule.id}`}
              />
              <span className="ws-mock-editor-unit">ms</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MockRuleList({ ui }: { ui: MockUi }) {
  const { rules, config, filteredRules, searchQuery } = ui;
  return (
    <div className="ws-mock-rules-section">
      <div className="ws-mock-section-header">
        <span className="ws-mock-section-title">Match incoming → respond automatically</span>
        <button className="ws-mock-add-rule-btn" onClick={ui.handleAddRule} data-testid="mock-add-rule" title="Add a new match rule" aria-label="Add rule">
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
          Add Rule
        </button>
      </div>

      {rules.length > 0 && (
        <input
          className="ws-mock-search"
          data-testid="ws-mock-search"
          type="search"
          placeholder="Filter rules by name, type, pattern…"
          value={searchQuery}
          onChange={(e) => ui.setSearchQuery(e.target.value)}
        />
      )}

      {rules.length === 0 && (
        <div className="mock-server-empty" data-testid="mock-empty-rules">
          <div className="mock-server-empty__icon" aria-hidden="true">📡</div>
          <div className="mock-server-empty__title">No mock rules yet</div>
          <div className="mock-server-empty__hint">
            Create your first rule to define how the mock server responds to incoming WebSocket messages.
            Fallback mode ({config.fallback}) will apply when no rules match.
          </div>
        </div>
      )}

      {filteredRules.map((rule, idx) => (
        <MockRuleCard key={rule.id} ui={ui} rule={rule} idx={idx} />
      ))}
    </div>
  );
}

export function WebSocketMockRulesPane({ ui, showTabs = true }: { ui: MockUi; showTabs?: boolean }) {
  const { rightTab, enabledRuleCount } = ui;
  if (!showTabs) {
    return (
      <div className="ws-mock-rules-pane" data-testid="mock-server-panel">
        <MockRuleList ui={ui} />
        <MockRuleTester ui={ui} />
        <MockActivityLog ui={ui} />
      </div>
    );
  }
  return (
    <div className="ws-mock-rules-pane" data-testid="mock-server-panel">
      <div className="ws-mock-pane-tabs">
        <button
          type="button"
          className={`ws-mock-pane-tab ${rightTab === 'rules' ? 'active' : ''}`}
          onClick={() => ui.setRightTab('rules')}
          data-testid="mock-tab-rules"
        >
          Rules
          <span className="ws-mock-pane-badge">{enabledRuleCount}</span>
        </button>
        <button
          type="button"
          className={`ws-mock-pane-tab ${rightTab === 'log' ? 'active' : ''}`}
          onClick={() => ui.setRightTab('log')}
          data-testid="mock-tab-log"
        >
          Server Log
        </button>
      </div>
      {rightTab === 'rules' ? (
        <>
          <MockRuleList ui={ui} />
          <MockRuleTester ui={ui} />
        </>
      ) : (
        <MockActivityLog ui={ui} />
      )}
    </div>
  );
}

export function WebSocketMockServer({ mock, onPortChange }: WebSocketMockServerProps) {
  const ui = useMockServerUi(mock);
  return (
    <div className="ws-mock-flat">
      <WebSocketMockServerBar ui={ui} onPortChange={onPortChange} />
      <div className="ws-mock-flat-body">
        <WebSocketMockClientsPane ui={ui} />
        <WebSocketMockRulesPane ui={ui} showTabs={false} />
      </div>
    </div>
  );
}
