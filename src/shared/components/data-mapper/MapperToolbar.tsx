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
  resolvedCount?: number;
  unresolvedCount?: number;
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
  confidenceThreshold?: number;
  onConfidenceThresholdChange?: (value: number) => void;
  onLearnFromExamples?: () => void;
  showMappingLines?: boolean;
  onToggleMappingLines?: () => void;
  nodeFocusMode?: boolean;
  onToggleNodeFocusMode?: () => void;
  compactMode?: boolean;
  onToggleCompactMode?: () => void;
}

export default function MapperToolbar({
  onAutoMap,
  onClearAll,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  mappingCount,
  resolvedCount,
  unresolvedCount,
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
  confidenceThreshold,
  onConfidenceThresholdChange,
  onLearnFromExamples,
  showMappingLines = true,
  onToggleMappingLines,
  nodeFocusMode = false,
  onToggleNodeFocusMode,
  compactMode = false,
  onToggleCompactMode,
}: MapperToolbarProps) {
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [samplesMenuOpen, setSamplesMenuOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(true);
  const samplesRef = useRef<HTMLDivElement>(null);
  const advancedRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (!advancedOpen) return;
    const handler = (e: MouseEvent) => {
      if (advancedRef.current && !advancedRef.current.contains(e.target as Node)) {
        setAdvancedOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [advancedOpen]);

  useEffect(() => {
    if (advancedOpen) return;
    setProfileMenuOpen(false);
    setSamplesMenuOpen(false);
  }, [advancedOpen]);

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
  const hasConfidenceControl = !!onConfidenceThresholdChange && (autoMapCount ?? 0) > 0;
  const hasAdvancedControls = hasConfidenceControl
    || !!onLearnFromExamples
    || !!onLoadGallerySample
    || !!(hasTraceData && onToggleDebugMode)
    || profilesEnabled;
  const resolvedMappings = resolvedCount ?? mappingCount;
  const unresolvedMappings = unresolvedCount ?? Math.max(mappingCount - resolvedMappings, 0);
  const mappingStatus =
    mappingCount === 0
      ? 'No mappings yet'
      : unresolvedMappings > 0
        ? `${resolvedMappings} mapped, ${unresolvedMappings} unresolved`
        : hasPending
          ? `${resolvedMappings} mapping${resolvedMappings !== 1 ? 's' : ''} pending review`
          : `${resolvedMappings} mapping${resolvedMappings !== 1 ? 's' : ''} ready`;

  return (
    <div className={`dm-toolbar ${compactMode ? 'dm-toolbar--compact' : ''}`}>
      <div className="dm-toolbar-cluster dm-toolbar-cluster--core" aria-label="Core mapping controls">
        <button className="dm-toolbar-btn dm-toolbar-btn--primary" onClick={onAutoMap} title="Auto-map matching fields">
          Auto-map
          {autoMapCount !== undefined && autoMapCount > 0 && (
            <span className="dm-toolbar-badge">{autoMapCount}</span>
          )}
        </button>
        <button
          className="dm-toolbar-btn dm-toolbar-btn--danger"
          onClick={onClearAll}
          disabled={mappingCount === 0}
          title="Clear all mappings"
        >
          Clear all
        </button>
        {hasPending && onAcceptAllPending && onRejectAllPending && (
          <>
            <button
              className="dm-toolbar-btn dm-toolbar-btn--accept"
              onClick={onAcceptAllPending}
              title="Accept all pending auto-maps"
            >
              Accept all
            </button>
            <button
              className="dm-toolbar-btn dm-toolbar-btn--reject"
              onClick={onRejectAllPending}
              title="Reject all pending auto-maps"
            >
              Reject all
            </button>
          </>
        )}
      </div>

      <div className="dm-toolbar-status-lane">
        <span className="dm-toolbar-status">{mappingStatus}</span>
      </div>

      <div className="dm-toolbar-cluster dm-toolbar-cluster--view" aria-label="View controls">
        {onToggleCodeView && (
          <button
            className={`dm-toolbar-btn ${showCodeView ? 'dm-toolbar-btn--active' : ''}`}
            onClick={onToggleCodeView}
            title={showCodeView ? 'Hide code view' : 'Show code view'}
          >
            Code
          </button>
        )}
        {onTogglePreview && (
          <button
            className={`dm-toolbar-btn ${showPreview ? 'dm-toolbar-btn--active' : ''}`}
            onClick={onTogglePreview}
            title={showPreview ? 'Hide preview' : 'Show preview'}
          >
            Preview
          </button>
        )}
        {onToggleMappingLines && (
          <button
            className={`dm-toolbar-btn ${showMappingLines ? 'dm-toolbar-btn--active' : ''}`}
            onClick={onToggleMappingLines}
            title={showMappingLines ? 'Hide mapping lines' : 'Show mapping lines'}
          >
            Lines
          </button>
        )}
        {!showMappingLines && onToggleNodeFocusMode && (
          <button
            className={`dm-toolbar-btn ${nodeFocusMode ? 'dm-toolbar-btn--active' : ''}`}
            onClick={onToggleNodeFocusMode}
            title={nodeFocusMode ? 'Disable node-focus lines' : 'Enable node-focus lines'}
          >
            Focus
          </button>
        )}
      </div>

      {hasAdvancedControls && (
        <div className="dm-toolbar-cluster dm-toolbar-cluster--advanced-toggle" ref={advancedRef} aria-label="Advanced controls">
          <button
            className={`dm-toolbar-btn ${advancedOpen ? 'dm-toolbar-btn--active' : ''}`}
            onClick={() => setAdvancedOpen((open) => !open)}
            aria-expanded={advancedOpen}
            aria-label="Toggle advanced controls"
            title={advancedOpen ? 'Hide advanced controls' : 'Show advanced controls'}
          >
            Advanced
          </button>
          {advancedOpen && (
            <div className="dm-toolbar-advanced-panel">
              {hasConfidenceControl && onConfidenceThresholdChange && (
                <select
                  className="dm-toolbar-threshold"
                  value={confidenceThreshold ?? 50}
                  onChange={(e) => onConfidenceThresholdChange(Number(e.target.value))}
                  title="Minimum confidence for auto-map suggestions"
                  aria-label="Auto-map confidence threshold"
                >
                  <option value={0}>All</option>
                  <option value={50}>≥ 50%</option>
                  <option value={60}>≥ 60%</option>
                  <option value={75}>≥ 75%</option>
                  <option value={80}>≥ 80%</option>
                  <option value={90}>≥ 90%</option>
                </select>
              )}
              {onLearnFromExamples && (
                <button
                  className="dm-toolbar-btn"
                  onClick={onLearnFromExamples}
                  title="Infer mappings from input/output examples"
                >
                  Examples
                </button>
              )}
              {onLoadGallerySample && (
                <div className="dm-profile-menu-anchor" ref={samplesRef}>
                  <button
                    className={`dm-toolbar-btn ${samplesMenuOpen ? 'dm-toolbar-btn--active' : ''}`}
                    onClick={() => setSamplesMenuOpen((o) => !o)}
                    title="Load a gallery sample"
                  >
                    Samples
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
              {hasTraceData && onToggleDebugMode && (
                <button
                  className={`dm-toolbar-btn dm-toolbar-btn--debug ${debugMode ? 'dm-toolbar-btn--active' : ''}`}
                  onClick={onToggleDebugMode}
                  title={debugMode ? 'Exit debug overlay' : 'Show runtime data flow'}
                >
                  Debug
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
                    Profiles
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
            </div>
          )}
        </div>
      )}

      <div className="dm-toolbar-cluster dm-toolbar-cluster--history" aria-label="History controls">
        {onToggleCompactMode && (
          <button
            className={`dm-toolbar-btn ${compactMode ? 'dm-toolbar-btn--active' : ''}`}
            onClick={onToggleCompactMode}
            title={compactMode ? 'Switch to guided mode' : 'Switch to compact mode'}
          >
            {compactMode ? 'Guided' : 'Compact'}
          </button>
        )}
        <button className="dm-toolbar-btn" onClick={onUndo} disabled={!canUndo} title="Undo (⌘Z)">
          Undo
        </button>
        <button className="dm-toolbar-btn" onClick={onRedo} disabled={!canRedo} title="Redo (⌘⇧Z)">
          Redo
        </button>
      </div>
    </div>
  );
}
