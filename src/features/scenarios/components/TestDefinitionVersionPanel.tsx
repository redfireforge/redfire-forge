import type { TestDefinitionVersion, TestDefinitionSnapshot } from '../../../shared/types';
import { formatTimestamp } from '../../../shared/utils/formatRelativeTime';
import { VersionHistoryPanel } from '../../../shared/components/version-diff';

interface Props {
  versions: TestDefinitionVersion[];
  currentSnapshot: TestDefinitionSnapshot;
  onRestore: (version: TestDefinitionVersion) => void;
  onDelete: (versionId: string) => void;
  onRename: (versionId: string, label: string) => void;
  onCompare: (older: TestDefinitionVersion, newer: TestDefinitionVersion) => void;
}

export default function TestDefinitionVersionPanel(props: Props) {
  return (
    <VersionHistoryPanel
      title="Definition History"
      emptyHint="Save the test to create a definition snapshot."
      renderItemActions={({ onView }) => (
        <button
          className="test-def-version-action-btn test-def-version-action-view"
          onClick={(e) => { e.stopPropagation(); onView(); }}
          title="View this version's snapshot"
        >
          👁 View
        </button>
      )}
      renderOverlay={(version, onClose) => (
        <VersionSnapshotView version={version} onClose={onClose} />
      )}
      {...props}
    />
  );
}

function VersionSnapshotView({ version, onClose }: { version: TestDefinitionVersion; onClose: () => void }) {
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
              <span className="test-def-version-view-key">Body</span>
              <pre className="test-def-version-view-pre">{s.body}</pre>
            </div>
          )}
          <div className="test-def-version-view-row">
            <span className="test-def-version-view-key">Auth</span>
            <span className="test-def-version-view-val">{s.auth.type}</span>
          </div>
          {s.extractions && s.extractions.length > 0 && (
            <div className="test-def-version-view-row">
              <span className="test-def-version-view-key">Extractions</span>
              <span className="test-def-version-view-val">{s.extractions.length} extraction(s)</span>
            </div>
          )}
        </div>
        <div className="test-def-version-view-footer">
          <button className="btn btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
