import { useEffect, useMemo, useState } from 'react';
import type { GrpcCallResult } from '../../../shared/grpc/contracts';
import type { GrpcResponseSnapshotBaseline } from '../../../shared/grpc/grpcSavedRequest';
import {
  captureGrpcResponseSnapshotBaseline,
  compareGrpcResponseToBaseline,
  savedRequestMatchesUnaryResult,
} from '../utils/grpcResponseSnapshot';
import { GrpcResponseSnapshotDiffModal } from './GrpcResponseSnapshotDiffModal';

export interface GrpcResponseSnapshotPanelProps {
  callType: string;
  service: string;
  method: string;
  baseline?: GrpcResponseSnapshotBaseline;
  lastResult?: GrpcCallResult;
  onUpdateBaseline: (baseline: GrpcResponseSnapshotBaseline) => void;
  onClearBaseline: () => void;
}

function formatSnapshotTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

export function GrpcResponseSnapshotPanel({
  callType,
  service,
  method,
  baseline,
  lastResult,
  onUpdateBaseline,
  onClearBaseline,
}: GrpcResponseSnapshotPanelProps) {
  const [diffOpen, setDiffOpen] = useState(false);

  const canCompare = savedRequestMatchesUnaryResult(
    { service, method, callType },
    lastResult,
  );

  const comparison = useMemo(
    () => compareGrpcResponseToBaseline(canCompare ? lastResult : undefined, baseline),
    [baseline, canCompare, lastResult],
  );

  useEffect(() => {
    if (!baseline) setDiffOpen(false);
  }, [baseline]);

  if (callType !== 'unary') {
    return null;
  }

  const canUpdateBaseline = canCompare && lastResult?.status === 0;

  return (
    <>
      <div className="grpc-info-card" data-testid="grpc-response-snapshot-panel">
        <div className="grpc-info-card__header grpc-response-snapshot-panel__header">
          <span>Response snapshot</span>
          <div className="grpc-response-snapshot-panel__actions">
            {comparison.state === 'match' && (
              <span className="grpc-snapshot-badge grpc-snapshot-badge--match" data-testid="grpc-snapshot-badge-match">
                Matches baseline
              </span>
            )}
            {comparison.state === 'diff' && (
              <span className="grpc-snapshot-badge grpc-snapshot-badge--diff" data-testid="grpc-snapshot-badge-diff">
                Differs from baseline
              </span>
            )}
            {!baseline && (
              <span className="grpc-snapshot-badge grpc-snapshot-badge--new" data-testid="grpc-snapshot-badge-none">
                No baseline
              </span>
            )}
            {comparison.state === 'diff' && (
              <button
                type="button"
                className="grpc-btn grpc-btn--ghost grpc-btn--xs"
                data-testid="grpc-snapshot-view-diff"
                onClick={() => setDiffOpen(true)}
              >
                View diff
              </button>
            )}
            <button
              type="button"
              className="grpc-btn grpc-btn--ghost grpc-btn--xs"
              data-testid="grpc-snapshot-update-baseline"
              disabled={!canUpdateBaseline}
              title={canUpdateBaseline ? 'Save active tab last response as baseline' : 'Run a successful unary call in Studio first'}
              onClick={() => {
                if (!lastResult || lastResult.status !== 0) return;
                try {
                  onUpdateBaseline(captureGrpcResponseSnapshotBaseline(lastResult));
                } catch {
                  /* capture guarded by canUpdateBaseline */
                }
              }}
            >
              Update baseline
            </button>
            {baseline && (
              <button
                type="button"
                className="grpc-btn grpc-btn--ghost grpc-btn--xs"
                data-testid="grpc-snapshot-clear-baseline"
                onClick={onClearBaseline}
              >
                Clear
              </button>
            )}
          </div>
        </div>
        <div className="grpc-response-snapshot-panel__body">
          {!baseline && (
            <p className="grpc-response-snapshot-panel__hint">
              Save a baseline from the last successful Studio response to detect regressions on future runs.
            </p>
          )}
          {baseline && comparison.state === 'match' && canCompare && (
            <p className="grpc-response-snapshot-panel__status grpc-response-snapshot-panel__status--ok" role="status">
              Active tab response matches baseline.
            </p>
          )}
          {baseline && comparison.state === 'diff' && canCompare && (
            <p className="grpc-response-snapshot-panel__status grpc-response-snapshot-panel__status--diff" role="status">
              {comparison.diffs.length} difference{comparison.diffs.length === 1 ? '' : 's'} from baseline
              {comparison.statusMismatch ? ' (includes gRPC status)' : ''}.
            </p>
          )}
          {baseline && !canCompare && (
            <p className="grpc-response-snapshot-panel__hint">
              Baseline recorded {formatSnapshotTime(baseline.capturedAt)} — open in Studio and run to compare.
            </p>
          )}
        </div>
      </div>
      <GrpcResponseSnapshotDiffModal
        open={diffOpen}
        diffs={comparison.diffs}
        baseline={baseline}
        actual={canCompare ? lastResult : undefined}
        onClose={() => setDiffOpen(false)}
      />
    </>
  );
}
