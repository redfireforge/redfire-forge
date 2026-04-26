import { useState, useCallback, useEffect, useRef } from 'react';
import type { UseCatalogReturn } from './hooks/useCatalog';
import type { AuthConfig, GlobalAuthProfile, Environment, Microservice } from '../../shared/types';
import CatalogWelcome from './components/CatalogWelcome';
import CatalogEndpointBrowser from './components/CatalogEndpointBrowser';
import CatalogOverview from './components/CatalogOverview';

interface Props {
  catalog: UseCatalogReturn;
  onImport: () => void;
  onReimport?: (entryId: string) => void;
  onVersionHistory?: (entryId: string) => void;
  onExportSpec?: (entryId: string) => void;
  onSendToRequests?: (entry: NonNullable<UseCatalogReturn['selectedEntry']>) => void;
  onEditEntry?: (entryId: string) => void;
  globalAuthProfiles?: GlobalAuthProfile[];
  appEnvironments?: Environment[];
  appMicroservices?: Microservice[];
}

type View = 'overview' | 'endpoints';

export default function ApiCatalog({ catalog, onImport, onReimport, onVersionHistory, onExportSpec, onSendToRequests, onEditEntry, globalAuthProfiles, appEnvironments, appMicroservices }: Props) {
  const [auth, setAuth] = useState<AuthConfig>({ type: 'none' });
  const [view, setView] = useState<View>('endpoints');
  const prevEntryId = useRef<string | undefined>(undefined);
  const prevEnvId = useRef<string | undefined>(undefined);

  useEffect(() => {
    const entry = catalog.selectedEntry;
    if (!entry || entry.id === prevEntryId.current) return;
    prevEntryId.current = entry.id;
    prevEnvId.current = entry.hostConfig.environmentId;

    if (entry.savedAuth && entry.savedAuth.type !== 'none') {
      const saved = entry.savedAuth;
      if (saved.__globalProfileId && globalAuthProfiles?.length) {
        const liveProfile = globalAuthProfiles.find(p => p.id === saved.__globalProfileId);
        if (liveProfile) {
          setAuth({ ...liveProfile.auth, __globalProfileId: liveProfile.id, __globalProfileName: liveProfile.name }); // eslint-disable-line react-hooks/set-state-in-effect
          return;
        }
      }
      setAuth({ ...entry.savedAuth });
      return;
    }

    if (entry.microserviceId && globalAuthProfiles?.length && appMicroservices?.length) {
      const svc = appMicroservices.find(s => s.id === entry.microserviceId);
      if (svc?.authProfileIds) {
        const profileId = (entry.hostConfig.environmentId && svc.authProfileIds[entry.hostConfig.environmentId])
          || Object.values(svc.authProfileIds).find(Boolean);
        if (profileId) {
          const profile = globalAuthProfiles.find(p => p.id === profileId);
          if (profile) {
            setAuth({ ...profile.auth, __globalProfileId: profile.id, __globalProfileName: profile.name });
            return;
          }
        }
      }
    }

    const schemes = Object.entries(entry.securitySchemes);
    if (schemes.length > 0) {
      const [schemeName, scheme] = schemes[0];
      const base: AuthConfig = { type: 'bearer' };
      if (scheme.type === 'apiKey') {
        base.type = 'apikey';
        base.apiKeyName = scheme.name;
        base.apiKeyIn = scheme.in === 'query' ? 'query' : 'header';
      } else if (scheme.type === 'http' && scheme.scheme === 'basic') {
        base.type = 'basic';
      }
      setAuth({ ...base, __inherit: true, __schemeName: schemeName });
    } else {
      setAuth({ type: 'none' });
    }
  }, [catalog.selectedEntry, globalAuthProfiles, appMicroservices]);

  useEffect(() => {
    const entry = catalog.selectedEntry;
    if (!entry?.microserviceId || !globalAuthProfiles?.length || !appMicroservices?.length) return;
    const envId = entry.hostConfig.environmentId;
    if (envId === prevEnvId.current) return;
    prevEnvId.current = envId;
    if (!envId || entry.hostConfig.strategy !== 'environment') return;

    const svc = appMicroservices.find(s => s.id === entry.microserviceId);
    const profileId = svc?.authProfileIds?.[envId];
    if (profileId) {
      const profile = globalAuthProfiles.find(p => p.id === profileId);
      if (profile) {
        const newAuth: AuthConfig = { ...profile.auth, __globalProfileId: profile.id, __globalProfileName: profile.name };
        setAuth(newAuth); // eslint-disable-line react-hooks/set-state-in-effect
        catalog.updateEntry(entry.id, { savedAuth: newAuth });
        return;
      }
    }
    setAuth({ type: 'none' });
    catalog.updateEntry(entry.id, { savedAuth: { type: 'none' } });
  }, [catalog.selectedEntry, catalog, globalAuthProfiles, appMicroservices]);

  const handleAuthChange = useCallback((newAuth: AuthConfig) => {
    setAuth(newAuth);
    if (catalog.selectedEntry) {
      catalog.updateEntry(catalog.selectedEntry.id, { savedAuth: newAuth });
    }
  }, [catalog]);

  const handleHostChange = useCallback((patch: Partial<typeof catalog.selectedEntry extends null ? never : NonNullable<typeof catalog.selectedEntry>['hostConfig']>) => {
    if (!catalog.selectedEntry) return;
    catalog.updateEntry(catalog.selectedEntry.id, {
      hostConfig: { ...catalog.selectedEntry.hostConfig, ...patch },
    });
  }, [catalog]);

  if (!catalog.loaded) {
    return <div className="cat-loading">Loading API Catalog...</div>;
  }

  if (!catalog.selectedEntry) {
    return <CatalogWelcome onImport={onImport} />;
  }

  const entry = catalog.selectedEntry;

  return (
    <div className="cat-main-panel">
      <div className="cat-view-tabs">
        <button className={`cat-view-tab ${view === 'overview' ? 'active' : ''}`} onClick={() => setView('overview')}>
          Overview
        </button>
        <button className={`cat-view-tab ${view === 'endpoints' ? 'active' : ''}`} onClick={() => setView('endpoints')}>
          Endpoints
        </button>
        {onSendToRequests && (
          <button className="cat-view-tab cat-req-send" onClick={() => onSendToRequests(entry)}>
            Send All to Requests
          </button>
        )}
      </div>

      <div className="cat-view-pane" style={{ display: view === 'overview' ? 'flex' : 'none' }}>
        <CatalogOverview
          entry={entry}
          onReimport={() => onReimport?.(entry.id)}
          onVersionHistory={() => onVersionHistory?.(entry.id)}
          onExportSpec={() => onExportSpec?.(entry.id)}
        />
      </div>
      <div className="cat-view-pane" style={{ display: view === 'endpoints' ? 'flex' : 'none' }}>
        <CatalogEndpointBrowser
          entry={entry}
          auth={auth}
          onAuthChange={handleAuthChange}
          onHostChange={handleHostChange}
          globalAuthProfiles={globalAuthProfiles}
          appEnvironments={appEnvironments}
          appMicroservices={appMicroservices}
          onEditEntry={onEditEntry ? () => onEditEntry(entry.id) : undefined}
        />
      </div>
    </div>
  );
}
