import { useState, useMemo } from 'react';
import type { ResponseVersion } from '../types';
import { Differ, Viewer } from 'json-diff-kit';
import 'json-diff-kit/dist/viewer.css';

interface Props {
  versions: ResponseVersion[];
  currentJson: string;
  onSaveVersion: () => void;
  onRestore: (json: string) => void;
  onDeleteVersion: (id: string) => void;
  onRenameVersion: (id: string, label: string) => void;
}

const differ = new Differ({
  detectCircular: false,
  maxDepth: Infinity,
  showModifications: true,
  arrayDiffMethod: 'lcs',
});

export default function ResponseVersionPanel({ versions, currentJson, onSaveVersion, onRestore, onDeleteVersion, onRenameVersion }: Props) {
  const [compareLeft, setCompareLeft] = useState<string | null>(null);
  const [compareRight, setCompareRight] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [labelText, setLabelText] = useState('');

  const sorted = useMemo(() => [...versions].sort((a, b) => b.timestamp - a.timestamp), [versions]);

  const diffResult = useMemo(() => {
    if (!showDiff || !compareLeft || !compareRight) return null;
    const leftVer = versions.find((v) => v.id === compareLeft);
    const rightVer = versions.find((v) => v.id === compareRight);
    if (!leftVer || !rightVer) return null;
    try {
      const leftObj = JSON.parse(leftVer.json);
      const rightObj = JSON.parse(rightVer.json);
      return differ.diff(leftObj, rightObj);
    } catch {
      return null;
    }
  }, [showDiff, compareLeft, compareRight, versions]);

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const getVersionLabel = (v: ResponseVersion, idx: number) => {
    const num = sorted.length - idx;
    return v.label || `v${num}`;
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
            <button type="button" className="btn btn-sm btn-accent" onClick={onSaveVersion}>
              Save as Version
            </button>
          )}
          {sorted.length >= 2 && (
            <button
              type="button"
              className={`btn btn-sm ${showDiff ? 'btn-active' : ''}`}
              onClick={() => {
                if (!showDiff && sorted.length >= 2) {
                  setCompareLeft(sorted[1].id);
                  setCompareRight(sorted[0].id);
                }
                setShowDiff(!showDiff);
              }}
            >
              {showDiff ? 'Hide Compare' : 'Compare'}
            </button>
          )}
        </div>
      </div>

      {showDiff && (
        <div className="version-compare-bar">
          <label>
            Left:
            <select value={compareLeft || ''} onChange={(e) => setCompareLeft(e.target.value)}>
              <option value="">Select...</option>
              {sorted.map((v, i) => (
                <option key={v.id} value={v.id}>{getVersionLabel(v, i)} — {formatTime(v.timestamp)}</option>
              ))}
            </select>
          </label>
          <label>
            Right:
            <select value={compareRight || ''} onChange={(e) => setCompareRight(e.target.value)}>
              <option value="">Select...</option>
              {sorted.map((v, i) => (
                <option key={v.id} value={v.id}>{getVersionLabel(v, i)} — {formatTime(v.timestamp)}</option>
              ))}
            </select>
          </label>
        </div>
      )}

      {showDiff && diffResult && (
        <div className="version-diff-viewer">
          <Viewer
            diff={diffResult}
            indent={2}
            lineNumbers={true}
            highlightInlineDiff={true}
          />
        </div>
      )}

      {showDiff && compareLeft && compareRight && !diffResult && (
        <div className="version-diff-identical">No differences found (or JSON parse error).</div>
      )}

      <div className="version-list">
        {sorted.map((v, i) => {
          const isCurrent = v.json === currentJson;
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
                {isCurrent && <span className="version-current-tag">current</span>}
              </div>
              <div className="version-item-actions">
                {!isCurrent && (
                  <button type="button" className="btn btn-xs" onClick={() => onRestore(v.json)}>Restore</button>
                )}
                <button type="button" className="btn btn-xs btn-danger" onClick={() => onDeleteVersion(v.id)}>Delete</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
