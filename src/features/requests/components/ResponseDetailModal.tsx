import type { RequestResult } from '../../../shared/types';
import WaterfallBar from '../../test-runner/components/WaterfallBar';
import WorkflowEditorModalFrame from '../../workflow/components/modals/WorkflowEditorModalFrame';
import JsonTreeViewer from '../../../shared/components/JsonTreeViewer';

type ResponseDetailModalProps = {
  result: RequestResult | null;
  onClose: () => void;
};

export default function ResponseDetailModal({ result, onClose }: ResponseDetailModalProps) {

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
              <JsonTreeViewer data={result.requestLog.body} defaultExpandDepth={3} maxHeight={300} />
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
            <div className="response-detail-section">
              <h4>Response Body</h4>
              <JsonTreeViewer data={result.responseBody} defaultExpandDepth={3} maxHeight={0} searchable />
            </div>
          )}
    </WorkflowEditorModalFrame>
  );
}
