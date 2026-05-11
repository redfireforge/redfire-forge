import { useState, useCallback, useRef, useEffect } from 'react';
import type { Mapping } from './types';
import type { MappingProfile } from './utils/mappingProfiles';
import { loadProfiles, saveProfile, deleteProfile, renameProfile } from './utils/mappingProfiles';
import { mapperGallerySamples } from './utils/gallerySamples';
import type { MapperGallerySample } from './utils/gallerySamples';

interface MapperToolbarProps {
  onAutoMap: () => void;
  onClearAll: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  mappingCount: number;
  autoMapCount?: number;
  showPreview?: boolean;
  onTogglePreview?: () => void;
  hasPending?: boolean;
  onAcceptAllPending?: () => void;
  onRejectAllPending?: () => void;
  contextId?: string;
  mappings?: Mapping[];
  onLoadProfile?: (mappings: Mapping[]) => void;
  showCodeView?: boolean;
  onToggleCodeView?: () => void;
  onLoadGallerySample?: (sample: MapperGallerySample) => void;
  hasTraceData?: boolean;
  debugMode?: boolean;
  onToggleDebugMode?: () => void;
  traceErrorCount?: number;
}

export default function MapperToolbar({
  onAutoMap,
  onClearAll,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  mappingCount,
  autoMapCount,
  showPreview,
  onTogglePreview,
  hasPending,
  onAcceptAllPending,
  onRejectAllPending,
  contextId,
  mappings,
  onLoadProfile,
  showCodeView,
  onToggleCodeView,
  onLoadGallerySample,
  hasTraceData,
  debugMode,
  onToggleDebugMode,
  traceErrorCount,
}: MapperToolbarProps) {
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [samplesMenuOpen, setSamplesMenuOpen] = useState(false);
  const samplesRef = useRef<HTMLDivElement>(null);
  const [profiles, setProfiles] = useState<MappingProfile[]>([]);
  const [saveName, setSaveName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  const refreshProfiles = useCallback(() => {
    if (!contextId) return;
    loadProfiles(contextId).then(setProfiles);
  }, [contextId]);

  useEffect(() => {
    if (profileMenuOpen) refreshProfiles();
  }, [profileMenuOpen, refreshProfiles]);

  useEffect(() => {
    if (!profileMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [profileMenuOpen]);

  useEffect(() => {
    if (!samplesMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (samplesRef.current && !samplesRef.current.contains(e.target as Node)) {
        setSamplesMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [samplesMenuOpen]);

  const handleSave = useCallback(async () => {
    if (!contextId || !mappings || !saveName.trim()) return;
    await saveProfile(contextId, saveName.trim(), mappings);
    setSaveName('');
    refreshProfiles();
  }, [contextId, mappings, saveName, refreshProfiles]);

  const handleLoad = useCallback((profile: MappingProfile) => {
    onLoadProfile?.(profile.mappings);
    setProfileMenuOpen(false);
  }, [onLoadProfile]);

  const handleDelete = useCallback(async (profileId: string) => {
    if (!contextId) return;
    await deleteProfile(contextId, profileId);
    refreshProfiles();
  }, [contextId, refreshProfiles]);

  const handleRename = useCallback(async (profileId: string) => {
    if (!contextId || !renameText.trim()) return;
    const result = await renameProfile(contextId, profileId, renameText.trim());
    if (result) {
      setRenamingId(null);
      setRenameText('');
      refreshProfiles();
    }
  }, [contextId, renameText, refreshProfiles]);

  const profilesEnabled = !!contextId && !!mappings && !!onLoadProfile;

  return (
    <div className="dm-toolbar">
      <div className="dm-toolbar-left">
        <button className="dm-toolbar-btn dm-toolbar-btn--primary" onClick={onAutoMap} title="Auto-map matching fields">
          ⚡ Auto-map
          {autoMapCount !== undefined && autoMapCount > 0 && (
            <span className="dm-toolbar-badge">{autoMapCount}</span>
          )}
        </button>
        <button
          className="dm-toolbar-btn"
          onClick={onClearAll}
          disabled={mappingCount === 0}
          title="Clear all mappings"
        >
          ✕ Clear all
        </button>
        {hasPending && onAcceptAllPending && onRejectAllPending && (
          <>
            <button
              className="dm-toolbar-btn dm-toolbar-btn--accept"
              onClick={onAcceptAllPending}
              title="Accept all pending auto-maps"
            >
              ✓ Accept all
            </button>
            <button
              className="dm-toolbar-btn dm-toolbar-btn--reject"
              onClick={onRejectAllPending}
              title="Reject all pending auto-maps"
            >
              ✗ Reject all
            </button>
          </>
        )}
        {onLoadGallerySample && (
          <div className="dm-profile-menu-anchor" ref={samplesRef}>
            <button
              className={`dm-toolbar-btn ${samplesMenuOpen ? 'dm-toolbar-btn--active' : ''}`}
              onClick={() => setSamplesMenuOpen((o) => !o)}
              title="Load a gallery sample"
            >
              📖 Samples
            </button>
            {samplesMenuOpen && (
              <div className="dm-profile-menu dm-samples-menu">
                {mapperGallerySamples.map((sample) => (
                  <button
                    key={sample.id}
                    className="dm-sample-item"
                    onClick={() => { onLoadGallerySample(sample); setSamplesMenuOpen(false); }}
                    title={sample.description}
                  >
                    <span className="dm-sample-name">{sample.name}</span>
                    <span className={`dm-sample-difficulty dm-sample-difficulty--${sample.difficulty}`}>
                      {sample.difficulty}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="dm-toolbar-center">
        {mappingCount > 0 && (
          <span className="dm-toolbar-status">
            {mappingCount} mapping{mappingCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      <div className="dm-toolbar-right">
        {hasTraceData && onToggleDebugMode && (
          <button
            className={`dm-toolbar-btn dm-toolbar-btn--debug ${debugMode ? 'dm-toolbar-btn--active' : ''}`}
            onClick={onToggleDebugMode}
            title={debugMode ? 'Exit debug overlay' : 'Show runtime data flow'}
          >
            🔍 Debug
            {traceErrorCount != null && traceErrorCount > 0 && (
              <span className="dm-toolbar-badge dm-toolbar-badge--error">{traceErrorCount}</span>
            )}
          </button>
        )}
        {profilesEnabled && (
          <div className="dm-profile-menu-anchor" ref={menuRef}>
            <button
              className={`dm-toolbar-btn ${profileMenuOpen ? 'dm-toolbar-btn--active' : ''}`}
              onClick={() => setProfileMenuOpen((o) => !o)}
              title="Mapping profiles"
            >
              📁 Profiles
            </button>
            {profileMenuOpen && (
              <div className="dm-profile-menu">
                <div className="dm-profile-save-row">
                  <input
                    className="dm-profile-save-input"
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    placeholder="Profile name…"
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
                  />
                  <button
                    className="dm-toolbar-btn dm-toolbar-btn--primary dm-profile-save-btn"
                    onClick={handleSave}
                    disabled={!saveName.trim() || mappingCount === 0}
                  >
                    Save
                  </button>
                </div>
                {profiles.length > 0 && (
                  <div className="dm-profile-list">
                    {profiles.map((p) => (
                      <div key={p.id} className="dm-profile-item">
                        {renamingId === p.id ? (
                          <input
                            className="dm-profile-rename-input"
                            value={renameText}
                            onChange={(e) => setRenameText(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleRename(p.id); if (e.key === 'Escape') setRenamingId(null); }}
                            onBlur={() => { handleRename(p.id); setRenamingId(null); setRenameText(''); }}
                            autoFocus
                          />
                        ) : (
                          <>
                            <button
                              className="dm-profile-name"
                              onClick={() => handleLoad(p)}
                              title={`Load "${p.name}" (${p.mappings.length} mappings)`}
                            >
                              {p.name}
                              <span className="dm-profile-count">{p.mappings.length}</span>
                            </button>
                            <button
                              className="dm-btn-icon"
                              onClick={() => { setRenamingId(p.id); setRenameText(p.name); }}
                              title="Rename"
                            >✎</button>
                            <button
                              className="dm-btn-icon dm-profile-delete"
                              onClick={() => handleDelete(p.id)}
                              title="Delete"
                            >×</button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {profiles.length === 0 && (
                  <div className="dm-profile-empty">No saved profiles</div>
                )}
              </div>
            )}
          </div>
        )}
        {onToggleCodeView && (
          <button
            className={`dm-toolbar-btn ${showCodeView ? 'dm-toolbar-btn--active' : ''}`}
            onClick={onToggleCodeView}
            title={showCodeView ? 'Hide code view' : 'Show code view'}
          >
            {'<>'} Code
          </button>
        )}
        {onTogglePreview && (
          <button
            className={`dm-toolbar-btn ${showPreview ? 'dm-toolbar-btn--active' : ''}`}
            onClick={onTogglePreview}
            title={showPreview ? 'Hide preview' : 'Show preview'}
          >
            ⊞ Preview
          </button>
        )}
        <button className="dm-toolbar-btn" onClick={onUndo} disabled={!canUndo} title="Undo (⌘Z)">
          ↩ Undo
        </button>
        <button className="dm-toolbar-btn" onClick={onRedo} disabled={!canRedo} title="Redo (⌘⇧Z)">
          ↪ Redo
        </button>
      </div>
    </div>
  );
}
