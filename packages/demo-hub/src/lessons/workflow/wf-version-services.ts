/**
 * WF-7 — Versioning, Services & Catalog Integration
 *
 * 7 steps: browse version history → compare two versions → restore an older
 * version → explore the Service Registry → view published Catalog endpoint →
 * see CAT badge on workflow node → demonstrate orphan badge (unpublish/re-publish).
 *
 * Prerequisite: seeded 5-node workflow with 2 pre-built version snapshots
 * and one HTTP node whose `catalogRef` points to a published Catalog endpoint.
 */
import type { DemoActionContext, DemoLesson } from '../../types';
import { WF, CAT } from '@shared/selectors';
import { showSpotlightRing } from '../../demoRipple';
import {
  collapseWfDemoAppSidebar,
  closeWfConfigModalIfOpen,
  cleanupWorkflowDemoRunUi,
  resetWfPaletteToBlocks,
  ensureLessonWorkflowShown,
} from '../wf-demo-helpers';
import {
  JSONPLACEHOLDER_API_SPEC,
  seedCatalogEntry,
  deleteCatalogEntryByName,
  selectCatalogEntryByName,
  getCatalogEntryByName,
} from '../api/cat-demo-helpers';
import {
  deleteWorkflowByName,
  seedNamedWorkflow,
  waitForWorkflowBridge,
  fitWorkflowCanvasView,
  patchWorkflowNodeDataById,
} from '../../adapters';

// ─── Constants ──────────────────────────────────────────────────────

const WF_NAME = 'Version Demo';
const BASE_URL = 'https://jsonplaceholder.typicode.com';
const SAVE_BTN = '.wf-toolbar-save-wrap button';

const CATALOG_ENTRY_NAME = 'JSONPlaceholder API';
const CATALOG_METHOD = 'GET';
const CATALOG_PATH = '/posts/{id}';
const CAT_HTTP_NODE_ID = 'http-get';

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
    data: { label: 'Has Title?', left: '{{postTitle}}', operator: '!==', right: '' },
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

const SEED_SERVICE = {
  id: 'svc-jsonplaceholder',
  name: 'JSONPlaceholder',
  endpoints: [
    { envId: '__adhoc__', url: BASE_URL, enabled: true, authMode: 'inherit', source: 'manual' },
  ],
  notes: 'Demo service for JSONPlaceholder REST API',
};

const SEED_WORKFLOW = {
  name: WF_NAME,
  nodes: V2_NODES,
  edges: V2_EDGES,
  variables: { userId: '42' },
  services: [SEED_SERVICE],
  versions: [
    makeVersion('v2', 'Added condition branch', 3600_000, V2_NODES, V2_EDGES, { userId: '42' }, [SEED_SERVICE]),
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
  const remove = showSpotlightRing(el);
  activeCleanup = remove;
  return ctx.delay(holdMs).then(() => { remove(); if (activeCleanup === remove) activeCleanup = null; });
}

async function spotlightSel(ctx: DemoActionContext, sel: string, holdMs: number): Promise<void> {
  const el = document.querySelector<HTMLElement>(sel);
  if (el) await spotlight(el, holdMs, ctx);
}

function fitCanvasCentered(): void {
  const btn = document.querySelector<HTMLElement>(WF.FIT_VIEW_BTN);
  if (btn) { btn.click(); return; }
  fitWorkflowCanvasView();
}

function clickSave(): void {
  const btn = document.querySelector<HTMLElement>(SAVE_BTN);
  if (btn) btn.click();
}

function closeVersionPanel(): void {
  const closeBtn = document.querySelector<HTMLElement>(WF.VERSION_CLOSE_BTN);
  if (closeBtn) closeBtn.click();
}

function closeServicePanel(): void {
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
  ctx.navigateToTab('workflow');
  await ctx.delay(200);
  await waitForWorkflowBridge(ctx);

  const state = await ensureLessonWorkflowShown(ctx, WF_NAME);
  if (state !== 'missing') {
    // Only re-fit when we actually SWITCHED to this lesson's workflow from a
    // different one. When it's already shown ('ready'), the canvas is exactly where
    // the previous step left it — re-fitting every step causes visible jumping.
    if (state === 'selected') {
      fitCanvasCentered();
      await ctx.delay(400);
    }
    return;
  }

  await seedNamedWorkflow(ctx, WF_NAME, SEED_WORKFLOW as Record<string, unknown>);
  await ctx.delay(600);
  fitCanvasCentered();
  await ctx.delay(400);
}

/**
 * Ensure the catalog entry exists and is published, so the HTTP node's CAT badge shows
 * and orphan detection works.
 */
/**
 * Ensure catalog entry exists and endpoint is Published.
 * Navigates to Catalog tab and stays there — caller navigates back if needed.
 */
async function ensureCatalogPublished(ctx: DemoActionContext): Promise<void> {
  ctx.navigateToTab('catalog');
  await ctx.delay(600);
  try { await ctx.waitFor(CAT.SIDEBAR, 3000); } catch { /* */ }

  if (!document.querySelector(CAT.entryByName(CATALOG_ENTRY_NAME))) {
    await seedCatalogEntry(CATALOG_ENTRY_NAME, JSONPLACEHOLDER_API_SPEC);
    await ctx.delay(800);
  }

  selectCatalogEntryByName(CATALOG_ENTRY_NAME);
  await ctx.delay(400);

  const card = await waitForSelector(CAT.endpointCard(CATALOG_METHOD, CATALOG_PATH), 3000);
  if (card) {
    if (!card.querySelector('.sw-body')) {
      const header = card.querySelector<HTMLElement>('.sw-header');
      if (header) { header.click(); await ctx.delay(200); }
    }
    const tryitBtn = card.querySelector<HTMLButtonElement>(CAT.TRYIT_BTN);
    if (tryitBtn && !tryitBtn.classList.contains('cancel')) {
      tryitBtn.click();
      await ctx.delay(200);
    }

    const exposure = card.querySelector<HTMLElement>(CAT.EXPOSE_TO_WORKFLOW);
    if (exposure) {
      const label = exposure.querySelector('.sw-wf-exposure-label')?.textContent?.trim();
      if (label !== 'Published') {
        const trigger = exposure.querySelector<HTMLButtonElement>('.sw-wf-exposure-trigger');
        if (trigger) { trigger.click(); await ctx.delay(120); }
        document.querySelector<HTMLButtonElement>(CAT.EXPOSE_OPTION_PUBLISHED)?.click();
        await ctx.delay(150);
        const modal = await waitForSelector(CAT.PUBLISH_MODAL, 1500);
        if (modal) {
          document.querySelector<HTMLElement>(CAT.PUBLISH_CONFIRM_BTN)?.click();
          await ctx.delay(200);
        }
      }
    }
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

/**
 * Unpublish the endpoint from the catalog (palette only — keeps nodes).
 * Must be called while on the Catalog tab with the entry selected.
 */
async function unpublishEndpointQuiet(ctx: DemoActionContext): Promise<void> {
  const card = document.querySelector<HTMLElement>(CAT.endpointCard(CATALOG_METHOD, CATALOG_PATH));
  const exposure = card?.querySelector<HTMLElement>(CAT.EXPOSE_TO_WORKFLOW);
  if (!exposure) return;

  const label = exposure.querySelector('.sw-wf-exposure-label')?.textContent?.trim();
  if (label === 'Not Exposed') return;

  const trigger = exposure.querySelector<HTMLButtonElement>('.sw-wf-exposure-trigger');
  if (trigger) { trigger.click(); await ctx.delay(120); }
  document.querySelector<HTMLButtonElement>(CAT.EXPOSE_OPTION_NONE)?.click();
  await ctx.delay(200);

  // Click "Remove from Palette Only" (not destructive)
  const paletteOnly = await waitForSelector('.sw-unpublish-btn--palette', 2000);
  if (paletteOnly) { paletteOnly.click(); await ctx.delay(200); }
}

// ─── Lesson ─────────────────────────────────────────────────────────

export const wfVersionServicesLesson: DemoLesson = {
  id: 'wf-version-services',
  domainId: 'workflow',
  category: 'tooling',
  name: 'Versioning, Services & Catalog Integration',
  description:
    'Track workflow changes with version snapshots, compare diffs, restore, and understand how workflow nodes relate to Catalog endpoints.',
  estimatedMinutes: 7,
  initialTab: 'workflow',
  allowedTabs: ['workflow', 'catalog'],

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
    ctx.navigateToTab('workflow');
    await ctx.delay(200);
    resetWfPaletteToBlocks();
    await waitForWorkflowBridge(ctx);
    deleteWorkflowByName(WF_NAME);
    await ctx.delay(300);
    await seedNamedWorkflow(ctx, WF_NAME, SEED_WORKFLOW as Record<string, unknown>);
    await ctx.delay(600);
    fitCanvasCentered();
    await ctx.delay(400);
    await collapseWfDemoAppSidebar(ctx);

    // Seed catalog entry via bridge only (no tab navigation — stays on workflow)
    try {
      if (!getCatalogEntryByName(CATALOG_ENTRY_NAME)) {
        await seedCatalogEntry(CATALOG_ENTRY_NAME, JSONPLACEHOLDER_API_SPEC);
        await ctx.delay(400);
      }
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

        // Close the version panel and spotlight the restored canvas
        closeVersionPanel();
        await ctx.delay(600);
        fitCanvasCentered();
        await ctx.delay(600);
        await spotlightSel(ctx, WF.CANVAS, 1500);

        // Save so the restoration is persisted
        clickSave();
        await ctx.delay(400);
      },

      verify: WF.CANVAS,
    },

    // ── Step 4: Service Registry ────────────────────────────────────
    {
      id: 'wf7-services',
      title: 'Service Registry',
      description:
        'Click **Services** in the toolbar to open the Service Registry. ' +
        'A service defines a **named API** with per-environment base URLs and auth.\n\n' +
        'Here "JSONPlaceholder" is configured with:\n' +
        '- **URL**: `https://jsonplaceholder.typicode.com`\n' +
        '- **Auth**: none (public API)\n\n' +
        'HTTP nodes can **bind** to this service instead of hardcoding URLs — when you switch ' +
        'environments, all bound nodes automatically resolve to the correct base URL.',
      highlight: WF.SERVICES_BTN,

      preAction: async (ctx) => {
        await ensureSeededWorkflow(ctx);
        closeVersionPanel();
        closeServicePanel();
        // Close the full Service Registry modal if it was left open
        const cancelBtn = document.querySelector<HTMLElement>('.wf-config-modal .wf-config-modal-footer .btn:not(.btn-primary)');
        if (cancelBtn) { cancelBtn.click(); await ctx.delay(200); }
      },

      action: async (ctx) => {
        // 1. Spotlight and click the Services button to open inline panel
        await spotlightSel(ctx, WF.SERVICES_BTN, 1000);
        const svcBtn = document.querySelector<HTMLElement>(WF.SERVICES_BTN);
        if (svcBtn) svcBtn.click();
        await ctx.delay(800);

        // 2. Spotlight the inline panel showing the service row
        const svcRow = document.querySelector<HTMLElement>('.wf-svc-inline-row');
        if (svcRow) {
          await spotlight(svcRow, 1200, ctx);
        }

        // 3. Click the expand button to open the full Service Registry Modal
        const expandBtn = document.querySelector<HTMLElement>('.wf-services-panel button[title="Expand to full screen"]');
        if (expandBtn) {
          expandBtn.click();
          await ctx.delay(1000);
        }

        // 4. Spotlight the service name in the full modal
        const nameInput = document.querySelector<HTMLElement>('.wf-svc-top-fields input[type="text"]');
        if (nameInput) {
          await spotlight(nameInput, 1200, ctx);
        }

        // 5. Spotlight the endpoint matrix — URLs per environment
        const matrix = document.querySelector<HTMLElement>('.wf-svc-endpoint-matrix');
        if (matrix) {
          await spotlight(matrix, 1500, ctx);
        }

        // 6. Spotlight a specific URL row (adhoc row with the actual URL)
        const urlInputs = document.querySelectorAll<HTMLElement>('.wf-svc-matrix-entry input[type="text"]');
        for (const urlInput of urlInputs) {
          if ((urlInput as HTMLInputElement).value.includes('jsonplaceholder')) {
            await spotlight(urlInput, 1200, ctx);
            break;
          }
        }

        // 7. Spotlight the Auth column header briefly
        const authCol = document.querySelector<HTMLElement>('.wf-svc-matrix-col-auth');
        if (authCol) {
          await spotlight(authCol, 800, ctx);
        }

        // Close the modal (Cancel button)
        const cancelBtn = document.querySelector<HTMLElement>('.wf-config-modal .wf-config-modal-footer .btn:not(.btn-primary)');
        if (cancelBtn) {
          cancelBtn.click();
          await ctx.delay(500);
        }

        // Close the inline panel too
        closeServicePanel();
        await ctx.delay(400);
      },

      verify: WF.CANVAS,
    },

    // ── Step 5: Published Catalog Endpoint ─────────────────────────────
    {
      id: 'wf7-catalog-setup',
      title: 'Published Catalog Endpoint',
      description:
        'Before understanding the Catalog → Workflow connection, let\'s look at the source. ' +
        'Navigate to the **Catalog** tab — you\'ll see an imported API spec for **JSONPlaceholder**.\n\n' +
        'The endpoint `GET /posts/{id}` has its Workflow Exposure set to **Published** — ' +
        'this means it\'s available as a node in the Workflow Designer.',
      highlight: CAT.SIDEBAR,

      preAction: async (ctx) => {
        await ensureSeededWorkflow(ctx);
        closeVersionPanel();
        closeServicePanel();
        await ensureCatalogPublished(ctx);
        // Stay on Catalog — action starts there
      },

      action: async (ctx) => {
        // Already on Catalog from preAction
        ctx.navigateToTab('catalog');
        await ctx.delay(800);
        try { await ctx.waitFor(CAT.SIDEBAR, 3000); } catch { /* */ }

        // Select the JSONPlaceholder entry
        selectCatalogEntryByName(CATALOG_ENTRY_NAME);
        await ctx.delay(800);

        // Spotlight the sidebar entry
        const sidebarEntry = document.querySelector<HTMLElement>(CAT.entryByName(CATALOG_ENTRY_NAME));
        if (sidebarEntry) await spotlight(sidebarEntry, 1200, ctx);

        // Find and expand the endpoint card
        const card = await waitForSelector(CAT.endpointCard(CATALOG_METHOD, CATALOG_PATH), 3000);
        if (card) {
          if (!card.querySelector('.sw-body')) {
            const header = card.querySelector<HTMLElement>('.sw-header');
            if (header) { header.click(); await ctx.delay(300); }
          }
          // Spotlight the endpoint card header (GET /posts/{id})
          const cardHeader = card.querySelector<HTMLElement>('.sw-header');
          if (cardHeader) await spotlight(cardHeader, 1200, ctx);

          // Open Try It Out
          const tryitBtn = card.querySelector<HTMLButtonElement>(CAT.TRYIT_BTN);
          if (tryitBtn && !tryitBtn.classList.contains('cancel')) {
            tryitBtn.click();
            await ctx.delay(400);
          }

          // Spotlight the Workflow Exposure dropdown showing "Published"
          const exposure = card.querySelector<HTMLElement>(CAT.EXPOSE_TO_WORKFLOW);
          if (exposure) {
            await spotlight(exposure, 1500, ctx);
          }
        }
      },

      verify: CAT.SIDEBAR,
    },

    // ── Step 6: CAT Badge on Workflow Node ────────────────────────────
    {
      id: 'wf7-cat-badge',
      title: 'CAT Badge on Workflow Node',
      description:
        'Back in the **Workflow Designer**, the **Get Post** HTTP node shows a green ' +
        '**CAT** source badge. This badge means the node was created from a published ' +
        'Catalog endpoint.\n\n' +
        'The connection is live — the node\'s URL, method, and headers are all derived from ' +
        'the Catalog spec. If the spec is updated and re-imported, the node can be refreshed.',
      highlight: WF.NODE_HTTP,

      preAction: async (ctx) => {
        await ensureSeededWorkflow(ctx);
        closeVersionPanel();
        closeServicePanel();
        await ensureCatalogPublished(ctx);
        applyCatalogRef();
        await ctx.delay(200);
        ctx.navigateToTab('workflow');
        await ctx.delay(300);
        fitCanvasCentered();
      },

      action: async (ctx) => {
        ctx.navigateToTab('workflow');
        await ctx.delay(600);
        fitCanvasCentered();
        await ctx.delay(800);

        // Spotlight the HTTP node
        const httpNode = document.querySelector<HTMLElement>(`[data-id="${CAT_HTTP_NODE_ID}"]`);
        if (httpNode) {
          const flowNode = httpNode.closest<HTMLElement>('.react-flow__node') ?? httpNode;
          await spotlight(flowNode, 1200, ctx);

          // Spotlight the CAT badge specifically
          const catBadge = flowNode.querySelector<HTMLElement>('.wf-source-badge');
          if (catBadge) {
            await spotlight(catBadge, 2000, ctx);
          }
        }
      },

      verify: WF.NODE_HTTP,
    },

    // ── Step 7: Orphan Badge (Unpublish & Re-publish) ────────────────
    {
      id: 'wf7-orphan-badge',
      title: 'Orphan Badge (Unpublish & Re-publish)',
      description:
        'What happens when the source endpoint is **unpublished** from the Catalog? ' +
        'The node still works — but an **⚠ orphan badge** appears warning that ' +
        'the Catalog link is broken.\n\n' +
        'Watch: we\'ll unpublish the endpoint, then return to the Workflow to see the warning. ' +
        'Re-publishing removes the warning and restores the live connection.',
      highlight: WF.NODE_HTTP,

      preAction: async (ctx) => {
        await ensureSeededWorkflow(ctx);
        closeVersionPanel();
        closeServicePanel();
        await ensureCatalogPublished(ctx);
        applyCatalogRef();
        await ctx.delay(200);
        ctx.navigateToTab('workflow');
        await ctx.delay(300);
        fitCanvasCentered();
      },

      action: async (ctx) => {
        // Navigate to Catalog → unpublish
        ctx.navigateToTab('catalog');
        await ctx.delay(800);
        try { await ctx.waitFor(CAT.SIDEBAR, 3000); } catch { /* */ }
        selectCatalogEntryByName(CATALOG_ENTRY_NAME);
        await ctx.delay(600);

        // Open the endpoint card
        const card = await waitForSelector(CAT.endpointCard(CATALOG_METHOD, CATALOG_PATH), 3000);
        if (card) {
          if (!card.querySelector('.sw-body')) {
            const header = card.querySelector<HTMLElement>('.sw-header');
            if (header) { header.click(); await ctx.delay(200); }
          }
          const tryitBtn = card.querySelector<HTMLButtonElement>(CAT.TRYIT_BTN);
          if (tryitBtn && !tryitBtn.classList.contains('cancel')) {
            tryitBtn.click();
            await ctx.delay(200);
          }
        }

        // Spotlight the exposure dropdown before unpublishing
        const exposure = card?.querySelector<HTMLElement>(CAT.EXPOSE_TO_WORKFLOW);
        if (exposure) await spotlight(exposure, 1000, ctx);

        // Unpublish
        await unpublishEndpointQuiet(ctx);
        await ctx.delay(500);

        // Return to Workflow Designer → spotlight orphan badge
        ctx.navigateToTab('workflow');
        await ctx.delay(800);
        fitCanvasCentered();
        await ctx.delay(800);

        const orphanBadge = await waitForSelector(WF.ORPHAN_BADGE, 3000);
        if (orphanBadge) {
          await spotlight(orphanBadge, 2000, ctx);
        }

        // Navigate back to Catalog → re-publish
        ctx.navigateToTab('catalog');
        await ctx.delay(800);
        selectCatalogEntryByName(CATALOG_ENTRY_NAME);
        await ctx.delay(400);

        const card2 = await waitForSelector(CAT.endpointCard(CATALOG_METHOD, CATALOG_PATH), 3000);
        if (card2) {
          if (!card2.querySelector('.sw-body')) {
            const header = card2.querySelector<HTMLElement>('.sw-header');
            if (header) { header.click(); await ctx.delay(200); }
          }
          const tryitBtn = card2.querySelector<HTMLButtonElement>(CAT.TRYIT_BTN);
          if (tryitBtn && !tryitBtn.classList.contains('cancel')) {
            tryitBtn.click();
            await ctx.delay(200);
          }

          // Re-publish
          const exposure2 = card2.querySelector<HTMLElement>(CAT.EXPOSE_TO_WORKFLOW);
          if (exposure2) {
            const trigger = exposure2.querySelector<HTMLButtonElement>('.sw-wf-exposure-trigger');
            if (trigger) { trigger.click(); await ctx.delay(120); }
            document.querySelector<HTMLButtonElement>(CAT.EXPOSE_OPTION_PUBLISHED)?.click();
            await ctx.delay(150);
            const modal = await waitForSelector(CAT.PUBLISH_MODAL, 1500);
            if (modal) {
              document.querySelector<HTMLElement>(CAT.PUBLISH_CONFIRM_BTN)?.click();
              await ctx.delay(200);
            }
          }
        }

        // Return to Workflow Designer → spotlight badge gone
        ctx.navigateToTab('workflow');
        await ctx.delay(800);
        fitCanvasCentered();
        await ctx.delay(800);

        // The orphan badge should be gone now — spotlight the clean node
        const cleanNode = document.querySelector<HTMLElement>(`[data-id="${CAT_HTTP_NODE_ID}"]`);
        if (cleanNode) {
          const flowNode = cleanNode.closest<HTMLElement>('.react-flow__node') ?? cleanNode;
          await spotlight(flowNode, 1200, ctx);
        }
      },

      verify: WF.NODE_HTTP,
    },
  ],
};
