import { useMemo, useCallback } from 'react';
import type { RulesVersion, ValidationConfig, ExpectedField, Assertion } from '@shared/types';
import { buildRulesSnapshot } from '../utils/versionUtils';
import { serializeToDsl } from '@shared/components/data-mapper/utils/validationDsl';
import VersionPreviewModal from './VersionPreviewModal';
import { sharedDiffer } from '@shared/utils/jsonDiffKit';
import { useVersionDiffPanel } from '../hooks/useVersionDiffPanel';
import VersionDiffModal from './version-shared/VersionDiffModal';
import VersionListItem from './version-shared/VersionListItem';
import VersionDuplicateConfirm from './version-shared/VersionDuplicateConfirm';
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

export default function RulesVersionPanel({
  versions,
  currentValidation,
  onSaveVersion,
  onRestore,
  onDeleteVersion,
  onRenameVersion,
}: Props) {
  const computeDiff = useCallback((left: RulesVersion, right: RulesVersion) => {
    try {
      return sharedDiffer.diff(buildRulesSnapshot(left), buildRulesSnapshot(right));
    } catch {
      return null;
    }
  }, []);

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

  // Use shared hook — isDuplicate is computed lazily via getter
  const panel = useVersionDiffPanel({
    versions,
    onSaveVersion,
    computeDiff,
    isDuplicate: false, // overridden below via handleSaveClick
    escapeClearsSearch: true,
  });

  const { sorted, formatTime } = panel;

  const getVersionLabel = (v: RulesVersion, idx: number) => {
    const num = sorted.length - idx;
    return v.label || `r${num}`;
  };

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
      panel.setShowDuplicateConfirm(true);
    } else {
      onSaveVersion();
    }
  }, [duplicateOfLabel, onSaveVersion, panel]);

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
    isIdentical,
    diffResult,
    openCompare,
  } = panel;

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  const rulesDescription = (v: RulesVersion) => {
    const parts: string[] = [];
    if (v.validationMode && v.validationMode !== 'none') parts.push(capitalize(v.validationMode));
    if (v.selectiveMode) parts.push(capitalize(v.selectiveMode));
    const fieldCount = (v.expectedFields || []).length;
    if (fieldCount) parts.push(`${fieldCount} rule${fieldCount > 1 ? 's' : ''}`);
    const exCount = (v.excludedPaths || []).length;
    if (exCount) parts.push(`${exCount} excluded`);
    if (v.unorderedArrays) parts.push('Unordered');
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
        <button
          type="button"
          className="version-collapse-toggle"
          onClick={() => setExpanded(v => !v)}
          aria-expanded={expanded}
          title={expanded ? 'Collapse' : 'Expand'}
        >
          <span className={`version-collapse-arrow ${expanded ? 'expanded' : ''}`}>▶</span>
        </button>
        <h4>Rules Versions ({sorted.length})</h4>
        {!expanded && sorted[0] && (
          <span className="version-collapsed-summary">
            Latest: {getVersionLabel(sorted[0], 0)} · {rulesDescription(sorted[0])}
          </span>
        )}
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
          const isCurrent = currentFingerprint === rulesFingerprint(
            v.validationMode || 'none',
            v.selectiveMode || 'include',
            v.expectedFields || [],
            v.excludedPaths || [],
            !!v.unorderedArrays,
            v.assertions || [],
          );
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
              <span className="version-rules-tag">{rulesDescription(v)}</span>
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
        const dslContent = serializeToDsl(pv.expectedFields || [], pv.assertions || []) || '(no rules)';
        const tags: { label: string; color?: string }[] = [];
        if (pv.validationMode && pv.validationMode !== 'none') tags.push({ label: capitalize(pv.validationMode) });
        if (pv.selectiveMode) tags.push({ label: capitalize(pv.selectiveMode) });
        const fc = (pv.expectedFields || []).length;
        if (fc) tags.push({ label: `${fc} rules`, color: '#45a29e' });
        if (pv.unorderedArrays) tags.push({ label: 'Unordered', color: '#7f5af0' });
        return (
          <VersionPreviewModal
            title={`Rules — ${label}`}
            subtitle={formatTime(pv.timestamp)}
            tags={tags}
            content={dslContent}
            language="dsl"
            onClose={() => setPreviewId(null)}
          />
        );
      })()}

      {showModal && (
        <VersionDiffModal
          show={showModal}
          onClose={() => setShowModal(false)}
          title="Compare Rules Versions"
          compareLeft={compareLeft} setCompareLeft={setCompareLeft}
          compareRight={compareRight} setCompareRight={setCompareRight}
          options={sorted.map((v, i) => ({ id: v.id, label: `${getVersionLabel(v, i)} — ${formatTime(v.timestamp)}` }))}
          diffResult={diffResult}
          diffViewerRef={diffViewerRef}
          searchBarProps={{ diffSearch, setDiffSearch, diffMatchIdx, setDiffMatchIdx, diffMatchCount, diffSearchRef, diffGoNext, diffGoPrev }}
        >
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
        </VersionDiffModal>
      )}
    </div>
  );
}
