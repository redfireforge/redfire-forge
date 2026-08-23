/**
 * GqlPageToasts — collects all transient toast notifications shown by the
 * GraphQL Studio page: schema-change toast, APQ unsupported toast, and batch
 * unsupported toast.
 */
import type { GraphqlSchemaInfo, GraphqlSchemaSnapshot } from '@shared/types/graphql';

interface GqlPageToastsProps {
  // Schema change toast
  schemaDiffToast: boolean;
  snapshots: GraphqlSchemaSnapshot[];
  toastBaselineSnapshotId: string | null;
  schemaInfo: GraphqlSchemaInfo | null;
  onViewDiff: (snapshot: GraphqlSchemaSnapshot) => void;
  onSaveSnapshot: () => void | Promise<void>;
  onDismissSchemaDiff: () => void;

  // APQ unsupported
  apqUnsupportedToast: boolean;
  onDismissApq: () => void;

  // Batch unsupported
  batchUnsupportedToast: boolean;
  onDismissBatch: () => void;
}

export function GqlPageToasts({
  schemaDiffToast,
  snapshots,
  toastBaselineSnapshotId,
  schemaInfo,
  onViewDiff,
  onSaveSnapshot,
  onDismissSchemaDiff,
  apqUnsupportedToast,
  onDismissApq,
  batchUnsupportedToast,
  onDismissBatch,
}: GqlPageToastsProps) {
  return (
    <>
      {schemaDiffToast && (
        <div
          className="gql-schema-toast"
          role="status"
          aria-live="polite"
          data-testid="gql-schema-change-toast"
        >
          <span>Schema changed</span>
          {(() => {
            const baseline = toastBaselineSnapshotId
              ? snapshots.find((s) => s.id === toastBaselineSnapshotId)
              : undefined;
            return baseline ? (
              <button
                type="button"
                className="gql-schema-toast-link"
                onClick={() => {
                  if (!schemaInfo?.sdl) return;
                  onDismissSchemaDiff();
                  void Promise.resolve(onViewDiff(baseline)).catch(() => {});
                }}
              >
                View diff →
              </button>
            ) : (
              <button
                type="button"
                className="gql-schema-toast-link"
                onClick={() => {
                  onDismissSchemaDiff();
                  void Promise.resolve(onSaveSnapshot()).catch(() => {});
                }}
              >
                Save snapshot →
              </button>
            );
          })()}
          <button
            type="button"
            className="gql-schema-toast-close"
            onClick={onDismissSchemaDiff}
            aria-label="Dismiss schema change notification"
          >
            ✕
          </button>
        </div>
      )}

      {apqUnsupportedToast && (
        <div
          className="gql-schema-toast"
          role="status"
          aria-live="polite"
          data-testid="gql-apq-unsupported-toast"
        >
          <span>This server does not support APQ — disabled for this connection.</span>
          <button
            type="button"
            className="gql-schema-toast-close"
            onClick={onDismissApq}
            aria-label="Dismiss APQ unsupported notification"
          >
            ✕
          </button>
        </div>
      )}

      {batchUnsupportedToast && (
        <div
          className="gql-schema-toast"
          role="status"
          aria-live="polite"
          data-testid="gql-batch-unsupported-toast"
        >
          <span>This server does not support query batching — sent individually instead.</span>
          <button
            type="button"
            className="gql-schema-toast-close"
            onClick={onDismissBatch}
            aria-label="Dismiss batch unsupported notification"
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}
