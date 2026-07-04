import { useState } from 'react';
import type { HttpResponse } from '../../../shared/utils/httpClient';
import JsonPreview from './JsonTreePreview';
import { useJsonTreeCollapseState } from '../../../shared/hooks/useJsonTreeCollapseState';

export default function MultiEnvResultRow({ envName, response, time }: { envName: string; response: HttpResponse; time: number }) {
  const [expanded, setExpanded] = useState(false);
  const { collapsedSet, handleTreeToggle } = useJsonTreeCollapseState();
  const isSuccess = response.status >= 200 && response.status < 300;
  return (
    <div className={`req-multi-row ${isSuccess ? 'success' : 'error'}`}>
      <div className="req-multi-row-header" onClick={() => setExpanded(!expanded)}>
        <span className="req-multi-arrow">{expanded ? '▾' : '▸'}</span>
        <span className="req-multi-env">{envName}</span>
        <span className={`req-status-pill ${isSuccess ? 'success' : 'error'}`}>{response.status || 'ERR'}</span>
        <span className="req-stat">{time} ms</span>
      </div>
      {expanded && <div className="req-multi-row-body"><JsonPreview body={response.body} error={response.error} collapsedSet={collapsedSet} onToggle={handleTreeToggle} /></div>}
    </div>
  );
}
