import { useState, useMemo } from 'react';
import type { RequestDefinitionVersion } from '../../../shared/types';
import { formatTimestamp } from '../../../shared/utils/formatRelativeTime';
import { computeSnapshotDiff } from '../utils/requestDefinitionVersioning';
import { HeadersDiffView, BodyDiffView, AuthDiffView, OverviewDiffView } from '../../../shared/components/version-diff';

type DiffTab = 'overview' | 'headers' | 'body' | 'auth';

interface Props {
  open: boolean;
  older: RequestDefinitionVersion;
  newer: RequestDefinitionVersion;
  onClose: () => void;
}

export default function RequestDefinitionVersionDiff({ open, older, newer, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<DiffTab>('overview');

  const diff = useMemo(() => computeSnapshotDiff(older.snapshot, newer.snapshot), [older, newer]);

  if (!open) return null;

  const overviewCount = [
    diff.nameChanged, diff.urlChanged, diff.methodChanged,
    diff.bodyChanged, diff.bodyTypeChanged, diff.formDataChanged,
  ].filter(Boolean).length;
  const headersCount = diff.headersAdded.length + diff.headersRemoved.length + diff.headersModified.length;

  const tabs: Array<{ key: DiffTab; label: string; count: number }> = [
    { key: 'overview', label: 'Overview', count: overviewCount },
    { key: 'headers', label: 'Headers', count: headersCount },
    { key: 'body', label: 'Body', count: diff.bodyChanged ? 1 : 0 },
    { key: 'auth', label: 'Auth', count: diff.authChanged ? 1 : 0 },
  ];

  const olderLabel = older.label || formatTimestamp(older.timestamp);
  const newerLabel = newer.label || formatTimestamp(newer.timestamp);

  return (
    <div className="test-def-diff-overlay modal-overlay" onClick={onClose}>
      <div className="test-def-diff-modal" onClick={(e) => e.stopPropagation()}>
        <div className="test-def-diff-header">
          <h3>Request Definition Comparison</h3>
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
        </div>
      </div>
    </div>
  );
}
