import { useState, useCallback, useRef, useEffect } from 'react';
import { CustomSelect } from '../CustomSelect';
import type { Mapping, AdapterCapabilities } from './types';
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
  capabilities?: Required<AdapterCapabilities>;
  onLoadProfile?: (mappings: Mapping[]) => void;
  onApplyProfileDelta?: (mappings: Mapping[]) => void;
  showCodeView?: boolean;
  onToggleCodeView?: () => void;
  showTableView?: boolean;
  onToggleTableView?: () => void;
  showRulesView?: boolean;
  onToggleRulesView?: () => void;
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
  advancedOpen?: boolean;
  onAdvancedOpenChange?: (open: boolean) => void;
  onVerifyAll?: () => void;
  onFetchAndVerify?: () => void;
  autoVerify?: boolean;
  onToggleAutoVerify?: () => void;
  verifyStatus?: 'idle' | 'running' | 'complete';
  verifyPassedCount?: number;
  verifyFailedCount?: number;
  verifyParseErrorCount?: number;
  verifyFailures?: { path: string; expected?: string; actual?: string }[];
  onNavigateToFailure?: (path: string) => void;
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
  capabilities: _capabilities,
  onLoadProfile,
  onApplyProfileDelta,
  showCodeView,
  onToggleCodeView,
  showTableView,
  onToggleTableView,
  showRulesView,
  onToggleRulesView,
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
  advancedOpen: advancedOpenProp,
  onAdvancedOpenChange,
  onVerifyAll,
  onFetchAndVerify,
  autoVerify = false,
  onToggleAutoVerify,
  verifyStatus = 'idle',
  verifyPassedCount = 0,
  verifyFailedCount = 0,
  verifyParseErrorCount = 0,
  verifyFailures = [],
  onNavigateToFailure,
}: MapperToolbarProps) {
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [samplesMenuOpen, setSamplesMenuOpen] = useState(false);
  const [internalAdvancedOpen, setInternalAdvancedOpen] = useState(true);
  const [failureListOpen, setFailureListOpen] = useState(false);
  const [activeFailureIndex, setActiveFailureIndex] = useState(0);
  const failureListRef = useRef<HTMLDivElement>(null);
  const samplesRef = useRef<HTMLDivElement>(null);
  const advancedRef = useRef<HTMLDivElement>(null);
  const [profiles, setProfiles] = useState<MappingProfile[]>([]);
  const [saveName, setSaveName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  const advancedOpen = advancedOpenProp ?? internalAdvancedOpen;
  const setAdvancedOpen = useCallback((next: boolean | ((prev: boolean) => boolean)) => {
    const nextValue = typeof next === 'function' ? next(advancedOpen) : next;
    if (advancedOpenProp === undefined) {
      setInternalAdvancedOpen(nextValue);
    }
    onAdvancedOpenChange?.(nextValue);
  }, [advancedOpen, advancedOpenProp, onAdvancedOpenChange]);

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
  }, [advancedOpen, setAdvancedOpen]);

  useEffect(() => {
    if (advancedOpen) return;
    setProfileMenuOpen(false);
    setSamplesMenuOpen(false);
  }, [advancedOpen]);

  useEffect(() => {
    if (!failureListOpen) return;
    const handler = (e: MouseEvent) => {
      if (failureListRef.current && !failureListRef.current.contains(e.target as Node)) {
        setFailureListOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [failureListOpen]);

  useEffect(() => {
    setActiveFailureIndex(0);
    setFailureListOpen(false);
  }, [verifyFailures.length]);

  const navigateFailure = useCallback((index: number) => {
    if (verifyFailures.length === 0) return;
    const clamped = ((index % verifyFailures.length) + verifyFailures.length) % verifyFailures.length;
    setActiveFailureIndex(clamped);
    onNavigateToFailure?.(verifyFailures[clamped].path);
  }, [verifyFailures, onNavigateToFailure]);

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

  const handleApplyDelta = useCallback((profile: MappingProfile) => {
    onApplyProfileDelta?.(profile.mappings);
    setProfileMenuOpen(false);
  }, [onApplyProfileDelta]);

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

  const profilesEnabled = !!contextId && !!mappings && (!!onLoadProfile || !!onApplyProfileDelta);
  const hasConfidenceControl = !!onConfidenceThresholdChange && (autoMapCount ?? 0) > 0;
  const hasAdvancedControls = hasConfidenceControl
    || !!onLearnFromExamples
    || !!onLoadGallerySample
    || !!(hasTraceData && onToggleDebugMode)
    || profilesEnabled;
  const advancedControlCount = Number(hasConfidenceControl)
    + Number(!!onLearnFromExamples)
    + Number(!!onLoadGallerySample)
    + Number(!!(hasTraceData && onToggleDebugMode))
    + Number(profilesEnabled);
  const resolvedMappings = resolvedCount ?? mappingCount;
  const unresolvedMappings = unresolvedCount ?? Math.max(mappingCount - resolvedMappings, 0);
  const denseSession = mappingCount >= 8 || unresolvedMappings >= 3 || !!hasPending;
  useEffect(() => {
    if (hasAdvancedControls || !advancedOpen) return;
    setAdvancedOpen(false);
  }, [hasAdvancedControls, advancedOpen, setAdvancedOpen]);
  const mappingStatus =
    mappingCount === 0
      ? 'No mappings yet'
      : unresolvedMappings > 0
        ? `${resolvedMappings} mapped, ${unresolvedMappings} unresolved`
        : hasPending
          ? `${resolvedMappings} mapping${resolvedMappings !== 1 ? 's' : ''} pending review`
          : `${resolvedMappings} mapping${resolvedMappings !== 1 ? 's' : ''} ready`;

  return (
    <div className={`dm-toolbar ${compactMode ? 'dm-toolbar--compact' : ''} ${denseSession ? 'dm-toolbar--dense' : ''}`}>
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

      <div className="dm-toolbar-cluster dm-toolbar-cluster--view dm-toolbar-cluster--secondary" aria-label="View controls">
        {onToggleCodeView && (
          <button
            className={`dm-toolbar-btn dm-toolbar-btn--quiet ${showCodeView ? 'dm-toolbar-btn--active' : ''}`}
            onClick={onToggleCodeView}
            title={showCodeView ? 'Hide code view' : 'Show code view'}
          >
            Code
          </button>
        )}
        {onTogglePreview && (
          <button
            className={`dm-toolbar-btn dm-toolbar-btn--quiet ${showPreview ? 'dm-toolbar-btn--active' : ''}`}
            onClick={onTogglePreview}
            title={showPreview ? 'Hide preview' : 'Show preview'}
          >
            Preview
          </button>
        )}
        {onToggleTableView && (
          <button
            className={`dm-toolbar-btn dm-toolbar-btn--quiet ${showTableView ? 'dm-toolbar-btn--active' : ''}`}
            onClick={onToggleTableView}
            title={showTableView ? 'Hide table view' : 'Show mapping table'}
          >
            Table
          </button>
        )}
        {onToggleRulesView && (
          <button
            className={`dm-toolbar-btn dm-toolbar-btn--quiet ${showRulesView ? 'dm-toolbar-btn--active' : ''}`}
            onClick={onToggleRulesView}
            title={showRulesView ? 'Hide rules editor' : 'Edit validation rules as code'}
          >
            Rules
          </button>
        )}
        {onToggleMappingLines && (
          <button
            className={`dm-toolbar-btn dm-toolbar-btn--quiet ${showMappingLines ? 'dm-toolbar-btn--active' : ''}`}
            onClick={onToggleMappingLines}
            title={showMappingLines ? 'Hide mapping lines' : 'Show mapping lines'}
          >
            Lines
          </button>
        )}
        {!showMappingLines && onToggleNodeFocusMode && (
          <button
            className={`dm-toolbar-btn dm-toolbar-btn--quiet ${nodeFocusMode ? 'dm-toolbar-btn--active' : ''}`}
            onClick={onToggleNodeFocusMode}
            title={nodeFocusMode ? 'Disable node-focus lines' : 'Enable node-focus lines'}
          >
            Focus
          </button>
        )}
      </div>

      {onVerifyAll && (
        <div className="dm-toolbar-cluster dm-toolbar-cluster--verify dm-toolbar-cluster--secondary" aria-label="Verification controls">
          <button
            className={`dm-toolbar-btn dm-toolbar-btn--verify ${verifyStatus === 'running' ? 'dm-toolbar-btn--spinning' : ''}`}
            onClick={onVerifyAll}
            disabled={verifyStatus === 'running'}
            title="Verify all rules against sample data"
          >
            {verifyStatus === 'running' ? 'Verifying…' : 'Verify All'}
          </button>
          {onFetchAndVerify && (
            <button
              className={`dm-toolbar-btn dm-toolbar-btn--verify ${verifyStatus === 'running' ? 'dm-toolbar-btn--spinning' : ''}`}
              onClick={onFetchAndVerify}
              disabled={verifyStatus === 'running'}
              title="Fetch live response and verify"
            >
              Fetch & Verify
            </button>
          )}
          {onToggleAutoVerify && (
            <label className="dm-toolbar-toggle" title="Auto-verify on rule changes">
              <input
                type="checkbox"
                checked={autoVerify}
                onChange={onToggleAutoVerify}
              />
              <span className="dm-toolbar-toggle-label">Auto</span>
            </label>
          )}
          {verifyStatus === 'complete' && (
            <span className="dm-toolbar-verify-summary">
              {verifyFailedCount === 0 && verifyParseErrorCount === 0 ? (
                <span className="dm-toolbar-verify-pass">{verifyPassedCount} passed</span>
              ) : (
                <>
                  <span className="dm-toolbar-verify-pass">{verifyPassedCount}</span>
                  {verifyFailedCount > 0 && (
                    <>
                      <span className="dm-toolbar-verify-sep">/</span>
                      <span
                        className="dm-toolbar-verify-fail dm-toolbar-verify-fail--clickable"
                        onClick={() => setFailureListOpen(prev => !prev)}
                        role="button"
                        tabIndex={0}
                        title="Click to see failures"
                      >
                        {verifyFailedCount} failed
                      </span>
                    </>
                  )}
                  {verifyParseErrorCount > 0 && (
                    <>
                      <span className="dm-toolbar-verify-sep">/</span>
                      <span className="dm-toolbar-verify-error" title="DSL parse errors">
                        {verifyParseErrorCount} error{verifyParseErrorCount !== 1 ? 's' : ''}
                      </span>
                    </>
                  )}
                </>
              )}
            </span>
          )}
          {verifyStatus === 'complete' && verifyFailedCount > 0 && onNavigateToFailure && (
            <div className="dm-toolbar-failure-nav">
              <button
                className="dm-toolbar-btn dm-toolbar-btn--icon"
                onClick={() => navigateFailure(activeFailureIndex - 1)}
                title="Previous failure"
                aria-label="Previous failure"
              >
                ▲
              </button>
              <span className="dm-toolbar-failure-counter">
                {activeFailureIndex + 1}/{verifyFailedCount}
              </span>
              <button
                className="dm-toolbar-btn dm-toolbar-btn--icon"
                onClick={() => navigateFailure(activeFailureIndex + 1)}
                title="Next failure"
                aria-label="Next failure"
              >
                ▼
              </button>
              {verifyFailures[activeFailureIndex] && (
                <span className="dm-toolbar-failure-inline" title={verifyFailures[activeFailureIndex].path}>
                  <span className="dm-toolbar-failure-inline-path">{verifyFailures[activeFailureIndex].path}</span>
                  <span className="dm-toolbar-failure-inline-expected">Expected: {verifyFailures[activeFailureIndex].expected ?? '?'}</span>
                  <span className="dm-toolbar-failure-inline-actual">Got: {verifyFailures[activeFailureIndex].actual ?? '?'}</span>
                </span>
              )}
            </div>
          )}
          {failureListOpen && verifyFailures.length > 0 && (
            <div className="dm-toolbar-failure-list" ref={failureListRef}>
              <div className="dm-toolbar-failure-list-header">
                Failed Rules ({verifyFailures.length})
              </div>
              {verifyFailures.map((f, i) => (
                <button
                  key={f.path}
                  className={`dm-toolbar-failure-item ${i === activeFailureIndex ? 'dm-toolbar-failure-item--active' : ''}`}
                  onClick={() => {
                    setActiveFailureIndex(i);
                    onNavigateToFailure?.(f.path);
                    setFailureListOpen(false);
                  }}
                >
                  <span className="dm-toolbar-failure-path">{f.path}</span>
                  <span className="dm-toolbar-failure-detail">
                    <span className="dm-toolbar-failure-expected">Expected: {f.expected ?? '?'}</span>
                    <span className="dm-toolbar-failure-actual">Got: {f.actual ?? '?'}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {hasAdvancedControls && (
        <div className="dm-toolbar-cluster dm-toolbar-cluster--advanced-toggle dm-toolbar-cluster--secondary" ref={advancedRef} aria-label="Advanced controls">
          <button
            className={`dm-toolbar-btn dm-toolbar-btn--quiet ${advancedOpen ? 'dm-toolbar-btn--active' : ''}`}
            onClick={() => setAdvancedOpen((open) => !open)}
            aria-expanded={advancedOpen}
            aria-label="Toggle advanced controls"
            title={advancedOpen ? 'Hide advanced controls' : 'Show advanced controls'}
          >
            Advanced
            {!advancedOpen && advancedControlCount > 0 && (
              <span className="dm-toolbar-advanced-count">
                {advancedControlCount}
              </span>
            )}
          </button>
          {advancedOpen && (
            <div className="dm-toolbar-advanced-panel">
              {hasConfidenceControl && onConfidenceThresholdChange && (
                <CustomSelect
                  className="dm-toolbar-threshold"
                  value={String(confidenceThreshold ?? 50)}
                  onChange={(v) => onConfidenceThresholdChange(Number(v))}
                  options={[
                    { value: '0', label: 'All' },
                    { value: '50', label: '≥ 50%' },
                    { value: '60', label: '≥ 60%' },
                    { value: '75', label: '≥ 75%' },
                    { value: '80', label: '≥ 80%' },
                    { value: '90', label: '≥ 90%' },
                  ]}
                  aria-label="Auto-map confidence threshold"
                />
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
                                  {onLoadProfile ? (
                                    <button
                                      className="dm-profile-name"
                                      onClick={() => handleLoad(p)}
                                      title={`Load "${p.name}" (${p.mappings.length} mappings)`}
                                    >
                                      {p.name}
                                      <span className="dm-profile-count">{p.mappings.length}</span>
                                    </button>
                                  ) : (
                                    <div className="dm-profile-name">
                                      {p.name}
                                      <span className="dm-profile-count">{p.mappings.length}</span>
                                    </div>
                                  )}
                                  {onApplyProfileDelta && (
                                    <button
                                      className="dm-btn-icon"
                                      onClick={() => handleApplyDelta(p)}
                                      title={`Apply "${p.name}" as delta`}
                                    >
                                      +
                                    </button>
                                  )}
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

      <div className="dm-toolbar-cluster dm-toolbar-cluster--history dm-toolbar-cluster--secondary" aria-label="History controls">
        {onToggleCompactMode && (
          <button
            className={`dm-toolbar-btn dm-toolbar-btn--quiet ${compactMode ? 'dm-toolbar-btn--active' : ''}`}
            onClick={onToggleCompactMode}
            title={compactMode ? 'Switch to guided mode' : 'Switch to compact mode'}
          >
            {compactMode ? 'Guided' : 'Compact'}
          </button>
        )}
        <button className="dm-toolbar-btn dm-toolbar-btn--quiet" onClick={onUndo} disabled={!canUndo} title="Undo (⌘Z)">
          Undo
        </button>
        <button className="dm-toolbar-btn dm-toolbar-btn--quiet" onClick={onRedo} disabled={!canRedo} title="Redo (⌘⇧Z)">
          Redo
        </button>
      </div>
    </div>
  );
}
