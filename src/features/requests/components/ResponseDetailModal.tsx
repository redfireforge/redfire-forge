import { useState, useMemo, useCallback, useRef } from 'react';
import type { RequestResult } from '../../../shared/types';
import WaterfallBar from '../../test-runner/components/WaterfallBar';
import WorkflowEditorModalFrame from '../../workflow/components/modals/WorkflowEditorModalFrame';
import JsonTreeViewer from '../../../shared/components/JsonTreeViewer';
import JsonPreview, { buildJTree, type JNode } from './JsonTreePreview';
import { SearchMatchBar } from '../../../shared/components/SearchMatchBar';
import { useSearchMatchNavigation } from '../../../shared/hooks/useSearchMatchNavigation';

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
              <span className="tag tag-dim">#{result.id.replace(/^\D+/, '')}</span>
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
              <h4>RESPONSE BODY</h4>
              <div className="req-resp-search">
                <SearchMatchBar
                  value={responseSearch}
                  onChange={setResponseSearch}
                  currentMatch={searchMatchIdx + 1}
                  totalMatches={searchMatchCount}
                  onPrev={goPrevSearchMatch}
                  onNext={goNextSearchMatch}
                  onClear={() => { clearResponseSearch(); setSearchMatchCount(0); }}
                  placeholder="Search response..."
                  inputClassName="req-resp-search-input"
                  countClassName="req-resp-search-count"
                  navClassName="req-resp-search-nav"
                  clearClassName="req-resp-search-clear"
                />
                <button className="jt-expand-collapse-btn" onClick={handleExpandAll}>Expand All</button>
                <button className="jt-expand-collapse-btn" onClick={handleCollapseAll}>Collapse All</button>
              </div>
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
