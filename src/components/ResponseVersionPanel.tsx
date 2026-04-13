import { useState, useMemo, useEffect } from 'react';
import type { ResponseVersion, ValidationConfig } from '../types';
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

  const buildRulesObj = (v: ResponseVersion) => ({
    mode: v.validationMode || 'none',
    selectiveMode: v.selectiveMode || 'include',
    expectedFields: v.expectedFields || [],
    excludedPaths: v.excludedPaths || [],
    unorderedArrays: !!v.unorderedArrays,
  });

  const rulesDiffResult = useMemo(() => {
    if (!showModal || !compareLeft || !compareRight) return null;
    const lv = versions.find((v) => v.id === compareLeft);
    const rv = versions.find((v) => v.id === compareRight);
    if (!lv || !rv) return null;
    try {
      return differ.diff(buildRulesObj(lv), buildRulesObj(rv));
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

  const getVersionLabel = (v: ResponseVersion, idx: number) => {
    const num = sorted.length - idx;
    return v.label || `v${num}`;
  };

  const getLabelById = (id: string) => {
    const idx = sorted.findIndex((v) => v.id === id);
    if (idx < 0) return '?';
    return getVersionLabel(sorted[idx], idx);
  };

  const isDuplicate = useMemo(() => {
    if (sorted.length === 0 || !currentJson.trim()) return false;
    const latest = sorted[0];
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
    try {
      const jsonSame = JSON.stringify(canon(strip(JSON.parse(currentJson)))) === JSON.stringify(canon(strip(JSON.parse(latest.json))));
      if (!jsonSame) return false;
    } catch {
      if (currentJson.trim() !== latest.json) return false;
    }
    const rulesSame =
      (currentValidation.mode || 'none') === (latest.validationMode || 'none') &&
      (currentValidation.selectiveMode || 'include') === (latest.selectiveMode || 'include') &&
      JSON.stringify(currentValidation.expectedFields || []) === JSON.stringify(latest.expectedFields || []) &&
      JSON.stringify(currentValidation.excludedPaths || []) === JSON.stringify(latest.excludedPaths || []) &&
      !!(currentValidation.unorderedArrays) === !!(latest.unorderedArrays);
    return rulesSame;
  }, [sorted, currentJson, excludedPaths, currentValidation]);

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
        <div className="version-empty">No versions saved yet. Paste or fetch a response, then click "Save as Version".</div>
      </div>
    );
  }

  return (
    <div className="version-panel">
      <div className="version-panel-header">
        <h4>Response Versions ({sorted.length})</h4>
        <div className="version-panel-actions">
          {currentJson.trim() && (
            <button type="button" className="btn btn-sm btn-accent" onClick={onSaveVersion} disabled={isDuplicate} title={isDuplicate ? 'No changes since last version' : ''}>
              {isDuplicate ? 'No Changes' : 'Save as Version'}
            </button>
          )}
          {sorted.length >= 2 && (
            <button type="button" className="btn btn-sm" onClick={openCompare}>
              Compare
            </button>
          )}
        </div>
      </div>

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
            {compareLeft && compareRight && compareLeft === compareRight && (
              <div className="version-diff-identical">Same version selected on both sides.</div>
            )}
            {compareLeft && compareRight && compareLeft !== compareRight && (
              <>
                <div className="version-diff-tabs">
                  <button type="button" className={`version-diff-tab ${diffTab === 'response' ? 'active' : ''}`} onClick={() => setDiffTab('response')}>
                    Response {isIdentical ? '(identical)' : ''}
                  </button>
                  <button type="button" className={`version-diff-tab ${diffTab === 'rules' ? 'active' : ''}`} onClick={() => setDiffTab('rules')}>
                    Validation Rules {isRulesIdentical ? '(identical)' : ''}
                  </button>
                </div>
                {isIdentical && isRulesIdentical && (
                  <div className="version-diff-identical-banner">
                    <span className="version-diff-identical-icon">&#x2714;</span>
                    These two versions are identical{unorderedArrays ? ' (with unordered array matching)' : ''}
                  </div>
                )}
              </>
            )}
            <div className="version-diff-viewer">
              {diffTab === 'response' && diffResult ? (
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
