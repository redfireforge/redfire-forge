import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { UseCatalogReturn } from './hooks/useCatalog';
import type { AuthConfig, GlobalAuthProfile, Environment, Microservice, RequestCollection } from '../../shared/types';
import type { CatalogEntry, CatalogEndpoint, CatalogFolder, SavedEndpointValues, WorkflowPublication } from './types/catalog';
import type { SendToRequestsPayload } from './components/CatalogSendToRequestsModal';
import { buildCoverageMap } from './utils/coverageChecker';
import CatalogWelcome from './components/CatalogWelcome';
import CatalogEndpointBrowser from './components/CatalogEndpointBrowser';
import CatalogOverview from './components/CatalogOverview';
import CatalogSendToRequestsModal from './components/CatalogSendToRequestsModal';
import CatalogYamlViewerModal from './components/CatalogYamlViewerModal';
import UnpublishConfirmDialog from './components/UnpublishConfirmDialog';
import type { UnpublishRequest } from './components/UnpublishConfirmDialog';
import PublishEndpointModal from './components/PublishEndpointModal';
import type { PublishRequest, PublishResult } from './components/PublishEndpointModal';
import { scanWorkflowsForCatalogRef, removeCatalogNodesFromWorkflows } from './utils/workflowExposureScanner';
import { loadCatalogView, saveCatalogView, loadCatalogRawSpec } from '../../shared/utils/storageCatalog';
import { loadWorkflowPreviews, addWorkflowPreview, removeWorkflowPreview, getPreviewedEndpointIds } from '../../shared/utils/workflowPreviewStorage';
import type { PreviewMap } from '../../shared/utils/workflowPreviewStorage';
import PublishedEndpointsPanel from './components/PublishedEndpointsPanel';
import { aggregatePublishedEndpoints } from './utils/publishedEndpointAggregator';
import { republishAtCurrentVersion } from './utils/publicationDrift';
import { usePublishPermission } from './hooks/usePublishPermission';
import { logPublicationAudit } from './utils/publicationAudit';

function findEndpointInEntry(entry: CatalogEntry, endpointId: string): CatalogEndpoint | undefined {
  const search = (eps: CatalogEndpoint[]): CatalogEndpoint | undefined => eps.find(e => e.id === endpointId);
  const searchFolders = (folders: CatalogFolder[]): CatalogEndpoint | undefined => {
    for (const f of folders) {
      const found = search(f.endpoints) ?? searchFolders(f.folders);
      if (found) return found;
    }
    return undefined;
  };
  return search(entry.endpoints) ?? searchFolders(entry.folders);
}

interface Props {
  catalog: UseCatalogReturn;
  onImport: () => void;
  onReimport?: (entryId: string) => void;
  onVersionHistory?: (entryId: string) => void;
  onExportSpec?: (entryId: string) => void;
  onConvertToOpenApi?: (entryId: string) => void;
  onSendToRequests?: (entry: NonNullable<UseCatalogReturn['selectedEntry']>) => void;
  onExportSingleEndpoint?: (entry: NonNullable<UseCatalogReturn['selectedEntry']>, endpoint: CatalogEndpoint, savedValues?: SavedEndpointValues) => void;
  onEditEntry?: (entryId: string) => void;
  globalAuthProfiles?: GlobalAuthProfile[];
  appEnvironments?: Environment[];
  appMicroservices?: Microservice[];
  collections?: RequestCollection[];
  onNavigateToRequest?: (collectionId: string, requestId: string) => void;
  savedEpValues?: Record<string, SavedEndpointValues>;
  onExportConfirm?: (payload: SendToRequestsPayload) => void;
  onSendEndpointToHarness?: (entry: NonNullable<UseCatalogReturn['selectedEntry']>, endpoint: CatalogEndpoint, fromTryItOut?: boolean) => void;
  /** Notify parent that preview state changed so the palette can refresh. */
  onPreviewsChanged?: () => void;
}

type View = 'overview' | 'endpoints' | 'export' | 'published';

export default function ApiCatalog({ catalog, onImport, onReimport, onVersionHistory, onExportSpec, onConvertToOpenApi, onSendToRequests, onExportSingleEndpoint, onEditEntry, globalAuthProfiles, appEnvironments, appMicroservices, collections, onNavigateToRequest, savedEpValues, onExportConfirm, onSendEndpointToHarness, onPreviewsChanged }: Props) {
  const [auth, setAuth] = useState<AuthConfig>({ type: 'none' });
  const [view, setView] = useState<View>('endpoints');
  const publishPermission = usePublishPermission(catalog.selectedEntry?.id ?? '');
  const [yamlContent, setYamlContent] = useState<string | null>(null);
  const [showYamlModal, setShowYamlModal] = useState(false);
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
          setAuth({ ...liveProfile.auth, __globalProfileId: liveProfile.id, __globalProfileName: liveProfile.name });  
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
        setAuth(newAuth);  
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

  const handleExportSingle = useCallback((endpoint: CatalogEndpoint, savedValues?: SavedEndpointValues) => {
    if (catalog.selectedEntry && onExportSingleEndpoint) {
      onExportSingleEndpoint(catalog.selectedEntry, endpoint, savedValues);
    }
  }, [catalog.selectedEntry, onExportSingleEndpoint]);

  const handleSendToHarness = useCallback((endpoint: CatalogEndpoint, fromTryItOut?: boolean) => {
    if (catalog.selectedEntry && onSendEndpointToHarness) {
      onSendEndpointToHarness(catalog.selectedEntry, endpoint, fromTryItOut);
    }
  }, [catalog.selectedEntry, onSendEndpointToHarness]);

  const handleViewYaml = useCallback(async () => {
    const entry = catalog.selectedEntry;
    if (!entry?.currentVersionId) return;
    const raw = await loadCatalogRawSpec(entry.id, entry.currentVersionId);
    setYamlContent(raw || '# No raw spec available for this entry.');
    setShowYamlModal(true);
  }, [catalog.selectedEntry]);

  const [previewMap, setPreviewMap] = useState<PreviewMap>({});

  useEffect(() => {
    let cancelled = false;
    loadWorkflowPreviews().then(map => { if (!cancelled) setPreviewMap(map); });
    return () => { cancelled = true; };
  }, []);

  const previewedEndpointIds = useMemo(() => {
    const entry = catalog.selectedEntry;
    if (!entry) return new Set<string>();
    return getPreviewedEndpointIds(previewMap, entry.id);
  }, [catalog.selectedEntry, previewMap]);

  const [unpublishRequest, setUnpublishRequest] = useState<UnpublishRequest | null>(null);
  const pendingUnpublishRef = useRef<{ ep: CatalogEndpoint; mode: 'preview' | 'published' | undefined; values: SavedEndpointValues } | null>(null);
  const [publishRequest, setPublishRequest] = useState<PublishRequest | null>(null);
  const pendingPublishRef = useRef<{ ep: CatalogEndpoint; values: SavedEndpointValues; entryId: string } | null>(null);
  const [previewPromoteAlert, setPreviewPromoteAlert] = useState<{ method: string; path: string } | null>(null);

  const applyPublicationToEntry = useCallback((entryId: string, ep: CatalogEndpoint, publication: WorkflowPublication | undefined) => {
    const entry = catalog.entries.find(e => e.id === entryId);
    if (!entry) return;
    const patchEp = (e: CatalogEndpoint): CatalogEndpoint =>
      e.id === ep.id
        ? {
            ...e,
            workflowPublication: publication,
            exposedToWorkflow: undefined,
            workflowExposure: undefined,
            workflowValues: undefined,
          }
        : e;
    const patchFolders = (folders: typeof entry.folders): typeof entry.folders =>
      folders.map(f => ({ ...f, endpoints: f.endpoints.map(patchEp), folders: patchFolders(f.folders) }));
    catalog.updateEntry(entryId, {
      endpoints: entry.endpoints.map(patchEp),
      folders: patchFolders(entry.folders),
    });
  }, [catalog]);

  const applyPublication = useCallback((ep: CatalogEndpoint, publication: WorkflowPublication | undefined) => {
    const entry = catalog.selectedEntry;
    if (!entry) return;
    applyPublicationToEntry(entry.id, ep, publication);
  }, [catalog.selectedEntry, applyPublicationToEntry]);

  const finishUnpublish = useCallback((ep: CatalogEndpoint, mode: 'preview' | 'published' | undefined, values: SavedEndpointValues, entryId: string, endpointId: string) => {
    applyPublicationToEntry(entryId, ep, undefined);
    if (mode === 'preview') {
      const entry = catalog.entries.find(e => e.id === entryId);
      const preview = {
        entryId,
        endpointId,
        method: ep.method,
        path: ep.path,
        summary: ep.summary || ep.path,
        entryName: entry?.name ?? '',
        addedAt: Date.now(),
        values: { paramValues: values.params, headerValues: values.headers, body: values.body || undefined },
      };
      addWorkflowPreview(preview).then(() => {
        setPreviewMap(prev => ({ ...prev, [`${entryId}::${endpointId}`]: preview }));
        onPreviewsChanged?.();
      });
    } else {
      removeWorkflowPreview(entryId, endpointId).then(() => {
        setPreviewMap(prev => { const next = { ...prev }; delete next[`${entryId}::${endpointId}`]; return next; });
        onPreviewsChanged?.();
      });
    }
  }, [applyPublicationToEntry, catalog.entries, onPreviewsChanged]);

  const handleSetWorkflowExposure = useCallback((ep: CatalogEndpoint, mode: 'preview' | 'published' | undefined, values: SavedEndpointValues) => {
    const entry = catalog.selectedEntry;
    if (!entry) return;

    const wasPublished = !!(ep.workflowPublication || ep.workflowExposure === 'published');
    const isDowngrading = wasPublished && mode !== 'published';

    if (isDowngrading) {
      pendingUnpublishRef.current = { ep, mode, values };
      scanWorkflowsForCatalogRef(entry.id, ep.id).then(affected => {
        if (affected.length === 0) {
          finishUnpublish(ep, mode, values, entry.id, ep.id);
          logPublicationAudit({
            action: 'unpublish', entryId: entry.id, endpointId: ep.id,
            method: ep.method, path: ep.path, timestamp: Date.now(),
          });
        } else {
          setUnpublishRequest({
            endpointLabel: ep.summary || ep.path,
            method: ep.method,
            path: ep.path,
            entryId: entry.id,
            endpointId: ep.id,
            affected,
            publication: ep.workflowPublication,
          });
        }
      });
      return;
    }

    if (mode === 'published') {
      const previewKey = `${entry.id}::${ep.id}`;
      const previewEntry = previewMap[previewKey];
      if (previewEntry) {
        setPreviewPromoteAlert({ method: ep.method, path: ep.path });
        return;
      }
      const currentVersion = entry.versions.find(v => v.id === entry.currentVersionId);
      pendingPublishRef.current = { ep, values, entryId: entry.id };
      setPublishRequest({
        method: ep.method,
        path: ep.path,
        summary: ep.summary || ep.path,
        entryName: entry.name,
        versionLabel: currentVersion?.version ?? entry.currentVersionId,
        currentVersionId: entry.currentVersionId,
        includeValues: true,
        values: { paramValues: values.params, headerValues: values.headers, body: values.body || undefined },
      });
    } else if (mode === 'preview') {
      applyPublication(ep, undefined);
      const preview = {
        entryId: entry.id,
        endpointId: ep.id,
        method: ep.method,
        path: ep.path,
        summary: ep.summary || ep.path,
        entryName: entry.name,
        addedAt: Date.now(),
        values: { paramValues: values.params, headerValues: values.headers, body: values.body || undefined },
      };
      addWorkflowPreview(preview).then(() => {
        setPreviewMap(prev => ({ ...prev, [`${entry.id}::${ep.id}`]: preview }));
        onPreviewsChanged?.();
      });
    } else {
      applyPublication(ep, undefined);
      removeWorkflowPreview(entry.id, ep.id).then(() => {
        setPreviewMap(prev => { const next = { ...prev }; delete next[`${entry.id}::${ep.id}`]; return next; });
        onPreviewsChanged?.();
      });
    }
  }, [catalog, applyPublication, finishUnpublish, onPreviewsChanged, previewMap]);

  const handlePublishConfirm = useCallback((result: PublishResult) => {
    const pending = pendingPublishRef.current;
    const req = publishRequest;
    if (!pending || !req) return;

    const publication: WorkflowPublication = {
      publishedAt: Date.now(),
      publishedFromVersionId: req.currentVersionId,
      values: result.includeValues && pending.values
        ? { paramValues: pending.values.params, headerValues: pending.values.headers, body: pending.values.body || undefined }
        : undefined,
      note: result.note || undefined,
    };

    removeWorkflowPreview(pending.entryId, pending.ep.id).then(() => {
      setPreviewMap(prev => { const next = { ...prev }; delete next[`${pending.entryId}::${pending.ep.id}`]; return next; });
      onPreviewsChanged?.();
    });

    applyPublicationToEntry(pending.entryId, pending.ep, publication);
    logPublicationAudit({
      action: 'publish', entryId: pending.entryId, endpointId: pending.ep.id,
      method: pending.ep.method, path: pending.ep.path,
      timestamp: publication.publishedAt,
      versionId: publication.publishedFromVersionId,
      note: publication.note,
    });
    pendingPublishRef.current = null;
    setPublishRequest(null);
  }, [publishRequest, applyPublicationToEntry, onPreviewsChanged]);

  const handlePublishCancel = useCallback(() => {
    pendingPublishRef.current = null;
    setPublishRequest(null);
  }, []);

  const handleUnpublishPaletteOnly = useCallback(() => {
    const pending = pendingUnpublishRef.current;
    const req = unpublishRequest;
    if (pending && req) {
      finishUnpublish(pending.ep, pending.mode, pending.values, req.entryId, req.endpointId);
      logPublicationAudit({
        action: 'unpublish', entryId: req.entryId, endpointId: req.endpointId,
        method: pending.ep.method, path: pending.ep.path, timestamp: Date.now(),
      });
    }
    pendingUnpublishRef.current = null;
    setUnpublishRequest(null);
  }, [finishUnpublish, unpublishRequest]);

  const handleUnpublishPaletteAndWorkflows = useCallback(async () => {
    const pending = pendingUnpublishRef.current;
    const req = unpublishRequest;
    if (pending && req) {
      const removed = await removeCatalogNodesFromWorkflows(req.entryId, req.endpointId);
      finishUnpublish(pending.ep, pending.mode, pending.values, req.entryId, req.endpointId);
      logPublicationAudit({
        action: 'unpublish', entryId: req.entryId, endpointId: req.endpointId,
        method: pending.ep.method, path: pending.ep.path, timestamp: Date.now(),
        affectedWorkflows: removed,
      });
    }
    pendingUnpublishRef.current = null;
    setUnpublishRequest(null);
  }, [finishUnpublish, unpublishRequest]);

  const handleUnpublishCancel = useCallback(() => {
    pendingUnpublishRef.current = null;
    setUnpublishRequest(null);
  }, []);

  const coverageMap = useMemo(
    () => catalog.selectedEntry && collections
      ? buildCoverageMap(catalog.selectedEntry.id, catalog.selectedEntry.name, collections)
      : new Map(),
    [catalog.selectedEntry, collections],
  );

  const publishedItems = useMemo(
    () => aggregatePublishedEndpoints(catalog.entries),
    [catalog.entries],
  );

  const handlePublishedUnpublish = useCallback((entryId: string, endpointId: string) => {
    const entry = catalog.entries.find(e => e.id === entryId);
    if (!entry) return;
    const ep = findEndpointInEntry(entry, endpointId);
    if (!ep) return;

    pendingUnpublishRef.current = { ep, mode: undefined, values: { params: {}, headers: {}, body: '' } };
    scanWorkflowsForCatalogRef(entryId, endpointId).then(affected => {
      if (affected.length === 0) {
        applyPublicationToEntry(entryId, ep, undefined);
        removeWorkflowPreview(entryId, endpointId).then(() => {
          setPreviewMap(prev => { const next = { ...prev }; delete next[`${entryId}::${endpointId}`]; return next; });
          onPreviewsChanged?.();
        });
        logPublicationAudit({
          action: 'unpublish', entryId, endpointId,
          method: ep.method, path: ep.path, timestamp: Date.now(),
        });
        pendingUnpublishRef.current = null;
      } else {
        setUnpublishRequest({
          endpointLabel: ep.summary || ep.path,
          method: ep.method,
          path: ep.path,
          entryId,
          endpointId,
          affected,
          publication: ep.workflowPublication,
        });
      }
    });
  }, [catalog.entries, applyPublicationToEntry, onPreviewsChanged]);

  const handleBulkUnpublishFromPanel = useCallback((ids: Array<{ entryId: string; endpointId: string }>) => {
    const byEntry = new Map<string, Set<string>>();
    for (const { entryId, endpointId } of ids) {
      let s = byEntry.get(entryId);
      if (!s) { s = new Set(); byEntry.set(entryId, s); }
      s.add(endpointId);
    }
    for (const [entryId, epIds] of byEntry) {
      const entry = catalog.entries.find(e => e.id === entryId);
      if (!entry) continue;
      const clearPub = (e: CatalogEndpoint): CatalogEndpoint =>
        epIds.has(e.id) ? { ...e, workflowPublication: undefined, exposedToWorkflow: undefined, workflowExposure: undefined, workflowValues: undefined } : e;
      const patchFolders = (folders: typeof entry.folders): typeof entry.folders =>
        folders.map(f => ({ ...f, endpoints: f.endpoints.map(clearPub), folders: patchFolders(f.folders) }));
      catalog.updateEntry(entryId, { endpoints: entry.endpoints.map(clearPub), folders: patchFolders(entry.folders) });
      for (const epId of epIds) {
        const ep = findEndpointInEntry(entry, epId);
        if (ep) logPublicationAudit({ action: 'unpublish', entryId, endpointId: epId, method: ep.method, path: ep.path, timestamp: Date.now() });
      }
    }
  }, [catalog]);

  const handleBulkRepublish = useCallback((ids: Array<{ entryId: string; endpointId: string }>) => {
    const byEntry = new Map<string, Set<string>>();
    for (const { entryId, endpointId } of ids) {
      let s = byEntry.get(entryId);
      if (!s) { s = new Set(); byEntry.set(entryId, s); }
      s.add(endpointId);
    }
    for (const [entryId, epIds] of byEntry) {
      const entry = catalog.entries.find(e => e.id === entryId);
      if (!entry) continue;
      const republishEp = (e: CatalogEndpoint): CatalogEndpoint => {
        if (!epIds.has(e.id)) return e;
        const updated = republishAtCurrentVersion(e, entry);
        if (!updated) return e;
        logPublicationAudit({ action: 'republish', entryId, endpointId: e.id, method: e.method, path: e.path, timestamp: updated.publishedAt, versionId: updated.publishedFromVersionId });
        return { ...e, workflowPublication: updated };
      };
      const patchFolders = (folders: typeof entry.folders): typeof entry.folders =>
        folders.map(f => ({ ...f, endpoints: f.endpoints.map(republishEp), folders: patchFolders(f.folders) }));
      catalog.updateEntry(entryId, { endpoints: entry.endpoints.map(republishEp), folders: patchFolders(entry.folders) });
    }
  }, [catalog]);

  const handleRepublish = useCallback((entryId: string, endpointId: string) => {
    const entry = catalog.entries.find(e => e.id === entryId);
    if (!entry) return;
    const ep = findEndpointInEntry(entry, endpointId);
    if (!ep) return;
    const updated = republishAtCurrentVersion(ep, entry);
    if (updated) {
      applyPublicationToEntry(entryId, ep, updated);
      logPublicationAudit({
        action: 'republish', entryId, endpointId,
        method: ep.method, path: ep.path, timestamp: updated.publishedAt,
        versionId: updated.publishedFromVersionId,
      });
    }
  }, [catalog.entries, applyPublicationToEntry]);

  const handlePromotePreview = useCallback((entryId: string, endpointId: string) => {
    const entry = catalog.entries.find(e => e.id === entryId);
    if (!entry) return;
    const ep = findEndpointInEntry(entry, endpointId);
    if (!ep) return;
    const previewKey = `${entryId}::${endpointId}`;
    const preview = previewMap[previewKey];
    const values: SavedEndpointValues = preview?.values
      ? { params: preview.values.paramValues, headers: preview.values.headerValues, body: preview.values.body ?? '' }
      : { params: {}, headers: {}, body: '' };
    const currentVersion = entry.versions.find(v => v.id === entry.currentVersionId);
    pendingPublishRef.current = { ep, values, entryId };
    setPublishRequest({
      method: ep.method,
      path: ep.path,
      summary: ep.summary || ep.path,
      entryName: entry.name,
      versionLabel: currentVersion?.version ?? entry.currentVersionId,
      currentVersionId: entry.currentVersionId,
      includeValues: true,
      values: preview?.values ?? { paramValues: {}, headerValues: {} },
    });
  }, [catalog.entries, previewMap]);

  const handleRemovePreviewFromPanel = useCallback((entryId: string, endpointId: string) => {
    removeWorkflowPreview(entryId, endpointId).then(() => {
      setPreviewMap(prev => { const next = { ...prev }; delete next[`${entryId}::${endpointId}`]; return next; });
      onPreviewsChanged?.();
    });
  }, [onPreviewsChanged]);

  const handlePublishedViewInCatalog = useCallback((entryId: string, endpointId: string) => {
    catalog.selectEntry(entryId);
    catalog.selectEndpoint(endpointId);
    setView('endpoints');
  }, [catalog]);

  const isViewAllowed = useCallback((candidate: string): candidate is View => {
    if (candidate === 'overview' || candidate === 'endpoints' || candidate === 'published') return true;
    if (candidate === 'export') return !!(onSendToRequests || onExportConfirm);
    return false;
  }, [onSendToRequests, onExportConfirm]);

  useEffect(() => {
    const entryId = catalog.selectedEntry?.id;
    if (!entryId) return;
    let cancelled = false;
    void loadCatalogView(entryId).then((saved) => {
      if (cancelled || !saved || !isViewAllowed(saved)) return;
      setView(saved);
    });
    return () => {
      cancelled = true;
    };
  }, [catalog.selectedEntry?.id, isViewAllowed]);

  useEffect(() => {
    const entryId = catalog.selectedEntry?.id;
    if (!entryId || !isViewAllowed(view)) return;
    void saveCatalogView(entryId, view);
  }, [catalog.selectedEntry?.id, view, isViewAllowed]);

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
        <button className={`cat-view-tab ${view === 'overview' ? 'active' : ''}`} data-testid="catalog-view-overview" onClick={() => setView('overview')}>
          Overview
        </button>
        <button className={`cat-view-tab ${view === 'endpoints' ? 'active' : ''}`} data-testid="catalog-view-endpoints" onClick={() => setView('endpoints')}>
          Endpoints
        </button>
        {(onSendToRequests || onExportConfirm) && (
          <button className={`cat-view-tab ${view === 'export' ? 'active' : ''}`} data-testid="catalog-view-export" onClick={() => setView('export')}>
            Export to Requests
          </button>
        )}
        <button className={`cat-view-tab ${view === 'published' ? 'active' : ''}`} data-testid="catalog-view-published" onClick={() => setView('published')}>
          Published{(publishedItems.length + Object.keys(previewMap).length) > 0 ? ` (${publishedItems.length + Object.keys(previewMap).length})` : ''}
        </button>
      </div>

      <div className="cat-view-pane" style={{ display: view === 'overview' ? 'flex' : 'none' }}>
        <CatalogOverview
          entry={entry}
          onReimport={() => onReimport?.(entry.id)}
          onVersionHistory={() => onVersionHistory?.(entry.id)}
          onExportSpec={() => onExportSpec?.(entry.id)}
          onConvertToOpenApi={onConvertToOpenApi ? () => onConvertToOpenApi(entry.id) : undefined}
          onViewYaml={handleViewYaml}
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
          onExportSingle={onExportSingleEndpoint ? handleExportSingle : undefined}
          onSendToHarness={onSendEndpointToHarness ? handleSendToHarness : undefined}
          coverageMap={coverageMap}
          onNavigateToRequest={onNavigateToRequest}
          onSetWorkflowExposure={handleSetWorkflowExposure}
          previewedEndpointIds={previewedEndpointIds}
          publishPermission={publishPermission}
        />
      </div>
      {view === 'published' && (
        <div className="cat-view-pane" style={{ display: 'flex' }}>
          <PublishedEndpointsPanel
            items={publishedItems}
            previewItems={Object.values(previewMap)}
            onUnpublish={handlePublishedUnpublish}
            onBulkUnpublish={handleBulkUnpublishFromPanel}
            onRepublish={handleRepublish}
            onBulkRepublish={handleBulkRepublish}
            onPromotePreview={handlePromotePreview}
            onRemovePreview={handleRemovePreviewFromPanel}
            onViewInCatalog={handlePublishedViewInCatalog}
            publishPermission={publishPermission}
          />
        </div>
      )}
      {view === 'export' && onExportConfirm && (
        <div className="cat-view-pane" style={{ display: 'flex' }}>
          <CatalogSendToRequestsModal
            entry={entry}
            appEnvironments={appEnvironments ?? []}
            appMicroservices={appMicroservices ?? []}
            savedEpValues={savedEpValues ?? {}}
            collections={collections ?? []}
            onSend={onExportConfirm}
            onClose={() => setView('endpoints')}
            inline
          />
        </div>
      )}
      {showYamlModal && yamlContent !== null && (
        <CatalogYamlViewerModal
          yaml={yamlContent}
          title={entry.name}
          onClose={() => { setShowYamlModal(false); setYamlContent(null); }}
        />
      )}
      {unpublishRequest && (
        <UnpublishConfirmDialog
          request={unpublishRequest}
          onPaletteOnly={handleUnpublishPaletteOnly}
          onPaletteAndWorkflows={handleUnpublishPaletteAndWorkflows}
          onCancel={handleUnpublishCancel}
        />
      )}
      {publishRequest && (
        <PublishEndpointModal
          request={publishRequest}
          onConfirm={handlePublishConfirm}
          onCancel={handlePublishCancel}
        />
      )}
      {previewPromoteAlert && (
        <div className="sw-promote-alert-overlay" data-testid="preview-promote-alert" onClick={() => setPreviewPromoteAlert(null)} onKeyDown={e => { if (e.key === 'Escape') setPreviewPromoteAlert(null); }}>
          <div className="sw-promote-alert-dialog" role="dialog" onClick={e => e.stopPropagation()}>
            <div className="sw-promote-alert-icon">ℹ</div>
            <div className="sw-promote-alert-body">
              <strong>{previewPromoteAlert.method} {previewPromoteAlert.path}</strong> is already in <span className="sw-promote-alert-badge preview">Preview</span> mode.
              <p>To promote it to <span className="sw-promote-alert-badge published">Published</span>, switch to the <strong>Published</strong> tab and use the <strong>Promote</strong> action from the ⋮ menu.</p>
            </div>
            <div className="sw-promote-alert-footer">
              <button className="sw-promote-alert-published-btn" onClick={() => { setPreviewPromoteAlert(null); setView('published'); }} data-testid="preview-promote-go-btn">Go to Published Tab</button>
              <button className="sw-promote-alert-close-btn" onClick={() => setPreviewPromoteAlert(null)} data-testid="preview-promote-dismiss-btn">OK</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
