export type Tab = 'environments' | 'preferences' | 'requests' | 'catalog' | 'workflow' | 'workflow-executions' | 'webhook-deliveries' | 'gallery' | 'training' | 'scenarios' | 'runner' | 'results';

export type Domain = 'api' | 'workflow' | 'testing' | 'gallery' | 'settings';

const HARNESS_TABS = new Set<Tab>(['scenarios', 'runner', 'results']);
export const isHarnessTab = (t: Tab) => HARNESS_TABS.has(t);

const WORKFLOW_TABS = new Set<Tab>(['workflow', 'workflow-executions', 'webhook-deliveries']);
export const isWorkflowTab = (t: Tab) => WORKFLOW_TABS.has(t);

const GALLERY_TABS = new Set<Tab>(['gallery', 'training']);
export const isGalleryTab = (t: Tab) => GALLERY_TABS.has(t);

const API_TABS = new Set<Tab>(['requests', 'catalog']);
export const isApiTab = (t: Tab) => API_TABS.has(t);

const SETTINGS_TABS = new Set<Tab>(['environments', 'preferences']);
export const isSettingsTab = (t: Tab) => SETTINGS_TABS.has(t);

/** Derive the active domain from the current tab. */
export function domainOf(tab: Tab): Domain {
  if (isApiTab(tab)) return 'api';
  if (isWorkflowTab(tab)) return 'workflow';
  if (isGalleryTab(tab)) return 'gallery';
  if (isHarnessTab(tab)) return 'testing';
  return 'settings';
}

const ALL_TABS = new Set<Tab>(['environments', 'preferences', 'requests', 'catalog', 'workflow', 'workflow-executions', 'webhook-deliveries', 'gallery', 'training', 'scenarios', 'runner', 'results']);
const TAB_QUERY = 'tab';
const DEFAULT_TAB: Tab = 'requests';

/** Read active tab from ?tab= so refresh keeps Environments / Workflow / Harness / etc. */
export function readTabFromUrl(): Tab {
  try {
    const q = new URLSearchParams(window.location.search).get(TAB_QUERY);
    if (q && ALL_TABS.has(q as Tab)) return q as Tab;
  } catch {
    /* ignore */
  }
  return DEFAULT_TAB;
}

export function writeTabToUrl(tab: Tab): void {
  try {
    const url = new URL(window.location.href);
    if (tab === DEFAULT_TAB) {
      url.searchParams.delete(TAB_QUERY);
    } else {
      url.searchParams.set(TAB_QUERY, tab);
    }
    const serialized = url.pathname + (url.search ? url.search : '') + url.hash;
    const current = window.location.pathname + window.location.search + window.location.hash;
    if (serialized !== current) {
      window.history.replaceState(window.history.state, '', serialized);
    }
  } catch {
    /* ignore */
  }
}
