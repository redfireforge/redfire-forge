import { useState } from 'react';
import AppModalFrame from '../../../shared/components/AppModalFrame';
import { CustomSelect } from '../../../shared/components/CustomSelect';
import { normalizeRequest } from '../../../shared/api-mock/requestNormalization';
import { simulateSingle } from '../../../shared/api-mock/simulation';
import type { ApiMockServerDefinitionV1, ApiMockSimulationResultV1 } from '../../../shared/api-mock/contracts';

interface Props {
  server: ApiMockServerDefinitionV1;
  initialPath?: string;
  initialMethod?: string;
  onClose: () => void;
}

const METHOD_OPTIONS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].map(m => ({ value: m, label: m }));

export function ApiMockSimulateModal({ server, initialPath = '/', initialMethod = 'GET', onClose }: Props) {
  const [method, setMethod] = useState(initialMethod);
  const [path, setPath] = useState(initialPath);
  const [headers, setHeaders] = useState('');
  const [body, setBody] = useState('');
  const [result, setResult] = useState<ApiMockSimulationResultV1 | null>(null);

  const run = () => {
    const headerMap: Record<string, string> = {};
    for (const line of headers.split('\n')) {
      const idx = line.indexOf(':');
      if (idx > 0) headerMap[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
    const { captured } = normalizeRequest({ method, url: path || '/', headers: headerMap, body: body || null });
    const res = simulateSingle(
      { id: 'sim', name: 'Ad-hoc simulation', request: captured },
      { routes: server.routes, settings: server.settings, basePath: server.basePath },
    );
    setResult(res);
  };

  const trace = result?.trace;
  const winnerId = trace?.policyDecision.selectedRouteId;

  return (
    <AppModalFrame
      title="Simulate request"
      onClose={onClose}
      footer={
        <div className="api-mock-root am-in-modal" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="am-btn" onClick={onClose} data-testid="api-mock-simulate-close">Close</button>
          <button className="am-btn primary" onClick={run} data-testid="api-mock-simulate-run">Run simulation</button>
        </div>
      }
    >
      <div className="api-mock-root am-in-modal" style={{ minWidth: 520 }}>
        <div className="am-form-grid">
          <div className="am-form-row">
            <div className="am-form-label">Method</div>
            <div className="am-form-control">
              <CustomSelect value={method} onChange={setMethod} options={METHOD_OPTIONS} className="am-cs" aria-label="Simulate method" data-testid="api-mock-simulate-method" />
            </div>
          </div>
          <div className="am-form-row">
            <div className="am-form-label">Path</div>
            <div className="am-form-control">
              <input className="am-input wide mono" value={path} onChange={e => setPath(e.target.value)} placeholder="/users/42?active=true" data-testid="api-mock-simulate-path" />
            </div>
          </div>
          <div className="am-form-row">
            <div className="am-form-label">Headers</div>
            <div className="am-form-control">
              <textarea className="am-textarea" rows={2} value={headers} onChange={e => setHeaders(e.target.value)} placeholder={'X-Tenant: acme\nAuthorization: Bearer …'} data-testid="api-mock-simulate-headers" />
            </div>
          </div>
          <div className="am-form-row">
            <div className="am-form-label">Body</div>
            <div className="am-form-control">
              <textarea className="am-textarea" rows={3} value={body} onChange={e => setBody(e.target.value)} placeholder='{"name":"Alice"}' data-testid="api-mock-simulate-body" />
            </div>
          </div>
        </div>

        {result && trace && (
          <div style={{ marginTop: 14 }} data-testid="api-mock-simulate-result">
            <div className="am-section-heading">Outcome</div>
            <div className={`am-notice ${result.outcome === 'matched' ? '' : result.outcome === 'ambiguous' ? 'warning' : 'danger'}`}>
              <span>
                <strong>{result.outcome.toUpperCase()}</strong>
                {winnerId && <> → matched <span className="am-mono">{server.routes.find(r => r.id === winnerId)?.name ?? winnerId}</span></>}
                {' · '}{trace.policyDecision.matchedCount} candidate match{trace.policyDecision.matchedCount === 1 ? '' : 'es'}
              </span>
            </div>

            <div className="am-section-heading">Candidates evaluated ({trace.candidates.length})</div>
            <table className="am-data-table" aria-label="Simulation candidates">
              <thead>
                <tr>
                  <th style={{ width: 30 }} />
                  <th>Route</th>
                  <th style={{ width: 50 }}>Prio</th>
                  <th style={{ width: 60 }}>Method</th>
                  <th style={{ width: 50 }}>Path</th>
                  <th style={{ width: 70 }}>Match</th>
                </tr>
              </thead>
              <tbody>
                {trace.candidates.map(c => (
                  <tr key={c.routeId} className={c.routeId === winnerId ? 'selected' : ''}>
                    <td>{c.routeId === winnerId ? '★' : ''}</td>
                    <td style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.routeName}</td>
                    <td>P{c.priority}</td>
                    <td>{c.methodMatch ? '✓' : '✕'}</td>
                    <td>{c.pathMatch ? '✓' : '✕'}</td>
                    <td className={c.overallMatch ? '' : 'am-muted'}>{c.overallMatch ? 'match' : 'no'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {trace.nearMisses.length > 0 && (
              <>
                <div className="am-section-heading">Near misses</div>
                <div className="am-notice warning">
                  <span>{trace.nearMisses.map(nm => nm.routeName).join(', ')} matched method/path but failed conditions.</span>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </AppModalFrame>
  );
}
