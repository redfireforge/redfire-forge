import { useState, useMemo } from 'react';
import type { TestDefinitionVersion, TestDefinitionSnapshot } from '@shared/types';
import { formatTimestamp } from '@shared/utils/formatRelativeTime';
import { computeSnapshotDiff } from '../utils/testDefinitionVersioning';
import {
  HeadersDiffView,
  BodyDiffView,
  AuthDiffView,
  InlineDiff,
  OverviewDiffView,
  DefinitionVersionDiffModal,
} from '@shared/components/version-diff';

type DiffTab = 'overview' | 'headers' | 'body' | 'auth' | 'extractions';

interface Props {
  open: boolean;
  older: TestDefinitionVersion;
  newer: TestDefinitionVersion;
  onClose: () => void;
}

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

  const tabs = [
    { id: 'overview', label: 'Overview', count: overviewCount },
    { id: 'headers', label: 'Headers', count: headersCount },
    { id: 'body', label: 'Body', count: diff.bodyChanged ? 1 : 0 },
    { id: 'auth', label: 'Auth', count: diff.authChanged ? 1 : 0 },
    { id: 'extractions', label: 'Extractions', count: extractCount },
  ];

  const olderLabel = older.label || formatTimestamp(older.timestamp);
  const newerLabel = newer.label || formatTimestamp(newer.timestamp);

  return (
    <DefinitionVersionDiffModal
      title="Definition Comparison"
      olderLabel={olderLabel}
      newerLabel={newerLabel}
      onClose={onClose}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(tab) => setActiveTab(tab as DiffTab)}
    >
      {activeTab === 'overview' && <OverviewDiffView older={older.snapshot} newer={newer.snapshot} diff={diff} />}
      {activeTab === 'headers' && <HeadersDiffView diff={diff} />}
      {activeTab === 'body' && <BodyDiffView older={older.snapshot} newer={newer.snapshot} diff={diff} />}
      {activeTab === 'auth' && <AuthDiffView older={older.snapshot} newer={newer.snapshot} diff={diff} />}
      {activeTab === 'extractions' && <ExtractionsDiffView older={older.snapshot} newer={newer.snapshot} diff={diff} />}
    </DefinitionVersionDiffModal>
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
