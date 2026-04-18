import { useState, useCallback } from 'react';
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
