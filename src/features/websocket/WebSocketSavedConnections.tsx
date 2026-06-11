import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  WsConnectionDraft,
  WsConnectionProfile,
} from '../../shared/websocket/types';
import { formatTimeAgo } from './wsMessageUtils';
import { ProfileEditorModal } from './WsProfileEditorModal';
import type { ProfilePrefillDraft } from './WsProfileEditorModal';

export type { ProfilePrefillDraft } from './WsProfileEditorModal';

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

function headerCount(profile: WsConnectionProfile): number {
  return profile.headers.filter((h) => h.enabled && h.key.trim()).length;
}

function paramCount(profile: WsConnectionProfile): number {
  return profile.queryParams.filter((p) => p.enabled && p.key.trim()).length;
}

// ── Shared UI-state hook (powers both the flat wrapper and the shell rail/detail) ──

export interface SavedUi {
  profiles: WsConnectionProfile[];
  loading: boolean;
  error: string | null;
  filtered: WsConnectionProfile[];
  selectedProfile: WsConnectionProfile | null;
  selectedId: string | null;
  select: (id: string) => void;
  search: string;
  setSearch: (v: string) => void;
  importError: string | null;
  importSuccess: string | null;
  pasteImportOpen: boolean;
  setPasteImportOpen: React.Dispatch<React.SetStateAction<boolean>>;
  pasteJson: string;
  setPasteJson: (v: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  confirmDeleteId: string | null;
  setConfirmDeleteId: (id: string | null) => void;
  editorOpen: boolean;
  editingProfile: WsConnectionProfile | undefined;
  editorPrefill: ProfilePrefillDraft | undefined;
  existingNames: string[];
  handleLoad: (id: string) => void;
  handleEdit: (profile: WsConnectionProfile) => void;
  handleCreate: () => void;
  handleEditorSave: (fields: Omit<WsConnectionProfile, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  handleEditorCancel: () => void;
  handleDelete: (id: string) => Promise<void>;
  handleExport: () => void;
  handleImportClick: () => void;
  handlePasteImport: () => Promise<void>;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  onDuplicateProfile: (id: string) => Promise<void>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWebSocketSavedUi({
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
}: WebSocketSavedConnectionsProps): SavedUi {
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

  // Keep a valid selection: auto-select the first visible profile so the detail
  // pane is populated by default, and clear it when nothing matches.
  useEffect(() => {
    if (filtered.length === 0) {
      if (selectedProfileId !== null) setSelectedProfileId(null);
      return;
    }
    if (selectedProfileId == null || !filtered.some((p) => p.id === selectedProfileId)) {
      setSelectedProfileId(filtered[0].id);
    }
  }, [filtered, selectedProfileId]);

  const selectedProfile = useMemo(
    () => profiles.find((p) => p.id === selectedProfileId) ?? null,
    [profiles, selectedProfileId],
  );

  const select = useCallback((id: string) => setSelectedProfileId(id), []);

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

  const handleEditorCancel = useCallback(() => {
    setEditorOpen(false);
    setEditingProfile(undefined);
    setEditorPrefill(undefined);
  }, []);

  return {
    profiles,
    loading,
    error,
    filtered,
    selectedProfile,
    selectedId: selectedProfileId,
    select,
    search,
    setSearch,
    importError,
    importSuccess,
    pasteImportOpen,
    setPasteImportOpen,
    pasteJson,
    setPasteJson,
    fileInputRef,
    confirmDeleteId,
    setConfirmDeleteId,
    editorOpen,
    editingProfile,
    editorPrefill,
    existingNames,
    handleLoad,
    handleEdit,
    handleCreate,
    handleEditorSave,
    handleEditorCancel,
    handleDelete,
    handleExport,
    handleImportClick,
    handlePasteImport,
    handleFileChange,
    onDuplicateProfile,
  };
}

// ── Rail (left pane): header + search + compact profile list ─────────

const PASTE_PLACEHOLDER =
  'Paste JSON array of profiles, e.g.:\n[\n  { "name": "My Server", "url": "wss://example.com/ws" }\n]';

export function WebSocketSavedRail({ ui }: { ui: SavedUi }) {
  const {
    profiles, loading, error, filtered, selectedId, select,
    search, setSearch, importError, importSuccess,
    pasteImportOpen, setPasteImportOpen, pasteJson, setPasteJson,
    fileInputRef, handleCreate, handleExport, handleImportClick,
    handlePasteImport, handleFileChange,
  } = ui;

  return (
    <div className="ws-saved-rail" data-testid="saved-connections">
      <div className="ws-saved-rail-head">
        <span className="ws-saved-rail-title">Saved Profiles · {profiles.length}</span>
        <div className="ws-saved-rail-head-actions">
          <button
            className="ws-saved-rail-icon-btn"
            onClick={handleImportClick}
            title="Import from file"
            data-testid="import-btn"
          >
            Import
          </button>
          <button
            className="ws-saved-rail-icon-btn"
            onClick={() => { setPasteImportOpen((v) => !v); }}
            title="Paste JSON"
            data-testid="paste-import-btn"
          >
            Paste
          </button>
          <button
            className="ws-saved-rail-icon-btn"
            onClick={handleExport}
            disabled={profiles.length === 0}
            title="Export all profiles"
            data-testid="export-btn"
          >
            Export
          </button>
          <button
            className="ws-connect-btn ws-connect-btn-primary ws-saved-rail-new"
            onClick={handleCreate}
            data-testid="new-profile-btn"
          >
            + New Profile
          </button>
        </div>
      </div>

      <div className="ws-saved-rail-search">
        <input
          className="ws-message-search"
          placeholder="Search profiles..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          data-testid="saved-search"
        />
      </div>

      {error && <div className="ws-connect-error">{error}</div>}
      {importError && <div className="ws-connect-error" data-testid="import-error">{importError}</div>}
      {importSuccess && (
        <div className="ws-saved-success" data-testid="import-success">{importSuccess}</div>
      )}

      {pasteImportOpen && (
        <div className="ws-paste-import-section" data-testid="paste-import-section">
          <textarea
            className="ws-paste-import-textarea"
            value={pasteJson}
            onChange={(e) => setPasteJson(e.target.value)}
            placeholder={PASTE_PLACEHOLDER}
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

      {loading ? (
        <div className="ws-saved-empty" data-testid="saved-loading">Loading profiles...</div>
      ) : filtered.length === 0 ? (
        <div className="ws-saved-empty" data-testid="saved-empty">
          {profiles.length === 0
            ? 'No saved connections. Create one or use Save as Profile from the Connect tab.'
            : 'No profiles match your search.'}
        </div>
      ) : (
        <div className="ws-saved-rail-list" data-testid="saved-list">
          {filtered.map((profile) => (
            <button
              key={profile.id}
              type="button"
              className={`ws-saved-rail-item ${selectedId === profile.id ? 'selected' : ''}`}
              data-testid={`profile-card-${profile.id}`}
              onClick={() => select(profile.id)}
            >
              <span className="ri-title">{profile.name}</span>
              <span className="ri-sub">{profile.url}</span>
            </button>
          ))}
        </div>
      )}

      <span className="ws-saved-count" data-testid="saved-count">
        {profiles.length} saved profile{profiles.length !== 1 ? 's' : ''}
      </span>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleFileChange}
        data-testid="import-file-input"
      />
    </div>
  );
}

// ── Detail (right pane): selected profile summary + actions + editor ─

export function WebSocketSavedDetail({ ui }: { ui: SavedUi }) {
  const {
    selectedProfile, confirmDeleteId, setConfirmDeleteId,
    handleLoad, handleEdit, handleDelete, handleExport, onDuplicateProfile,
    editorOpen, editingProfile, editorPrefill, existingNames,
    handleEditorSave, handleEditorCancel,
  } = ui;

  return (
    <div className="ws-saved-detail" data-testid="saved-detail">
      {selectedProfile ? (
        <SavedDetailCard
          profile={selectedProfile}
          confirmDeleteId={confirmDeleteId}
          setConfirmDeleteId={setConfirmDeleteId}
          handleLoad={handleLoad}
          handleEdit={handleEdit}
          handleDelete={handleDelete}
          handleExport={handleExport}
          onDuplicateProfile={onDuplicateProfile}
        />
      ) : (
        <div className="ws-saved-detail-empty" data-testid="saved-detail-empty">
          Select a profile to view its details.
        </div>
      )}

      {editorOpen && (
        <ProfileEditorModal
          initial={editingProfile}
          prefill={editorPrefill}
          existingNames={existingNames}
          onSave={handleEditorSave}
          onCancel={handleEditorCancel}
        />
      )}
    </div>
  );
}

interface SavedDetailCardProps {
  profile: WsConnectionProfile;
  confirmDeleteId: string | null;
  setConfirmDeleteId: (id: string | null) => void;
  handleLoad: (id: string) => void;
  handleEdit: (profile: WsConnectionProfile) => void;
  handleDelete: (id: string) => Promise<void>;
  handleExport: () => void;
  onDuplicateProfile: (id: string) => Promise<void>;
}

function SavedDetailCard({
  profile,
  confirmDeleteId,
  setConfirmDeleteId,
  handleLoad,
  handleEdit,
  handleDelete,
  handleExport,
  onDuplicateProfile,
}: SavedDetailCardProps) {
  const hCount = headerCount(profile);
  const pCount = paramCount(profile);
  const protocolMode = profile.protocolMode ?? 'auto';

  return (
    <div className="ws-saved-detail-card" data-testid={`profile-detail-${profile.id}`}>
      <div className="ws-saved-detail-head">
        <div className="ws-saved-detail-titlewrap">
          <span className="ws-saved-detail-name">{profile.name}</span>
          {protocolMode !== 'auto' && <span className="ws-saved-tag">{protocolMode}</span>}
        </div>
        <button
          className="ws-connect-btn ws-connect-btn-primary"
          onClick={() => handleLoad(profile.id)}
          data-testid={`load-btn-${profile.id}`}
        >
          Load &amp; Connect
        </button>
      </div>
      <div className="ws-saved-detail-url">{profile.url}</div>

      <div className="ws-saved-detail-toolbar">
        <button
          className="ws-saved-action-btn"
          onClick={() => handleEdit(profile)}
          data-testid={`edit-btn-${profile.id}`}
        >
          Edit
        </button>
        <button
          className="ws-saved-action-btn"
          onClick={() => onDuplicateProfile(profile.id)}
          data-testid={`dup-btn-${profile.id}`}
        >
          Duplicate
        </button>
        <button className="ws-saved-action-btn" onClick={handleExport}>
          Export
        </button>
        <span className="ws-saved-detail-spacer" />
        {confirmDeleteId === profile.id ? (
          <>
            <button
              className="ws-saved-action-btn ws-saved-action-delete"
              onClick={() => handleDelete(profile.id)}
              data-testid={`confirm-delete-${profile.id}`}
            >
              Confirm
            </button>
            <button className="ws-saved-action-btn" onClick={() => setConfirmDeleteId(null)}>
              No
            </button>
          </>
        ) : (
          <button
            className="ws-saved-action-btn ws-saved-action-delete"
            onClick={() => setConfirmDeleteId(profile.id)}
            data-testid={`delete-btn-${profile.id}`}
          >
            Delete
          </button>
        )}
      </div>

      <div className="ws-saved-summary-grid">
        <div className="ws-saved-summary-item">
          <span className="ws-saved-summary-label">Subprotocols</span>
          <span className="ws-saved-summary-value">{profile.subprotocols || '\u2014'}</span>
        </div>
        <div className="ws-saved-summary-item">
          <span className="ws-saved-summary-label">Headers</span>
          <span className="ws-saved-summary-value">
            {hCount > 0 ? `${hCount} header${hCount > 1 ? 's' : ''}` : 'no headers'}
          </span>
        </div>
        <div className="ws-saved-summary-item">
          <span className="ws-saved-summary-label">Query params</span>
          <span className="ws-saved-summary-value">
            {pCount > 0 ? `${pCount} param${pCount > 1 ? 's' : ''}` : 'none'}
          </span>
        </div>
        <div className="ws-saved-summary-item">
          <span className="ws-saved-summary-label">Auto-reconnect</span>
          <span className="ws-saved-summary-value">
            {profile.autoReconnect ? 'auto-reconnect' : 'off'}
          </span>
        </div>
        <div className="ws-saved-summary-item">
          <span className="ws-saved-summary-label">Protocol mode</span>
          <span className="ws-saved-summary-value">{protocolMode}</span>
        </div>
        <div className="ws-saved-summary-item">
          <span className="ws-saved-summary-label">Max messages</span>
          <span className="ws-saved-summary-value">{profile.maxMessages ?? '\u2014'}</span>
        </div>
      </div>

      {(profileHasEnvVars(profile) || profileHasMtls(profile)) && (
        <div className="ws-saved-detail-tags">
          {profileHasEnvVars(profile) && <span className="ws-saved-tag">env vars</span>}
          {profileHasMtls(profile) && <span className="ws-saved-tag">mTLS</span>}
        </div>
      )}

      {profile.notes && (
        <div className="ws-saved-notes">
          <span className="ws-saved-summary-label">Notes</span>
          <p className="ws-saved-notes-text">{profile.notes}</p>
        </div>
      )}

      <span className="ws-saved-detail-updated">Updated {formatTimeAgo(profile.updatedAt)}</span>
    </div>
  );
}

// ── Thin wrapper (legacy flat path + test surface) ──────────────────

export function WebSocketSavedConnections(props: WebSocketSavedConnectionsProps) {
  const ui = useWebSocketSavedUi(props);
  return (
    <div className="ws-saved-flat" data-testid="saved-flat">
      <WebSocketSavedRail ui={ui} />
      <WebSocketSavedDetail ui={ui} />
    </div>
  );
}
