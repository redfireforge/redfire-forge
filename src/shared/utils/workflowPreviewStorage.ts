import { readKey, writeKey } from './storage';

const KEY = 'perf-test-v3-workflow-previews';

export interface WorkflowPreviewEntry {
  entryId: string;
  endpointId: string;
  method: string;
  path: string;
  summary: string;
  entryName: string;
  addedAt: number;
  values?: {
    paramValues: Record<string, string>;
    headerValues: Record<string, string>;
    body?: string;
  };
}

export type PreviewMap = Record<string, WorkflowPreviewEntry>;

function previewKey(entryId: string, endpointId: string): string {
  return `${entryId}::${endpointId}`;
}

export async function loadWorkflowPreviews(): Promise<PreviewMap> {
  const raw = await readKey(KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as PreviewMap;
  } catch {
    return {};
  }
}

export async function saveWorkflowPreviews(map: PreviewMap): Promise<void> {
  await writeKey(KEY, JSON.stringify(map));
}

export async function addWorkflowPreview(entry: WorkflowPreviewEntry): Promise<void> {
  const map = await loadWorkflowPreviews();
  map[previewKey(entry.entryId, entry.endpointId)] = entry;
  await saveWorkflowPreviews(map);
}

export async function removeWorkflowPreview(entryId: string, endpointId: string): Promise<void> {
  const map = await loadWorkflowPreviews();
  delete map[previewKey(entryId, endpointId)];
  await saveWorkflowPreviews(map);
}

export async function clearAllPreviews(): Promise<void> {
  await writeKey(KEY, '{}');
}

export function isPreviewedEndpoint(map: PreviewMap, entryId: string, endpointId: string): boolean {
  return previewKey(entryId, endpointId) in map;
}

export function getPreviewedEndpointIds(map: PreviewMap, entryId: string): Set<string> {
  const ids = new Set<string>();
  for (const [key, entry] of Object.entries(map)) {
    if (entry.entryId === entryId) {
      const epId = key.split('::')[1];
      if (epId) ids.add(epId);
    }
  }
  return ids;
}

export function getPreviewEntriesForPalette(map: PreviewMap): WorkflowPreviewEntry[] {
  return Object.values(map);
}
