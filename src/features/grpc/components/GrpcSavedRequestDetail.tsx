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

export interface GrpcSavedRequestDetailProps {
  saved: GrpcSavedRequest | null;
  grpcurlCommand: string;
  lastUnaryResult?: GrpcCallResult;
  onOpenInStudio: () => void;
  onCopyGrpcurl: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onUpdateResponseBaseline?: (baseline: GrpcResponseSnapshotBaseline) => void;
  onClearResponseBaseline?: () => void;
  openInStudioDisabled?: boolean;
  openInStudioTitle?: string;
}

export function GrpcSavedRequestDetail({
  saved,
  grpcurlCommand,
  onOpenInStudio,
  onCopyGrpcurl,
  onDuplicate,
  onDelete,
  onUpdateResponseBaseline,
  onClearResponseBaseline,
  lastUnaryResult,
  openInStudioDisabled = false,
  openInStudioTitle = 'Open in Studio',
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
        {onUpdateResponseBaseline && onClearResponseBaseline && (
          <GrpcResponseSnapshotPanel
            callType={preview.callType}
            service={preview.service}
            method={preview.method}
            baseline={saved.responseBaseline}
            lastResult={lastUnaryResult}
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
