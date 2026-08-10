/**
 * WF-7 — Versioning, Services & Catalog Integration
 *
 * 8 steps: browse version history → compare two versions → restore an older
 * version → add/configure/Apply service → assign service to HTTP nodes →
 * view published Catalog endpoint → see CAT badge on workflow node →
 * demonstrate orphan badge (unpublish/re-publish).
 *
 * Prerequisite: seeded 5-node workflow with 2 pre-built version snapshots
 * and one HTTP node whose `catalogRef` points to a published Catalog endpoint.
 */
import type { DemoActionContext, DemoLesson } from '../../types';
import { WF, CAT } from '@shared/selectors';
import { showSpotlightRing } from '../../demoRipple';
import { clearLiveDemoPanelFromTarget } from '../../demoSpotlightUtils';
import {
  collapseWfDemoAppSidebar,
  closeWfConfigModalIfOpen,
  cleanupWorkflowDemoRunUi,
  clickWfConfigTab,
  resetWfPaletteToBlocks,
  ensureLessonWorkflowShown,
  saveAndCloseWfConfigModal,
} from '../wf-demo-helpers';
import {
  JSONPLACEHOLDER_API_SPEC,
  seedCatalogEntry,
  deleteCatalogEntryByName,
  selectCatalogEntryByName,
  getCatalogEntryByName,
} from '../api/cat-demo-helpers';
import { publishCatalogEndpointByName } from '../../adapters';
import {
  deleteWorkflowByName,
  seedNamedWorkflow,
  waitForWorkflowBridge,
  fitWorkflowCanvasView,
  patchWorkflowNodeDataById,
  patchWorkflowByName,
  syncLiveWorkflowFromPatch,
  ensureSettingsEnvironment,
  ensureSettingsMicroservice,
  removeSettingsEnvironment,
  removeSettingsMicroservice,
  selectSettingsEnvSvc,
  clearWorkflowSamplePreview,
  getWorkflowByName,
  openWorkflowNodeConfig,
} from '../../adapters';

// ─── Constants ──────────────────────────────────────────────────────

const WF_NAME = 'Version Demo';
const BASE_URL = 'https://jsonplaceholder.typicode.com';
const CATALOG_ENTRY_NAME = 'JSONPlaceholder API';
const CATALOG_METHOD = 'GET';
const CATALOG_PATH = '/posts/{id}';
const CAT_HTTP_NODE_ID = 'http-get';
const DEMO_ENV_NAME = 'demo';
const DEMO_MS_NAME = 'jsonplaceholder';
let seededEnvId = '';
let seededMsId = '';

// ─── Version snapshots ──────────────────────────────────────────────

const V1_NODES = [
  { id: 'start-1', type: 'start', position: { x: 50, y: 200 }, data: { label: 'Start' } },
  {
    id: 'http-post', type: 'http', position: { x: 280, y: 200 },
    data: {
      label: 'Create Post',
      scenario: {
        id: 'wf7-post', name: 'Create Post', url: `${BASE_URL}/posts`, method: 'POST',
        headers: [{ key: 'Content-Type', value: 'application/json' }],
        body: JSON.stringify({ title: 'Hello', body: 'World', userId: 1 }),
        auth: { type: 'none' }, validation: { mode: 'none' }, extractions: [],
      },
      timeoutSec: 0,
    },
  },
  {
    id: CAT_HTTP_NODE_ID, type: 'http', position: { x: 520, y: 200 },
    data: {
      label: 'Get Post',
      scenario: {
        id: 'wf7-get', name: 'Get Post', url: `${BASE_URL}/posts/1`, method: 'GET',
        headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' }, extractions: [],
      },
      timeoutSec: 0,
    },
  },
];
const V1_EDGES = [
  { id: 'e-start-post', source: 'start-1', target: 'http-post' },
  { id: 'e-post-get', source: 'http-post', target: CAT_HTTP_NODE_ID },
];

const V2_NODES = [
  ...V1_NODES,
  {
    id: 'cond-check', type: 'condition', position: { x: 760, y: 200 },
    data: { label: 'Has Title?', left: '{{postTitle}}', operator: '!=', right: '' },
  },
  {
    id: 'log-ok', type: 'logDebug', position: { x: 1000, y: 160 },
    data: { label: 'Title OK', message: 'Post title verified', logLevel: 'info', snapshotVariables: false },
  },
];
const V2_EDGES = [
  ...V1_EDGES,
  { id: 'e-get-cond', source: CAT_HTTP_NODE_ID, target: 'cond-check' },
  { id: 'e-cond-log', source: 'cond-check', target: 'log-ok', sourceHandle: 'true' },
];

function makeVersion(
  id: string, label: string, ageMs: number,
  nodes: unknown[], edges: unknown[], variables: Record<string, string>,
  services?: unknown[],
) {
  return {
    id, label,
    timestamp: Date.now() - ageMs,
    fingerprint: id,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    nodes, edges, variables,
    ...(services ? { services } : {}),
  };
}

const SEED_SERVICE_JSON = {
  id: 'svc-jsonplaceholder',
  name: 'JSONPlaceholder',
  endpoints: [
    { envId: '__adhoc__', url: BASE_URL, enabled: true, authMode: 'inherit', source: 'manual' },
    { envId: '__all__', url: BASE_URL, enabled: true, authMode: 'inherit', source: 'manual' },
  ],
  notes: 'Demo service for JSONPlaceholder REST API',
};

const SEED_SERVICES = [SEED_SERVICE_JSON];

const SEED_WORKFLOW = {
  name: WF_NAME,
  nodes: V2_NODES,
  edges: V2_EDGES,
  variables: { userId: '42' },
  services: [],
  versions: [
    makeVersion('v2', 'Added condition branch', 3600_000, V2_NODES, V2_EDGES, { userId: '42' }, SEED_SERVICES),
    makeVersion('v1', 'Initial workflow', 86400_000, V1_NODES, V1_EDGES, {}),
  ],
};

// ─── Helpers ────────────────────────────────────────────────────────

let activeCleanup: (() => void) | null = null;

function spotlight(el: HTMLElement, holdMs: number, ctx: DemoActionContext): Promise<void> {
  activeCleanup?.();
  activeCleanup = null;
  if (!el.closest('.react-flow')) {
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  // Nudge the Live Demo card away so dropdown menus / modals stay visible.
  clearLiveDemoPanelFromTarget(el);
  const remove = showSpotlightRing(el);
  activeCleanup = remove;
  return ctx.delay(holdMs).then(() => { remove(); if (activeCleanup === remove) activeCleanup = null; });
}

async function spotlightSel(ctx: DemoActionContext, sel: string, holdMs: number): Promise<void> {
  const el = document.querySelector<HTMLElement>(sel);
  if (el) await spotlight(el, holdMs, ctx);
}

/**
 * CustomSelect menus portal to `document.body` — never query `.cs-item` inside the
 * wrapper. Also clear the Live Demo panel so it cannot cover the open menu.
 */
async function pickPortaledSelectByLabel(
  ctx: DemoActionContext,
  wrapper: HTMLElement,
  labelIncludes: string,
): Promise<boolean> {
  clearLiveDemoPanelFromTarget(wrapper);
  await spotlight(wrapper, 900, ctx);
  const trigger = wrapper.querySelector<HTMLElement>('.cs-trigger');
  if (!trigger) return false;
  trigger.click();
  await ctx.delay(700);
  const menu = document.querySelector<HTMLElement>('body > .cs-menu');
  if (menu) {
    clearLiveDemoPanelFromTarget(menu);
    await spotlight(menu, 700, ctx);
  }
  const needle = labelIncludes.toLowerCase();
  const items = Array.from(document.querySelectorAll<HTMLElement>('body > .cs-menu .cs-item'));
  // Prefer exact name (before " ! N missing") so "demo" does not match "gRPC Demo".
  const exact = items.find((item) => {
    const nameOnly = (item.textContent ?? '').trim().toLowerCase().split('!')[0].trim();
    return nameOnly === needle;
  });
  const partial = items.find((item) => (item.textContent ?? '').toLowerCase().includes(needle));
  const match = exact ?? partial;
  if (match) {
    await spotlight(match, 1000, ctx);
    match.click();
    await ctx.delay(900);
    return true;
  }
  if (trigger.getAttribute('aria-expanded') === 'true') trigger.click();
  return false;
}

/**
 * Force header + Designer Quick-Test env to **demo** with zero UI.
 * Never open CustomSelect / spotlight — Preparing has no cover, so a menu
 * flash is visible to the viewer.
 */
function selectDemoEnvQuiet(): void {
  if (!seededEnvId) seededEnvId = ensureSettingsEnvironment(DEMO_ENV_NAME);
  if (!seededEnvId) return;
  if (!seededMsId) {
    seededMsId = ensureSettingsMicroservice(
      DEMO_MS_NAME,
      seededEnvId ? { [seededEnvId]: BASE_URL } : {},
    );
  }
  selectSettingsEnvSvc(seededEnvId, seededMsId);
}

function findServiceIdByName(name: string): string | null {
  const wf = getWorkflowByName<{ services?: { id: string; name: string }[] }>(WF_NAME);
  return wf?.services?.find((s) => s.name === name)?.id
    ?? (name === SEED_SERVICE_JSON.name ? SEED_SERVICE_JSON.id : null);
}

function canvasNodeByLabel(label: string): HTMLElement | null {
  const nodes = document.querySelectorAll<HTMLElement>('.react-flow__node');
  for (const node of nodes) {
    const labelEl = node.querySelector('.wf-node-label');
    if (labelEl?.textContent?.trim() === label || node.textContent?.includes(label)) {
      return node;
    }
  }
  return null;
}

/** Ask Live Demo to dodge a large center region (registry / node config + menus). */
function clearLiveDemoFromCenterStage(): void {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  window.dispatchEvent(
    new CustomEvent('demo-live-panel:clear-target', {
      detail: {
        top: Math.round(vh * 0.12),
        left: Math.round(vw * 0.18),
        right: Math.round(vw * 0.82),
        bottom: Math.round(vh * 0.88),
      },
    }),
  );
}

async function openServiceRegistryModal(ctx: DemoActionContext): Promise<void> {
  if (document.querySelector('.wf-svc-registry-modal')) {
    clearLiveDemoFromCenterStage();
    return;
  }
  const svcBtn = document.querySelector<HTMLElement>(WF.SERVICES_BTN);
  if (svcBtn) {
    await spotlight(svcBtn, 1000, ctx);
    svcBtn.click();
    await ctx.delay(400);
  }
  const expandBtn = document.querySelector<HTMLElement>('.wf-services-panel button[title="Open Service Registry"]');
  if (expandBtn) {
    await spotlight(expandBtn, 900, ctx);
    expandBtn.click();
    await ctx.delay(1200);
  }
  await waitForSelector('.wf-svc-registry-modal', 4000);
  clearLiveDemoFromCenterStage();
}

async function ensureJsonPlaceholderServiceApplied(ctx: DemoActionContext): Promise<string> {
  let svcId = findServiceIdByName('JSONPlaceholder');
  if (!svcId) {
    patchWorkflowByName(WF_NAME, { services: [SEED_SERVICE_JSON] });
    syncLiveWorkflowFromPatch(WF_NAME, { services: [SEED_SERVICE_JSON] });
    await ctx.delay(200);
    svcId = SEED_SERVICE_JSON.id;
  }
  return svcId;
}

function fitCanvasCentered(opts?: { silent?: boolean }): void {
  if (opts?.silent || document.body.getAttribute('data-demo-bootstrapping') === '1') {
    fitWorkflowCanvasView({ duration: 0, maxZoom: 1, minZoom: 0.4, padding: 0.15 });
    return;
  }
  const btn = document.querySelector<HTMLElement>(WF.FIT_VIEW_BTN);
  if (btn) { btn.click(); return; }
  fitWorkflowCanvasView();
}

function closeVersionPanel(): void {
  const closeBtn = document.querySelector<HTMLElement>(WF.VERSION_CLOSE_BTN);
  if (closeBtn) closeBtn.click();
}

function closeServicePanel(): void {
  // Close the full-page Service Registry modal if expanded
  const fullModalCancel = document.querySelector<HTMLElement>('.wf-svc-registry-modal .wf-config-modal-footer .btn:not(.btn-primary)');
  if (fullModalCancel) { fullModalCancel.click(); }
  // Also try the generic config modal close (belt-and-suspenders)
  if (!fullModalCancel) {
    const genericCancel = document.querySelector<HTMLElement>('.wf-config-modal .wf-config-modal-footer .btn:not(.btn-primary)');
    if (genericCancel) { genericCancel.click(); }
  }
  // Close the inline panel
  const panel = document.querySelector<HTMLElement>(WF.SVC_PANEL);
  if (!panel) return;
  const closeBtn = panel.querySelector<HTMLElement>('button[title="Close"]');
  if (closeBtn) { closeBtn.click(); return; }
  // Fallback: toggle via toolbar button
  const svcBtn = document.querySelector<HTMLElement>(WF.SERVICES_BTN);
  if (svcBtn) svcBtn.click();
}

function closeDiffModal(): void {
  const modal = document.querySelector<HTMLElement>(WF.VERSION_DIFF_MODAL);
  if (!modal) return;
  const close = modal.querySelector<HTMLElement>('.btn-primary');
  if (close) close.click();
}

async function waitForSelector(sel: string, timeout = 3000): Promise<HTMLElement | null> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const el = document.querySelector<HTMLElement>(sel);
    if (el) return el;
    await new Promise(r => setTimeout(r, 80));
  }
  return null;
}

async function ensureSeededWorkflow(ctx: DemoActionContext): Promise<void> {
  const quiet = document.body.getAttribute('data-demo-bootstrapping') === '1';
  ctx.navigateToTab('workflow');
  await ctx.delay(quiet ? 80 : 200);
  await waitForWorkflowBridge(ctx);

  const state = await ensureLessonWorkflowShown(ctx, WF_NAME);
  if (state !== 'missing') {
    // Only re-fit when we actually SWITCHED to this lesson's workflow from a
    // different one. When it's already shown ('ready'), the canvas is exactly where
    // the previous step left it — re-fitting every step causes visible jumping.
    // Skip animated Fit during Preparing — setup already did a silent fit.
    if (state === 'selected' && !quiet) {
      fitCanvasCentered();
      await ctx.delay(400);
    }
    return;
  }

  await seedNamedWorkflow(ctx, WF_NAME, SEED_WORKFLOW as Record<string, unknown>);
  await ctx.delay(quiet ? 200 : 600);
  fitCanvasCentered({ silent: quiet });
  await ctx.delay(quiet ? 50 : 400);
}

function isCatalogEndpointPublished(
  entry: Record<string, unknown> | null,
  method: string,
  path: string,
): boolean {
  if (!entry) return false;
  const queue: Array<Record<string, unknown>> = [
    ...((entry.endpoints ?? []) as Array<Record<string, unknown>>),
    ...((entry.folders ?? []) as Array<Record<string, unknown>>),
  ];
  while (queue.length > 0) {
    const item = queue.shift()!;
    if (item.endpoints) { queue.push(...(item.endpoints as Array<Record<string, unknown>>)); continue; }
    if (item.folders) { queue.push(...(item.folders as Array<Record<string, unknown>>)); continue; }
    if (
      (item.method as string)?.toUpperCase() === method &&
      item.path === path &&
      (!!item.workflowPublication || item.workflowExposure === 'published')
    ) {
      return true;
    }
  }
  return false;
}

/** Expand GET /posts/{id}, open Try It Out, and fill sample id — quiet prep for the Catalog surface. */
async function preparePublishedEndpointSurface(ctx: DemoActionContext): Promise<void> {
  const card = await waitForSelector(CAT.endpointCard(CATALOG_METHOD, CATALOG_PATH), 2000);
  if (!card) return;

  if (!card.querySelector('.sw-body')) {
    const header = card.querySelector<HTMLElement>('.sw-header');
    if (header) {
      header.click();
      await ctx.delay(80);
    }
  }

  const tryitBtn = card.querySelector<HTMLButtonElement>(CAT.TRYIT_BTN);
  if (tryitBtn && !tryitBtn.classList.contains('cancel')) {
    tryitBtn.click();
    await ctx.delay(80);
  }

  const idInput = card.querySelector<HTMLInputElement>('input[placeholder*="id"]');
  if (idInput && idInput.value !== '1') {
    idInput.focus();
    idInput.value = '1';
    idInput.dispatchEvent(new Event('input', { bubbles: true }));
    idInput.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

/**
 * Ensure catalog entry exists and GET /posts/{id} is Published — data-layer only.
 * Does not navigate tabs (avoids blank Preparing / catalog flash).
 */
async function ensureCatalogPublished(ctx: DemoActionContext): Promise<void> {
  if (!getCatalogEntryByName(CATALOG_ENTRY_NAME)) {
    await seedCatalogEntry(CATALOG_ENTRY_NAME, JSONPLACEHOLDER_API_SPEC);
    await ctx.delay(80);
  }
  if (!isCatalogEndpointPublished(getCatalogEntryByName(CATALOG_ENTRY_NAME), CATALOG_METHOD, CATALOG_PATH)) {
    publishCatalogEndpointByName(CATALOG_ENTRY_NAME, CATALOG_METHOD, CATALOG_PATH);
    await ctx.delay(40);
  }
}

/** Set the HTTP node's catalogRef to point to the published catalog endpoint. */
function applyCatalogRef(): void {
  const entry = getCatalogEntryByName(CATALOG_ENTRY_NAME);
  if (!entry) return;

  const entryId = entry.id as string;
  let endpointId = '';

  // Flatten top-level endpoints + nested folders to find the target endpoint
  const queue: Array<Record<string, unknown>> = [
    ...((entry.endpoints ?? []) as Array<Record<string, unknown>>),
    ...((entry.folders ?? []) as Array<Record<string, unknown>>),
  ];
  while (queue.length > 0) {
    const item = queue.shift()!;
    if (item.endpoints) {
      queue.push(...(item.endpoints as Array<Record<string, unknown>>));
      continue;
    }
    if (item.folders) {
      queue.push(...(item.folders as Array<Record<string, unknown>>));
      continue;
    }
    if (
      (item.method as string)?.toUpperCase() === CATALOG_METHOD &&
      item.path === CATALOG_PATH
    ) {
      endpointId = item.id as string;
      break;
    }
  }

  if (!entryId || !endpointId) return;

  patchWorkflowNodeDataById(CAT_HTTP_NODE_ID, {
    sourceType: 'catalog',
    catalogRef: { entryId, endpointId, method: CATALOG_METHOD, path: CATALOG_PATH },
  });
}


// ─── Lesson ─────────────────────────────────────────────────────────

export const wfVersionServicesLesson: DemoLesson = {
  id: 'wf-version-services',
  domainId: 'workflow',
  category: 'tooling',
  name: 'Versioning, Services & Catalog Integration',
  description:
    'Track workflow changes with version snapshots, compare diffs, restore, and understand how workflow nodes relate to Catalog endpoints.',
  estimatedMinutes: 9,
  initialTab: 'workflow',
  allowedTabs: ['workflow', 'catalog'],
  // Avoid hub expand→collapse during Preparing (that reflows Fit View).
  collapseAppSidebarOnStart: true,

  // Seed + select BEFORE Workflow mounts so Start Demo never paints a stale canvas.
  prepareBeforeNavigate: async (ctx) => {
    clearWorkflowSamplePreview();
    await waitForWorkflowBridge(ctx);
    deleteWorkflowByName(WF_NAME);
    await ctx.delay(80);
    await seedNamedWorkflow(ctx, WF_NAME, SEED_WORKFLOW as Record<string, unknown>, {
      deleteDelayMs: 50,
      insertDelayMs: 120,
      bridgeTimeoutMs: 4000,
      storeTimeoutMs: 2500,
      selectAfterSeed: true,
    });
    // Quiet env/svc before the Designer paints — no dropdown flash under Preparing.
    seededEnvId = ensureSettingsEnvironment(DEMO_ENV_NAME);
    seededMsId = ensureSettingsMicroservice(DEMO_MS_NAME, seededEnvId ? { [seededEnvId]: BASE_URL } : {});
    selectDemoEnvQuiet();
    clearWorkflowSamplePreview();
    await ctx.delay(40);
  },

  concept: {
    title: 'Versioning & Integration',
    body:
      'The Workflow Designer tracks changes automatically:\n\n' +
      '**Version History** — every Save creates a snapshot if the graph changed. ' +
      'Browse versions, compare diffs (nodes, edges, variables, services), and restore ' +
      'any previous version without losing history.\n\n' +
      '**Service Registry** — define named services with per-environment URLs. ' +
      'HTTP nodes bind to a service instead of hardcoding base URLs, making environment ' +
      'switching seamless.\n\n' +
      '**Catalog Integration** — HTTP nodes created from published Catalog endpoints ' +
      'show a **CAT** badge. If the source endpoint is unpublished, an **⚠ orphan badge** ' +
      'warns that the link is broken — the node still works, but its Catalog connection is gone.',
    keyTerms: [
      { term: 'Version Snapshot', definition: 'A frozen copy of nodes, edges, variables, and services created on each Save.' },
      { term: 'Version Diff', definition: 'Side-by-side comparison showing added, removed, and modified elements between two versions.' },
      { term: 'Service Registry', definition: 'Named services with per-environment base URLs, bound to HTTP nodes via serviceId.' },
      { term: 'CAT Badge', definition: 'Indicates an HTTP node was created from a published Catalog endpoint.' },
      { term: 'Orphan Badge', definition: 'Warning ⚠ shown when a node\'s source Catalog endpoint has been unpublished.' },
    ],
    diagram: `<svg viewBox="0 0 440 100" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="10" width="130" height="80" rx="6" fill="#1e293b" stroke="#3b4a60" stroke-width="1"/>
      <text x="70" y="28" text-anchor="middle" fill="#94a3b8" font-size="6" font-weight="600">Version History</text>
      <rect x="12" y="34" width="116" height="14" rx="3" fill="#0f172a" stroke="#3b82f6" stroke-width="0.8"/>
      <circle cx="20" cy="41" r="3" fill="#3b82f6"/><text x="28" y="44" fill="#f1f5f9" font-size="5">v2 — Condition branch</text>
      <rect x="12" y="52" width="116" height="14" rx="3" fill="#0f172a" stroke="#3b4a60" stroke-width="0.8"/>
      <circle cx="20" cy="59" r="3" fill="#64748b"/><text x="28" y="62" fill="#94a3b8" font-size="5">v1 — Initial workflow</text>
      <text x="70" y="80" text-anchor="middle" fill="#3b82f6" font-size="5">[Compare] [Restore]</text>
      <rect x="155" y="25" width="120" height="50" rx="6" fill="#1e293b" stroke="#3b4a60" stroke-width="1"/>
      <text x="215" y="42" text-anchor="middle" fill="#94a3b8" font-size="6" font-weight="600">HTTP Node</text>
      <rect x="163" y="48" width="25" height="10" rx="2" fill="#0f172a" stroke="#10b981" stroke-width="0.8"/>
      <text x="175" y="56" text-anchor="middle" fill="#10b981" font-size="5" font-weight="700">CAT</text>
      <rect x="192" y="48" width="18" height="10" rx="2" fill="rgba(245,158,11,0.18)" stroke="#f59e0b" stroke-width="0.8"/>
      <text x="201" y="56" text-anchor="middle" fill="#f59e0b" font-size="5">⚠</text>
      <text x="215" y="70" fill="#64748b" font-size="4.5">source → Catalog</text>
      <rect x="295" y="15" width="140" height="70" rx="6" fill="#1e293b" stroke="#3b4a60" stroke-width="1"/>
      <text x="365" y="30" text-anchor="middle" fill="#94a3b8" font-size="6" font-weight="600">Service Registry</text>
      <rect x="302" y="36" width="126" height="12" rx="2" fill="#0f172a" stroke="#3b4a60" stroke-width="0.6"/>
      <text x="310" y="45" fill="#f1f5f9" font-size="5">JSONPlaceholder</text>
      <rect x="302" y="52" width="126" height="12" rx="2" fill="#0f172a" stroke="#3b4a60" stroke-width="0.6"/>
      <text x="310" y="61" fill="#64748b" font-size="4.5">prod: jsonplaceholder.typicode.com</text>
      <rect x="302" y="68" width="126" height="12" rx="2" fill="#0f172a" stroke="#3b4a60" stroke-width="0.6"/>
      <text x="310" y="77" fill="#64748b" font-size="4.5">staging: localhost:3000</text>
    </svg>`,
  },

  setup: async (ctx) => {
    // Tab already shows Version Demo from prepareBeforeNavigate — do not
    // delete/reseed here (that flashes another canvas under Preparing).
    resetWfPaletteToBlocks();
    await waitForWorkflowBridge(ctx);
    await collapseWfDemoAppSidebar(ctx);
    if ((await ensureLessonWorkflowShown(ctx, WF_NAME)) === 'missing') {
      await seedNamedWorkflow(ctx, WF_NAME, SEED_WORKFLOW as Record<string, unknown>, {
        deleteDelayMs: 50,
        insertDelayMs: 200,
      });
    }
    if (!seededEnvId) seededEnvId = ensureSettingsEnvironment(DEMO_ENV_NAME);
    if (!seededMsId) {
      seededMsId = ensureSettingsMicroservice(
        DEMO_MS_NAME,
        seededEnvId ? { [seededEnvId]: BASE_URL } : {},
      );
    }
    selectDemoEnvQuiet();
    // One silent fit after final canvas width is settled.
    fitCanvasCentered({ silent: true });
    await ctx.delay(120);

    // Seed + publish catalog via bridge only (no tab navigation — stays on workflow)
    try {
      if (!getCatalogEntryByName(CATALOG_ENTRY_NAME)) {
        await seedCatalogEntry(CATALOG_ENTRY_NAME, JSONPLACEHOLDER_API_SPEC);
        await ctx.delay(120);
      }
      publishCatalogEndpointByName(CATALOG_ENTRY_NAME, CATALOG_METHOD, CATALOG_PATH);
    } catch { /* catalog seeding is optional */ }
  },

  cleanup: async (ctx) => {
    closeDiffModal();
    closeVersionPanel();
    closeServicePanel();
    await closeWfConfigModalIfOpen(ctx);
    await cleanupWorkflowDemoRunUi(ctx);
    deleteWorkflowByName(WF_NAME);
    deleteCatalogEntryByName(CATALOG_ENTRY_NAME);
    removeSettingsMicroservice(DEMO_MS_NAME);
    removeSettingsEnvironment(DEMO_ENV_NAME);
    await collapseWfDemoAppSidebar(ctx);
    await ctx.delay(100);
  },

  steps: [
    // ── Step 1: Browse Version History ───────────────────────────────
    {
      id: 'wf7-versions-panel',
      title: 'Browse Version History',
      description:
        'Every time you **Save** a workflow, a version snapshot is created if the graph ' +
        'changed. Click **Versions** in the toolbar to open the Version History panel.\n\n' +
        'This workflow has two versions:\n' +
        '- **Added condition branch** — 5 nodes, 4 edges (current)\n' +
        '- **Initial workflow** — 3 nodes, 2 edges (the original)\n\n' +
        'Each entry shows node/edge counts, timestamps, and a change summary.',
      highlight: WF.VERSIONS_BTN,

      preAction: async (ctx) => {
        await ensureSeededWorkflow(ctx);
        closeVersionPanel();
        closeServicePanel();
      },

      action: async (ctx) => {
        // Spotlight and click the Versions button
        await spotlightSel(ctx, WF.VERSIONS_BTN, 1200);
        const versionsBtn = document.querySelector<HTMLElement>(WF.VERSIONS_BTN);
        if (versionsBtn) versionsBtn.click();
        await ctx.delay(800);

        // Spotlight the version panel
        await spotlightSel(ctx, WF.VERSION_PANEL, 1000);

        // Spotlight the version entries
        const items = document.querySelectorAll<HTMLElement>(WF.VERSION_ITEM);
        for (const item of items) {
          await spotlight(item, 1200, ctx);
        }
      },

      verify: WF.VERSION_PANEL,
    },

    // ── Step 2: Compare Two Versions ────────────────────────────────
    {
      id: 'wf7-compare',
      title: 'Compare Two Versions',
      description:
        'Select both versions by clicking their checkboxes, then click **Compare** ' +
        'to open the Version Diff modal.\n\n' +
        'The diff has four tabs:\n' +
        '- **Nodes** — shows added Condition and Log nodes\n' +
        '- **Edges** — shows new connections\n' +
        '- **Variables** — shows added `userId` variable\n' +
        '- **Services** — shows added JSONPlaceholder service',
      highlight: WF.VERSION_PANEL,

      preAction: async (ctx) => {
        await ensureSeededWorkflow(ctx);
        closeDiffModal();
        // Ensure version panel is open
        if (!document.querySelector(WF.VERSION_PANEL)) {
          const btn = document.querySelector<HTMLElement>(WF.VERSIONS_BTN);
          if (btn) btn.click();
          await ctx.delay(600);
        }
        // Deselect any previously selected items (from re-play)
        const checked = document.querySelectorAll<HTMLElement>(`${WF.VERSION_ITEM} .wfv-checkbox-checked`);
        for (const c of checked) {
          const item = c.closest<HTMLElement>(WF.VERSION_ITEM);
          if (item) item.click();
        }
      },

      action: async (ctx) => {
        // Click the checkboxes on both version items to select them
        const items = document.querySelectorAll<HTMLElement>(WF.VERSION_ITEM);
        for (const item of items) {
          const checkbox = item.querySelector<HTMLElement>(WF.VERSION_CHECKBOX);
          if (checkbox && !checkbox.classList.contains('wfv-checkbox-checked')) {
            item.click();
            await ctx.delay(500);
          }
        }

        // Spotlight the Compare button
        const compareBtn = document.querySelector<HTMLElement>(WF.VERSION_COMPARE_BTN);
        if (compareBtn) {
          await spotlight(compareBtn, 1000, ctx);
          compareBtn.click();
          await ctx.delay(800);
        }

        // Spotlight the diff modal (Nodes tab active by default)
        await spotlightSel(ctx, WF.VERSION_DIFF_MODAL, 1500);

        // Click through remaining diff tabs: Edges, Variables, Services
        const tabs = document.querySelectorAll<HTMLElement>(WF.VERSION_DIFF_TAB);
        for (let i = 1; i < tabs.length; i++) {
          tabs[i].click();
          await ctx.delay(400);
          await spotlight(tabs[i], 1000, ctx);
        }

        // Close the diff modal
        await ctx.delay(500);
        closeDiffModal();
        await ctx.delay(400);
      },

      verify: WF.VERSION_PANEL,
    },

    // ── Step 3: Restore a Previous Version ──────────────────────────
    {
      id: 'wf7-restore',
      title: 'Restore a Previous Version',
      description:
        'Click **Restore** on the older version ("Initial workflow") to revert the ' +
        'canvas back to the original 3-node layout.\n\n' +
        'The Condition and Log nodes disappear, but the version history still has both ' +
        'entries — nothing is deleted. You can always restore any version again.',
      highlight: WF.VERSION_PANEL,

      preAction: async (ctx) => {
        await ensureSeededWorkflow(ctx);
        closeDiffModal();
        // Ensure version panel is open
        if (!document.querySelector(WF.VERSION_PANEL)) {
          const btn = document.querySelector<HTMLElement>(WF.VERSIONS_BTN);
          if (btn) btn.click();
          await ctx.delay(600);
        }
      },

      action: async (ctx) => {
        // Find the Restore button on the older version (last item = v1)
        const items = document.querySelectorAll<HTMLElement>(WF.VERSION_ITEM);
        const lastItem = items[items.length - 1];
        if (lastItem) {
          // Hover to reveal action buttons
          lastItem.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
          await ctx.delay(400);

          const restoreBtn = lastItem.querySelector<HTMLElement>(WF.VERSION_RESTORE_BTN);
          if (restoreBtn) {
            await spotlight(restoreBtn, 1200, ctx);
            restoreBtn.click();
            await ctx.delay(1000);
          }
        }

        // Close the version panel and fit the restored canvas
        closeVersionPanel();
        await ctx.delay(600);
        fitCanvasCentered();
        await ctx.delay(800);
      },

      verify: WF.CANVAS,
    },

    // ── Step 4: Add, configure, and Apply a Service ─────────────────
    {
      id: 'wf7-services',
      title: 'Add & Apply a Service',
      description:
        '**Purpose:** register a named service so HTTP nodes stop hardcoding host URLs.\n\n' +
        '1. Open **Services** → expand the **Service Registry**\n' +
        '2. **+ Add** → name it **JSONPlaceholder**\n' +
        '3. **Linked Microservice** → **jsonplaceholder** (URLs auto-fill)\n' +
        '4. Auth pill → **Bearer Token** → Save\n' +
        '5. Click **Apply** (bottom-right) — this saves the service to the workflow\n\n' +
        'Watch the **SERVICES** side panel update after Apply. Next step binds nodes to it.',
      highlight: WF.SERVICES_BTN,

      preAction: async (ctx) => {
        await ensureSeededWorkflow(ctx);
        closeVersionPanel();
        await closeWfConfigModalIfOpen(ctx);
        closeServicePanel();

        selectDemoEnvQuiet();

        // Replay: start empty so the viewer watches the service get created.
        patchWorkflowByName(WF_NAME, { services: [] });
        syncLiveWorkflowFromPatch(WF_NAME, { services: [] });
        await ctx.delay(100);
      },

      action: async (ctx) => {
        await openServiceRegistryModal(ctx);

        const svcList = document.querySelector<HTMLElement>('.wf-svc-registry-list');
        if (svcList) await spotlight(svcList, 1200, ctx);

        const addBtn = document.querySelector<HTMLElement>('.wf-svc-add-btn');
        if (addBtn) {
          await spotlight(addBtn, 1000, ctx);
          addBtn.click();
          await ctx.delay(900);
        }

        const nameInput = document.querySelector<HTMLInputElement>('.wf-svc-field-input');
        if (nameInput) {
          await spotlight(nameInput, 900, ctx);
          await ctx.fill('.wf-svc-field-input', 'JSONPlaceholder');
          await ctx.delay(700);
        }

        // Linked Microservice — menu is portaled to body (not inside the wrapper).
        const linkedMsField = document.querySelector<HTMLElement>('.wf-svc-identity-fields .cs-wrapper');
        if (linkedMsField) {
          clearLiveDemoPanelFromTarget(linkedMsField);
          await spotlight(linkedMsField, 900, ctx);
          let linked = false;
          if (seededMsId) {
            await ctx.selectOption('.wf-svc-identity-fields .cs-wrapper', seededMsId);
            await ctx.delay(900);
            linked = (linkedMsField.querySelector('.cs-text')?.textContent ?? '')
              .toLowerCase()
              .includes('jsonplaceholder');
          }
          if (!linked) {
            await pickPortaledSelectByLabel(ctx, linkedMsField, 'jsonplaceholder');
          }
        }

        const linkedNotice = document.querySelector<HTMLElement>('.wf-svc-linked-notice');
        if (linkedNotice) await spotlight(linkedNotice, 1500, ctx);

        const matrixRows = document.querySelectorAll<HTMLElement>('.wf-svc-matrix-entry');
        for (const row of matrixRows) {
          const urlInput = row.querySelector<HTMLInputElement>('.wf-svc-matrix-col-url input');
          if (!urlInput?.value?.includes('jsonplaceholder') && !urlInput?.value?.includes('typicode')) {
            continue;
          }
          await spotlight(row, 1400, ctx);
          const authPill = row.querySelector<HTMLElement>('.wf-svc-auth-pill');
          if (authPill) {
            await spotlight(authPill, 1000, ctx);
            authPill.click();
            await ctx.delay(1000);
          }
          break;
        }

        const authPopup = document.querySelector<HTMLElement>('.wf-svc-auth-popup');
        if (authPopup) {
          clearLiveDemoPanelFromTarget(authPopup);
          await spotlight(authPopup, 800, ctx);
          const authTypeWrap = authPopup.querySelector<HTMLElement>('.wf-svc-auth-popup-type .cs-wrapper')
            ?? authPopup.querySelector<HTMLElement>('.wf-svc-auth-popup-type');
          if (authTypeWrap) {
            // data-value for Bearer is typically "bearer"
            clearLiveDemoPanelFromTarget(authTypeWrap);
            await spotlight(authTypeWrap, 800, ctx);
            await ctx.selectOption('.wf-svc-auth-popup-type .cs-wrapper', 'bearer');
            await ctx.delay(700);
            if (!authPopup.querySelector('.cs-text')?.textContent?.includes('Bearer')) {
              await pickPortaledSelectByLabel(ctx, authTypeWrap, 'Bearer');
            }
          }

          const authRows = authPopup.querySelectorAll<HTMLElement>('.wf-svc-auth-row');
          for (const row of authRows) {
            const label = row.querySelector('.wf-svc-auth-row-label');
            if (!label?.textContent?.includes('Token')) continue;
            const tokenInput = row.querySelector<HTMLInputElement>('.wf-svc-auth-row-ctrl input');
            if (tokenInput) {
              await spotlight(tokenInput, 800, ctx);
              const nativeSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
              if (nativeSet) nativeSet.call(tokenInput, 'my-demo-token-123');
              tokenInput.dispatchEvent(new Event('input', { bubbles: true }));
              tokenInput.dispatchEvent(new Event('change', { bubbles: true }));
              await ctx.delay(800);
            }
            break;
          }

          const saveBtn = authPopup.querySelector<HTMLElement>('.wf-svc-auth-footer-actions .btn-primary');
          if (saveBtn) {
            await spotlight(saveBtn, 900, ctx);
            saveBtn.click();
            await ctx.delay(900);
          }
        }

        // Apply — closes the registry modal and commits the service.
        const applyBtn = Array.from(
          document.querySelectorAll<HTMLElement>('.wf-svc-registry-modal .btn-primary'),
        ).find((b) => b.textContent?.trim() === 'Apply');
        if (applyBtn) {
          await spotlight(applyBtn, 1400, ctx);
          applyBtn.click();
          await ctx.delay(1500);
        }

        // Quiet recovery if Apply was skipped / modal dismissed early.
        await ensureJsonPlaceholderServiceApplied(ctx);

        // Open the side SERVICES panel (not the full registry). Env stays **demo**
        // via quiet bridge — never tour the dropdown (Preparing has no cover).
        selectDemoEnvQuiet();
        if (!document.querySelector(WF.SVC_PANEL)) {
          const svcBtn = document.querySelector<HTMLElement>(WF.SERVICES_BTN);
          if (svcBtn) { svcBtn.click(); await ctx.delay(500); }
        }

        const svcPanel = document.querySelector<HTMLElement>(WF.SVC_PANEL);
        if (svcPanel) await spotlight(svcPanel, 2000, ctx);
      },

      verify: WF.SVC_PANEL,
    },

    // ── Step 5: Bind HTTP nodes to the service ──────────────────────
    {
      id: 'wf7-env-auth',
      title: 'Assign Service to HTTP Nodes',
      description:
        '**Purpose:** bind each HTTP step to the service you just Applied — ' +
        'they inherit base URL + auth instead of a raw absolute URL.\n\n' +
        'For **Create Post**, then **Get Post**:\n' +
        '1. Open the node config\n' +
        '2. **Service** dropdown → **JSONPlaceholder** (watch the menu — Live Demo moves aside)\n' +
        '3. Open **Auth** — Type switches to **Inherit from Service**\n' +
        '4. Confirm **Resolved URL**, then **Save**\n\n' +
        'Both nodes now resolve through the service for the selected environment.',
      highlight: WF.NODE_HTTP,

      preAction: async (ctx) => {
        await ensureSeededWorkflow(ctx);
        closeVersionPanel();
        await closeWfConfigModalIfOpen(ctx);
        selectDemoEnvQuiet();
        // Registry must be closed so node config + dropdowns aren't buried under it.
        if (document.querySelector('.wf-svc-registry-modal')) {
          closeServicePanel();
          await ctx.delay(200);
        }
        await ensureJsonPlaceholderServiceApplied(ctx);
        // Keep the side SERVICES panel open as visual context (not the full modal).
        if (!document.querySelector(WF.SVC_PANEL)) {
          document.querySelector<HTMLElement>(WF.SERVICES_BTN)?.click();
          await ctx.delay(300);
        }
      },

      action: async (ctx) => {
        const svcId = await ensureJsonPlaceholderServiceApplied(ctx);
        clearLiveDemoFromCenterStage();

        const assignServiceToNode = async (nodeId: string, nodeLabel: string) => {
          const canvasNode = canvasNodeByLabel(nodeLabel)
            ?? document.querySelector<HTMLElement>(`.react-flow__node[data-id="${nodeId}"]`);
          if (canvasNode) await spotlight(canvasNode, 1400, ctx);

          openWorkflowNodeConfig(nodeId);
          await ctx.waitFor(WF.NODE_CONFIG, 5000);
          await ctx.delay(1000);
          clearLiveDemoFromCenterStage();

          const modalTitle = document.querySelector<HTMLElement>('#wf-config-modal-title');
          if (modalTitle) await spotlight(modalTitle, 900, ctx);

          const svcSelect = document.querySelector<HTMLElement>('.wf-config-service-select');
          if (svcSelect) {
            // Portaled menu — clear Live Demo first so options aren't covered.
            const picked = await pickPortaledSelectByLabel(ctx, svcSelect, 'JSONPlaceholder');
            if (!picked && svcId) {
              await ctx.selectOption('.wf-config-service-select', svcId);
              await ctx.delay(800);
            }
          }

          // Binding a service auto-sets Auth → Inherit from Service — show that payoff.
          await clickWfConfigTab(ctx, WF.NODE_CONFIG, 'Auth');
          clearLiveDemoFromCenterStage();
          const authType = document.querySelector<HTMLElement>(WF.CFG_HTTP_AUTH_TYPE);
          if (authType) await spotlight(authType, 1800, ctx);
          const inheritHint = document.querySelector<HTMLElement>(WF.CFG_HTTP_AUTH_INHERIT_HINT);
          if (inheritHint) await spotlight(inheritHint, 2000, ctx);

          const resolvedUrl = document.querySelector<HTMLElement>(WF.CFG_HTTP_URL_PREVIEW);
          if (resolvedUrl) await spotlight(resolvedUrl, 1400, ctx);

          await saveAndCloseWfConfigModal(ctx);
          // After Save — re-assert binding + inherit auth if the portaled dropdown failed mid-step.
          const live = getWorkflowByName<{
            nodes?: { id: string; data?: { scenario?: Record<string, unknown> } }[];
          }>(WF_NAME);
          const liveScenario = live?.nodes?.find((n) => n.id === nodeId)?.data?.scenario ?? {};
          patchWorkflowNodeDataById(nodeId, {
            serviceId: svcId,
            scenario: { ...liveScenario, auth: { type: 'inherit' } },
          });
          await ctx.delay(700);
          fitCanvasCentered();
          await ctx.delay(700);
        };

        await assignServiceToNode('http-post', 'Create Post');
        await assignServiceToNode(CAT_HTTP_NODE_ID, 'Get Post');

        // Confirm both nodes still show on canvas; SERVICES panel shows the binding context.
        await spotlightSel(ctx, WF.NODE_HTTP, 1200);
        const svcPanel = document.querySelector<HTMLElement>(WF.SVC_PANEL);
        if (svcPanel) await spotlight(svcPanel, 1600, ctx);
      },

      verify: WF.NODE_HTTP,
    },

    // ── Step 6: Published Catalog Endpoint ─────────────────────────────
    {
      id: 'wf7-catalog-setup',
      title: 'Published Catalog Endpoint',
      description:
        'Now let\'s look at the **Catalog** — the source for Catalog-linked workflow nodes. ' +
        'An imported API spec for **JSONPlaceholder** is already here.\n\n' +
        'The endpoint `GET /posts/{id}` has its Workflow Exposure set to **Published** — ' +
        'this means it\'s available as a node in the Workflow Designer.',

      preAction: async (ctx) => {
        // Keep Workflow visible during Preparing (no blank blue cloak). Publish via
        // data layer first, then one Catalog hop onto the final Published surface.
        closeVersionPanel();
        closeServicePanel();
        await ensureCatalogPublished(ctx);
        ctx.navigateToTab('catalog');
        await waitForSelector(CAT.SIDEBAR, 2000);
        selectCatalogEntryByName(CATALOG_ENTRY_NAME);
        await preparePublishedEndpointSurface(ctx);
      },

      action: async (ctx) => {
        await ctx.delay(600);

        // Surface is already prepared in preAction — only spotlight for the viewer.
        const card = document.querySelector<HTMLElement>(CAT.endpointCard(CATALOG_METHOD, CATALOG_PATH));
        if (card) {
          const cardHeader = card.querySelector<HTMLElement>('.sw-header');
          if (cardHeader) await spotlight(cardHeader, 2000, ctx);

          const exposure = card.querySelector<HTMLElement>(CAT.EXPOSE_TO_WORKFLOW);
          if (exposure) await spotlight(exposure, 2500, ctx);
        }
      },

      verify: CAT.SIDEBAR,
    },

    // ── Step 7: CAT Badge on Workflow Node ────────────────────────────
    {
      id: 'wf7-cat-badge',
      title: 'CAT Badge on Workflow Node',
      description:
        'Back in the Workflow Designer, the **Get Post** HTTP node now shows a green ' +
        '**CAT** source badge. This badge means the node was created from a published ' +
        'Catalog endpoint.\n\n' +
        'The connection is live — the node\'s URL, method, and headers are all derived from ' +
        'the Catalog spec. If the spec is updated and re-imported, the node can be refreshed.',

      preAction: async (ctx) => {
        // Keep Preparing short: data publish + one workflow hop + silent fit.
        closeVersionPanel();
        closeServicePanel();
        await ensureCatalogPublished(ctx);
        applyCatalogRef();
        ctx.navigateToTab('workflow');
        await ctx.delay(80);
        await waitForWorkflowBridge(ctx);
        if ((await ensureLessonWorkflowShown(ctx, WF_NAME)) === 'missing') {
          await seedNamedWorkflow(ctx, WF_NAME, SEED_WORKFLOW as Record<string, unknown>);
          await ctx.delay(150);
        }
        resetWfPaletteToBlocks();
        fitCanvasCentered({ silent: true });
      },

      action: async (ctx) => {
        await ctx.delay(600);

        // 1. Switch palette to CATALOG tab and show the published endpoint
        const catTab = document.querySelector<HTMLElement>('[data-testid="wf-palette-tab-catalog"]');
        if (catTab) {
          await spotlight(catTab, 1000, ctx);
          catTab.click();
          await ctx.delay(800);
        }

        // 2. Expand Published section if collapsed
        const pubSection = document.querySelector<HTMLElement>('[data-testid="wf-palette-pub-section"]');
        if (pubSection) {
          const caret = pubSection.querySelector('.wf-palette-caret');
          if (caret?.textContent?.trim() === '▸') { pubSection.click(); await ctx.delay(400); }
        }

        // 3. Expand the entry group (JSONPlaceholder API)
        const groupHeaders = document.querySelectorAll<HTMLElement>('.wf-palette-group-header');
        for (const gh of groupHeaders) {
          if (gh.textContent?.includes('JSONPlaceholder')) {
            const caret = gh.querySelector('.wf-palette-caret');
            if (caret?.textContent?.trim() === '▸') { gh.click(); await ctx.delay(400); }
            break;
          }
        }

        // 4. Expand "posts" folder if collapsed
        const folderHeaders = document.querySelectorAll<HTMLElement>('.wf-palette-folder-header');
        for (const fh of folderHeaders) {
          if (fh.textContent?.includes('posts')) {
            const caret = fh.querySelector('.wf-palette-caret');
            if (caret?.textContent?.trim() === '▸') { fh.click(); await ctx.delay(400); }
            break;
          }
        }

        // 5. Spotlight "Get a post by ID" palette item
        const items = document.querySelectorAll<HTMLElement>('.wf-palette-item');
        for (const item of items) {
          if (item.title?.includes('/posts/{id}') || item.textContent?.includes('Get a post by ID')) {
            await spotlight(item, 2500, ctx);
            break;
          }
        }

        // 6. Switch back to BLOCKS tab
        const blocksTab = document.querySelector<HTMLElement>('[data-testid="wf-palette-tab-blocks"]');
        if (blocksTab) { blocksTab.click(); await ctx.delay(600); }

        // 7. Spotlight the "Get Post" node and its CAT badge
        const httpNode = document.querySelector<HTMLElement>(`[data-id="${CAT_HTTP_NODE_ID}"]`);
        if (httpNode) {
          const flowNode = httpNode.closest<HTMLElement>('.react-flow__node') ?? httpNode;
          await spotlight(flowNode, 2000, ctx);

          const catBadge = flowNode.querySelector<HTMLElement>('.wf-source-badge:not(.wf-svc-badge)');
          if (catBadge) {
            await spotlight(catBadge, 3000, ctx);
          }
        }
      },

      verify: WF.CANVAS,
    },

    // ── Step 8: Orphan Badge (Unpublish & Re-publish) ────────────────
    {
      id: 'wf7-orphan-badge',
      title: 'Orphan Badge (Unpublish & Re-publish)',
      description:
        'When a Catalog endpoint is **unpublished**, any workflow node linked to it shows ' +
        'an **⚠ orphan badge** as a warning.\n\n' +
        '**Watch this sequence:**\n' +
        '1. We unpublish the endpoint in the Catalog\n' +
        '2. The ⚠ orphan badge appears on the workflow node\n' +
        '3. We re-publish — the orphan badge disappears\n\n' +
        'This helps detect stale references when APIs are removed from the Catalog.',

      preAction: async (ctx) => {
        // Stay on Catalog path — no workflow round-trip / blank cloak.
        closeVersionPanel();
        closeServicePanel();
        await ensureCatalogPublished(ctx);
        applyCatalogRef();
        if (!document.querySelector(CAT.SIDEBAR)) {
          ctx.navigateToTab('catalog');
          await waitForSelector(CAT.SIDEBAR, 2000);
        }
        selectCatalogEntryByName(CATALOG_ENTRY_NAME);
        await preparePublishedEndpointSurface(ctx);
      },

      action: async (ctx) => {
        // ── Part 1: Unpublish the endpoint ──
        // Surface already prepared in preAction — only the visible unpublish tour here.
        await ctx.delay(600);
        const card = document.querySelector<HTMLElement>(CAT.endpointCard(CATALOG_METHOD, CATALOG_PATH));

        // Scroll the exposure control into view so the dropdown is fully visible
        const exposure = card?.querySelector<HTMLElement>(CAT.EXPOSE_TO_WORKFLOW);
        if (exposure) {
          exposure.scrollIntoView({ behavior: 'smooth', block: 'center' });
          await ctx.delay(600);
          await spotlight(exposure, 2500, ctx);

          // Open the dropdown visibly
          const trigger = exposure.querySelector<HTMLButtonElement>('.sw-wf-exposure-trigger');
          if (trigger) {
            trigger.click();
            await ctx.delay(800);
          }

          // Spotlight "Not Exposed" option before clicking
          const noneOpt = document.querySelector<HTMLElement>(CAT.EXPOSE_OPTION_NONE);
          if (noneOpt) {
            await spotlight(noneOpt, 1500, ctx);
            noneOpt.click();
            await ctx.delay(800);
          }

          // Confirm "Remove from Palette Only"
          const paletteOnly = await waitForSelector('.sw-unpublish-btn--palette', 2000);
          if (paletteOnly) {
            await spotlight(paletteOnly, 1200, ctx);
            paletteOnly.click();
            await ctx.delay(1000);
          }
        }

        // ── Part 2: Switch to Workflow — see orphan badge ──
        ctx.navigateToTab('workflow');
        await ctx.delay(1500);
        fitCanvasCentered();
        await ctx.delay(1000);

        // Spotlight the orphan badge — this is the key moment, give plenty of time
        const orphanBadge = await waitForSelector(WF.ORPHAN_BADGE, 3000);
        if (orphanBadge) {
          await spotlight(orphanBadge, 3500, ctx);
        }

        // ── Part 3: Switch back to Catalog and re-publish ──
        ctx.navigateToTab('catalog');
        await ctx.delay(1000);

        // Card should still be expanded from Part 1
        const card2 = document.querySelector<HTMLElement>(CAT.endpointCard(CATALOG_METHOD, CATALOG_PATH));
        if (card2) {
          if (!card2.querySelector('.sw-body')) {
            const header = card2.querySelector<HTMLElement>('.sw-header');
            if (header) { header.click(); await ctx.delay(400); }
          }
          const tryitBtn = card2.querySelector<HTMLButtonElement>(CAT.TRYIT_BTN);
          if (tryitBtn && !tryitBtn.classList.contains('cancel')) {
            tryitBtn.click();
            await ctx.delay(400);
          }

          const exposure2 = card2.querySelector<HTMLElement>(CAT.EXPOSE_TO_WORKFLOW);
          if (exposure2) {
            // Scroll into view so dropdown is fully visible
            exposure2.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await ctx.delay(600);
            await spotlight(exposure2, 2500, ctx);

            // Open the dropdown visibly
            const trigger = exposure2.querySelector<HTMLButtonElement>('.sw-wf-exposure-trigger');
            if (trigger) { trigger.click(); await ctx.delay(800); }

            // Spotlight "Published" option before clicking
            const pubOpt = document.querySelector<HTMLElement>(CAT.EXPOSE_OPTION_PUBLISHED);
            if (pubOpt) {
              await spotlight(pubOpt, 1500, ctx);
              pubOpt.click();
              await ctx.delay(800);
            }

            // Confirm publish modal
            const modal = await waitForSelector(CAT.PUBLISH_MODAL, 1500);
            if (modal) {
              await spotlight(modal, 1200, ctx);
              document.querySelector<HTMLElement>(CAT.PUBLISH_CONFIRM_BTN)?.click();
              await ctx.delay(1000);
            }
          }
        }
        await ctx.delay(1000);

        // ── Part 4: Switch to Workflow — orphan badge gone, CAT badge restored ──
        ctx.navigateToTab('workflow');
        await ctx.delay(1500);
        fitCanvasCentered();
        await ctx.delay(1000);

        // Spotlight the clean node — healthy CAT badge, no orphan warning
        const cleanNode = document.querySelector<HTMLElement>(`[data-id="${CAT_HTTP_NODE_ID}"]`);
        if (cleanNode) {
          const flowNode = cleanNode.closest<HTMLElement>('.react-flow__node') ?? cleanNode;
          const catBadge = flowNode.querySelector<HTMLElement>('.wf-source-badge:not(.wf-svc-badge)');
          if (catBadge) {
            await spotlight(catBadge, 3000, ctx);
          } else {
            await spotlight(flowNode, 3000, ctx);
          }
        }
      },

      verify: WF.CANVAS,
    },
  ],
};
