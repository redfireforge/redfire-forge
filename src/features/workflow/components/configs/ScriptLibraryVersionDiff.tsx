import { useState, useMemo } from 'react';
import { Differ, Viewer } from 'json-diff-kit';
import 'json-diff-kit/dist/viewer.css';
import 'json-diff-kit/dist/viewer-monokai.css';
import type { ScriptLibraryVersion } from '../../engine/scriptLibraries';
import type { ScriptLibraryDiffResult } from '../../engine/scriptLibraryVersioning';

type DiffTab = 'overview' | 'code';

interface Props {
  older: ScriptLibraryVersion;
  newer: ScriptLibraryVersion;
  diff: ScriptLibraryDiffResult;
  onClose: () => void;
}

const differ = new Differ({ detectCircular: false, arrayDiffMethod: 'lcs' });

export default function ScriptLibraryVersionDiff({ older, newer, diff, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<DiffTab>('overview');

  const overviewCount = [diff.nameChanged, diff.descriptionChanged].filter(Boolean).length;

  const tabs: Array<{ key: DiffTab; label: string; count: number }> = [
    { key: 'overview', label: 'Overview', count: overviewCount },
    { key: 'code', label: 'Code', count: diff.codeChanged ? 1 : 0 },
  ];

  const olderLabel = older.label || formatTimestamp(older.timestamp);
  const newerLabel = newer.label || formatTimestamp(newer.timestamp);

  const codeDiffResult = useMemo(() => {
    if (!diff.codeChanged) return null;
    try {
      return differ.diff(diff.oldCode, diff.newCode);
    } catch {
      return null;
    }
  }, [diff]);

  return (
    <div className="script-lib-diff-panel">
      <div className="script-lib-diff-header">
        <h4>Script Library Comparison</h4>
        <span className="script-lib-diff-range">{olderLabel} → {newerLabel}</span>
        <button className="wf-config-remove-btn" onClick={onClose} aria-label="Close">✕</button>
      </div>

      <div className="script-lib-diff-tabs">
        {tabs.map(t => (
          <button
            key={t.key}
            className={`script-lib-diff-tab ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
            {t.count > 0 && <span className="script-lib-diff-tab-badge">{t.count}</span>}
          </button>
        ))}
      </div>

      <div className="script-lib-diff-body">
        {activeTab === 'overview' && (
          <div className="script-lib-diff-overview">
            {!diff.nameChanged && !diff.descriptionChanged && (
              <div className="script-lib-diff-no-changes">No metadata changes — code may differ.</div>
            )}
            {diff.nameChanged && (
              <div className="script-lib-diff-field">
                <span className="script-lib-diff-field-label">Name</span>
                <div className="script-lib-diff-field-values">
                  <span className="script-lib-diff-old">{diff.oldName}</span>
                  <span className="script-lib-diff-arrow">→</span>
                  <span className="script-lib-diff-new">{diff.newName}</span>
                </div>
              </div>
            )}
            {diff.descriptionChanged && (
              <div className="script-lib-diff-field">
                <span className="script-lib-diff-field-label">Description</span>
                <div className="script-lib-diff-field-values">
                  <span className="script-lib-diff-old">{diff.oldDescription || '(empty)'}</span>
                  <span className="script-lib-diff-arrow">→</span>
                  <span className="script-lib-diff-new">{diff.newDescription || '(empty)'}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'code' && (
          <div className="script-lib-diff-code">
            {!diff.codeChanged ? (
              <div className="script-lib-diff-no-changes">Code is identical.</div>
            ) : codeDiffResult ? (
              <div className="script-lib-diff-viewer">
                <Viewer
                  diff={codeDiffResult}
                  indent={2}
                  lineNumbers
                  highlightInlineDiff
                  virtual={false}
                />
              </div>
            ) : (
              <div className="script-lib-diff-fallback">
                <div className="script-lib-diff-side">
                  <h5>Before</h5>
                  <pre>{diff.oldCode}</pre>
                </div>
                <div className="script-lib-diff-side">
                  <h5>After</h5>
                  <pre>{diff.newCode}</pre>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
