import type { ApiMockRouteV1 } from '@shared/api-mock/contracts';
import type { HarPreviewResult } from '@shared/api-mock/harImport';
import type { PreviewState } from './apiMockImportReviewHelpers';
import { responseStatusMeta, splitPathParams } from './apiMockImportReviewHelpers';

interface Props {
  harIsParsed: boolean;
  harPreview: HarPreviewResult | null;
  preview: PreviewState | null;
}

export function ApiMockImportPreviewAside({ harIsParsed, harPreview, preview }: Props) {
  return (
    <aside className="am-import-preview">
      <div className="am-section-heading">Preview</div>
      {harIsParsed ? (
        <div className="am-muted" style={{ fontSize: 11 }}>
          {harPreview!.error
            ? 'Fix the HAR JSON error to preview routes.'
            : 'Select entries and click Import as draft to create rules.'}
        </div>
      ) : !preview || preview.routes.length === 0 ? (
        <div className="am-muted" style={{ fontSize: 11 }}>Parse a source to preview the generated sample request and default response template.</div>
      ) : (
        preview.routes.map((r, idx) => (
          <ImportPreviewCard
            key={r.id}
            route={r}
            idx={idx}
            multi={preview.routes.length > 1}
          />
        ))
      )}
    </aside>
  );
}

function ImportPreviewCard({ route: r, idx, multi }: { route: ApiMockRouteV1; idx: number; multi: boolean }) {
  const resp = r.responses[0];
  const status = resp?.status ?? 200;
  const body = resp?.body.content || '{}';
  const ct = resp?.body.contentType ?? 'application/json';
  const { statusClass, statusText } = responseStatusMeta(status);
  const pathParts = splitPathParams(r.path.value);

  return (
    <div className={`am-import-preview-card${idx > 0 ? ' am-import-preview-card--sep' : ''}`}>
      <div className="am-import-preview-card-head">
        {multi && <span className="am-import-preview-num">{idx + 1}</span>}
        <span className={`am-method ${r.method.toLowerCase()}`}>{r.method}</span>
        <span className="am-import-preview-head-path">
          {pathParts.map((part, i) =>
            part.startsWith('{') ? (
              <span key={i} className="am-import-preview-param">{part}</span>
            ) : (
              <span key={i}>{part}</span>
            ),
          )}
        </span>
      </div>
      <div className="am-import-preview-card-body">
        <div className="am-import-preview-label">Sample request</div>
        <div
          className="am-import-preview-req"
          data-testid={`api-mock-import-preview-request${multi ? `-${idx}` : ''}`}
        >
          <div className="am-import-preview-req-line">
            <span className={`am-method ${r.method.toLowerCase()}`}>{r.method}</span>
            <span className="am-import-preview-path">
              {pathParts.map((part, i) =>
                part.startsWith('{') ? (
                  <span key={i} className="am-import-preview-param">{part}</span>
                ) : (
                  <span key={i}>{part}</span>
                ),
              )}
            </span>
            <span className="am-import-preview-proto">HTTP/1.1</span>
          </div>
        </div>
        <div className="am-import-preview-label" style={{ marginTop: 8 }}>Default response</div>
        <div
          className="am-import-preview-resp"
          data-testid={`api-mock-import-preview-response${multi ? `-${idx}` : ''}`}
        >
          <div className="am-import-preview-resp-head">
            <span className={`am-badge ${statusClass}`}>{status}</span>
            <span className="am-import-preview-status-text">{statusText}</span>
            <span className="am-spacer" />
            <span className="am-import-preview-ct">{ct}</span>
          </div>
          <pre className="am-import-preview-body">{body}</pre>
        </div>
      </div>
    </div>
  );
}
