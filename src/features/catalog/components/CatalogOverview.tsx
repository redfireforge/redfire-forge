import type { CatalogEntry, CatalogEndpoint } from '../types/catalog';
import { countEndpoints } from '../utils/openApiParser';
import { formatBytes } from '../../../shared/utils/helpers';

interface Props {
  entry: CatalogEntry;
  onReimport: () => void;
  onVersionHistory: () => void;
  onExportSpec: () => void;
  onConvertToOpenApi?: () => void;
}

import { SWAGGER_METHOD_COLORS as METHOD_COLORS } from '../../../shared/constants/httpMethodColors';

function collectAllEndpoints(entry: CatalogEntry): CatalogEndpoint[] {
  const eps = [...entry.endpoints];
  const walk = (folders: CatalogEntry['folders']) => {
    for (const f of folders) {
      eps.push(...f.endpoints);
      walk(f.folders);
    }
  };
  walk(entry.folders);
  return eps;
}

export default function CatalogOverview({ entry, onReimport, onVersionHistory, onExportSpec, onConvertToOpenApi }: Props) {
  const currentVersion = entry.versions.find(v => v.id === entry.currentVersionId);
  const allEps = collectAllEndpoints(entry);
  const totalEndpoints = countEndpoints(entry);

  const methodCounts: Record<string, number> = {};
  for (const ep of allEps) {
    methodCounts[ep.method] = (methodCounts[ep.method] ?? 0) + 1;
  }

  const deprecatedCount = allEps.filter(ep => ep.deprecated).length;

  return (
    <div className="cat-overview" data-testid="catalog-overview">
      <div className="cat-ov-header">
        <h2 className="cat-ov-title">{entry.name}</h2>
        {currentVersion && <span className="cat-ov-version">v{currentVersion.version}</span>}
        {currentVersion?.specFormat && (
          <span className="cat-ov-spec-format" data-testid="catalog-overview-spec-format" title="API specification schema format">
            {currentVersion.specFormat}
          </span>
        )}
      </div>

      {entry.description && <p className="cat-ov-desc">{entry.description}</p>}

      <div className="cat-ov-meta">
        {currentVersion && (
          <div className="cat-ov-meta-item">
            <span className="cat-ov-label">Last Imported</span>
            <span className="cat-ov-value">{new Date(currentVersion.importedAt).toLocaleString()}</span>
          </div>
        )}
        <div className="cat-ov-meta-item">
          <span className="cat-ov-label">Versions</span>
          <span className="cat-ov-value">{entry.versions.length}</span>
        </div>
        <div className="cat-ov-meta-item">
          <span className="cat-ov-label">Spec Size</span>
          <span className="cat-ov-value">{currentVersion ? formatBytes(currentVersion.specSize) : '—'}</span>
        </div>
      </div>

      {/* ── Quick Actions ──────────────────────── */}
      <div className="cat-ov-actions">
        <button className="cat-btn cat-btn-outline" onClick={onReimport}>Re-import</button>
        <button className="cat-btn cat-btn-outline" onClick={onExportSpec}>Export Spec</button>
        {onConvertToOpenApi && (
          <button className="cat-btn cat-btn-outline" data-testid="catalog-convert-btn" onClick={onConvertToOpenApi}>Convert / Upgrade OpenAPI</button>
        )}
        <button className="cat-btn cat-btn-outline" onClick={onVersionHistory}>Version History</button>
      </div>

      {/* ── Servers ────────────────────────────── */}
      {entry.servers.length > 0 && (
        <div className="cat-ov-section">
          <h3 className="cat-ov-section-title">Servers</h3>
          <div className="cat-ov-server-list">
            {entry.servers.map((s, i) => (
              <div key={i} className="cat-ov-server">
                <code>{s.resolvedUrl || s.url}</code>
                {s.resolvedUrl && s.resolvedUrl !== s.url && (
                  <span className="cat-ov-server-original" title="Original URL from spec">({s.url})</span>
                )}
                {s.description && <span className="cat-ov-server-desc">{s.description}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Endpoint Stats ─────────────────────── */}
      <div className="cat-ov-section">
        <h3 className="cat-ov-section-title">Endpoints ({totalEndpoints})</h3>

        <div className="cat-ov-method-stats">
          {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(m => {
            const count = methodCounts[m] ?? 0;
            if (count === 0) return null;
            return (
              <div key={m} className="cat-ov-method-bar">
                <span className="cat-ov-method-label" style={{ color: METHOD_COLORS[m] }}>{m}</span>
                <div className="cat-ov-bar-track">
                  <div className="cat-ov-bar-fill" style={{
                    width: `${(count / totalEndpoints) * 100}%`,
                    background: METHOD_COLORS[m],
                  }} />
                </div>
                <span className="cat-ov-method-count">{count}</span>
              </div>
            );
          })}
        </div>

        {deprecatedCount > 0 && (
          <div className="cat-ov-deprecated-note">
            {deprecatedCount} deprecated endpoint{deprecatedCount > 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* ── By Tag ─────────────────────────────── */}
      <div className="cat-ov-section">
        <h3 className="cat-ov-section-title">By Tag</h3>
        <div className="cat-ov-tag-list">
          {entry.folders.map(f => (
            <div key={f.id} className="cat-ov-tag-row">
              <span className="cat-ov-tag-name">{f.name}</span>
              <span className="cat-ov-tag-count">{f.endpoints.length}</span>
            </div>
          ))}
          {entry.endpoints.length > 0 && (
            <div className="cat-ov-tag-row cat-ov-tag-untagged">
              <span className="cat-ov-tag-name">Untagged</span>
              <span className="cat-ov-tag-count">{entry.endpoints.length}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Security Schemes ───────────────────── */}
      {Object.keys(entry.securitySchemes).length > 0 && (
        <div className="cat-ov-section">
          <h3 className="cat-ov-section-title">Security Schemes</h3>
          <div className="cat-ov-security-list">
            {Object.entries(entry.securitySchemes).map(([name, scheme]) => (
              <div key={name} className="cat-ov-security-item">
                <span className="cat-ov-scheme-name">{name}</span>
                <span className="cat-ov-scheme-type">{scheme.type}{scheme.scheme ? ` / ${scheme.scheme}` : ''}</span>
                {scheme.description && <span className="cat-ov-scheme-desc">{scheme.description}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
