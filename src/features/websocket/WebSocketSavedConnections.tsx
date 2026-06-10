import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  WsBackoffMultiplier,
  WsConnectionDraft,
  WsConnectionProfile,
  WsKeyValueEntry,
  WsProtocolMode,
} from '../../shared/websocket/types';
import { DEFAULT_BACKOFF_MULTIPLIER, resolveBackoffMultiplier } from '../../shared/websocket/types';
import { formatTimeAgo, isValidWsUrl } from './wsMessageUtils';
import { KeyValueEditor } from './KeyValueEditor';

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

interface ProfileEditorProps {
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

function ProfileEditorModal({ initial, prefill, existingNames, onSave, onCancel }: ProfileEditorProps) {
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

  return (
    <div className="ws-editor-overlay" onKeyDown={handleKeyDown} onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }} data-testid="profile-editor-modal">
      <div className="ws-editor-modal">
        <div className="ws-editor-header">
          <span className="ws-editor-title">{initial ? 'Edit Profile' : 'New Profile'}</span>
        </div>
        <div className="ws-editor-body">
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
            label="Headers"
            sectionClassName="ws-editor-kv-section"
            headerClassName="ws-editor-kv-header"
            labelClassName="ws-editor-field-label"
          />
          <KeyValueEditor
            entries={queryParams}
            onChange={setQueryParams}
            label="Query Parameters"
            sectionClassName="ws-editor-kv-section"
            headerClassName="ws-editor-kv-header"
            labelClassName="ws-editor-field-label"
          />
          <div className="ws-editor-row">
            <label className="ws-editor-toggle-label">
              <input
                type="checkbox"
                checked={autoReconnect}
                onChange={(e) => setAutoReconnect(e.target.checked)}
              />
              <span>
                Auto-reconnect on unexpected disconnect
                <span className="ws-reconnect-label-sub">
                  Automatically retry when the connection drops (close code ≠ 1000)
                </span>
              </span>
            </label>
          </div>
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
              <select
                className="ws-editor-input ws-editor-input-sm"
                value={backoffMultiplier}
                onChange={(e) => setBackoffMultiplier(Number(e.target.value) as WsBackoffMultiplier)}
                disabled={!autoReconnect}
              >
                <option value={1}>None (fixed interval)</option>
                <option value={1.5}>1.5×</option>
                <option value={2}>2× (recommended)</option>
              </select>
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
        <div className="ws-editor-footer">
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
        </div>
      </div>
    </div>
  );
}

// ── Main Saved Connections Component ─────────────────────────────────

export interface WebSocketSavedConnectionsProps {
  profiles: WsConnectionProfile[];
  loading: boolean;
  error: string | null;
  onSaveProfile: (fields: Omit<WsConnectionProfile, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdateProfile: (id: string, patch: Partial<WsConnectionProfile>) => Promise<void>;
  onDeleteProfile: (id: string) => Promise<void>;
  onDuplicateProfile: (id: string) => Promise<void>;
  onImportProfiles: (json: string) => Promise<{ imported: number; errors: string[] }>;
  onExportProfiles: () => string;
  onLoadProfile: (id: string) => WsConnectionDraft | null;
  onApplyDraft: (draft: WsConnectionDraft) => void;
  onSwitchToConnect: () => void;
  prefillDraft?: ProfilePrefillDraft | null;
  onPrefillDraftConsumed?: () => void;
}

function profileHasEnvVars(profile: WsConnectionProfile): boolean {
  if (profile.url.includes('{{')) return true;
  if (profile.headers.some((h) => h.value.includes('{{') || h.key.includes('{{'))) return true;
  return profile.queryParams.some((p) => p.value.includes('{{') || p.key.includes('{{'));
}

function profileHasMtls(profile: WsConnectionProfile): boolean {
  return !!(profile.tlsConfig?.clientCert && profile.tlsConfig?.clientKey);
}

export function WebSocketSavedConnections({
  profiles,
  loading,
  error,
  onSaveProfile,
  onUpdateProfile,
  onDeleteProfile,
  onDuplicateProfile,
  onImportProfiles,
  onExportProfiles,
  onLoadProfile,
  onApplyDraft,
  onSwitchToConnect,
  prefillDraft,
  onPrefillDraftConsumed,
}: WebSocketSavedConnectionsProps) {
  const [search, setSearch] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<WsConnectionProfile | undefined>(undefined);
  const [editorPrefill, setEditorPrefill] = useState<ProfilePrefillDraft | undefined>(undefined);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [pasteImportOpen, setPasteImportOpen] = useState(false);
  const [pasteJson, setPasteJson] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (prefillDraft) {
      setEditingProfile(undefined);
      setEditorPrefill(prefillDraft);
      setEditorOpen(true);
      onPrefillDraftConsumed?.();
    }
  }, [prefillDraft, onPrefillDraftConsumed]);

  const existingNames = useMemo(() => profiles.map((p) => p.name), [profiles]);

  const filtered = useMemo(() => {
    if (!search.trim()) return profiles;
    const needle = search.toLowerCase();
    return profiles.filter(
      (p) => p.name.toLowerCase().includes(needle) || p.url.toLowerCase().includes(needle),
    );
  }, [profiles, search]);

  const handleLoad = useCallback(
    (id: string) => {
      const draft = onLoadProfile(id);
      if (draft) {
        onApplyDraft(draft);
        onSwitchToConnect();
      }
    },
    [onLoadProfile, onApplyDraft, onSwitchToConnect],
  );

  const handleEdit = useCallback((profile: WsConnectionProfile) => {
    setEditingProfile(profile);
    setEditorPrefill(undefined);
    setEditorOpen(true);
  }, []);

  const handleCreate = useCallback(() => {
    setEditingProfile(undefined);
    setEditorPrefill(undefined);
    setEditorOpen(true);
  }, []);

  const handleEditorSave = useCallback(
    async (fields: Omit<WsConnectionProfile, 'id' | 'createdAt' | 'updatedAt'>) => {
      if (editingProfile) {
        await onUpdateProfile(editingProfile.id, fields);
      } else {
        await onSaveProfile(fields);
      }
      setEditorOpen(false);
      setEditingProfile(undefined);
      setEditorPrefill(undefined);
    },
    [editingProfile, onUpdateProfile, onSaveProfile],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await onDeleteProfile(id);
      setConfirmDeleteId(null);
      if (selectedProfileId === id) setSelectedProfileId(null);
    },
    [onDeleteProfile, selectedProfileId],
  );

  const handleExport = useCallback(() => {
    const json = onExportProfiles();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ws-profiles-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [onExportProfiles]);

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handlePasteImport = useCallback(async () => {
    const trimmed = pasteJson.trim();
    if (!trimmed) return;
    setImportError(null);
    setImportSuccess(null);
    try {
      const result = await onImportProfiles(trimmed);
      if (result.errors.length > 0) {
        setImportError(`${result.errors.length} items skipped: ${result.errors[0]}`);
      }
      if (result.imported > 0) {
        setImportSuccess(`Imported ${result.imported} profile${result.imported > 1 ? 's' : ''}`);
        setPasteJson('');
        setPasteImportOpen(false);
      } else if (result.errors.length === 0) {
        setImportError('No profiles found in the JSON array');
      }
    } catch {
      setImportError('Failed to parse JSON');
    }
  }, [pasteJson, onImportProfiles]);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setImportError(null);
      setImportSuccess(null);
      try {
        const text = await file.text();
        const result = await onImportProfiles(text);
        if (result.errors.length > 0) {
          setImportError(`${result.errors.length} items skipped: ${result.errors[0]}`);
        }
        if (result.imported > 0) {
          setImportSuccess(`Imported ${result.imported} profile${result.imported > 1 ? 's' : ''}`);
        } else if (result.errors.length === 0) {
          setImportError('No profiles found in the file');
        }
      } catch {
        setImportError('Failed to read file');
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [onImportProfiles],
  );

  const headerCount = (profile: WsConnectionProfile) => {
    const count = profile.headers.filter((h) => h.enabled && h.key.trim()).length;
    return count;
  };

  const paramCount = (profile: WsConnectionProfile) => {
    const count = profile.queryParams.filter((p) => p.enabled && p.key.trim()).length;
    return count > 0 ? `${count} param${count > 1 ? 's' : ''}` : null;
  };

  if (loading) {
    return (
      <div className="ws-saved-container" data-testid="saved-loading">
        <div className="ws-saved-empty">Loading profiles...</div>
      </div>
    );
  }

  return (
    <div className="ws-saved-container" data-testid="saved-connections">
      <div className="ws-saved-header">
        <h2 className="ws-saved-title">Saved Connections</h2>
        <input
          className="ws-message-search"
          placeholder="Search profiles..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          data-testid="saved-search"
        />
        <button
          className="ws-connect-btn ws-connect-btn-primary"
          onClick={handleCreate}
          data-testid="new-profile-btn"
        >
          + New Profile
        </button>
      </div>

      {error && <div className="ws-connect-error">{error}</div>}
      {importError && <div className="ws-connect-error" data-testid="import-error">{importError}</div>}
      {importSuccess && (
        <div className="ws-saved-success" data-testid="import-success">{importSuccess}</div>
      )}

      {filtered.length === 0 ? (
        <div className="ws-saved-empty" data-testid="saved-empty">
          {profiles.length === 0
            ? 'No saved connections. Create one or use Save as Profile from the Connect tab.'
            : 'No profiles match your search.'}
        </div>
      ) : (
        <div className="ws-saved-list" data-testid="saved-list">
          {filtered.map((profile) => {
            const hCount = headerCount(profile);
            const pCount = paramCount(profile);
            const isSelected = selectedProfileId === profile.id;
            return (
            <div
              className={`ws-saved-card ${isSelected ? 'selected' : ''}`}
              key={profile.id}
              data-testid={`profile-card-${profile.id}`}
              onClick={() => setSelectedProfileId(profile.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') setSelectedProfileId(profile.id); }}
            >
              <div className="ws-saved-card-main">
                <div className="ws-saved-card-name">{profile.name}</div>
                <div className="ws-saved-card-url">{profile.url}</div>
                <div className="ws-saved-card-tags">
                  {hCount > 0 && (
                    <span className="ws-saved-tag">{hCount} header{hCount > 1 ? 's' : ''}</span>
                  )}
                  {hCount === 0 && (
                    <span className="ws-saved-tag">no headers</span>
                  )}
                  {pCount && (
                    <span className="ws-saved-tag">{pCount}</span>
                  )}
                  {profileHasEnvVars(profile) && (
                    <span className="ws-saved-tag">env vars</span>
                  )}
                  {profileHasMtls(profile) && (
                    <span className="ws-saved-tag">mTLS</span>
                  )}
                  {profile.autoReconnect && (
                    <span className="ws-saved-tag">auto-reconnect</span>
                  )}
                  {profile.subprotocols && (
                    <span className="ws-saved-tag">{profile.subprotocols}</span>
                  )}
                  <span className="ws-saved-card-updated">Updated {formatTimeAgo(profile.updatedAt)}</span>
                </div>
              </div>
              <div className="ws-saved-card-actions" onClick={(e) => e.stopPropagation()}>
                <button
                  className="ws-saved-action-btn"
                  onClick={() => handleLoad(profile.id)}
                  title="Load into Connect tab"
                  data-testid={`load-btn-${profile.id}`}
                >
                  Load
                </button>
                <button
                  className="ws-saved-action-btn"
                  onClick={() => handleEdit(profile)}
                  title="Edit profile"
                  data-testid={`edit-btn-${profile.id}`}
                >
                  Edit
                </button>
                <button
                  className="ws-saved-action-btn"
                  onClick={() => onDuplicateProfile(profile.id)}
                  title="Duplicate profile"
                  data-testid={`dup-btn-${profile.id}`}
                >
                  Dup
                </button>
                {confirmDeleteId === profile.id ? (
                  <>
                    <button
                      className="ws-saved-action-btn ws-saved-action-delete"
                      onClick={() => handleDelete(profile.id)}
                      data-testid={`confirm-delete-${profile.id}`}
                    >
                      Confirm
                    </button>
                    <button
                      className="ws-saved-action-btn"
                      onClick={() => setConfirmDeleteId(null)}
                    >
                      No
                    </button>
                  </>
                ) : (
                  <button
                    className="ws-saved-action-btn ws-saved-action-delete"
                    onClick={() => setConfirmDeleteId(profile.id)}
                    title="Delete profile"
                    data-testid={`delete-btn-${profile.id}`}
                  >
                    Del
                  </button>
                )}
              </div>
            </div>
            );
          })}
        </div>
      )}

      <div className="ws-saved-footer">
        <span className="ws-saved-count" data-testid="saved-count">
          {profiles.length} saved profile{profiles.length !== 1 ? 's' : ''}
        </span>
        <button className="ws-connect-btn ws-connect-btn-secondary" onClick={handleImportClick} data-testid="import-btn">
          Import File
        </button>
        <button
          className="ws-connect-btn ws-connect-btn-secondary"
          onClick={() => { setPasteImportOpen((v) => !v); setImportError(null); setImportSuccess(null); }}
          data-testid="paste-import-btn"
        >
          Paste JSON
        </button>
        <button
          className="ws-connect-btn ws-connect-btn-secondary"
          onClick={handleExport}
          disabled={profiles.length === 0}
          data-testid="export-btn"
        >
          Export All
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={handleFileChange}
          data-testid="import-file-input"
        />
      </div>

      {pasteImportOpen && (
        <div className="ws-paste-import-section" data-testid="paste-import-section">
          <textarea
            className="ws-paste-import-textarea"
            value={pasteJson}
            onChange={(e) => setPasteJson(e.target.value)}
            placeholder={'Paste JSON array of profiles, e.g.:\n[\n  { "name": "My Server", "url": "wss://example.com/ws" }\n]'}
            rows={6}
            data-testid="paste-import-textarea"
          />
          <div className="ws-paste-import-actions">
            <button
              className="ws-connect-btn ws-connect-btn-primary"
              onClick={handlePasteImport}
              disabled={!pasteJson.trim()}
              data-testid="paste-import-submit"
            >
              Import
            </button>
            <button
              className="ws-connect-btn ws-connect-btn-secondary"
              onClick={() => { setPasteImportOpen(false); setPasteJson(''); }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {editorOpen && (
        <ProfileEditorModal
          initial={editingProfile}
          prefill={editorPrefill}
          existingNames={existingNames}
          onSave={handleEditorSave}
          onCancel={() => {
            setEditorOpen(false);
            setEditingProfile(undefined);
            setEditorPrefill(undefined);
          }}
        />
      )}
    </div>
  );
}
