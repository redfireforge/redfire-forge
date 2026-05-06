/**
 * PopulateFetchStep — Fetch step UI for PopulateFromApiModal.
 * Shows request preview, sends request, and displays debug info.
 */
import type { Scenario, DataSource } from '../../../shared/types';
import type { RequestDebugInfo, ResponseDebugInfo } from '../utils/populateFromApiUtils';
import { resolveScenarioFromDataRow } from '../../../engine/dataSourceExpander';

interface PopulateFetchStepProps {
  draft: Scenario;
  dataTable: DataSource;
  loading: boolean;
  error: string | null;
  lastRequest: RequestDebugInfo | null;
  lastResponse: ResponseDebugInfo | null;
  onFetch: () => void;
}

export default function PopulateFetchStep({
  draft,
  dataTable,
  loading,
  error,
  lastRequest,
  lastResponse,
  onFetch,
}: PopulateFetchStepProps) {
  const firstRow = dataTable.rows.find(r => r.enabled);
  const resolvedUrl = firstRow
    ? resolveScenarioFromDataRow(draft, dataTable.columns, firstRow, 0).url
    : draft.url;

  return (
    <div className="populate-api-fetch">
      <p className="populate-api-description">
        Send a request to this test's URL, then extract an array from the response to populate data rows.
        {dataTable.rows.some(r => r.enabled) && ' Variables will be resolved using the first enabled data row.'}
      </p>
      <div className="populate-api-hint">
        <strong>💡 Best for cross-API testing:</strong> Call a "list" API (e.g. <code>GET /users</code>) and use the
        returned array as input rows for a "detail" API (e.g. <code>GET /users/{'{{id}}'}</code>).
        Not useful when populating from the same endpoint — response fields are outputs, not inputs.
        <br /><em>See the "Populate from API" sample in Gallery Samples for a step-by-step example.</em>
      </div>
      <div className="populate-api-request-info">
        <span className={`method-badge method-${draft.method.toLowerCase()}`}>{draft.method}</span>
        <code className="populate-api-url">{resolvedUrl}</code>
      </div>
      {error && <div className="populate-api-error">⚠️ {error}</div>}
      <button
        className="btn btn-primary"
        disabled={loading}
        onClick={onFetch}
      >
        {loading ? '⏳ Sending…' : '▶ Send Request'}
      </button>

      {(lastRequest || lastResponse) && (
        <div className="populate-api-debug">
          <div className="populate-api-debug-title">Request / Response Details</div>

          {lastRequest && (
            <div className="populate-api-debug-block">
              <div className="populate-api-debug-subtitle">Request</div>
              <div className="populate-api-debug-line"><strong>Method:</strong> {lastRequest.method}</div>
              <div className="populate-api-debug-line"><strong>URL:</strong> {lastRequest.url}</div>
              <div className="populate-api-debug-line"><strong>Headers:</strong></div>
              <pre className="populate-api-debug-pre">
                {Object.keys(lastRequest.headers).length > 0
                  ? JSON.stringify(lastRequest.headers, null, 2)
                  : '{}'}
              </pre>
              <div className="populate-api-debug-line"><strong>Body:</strong></div>
              <pre className="populate-api-debug-pre">{lastRequest.body || '(empty)'}</pre>
            </div>
          )}

          {lastResponse && (
            <div className="populate-api-debug-block">
              <div className="populate-api-debug-subtitle">Response</div>
              <div className="populate-api-debug-line"><strong>Status:</strong> {lastResponse.status} {lastResponse.statusText}</div>
              {lastResponse.error && (
                <div className="populate-api-debug-line"><strong>Error:</strong> {lastResponse.error}</div>
              )}
              <div className="populate-api-debug-line"><strong>Body:</strong></div>
              <pre className="populate-api-debug-pre">{lastResponse.body || '(empty)'}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
