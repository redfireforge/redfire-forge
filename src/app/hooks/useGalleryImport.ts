import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Node, Edge } from '@xyflow/react';
import type { Environment, Microservice, FeatureGroup, Scenario, RequestCollection, RequestItem, HttpMethod } from '../../shared/types';
import type { GalleryEntry } from '../../data/galleries/types';
import type { TestSampleEntry } from '../../data/galleries/tests/types';
import { saveSharedDataSources, loadSharedDataSources } from '../../shared/utils/storage';
import type { Workflow } from '../../features/workflow/types/workflow';
import type { PreviewRequest } from '../../features/requests/Requests';
import { gallerySampleHash } from '../../shared/utils/gallerySampleHash';
import { LOADED_SENTINEL } from '../../features/gallery/GalleryPage';
import { getAutoLayoutNodes } from '../../features/workflow/utils/workflowAutoLayout';
import { savePreviewSampleId } from '../../shared/utils/storage';
import type { ApiMockServerDefinitionV1 } from '../../shared/api-mock/contracts';
import {
  importApiMockGalleryServer,
  loadGalleryImportTracking,
} from '../../features/api-mock/apiMockGalleryImport';
import type { Tab } from '../utils/appTabUtils';

export interface UseGalleryImportDeps {
  wb: {
    collections: RequestCollection[];
    addCollection: (col: { name: string; mode: 'direct' | 'multi-env' | 'group' }) => string;
    addRequest: (colId: string) => string;
    updateRequest: (colId: string, reqId: string, data: Partial<RequestItem>) => void;
  };
  featureGroups: FeatureGroup[];
  environments: Environment[];
  microservices: Microservice[];
  /** Currently-previewed workflow (passed through for onImportWorkflow). */
  previewWorkflow: Workflow | null;
  /** User's saved workflows (used to detect gallery samples that were "Use as Template"'d). */
  workflows: Workflow[];
  setActiveTab: (tab: Tab) => void;
  setPreviewRequest: (req: PreviewRequest | null) => void;
  setPreviewWorkflow: (wf: Workflow | null) => void;
  setCatalogInitialSpec: (spec: { yaml: string; name: string } | undefined) => void;
  setShowCatalogImport: (show: boolean) => void;
  setFeatureGroups: React.Dispatch<React.SetStateAction<FeatureGroup[]>>;
  setEnvironments: React.Dispatch<React.SetStateAction<Environment[]>>;
  setMicroservices: React.Dispatch<React.SetStateAction<Microservice[]>>;
  setSelectedEnvId: (id: string) => void;
  setSelectedSvcId: (id: string) => void;
}

export function useGalleryImport(deps: UseGalleryImportDeps) {
  const {
    wb, featureGroups, environments, microservices, workflows,
    setActiveTab, setPreviewRequest, setPreviewWorkflow,
    setCatalogInitialSpec, setShowCatalogImport,
    setFeatureGroups, setEnvironments, setMicroservices,
    setSelectedEnvId, setSelectedSvcId,
  } = deps;

  const [apiMockImports, setApiMockImports] = useState<Record<string, string>>({});
  useEffect(() => {
    void loadGalleryImportTracking().then(setApiMockImports);
  }, []);

  const importedSamples = useMemo(() => {
    const map: Record<string, string> = {};
    for (const fg of featureGroups) {
      if (fg.gallerySampleId && fg.gallerySampleHash) {
        map[fg.gallerySampleId] = fg.gallerySampleHash;
      } else if (fg.source === 'gallery' && fg.name) {
        // Fallback: match by name for older imports that lack gallerySampleId.
        // Gallery-imported FGs are named "Gallery: <sample name>".
        const stripped = fg.name.replace(/^Gallery:\s*/, '');
        if (stripped) {
          // Use empty string as hash to indicate presence without version tracking
          map[`__name:${stripped}`] = '';
        }
      }
    }
    // Track saved workflows that were imported from gallery samples.
    for (const wf of workflows) {
      if (wf.gallerySampleId) {
        map[wf.gallerySampleId] = LOADED_SENTINEL;
      }
    }
    Object.assign(map, apiMockImports);
    return map;
  }, [featureGroups, workflows, apiMockImports]);

  const onImportRequest = useCallback((entry: GalleryEntry<unknown>) => {
    const scenario = entry.factory() as Scenario;
    const GALLERY_COL_NAME = 'Gallery Samples';
    const col = wb.collections.find(c => c.name === GALLERY_COL_NAME);
    const colId = col ? col.id : wb.addCollection({ name: GALLERY_COL_NAME, mode: 'direct' });
    const reqId = wb.addRequest(colId);
    wb.updateRequest(colId, reqId, {
      name: entry.name,
      method: scenario.method as HttpMethod,
      url: scenario.url,
      headers: scenario.headers,
      body: scenario.body,
      bodyType: scenario.bodyType,
      auth: scenario.auth,
    });
    setActiveTab('requests');
  }, [wb, setActiveTab]);

  const onTryItRequest = useCallback((entry: GalleryEntry<unknown>) => {
    const scenario = entry.factory() as Scenario;
    const previewCol: RequestCollection = {
      id: '__preview__',
      name: 'Gallery Preview',
      mode: 'direct',
      requests: [],
    };
    const previewReq: RequestItem = {
      id: '__preview_req__',
      name: entry.name,
      method: scenario.method as HttpMethod,
      url: scenario.url,
      headers: scenario.headers,
      body: scenario.body,
      bodyType: scenario.bodyType,
      auth: scenario.auth,
    };
    setPreviewRequest({ collection: previewCol, request: previewReq, entryName: entry.name });
    setActiveTab('requests');
  }, [setPreviewRequest, setActiveTab]);

  const onImportCatalog = useCallback((entry: GalleryEntry<unknown>) => {
    const specYaml = entry.factory() as string;
    setCatalogInitialSpec({ yaml: specYaml, name: `${entry.name}.yaml` });
    setShowCatalogImport(true);
  }, [setCatalogInitialSpec, setShowCatalogImport]);

  const onImportTest = useCallback(async (entry: GalleryEntry<unknown>) => {
    const fg = entry.factory() as FeatureGroup;
    const sampleHash = gallerySampleHash(fg);

    const GALLERY_ENV_NAME = 'Gallery Samples';
    const GALLERY_SVC_NAME = 'Gallery Samples';

    let galleryEnv = environments.find(e => e.name === GALLERY_ENV_NAME);
    if (!galleryEnv) {
      galleryEnv = { id: crypto.randomUUID(), name: GALLERY_ENV_NAME };
      setEnvironments(prev => [...prev, galleryEnv!]);
    }

    let gallerySvc = microservices.find(s => s.name === GALLERY_SVC_NAME);
    if (!gallerySvc) {
      gallerySvc = { id: crypto.randomUUID(), name: GALLERY_SVC_NAME, baseUrls: { [galleryEnv.id]: '' } };
      setMicroservices(prev => [...prev, gallerySvc!]);
    } else if (!(galleryEnv.id in gallerySvc.baseUrls)) {
      gallerySvc = { ...gallerySvc, baseUrls: { ...gallerySvc.baseUrls, [galleryEnv.id]: '' } };
      setMicroservices(prev => prev.map(s => s.id === gallerySvc!.id ? gallerySvc! : s));
    }

    // Build the main feature group
    const mainFg: FeatureGroup = {
      ...fg,
      id: crypto.randomUUID(),
      name: `Gallery: ${fg.name}`,
      source: 'gallery',
      gallerySampleId: entry.id,
      gallerySampleHash: sampleHash,
      microserviceId: gallerySvc!.id,
      environmentId: galleryEnv!.id,
    };

    // Check for additional feature groups (e.g., cross-FG samples)
    const testEntry = entry as TestSampleEntry;
    const additionalFgs: FeatureGroup[] = [];
    if (testEntry.additionalFeatureGroupsFactory) {
      for (const addFg of testEntry.additionalFeatureGroupsFactory()) {
        additionalFgs.push({
          ...addFg,
          id: crypto.randomUUID(),
          name: `Gallery: ${addFg.name}`,
          source: 'gallery',
          gallerySampleId: entry.id,
          gallerySampleHash: sampleHash,
          microserviceId: gallerySvc!.id,
          environmentId: galleryEnv!.id,
        });
      }
    }

    // Add all feature groups
    setFeatureGroups(prev => [...prev, mainFg, ...additionalFgs]);

    // Check for shared data sources
    if (testEntry.sharedDataSourceFactory) {
      const newSharedDs = testEntry.sharedDataSourceFactory();
      // Load existing, merge, save
      const existing = await loadSharedDataSources();
      const existingIds = new Set(existing.map(ds => ds.id));
      const toAdd = newSharedDs.filter(ds => !existingIds.has(ds.id));
      if (toAdd.length > 0) {
        await saveSharedDataSources([...existing, ...toAdd]);
      }
    }

    setSelectedEnvId(galleryEnv.id);
    setSelectedSvcId(gallerySvc.id);
    setActiveTab('scenarios');
  }, [environments, microservices, setEnvironments, setMicroservices, setFeatureGroups, setSelectedEnvId, setSelectedSvcId, setActiveTab]);

  const onImportWorkflow = useCallback((entry: GalleryEntry<unknown>) => {
    const sample = entry.factory() as Workflow;
    const laidOut = getAutoLayoutNodes(sample.nodes as unknown as Node[], sample.edges as unknown as Edge[], 'TB');
    setPreviewWorkflow({ ...sample, nodes: laidOut as unknown as typeof sample.nodes });
    savePreviewSampleId(entry.id);
    setActiveTab('workflow');
  }, [setPreviewWorkflow, setActiveTab]);

  const onImportApiMock = useCallback(async (entry: GalleryEntry<unknown>) => {
    const template = entry.factory() as ApiMockServerDefinitionV1;
    try {
      const { sampleHash } = await importApiMockGalleryServer(template, entry.id);
      setApiMockImports(prev => ({ ...prev, [entry.id]: sampleHash }));
      setActiveTab('api-mock-studio');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to import API Mock gallery sample.';
      window.alert(message);
    }
  }, [setActiveTab]);

  /**
   * Navigate to wherever an already-imported sample lives, without re-importing.
   * Tests → scenarios tab, workflows → workflow tab, requests → requests tab,
   * catalog → catalog tab, api-mock → API Mock Studio.
   */
  const onNavigateTo = useCallback((entry: GalleryEntry<unknown>) => {
    const domainTabMap: Partial<Record<typeof entry.domain, Tab>> = {
      tests: 'scenarios',
      workflows: 'workflow',
      requests: 'requests',
      catalog: 'catalog',
      'data-mapper': 'scenarios',
      'api-mock': 'api-mock-studio',
    };
    const tab = domainTabMap[entry.domain];
    if (tab) setActiveTab(tab);
  }, [setActiveTab]);

  return {
    importedSamples,
    onImportRequest,
    onTryItRequest,
    onImportCatalog,
    onImportTest,
    onImportWorkflow,
    onImportApiMock,
    onNavigateTo,
  };
}
