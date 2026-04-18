import type { UseCatalogReturn } from '../hooks/useCatalog';
import CatalogWelcome from '../components/catalog/CatalogWelcome';

interface Props {
  catalog: UseCatalogReturn;
  onImport: () => void;
}

export default function ApiCatalog({ catalog, onImport }: Props) {
  if (!catalog.loaded) {
    return <div className="cat-loading">Loading API Catalog...</div>;
  }

  if (!catalog.selectedEntry) {
    return <CatalogWelcome onImport={onImport} />;
  }

  const entry = catalog.selectedEntry;
  const currentVersion = entry.versions.find(v => v.id === entry.currentVersionId);
  const totalEndpoints = entry.endpoints.length +
    entry.folders.reduce((s, f) => s + f.endpoints.length, 0);

  return (
    <div className="cat-overview">
      <div className="cat-overview-header">
        <h2 className="cat-overview-title">{entry.name}</h2>
        <div className="cat-overview-meta">
          {currentVersion && <span className="cat-overview-version">v{currentVersion.version}</span>}
          <span className="cat-overview-sep">&middot;</span>
          <span>{totalEndpoints} endpoint{totalEndpoints !== 1 ? 's' : ''}</span>
          <span className="cat-overview-sep">&middot;</span>
          <span>{entry.folders.length} tag{entry.folders.length !== 1 ? 's' : ''}</span>
          {currentVersion && (
            <>
              <span className="cat-overview-sep">&middot;</span>
              <span>Imported {new Date(currentVersion.importedAt).toLocaleDateString()}</span>
            </>
          )}
        </div>
      </div>

      {entry.description && (
        <p className="cat-overview-desc">{entry.description}</p>
      )}

      {entry.servers.length > 0 && (
        <div className="cat-overview-section">
          <h3 className="cat-section-title">Servers</h3>
          <div className="cat-overview-servers">
            {entry.servers.map((s, i) => (
              <div key={i} className="cat-server-row">
                <code className="cat-server-url">{s.url}</code>
                {s.description && <span className="cat-server-desc">{s.description}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="cat-overview-section">
        <h3 className="cat-section-title">Endpoints by Tag</h3>
        <div className="cat-overview-tags">
          {entry.folders.map(f => (
            <div key={f.id} className="cat-tag-row">
              <span className="cat-tag-name">{f.name}</span>
              <span className="cat-tag-bar-container">
                <span
                  className="cat-tag-bar"
                  style={{ width: `${Math.round((f.endpoints.length / totalEndpoints) * 100)}%` }}
                />
              </span>
              <span className="cat-tag-count">{f.endpoints.length}</span>
            </div>
          ))}
          {entry.endpoints.length > 0 && (
            <div className="cat-tag-row">
              <span className="cat-tag-name cat-tag-untagged">(untagged)</span>
              <span className="cat-tag-bar-container">
                <span
                  className="cat-tag-bar"
                  style={{ width: `${Math.round((entry.endpoints.length / totalEndpoints) * 100)}%` }}
                />
              </span>
              <span className="cat-tag-count">{entry.endpoints.length}</span>
            </div>
          )}
        </div>
      </div>

      <div className="cat-overview-section">
        <h3 className="cat-section-title">Methods</h3>
        <div className="cat-overview-methods">
          {methodCounts(entry).map(({ method, count, color }) => (
            <div key={method} className="cat-method-row">
              <span className="cat-method-badge" style={{ background: color }}>{method}</span>
              <span className="cat-method-count">{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const METHOD_COLORS: Record<string, string> = {
  GET: '#22c55e', POST: '#f59e0b', PUT: '#3b82f6', PATCH: '#8b5cf6', DELETE: '#ef4444',
};

function methodCounts(entry: { endpoints: { method: string }[]; folders: { endpoints: { method: string }[] }[] }) {
  const counts: Record<string, number> = {};
  const all = [...entry.endpoints, ...entry.folders.flatMap(f => f.endpoints)];
  for (const ep of all) counts[ep.method] = (counts[ep.method] ?? 0) + 1;
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .map(([method, count]) => ({ method, count, color: METHOD_COLORS[method] ?? '#888' }));
}
