import { useState, useMemo, useCallback, useEffect } from 'react';
import type { RulesVersion, ValidationConfig, ExpectedField, Assertion } from '../../../shared/types';
import { buildRulesSnapshot } from '../utils/versionUtils';
import { serializeToDsl } from '../../../shared/components/data-mapper/utils/validationDsl';
import { Differ, Viewer } from 'json-diff-kit';
import 'json-diff-kit/dist/viewer.css';
import 'json-diff-kit/dist/viewer-monokai.css';

interface Props {
  versions: RulesVersion[];
  currentValidation: ValidationConfig;
  onSaveVersion: () => void;
  onRestore: (version: RulesVersion) => void;
  onDeleteVersion: (id: string) => void;
  onRenameVersion: (id: string, label: string) => void;
}

function rulesFingerprint(
  mode: string,
  selectiveMode: string,
  fields: ExpectedField[],
  excluded: string[],
  unordered: boolean,
  assertions: Assertion[],
): string {
  const sortedFields = [...fields].sort((a, b) => a.jsonPath.localeCompare(b.jsonPath));
  const sortedPaths = [...excluded].sort();
  const sortedAssertions = [...assertions].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return JSON.stringify({ mode, selectiveMode, fields: sortedFields, excluded: sortedPaths, unordered, assertions: sortedAssertions });
}

const differ = new Differ({
  detectCircular: false,
  maxDepth: Infinity,
  showModifications: true,
  arrayDiffMethod: 'lcs',
});

export default function RulesVersionPanel({
  versions,
  currentValidation,
  onSaveVersion,
  onRestore,
  onDeleteVersion,
  onRenameVersion,
}: Props) {
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [labelText, setLabelText] = useState('');
  const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false);
  const [compareLeft, setCompareLeft] = useState<string | null>(null);
  const [compareRight, setCompareRight] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const sorted = useMemo(() => [...versions].sort((a, b) => b.timestamp - a.timestamp), [versions]);

  useEffect(() => {
    if (!showModal) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowModal(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showModal]);

  const diffResult = useMemo(() => {
    if (!showModal || !compareLeft || !compareRight || compareLeft === compareRight) return null;
    const lv = versions.find((v) => v.id === compareLeft);
    const rv = versions.find((v) => v.id === compareRight);
    if (!lv || !rv) return null;
    try {
      return differ.diff(buildRulesSnapshot(lv), buildRulesSnapshot(rv));
    } catch {
      return null;
    }
  }, [showModal, compareLeft, compareRight, versions]);

  const isIdentical = useMemo(() => {
    if (!diffResult) return false;
    return diffResult.every(segment => segment.every(line => line.type === 'equal'));
  }, [diffResult]);

  const getVersionLabel = (v: RulesVersion, idx: number) => {
    const num = sorted.length - idx;
    return v.label || `r${num}`;
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const currentFingerprint = useMemo(() => {
    const v = currentValidation;
    return rulesFingerprint(
      v.mode || 'none',
      v.selectiveMode || 'include',
      v.expectedFields || [],
      v.excludedPaths || [],
      !!v.unorderedArrays,
      v.assertions || [],
    );
  }, [currentValidation]);

  const hasRules = (currentValidation.expectedFields || []).length > 0 || (currentValidation.assertions || []).length > 0;

  /** Check ALL versions for a duplicate. Returns matching version label or null. */
  const duplicateOfLabel = useMemo(() => {
    if (sorted.length === 0 || !hasRules) return null;
    for (let i = 0; i < sorted.length; i++) {
      const ver = sorted[i];
      const verFp = rulesFingerprint(
        ver.validationMode || 'none',
        ver.selectiveMode || 'include',
        ver.expectedFields || [],
        ver.excludedPaths || [],
        !!ver.unorderedArrays,
        ver.assertions || [],
      );
      if (currentFingerprint === verFp) return getVersionLabel(ver, i);
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- getVersionLabel depends on sorted which is already a dep
  }, [sorted, currentFingerprint, hasRules]);

  const handleSaveClick = useCallback(() => {
    if (duplicateOfLabel) {
      setShowDuplicateConfirm(true);
    } else {
      onSaveVersion();
    }
  }, [duplicateOfLabel, onSaveVersion]);

  const openCompare = () => {
    if (sorted.length >= 2) {
      setCompareLeft(sorted[1].id);
      setCompareRight(sorted[0].id);
    }
    setShowModal(true);
  };

  const rulesDescription = (v: RulesVersion) => {
    const parts: string[] = [];
    if (v.validationMode && v.validationMode !== 'none') parts.push(v.validationMode);
    if (v.selectiveMode) parts.push(v.selectiveMode);
    const fieldCount = (v.expectedFields || []).length;
    if (fieldCount) parts.push(`${fieldCount} rule${fieldCount > 1 ? 's' : ''}`);
    const exCount = (v.excludedPaths || []).length;
    if (exCount) parts.push(`${exCount} excluded`);
    if (v.unorderedArrays) parts.push('unordered');
    return parts.join(' · ') || 'empty';
  };

  if (!hasRules && sorted.length === 0) {
    return null; // Don't render the panel if there are no rules and no saved versions
  }

  if (sorted.length === 0) {
    return (
      <div className="rules-version-panel">
        <div className="rules-version-panel-header">
          <h4>Rules Versions</h4>
          {hasRules && (
            <button type="button" className="btn btn-sm btn-accent" onClick={onSaveVersion}>
              Save Rules Version
            </button>
          )}
        </div>
        <div className="version-empty">No rules versions saved yet. Add validation rules, then click &ldquo;Save Rules Version&rdquo;.</div>
      </div>
    );
  }

  return (
    <div className="rules-version-panel">
      <div className="rules-version-panel-header">
        <h4>Rules Versions ({sorted.length})</h4>
        <div className="version-panel-actions">
          {hasRules && (
            <>
              <button
                type="button"
                className="btn btn-sm btn-accent"
                onClick={handleSaveClick}
                title={duplicateOfLabel ? `Identical to ${duplicateOfLabel}` : ''}
              >
                Save Rules Version
              </button>
              {duplicateOfLabel && !showDuplicateConfirm && (
                <span className="version-duplicate-hint">Identical to {duplicateOfLabel}</span>
              )}
            </>
          )}
          {sorted.length >= 2 && (
            <button type="button" className="btn btn-sm" onClick={openCompare}>
              Compare
            </button>
          )}
        </div>
      </div>

      {showDuplicateConfirm && (
        <div className="version-duplicate-confirm">
          <span>This is identical to <strong>{duplicateOfLabel}</strong>. Save anyway?</span>
          <button type="button" className="btn btn-xs btn-accent" onClick={() => { onSaveVersion(); setShowDuplicateConfirm(false); }}>Save Anyway</button>
          <button type="button" className="btn btn-xs" onClick={() => setShowDuplicateConfirm(false)}>Cancel</button>
        </div>
      )}

      <div className="version-list">
        {sorted.map((v, i) => {
          const isCurrent = currentFingerprint === rulesFingerprint(
            v.validationMode || 'none',
            v.selectiveMode || 'include',
            v.expectedFields || [],
            v.excludedPaths || [],
            !!v.unorderedArrays,
            v.assertions || [],
          );
          const isPreview = previewId === v.id;
          return (
            <div key={v.id} className={`version-item ${isCurrent ? 'version-current' : ''}`}>
              <div className="version-item-row">
                <div className="version-item-info">
                  {editingLabel === v.id ? (
                    <input
                      className="version-label-input"
                      autoFocus
                      value={labelText}
                      onChange={(e) => setLabelText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { onRenameVersion(v.id, labelText); setEditingLabel(null); }
                        if (e.key === 'Escape') setEditingLabel(null);
                      }}
                      onBlur={() => { onRenameVersion(v.id, labelText); setEditingLabel(null); }}
                    />
                  ) : (
                    <span className="version-label" onClick={() => { setEditingLabel(v.id); setLabelText(v.label || ''); }}>
                      {getVersionLabel(v, i)}
                    </span>
                  )}
                  <span className="version-time">{formatTime(v.timestamp)}</span>
                  <span className="version-rules-tag">{rulesDescription(v)}</span>
                  {isCurrent && <span className="version-current-tag">current</span>}
                </div>
                <div className="version-item-actions">
                  <button
                    type="button"
                    className={`btn btn-xs ${isPreview ? 'btn-active' : ''}`}
                    onClick={() => setPreviewId(isPreview ? null : v.id)}
                    title="Preview rules"
                  >
                    {isPreview ? 'Hide' : 'Preview'}
                  </button>
                  {!isCurrent && (
                    <button type="button" className="btn btn-xs" onClick={() => onRestore(v)}>Restore</button>
                  )}
                  <button type="button" className="btn btn-xs btn-danger" onClick={() => onDeleteVersion(v.id)}>Delete</button>
                </div>
              </div>
              {isPreview && (
                <div className="version-preview">
                  <pre className="version-preview-dsl">{serializeToDsl(v.expectedFields || [], v.assertions || []) || '(no rules)'}</pre>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showModal && (
        <div className="version-diff-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="version-diff-modal">
            <div className="version-diff-modal-header">
              <h3>Compare Rules Versions</h3>
              <button type="button" className="btn btn-sm" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="version-diff-modal-selectors">
              <label>
                <span className="version-diff-selector-label">Left</span>
                <select value={compareLeft || ''} onChange={(e) => setCompareLeft(e.target.value)}>
                  <option value="">Select...</option>
                  {sorted.map((v, i) => (
                    <option key={v.id} value={v.id}>{getVersionLabel(v, i)} — {formatTime(v.timestamp)}</option>
                  ))}
                </select>
              </label>
              <span className="version-diff-vs">vs</span>
              <label>
                <span className="version-diff-selector-label">Right</span>
                <select value={compareRight || ''} onChange={(e) => setCompareRight(e.target.value)}>
                  <option value="">Select...</option>
                  {sorted.map((v, i) => (
                    <option key={v.id} value={v.id}>{getVersionLabel(v, i)} — {formatTime(v.timestamp)}</option>
                  ))}
                </select>
              </label>
            </div>
            {compareLeft && compareRight && (() => {
              const lv = versions.find((v) => v.id === compareLeft);
              const rv = versions.find((v) => v.id === compareRight);
              const li = lv ? sorted.indexOf(lv) : -1;
              const ri = rv ? sorted.indexOf(rv) : -1;
              if (!lv || !rv) return null;
              const sameVersion = compareLeft === compareRight;
              return (
                <div className="version-diff-info-bar">
                  <div className="version-diff-info-side">
                    <span className="version-diff-info-label">{getVersionLabel(lv, li)}</span>
                    <span className="version-diff-info-time">{formatTime(lv.timestamp)}</span>
                    <span className="version-rules-tag">{rulesDescription(lv)}</span>
                  </div>
                  {sameVersion ? (
                    <span className="version-diff-info-status version-diff-info-same">Same version selected</span>
                  ) : isIdentical ? (
                    <span className="version-diff-info-status version-diff-info-identical">✔ Identical</span>
                  ) : (
                    <span className="version-diff-info-status version-diff-info-changed">Changes detected</span>
                  )}
                  <div className="version-diff-info-side version-diff-info-right">
                    <span className="version-diff-info-label">{getVersionLabel(rv, ri)}</span>
                    <span className="version-diff-info-time">{formatTime(rv.timestamp)}</span>
                    <span className="version-rules-tag">{rulesDescription(rv)}</span>
                  </div>
                </div>
              );
            })()}
            <div className="version-diff-viewer">
              {compareLeft && compareRight && compareLeft === compareRight ? (
                <div className="version-diff-identical">Select different versions on each side to compare.</div>
              ) : diffResult ? (
                <Viewer
                  diff={diffResult}
                  indent={2}
                  lineNumbers={true}
                  highlightInlineDiff={true}
                  syntaxHighlight={{ theme: 'monokai' }}
                />
              ) : compareLeft && compareRight && compareLeft !== compareRight ? (
                <div className="version-diff-identical">No differences found.</div>
              ) : (
                <div className="version-diff-identical">Select two versions above to compare.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
