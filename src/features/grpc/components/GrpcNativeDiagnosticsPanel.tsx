import { useMemo, useState } from 'react';
import type { UseGrpcStudioAdvancedFeaturesReturn } from '../hooks/useGrpcStudioAdvancedFeatures';
import { isTauri } from '@shared/utils/platform';
import {
  invokeGrpcNativeDiagnosticsNative,
  type GrpcNativeTauriDiagnosticsError,
} from '@shared/grpc/grpcNativeTauriDiagnostics';
import type { GrpcTauriNativeDiagnosticsResult } from '@shared/grpc/grpcTauriContracts';

export interface GrpcNativeDiagnosticsPanelProps {
  advanced: UseGrpcStudioAdvancedFeaturesReturn;
}

async function writeClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
  }
}

function formatError(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as GrpcNativeTauriDiagnosticsError).message);
  }
  return 'Failed to load native diagnostics snapshot';
}

export function GrpcNativeDiagnosticsPanel({ advanced }: GrpcNativeDiagnosticsPanelProps) {
  const [snapshot, setSnapshot] = useState<GrpcTauriNativeDiagnosticsResult | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  const json = useMemo(() => {
    if (!snapshot) {
      return '';
    }
    return JSON.stringify(snapshot, null, 2);
  }, [snapshot]);

  const onRefresh = async () => {
    setLoading(true);
    setError(undefined);
    try {
      const next = await invokeGrpcNativeDiagnosticsNative(advanced.activeTabId);
      setSnapshot(next);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setLoading(false);
    }
  };

  const onCopy = async () => {
    if (!json) {
      return;
    }
    try {
      await writeClipboard(json);
      setError(undefined);
    } catch {
      setError('Clipboard copy failed');
    }
  };

  return (
    <section className="grpc-advanced-panel" data-testid="grpc-native-diagnostics-panel">
      <header className="grpc-advanced-card__header">
        <div>
          <h2 className="grpc-advanced-card__title">Native diagnostics (Tauri)</h2>
          <p className="grpc-advanced-card__subtitle">
            Redacted runtime snapshot for channel pool, stream/session, and listener health.
          </p>
        </div>
        <div className="grpc-advanced-card__actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            data-testid="grpc-native-diagnostics-refresh"
            onClick={() => void onRefresh()}
            disabled={loading || !isTauri()}
          >
            {loading ? 'Refreshing…' : 'Refresh snapshot'}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            data-testid="grpc-native-diagnostics-copy"
            onClick={() => void onCopy()}
            disabled={!json}
          >
            Copy JSON
          </button>
        </div>
      </header>

      <div className="grpc-advanced-card">
        <div className="grpc-advanced-card__body">
          {!isTauri() && (
            <p className="grpc-advanced-hint" data-testid="grpc-native-diagnostics-unavailable">
              Native diagnostics are available only in the desktop Tauri runtime.
            </p>
          )}
          {error && (
            <p className="grpc-load-test-status grpc-load-test-status--error" data-testid="grpc-native-diagnostics-error">
              {error}
            </p>
          )}
          {!snapshot && !error && isTauri() && (
            <p className="grpc-advanced-hint" data-testid="grpc-native-diagnostics-empty">
              No snapshot loaded yet. Refresh to capture current native transport diagnostics.
            </p>
          )}
          <p className="grpc-advanced-hint" data-testid="grpc-native-diagnostics-tab-context">
            Active Studio tab: {advanced.activeTabLabel} (id: {advanced.activeTabId})
          </p>
          {snapshot && (
            <>
              <p className="grpc-advanced-hint" data-testid="grpc-native-diagnostics-snapshot-tab-id">
                Snapshot tab id: {snapshot.tabId ?? '(none provided)'}
              </p>
              <textarea
                className="grpc-advanced-textarea grpc-native-diagnostics-textarea"
                data-testid="grpc-native-diagnostics-json"
                value={json}
                readOnly
                aria-label="Native diagnostics JSON"
              />
            </>
          )}
        </div>
      </div>
    </section>
  );
}
