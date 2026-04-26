import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { CatalogEntry, SavedEndpointValues } from '../types/catalog';
import type { AuthConfig, GlobalAuthProfile, Environment, Microservice } from '../../../shared/types';
import CatalogEndpointCard from './CatalogEndpointCard';
import CatalogAuthPanel from './CatalogAuthPanel';
import { resolveBaseUrl } from '../utils/catalogCurlGenerator';
import { loadCatalogEndpointValues, saveCatalogEndpointValues } from '../../../shared/utils/storage';

interface Props {
  entry: CatalogEntry;
  auth: AuthConfig;
  onAuthChange: (auth: AuthConfig) => void;
  onHostChange: (patch: Partial<CatalogEntry['hostConfig']>) => void;
  globalAuthProfiles?: GlobalAuthProfile[];
  appEnvironments?: Environment[];
  appMicroservices?: Microservice[];
  onEditEntry?: () => void;
}

export default function CatalogEndpointBrowser({ entry, auth, onAuthChange, onHostChange, globalAuthProfiles, appEnvironments, appMicroservices, onEditEntry }: Props) {
  const [filter, setFilter] = useState('');
  const [collapsedTags, setCollapsedTags] = useState<Set<string>>(new Set());
  const [showAuthPanel, setShowAuthPanel] = useState(false);
  const [hideDeprecated, setHideDeprecated] = useState(false);
  const [epValues, setEpValues] = useState<Record<string, SavedEndpointValues>>({});
  const [epLoaded, setEpLoaded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const entryIdRef = useRef(entry.id);

  useEffect(() => {
    if (entry.id !== entryIdRef.current) {
      entryIdRef.current = entry.id;
      setEpValues({});
      setEpLoaded(false);
    }
    let cancelled = false;
    loadCatalogEndpointValues(entry.id).then(v => {
      if (!cancelled) { setEpValues(v); setEpLoaded(true); }
    });
    return () => { cancelled = true; };
  }, [entry.id]);

  const pendingEpValues = useRef<Record<string, SavedEndpointValues>>({});

  const handleEpValuesChange = useCallback((endpointId: string, vals: SavedEndpointValues) => {
    setEpValues(prev => {
      const next = { ...prev, [endpointId]: vals };
      pendingEpValues.current = next;
      return next;
    });
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveCatalogEndpointValues(entry.id, pendingEpValues.current);
    }, 600);
  }, [entry.id]);

  const toggleTag = useCallback((tagId: string) => {
    setCollapsedTags(prev => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId); else next.add(tagId);
      return next;
    });
  }, []);

  const filterLc = filter.toLowerCase();
  const applyFilters = useCallback((eps: typeof entry.endpoints) => {
    let result = eps;
    if (hideDeprecated) result = result.filter(e => !e.deprecated);
    if (filterLc) {
      result = result.filter(e =>
        e.path.toLowerCase().includes(filterLc) ||
        e.summary.toLowerCase().includes(filterLc) ||
        e.method.toLowerCase().includes(filterLc) ||
        (e.operationId ?? '').toLowerCase().includes(filterLc)
      );
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterLc, hideDeprecated]);

  const filteredFolders = useMemo(() =>
    entry.folders.map(f => ({ ...f, endpoints: applyFilters(f.endpoints) })).filter(f => f.endpoints.length > 0),
    [entry.folders, applyFilters],
  );

  const filteredRoot = useMemo(() => applyFilters(entry.endpoints), [entry.endpoints, applyFilters]);

  const hasDeprecated = useMemo(() => {
    const check = (eps: typeof entry.endpoints) => eps.some(e => e.deprecated);
    return check(entry.endpoints) || entry.folders.some(f => check(f.endpoints));
  }, [entry]);

  const linkedSvc = useMemo(
    () => entry.microserviceId ? appMicroservices?.find(s => s.id === entry.microserviceId) : undefined,
    [entry.microserviceId, appMicroservices],
  );

  const svcEnvOptions = useMemo(() => {
    if (!linkedSvc) return [];
    const allEnvs = [...(appEnvironments ?? []), ...(linkedSvc.customEnvs ?? [])];
    return allEnvs
      .filter(e => linkedSvc.baseUrls[e.id] || linkedSvc.authProfileIds?.[e.id])
      .map(e => ({
        envId: e.id,
        envName: e.name,
        baseUrl: linkedSvc.baseUrls[e.id] ?? '',
      }));
  }, [linkedSvc, appEnvironments]);

  const hasEnvOptions = linkedSvc ? svcEnvOptions.length > 0 : (entry.environments?.length ?? 0) > 0;
  const showEnvButton = hasEnvOptions || (appMicroservices?.length ?? 0) > 0;

  const currentVersion = entry.versions.find(v => v.id === entry.currentVersionId);
  const baseUrl = resolveBaseUrl(entry.hostConfig, entry.servers, entry.environments, linkedSvc);

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
              {showEnvButton && (
                <button
                  className={`ceb-strat-btn ${entry.hostConfig.strategy === 'environment' ? 'active' : ''}`}
                  onClick={() => {
                    if (!hasEnvOptions) {
                      onEditEntry?.();
                      return;
                    }
                    const firstId = linkedSvc
                      ? svcEnvOptions[0]?.envId
                      : entry.environments?.[0]?.id;
                    onHostChange({ strategy: 'environment', environmentId: entry.hostConfig.environmentId ?? firstId });
                  }}
                  title={
                    !hasEnvOptions
                      ? 'Link a microservice to enable environment switching'
                      : linkedSvc ? `Use environment from ${linkedSvc.name}` : 'Use a configured environment'
                  }
                >
                  Environment
                </button>
              )}
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

            {entry.hostConfig.strategy === 'environment' && hasEnvOptions && (
              <select
                className="ceb-server-select"
                value={entry.hostConfig.environmentId ?? ''}
                onChange={e => onHostChange({ strategy: 'environment', environmentId: e.target.value })}
              >
                {linkedSvc ? svcEnvOptions.map(opt => (
                  <option key={opt.envId} value={opt.envId}>
                    {opt.envName}{opt.baseUrl ? ` — ${opt.baseUrl}` : ' (no base URL)'}
                  </option>
                )) : entry.environments!.map(env => (
                  <option key={env.id} value={env.id}>
                    {env.name} — {env.baseUrl}
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

          <div className="ceb-filter-row">
            <input
              className="ceb-filter"
              type="text"
              placeholder="Filter endpoints..."
              value={filter}
              onChange={e => setFilter(e.target.value)}
            />
            {hasDeprecated && (
              <label className="ceb-deprecated-toggle">
                <input type="checkbox" checked={hideDeprecated} onChange={e => setHideDeprecated(e.target.checked)} />
                Hide deprecated
              </label>
            )}
          </div>
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
          globalAuthProfiles={globalAuthProfiles}
          onClose={() => setShowAuthPanel(false)}
        />
      )}

      {/* ── Endpoint list ───────────────────────── */}
      <div className="ceb-endpoints" key={`${entry.id}-${epLoaded}`}>
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
                    savedValues={epValues[ep.id]}
                    onValuesChange={(vals) => handleEpValuesChange(ep.id, vals)}
                    environments={entry.environments}
                    linkedMicroservice={linkedSvc}
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
                    savedValues={epValues[ep.id]}
                    onValuesChange={(vals) => handleEpValuesChange(ep.id, vals)}
                    environments={entry.environments}
                    linkedMicroservice={linkedSvc}
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
