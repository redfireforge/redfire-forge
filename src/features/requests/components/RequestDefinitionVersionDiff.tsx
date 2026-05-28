import { useState, useMemo } from 'react';
import type { RequestDefinitionVersion } from '../../../shared/types';
import { formatTimestamp } from '../../../shared/utils/formatRelativeTime';
import { computeSnapshotDiff } from '../utils/requestDefinitionVersioning';
import {
  HeadersDiffView,
  BodyDiffView,
  AuthDiffView,
  OverviewDiffView,
  DefinitionVersionDiffModal,
} from '../../../shared/components/version-diff';

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

  const tabs = [
    { id: 'overview', label: 'Overview', count: overviewCount },
    { id: 'headers', label: 'Headers', count: headersCount },
    { id: 'body', label: 'Body', count: diff.bodyChanged ? 1 : 0 },
    { id: 'auth', label: 'Auth', count: diff.authChanged ? 1 : 0 },
  ];

  const olderLabel = older.label || formatTimestamp(older.timestamp);
  const newerLabel = newer.label || formatTimestamp(newer.timestamp);

  return (
    <DefinitionVersionDiffModal
      title="Request Definition Comparison"
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
    </DefinitionVersionDiffModal>
  );
}
