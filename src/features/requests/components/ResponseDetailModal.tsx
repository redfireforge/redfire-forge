import { useState, useMemo, useCallback, useRef } from 'react';
import type { RequestResult } from '../../../shared/types';
import WaterfallBar from '../../test-runner/components/WaterfallBar';
import WorkflowEditorModalFrame from '../../workflow/components/modals/WorkflowEditorModalFrame';
import JsonTreeViewer from '../../../shared/components/JsonTreeViewer';
import JsonPreview, { buildJTree, type JNode } from './JsonTreePreview';
import ResponseBodySearchBar from './ResponseBodySearchBar';
import { useSearchMatchNavigation } from '../../../shared/hooks/useSearchMatchNavigation';
import { formatTransportStatus, getTransportMethodLabel, getTransportFamily } from '../../results/utils/transportStatus';

type ResponseDetailModalProps = {
  result: RequestResult | null;
  onClose: () => void;
};

export default function ResponseDetailModal({ result, onClose }: ResponseDetailModalProps) {
  const [searchMatchCount, setSearchMatchCount] = useState(0);
  const {
    searchQuery: responseSearch,
    setSearchQuery: setResponseSearch,
    currentMatchIndex: searchMatchIdx,
    setCurrentMatchIndex: setSearchMatchIdx,
    goNext: goNextSearchMatch,
    goPrev: goPrevSearchMatch,
    clear: clearResponseSearch,
  } = useSearchMatchNavigation(searchMatchCount);
  const [collapsedSet, setCollapsedSet] = useState<Set<string>>(new Set());

  const handleTreeToggle = useCallback((path: string) => {
    setCollapsedSet(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path); else next.add(path);
      return next;
    });
  }, []);

  const responseTree = useMemo(() => {
    if (!result?.responseBody) return null;
    try { return buildJTree(JSON.parse(result.responseBody), ''); } catch { return null; }
  }, [result?.responseBody]);

  const allTreePaths = useMemo(() => {
    if (!responseTree) return new Set<string>();
    const paths = new Set<string>();
    (function walk(node: JNode, p: string) {
      if (node.children?.length) { paths.add(p); node.children.forEach((c) => walk(c, `${p}/${c.key}`)); }
    })(responseTree, '');
    return paths;
  }, [responseTree]);

  const handleCollapseAll = useCallback(() => setCollapsedSet(new Set(allTreePaths)), [allTreePaths]);
  const handleExpandAll = useCallback(() => setCollapsedSet(new Set()), []);
  const searchMatchIdxRef = useRef(searchMatchIdx);
  searchMatchIdxRef.current = searchMatchIdx;
  const handleMatchCountChange = useCallback((count: number) => {
    setSearchMatchCount(count);
    if (searchMatchIdxRef.current >= count) setSearchMatchIdx(Math.max(0, count - 1));
  }, [setSearchMatchIdx]);

  if (!result) return null;

  const family = getTransportFamily(result.transportType);
  const isHttp = family === 'http';
  const methodLabel = getTransportMethodLabel(result);
  const statusLabel = formatTransportStatus(result);
  const statusTagClass = isHttp
    ? (result.httpStatus >= 400 || result.httpStatus === 0 ? 'tag-danger' : 'tag-info')
    : (result.passed ? 'tag-info' : 'tag-danger');
  const wsMeta = result.wsResultMeta;
  const hasWsMeta = !!(wsMeta && (wsMeta.url || wsMeta.connectionId || wsMeta.protocol || wsMeta.frameType || wsMeta.messageSize != null || wsMeta.closeCode != null));

  const familyIcon = family === 'kafka'
    ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>
    : family === 'ws'
      ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg>
      : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>;

  return (
    <WorkflowEditorModalFrame
      title="Response Detail"
      onClose={onClose}
      overlayClassName="response-detail-overlay"
      dialogClassName="response-detail-modal"
      bodyClassName="response-detail-body"
      footerClassName="response-detail-footer"
      expandMode="fullscreen"
      hideExpandButton
      footer={
        <div className="rd-footer-inner">
          <span className="rd-footer-hint">Esc to close</span>
          <button className="btn btn-primary" onClick={onClose}>Close</button>
        </div>
      }
    >
          {/* ── Hero header card ── */}
          <div className="rd-hero">
            <div className="rd-hero-top">
              <span className={`rd-method-badge method-${result.method.toLowerCase()}`}>
                {familyIcon}
                {methodLabel}
              </span>
              <span className="rd-hero-name">{result.scenarioName}</span>
              <span className="rd-hero-id">#{result.id.replace(/^\D+/, '')}</span>
            </div>
            <div className="rd-hero-url">{result.url}</div>
            <div className="rd-hero-stats">
              <span className={`rd-stat ${statusTagClass}`}>
                {statusLabel}
              </span>
              <span className="rd-stat rd-stat--time">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                {result.responseTimeMs} ms
              </span>
              <span className={`rd-stat ${result.passed ? 'rd-stat--pass' : 'rd-stat--fail'}`}>
                {result.passed ? (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
                ) : (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                )}
                {result.passed ? 'Passed' : 'Failed'}
              </span>
            </div>
          </div>

          {/* ── WS Details ── */}
          {family === 'ws' && hasWsMeta && wsMeta && (
            <div className="rd-section">
              <h4 className="rd-section-title">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg>
                WebSocket Details
              </h4>
              <div className="rd-kv-grid">
                {wsMeta.url && <><span className="rd-kv-label">URL</span><span className="rd-kv-value">{wsMeta.url}</span></>}
                {wsMeta.connectionId && <><span className="rd-kv-label">Connection ID</span><span className="rd-kv-value rd-kv-mono">{wsMeta.connectionId}</span></>}
                {wsMeta.protocol && <><span className="rd-kv-label">Protocol</span><span className="rd-kv-value">{wsMeta.protocol}</span></>}
                {wsMeta.frameType && <><span className="rd-kv-label">Frame Type</span><span className="rd-kv-value">{wsMeta.frameType}</span></>}
                {wsMeta.messageSize != null && <><span className="rd-kv-label">Message Size</span><span className="rd-kv-value rd-kv-mono">{wsMeta.messageSize.toLocaleString()} bytes</span></>}
                {wsMeta.closeCode != null && <><span className="rd-kv-label">Close Code</span><span className="rd-kv-value rd-kv-mono">{wsMeta.closeCode}</span></>}
              </div>
            </div>
          )}

          {/* ── Kafka Details ── */}
          {family === 'kafka' && result.kafkaResultMeta && (
            <div className="rd-section">
              <h4 className="rd-section-title">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>
                Kafka Details
              </h4>
              <div className="rd-kv-grid">
                <span className="rd-kv-label">Topic</span><span className="rd-kv-value rd-kv-mono">{result.kafkaResultMeta.topic}</span>
                <span className="rd-kv-label">Partition</span><span className="rd-kv-value rd-kv-mono">{result.kafkaResultMeta.partition}</span>
                <span className="rd-kv-label">Offset</span><span className="rd-kv-value rd-kv-mono">{result.kafkaResultMeta.offset}</span>
                {result.kafkaResultMeta.key != null && <><span className="rd-kv-label">Key</span><span className="rd-kv-value rd-kv-mono">{result.kafkaResultMeta.key}</span></>}
                {result.kafkaResultMeta.matchedMessages != null && <><span className="rd-kv-label">Matched Messages</span><span className="rd-kv-value rd-kv-mono">{result.kafkaResultMeta.matchedMessages}</span></>}
              </div>
            </div>
          )}

          {/* ── Timing Breakdown ── */}
          {isHttp && result.timing && (
            <div className="rd-section">
              <h4 className="rd-section-title">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                Timing Breakdown
              </h4>
              <WaterfallBar timing={result.timing} />
            </div>
          )}

          {/* ── Error Message ── */}
          {result.errorMessage && (
            <div className="rd-section">
              <h4 className="rd-section-title rd-section-title--danger">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                Error Message
              </h4>
              <div className="response-error-box">{typeof result.errorMessage === 'string' ? result.errorMessage : JSON.stringify(result.errorMessage)}</div>
            </div>
          )}

          {/* ── Validation Failures ── */}
          {result.failureDetails.length > 0 && (
            <div className="rd-section">
              <h4 className="rd-section-title rd-section-title--danger">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                Validation Failures
                <span className="rd-section-count">{result.failureDetails.length}</span>
              </h4>
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

          {/* ── Request Headers ── */}
          {result.requestLog && Object.keys(result.requestLog.headers).length > 0 && (
            <div className="rd-section">
              <h4 className="rd-section-title">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" /></svg>
                Request Headers
              </h4>
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

          {/* ── Request Body ── */}
          {result.requestLog?.body && (
            <div className="rd-section">
              <h4 className="rd-section-title">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                Request Body
              </h4>
              <JsonTreeViewer data={result.requestLog.body} defaultExpandDepth={3} maxHeight={300} />
            </div>
          )}

          {/* ── Response Headers ── */}
          {result.responseHeaders && Object.keys(result.responseHeaders).length > 0 && (
            <div className="rd-section">
              <h4 className="rd-section-title">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" /></svg>
                Response Headers
              </h4>
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

          {/* ── Response Body ── */}
          {result.responseBody && (
            <div className="rd-section">
              <h4 className="rd-section-title">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>
                Response Body
              </h4>
              <ResponseBodySearchBar
                value={responseSearch}
                onChange={setResponseSearch}
                currentMatch={searchMatchIdx + 1}
                totalMatches={searchMatchCount}
                onPrev={goPrevSearchMatch}
                onNext={goNextSearchMatch}
                onClear={() => { clearResponseSearch(); setSearchMatchCount(0); }}
                onExpandAll={handleExpandAll}
                onCollapseAll={handleCollapseAll}
              />
              <JsonPreview
                body={result.responseBody}
                search={responseSearch}
                collapsedSet={collapsedSet}
                onToggle={handleTreeToggle}
                prebuiltTree={responseTree}
                currentMatchIdx={searchMatchIdx}
                onMatchCountChange={handleMatchCountChange}
              />
            </div>
          )}
    </WorkflowEditorModalFrame>
  );
}
