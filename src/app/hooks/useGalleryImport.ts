import { useCallback, useMemo } from 'react';
import type { Node, Edge } from '@xyflow/react';
import type { Environment, Microservice, FeatureGroup, Scenario, RequestCollection, RequestItem } from '../../shared/types';
import type { GalleryEntry } from '../../data/galleries/types';
import type { Workflow } from '../../features/workflow/types/workflow';
import type { PreviewRequest } from '../../features/requests/Requests';
import { gallerySampleHash } from '../../shared/utils/gallerySampleHash';
import { getAutoLayoutNodes } from '../../features/workflow/utils/workflowAutoLayout';
import { savePreviewSampleId } from '../../shared/utils/storage';

export interface UseGalleryImportDeps {
  wb: {
    collections: RequestCollection[];
    addCollection: (col: { name: string; mode: string }) => string;
    addRequest: (colId: string) => string;
    updateRequest: (colId: string, reqId: string, data: Partial<RequestItem>) => void;
  };
  featureGroups: FeatureGroup[];
  environments: Environment[];
  microservices: Microservice[];
  setActiveTab: (tab: string) => void;
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
    wb, featureGroups, environments, microservices,
    setActiveTab, setPreviewRequest, setPreviewWorkflow,
    setCatalogInitialSpec, setShowCatalogImport,
    setFeatureGroups, setEnvironments, setMicroservices,
    setSelectedEnvId, setSelectedSvcId,
  } = deps;

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
    return map;
  }, [featureGroups]);

  const onImportRequest = useCallback((entry: GalleryEntry<unknown>) => {
    const scenario = entry.factory() as Scenario;
    const GALLERY_COL_NAME = 'Gallery Samples';
    const col = wb.collections.find(c => c.name === GALLERY_COL_NAME);
    const colId = col ? col.id : wb.addCollection({ name: GALLERY_COL_NAME, mode: 'direct' });
    const reqId = wb.addRequest(colId);
    wb.updateRequest(colId, reqId, {
      name: entry.name,
      method: scenario.method,
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
      method: scenario.method,
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

  const onImportTest = useCallback((entry: GalleryEntry<unknown>) => {
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

    setFeatureGroups(prev => [...prev, {
      ...fg,
      id: crypto.randomUUID(),
      name: `Gallery: ${fg.name}`,
      source: 'gallery',
      gallerySampleId: entry.id,
      gallerySampleHash: sampleHash,
      microserviceId: gallerySvc!.id,
      environmentId: galleryEnv!.id,
    }]);

    setSelectedEnvId(galleryEnv.id);
    setSelectedSvcId(gallerySvc.id);
  }, [environments, microservices, setEnvironments, setMicroservices, setFeatureGroups, setSelectedEnvId, setSelectedSvcId]);

  const onImportWorkflow = useCallback((entry: GalleryEntry<unknown>) => {
    const sample = entry.factory() as Workflow;
    const laidOut = getAutoLayoutNodes(sample.nodes as unknown as Node[], sample.edges as unknown as Edge[], 'TB');
    setPreviewWorkflow({ ...sample, nodes: laidOut as unknown as typeof sample.nodes });
    savePreviewSampleId(entry.id);
    setActiveTab('workflow');
  }, [setPreviewWorkflow, setActiveTab]);

  return {
    importedSamples,
    onImportRequest,
    onTryItRequest,
    onImportCatalog,
    onImportTest,
    onImportWorkflow,
  };
}
