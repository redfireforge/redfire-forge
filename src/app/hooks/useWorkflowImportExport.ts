import { useCallback } from 'react';
import type { Workflow } from '../../features/workflow/types/workflow';
import type { WorkflowHook } from '../../features/workflow/hooks/useWorkflows';
import { stripWorkflowVersions, countWorkflowVersions } from '../../features/workflow/utils/workflowVersioning';
import { saveJsonFile, buildExportFilename, openJsonFile } from '../../shared/utils/fileSaver';
import { pickJsonFile } from '../../features/scenarios/utils/scenarioImportExport';
import { isTauri } from '../../shared/utils/platform';

interface UseWorkflowImportExportOpts {
  wfHook: WorkflowHook;
  setActiveTab: (tab: string) => void;
  showToast: (type: 'error' | 'success', title: string, msg?: string) => void;
}

export function useWorkflowImportExport({ wfHook, setActiveTab, showToast }: UseWorkflowImportExportOpts) {
  const handleWorkflowExport = useCallback((id: string) => {
    const wf = wfHook.workflows.find(w => w.id === id);
    if (!wf) return;
    const hasVersions = countWorkflowVersions(wf) > 0;
    const exported = hasVersions ? stripWorkflowVersions(wf) : wf;
    const filename = buildExportFilename({ level: 'workflow', name: wf.name });
    saveJsonFile(exported, filename);
  }, [wfHook.workflows]);

  const handleWorkflowImport = useCallback(() => {
    const doImport = (raw: unknown) => {
      const wf = raw as Workflow;
      if (!wf || typeof wf !== 'object' || !wf.name || !Array.isArray(wf.nodes)) {
        showToast('error', 'Invalid workflow file');
        return;
      }
      wfHook.insert({ ...wf, id: crypto.randomUUID() });
      setActiveTab('workflow');
    };
    if (isTauri()) {
      openJsonFile().then(result => {
        if (!result) return;
        try { doImport(JSON.parse(result.content)); } catch { showToast('error', 'Invalid JSON file'); }
      });
    } else {
      pickJsonFile(doImport, (msg) => showToast('error', 'Import failed', msg));
    }
  }, [wfHook, setActiveTab, showToast]);

  return { handleWorkflowExport, handleWorkflowImport };
}
