import { useState } from 'react';
import { createPortal } from 'react-dom';
import AppModalFrame from '../../shared/components/AppModalFrame';
import type {
  WsBackoffMultiplier,
  WsConnectionProfile,
  WsKeyValueEntry,
  WsProtocolMode,
} from '../../shared/websocket/types';
import { DEFAULT_BACKOFF_MULTIPLIER, resolveBackoffMultiplier } from '../../shared/websocket/types';
import { isValidWsUrl } from './wsMessageUtils';
import { KeyValueEditor } from './KeyValueEditor';
import { CustomSelect } from '../../shared/components/CustomSelect';

// ── Profile Editor Modal ─────────────────────────────────────────────

export interface ProfilePrefillDraft {
  name?: string;
  url?: string;
  subprotocols?: string;
  headers?: WsKeyValueEntry[];
  queryParams?: WsKeyValueEntry[];
  protocolMode?: WsProtocolMode;
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectIntervalMs?: number;
  backoffMultiplier?: WsBackoffMultiplier;
  maxMessages?: number;
  notes?: string;
}

export interface ProfileEditorProps {
  initial?: WsConnectionProfile;
  prefill?: ProfilePrefillDraft;
  existingNames: string[];
  onSave: (fields: Omit<WsConnectionProfile, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
}

const PROFILE_DEFAULTS: {
  protocolMode: WsProtocolMode;
  autoReconnect: boolean;
  maxReconnectAttempts: number;
  reconnectIntervalMs: number;
  backoffMultiplier: WsBackoffMultiplier;
  maxMessages: number;
} = {
  protocolMode: 'auto',
  autoReconnect: false,
  maxReconnectAttempts: 5,
  reconnectIntervalMs: 3000,
  backoffMultiplier: DEFAULT_BACKOFF_MULTIPLIER,
  maxMessages: 1000,
};

export function ProfileEditorModal({ initial, prefill, existingNames, onSave, onCancel }: ProfileEditorProps) {
  const source = initial ?? prefill;
  const [name, setName] = useState(source?.name ?? prefill?.name ?? '');
  const [url, setUrl] = useState(source?.url ?? prefill?.url ?? 'wss://');
  const [subprotocols, setSubprotocols] = useState(source?.subprotocols ?? prefill?.subprotocols ?? '');
  const [headers, setHeaders] = useState<WsKeyValueEntry[]>(
    source?.headers?.map((h) => ({ ...h })) ?? prefill?.headers?.map((h) => ({ ...h })) ?? [],
  );
  const [queryParams, setQueryParams] = useState<WsKeyValueEntry[]>(
    source?.queryParams?.map((p) => ({ ...p })) ?? prefill?.queryParams?.map((p) => ({ ...p })) ?? [],
  );
  const [autoReconnect, setAutoReconnect] = useState(
    source?.autoReconnect ?? prefill?.autoReconnect ?? PROFILE_DEFAULTS.autoReconnect,
  );
  const [maxAttempts, setMaxAttempts] = useState(
    source?.maxReconnectAttempts ?? prefill?.maxReconnectAttempts ?? PROFILE_DEFAULTS.maxReconnectAttempts,
  );
  const [retryInterval, setRetryInterval] = useState(
    source?.reconnectIntervalMs ?? prefill?.reconnectIntervalMs ?? PROFILE_DEFAULTS.reconnectIntervalMs,
  );
  const [backoffMultiplier, setBackoffMultiplier] = useState<WsBackoffMultiplier>(
    resolveBackoffMultiplier(source?.backoffMultiplier ?? prefill?.backoffMultiplier),
  );
  const [maxMsgs, setMaxMsgs] = useState(
    source?.maxMessages ?? prefill?.maxMessages ?? PROFILE_DEFAULTS.maxMessages,
  );
  const [notes, setNotes] = useState(source?.notes ?? prefill?.notes ?? '');

  const nameTrimmed = name.trim();
  const isDuplicateName = existingNames.some(
    (n) => n.toLowerCase() === nameTrimmed.toLowerCase() && n !== initial?.name,
  );
  const urlValid = isValidWsUrl(url);
  const canSave = nameTrimmed.length > 0 && nameTrimmed.length <= 100 && !isDuplicateName && urlValid;

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      name: nameTrimmed,
      url: url.trim(),
      subprotocols,
      headers,
      queryParams,
      protocolMode: initial?.protocolMode ?? prefill?.protocolMode ?? PROFILE_DEFAULTS.protocolMode,
      autoReconnect,
      maxReconnectAttempts: Math.min(50, Math.max(1, maxAttempts)),
      reconnectIntervalMs: Math.min(60000, Math.max(500, retryInterval)),
      backoffMultiplier,
      maxMessages: Math.min(50000, Math.max(100, maxMsgs)),
      notes: notes.trim() || undefined,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onCancel();
    if (e.key === 'Enter' && canSave && e.target instanceof HTMLInputElement) {
      e.preventDefault();
      handleSave();
    }
  };

  return createPortal(
    <AppModalFrame
      title={initial ? 'Edit Profile' : 'New Profile'}
      onClose={onCancel}
      overlayClassName="ws-editor-overlay"
      dialogClassName="ws-editor-modal"
      headerClassName="ws-editor-header modal-header"
      bodyClassName="ws-editor-body"
      footerClassName="ws-editor-footer"
      titleId="ws-profile-editor-title"
      showExpandButton={false}
      showResizeHandles={false}
      footer={
        <>
          <button className="ws-connect-btn ws-connect-btn-secondary" onClick={onCancel} data-testid="profile-cancel-btn">
            Cancel
          </button>
          <button
            className="ws-connect-btn ws-connect-btn-primary"
            onClick={handleSave}
            disabled={!canSave}
            data-testid="profile-save-btn"
          >
            {initial ? 'Save Changes' : 'Save Profile'}
          </button>
        </>
      }
    >
      <div className="ws-editor-form" onKeyDown={handleKeyDown} data-testid="profile-editor-modal">
          <div className="ws-editor-section-label">Connection Settings</div>
          <div className="ws-editor-field">
            <label className="ws-editor-field-label">Profile Name</label>
            <input
              className="ws-editor-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My WebSocket Server"
              maxLength={100}
              autoFocus
              data-testid="profile-name-input"
            />
            {isDuplicateName && (
              <span className="ws-editor-error">A profile with this name already exists</span>
            )}
          </div>
          <div className="ws-editor-field">
            <label className="ws-editor-field-label">WebSocket URL</label>
            <input
              className="ws-editor-input ws-editor-mono"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="wss://example.com/ws"
              data-testid="profile-url-input"
            />
            {url.trim().length > 0 && !urlValid && (
              <span className="ws-editor-error">URL must start with ws:// or wss://</span>
            )}
          </div>
          <div className="ws-editor-field">
            <label className="ws-editor-field-label">Subprotocols</label>
            <input
              className="ws-editor-input"
              value={subprotocols}
              onChange={(e) => setSubprotocols(e.target.value)}
              placeholder="e.g. graphql-ws, json"
            />
          </div>
          <KeyValueEditor
            entries={headers}
            onChange={setHeaders}
            onDeleteAll={() => setHeaders([])}
            label="Headers"
            sectionClassName="ws-editor-kv-section"
            headerClassName="ws-editor-kv-header"
            labelClassName="ws-editor-field-label"
          />
          <KeyValueEditor
            entries={queryParams}
            onChange={setQueryParams}
            onDeleteAll={() => setQueryParams([])}
            label="Query Parameters"
            sectionClassName="ws-editor-kv-section"
            headerClassName="ws-editor-kv-header"
            labelClassName="ws-editor-field-label"
          />
          <div className="ws-editor-group">
            <label className="ws-editor-toggle">
              <input
                type="checkbox"
                className="ws-editor-toggle-checkbox"
                checked={autoReconnect}
                onChange={(e) => setAutoReconnect(e.target.checked)}
              />
              <span className="ws-editor-toggle-text">
                <span className="ws-editor-toggle-title">Auto-reconnect on unexpected disconnect</span>
                <span className="ws-editor-toggle-sub">
                  Automatically retry when the connection drops (close code ≠ 1000)
                </span>
              </span>
            </label>
            <div className={`ws-reconnect-settings-row ws-editor-reconnect-row${autoReconnect ? '' : ' ws-reconnect-settings-disabled'}`}>
              <div className="ws-editor-inline-field">
                <label className="ws-editor-field-label">Max Attempts</label>
                <input
                  type="number"
                  className="ws-editor-input ws-editor-input-sm"
                  value={maxAttempts}
                  onChange={(e) => setMaxAttempts(Number(e.target.value) || 5)}
                  min={1}
                  max={50}
                  disabled={!autoReconnect}
                />
              </div>
              <div className="ws-editor-inline-field">
                <label className="ws-editor-field-label">Retry Interval (ms)</label>
                <input
                  type="number"
                  className="ws-editor-input ws-editor-input-sm"
                  value={retryInterval}
                  onChange={(e) => setRetryInterval(Number(e.target.value) || 3000)}
                  min={500}
                  max={60000}
                  step={500}
                  disabled={!autoReconnect}
                />
              </div>
              <div className="ws-editor-inline-field">
                <label className="ws-editor-field-label">Backoff Multiplier</label>
                <CustomSelect
                  className="ws-editor-input ws-editor-input-sm"
                  value={String(backoffMultiplier)}
                  onChange={(v) => setBackoffMultiplier(Number(v) as WsBackoffMultiplier)}
                  options={[
                    { value: '1', label: 'None (fixed interval)' },
                    { value: '1.5', label: '1.5×' },
                    { value: '2', label: '2× (recommended)' },
                  ]}
                  disabled={!autoReconnect}
                  aria-label="Backoff multiplier"
                />
              </div>
            </div>
          </div>
          <div className="ws-editor-field">
            <label className="ws-editor-field-label">Max Messages</label>
            <input
              type="number"
              className="ws-editor-input ws-editor-input-sm"
              value={maxMsgs}
              onChange={(e) => setMaxMsgs(Number(e.target.value) || PROFILE_DEFAULTS.maxMessages)}
              min={100}
              max={50000}
            />
          </div>
          <div className="ws-editor-field">
            <label className="ws-editor-field-label">Notes</label>
            <textarea
              className="ws-editor-textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
              maxLength={500}
              rows={2}
            />
          </div>
        </div>
    </AppModalFrame>,
    document.body,
  );
}
