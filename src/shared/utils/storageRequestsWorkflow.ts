import type { RequestsData } from '../types';
import { isTauri } from './platform';
import {
  idbLoadRequests,
  idbSaveRequests,
  idbMigrateRequests,
} from './idbRequests';
import {
  REQUESTS_KEY,
  LEGACY_WORKBENCH_KEY,
} from './storageKeys';
import { readKey, writeKey, removeKey } from './storage';

const EMPTY_REQUESTS: RequestsData = {
  environments: [],
  collections: [],
};

function normalizeRequestsData(data: RequestsData): RequestsData {
  return {
    environments: Array.isArray(data.environments) ? data.environments : [],
    collections: Array.isArray(data.collections) ? data.collections : [],
    selectedEnvId: data.selectedEnvId,
    selectedCollectionId: data.selectedCollectionId,
    selectedRequestId: data.selectedRequestId,
  };
}

export async function loadRequests(): Promise<RequestsData> {
  if (isTauri()) {
    try {
      const raw = await readKey(REQUESTS_KEY);
      if (raw) return normalizeRequestsData(JSON.parse(raw) as RequestsData);
      const legacy = await readKey(LEGACY_WORKBENCH_KEY);
      if (legacy) {
        const data = normalizeRequestsData(JSON.parse(legacy) as RequestsData);
        await writeKey(REQUESTS_KEY, legacy);
        await removeKey(LEGACY_WORKBENCH_KEY);
        return data;
      }
    } catch { /* ignore */ }
    return { ...EMPTY_REQUESTS };
  }
  // Browser: IDB first, then localStorage fallback + migration
  try {
    const fromIdb = await idbLoadRequests();
    if (fromIdb) return normalizeRequestsData(fromIdb);
    const raw = await readKey(REQUESTS_KEY);
    if (raw) {
      const data = normalizeRequestsData(JSON.parse(raw) as RequestsData);
      await idbMigrateRequests(REQUESTS_KEY);
      return data;
    }
    const legacy = await readKey(LEGACY_WORKBENCH_KEY);
    if (legacy) {
      const data = normalizeRequestsData(JSON.parse(legacy) as RequestsData);
      await idbSaveRequests(data);
      await removeKey(LEGACY_WORKBENCH_KEY);
      return data;
    }
  } catch { /* ignore */ }
  return { ...EMPTY_REQUESTS };
}

export async function saveRequests(data: RequestsData): Promise<void> {
  if (isTauri()) {
    await writeKey(REQUESTS_KEY, JSON.stringify(data));
    return;
  }
  try {
    await idbSaveRequests(data);
    if (localStorage.getItem(REQUESTS_KEY)) localStorage.removeItem(REQUESTS_KEY);
  } catch {
    await writeKey(REQUESTS_KEY, JSON.stringify(data));
  }
}

/** Last selected workflow id in the designer (survives refresh). */
const WORKFLOWS_SELECTED_ID_KEY = 'workflows_selected_id';
/** When true, do not auto-inject the built-in sample workflow on load (user removed it). */
const WORKFLOWS_SAMPLE_DISMISSED_KEY = 'workflows_sample_dismissed';

export async function loadSelectedWorkflowId(): Promise<string | null> {
  try {
    const r = await readKey(WORKFLOWS_SELECTED_ID_KEY);
    return r?.trim() ? r.trim() : null;
  } catch {
    return null;
  }
}

export async function saveSelectedWorkflowId(id: string | null): Promise<void> {
  if (id?.trim()) {
    await writeKey(WORKFLOWS_SELECTED_ID_KEY, id.trim());
  } else {
    await removeKey(WORKFLOWS_SELECTED_ID_KEY);
  }
}

export async function loadWorkflowSampleDismissed(): Promise<boolean> {
  try {
    const r = await readKey(WORKFLOWS_SAMPLE_DISMISSED_KEY);
    return r === 'true';
  } catch {
    return false;
  }
}

export async function saveWorkflowSampleDismissed(dismissed: boolean): Promise<void> {
  await writeKey(WORKFLOWS_SAMPLE_DISMISSED_KEY, dismissed ? 'true' : 'false');
}
