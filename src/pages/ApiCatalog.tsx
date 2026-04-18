import { useState, useCallback, useEffect, useRef } from 'react';
import type { UseCatalogReturn } from '../hooks/useCatalog';
import type { AuthConfig } from '../types';
import CatalogWelcome from '../components/catalog/CatalogWelcome';
import CatalogEndpointBrowser from '../components/catalog/CatalogEndpointBrowser';
import CatalogOverview from '../components/catalog/CatalogOverview';

interface Props {
  catalog: UseCatalogReturn;
  onImport: () => void;
  onReimport?: (entryId: string) => void;
  onVersionHistory?: (entryId: string) => void;
  onExportSpec?: (entryId: string) => void;
  onSendToWorkbench?: (entry: NonNullable<UseCatalogReturn['selectedEntry']>) => void;
}

type View = 'overview' | 'endpoints';

export default function ApiCatalog({ catalog, onImport, onReimport, onVersionHistory, onExportSpec, onSendToWorkbench }: Props) {
  const [auth, setAuth] = useState<AuthConfig>({ type: 'none' });
  const [view, setView] = useState<View>('endpoints');
  const prevEntryId = useRef<string | undefined>(undefined);

  useEffect(() => {
    const entry = catalog.selectedEntry;
    if (!entry || entry.id === prevEntryId.current) return;
    prevEntryId.current = entry.id;

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
      setAuth({ ...base, __inherit: true, __schemeName: schemeName } as any);
    } else {
      setAuth({ type: 'none' });
    }
  }, [catalog.selectedEntry]);

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
        {onSendToWorkbench && (
          <button className="cat-view-tab cat-wb-send" onClick={() => onSendToWorkbench(entry)}>
            Send All to Workbench
          </button>
        )}
      </div>

      {view === 'overview' ? (
        <CatalogOverview
          entry={entry}
          onReimport={() => onReimport?.(entry.id)}
          onVersionHistory={() => onVersionHistory?.(entry.id)}
          onExportSpec={() => onExportSpec?.(entry.id)}
        />
      ) : (
        <CatalogEndpointBrowser
          entry={entry}
          auth={auth}
          onAuthChange={setAuth}
          onHostChange={handleHostChange}
        />
      )}
    </div>
  );
}
