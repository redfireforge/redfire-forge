import { useState, useMemo } from 'react';
import { Differ, Viewer } from 'json-diff-kit';
import 'json-diff-kit/dist/viewer.css';
import 'json-diff-kit/dist/viewer-monokai.css';
import type { TestDefinitionVersion, TestDefinitionSnapshot } from '../../../shared/types';
import { computeSnapshotDiff } from '../utils/testDefinitionVersioning';

type DiffTab = 'overview' | 'headers' | 'body' | 'auth' | 'extractions';

interface Props {
  open: boolean;
  older: TestDefinitionVersion;
  newer: TestDefinitionVersion;
  onClose: () => void;
}

const differ = new Differ({ detectCircular: false, arrayDiffMethod: 'lcs' });

export default function TestDefinitionVersionDiff({ open, older, newer, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<DiffTab>('overview');

  const diff = useMemo(() => computeSnapshotDiff(older.snapshot, newer.snapshot), [older, newer]);

  if (!open) return null;

  const overviewCount = [
    diff.nameChanged, diff.urlChanged, diff.methodChanged,
    diff.bodyChanged, diff.bodyTypeChanged, diff.authChanged, diff.formDataChanged,
  ].filter(Boolean).length;
  const headersCount = diff.headersAdded.length + diff.headersRemoved.length + diff.headersModified.length;
  const extractCount = diff.extractionsAdded + diff.extractionsRemoved + (diff.extractionsModified ? 1 : 0);

  const tabs: Array<{ key: DiffTab; label: string; count: number }> = [
    { key: 'overview', label: 'Overview', count: overviewCount },
    { key: 'headers', label: 'Headers', count: headersCount },
    { key: 'body', label: 'Body', count: diff.bodyChanged ? 1 : 0 },
    { key: 'auth', label: 'Auth', count: diff.authChanged ? 1 : 0 },
    { key: 'extractions', label: 'Extractions', count: extractCount },
  ];

  const olderLabel = older.label || formatTimestamp(older.timestamp);
  const newerLabel = newer.label || formatTimestamp(newer.timestamp);

  return (
    <div className="test-def-diff-overlay modal-overlay" onClick={onClose}>
      <div className="test-def-diff-modal" onClick={(e) => e.stopPropagation()}>
        <div className="test-def-diff-header">
          <h3>Definition Comparison</h3>
          <span className="test-def-diff-range">
            {olderLabel} → {newerLabel}
          </span>
          <button className="btn btn-sm" onClick={onClose}>×</button>
        </div>

        <div className="test-def-diff-tabs">
          {tabs.map((t) => (
            <button
              key={t.key}
              className={`test-def-diff-tab ${activeTab === t.key ? 'active' : ''}`}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
              {t.count > 0 && <span className="test-def-diff-tab-count">{t.count}</span>}
            </button>
          ))}
        </div>

        <div className="test-def-diff-body">
          {activeTab === 'overview' && <OverviewDiffView older={older.snapshot} newer={newer.snapshot} diff={diff} />}
          {activeTab === 'headers' && <HeadersDiffView diff={diff} />}
          {activeTab === 'body' && <BodyDiffView older={older.snapshot} newer={newer.snapshot} diff={diff} />}
          {activeTab === 'auth' && <AuthDiffView older={older.snapshot} newer={newer.snapshot} diff={diff} />}
          {activeTab === 'extractions' && <ExtractionsDiffView older={older.snapshot} newer={newer.snapshot} diff={diff} />}
        </div>
      </div>
    </div>
  );
}

function OverviewDiffView({ older, newer, diff }: { older: TestDefinitionSnapshot; newer: TestDefinitionSnapshot; diff: ReturnType<typeof computeSnapshotDiff> }) {
  const hasChanges = diff.nameChanged || diff.urlChanged || diff.methodChanged || diff.bodyChanged || diff.bodyTypeChanged || diff.formDataChanged;
  if (!hasChanges) return <div className="test-def-diff-empty">No overview changes</div>;

  return (
    <div className="test-def-diff-section">
      {diff.nameChanged && (
        <div className="test-def-diff-row modified">
          <span className="test-def-diff-badge modified">~</span>
          <span className="test-def-diff-field">Name</span>
          <span className="test-def-diff-val">
            <span className="test-def-diff-old">{older.name}</span>
            <span className="test-def-diff-arrow">→</span>
            <span className="test-def-diff-new">{newer.name}</span>
          </span>
        </div>
      )}
      {diff.urlChanged && (
        <div className="test-def-diff-row modified">
          <span className="test-def-diff-badge modified">~</span>
          <span className="test-def-diff-field">URL</span>
          <span className="test-def-diff-val">
            <span className="test-def-diff-old">{older.url}</span>
            <span className="test-def-diff-arrow">→</span>
            <span className="test-def-diff-new">{newer.url}</span>
          </span>
        </div>
      )}
      {diff.methodChanged && (
        <div className="test-def-diff-row modified">
          <span className="test-def-diff-badge modified">~</span>
          <span className="test-def-diff-field">Method</span>
          <span className="test-def-diff-val">
            <span className="test-def-diff-old">{older.method}</span>
            <span className="test-def-diff-arrow">→</span>
            <span className="test-def-diff-new">{newer.method}</span>
          </span>
        </div>
      )}
      {diff.bodyTypeChanged && (
        <div className="test-def-diff-row modified">
          <span className="test-def-diff-badge modified">~</span>
          <span className="test-def-diff-field">Body Type</span>
          <span className="test-def-diff-val">
            <span className="test-def-diff-old">{older.bodyType ?? 'none'}</span>
            <span className="test-def-diff-arrow">→</span>
            <span className="test-def-diff-new">{newer.bodyType ?? 'none'}</span>
          </span>
        </div>
      )}
      {diff.bodyChanged && (
        <div className="test-def-diff-row modified">
          <span className="test-def-diff-badge modified">~</span>
          <span className="test-def-diff-field">Body</span>
          <span className="test-def-diff-val">content modified</span>
        </div>
      )}
      {diff.formDataChanged && (
        <div className="test-def-diff-row modified">
          <span className="test-def-diff-badge modified">~</span>
          <span className="test-def-diff-field">Form Data</span>
          <span className="test-def-diff-val">form fields modified</span>
        </div>
      )}
    </div>
  );
}

function HeadersDiffView({ diff }: { diff: ReturnType<typeof computeSnapshotDiff> }) {
  const hasChanges = diff.headersAdded.length > 0 || diff.headersRemoved.length > 0 || diff.headersModified.length > 0;
  if (!hasChanges) return <div className="test-def-diff-empty">No header changes</div>;

  return (
    <div className="test-def-diff-section">
      {diff.headersAdded.map((h) => (
        <div key={`add-${h.key}`} className="test-def-diff-row added">
          <span className="test-def-diff-badge added">+</span>
          <span className="test-def-diff-field">{h.key}</span>
          <span className="test-def-diff-val">{h.value}</span>
        </div>
      ))}
      {diff.headersRemoved.map((h) => (
        <div key={`rem-${h.key}`} className="test-def-diff-row removed">
          <span className="test-def-diff-badge removed">−</span>
          <span className="test-def-diff-field">{h.key}</span>
          <span className="test-def-diff-val">{h.value}</span>
        </div>
      ))}
      {diff.headersModified.map((h) => (
        <div key={`mod-${h.key}`} className="test-def-diff-row modified">
          <span className="test-def-diff-badge modified">~</span>
          <span className="test-def-diff-field">{h.key}</span>
          <span className="test-def-diff-val">
            <span className="test-def-diff-old">{h.oldValue}</span>
            <span className="test-def-diff-arrow">→</span>
            <span className="test-def-diff-new">{h.newValue}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function BodyDiffView({ older, newer, diff }: { older: TestDefinitionSnapshot; newer: TestDefinitionSnapshot; diff: ReturnType<typeof computeSnapshotDiff> }) {
  if (!diff.bodyChanged) return <div className="test-def-diff-empty">No body changes</div>;

  return (
    <div className="test-def-diff-section">
      <InlineDiff oldObj={tryParse(older.body)} newObj={tryParse(newer.body)} />
    </div>
  );
}

function AuthDiffView({ older, newer, diff }: { older: TestDefinitionSnapshot; newer: TestDefinitionSnapshot; diff: ReturnType<typeof computeSnapshotDiff> }) {
  if (!diff.authChanged) return <div className="test-def-diff-empty">No auth changes</div>;

  return (
    <div className="test-def-diff-section">
      <InlineDiff oldObj={older.auth} newObj={newer.auth} />
    </div>
  );
}

function ExtractionsDiffView({ older, newer, diff }: { older: TestDefinitionSnapshot; newer: TestDefinitionSnapshot; diff: ReturnType<typeof computeSnapshotDiff> }) {
  if (!diff.extractionsModified && diff.extractionsAdded === 0 && diff.extractionsRemoved === 0) {
    return <div className="test-def-diff-empty">No extraction changes</div>;
  }

  return (
    <div className="test-def-diff-section">
      <InlineDiff oldObj={older.extractions ?? []} newObj={newer.extractions ?? []} />
    </div>
  );
}

function InlineDiff({ oldObj, newObj }: { oldObj: unknown; newObj: unknown }) {
  const result = useMemo(() => differ.diff(oldObj, newObj), [oldObj, newObj]);
  return (
    <div className="test-def-diff-json-viewer" data-theme="monokai">
      <Viewer diff={result} indent={2} lineNumbers highlightInlineDiff />
    </div>
  );
}

function tryParse(s: string): unknown {
  try { return JSON.parse(s); } catch { return s; }
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
