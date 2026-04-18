import { useState, useMemo, useCallback } from 'react';
import type { CatalogEntry } from '../../types/catalog';
import type { AuthConfig } from '../../types';
import CatalogEndpointCard from './CatalogEndpointCard';
import CatalogAuthPanel from './CatalogAuthPanel';
import { resolveBaseUrl } from '../../utils/catalogCurlGenerator';

interface Props {
  entry: CatalogEntry;
  auth: AuthConfig;
  onAuthChange: (auth: AuthConfig) => void;
  onHostChange: (patch: Partial<CatalogEntry['hostConfig']>) => void;
}

export default function CatalogEndpointBrowser({ entry, auth, onAuthChange, onHostChange }: Props) {
  const [filter, setFilter] = useState('');
  const [collapsedTags, setCollapsedTags] = useState<Set<string>>(new Set());
  const [showAuthPanel, setShowAuthPanel] = useState(false);

  const toggleTag = useCallback((tagId: string) => {
    setCollapsedTags(prev => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId); else next.add(tagId);
      return next;
    });
  }, []);

  const filterLc = filter.toLowerCase();
  const filteredFolders = useMemo(() =>
    entry.folders.map(f => ({
      ...f,
      endpoints: filterLc
        ? f.endpoints.filter(e =>
          e.path.toLowerCase().includes(filterLc) ||
          e.summary.toLowerCase().includes(filterLc) ||
          e.method.toLowerCase().includes(filterLc) ||
          (e.operationId ?? '').toLowerCase().includes(filterLc)
        )
        : f.endpoints,
    })).filter(f => f.endpoints.length > 0),
    [entry.folders, filterLc],
  );

  const filteredRoot = useMemo(() =>
    filterLc
      ? entry.endpoints.filter(e =>
        e.path.toLowerCase().includes(filterLc) ||
        e.summary.toLowerCase().includes(filterLc) ||
        e.method.toLowerCase().includes(filterLc)
      )
      : entry.endpoints,
    [entry.endpoints, filterLc],
  );

  const currentVersion = entry.versions.find(v => v.id === entry.currentVersionId);
  const baseUrl = resolveBaseUrl(entry.hostConfig, entry.servers);

  return (
    <div className="ceb-container">
      {/* ── Top header bar ──────────────────────── */}
      <div className="ceb-header">
        <div className="ceb-title-row">
          <h2 className="ceb-title">{entry.name}</h2>
          {currentVersion && <span className="ceb-version">v{currentVersion.version}</span>}
        </div>
        {entry.description && <p className="ceb-desc">{entry.description}</p>}

        <div className="ceb-toolbar">
          <div className="ceb-host-bar">
            <div className="ceb-host-strategy">
              <button
                className={`ceb-strat-btn ${entry.hostConfig.strategy === 'inherited' ? 'active' : ''}`}
                onClick={() => onHostChange({ strategy: 'inherited', selectedServerIndex: entry.hostConfig.selectedServerIndex ?? 0 })}
                disabled={entry.servers.length === 0}
                title={entry.servers.length === 0 ? 'No servers defined in spec' : 'Use server URL from the spec'}
              >
                From Spec
              </button>
              <button
                className={`ceb-strat-btn ${entry.hostConfig.strategy === 'hardcoded' ? 'active' : ''}`}
                onClick={() => onHostChange({ strategy: 'hardcoded', hardcodedUrl: entry.hostConfig.hardcodedUrl ?? baseUrl ?? '' })}
                title="Enter a custom base URL"
              >
                Custom URL
              </button>
            </div>

            {entry.hostConfig.strategy === 'inherited' && entry.servers.length > 0 && (
              <select
                className="ceb-server-select"
                value={entry.hostConfig.selectedServerIndex ?? 0}
                onChange={e => onHostChange({ strategy: 'inherited', selectedServerIndex: Number(e.target.value) })}
              >
                {entry.servers.map((s, i) => (
                  <option key={i} value={i}>
                    {s.url}{s.description ? ` — ${s.description}` : ''}
                  </option>
                ))}
              </select>
            )}

            {entry.hostConfig.strategy === 'hardcoded' && (
              <input
                className="ceb-host-input"
                placeholder="https://api.example.com/v1"
                value={entry.hostConfig.hardcodedUrl ?? ''}
                onChange={e => onHostChange({ strategy: 'hardcoded', hardcodedUrl: e.target.value })}
              />
            )}

            <button
              className={`ceb-auth-btn ${auth.type !== 'none' && auth.type !== 'inherit' ? 'active' : ''}`}
              onClick={() => setShowAuthPanel(!showAuthPanel)}
            >
              🔒 Authorize
            </button>
          </div>

          <input
            className="ceb-filter"
            type="text"
            placeholder="Filter endpoints..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
        </div>

        {baseUrl && (
          <div className="ceb-base-url">Base URL: <code>{baseUrl}</code></div>
        )}
      </div>

      {/* ── Auth panel ──────────────────────────── */}
      {showAuthPanel && (
        <CatalogAuthPanel
          auth={auth}
          onAuthChange={onAuthChange}
          securitySchemes={entry.securitySchemes}
          onClose={() => setShowAuthPanel(false)}
        />
      )}

      {/* ── Endpoint list ───────────────────────── */}
      <div className="ceb-endpoints">
        {filteredFolders.map(folder => (
          <div key={folder.id} className="ceb-tag-group">
            <div className="ceb-tag-header" onClick={() => toggleTag(folder.id)}>
              <span className={`ceb-tag-chevron ${collapsedTags.has(folder.id) ? '' : 'open'}`}>▾</span>
              <span className="ceb-tag-name">{folder.name}</span>
              {folder.description && <span className="ceb-tag-desc">{folder.description}</span>}
              <span className="ceb-tag-count">{folder.endpoints.length}</span>
            </div>
            {!collapsedTags.has(folder.id) && (
              <div className="ceb-tag-endpoints">
                {folder.endpoints.map(ep => (
                  <CatalogEndpointCard
                    key={ep.id}
                    endpoint={ep}
                    servers={entry.servers}
                    hostConfig={entry.hostConfig}
                    auth={auth}
                  />
                ))}
              </div>
            )}
          </div>
        ))}

        {filteredRoot.length > 0 && (
          <div className="ceb-tag-group">
            <div className="ceb-tag-header" onClick={() => toggleTag('__untagged__')}>
              <span className={`ceb-tag-chevron ${collapsedTags.has('__untagged__') ? '' : 'open'}`}>▾</span>
              <span className="ceb-tag-name ceb-tag-untagged">Other</span>
              <span className="ceb-tag-count">{filteredRoot.length}</span>
            </div>
            {!collapsedTags.has('__untagged__') && (
              <div className="ceb-tag-endpoints">
                {filteredRoot.map(ep => (
                  <CatalogEndpointCard
                    key={ep.id}
                    endpoint={ep}
                    servers={entry.servers}
                    hostConfig={entry.hostConfig}
                    auth={auth}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {filteredFolders.length === 0 && filteredRoot.length === 0 && (
          <div className="ceb-no-results">
            No endpoints match "{filter}"
          </div>
        )}
      </div>
    </div>
  );
}
