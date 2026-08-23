import { useMemo } from 'react';
import type {
  Scenario,
  WsActionType,
  WsConnectActionConfig,
  WsSendActionConfig,
  WsReceiveActionConfig,
  KeyValue,
} from '@shared/types';
import {
  createDefaultWsConnectAction,
  createDefaultWsSendAction,
  createDefaultWsReceiveAction,
} from '@shared/utils/wsScenarioDefaults';
import { CustomSelect } from '@shared/components/CustomSelect';

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
        <div className="te-prop-card">
          <div className="te-prop-row">
            <div className="te-prop-label">WS URL</div>
            <div className="te-prop-ctrl">
              <input
                value={cfg.url}
                onChange={(e) => updateCfg({ url: e.target.value })}
                placeholder={resolvedBaseUrl ? `${resolvedBaseUrl}/ws` : 'wss://api.example.com/ws'}
                aria-label="WebSocket URL"
              />
            </div>
          </div>

          <div className="te-prop-row">
            <div className="te-prop-label">Conn ID</div>
            <div className="te-prop-ctrl te-prop-ctrl--with-hint">
              <input
                value={cfg.connectionId ?? ''}
                onChange={(e) => updateCfg({ connectionId: e.target.value || undefined })}
                placeholder="e.g. primary, chat-conn"
                aria-label="Connection ID"
              />
              <span className="te-prop-hint">Used by wsSend / wsReceive to reference this connection</span>
            </div>
          </div>

          <div className="te-prop-row">
            <div className="te-prop-label">Subproto</div>
            <div className="te-prop-ctrl te-prop-ctrl--with-hint">
              <input
                value={cfg.subprotocols ?? ''}
                onChange={(e) => updateCfg({ subprotocols: e.target.value || undefined })}
                placeholder="e.g. graphql-ws, json"
                aria-label="Subprotocols"
              />
              <span className="te-prop-hint">Comma-separated list of WebSocket subprotocols</span>
            </div>
          </div>

          <div className="te-prop-row">
            <div className="te-prop-label">Timeout</div>
            <div className="te-prop-ctrl">
              <input
                type="number"
                value={cfg.timeoutMs ?? 10000}
                onChange={(e) => updateCfg({ timeoutMs: Number(e.target.value) || undefined })}
                min={0}
                className="te-input-sm"
                aria-label="Connect timeout"
              />
              <span className="te-prop-unit">ms</span>
            </div>
          </div>
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
        <div className="te-prop-card">
          <div className="te-prop-row">
            <div className="te-prop-label">Conn Ref</div>
            <div className="te-prop-ctrl">
              <CustomSelect
                value={cfg.connectionRef ?? ''}
                onChange={(v) => updateCfg({ connectionRef: v || undefined })}
                placeholder="— select a connection —"
                aria-label="Connection reference"
                options={[
                  { value: '', label: '— select a connection —' },
                  ...connectOptions.map((opt) => ({ value: opt.id, label: opt.label })),
                ]}
              />
            </div>
          </div>
          {connectOptions.length === 0 && (
            <div className="te-prop-row">
              <div className="te-prop-label" />
              <div className="te-prop-ctrl">
                <span className="te-prop-warn">
                  {hasConnectTestsWithoutId
                    ? 'Sibling wsConnect tests have no Connection ID set.'
                    : 'No wsConnect tests in this scenario. Add one first.'}
                </span>
              </div>
            </div>
          )}
          {connectOptions.length === 0 && (
            <div className="te-prop-row">
              <div className="te-prop-label">Manual ID</div>
              <div className="te-prop-ctrl">
                <input
                  value={cfg.connectionRef ?? ''}
                  onChange={(e) => updateCfg({ connectionRef: e.target.value || undefined })}
                  placeholder="Connection ID from a wsConnect test"
                  aria-label="Manual connection reference"
                />
              </div>
            </div>
          )}

          <div className="te-prop-row">
            <div className="te-prop-label">Format</div>
            <div className="te-prop-ctrl">
              <CustomSelect
                value={cfg.messageType ?? 'text'}
                onChange={(v) => updateCfg({ messageType: v as 'text' | 'binary' })}
                className="te-input-sm"
                aria-label="Message type"
                options={[
                  { value: 'text', label: 'Text' },
                  { value: 'binary', label: 'Binary' },
                ]}
              />
            </div>
          </div>

          <div className="te-prop-row">
            <div className="te-prop-label">Wait</div>
            <div className="te-prop-ctrl te-prop-ctrl--inline-group">
              <label className="te-checkbox-label">
                <input
                  type="checkbox"
                  checked={cfg.waitForResponse ?? false}
                  onChange={(e) => updateCfg({ waitForResponse: e.target.checked })}
                />
                Wait for response
              </label>
              {cfg.waitForResponse && (
                <>
                  <input
                    type="number"
                    value={cfg.responseTimeoutMs ?? 5000}
                    onChange={(e) => updateCfg({ responseTimeoutMs: Number(e.target.value) || undefined })}
                    min={0}
                    className="te-input-sm"
                    aria-label="Response timeout"
                  />
                  <span className="te-prop-unit">ms</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="te-prop-row te-prop-row--textarea">
          <div className="te-prop-label">Message</div>
          <div className="te-prop-ctrl">
            <textarea
              value={cfg.message}
              onChange={(e) => updateCfg({ message: e.target.value })}
              placeholder='{"type": "subscribe", "channel": "orders"}'
              rows={5}
              spellCheck={false}
              aria-label="Message body"
            />
          </div>
        </div>
        <div className="te-prop-hint-row">Supports {'{{variable}}'} interpolation from data sources</div>
      </div>
    );
  }

  if (wsType === 'wsReceive') {
    const cfg = draft.wsReceiveAction ?? createDefaultWsReceiveAction();
    const updateCfg = (patch: Partial<WsReceiveActionConfig>) =>
      onDraftChange({ ...draft, wsReceiveAction: { ...cfg, ...patch } });

    return (
      <div className="ws-editor">
        <div className="te-prop-card">
          <div className="te-prop-row">
            <div className="te-prop-label">Conn Ref</div>
            <div className="te-prop-ctrl">
              <CustomSelect
                value={cfg.connectionRef ?? ''}
                onChange={(v) => updateCfg({ connectionRef: v || undefined })}
                placeholder="— select a connection —"
                aria-label="Connection reference"
                options={[
                  { value: '', label: '— select a connection —' },
                  ...connectOptions.map((opt) => ({ value: opt.id, label: opt.label })),
                ]}
              />
            </div>
          </div>
          {connectOptions.length === 0 && (
            <div className="te-prop-row">
              <div className="te-prop-label" />
              <div className="te-prop-ctrl">
                <span className="te-prop-warn">
                  {hasConnectTestsWithoutId
                    ? 'Sibling wsConnect tests have no Connection ID set.'
                    : 'No wsConnect tests in this scenario. Add one first.'}
                </span>
              </div>
            </div>
          )}
          {connectOptions.length === 0 && (
            <div className="te-prop-row">
              <div className="te-prop-label">Manual ID</div>
              <div className="te-prop-ctrl">
                <input
                  value={cfg.connectionRef ?? ''}
                  onChange={(e) => updateCfg({ connectionRef: e.target.value || undefined })}
                  placeholder="Connection ID from a wsConnect test"
                  aria-label="Manual connection reference"
                />
              </div>
            </div>
          )}

          <div className="te-prop-row">
            <div className="te-prop-label">Timeout</div>
            <div className="te-prop-ctrl">
              <input
                type="number"
                value={cfg.timeoutMs ?? 10000}
                onChange={(e) => updateCfg({ timeoutMs: Number(e.target.value) || undefined })}
                min={0}
                className="te-input-sm"
                aria-label="Receive timeout"
              />
              <span className="te-prop-unit">ms</span>
            </div>
          </div>
        </div>

        <div className="te-section-card">
          <div className="te-section-header">Match Criteria</div>
          <div className="te-prop-card">
            <div className="te-prop-row">
              <div className="te-prop-label">Contains</div>
              <div className="te-prop-ctrl">
                <input
                  value={cfg.matchCriteria?.contentContains ?? ''}
                  onChange={(e) => updateCfg({
                    matchCriteria: { ...cfg.matchCriteria, contentContains: e.target.value || undefined },
                  })}
                  placeholder="Substring to match in message body"
                  aria-label="Content contains filter"
                />
              </div>
            </div>
            <div className="te-prop-row">
              <div className="te-prop-label">Regex</div>
              <div className="te-prop-ctrl">
                <input
                  value={cfg.matchCriteria?.contentRegex ?? ''}
                  onChange={(e) => updateCfg({
                    matchCriteria: { ...cfg.matchCriteria, contentRegex: e.target.value || undefined },
                  })}
                  placeholder="Regular expression pattern"
                  aria-label="Content regex filter"
                />
              </div>
            </div>
            <div className="te-prop-row">
              <div className="te-prop-label">JSON Path</div>
              <div className="te-prop-ctrl te-prop-ctrl--inline-group">
                <input
                  value={cfg.matchCriteria?.jsonPathMatch ?? ''}
                  onChange={(e) => updateCfg({
                    matchCriteria: { ...cfg.matchCriteria, jsonPathMatch: e.target.value || undefined },
                  })}
                  placeholder="$.type"
                  className="te-input-sm"
                  aria-label="JSONPath to match"
                />
                <span className="te-prop-unit">=</span>
                <input
                  value={cfg.matchCriteria?.jsonPathValue ?? ''}
                  onChange={(e) => updateCfg({
                    matchCriteria: { ...cfg.matchCriteria, jsonPathValue: e.target.value || undefined },
                  })}
                  placeholder="Expected value"
                  className="te-input-sm"
                  aria-label="JSONPath expected value"
                />
              </div>
            </div>
            <div className="te-prop-row">
              <div className="te-prop-label">Frame</div>
              <div className="te-prop-ctrl">
                <CustomSelect
                  value={cfg.matchCriteria?.messageType ?? 'any'}
                  onChange={(v) => {
                    updateCfg({
                      matchCriteria: { ...cfg.matchCriteria, messageType: v === 'any' ? undefined : v as 'text' | 'binary' },
                    });
                  }}
                  className="te-input-sm"
                  aria-label="Frame type filter"
                  options={[
                    { value: 'any', label: 'Any' },
                    { value: 'text', label: 'Text' },
                    { value: 'binary', label: 'Binary' },
                  ]}
                />
              </div>
            </div>
          </div>
        </div>
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
    <div className="te-kv-section">
      <div className="te-kv-header">
        <span>{label}</span>
        <button type="button" className="te-kv-add-btn" onClick={add}>+ Add</button>
      </div>
      {items.length > 0 && (
        <div className="te-kv-table">
          <div className="te-kv-cols">
            <span>Name</span>
            <span>Value</span>
            <span />
          </div>
          {items.map((kv, i) => (
            <div key={i} className="te-kv-row">
              <input value={kv.key} onChange={(e) => update(i, 'key', e.target.value)} placeholder="name" />
              <input value={kv.value} onChange={(e) => update(i, 'value', e.target.value)} placeholder="value" />
              <button type="button" className="te-kv-remove" onClick={() => remove(i)} aria-label={`Remove ${label} ${i + 1}`}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
