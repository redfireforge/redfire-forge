import { useState, useMemo, useCallback } from 'react';
import type { ResponseVersion, ValidationConfig } from '@shared/types';
import { buildRulesSnapshot } from '../utils/versionUtils';
import VersionPreviewModal from './VersionPreviewModal';
import { prettyJson } from '@shared/utils/helpers';
import { sharedDiffer } from '@shared/utils/jsonDiffKit';
import { useVersionDiffPanel } from '../hooks/useVersionDiffPanel';
import VersionDiffModal from './version-shared/VersionDiffModal';
import VersionListItem from './version-shared/VersionListItem';
import VersionDuplicateConfirm from './version-shared/VersionDuplicateConfirm';
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

function toCanonicalJsonString(raw: string, excludedPaths: string[]): string {
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
    return JSON.stringify(canon(strip(JSON.parse(raw))));
  } catch {
    return raw.trim();
  }
}

export default function ResponseVersionPanel({ versions, currentJson, currentValidation, excludedPaths = [], onSaveVersion, onRestore, onDeleteVersion, onRenameVersion }: Props) {
  const [unorderedArrays, setUnorderedArrays] = useState(false);
  const [diffTab, setDiffTab] = useState<'response' | 'rules'>('response');

  const computeDiff = useCallback((left: ResponseVersion, right: ResponseVersion) => {
    try {
      let leftObj = JSON.parse(left.json);
      let rightObj = JSON.parse(right.json);
      if (unorderedArrays) {
        leftObj = sortArraysDeep(leftObj);
        rightObj = sortArraysDeep(rightObj);
      }
      return sharedDiffer.diff(leftObj, rightObj);
    } catch {
      return null;
    }
  }, [unorderedArrays]);

  const panel = useVersionDiffPanel({
    versions,
    onSaveVersion,
    computeDiff,
    isDuplicate: false, // overridden via handleSaveClick below
    extraSearchResetDeps: [diffTab],
    extraHighlightDeps: [diffTab],
  });

  const {
    compareLeft, setCompareLeft,
    compareRight, setCompareRight,
    showModal, setShowModal,
    editingLabel, setEditingLabel,
    labelText, setLabelText,
    showDuplicateConfirm, setShowDuplicateConfirm,
    previewId, setPreviewId,
    expanded, setExpanded,
    diffSearch, setDiffSearch,
    diffMatchIdx, setDiffMatchIdx,
    diffMatchCount,
    diffSearchRef, diffViewerRef,
    diffGoNext, diffGoPrev,
    sorted,
    isIdentical,
    diffResult,
    openCompare,
    formatTime,
  } = panel;

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

    const sortFields = (f: { jsonPath: string; expectedValue: string }[]) =>
      [...f].sort((a, b) => a.jsonPath.localeCompare(b.jsonPath));
    const sortPaths = (p: string[]) => [...p].sort();

    const currentCanon = toCanonicalJsonString(currentJson, excludedPaths);

    for (let i = 0; i < sorted.length; i++) {
      const ver = sorted[i];
      const verCanon = toCanonicalJsonString(ver.json, excludedPaths);

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
  }, [duplicateOfLabel, onSaveVersion, setShowDuplicateConfirm]);

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
            <VersionDuplicateConfirm
              show={showDuplicateConfirm}
              duplicateOfLabel={duplicateOfLabel ?? ''}
              onSaveAnyway={() => { onSaveVersion(); setShowDuplicateConfirm(false); }}
              onCancel={() => setShowDuplicateConfirm(false)}
            />
          )}

          <div className="version-list">
        {sorted.map((v, i) => {
          const isCurrent = v.json === currentJson;
          const hasRules = v.validationMode && v.validationMode !== 'none';
          return (
            <VersionListItem
              key={v.id}
              id={v.id}
              isCurrent={isCurrent}
              label={getVersionLabel(v, i)}
              rawLabel={v.label || ''}
              time={formatTime(v.timestamp)}
              editingLabel={editingLabel}
              labelText={labelText}
              setEditingLabel={setEditingLabel}
              setLabelText={setLabelText}
              onRename={onRenameVersion}
              onPreview={() => setPreviewId(v.id)}
              onRestore={() => onRestore(v)}
              onDelete={() => onDeleteVersion(v.id)}
            >
              {hasRules && <span className="version-rules-tag">{formatValidationLabel(v.validationMode, v.selectiveMode)}</span>}
            </VersionListItem>
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
        <VersionDiffModal
          show={showModal}
          onClose={() => setShowModal(false)}
          title="Compare Versions"
          headerControls={
            <label className="version-diff-toggle" title="When enabled, arrays are compared ignoring element order">
              <input type="checkbox" checked={unorderedArrays} onChange={(e) => setUnorderedArrays(e.target.checked)} />
              <span>Unordered Arrays</span>
            </label>
          }
          compareLeft={compareLeft} setCompareLeft={setCompareLeft}
          compareRight={compareRight} setCompareRight={setCompareRight}
          options={sorted.map((v, i) => ({ id: v.id, label: `${getVersionLabel(v, i)} — ${formatTime(v.timestamp)}` }))}
          diffResult={diffResult}
          activeDiffResult={diffTab === 'rules' ? rulesDiffResult : diffResult}
          diffViewerRef={diffViewerRef}
          searchBarProps={{ diffSearch, setDiffSearch, diffMatchIdx, setDiffMatchIdx, diffMatchCount, diffSearchRef, diffGoNext, diffGoPrev, escapeClearsSearch: true }}
        >
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
        </VersionDiffModal>
      )}
    </div>
  );
}
