import { useCallback } from 'react';
import type { RequestResult } from '../types';
import WaterfallBar from './WaterfallBar';

type ResponseDetailModalProps = {
  result: RequestResult | null;
  onClose: () => void;
};

export default function ResponseDetailModal({ result, onClose }: ResponseDetailModalProps) {
  const formatResponseBody = useCallback((body: string) => {
    try {
      return JSON.stringify(JSON.parse(body), null, 2);
    } catch {
      return body;
    }
  }, []);

  if (!result) return null;

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal response-detail-modal">
        <div className="modal-header">
          <h3>Response Detail</h3>
        </div>
        <div className="response-detail-body">
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

          {result.responseBody && (
            <div className="response-detail-section">
              <h4>Response Body</h4>
              <pre className="response-body-pre">{formatResponseBody(result.responseBody)}</pre>
            </div>
          )}
        </div>
        <div className="response-detail-footer">
          <button className="btn btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
