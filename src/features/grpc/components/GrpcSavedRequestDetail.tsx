import {
  previewGrpcSavedRequestForUi,
  serializeGrpcPreviewJson,
} from '../../../shared/grpc/grpcSafePreview';
import type { GrpcSavedRequest } from '../../../shared/grpc/grpcSavedRequest';
import {
  formatGrpcCallTypeBadge,
  formatGrpcCallTypeLabel,
  grpcCallTypeBadgeModifier,
} from '../utils/grpcExplorerUtils';
import { GrpcResponseSnapshotPanel } from './GrpcResponseSnapshotPanel';
import type { GrpcResponseSnapshotBaseline } from '../../../shared/grpc/grpcSavedRequest';
import type { GrpcCallResult } from '../../../shared/grpc/contracts';
import type { GrpcStreamLogEntry } from '../../../shared/grpc/contracts';
import type { GrpcErrorBody } from '../../../shared/grpc/contracts';

export interface GrpcSavedRequestDetailProps {
  saved: GrpcSavedRequest | null;
  grpcurlCommand: string;
  lastUnaryResult?: GrpcCallResult;
  onOpenInStudio: () => void;
  onCompareSchema?: () => void;
  onRunLoadTest?: () => void;
  onCopyGrpcurl: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onUpdateResponseBaseline?: (baseline: GrpcResponseSnapshotBaseline) => void;
  onClearResponseBaseline?: () => void;
  streamMessages?: GrpcStreamLogEntry[];
  streamLifecycle?: string;
  streamError?: GrpcErrorBody;
  streamComparisonEligible?: boolean;
  openInStudioDisabled?: boolean;
  openInStudioTitle?: string;
  compareSchemaDisabled?: boolean;
  compareSchemaTitle?: string;
  runLoadTestDisabled?: boolean;
  runLoadTestTitle?: string;
}

export function GrpcSavedRequestDetail({
  saved,
  grpcurlCommand,
  onOpenInStudio,
  onCompareSchema,
  onRunLoadTest,
  onCopyGrpcurl,
  onDuplicate,
  onDelete,
  onUpdateResponseBaseline,
  onClearResponseBaseline,
  lastUnaryResult,
  streamMessages,
  streamLifecycle,
  streamError,
  streamComparisonEligible,
  openInStudioDisabled = false,
  openInStudioTitle = 'Open in Studio',
  compareSchemaDisabled = false,
  compareSchemaTitle = 'Compare schema',
  runLoadTestDisabled = false,
  runLoadTestTitle = 'Run load test',
}: GrpcSavedRequestDetailProps) {
  if (!saved) {
    return (
      <div className="grpc-saved-request-detail grpc-saved-request-detail--empty" data-testid="grpc-saved-request-detail">
        <p className="grpc-saved-request-detail__empty">Select a saved request from the tree.</p>
      </div>
    );
  }

  const preview = previewGrpcSavedRequestForUi(saved);

  return (
    <div className="grpc-saved-request-detail" data-testid="grpc-saved-request-detail">
      <header className="grpc-saved-request-detail__header">
        <div>
          <h2 className="grpc-saved-request-detail__title">{preview.name}</h2>
          <p className="grpc-saved-request-detail__subtitle">
            {preview.service} / {preview.method}
            {' · '}
            {formatGrpcCallTypeLabel(preview.callType)}
            {' · '}
            {preview.target?.trim() || '{{grpcHost}}'}
          </p>
        </div>
        <div className="grpc-saved-request-detail__actions">
          <button type="button" className="grpc-btn grpc-btn--ghost grpc-btn--sm" data-testid="grpc-saved-request-copy-grpcurl" onClick={onCopyGrpcurl}>
            Copy grpcurl
          </button>
          <button type="button" className="grpc-btn grpc-btn--ghost grpc-btn--sm" data-testid="grpc-saved-request-duplicate" onClick={onDuplicate}>
            Duplicate
          </button>
          <button type="button" className="grpc-btn grpc-btn--ghost grpc-btn--sm" data-testid="grpc-saved-request-delete" onClick={onDelete}>
            Delete
          </button>
          <button
            type="button"
            className="grpc-btn grpc-btn--primary grpc-btn--sm"
            data-testid="grpc-saved-request-open-studio"
            onClick={onOpenInStudio}
            disabled={openInStudioDisabled}
            title={openInStudioTitle}
          >
            Open in Studio
          </button>
          {onCompareSchema && (
            <button
              type="button"
              className="grpc-btn grpc-btn--ghost grpc-btn--sm"
              data-testid="grpc-saved-request-compare-schema"
              onClick={onCompareSchema}
              disabled={compareSchemaDisabled}
              title={compareSchemaTitle}
            >
              Compare schema
            </button>
          )}
          {onRunLoadTest && (
            <button
              type="button"
              className="grpc-btn grpc-btn--ghost grpc-btn--sm"
              data-testid="grpc-saved-request-run-load-test"
              onClick={onRunLoadTest}
              disabled={runLoadTestDisabled}
              title={runLoadTestTitle}
            >
              Run load test
            </button>
          )}
        </div>
      </header>
      <div className="grpc-saved-request-detail__body">
        <div className="grpc-info-card">
          <div className="grpc-info-card__header">
            <span>Call type</span>
            <span className={`grpc-method-badge ${grpcCallTypeBadgeModifier(preview.callType)}`}>
              {formatGrpcCallTypeBadge(preview.callType)}
            </span>
          </div>
        </div>
        <div className="grpc-info-card">
          <div className="grpc-info-card__header">Request body</div>
          <pre className="grpc-info-card__pre">{serializeGrpcPreviewJson(preview.body)}</pre>
        </div>
        <div className="grpc-info-card">
          <div className="grpc-info-card__header">Metadata</div>
          <pre className="grpc-info-card__pre">{serializeGrpcPreviewJson(preview.metadata)}</pre>
        </div>
        <div className="grpc-info-card" data-testid="grpc-saved-request-run-stats">
          <div className="grpc-info-card__header">Run stats</div>
          <div className="grpc-saved-request-run-stats">
            <span>Total: {saved.runStats?.totalRuns ?? 0}</span>
            <span>Success: {saved.runStats?.successRuns ?? 0}</span>
            <span>Errors: {saved.runStats?.errorRuns ?? 0}</span>
            <span>
              Last status: {typeof saved.runStats?.lastGrpcStatus === 'number'
                ? String(saved.runStats.lastGrpcStatus)
                : '—'}
            </span>
          </div>
        </div>
        {onUpdateResponseBaseline && onClearResponseBaseline && (
          <GrpcResponseSnapshotPanel
            callType={preview.callType}
            service={preview.service}
            method={preview.method}
            baseline={saved.responseBaseline}
            lastResult={lastUnaryResult}
            streamMessages={streamMessages}
            streamLifecycle={streamLifecycle}
            streamError={streamError}
            streamComparisonEligible={streamComparisonEligible}
            onUpdateBaseline={onUpdateResponseBaseline}
            onClearBaseline={onClearResponseBaseline}
          />
        )}
        <div className="grpc-info-card">
          <div className="grpc-info-card__header">grpcurl command</div>
          <pre className="grpc-grpcurl-box">{grpcurlCommand}</pre>
        </div>
      </div>
    </div>
  );
}
