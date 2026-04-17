import { useState, useCallback } from 'react';
import type { HttpResponse } from '../../utils/httpClient';
import JsonPreview from './JsonTreePreview';

export default function MultiEnvResultRow({ envName, response, time }: { envName: string; response: HttpResponse; time: number }) {
  const [expanded, setExpanded] = useState(false);
  const [collapsedSet, setCollapsedSet] = useState<Set<string>>(new Set());
  const handleToggle = useCallback((path: string) => {
    setCollapsedSet(prev => { const n = new Set(prev); if (n.has(path)) n.delete(path); else n.add(path); return n; });
  }, []);
  const isSuccess = response.status >= 200 && response.status < 300;
  return (
    <div className={`wb-multi-row ${isSuccess ? 'success' : 'error'}`}>
      <div className="wb-multi-row-header" onClick={() => setExpanded(!expanded)}>
        <span className="wb-multi-arrow">{expanded ? '▾' : '▸'}</span>
        <span className="wb-multi-env">{envName}</span>
        <span className={`wb-status-pill ${isSuccess ? 'success' : 'error'}`}>{response.status || 'ERR'}</span>
        <span className="wb-stat">{time} ms</span>
      </div>
      {expanded && <div className="wb-multi-row-body"><JsonPreview body={response.body} error={response.error} collapsedSet={collapsedSet} onToggle={handleToggle} /></div>}
    </div>
  );
}
