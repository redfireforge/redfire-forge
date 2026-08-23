import { useState, useCallback } from 'react';
import type { Node, Edge } from '@xyflow/react';
import type { Workflow } from '@workflow/types/workflow';
import type { WorkflowHook } from '@workflow/hooks/useWorkflows';
import { sampleWorkflowCatalog } from '../../data/galleries/workflows';
import { getAutoLayoutNodes } from '@workflow/utils/workflowAutoLayout';
import { loadPreviewSampleId, savePreviewSampleId } from '@shared/utils/storage';

function buildInitialPreviewWorkflow(): Workflow | null {
  const savedId = loadPreviewSampleId();
  if (!savedId) return null;
  const entry = sampleWorkflowCatalog.find(e => e.id === savedId);
  if (!entry) return null;
  const sample = entry.factory();
  const laidOut = getAutoLayoutNodes(sample.nodes as unknown as Node[], sample.edges as unknown as Edge[], 'TB');
  return { ...sample, nodes: laidOut as unknown as typeof sample.nodes };
}

export function useGalleryWorkflowPreviewState(wfHook: WorkflowHook) {
  const [previewWorkflow, setPreviewWorkflow] = useState<Workflow | null>(buildInitialPreviewWorkflow);
  const [pendingTemplateImport, setPendingTemplateImport] = useState<Workflow | null>(null);

  const handleTemplatePickFolder = useCallback((folderId: string | null) => {
    if (!pendingTemplateImport) return;
    const copy = { ...pendingTemplateImport, folderId: folderId ?? undefined };
    const catalogEntry = sampleWorkflowCatalog.find(e => e.id === pendingTemplateImport.gallerySampleId);
    if (catalogEntry?.companionFactories) {
      for (const cf of catalogEntry.companionFactories) {
        const companion = cf();
        const companionCopy = { ...structuredClone(companion), id: companion.id, name: companion.name.replace(/^Sample: /, ''), folderId: folderId ?? undefined, createdAt: Date.now(), updatedAt: Date.now() };
        wfHook.insert(companionCopy);
      }
    }
    wfHook.insert(copy);
    setPreviewWorkflow(null);
    savePreviewSampleId(null);
    setPendingTemplateImport(null);
  }, [pendingTemplateImport, wfHook]);

  const handleUseWorkflowAsTemplate = useCallback((wf: Workflow) => {
    const gallerySampleId = sampleWorkflowCatalog.find(e => e.id === wf.id)?.id;
    const copy: Workflow = { ...structuredClone(wf), id: crypto.randomUUID(), name: wf.name.replace(/^Sample: /, ''), gallerySampleId, createdAt: Date.now(), updatedAt: Date.now() };
    setPendingTemplateImport(copy);
  }, []);

  const clearPreviewWorkflow = useCallback(() => {
    setPreviewWorkflow(null);
    savePreviewSampleId(null);
  }, []);

  return {
    previewWorkflow,
    setPreviewWorkflow,
    pendingTemplateImport,
    setPendingTemplateImport,
    handleTemplatePickFolder,
    handleUseWorkflowAsTemplate,
    clearPreviewWorkflow,
  };
}
