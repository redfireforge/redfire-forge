import { useMemo } from 'react';
import type {
  Scenario,
  WsActionType,
  WsConnectActionConfig,
  WsSendActionConfig,
  WsReceiveActionConfig,
  KeyValue,
} from '../../../shared/types';
import {
  createDefaultWsConnectAction,
  createDefaultWsSendAction,
  createDefaultWsReceiveAction,
} from '../../../shared/utils/wsScenarioDefaults';

export interface WsScenarioEditorProps {
  draft: Scenario;
  onDraftChange: (draft: Scenario) => void;
  resolvedBaseUrl: string;
  /** Sibling tests in the same scenario — used to populate connectionRef dropdowns. */
  siblingTests: Scenario[];
}

export default function WsScenarioEditor({
  draft,
  onDraftChange,
  resolvedBaseUrl,
  siblingTests,
}: WsScenarioEditorProps) {
  const wsType = draft.actionType as WsActionType;

  const hasConnectTestsWithoutId = useMemo(
    () => siblingTests.some((t) => t.actionType === 'wsConnect' && t.id !== draft.id && !t.wsConnectAction?.connectionId?.trim()),
    [siblingTests, draft.id],
  );

  const connectOptions = useMemo(
    () =>
      siblingTests
        .filter((t) => t.actionType === 'wsConnect' && t.id !== draft.id && t.wsConnectAction?.connectionId?.trim())
        .map((t) => ({
          id: t.wsConnectAction!.connectionId!,
          label: t.name || t.wsConnectAction!.connectionId!,
        })),
    [siblingTests, draft.id],
  );

  if (wsType === 'wsConnect') {
    const cfg = draft.wsConnectAction ?? createDefaultWsConnectAction();
    const updateCfg = (patch: Partial<WsConnectActionConfig>) =>
      onDraftChange({ ...draft, wsConnectAction: { ...cfg, ...patch } });

    return (
      <div className="ws-editor">
        <div className="form-row">
          <label>WebSocket URL</label>
          <input
            value={cfg.url}
            onChange={(e) => updateCfg({ url: e.target.value })}
            placeholder={resolvedBaseUrl ? `${resolvedBaseUrl}/ws` : 'wss://api.example.com/ws'}
            aria-label="WebSocket URL"
          />
        </div>

        <div className="form-row">
          <label>Connection ID</label>
          <input
            value={cfg.connectionId ?? ''}
            onChange={(e) => updateCfg({ connectionId: e.target.value || undefined })}
            placeholder="e.g. primary, chat-conn"
            aria-label="Connection ID"
          />
          <span className="form-hint">Optional label — used by wsSend/wsReceive to reference this connection</span>
        </div>

        <div className="form-row">
          <label>Subprotocols</label>
          <input
            value={cfg.subprotocols ?? ''}
            onChange={(e) => updateCfg({ subprotocols: e.target.value || undefined })}
            placeholder="e.g. graphql-ws, json"
            aria-label="Subprotocols"
          />
          <span className="form-hint">Comma-separated list of WebSocket subprotocols</span>
        </div>

        <div className="form-row">
          <label>Timeout (ms)</label>
          <input
            type="number"
            value={cfg.timeoutMs ?? 10000}
            onChange={(e) => updateCfg({ timeoutMs: Number(e.target.value) || undefined })}
            min={0}
            className="input-sm"
            aria-label="Connect timeout"
          />
        </div>

        <WsKvEditor
          label="Headers"
          items={cfg.headers ?? []}
          onChange={(headers) => updateCfg({ headers: headers.length > 0 ? headers : undefined })}
        />

        <WsKvEditor
          label="Query Parameters"
          items={cfg.queryParams ?? []}
          onChange={(queryParams) => updateCfg({ queryParams: queryParams.length > 0 ? queryParams : undefined })}
        />
      </div>
    );
  }

  if (wsType === 'wsSend') {
    const cfg = draft.wsSendAction ?? createDefaultWsSendAction();
    const updateCfg = (patch: Partial<WsSendActionConfig>) =>
      onDraftChange({ ...draft, wsSendAction: { ...cfg, ...patch } });

    return (
      <div className="ws-editor">
        <div className="form-row">
          <label>Connection Ref</label>
          <select
            value={cfg.connectionRef ?? ''}
            onChange={(e) => updateCfg({ connectionRef: e.target.value || undefined })}
            aria-label="Connection reference"
          >
            <option value="">— select a connection —</option>
            {connectOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>{opt.label}</option>
            ))}
          </select>
          {connectOptions.length === 0 && (
            <span className="form-hint form-hint--warn">
              {hasConnectTestsWithoutId
                ? 'Sibling wsConnect tests exist but have no Connection ID set. Set a Connection ID on the connect test, or enter one manually below.'
                : 'No wsConnect tests found in this scenario. Add one first or enter a connection ID manually.'}
            </span>
          )}
        </div>

        {connectOptions.length === 0 && (
          <div className="form-row">
            <label>Connection Ref (manual)</label>
            <input
              value={cfg.connectionRef ?? ''}
              onChange={(e) => updateCfg({ connectionRef: e.target.value || undefined })}
              placeholder="Connection ID from a wsConnect test"
              aria-label="Manual connection reference"
            />
          </div>
        )}

        <div className="form-row">
          <label>Message</label>
          <textarea
            value={cfg.message}
            onChange={(e) => updateCfg({ message: e.target.value })}
            placeholder='{"type": "subscribe", "channel": "orders"}'
            rows={5}
            spellCheck={false}
            aria-label="Message body"
          />
          <span className="form-hint">Supports {'{{variable}}'} interpolation from data sources</span>
        </div>

        <div className="form-row form-row--inline">
          <label>Format</label>
          <select
            value={cfg.messageType ?? 'text'}
            onChange={(e) => updateCfg({ messageType: e.target.value as 'text' | 'binary' })}
            className="input-sm"
            aria-label="Message type"
          >
            <option value="text">Text</option>
            <option value="binary">Binary</option>
          </select>
        </div>

        <div className="form-row form-row--inline">
          <label className="label-checkbox">
            <input
              type="checkbox"
              checked={cfg.waitForResponse ?? false}
              onChange={(e) => updateCfg({ waitForResponse: e.target.checked })}
            />
            Wait for response
          </label>
          {cfg.waitForResponse && (
            <>
              <label>Response Timeout (ms)</label>
              <input
                type="number"
                value={cfg.responseTimeoutMs ?? 5000}
                onChange={(e) => updateCfg({ responseTimeoutMs: Number(e.target.value) || undefined })}
                min={0}
                className="input-sm"
                aria-label="Response timeout"
              />
            </>
          )}
        </div>
      </div>
    );
  }

  if (wsType === 'wsReceive') {
    const cfg = draft.wsReceiveAction ?? createDefaultWsReceiveAction();
    const updateCfg = (patch: Partial<WsReceiveActionConfig>) =>
      onDraftChange({ ...draft, wsReceiveAction: { ...cfg, ...patch } });

    return (
      <div className="ws-editor">
        <div className="form-row">
          <label>Connection Ref</label>
          <select
            value={cfg.connectionRef ?? ''}
            onChange={(e) => updateCfg({ connectionRef: e.target.value || undefined })}
            aria-label="Connection reference"
          >
            <option value="">— select a connection —</option>
            {connectOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>{opt.label}</option>
            ))}
          </select>
          {connectOptions.length === 0 && (
            <span className="form-hint form-hint--warn">
              {hasConnectTestsWithoutId
                ? 'Sibling wsConnect tests exist but have no Connection ID set. Set a Connection ID on the connect test, or enter one manually below.'
                : 'No wsConnect tests found in this scenario. Add one first or enter a connection ID manually.'}
            </span>
          )}
        </div>

        {connectOptions.length === 0 && (
          <div className="form-row">
            <label>Connection Ref (manual)</label>
            <input
              value={cfg.connectionRef ?? ''}
              onChange={(e) => updateCfg({ connectionRef: e.target.value || undefined })}
              placeholder="Connection ID from a wsConnect test"
              aria-label="Manual connection reference"
            />
          </div>
        )}

        <div className="form-row">
          <label>Timeout (ms)</label>
          <input
            type="number"
            value={cfg.timeoutMs ?? 10000}
            onChange={(e) => updateCfg({ timeoutMs: Number(e.target.value) || undefined })}
            min={0}
            className="input-sm"
            aria-label="Receive timeout"
          />
        </div>

        <fieldset className="ws-match-criteria">
          <legend>Match Criteria (optional)</legend>
          <div className="form-row">
            <label>Content Contains</label>
            <input
              value={cfg.matchCriteria?.contentContains ?? ''}
              onChange={(e) => updateCfg({
                matchCriteria: { ...cfg.matchCriteria, contentContains: e.target.value || undefined },
              })}
              placeholder="Substring to match in message body"
              aria-label="Content contains filter"
            />
          </div>
          <div className="form-row">
            <label>Content Regex</label>
            <input
              value={cfg.matchCriteria?.contentRegex ?? ''}
              onChange={(e) => updateCfg({
                matchCriteria: { ...cfg.matchCriteria, contentRegex: e.target.value || undefined },
              })}
              placeholder="Regular expression pattern"
              aria-label="Content regex filter"
            />
          </div>
          <div className="form-row form-row--inline">
            <label>JSON Path</label>
            <input
              value={cfg.matchCriteria?.jsonPathMatch ?? ''}
              onChange={(e) => updateCfg({
                matchCriteria: { ...cfg.matchCriteria, jsonPathMatch: e.target.value || undefined },
              })}
              placeholder="$.type"
              className="input-sm"
              aria-label="JSONPath to match"
            />
            <label>Value</label>
            <input
              value={cfg.matchCriteria?.jsonPathValue ?? ''}
              onChange={(e) => updateCfg({
                matchCriteria: { ...cfg.matchCriteria, jsonPathValue: e.target.value || undefined },
              })}
              placeholder="Expected value"
              className="input-sm"
              aria-label="JSONPath expected value"
            />
          </div>
          <div className="form-row form-row--inline">
            <label>Frame Type</label>
            <select
              value={cfg.matchCriteria?.messageType ?? 'any'}
              onChange={(e) => {
                const v = e.target.value as 'text' | 'binary' | 'any';
                updateCfg({
                  matchCriteria: { ...cfg.matchCriteria, messageType: v === 'any' ? undefined : v },
                });
              }}
              className="input-sm"
              aria-label="Frame type filter"
            >
              <option value="any">Any</option>
              <option value="text">Text</option>
              <option value="binary">Binary</option>
            </select>
          </div>
        </fieldset>
      </div>
    );
  }

  return null;
}

// ── Inline KV editor for headers / query params ─────────────────────────────

function WsKvEditor({
  label,
  items,
  onChange,
}: {
  label: string;
  items: KeyValue[];
  onChange: (items: KeyValue[]) => void;
}) {
  const update = (index: number, field: 'key' | 'value', val: string) => {
    const next = [...items];
    next[index] = { ...next[index], [field]: val };
    onChange(next);
  };
  const add = () => onChange([...items, { key: '', value: '' }]);
  const remove = (index: number) => onChange(items.filter((_, i) => i !== index));

  return (
    <div className="kv-section">
      <div className="kv-header"><span>{label.toUpperCase()}</span></div>
      {items.map((kv, i) => (
        <div key={i} className="kv-row">
          <input value={kv.key} onChange={(e) => update(i, 'key', e.target.value)} placeholder={`${label} name`} />
          <input value={kv.value} onChange={(e) => update(i, 'value', e.target.value)} placeholder={`${label} value`} />
          <button type="button" className="btn btn-sm btn-danger" onClick={() => remove(i)}>×</button>
        </div>
      ))}
      <button type="button" className="btn btn-sm" onClick={add}>+ Add</button>
    </div>
  );
}
