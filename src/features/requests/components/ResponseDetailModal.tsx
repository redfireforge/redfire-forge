import { useState, useMemo } from 'react';
import type { RequestResult } from '../../../shared/types';
import WaterfallBar from '../../test-runner/components/WaterfallBar';
import WorkflowEditorModalFrame from '../../workflow/components/modals/WorkflowEditorModalFrame';
import { prettyJson } from '../../../shared/utils/helpers';

type ResponseDetailModalProps = {
  result: RequestResult | null;
  onClose: () => void;
};

export default function ResponseDetailModal({ result, onClose }: ResponseDetailModalProps) {
  const [prettyBody, setPrettyBody] = useState(true);

  if (!result) return null;

  return (
    <WorkflowEditorModalFrame
      title="Response Detail"
      onClose={onClose}
      overlayClassName="response-detail-overlay"
      dialogClassName="response-detail-modal"
      bodyClassName="response-detail-body"
      footerClassName="response-detail-footer"
      expandMode="fullscreen"
      footer={<button className="btn btn-primary" onClick={onClose}>Close</button>}
    >
          <div className="response-detail-meta">
            <div className="response-meta-row">
              <span className={`method-badge method-${result.method.toLowerCase()}`}>{result.method}</span>
              <span className="response-meta-name">{result.scenarioName}</span>
              <span className={`tag ${result.httpStatus >= 400 ? 'tag-danger' : result.httpStatus === 0 ? 'tag-danger' : 'tag-info'}`}>
                {result.httpStatus || 'ERR'}
              </span>
              <span className="tag">{result.responseTimeMs} ms</span>
              <span className={`tag ${result.passed ? 'tag-success' : 'tag-danger'}`}>
                {result.passed ? 'Passed' : 'Failed'}
              </span>
            </div>
            <div className="response-meta-url">{result.url}</div>
          </div>

          {result.timing && (
            <div className="response-detail-section">
              <h4>Timing Breakdown</h4>
              <WaterfallBar timing={result.timing} />
            </div>
          )}

          {result.errorMessage && (
            <div className="response-detail-section">
              <h4>Error Message</h4>
              <div className="response-error-box">{typeof result.errorMessage === 'string' ? result.errorMessage : JSON.stringify(result.errorMessage)}</div>
            </div>
          )}

          {result.failureDetails.length > 0 && (
            <div className="response-detail-section">
              <h4>Validation Failures ({result.failureDetails.length})</h4>
              <table className="response-failures-table">
                <thead>
                  <tr><th>Path</th><th>Expected</th><th>Actual</th></tr>
                </thead>
                <tbody>
                  {result.failureDetails.map((f, i) => (
                    <tr key={i}>
                      <td className="failure-path">{f.path}</td>
                      <td className="failure-expected">{typeof f.expected === 'string' ? f.expected : JSON.stringify(f.expected)}</td>
                      <td className="failure-actual">{typeof f.actual === 'string' ? f.actual : JSON.stringify(f.actual)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {result.requestLog && Object.keys(result.requestLog.headers).length > 0 && (
            <div className="response-detail-section">
              <h4>Request Headers</h4>
              <table className="response-headers-table">
                <thead>
                  <tr><th>Header</th><th>Value</th></tr>
                </thead>
                <tbody>
                  {Object.entries(result.requestLog.headers).map(([k, v]) => (
                    <tr key={k}>
                      <td className="header-name">{k}</td>
                      <td className="header-value">{k.toLowerCase() === 'authorization' ? '••••••••' : v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {result.requestLog?.body && (
            <div className="response-detail-section">
              <h4>Request Body</h4>
              <pre className="response-body-pre">{prettyJson(result.requestLog.body)}</pre>
            </div>
          )}

          {result.responseHeaders && Object.keys(result.responseHeaders).length > 0 && (
            <div className="response-detail-section">
              <h4>Response Headers</h4>
              <table className="response-headers-table">
                <thead>
                  <tr><th>Header</th><th>Value</th></tr>
                </thead>
                <tbody>
                  {Object.entries(result.responseHeaders).map(([k, v]) => (
                    <tr key={k}>
                      <td className="header-name">{k}</td>
                      <td className="header-value">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {result.responseBody && (
            <ResponseBodySection body={result.responseBody} pretty={prettyBody} onToggle={() => setPrettyBody(p => !p)} />
          )}
    </WorkflowEditorModalFrame>
  );
}

function looksLikeJson(text: string): boolean {
  const t = text.trimStart();
  return t.startsWith('{') || t.startsWith('[');
}

function bestEffortPrettyJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    // Truncated or malformed JSON — apply regex-based formatting
    return text
      .replace(/([{[,])\s*/g, '$1\n  ')
      .replace(/\s*([}\]])/g, '\n$1')
      .replace(/":\s*/g, '": ')
      .replace(/,\n\s*"/g, ',\n  "');
  }
}

function ResponseBodySection({ body, pretty, onToggle }: { body: string; pretty: boolean; onToggle: () => void }) {
  const jsonLike = useMemo(() => looksLikeJson(body), [body]);

  const formatted = useMemo(() => {
    if (!pretty || !jsonLike) return body;
    return bestEffortPrettyJson(body);
  }, [body, pretty, jsonLike]);

  return (
    <div className="response-detail-section">
      <div className="response-body-header">
        <h4>Response Body</h4>
        <div className="response-body-actions">
          {jsonLike && (
            <button
              className={`body-toggle-btn ${pretty ? 'active' : ''}`}
              onClick={onToggle}
              title={pretty ? 'Show raw' : 'Pretty print'}
            >
              {pretty ? '{ }' : '{ … }'}
            </button>
          )}
          <button
            className="body-toggle-btn"
            onClick={() => navigator.clipboard.writeText(formatted)}
            title="Copy to clipboard"
          >
            Copy
          </button>
        </div>
      </div>
      <pre className="response-body-pre">{formatted}</pre>
    </div>
  );
}
