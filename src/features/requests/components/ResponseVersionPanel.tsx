import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import type { ResponseVersion, ValidationConfig } from '../../../shared/types';
import { buildRulesSnapshot } from '../utils/versionUtils';
import VersionPreviewModal from './VersionPreviewModal';
import { prettyJson } from '../../../shared/utils/helpers';
import { Viewer } from 'json-diff-kit';
import { sharedDiffer } from '../../../shared/utils/jsonDiffKit';
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
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [diffSearch, setDiffSearch] = useState('');
  const [diffMatchIdx, setDiffMatchIdx] = useState(0);
  const [diffMatchCount, setDiffMatchCount] = useState(0);
  const diffSearchRef = useRef<HTMLInputElement>(null);
  const diffViewerRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(true);

  const sorted = useMemo(() => [...versions].sort((a, b) => b.timestamp - a.timestamp), [versions]);

  useEffect(() => {
    if (!showModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowModal(false);
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') { e.preventDefault(); diffSearchRef.current?.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showModal]);

  useEffect(() => { setDiffSearch(''); setDiffMatchIdx(0); setDiffMatchCount(0); }, [showModal, diffTab]);

  const diffGoNext = useCallback(() => {
    if (diffMatchCount === 0) return;
    setDiffMatchIdx(prev => prev < diffMatchCount - 1 ? prev + 1 : 0);
  }, [diffMatchCount]);
  const diffGoPrev = useCallback(() => {
    if (diffMatchCount === 0) return;
    setDiffMatchIdx(prev => prev > 0 ? prev - 1 : diffMatchCount - 1);
  }, [diffMatchCount]);

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
      return sharedDiffer.diff(leftObj, rightObj);
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
      return sharedDiffer.diff(buildRulesSnapshot(lv), buildRulesSnapshot(rv));
    } catch {
      return null;
    }
  }, [showModal, compareLeft, compareRight, versions]);

  const isRulesIdentical = useMemo(() => {
    if (!rulesDiffResult) return true;
    return rulesDiffResult.every(segment => segment.every(line => line.type === 'equal'));
  }, [rulesDiffResult]);

  useEffect(() => {
    if (!diffViewerRef.current) return;
    const container = diffViewerRef.current;
    container.querySelectorAll('.version-diff-search-hit, .version-diff-search-hit--active').forEach(el => {
      const parent = el.parentNode;
      if (parent) { parent.replaceChild(document.createTextNode(el.textContent || ''), el); parent.normalize(); }
    });
    if (!diffSearch.trim()) { setDiffMatchCount(0); setDiffMatchIdx(0); return; }
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
    const matches: { node: Text; start: number }[] = [];
    const q = diffSearch.toLowerCase();
    while (walker.nextNode()) {
      const textNode = walker.currentNode as Text;
      const text = textNode.textContent || '';
      let idx = text.toLowerCase().indexOf(q);
      while (idx !== -1) {
        matches.push({ node: textNode, start: idx });
        idx = text.toLowerCase().indexOf(q, idx + q.length);
      }
    }
    setDiffMatchCount(matches.length);
    if (matches.length === 0) { setDiffMatchIdx(0); return; }
    const safeIdx = Math.min(diffMatchIdx, matches.length - 1);
    if (safeIdx !== diffMatchIdx) setDiffMatchIdx(safeIdx);
    for (let i = matches.length - 1; i >= 0; i--) {
      const { node, start } = matches[i];
      const text = node.textContent || '';
      const before = text.slice(0, start);
      const match = text.slice(start, start + q.length);
      const after = text.slice(start + q.length);
      const mark = document.createElement('mark');
      mark.className = i === safeIdx ? 'version-diff-search-hit--active' : 'version-diff-search-hit';
      mark.textContent = match;
      const frag = document.createDocumentFragment();
      if (before) frag.appendChild(document.createTextNode(before));
      frag.appendChild(mark);
      if (after) frag.appendChild(document.createTextNode(after));
      node.parentNode?.replaceChild(frag, node);
      if (i === safeIdx) mark.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [diffSearch, diffMatchIdx, diffResult, rulesDiffResult, diffTab]);

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatValidationLabel = (mode?: string, selectiveMode?: string) => {
    if (!mode || mode === 'none') return '';
    const modeMap: Record<string, string> = { selective: 'Selective', full: 'Full', strict: 'Strict' };
    const selMap: Record<string, string> = { include: 'Include', exclude: 'Exclude' };
    const parts = [modeMap[mode] || mode];
    if (selectiveMode) parts.push(selMap[selectiveMode] || selectiveMode);
    return parts.join(' · ');
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
        <button
          type="button"
          className="version-collapse-toggle"
          onClick={() => setExpanded(v => !v)}
          aria-expanded={expanded}
          title={expanded ? 'Collapse' : 'Expand'}
        >
          <span className={`version-collapse-arrow ${expanded ? 'expanded' : ''}`}>▶</span>
        </button>
        <h4>Response Versions ({sorted.length})</h4>
        {!expanded && sorted[0] && (
          <span className="version-collapsed-summary">
            Latest: {getVersionLabel(sorted[0], 0)} · {formatTime(sorted[0].timestamp)}
            {sorted[0].json === currentJson && <span className="version-current-tag">current</span>}
          </span>
        )}
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

      {expanded && (
        <>
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
                  {hasRules && <span className="version-rules-tag">{formatValidationLabel(v.validationMode, v.selectiveMode)}</span>}
                  {isCurrent && <span className="version-current-tag">current</span>}
                </div>
                <div className="version-item-actions">
                  <button type="button" className="btn btn-xs" onClick={() => setPreviewId(v.id)}>
                    Preview
                  </button>
                  {!isCurrent && (
                    <button type="button" className="btn btn-xs" onClick={() => onRestore(v)}>Restore</button>
                  )}
                  <button type="button" className="btn btn-xs btn-danger" onClick={() => onDeleteVersion(v.id)}>Delete</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      </>
      )}

      {previewId && (() => {
        const pv = versions.find(v => v.id === previewId);
        if (!pv) return null;
        const idx = sorted.indexOf(pv);
        const label = getVersionLabel(pv, idx >= 0 ? idx : 0);
        const previewJson = prettyJson(pv.json);
        const tags: { label: string; color?: string }[] = [];
        if (pv.validationMode && pv.validationMode !== 'none') {
          tags.push({ label: formatValidationLabel(pv.validationMode, pv.selectiveMode) });
        }
        return (
          <VersionPreviewModal
            title={`Response — ${label}`}
            subtitle={formatTime(pv.timestamp)}
            tags={tags}
            content={previewJson}
            language="json"
            onClose={() => setPreviewId(null)}
          />
        );
      })()}

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
                <div className="version-diff-search-bar">
                  <input
                    ref={diffSearchRef}
                    className="version-diff-search-input"
                    type="text"
                    placeholder="Search… (Cmd+F)"
                    value={diffSearch}
                    onChange={(e) => { setDiffSearch(e.target.value); setDiffMatchIdx(0); }}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape' && diffSearch.trim()) {
                        e.stopPropagation();
                        setDiffSearch('');
                        setDiffMatchIdx(0);
                        return;
                      }
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); diffGoNext(); }
                      if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); diffGoPrev(); }
                    }}
                  />
                  {diffSearch && (
                    <span className="version-diff-search-count">
                      {diffMatchCount > 0 ? `${diffMatchIdx + 1}/${diffMatchCount}` : 'No match'}
                    </span>
                  )}
                  <button type="button" className="version-diff-search-nav" onClick={diffGoPrev} title="Previous (Shift+Enter)" disabled={diffMatchCount === 0}>▲</button>
                  <button type="button" className="version-diff-search-nav" onClick={diffGoNext} title="Next (Enter)" disabled={diffMatchCount === 0}>▼</button>
                </div>
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
                        <span className="version-rules-tag">{formatValidationLabel(lv.validationMode, lv.selectiveMode)} · {(lv.expectedFields || []).length} rule(s)</span>
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
                        <span className="version-rules-tag">{formatValidationLabel(rv.validationMode, rv.selectiveMode)} · {(rv.expectedFields || []).length} rule(s)</span>
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
            <div className="version-diff-viewer" ref={diffViewerRef}>
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
            <div className="version-diff-footer">
              <button type="button" className="btn btn-sm" onClick={() => setShowModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
