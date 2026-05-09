import { useState, useMemo, useEffect, useCallback } from 'react';
import type { ResponseVersion, ValidationConfig } from '../../../shared/types';
import { buildRulesSnapshot } from '../utils/versionUtils';
import { Differ, Viewer } from 'json-diff-kit';
import 'json-diff-kit/dist/viewer.css';
import 'json-diff-kit/dist/viewer-monokai.css';

interface Props {
  versions: ResponseVersion[];
  currentJson: string;
  currentValidation: ValidationConfig;
  excludedPaths?: string[];
  onSaveVersion: () => void;
  onRestore: (version: ResponseVersion) => void;
  onDeleteVersion: (id: string) => void;
  onRenameVersion: (id: string, label: string) => void;
}

const differ = new Differ({
  detectCircular: false,
  maxDepth: Infinity,
  showModifications: true,
  arrayDiffMethod: 'lcs',
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sortArraysDeep(val: any): any {
  if (val === null || val === undefined || typeof val !== 'object') return val;
  if (Array.isArray(val)) {
    const mapped = val.map(sortArraysDeep);
    return mapped.sort((a, b) => {
      const sa = JSON.stringify(a);
      const sb = JSON.stringify(b);
      return sa < sb ? -1 : sa > sb ? 1 : 0;
    });
  }
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(val).sort()) {
    out[k] = sortArraysDeep(val[k]);
  }
  return out;
}

export default function ResponseVersionPanel({ versions, currentJson, currentValidation, excludedPaths = [], onSaveVersion, onRestore, onDeleteVersion, onRenameVersion }: Props) {
  const [compareLeft, setCompareLeft] = useState<string | null>(null);
  const [compareRight, setCompareRight] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [labelText, setLabelText] = useState('');
  const [unorderedArrays, setUnorderedArrays] = useState(false);
  const [diffTab, setDiffTab] = useState<'response' | 'rules'>('response');
  const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false);

  const sorted = useMemo(() => [...versions].sort((a, b) => b.timestamp - a.timestamp), [versions]);

  useEffect(() => {
    if (!showModal) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowModal(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showModal]);

  const diffResult = useMemo(() => {
    if (!showModal || !compareLeft || !compareRight) return null;
    const leftVer = versions.find((v) => v.id === compareLeft);
    const rightVer = versions.find((v) => v.id === compareRight);
    if (!leftVer || !rightVer) return null;
    try {
      let leftObj = JSON.parse(leftVer.json);
      let rightObj = JSON.parse(rightVer.json);
      if (unorderedArrays) {
        leftObj = sortArraysDeep(leftObj);
        rightObj = sortArraysDeep(rightObj);
      }
      return differ.diff(leftObj, rightObj);
    } catch {
      return null;
    }
  }, [showModal, compareLeft, compareRight, versions, unorderedArrays]);

  const isIdentical = useMemo(() => {
    if (!diffResult) return false;
    return diffResult.every(segment => segment.every(line => line.type === 'equal'));
  }, [diffResult]);

  const rulesDiffResult = useMemo(() => {
    if (!showModal || !compareLeft || !compareRight) return null;
    const lv = versions.find((v) => v.id === compareLeft);
    const rv = versions.find((v) => v.id === compareRight);
    if (!lv || !rv) return null;
    try {
      return differ.diff(buildRulesSnapshot(lv), buildRulesSnapshot(rv));
    } catch {
      return null;
    }
  }, [showModal, compareLeft, compareRight, versions]);

  const isRulesIdentical = useMemo(() => {
    if (!rulesDiffResult) return true;
    return rulesDiffResult.every(segment => segment.every(line => line.type === 'equal'));
  }, [rulesDiffResult]);

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const getVersionLabel = useCallback((v: ResponseVersion, idx: number) => {
    const num = sorted.length - idx;
    return v.label || `v${num}`;
  }, [sorted]);


  /** Check ALL versions for a duplicate (not just latest). Returns matching version label or null. */
  const duplicateOfLabel = useMemo(() => {
    if (sorted.length === 0 || !currentJson.trim()) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const canon = (v: any): any => {
      if (v === null || v === undefined || typeof v !== 'object') return v;
      if (Array.isArray(v)) return v.map(canon);
      const o: Record<string, unknown> = {};
      for (const k of Object.keys(v).sort()) o[k] = canon(v[k]);
      return o;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const strip = (obj: any): any => {
      if (!excludedPaths.length || !obj || typeof obj !== 'object') return obj;
      const clone = Array.isArray(obj) ? [...obj] : { ...obj };
      for (const p of excludedPaths) {
        const segs = p.replace(/^\$\.?/, '').split('.').filter(Boolean);
        if (!segs.length) continue;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let cur: any = clone;
        for (let i = 0; i < segs.length - 1; i++) {
          if (cur && typeof cur === 'object' && !Array.isArray(cur)) cur[segs[i]] = { ...cur[segs[i]] };
          cur = cur?.[segs[i]];
          if (!cur || typeof cur !== 'object') break;
        }
        if (cur && typeof cur === 'object') delete cur[segs[segs.length - 1]];
      }
      return clone;
    };

    const sortFields = (f: { jsonPath: string; expectedValue: string }[]) =>
      [...f].sort((a, b) => a.jsonPath.localeCompare(b.jsonPath));
    const sortPaths = (p: string[]) => [...p].sort();

    let currentCanon: string;
    try { currentCanon = JSON.stringify(canon(strip(JSON.parse(currentJson)))); }
    catch { currentCanon = currentJson.trim(); }

    for (let i = 0; i < sorted.length; i++) {
      const ver = sorted[i];
      let verCanon: string;
      try { verCanon = JSON.stringify(canon(strip(JSON.parse(ver.json)))); }
      catch { verCanon = ver.json; }

      if (currentCanon !== verCanon) continue;

      const rulesSame =
        (currentValidation.mode || 'none') === (ver.validationMode || 'none') &&
        (currentValidation.selectiveMode || 'include') === (ver.selectiveMode || 'include') &&
        JSON.stringify(sortFields(currentValidation.expectedFields || [])) === JSON.stringify(sortFields(ver.expectedFields || [])) &&
        JSON.stringify(sortPaths(currentValidation.excludedPaths || [])) === JSON.stringify(sortPaths(ver.excludedPaths || [])) &&
        !!(currentValidation.unorderedArrays) === !!(ver.unorderedArrays);

      if (rulesSame) return getVersionLabel(ver, i);
    }
    return null;
  }, [sorted, currentJson, excludedPaths, currentValidation, getVersionLabel]);

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

  if (sorted.length === 0) {
    return (
      <div className="version-panel">
        <div className="version-panel-header">
          <h4>Response Versions</h4>
          {currentJson.trim() && (
            <button type="button" className="btn btn-sm btn-accent" onClick={onSaveVersion}>
              Save as Version
            </button>
          )}
        </div>
        <div className="version-empty">No versions saved yet. Paste or fetch a response, then click &ldquo;Save as Version&rdquo;.</div>
      </div>
    );
  }

  return (
    <div className="version-panel">
      <div className="version-panel-header">
        <h4>Response Versions ({sorted.length})</h4>
        <div className="version-panel-actions">
          {currentJson.trim() && (
            <>
              <button
                type="button"
                className="btn btn-sm btn-accent"
                onClick={handleSaveClick}
                title={duplicateOfLabel ? `Identical to ${duplicateOfLabel}` : ''}
              >
                Save as Version
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
          const isCurrent = v.json === currentJson;
          const hasRules = v.validationMode && v.validationMode !== 'none';
          return (
            <div key={v.id} className={`version-item ${isCurrent ? 'version-current' : ''}`}>
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
                {hasRules && <span className="version-rules-tag">{v.validationMode}{v.selectiveMode ? `·${v.selectiveMode}` : ''}</span>}
                {isCurrent && <span className="version-current-tag">current</span>}
              </div>
              <div className="version-item-actions">
                {!isCurrent && (
                  <button type="button" className="btn btn-xs" onClick={() => onRestore(v)}>Restore</button>
                )}
                <button type="button" className="btn btn-xs btn-danger" onClick={() => onDeleteVersion(v.id)}>Delete</button>
              </div>
            </div>
          );
        })}
      </div>

      {showModal && (
        <div className="version-diff-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="version-diff-modal">
            <div className="version-diff-modal-header">
              <h3>Compare Versions</h3>
              <div className="version-diff-modal-controls">
                <label className="version-diff-toggle" title="When enabled, arrays are compared ignoring element order">
                  <input type="checkbox" checked={unorderedArrays} onChange={(e) => setUnorderedArrays(e.target.checked)} />
                  <span>Unordered Arrays</span>
                </label>
                <button type="button" className="btn btn-sm" onClick={() => setShowModal(false)}>✕</button>
              </div>
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
              const allIdentical = !sameVersion && isIdentical && isRulesIdentical;
              return (
                <>
                  <div className="version-diff-info-bar">
                    <div className="version-diff-info-side">
                      <span className="version-diff-info-label">{getVersionLabel(lv, li)}</span>
                      <span className="version-diff-info-time">{formatTime(lv.timestamp)}</span>
                      {lv.validationMode && lv.validationMode !== 'none' && (
                        <span className="version-rules-tag">{lv.validationMode}{lv.selectiveMode ? `·${lv.selectiveMode}` : ''} · {(lv.expectedFields || []).length} rule(s)</span>
                      )}
                    </div>
                    {sameVersion ? (
                      <span className="version-diff-info-status version-diff-info-same">Same version selected</span>
                    ) : allIdentical ? (
                      <span className="version-diff-info-status version-diff-info-identical">✔ Identical{unorderedArrays ? ' (unordered)' : ''}</span>
                    ) : (
                      <span className="version-diff-info-status version-diff-info-changed">Changes detected</span>
                    )}
                    <div className="version-diff-info-side version-diff-info-right">
                      <span className="version-diff-info-label">{getVersionLabel(rv, ri)}</span>
                      <span className="version-diff-info-time">{formatTime(rv.timestamp)}</span>
                      {rv.validationMode && rv.validationMode !== 'none' && (
                        <span className="version-rules-tag">{rv.validationMode}{rv.selectiveMode ? `·${rv.selectiveMode}` : ''} · {(rv.expectedFields || []).length} rule(s)</span>
                      )}
                    </div>
                  </div>
                  {!sameVersion && (
                    <div className="version-diff-tabs">
                      <button type="button" className={`version-diff-tab ${diffTab === 'response' ? 'active' : ''}`} onClick={() => setDiffTab('response')}>
                        Response {isIdentical ? '(identical)' : ''}
                      </button>
                      <button type="button" className={`version-diff-tab ${diffTab === 'rules' ? 'active' : ''}`} onClick={() => setDiffTab('rules')}>
                        Validation Rules {isRulesIdentical ? '(identical)' : ''}
                      </button>
                    </div>
                  )}
                </>
              );
            })()}
            <div className="version-diff-viewer">
              {compareLeft && compareRight && compareLeft === compareRight ? (
                <div className="version-diff-identical">Select different versions on each side to compare.</div>
              ) : diffTab === 'response' && diffResult ? (
                <Viewer
                  diff={diffResult}
                  indent={2}
                  lineNumbers={true}
                  highlightInlineDiff={true}
                  syntaxHighlight={{ theme: 'monokai' }}
                />
              ) : diffTab === 'rules' && rulesDiffResult ? (
                <Viewer
                  diff={rulesDiffResult}
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
