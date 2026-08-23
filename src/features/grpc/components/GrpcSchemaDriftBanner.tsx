import type { GrpcDescriptorDriftState } from '@shared/grpc/contracts';
import type {
  GrpcSchemaDriftIssue,
  GrpcSchemaDriftRebindSuggestion,
} from '../utils/grpcSchemaDrift';

export interface GrpcSchemaDriftBannerProps {
  driftState: GrpcDescriptorDriftState;
  driftMessage?: string;
  driftIssues?: GrpcSchemaDriftIssue[];
  suggestedRebinds?: GrpcSchemaDriftRebindSuggestion[];
  onRebind: (service: string, method: string) => void;
  onPruneBody: () => void;
  onDismiss: () => void;
}

function driftRebindTestId(service: string, method: string): string {
  return `grpc-schema-drift-rebind-${service.replaceAll('.', '-')}-${method}`;
}

export function GrpcSchemaDriftBanner({
  driftState,
  driftMessage,
  driftIssues = [],
  suggestedRebinds = [],
  onRebind,
  onPruneBody,
  onDismiss,
}: GrpcSchemaDriftBannerProps) {
  if (driftState === 'none') {
    return null;
  }

  const isBlocking = driftState === 'blocking';
  const canPrune = driftIssues.some(
    (issue) => issue.kind === 'field_removed' || issue.kind === 'field_type_changed',
  );

  return (
    <div
      className={`grpc-schema-drift-banner grpc-schema-drift-banner--${driftState}`}
      data-testid="grpc-schema-drift-banner"
      role="status"
    >
      <div className="grpc-schema-drift-banner-content">
        <p className="grpc-schema-drift-banner-title">
          {isBlocking ? 'Schema drift — method unavailable' : 'Schema drift — review request draft'}
        </p>
        {driftMessage && (
          <p className="grpc-schema-drift-banner-message" data-testid="grpc-schema-drift-message">
            {driftMessage}
          </p>
        )}
        {driftIssues.length > 0 && (
          <ul className="grpc-schema-drift-banner-issues" data-testid="grpc-schema-drift-issues">
            {driftIssues.map((issue) => (
              <li key={`${issue.kind}-${issue.fieldName ?? issue.message}`}>{issue.message}</li>
            ))}
          </ul>
        )}
        {isBlocking && suggestedRebinds.length > 0 && (
          <div className="grpc-schema-drift-rebinds" data-testid="grpc-schema-drift-rebinds">
            <span className="grpc-schema-drift-rebinds-label">Suggested rebinding:</span>
            <div className="grpc-schema-drift-rebinds-list">
              {suggestedRebinds.map((entry) => (
                <button
                  key={`${entry.service}/${entry.method}`}
                  type="button"
                  className="grpc-schema-drift-rebind-btn"
                  data-testid={driftRebindTestId(entry.service, entry.method)}
                  onClick={() => onRebind(entry.service, entry.method)}
                >
                  <span className="grpc-schema-drift-rebind-target">{entry.service}/{entry.method}</span>
                  <span className="grpc-schema-drift-rebind-reason">{entry.reason}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="grpc-schema-drift-banner-actions">
        {canPrune && (
          <button
            type="button"
            className="grpc-schema-drift-action-btn"
            data-testid="grpc-schema-drift-prune-btn"
            onClick={onPruneBody}
          >
            Prune stale fields
          </button>
        )}
        {!isBlocking && (
          <button
            type="button"
            className="grpc-schema-drift-action-btn"
            data-testid="grpc-schema-drift-dismiss-btn"
            onClick={onDismiss}
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}
