import type { CatalogRequestMeta, HttpMethod } from '../../../shared/types';

interface RequestCatalogApiInfoDrawerProps {
  method: HttpMethod;
  catalogMeta: CatalogRequestMeta;
  onClose: () => void;
}

export default function RequestCatalogApiInfoDrawer({
  method,
  catalogMeta: cm,
  onClose,
}: RequestCatalogApiInfoDrawerProps) {
  return (
    <div className="req-info-drawer">
      <div className="req-info-drawer-header">
        <span className="req-info-drawer-title">&#9432; API Reference</span>
        <button type="button" className="req-info-drawer-close" onClick={onClose} title="Close">&times;</button>
      </div>
      <div className="req-info-drawer-body">
        <div className="req-docs-section">
          <h4 className="req-docs-heading">Endpoint</h4>
          <div className="req-docs-meta-grid">
            {cm.operationId && <><span className="req-docs-label">Operation ID</span><code className="req-docs-value">{cm.operationId}</code></>}
            <span className="req-docs-label">Path</span><span className="req-docs-value">{method} {cm.originalPath}</span>
            {cm.sourceSpec && <><span className="req-docs-label">Source</span><span className="req-docs-value">{cm.sourceSpec}</span></>}
            {cm.catalogVersion && <><span className="req-docs-label">Spec Version</span><code className="req-docs-value">{cm.catalogVersion}</code></>}
            {cm.catalogEntryId && <><span className="req-docs-label">Entry ID</span><code className="req-docs-value req-docs-mono">{cm.catalogEntryId}</code></>}
            {cm.catalogEndpointId && <><span className="req-docs-label">Endpoint ID</span><code className="req-docs-value req-docs-mono">{cm.catalogEndpointId}</code></>}
            {cm.deprecated && <><span className="req-docs-label">Status</span><span className="req-docs-value req-docs-deprecated">&#9888; Deprecated</span></>}
          </div>
        </div>

        {cm.description && (
          <div className="req-docs-section">
            <h4 className="req-docs-heading">Description</h4>
            <p className="req-docs-text">{cm.description}</p>
          </div>
        )}

        {cm.tags.length > 0 && (
          <div className="req-docs-section">
            <h4 className="req-docs-heading">Tags</h4>
            <div className="req-catalog-tags">{cm.tags.map(t => <span key={t} className="req-catalog-tag">{t}</span>)}</div>
          </div>
        )}

        {cm.parameters && cm.parameters.length > 0 && (
          <div className="req-docs-section">
            <h4 className="req-docs-heading">Parameters</h4>
            <table className="req-docs-param-table">
              <thead><tr><th>Name</th><th>In</th><th>Type</th><th>Req</th><th>Description</th></tr></thead>
              <tbody>
                {cm.parameters.map(p => (
                  <tr key={`${p.in}-${p.name}`} className={p.required ? 'required' : ''}>
                    <td><code>{p.name}</code></td>
                    <td>{p.in}</td>
                    <td>{p.type ?? '—'}</td>
                    <td>{p.required ? 'Yes' : 'No'}</td>
                    <td>{p.description ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {cm.expectedResponses && cm.expectedResponses.length > 0 && (
          <div className="req-docs-section">
            <h4 className="req-docs-heading">Responses</h4>
            <table className="req-docs-param-table">
              <thead><tr><th>Status</th><th>Description</th></tr></thead>
              <tbody>
                {cm.expectedResponses.map(r => (
                  <tr key={r.statusCode}>
                    <td><code className={`req-docs-status ${r.statusCode.startsWith('2') ? 'success' : r.statusCode.startsWith('4') ? 'warn' : r.statusCode.startsWith('5') ? 'error' : ''}`}>{r.statusCode}</code></td>
                    <td>{r.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {cm.security && cm.security.length > 0 && (
          <div className="req-docs-section">
            <h4 className="req-docs-heading">Security</h4>
            <p className="req-docs-text">&#128274; {cm.security.join(', ')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
