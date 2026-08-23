import type { RequestDefinitionVersion, RequestDefinitionSnapshot } from '@shared/types';
import { formatTimestamp } from '@shared/utils/formatRelativeTime';
import { VersionHistoryPanel } from '@shared/components/version-diff';

interface Props {
  versions: RequestDefinitionVersion[];
  currentSnapshot: RequestDefinitionSnapshot;
  onRestore: (version: RequestDefinitionVersion) => void;
  onDelete: (versionId: string) => void;
  onRename: (versionId: string, label: string) => void;
  onCompare: (older: RequestDefinitionVersion, newer: RequestDefinitionVersion) => void;
}

export default function RequestDefinitionVersionPanel(props: Props) {
  return (
    <VersionHistoryPanel
      title="Request Definition History"
      emptyHint="Switch between requests to create definition snapshots automatically."
      renderItemActions={({ onView }) => (
        <button
          className="test-def-version-action-btn test-def-version-action-view"
          data-testid="version-view-btn"
          onClick={(e) => { e.stopPropagation(); onView(); }}
          title="View this version's snapshot"
        >
          👁 View
        </button>
      )}
      renderOverlay={(version, onClose) => (
        <RequestVersionSnapshotView version={version} onClose={onClose} />
      )}
      {...props}
    />
  );
}

function RequestVersionSnapshotView({ version, onClose }: { version: RequestDefinitionVersion; onClose: () => void }) {
  const s = version.snapshot;
  const label = version.label || formatTimestamp(version.timestamp);
  return (
    <div className="test-def-version-view-overlay" onClick={onClose}>
      <div className="test-def-version-view-modal" onClick={(e) => e.stopPropagation()}>
        <div className="test-def-version-view-header">
          <h4>Version Snapshot</h4>
          <span className="test-def-version-view-label">{label}</span>
        </div>
        <div className="test-def-version-view-body">
          <div className="test-def-version-view-row">
            <span className="test-def-version-view-key">Name</span>
            <span className="test-def-version-view-val">{s.name}</span>
          </div>
          <div className="test-def-version-view-row">
            <span className="test-def-version-view-key">Method</span>
            <span className="test-def-version-view-val">{s.method}</span>
          </div>
          <div className="test-def-version-view-row">
            <span className="test-def-version-view-key">URL</span>
            <span className="test-def-version-view-val test-def-version-view-url">{s.url}</span>
          </div>
          {s.headers.length > 0 && (
            <div className="test-def-version-view-row">
              <span className="test-def-version-view-key">Headers</span>
              <span className="test-def-version-view-val">
                {s.headers.map((h, i) => <div key={i}><code>{h.key}</code>: {h.value}</div>)}
              </span>
            </div>
          )}
          {s.body && (
            <div className="test-def-version-view-row">
              <span className="test-def-version-view-key">Body{s.bodyType ? ` (${s.bodyType})` : ''}</span>
              <pre className="test-def-version-view-pre">{s.body}</pre>
            </div>
          )}
          {s.bodyForm && s.bodyForm.length > 0 && (
            <div className="test-def-version-view-row">
              <span className="test-def-version-view-key">Form Data</span>
              <span className="test-def-version-view-val">
                {s.bodyForm.map((f, i) => <div key={i}><code>{f.key}</code>: {f.value}</div>)}
              </span>
            </div>
          )}
          <div className="test-def-version-view-row">
            <span className="test-def-version-view-key">Auth</span>
            <span className="test-def-version-view-val">{s.auth.type}</span>
          </div>
        </div>
        <div className="test-def-version-view-footer">
          <button className="btn btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
