import { useState, useCallback, useEffect, useRef } from 'react';
import type { UseCatalogReturn } from '../hooks/useCatalog';
import type { AuthConfig } from '../types';
import CatalogWelcome from '../components/catalog/CatalogWelcome';
import CatalogEndpointBrowser from '../components/catalog/CatalogEndpointBrowser';

interface Props {
  catalog: UseCatalogReturn;
  onImport: () => void;
}

export default function ApiCatalog({ catalog, onImport }: Props) {
  const [auth, setAuth] = useState<AuthConfig>({ type: 'none' });
  const prevEntryId = useRef<string | undefined>(undefined);

  useEffect(() => {
    const entry = catalog.selectedEntry;
    if (!entry || entry.id === prevEntryId.current) return;
    prevEntryId.current = entry.id;

    const schemes = Object.entries(entry.securitySchemes);
    if (schemes.length > 0) {
      const [schemeName, scheme] = schemes[0];
      let detectedType: AuthConfig['type'] = 'bearer';
      const base: AuthConfig = { type: detectedType };
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

  return (
    <CatalogEndpointBrowser
      entry={catalog.selectedEntry}
      auth={auth}
      onAuthChange={setAuth}
      onHostChange={handleHostChange}
    />
  );
}
