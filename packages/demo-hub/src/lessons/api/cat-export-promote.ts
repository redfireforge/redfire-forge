/**
 * CAT-3 — Export to Requests
 *
 * 7 steps: export one endpoint from the Try It Out bar → configure the export
 * modal (sample toggle, preview tree, environments, target group) → tour the
 * bulk Export tab with version badges → see coverage badges on exported
 * endpoints → click Send to Harness and walk through the full modal (target
 * cascade + options) → expose to Workflow in Preview mode → expose to Workflow
 * in Published mode (navigates to Workflow Designer palette).
 *
 * This lesson bridges Catalog → Requests → Harness/Workflow — showing the full
 * promotion pipeline from API spec to automated testing.
 */
import type { DemoLesson, DemoActionContext } from '../../types';
import { CAT, REQ } from '@shared/selectors';
import {
  JSONPLACEHOLDER_API_SPEC,
  seedCatalogEntry,
  deleteCatalogEntryByName,
  deleteCollectionsByName,
  selectCatalogEntryByName,
  ensureCatalogTab,
  ensureEndpointsView,
  ensureCardTryItOpen,
  collapseAllCards,
  closeExportModalIfOpen,
  spotlightEl,
  waitForSelector,
} from './cat-demo-helpers';
import { fillControlledInput } from '../setup-helpers';
import {
  cleanupOtherRequestDemoCollections,
  shrinkAllCollections,
  ensureCollectionExpanded,
} from './req-demo-helpers';
import {
  ensureSettingsEnvironment,
  ensureSettingsMicroservice,
  getDemoBridgeWindow,
  deselectAllWorkflowNodes,
  expandAppSidebar,
  insertWorkflow,
  deleteWorkflowByName,
} from '../../adapters';
import { collapseWfDemoAppSidebar } from '../wf-demo-helpers';

// ─── Constants ──────────────────────────────────────────────────

const DEMO_ENTRY_NAME = 'JSONPlaceholder API';
const DEMO_ENTRY_NAME_VERSIONED = 'JSONPlaceholder API (1.0.0)';
const CAT3_ENV_NAME = 'demo';
const CAT3_SVC_NAME = 'jsonplaceholder';
const CAT3_SVC_BASE = 'https://jsonplaceholder.typicode.com';
const CAT3_FG_NAME = 'Catalog Export Tests';
const CAT3_SCENARIO_NAME = 'Post Operations';
const CAT3_TEMP_WF_NAME = '_demo_cat3_temp_workflow';

function ensureHarnessTargets(): void {
  const envId = ensureSettingsEnvironment(CAT3_ENV_NAME);
  if (envId) ensureSettingsMicroservice(CAT3_SVC_NAME, { [envId]: CAT3_SVC_BASE });
}

function cleanupDemoFeatureGroups(): void {
  getDemoBridgeWindow().__demoDeleteFeatureGroupsByName?.(CAT3_FG_NAME);
}

async function closeHarnessModalIfOpen(ctx: DemoActionContext): Promise<void> {
  const modal = document.querySelector(REQ.HARNESS_MODAL);
  if (!modal) return;
  const cancel = document.querySelector<HTMLElement>(REQ.HARNESS_CANCEL_BTN)
    ?? document.querySelector<HTMLElement>('.send-harness-cancel-btn');
  cancel?.click();
  await ctx.delay(250);
}

async function selectCascadeByName(
  ctx: DemoActionContext, fieldSel: string, matchName: string, holdMs = 1000,
): Promise<void> {
  const field = document.querySelector<HTMLElement>(fieldSel);
  if (!field) return;
  await spotlightEl(ctx, field, holdMs);
  const trigger = field.querySelector<HTMLButtonElement>('.cascade-dropdown-trigger');
  if (!trigger) return;
  trigger.click();
  await ctx.delay(450);
  const items = Array.from(field.querySelectorAll<HTMLButtonElement>('.cascade-dropdown-item:not(.cascade-dropdown-create)'));
  const match = items.find((i) => {
    const name = i.querySelector('.cascade-dropdown-item-name')?.textContent?.trim().toLowerCase();
    return name === matchName.toLowerCase();
  }) ?? items[0];
  if (match) {
    match.scrollIntoView({ block: 'nearest' });
    await spotlightEl(ctx, match, 900);
    match.click();
    await ctx.delay(550);
  }
}

async function createCascadeItem(
  ctx: DemoActionContext, fieldSel: string, newName: string, holdMs = 1000,
): Promise<void> {
  const field = document.querySelector<HTMLElement>(fieldSel);
  if (!field) return;
  await spotlightEl(ctx, field, holdMs);
  let input = field.querySelector<HTMLInputElement>('input');
  if (!input) {
    const trigger = field.querySelector<HTMLButtonElement>('.cascade-dropdown-trigger');
    if (trigger) { trigger.click(); await ctx.delay(400); }
    const createBtn = field.querySelector<HTMLButtonElement>('.cascade-dropdown-create');
    if (createBtn) { await spotlightEl(ctx, createBtn, 800); createBtn.click(); await ctx.delay(400); }
    input = field.querySelector<HTMLInputElement>('input');
  }
  if (input) {
    await spotlightEl(ctx, input, 700);
    fillControlledInput(input, newName);
    input.blur();
    await ctx.delay(500);
  }
  await spotlightEl(ctx, field, 900);
}

// ─── Helpers ────────────────────────────────────────────────────

/** Ensure the demo entry exists in the sidebar. Seeds it if missing. */
async function ensureDemoEntry(): Promise<void> {
  try { await waitForSelector(CAT.SIDEBAR, 3000); } catch { /* sidebar not mounted yet */ }
  if (document.querySelector(CAT.entryByName(DEMO_ENTRY_NAME))) return;
  await seedCatalogEntry(DEMO_ENTRY_NAME, JSONPLACEHOLDER_API_SPEC);
  await waitForSelector(CAT.entryByName(DEMO_ENTRY_NAME), 4000);
}

/** Ensure the demo entry is selected. */
async function ensureDemoEntrySelected(): Promise<void> {
  await ensureDemoEntry();
  selectCatalogEntryByName(DEMO_ENTRY_NAME);
  await new Promise(r => setTimeout(r, 150));
}

/**
 * Quietly force the POST /posts exposure to a specific mode (no spotlight),
 * so each run of steps 6/7 shows a real, visible transition in `action`.
 * Exposure persists across replays, so without this the menu selection would
 * look like a no-op on the second run.
 */
async function setExposureQuiet(
  ctx: DemoActionContext,
  mode: 'preview' | 'published' | 'none',
): Promise<void> {
  const card = document.querySelector<HTMLElement>(CAT.endpointCard('POST', '/posts'));
  const exposure = card?.querySelector<HTMLElement>(CAT.EXPOSE_TO_WORKFLOW);
  if (!exposure) return;
  const want = mode === 'none' ? 'Not Exposed' : mode === 'preview' ? 'Preview' : 'Published';
  const label = exposure.querySelector('.sw-wf-exposure-label')?.textContent?.trim();
  if (label === want) return;

  const trigger = exposure.querySelector<HTMLButtonElement>('.sw-wf-exposure-trigger');
  trigger?.click();
  await ctx.delay(250);
  const sel = mode === 'none'
    ? CAT.EXPOSE_OPTION_NONE
    : mode === 'preview' ? CAT.EXPOSE_OPTION_PREVIEW : CAT.EXPOSE_OPTION_PUBLISHED;
  document.querySelector<HTMLButtonElement>(sel)?.click();
  await ctx.delay(250);
  // Dismiss the un-publish confirmation if it appears (endpoint not wired into a
  // workflow in the demo, so this is normally a no-op).
  const paletteOnly = document.querySelector<HTMLButtonElement>('.sw-unpublish-btn--palette');
  paletteOnly?.click();
  await ctx.delay(150);
}

/** Open the Workflow Exposure dropdown and select Preview or Published. */
async function selectWorkflowExposure(
  ctx: DemoActionContext,
  mode: 'preview' | 'published',
): Promise<boolean> {
  const cardSel = CAT.endpointCard('POST', '/posts');
  let postCard = document.querySelector<HTMLElement>(cardSel);
  if (!postCard) return false;
  postCard.scrollIntoView({ block: 'center' });
  await ctx.delay(400);

  // Expand card if collapsed (the preAction should have done this, but
  // header.click() can miss React state updates in some timing scenarios).
  if (!postCard.querySelector('.sw-body')) {
    await ctx.click(`${cardSel} .sw-header`);
    await ctx.delay(600);
    postCard = document.querySelector<HTMLElement>(cardSel);
    if (!postCard?.querySelector('.sw-body')) return false;
  }

  // Open Try It Out if not active — the exposure dropdown lives in the execute bar
  const tryitBtn = postCard.querySelector<HTMLButtonElement>(CAT.TRYIT_BTN);
  if (tryitBtn && !tryitBtn.classList.contains('cancel')) {
    await ctx.click(`${cardSel} ${CAT.TRYIT_BTN}`);
    await ctx.delay(600);
  }

  const execBar = postCard.querySelector<HTMLElement>('.sw-exec-bar');
  if (execBar) {
    execBar.scrollIntoView({ block: 'center' });
    await ctx.delay(400);
  }

  let exposureEl = postCard.querySelector<HTMLElement>(CAT.EXPOSE_TO_WORKFLOW);
  if (!exposureEl) {
    try {
      exposureEl = await waitForSelector(`${cardSel} ${CAT.EXPOSE_TO_WORKFLOW}`, 3000);
    } catch {
      return false;
    }
  }
  await spotlightEl(ctx, exposureEl, 1000);

  // Always open the menu and make a visible selection — even if the endpoint
  // is already on this mode (exposure persists across replays, so skipping the
  // menu here would make the step look like it does nothing on a second run).
  const trigger = exposureEl.querySelector<HTMLButtonElement>('.sw-wf-exposure-trigger');
  if (!trigger) return false;
  trigger.click();
  await ctx.delay(700);

  const optionSel = mode === 'preview' ? CAT.EXPOSE_OPTION_PREVIEW : CAT.EXPOSE_OPTION_PUBLISHED;
  let option = exposureEl.querySelector<HTMLButtonElement>(optionSel);
  if (!option) {
    try {
      option = await waitForSelector(optionSel, 2000) as HTMLButtonElement;
    } catch {
      return false;
    }
  }

  const menu = exposureEl.querySelector<HTMLElement>('.sw-wf-exposure-menu');
  if (menu) await spotlightEl(ctx, menu, 900);

  await spotlightEl(ctx, option, 1100);
  option.click();
  await ctx.delay(500);

  // Wait for React to commit the new exposure mode onto the trigger label
  const expected = mode === 'preview' ? 'Preview' : 'Published';
  const deadline = Date.now() + 2500;
  while (Date.now() < deadline) {
    const nextLabel = exposureEl.querySelector('.sw-wf-exposure-label')?.textContent?.trim();
    if (nextLabel === expected) break;
    await ctx.delay(100);
  }

  await spotlightEl(ctx, exposureEl, 1200);
  return exposureEl.querySelector('.sw-wf-exposure-label')?.textContent?.trim() === expected;
}

/** Navigate to Workflow Designer → Catalog palette and spotlight POST /posts. */
async function showExposedEndpointInWorkflowPalette(ctx: DemoActionContext): Promise<void> {
  ctx.navigateToTab('workflow');
  await ctx.delay(800);

  // The palette only renders when a workflow is open. Create a temp workflow
  // if none exists so the Catalog tab with the exposed endpoint is visible.
  if (!document.querySelector('.wf-palette')) {
    insertWorkflow({ name: CAT3_TEMP_WF_NAME });
    await ctx.delay(1200);
  }

  await collapseWfDemoAppSidebar(ctx);
  deselectAllWorkflowNodes();
  await ctx.delay(300);

  const paletteTabs = document.querySelectorAll<HTMLButtonElement>('.wf-palette-tab');
  for (const tab of paletteTabs) {
    if (tab.textContent?.trim() === 'Catalog') {
      await spotlightEl(ctx, tab, 900);
      tab.click();
      await ctx.delay(800);
      break;
    }
  }

  const groupHeaders = document.querySelectorAll<HTMLButtonElement>('.wf-palette-group-header');
  for (const gh of groupHeaders) {
    if (!gh.textContent?.includes(DEMO_ENTRY_NAME)) continue;
    gh.scrollIntoView({ block: 'center' });
    await spotlightEl(ctx, gh, 1000);
    const parent = gh.closest('.wf-palette-group');
    if (parent && !parent.querySelector('.wf-palette-children')) {
      gh.click();
      await ctx.delay(600);
    }
    break;
  }

  const folderHeaders = document.querySelectorAll<HTMLButtonElement>('.wf-palette-folder-header');
  for (const fh of folderHeaders) {
    if (!fh.textContent?.includes('posts')) continue;
    fh.scrollIntoView({ block: 'nearest' });
    const folder = fh.closest('.wf-palette-folder');
    const items = folder?.querySelectorAll('.wf-palette-item');
    if (!items || items.length === 0) {
      fh.click();
      await ctx.delay(600);
    }
    break;
  }

  // Keep focus on the palette item — never leave a canvas node selected
  deselectAllWorkflowNodes();
  await ctx.delay(200);

  const byTitle = document.querySelector<HTMLElement>(
    '.wf-palette-item[title="POST /posts"], .wf-palette-item[title="post /posts"]',
  );
  if (byTitle) {
    byTitle.scrollIntoView({ block: 'center' });
    await spotlightEl(ctx, byTitle, 2000);
    return;
  }

  const paletteItems = document.querySelectorAll<HTMLElement>('.wf-palette-item');
  for (const item of paletteItems) {
    const text = item.textContent ?? '';
    if (text.includes('Create a post') || /POST\s*\/posts/i.test(text)) {
      item.scrollIntoView({ block: 'center' });
      await spotlightEl(ctx, item, 2000);
      break;
    }
  }
}

// ─── Lesson ─────────────────────────────────────────────────────

export const catExportPromoteLesson: DemoLesson = {
  id: 'cat-export-requests',
  domainId: 'api',
  category: 'catalog',
  name: 'Export to Requests',
  description:
    'Move API definitions from the Catalog into the Requests workspace — single endpoint export, ' +
    'bulk export with environments, coverage tracking, and integration with Harness and Workflow.',
  estimatedMinutes: 7,
  initialTab: 'catalog',
  allowedTabs: ['catalog', 'requests', 'scenarios', 'workflow', 'environments'],

  concept: {
    title: 'From API Spec to Request Collection',
    body:
      'The Catalog isn\'t just for browsing — it\'s the **starting point** for building ' +
      'request collections. Every endpoint can be exported to Requests with a single click.\n\n' +
      '**Export to Requests** creates a multi-environment collection:\n' +
      '- Each selected endpoint becomes a request, pre-configured with method, path, and parameters\n' +
      '- Each selected environment gets its own base URL variant\n' +
      '- **Coverage badges** ("IN REQUESTS") appear on endpoint cards so you always know what\'s covered\n\n' +
      '**What you learn in this lesson:**\n' +
      '- How to export a single endpoint from the **Try It Out** execute bar\n' +
      '- How to configure the export modal: collection name, target group, environments, sample toggles, preview tree\n' +
      '- How the bulk **Export tab** provides full-table export with version-aware deduplication\n' +
      '- How **coverage badges** track what\'s already exported\n' +
      '- How **Send to Harness** promotes directly to automated testing\n' +
      '- How **Expose to Workflow** makes endpoints available in the Workflow Designer',
    keyTerms: [
      { term: 'Export to Requests', definition: 'Creates request entries in a collection from catalog endpoints — method, path, params, and base URL pre-configured' },
      { term: 'Coverage Badge', definition: '"IN REQUESTS" badge on endpoint cards showing which endpoints are already exported — click to see the collection path' },
      { term: 'Version Tracking', definition: 'The export panel marks endpoints as "NEW" or "from v1" to avoid duplicate exports when a spec is updated' },
      { term: 'Send to Harness', definition: 'Promotes the endpoint directly to the Test Harness as a test scenario — skipping the Requests collection step' },
      { term: 'Expose to Workflow', definition: 'Makes the endpoint (with current values) available as a node in the Workflow Designer palette' },
    ],
    diagram: `<svg viewBox="0 0 460 90" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="25" width="100" height="40" rx="6" fill="#1e293b" stroke="#3b82f6" stroke-width="1.5"/>
      <text x="55" y="44" text-anchor="middle" fill="#f1f5f9" font-size="9">Catalog Endpoint</text>
      <text x="55" y="57" text-anchor="middle" fill="#94a3b8" font-size="7">POST /posts</text>
      <path d="M110 35 L155 25" stroke="#f59e0b" stroke-width="1.2" marker-end="url(#cat3arr)"/>
      <path d="M110 45 L155 45" stroke="#f59e0b" stroke-width="1.5" marker-end="url(#cat3arr)"/>
      <path d="M110 55 L155 65" stroke="#10b981" stroke-width="1.2" marker-end="url(#cat3arr)"/>
      <rect x="160" y="10" width="90" height="25" rx="5" fill="#1e293b" stroke="#f59e0b" stroke-width="1.2"/>
      <text x="205" y="27" text-anchor="middle" fill="#f1f5f9" font-size="8">Requests</text>
      <rect x="160" y="38" width="90" height="25" rx="5" fill="#1e293b" stroke="#f59e0b" stroke-width="1.5"/>
      <text x="205" y="55" text-anchor="middle" fill="#f1f5f9" font-size="8">Harness</text>
      <rect x="160" y="66" width="90" height="25" rx="5" fill="#1e293b" stroke="#10b981" stroke-width="1.2"/>
      <text x="205" y="83" text-anchor="middle" fill="#f1f5f9" font-size="8">Workflow</text>
      <defs><marker id="cat3arr" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill="#94a3b8"/></marker></defs>
    </svg>`,
  },

  setup: async (ctx) => {
    expandAppSidebar();
    deleteWorkflowByName(CAT3_TEMP_WF_NAME);
    deleteCollectionsByName(DEMO_ENTRY_NAME);
    deleteCollectionsByName(DEMO_ENTRY_NAME_VERSIONED);
    await ctx.delay(200);
    await cleanupOtherRequestDemoCollections(ctx);
    ensureHarnessTargets();
    await ctx.delay(400);
    ensureCatalogTab(ctx);
    await ctx.delay(400);
    await seedCatalogEntry(DEMO_ENTRY_NAME, JSONPLACEHOLDER_API_SPEC);
    await waitForSelector(CAT.entryByName(DEMO_ENTRY_NAME), 3000);
    selectCatalogEntryByName(DEMO_ENTRY_NAME);
    await ctx.delay(200);
  },

  cleanup: async (ctx) => {
    await closeHarnessModalIfOpen(ctx);
    closeExportModalIfOpen();
    collapseAllCards();
    cleanupDemoFeatureGroups();
    deleteCatalogEntryByName(DEMO_ENTRY_NAME);
    deleteCollectionsByName(DEMO_ENTRY_NAME);
    deleteCollectionsByName(DEMO_ENTRY_NAME_VERSIONED);
    deleteWorkflowByName(CAT3_TEMP_WF_NAME);
    await cleanupOtherRequestDemoCollections(ctx);
    ensureCatalogTab(ctx);
    await ctx.delay(60);
  },

  steps: [
    // ── Step 1: Export One Endpoint ─────────────────────────────
    {
      id: 'cat3-single-export',
      title: 'Export One Endpoint',
      description:
        'Expand **GET /posts**, open **Try it out**, and spotlight the **Export to Requests** ' +
        'button in the execute bar. Click it — the export modal opens with this single ' +
        'endpoint pre-selected.\n\n' +
        'In the modal, spotlight the **Collection Name** field (pre-filled with the API name ' +
        'and "1 new endpoint" badge), the **Target Group** selector (None, existing groups, or ' +
        '+ New Group), and the **Environments table** with checkboxes per environment.',

      preAction: async (ctx) => {
        ensureCatalogTab(ctx);
        await ensureDemoEntrySelected();
        await ensureEndpointsView(ctx);
        closeExportModalIfOpen();
        collapseAllCards();
      },

      action: async (ctx) => {
        // Switch to Endpoints tab and find GET /posts
        await ctx.click(CAT.VIEW_ENDPOINTS);
        await ensureEndpointsView(ctx);
        await ctx.delay(500);

        const postCard = document.querySelector<HTMLElement>(CAT.endpointCard('GET', '/posts'));
        if (!postCard) return;
        postCard.scrollIntoView({ block: 'center' });
        await ctx.delay(400);

        // Expand the card
        const header = postCard.querySelector<HTMLElement>('.sw-header');
        if (header) header.click();
        await ctx.delay(700);

        // Open Try it out to reveal the execute bar
        const tryitBtn = postCard.querySelector<HTMLElement>(CAT.TRYIT_BTN);
        if (tryitBtn) tryitBtn.click();
        await ctx.delay(600);

        // Spotlight the "Export to Requests" button — focal teaching point
        const exportBtn = postCard.querySelector<HTMLElement>(CAT.EXPORT_TO_REQ_BTN);
        if (exportBtn) {
          exportBtn.scrollIntoView({ block: 'nearest' });
          await spotlightEl(ctx, exportBtn, 1000);
          exportBtn.click();
        }

        // Wait for the export modal
        try {
          await waitForSelector(CAT.EXPORT_MODAL, 3000);
        } catch { return; }
        await ctx.delay(900);

        // Spotlight the "List all posts" endpoint row — find by exact text match
        const epTable = document.querySelector('.cat-send-ep-table');
        if (epTable) {
          const descCells = epTable.querySelectorAll<HTMLElement>('td.cat-send-ept-desc');
          for (const cell of descCells) {
            if (cell.textContent?.trim() === 'List all posts') {
              const row = cell.closest('tr');
              if (row instanceof HTMLElement) {
                row.scrollIntoView({ block: 'nearest' });
                await spotlightEl(ctx, row, 1200);
              }
              break;
            }
          }
        }

        // Spotlight the collection name field
        const colNameInput = document.querySelector<HTMLElement>(CAT.EXPORT_COL_NAME);
        if (colNameInput) {
          await spotlightEl(ctx, colNameInput, 1100);
        }

        // Spotlight the Target Group selector
        const targetGroup = document.querySelector<HTMLElement>(CAT.EXPORT_TARGET_GROUP);
        if (targetGroup) {
          await spotlightEl(ctx, targetGroup, 1000);
        }

        // Spotlight the environments table
        const envTable = document.querySelector<HTMLElement>(CAT.EXPORT_ENV_TABLE);
        if (envTable) {
          envTable.scrollIntoView({ block: 'nearest' });
          await spotlightEl(ctx, envTable, 1200);
        }
      },
    },

    // ── Step 2: Configure Export Options ────────────────────────
    {
      id: 'cat3-configure',
      title: 'Configure Export Options',
      description:
        'Inside the modal, each endpoint row has a **Sample toggle** — turn it on to include ' +
        'the saved Try It Out values (request body, parameters) as the sample body for the ' +
        'exported request.\n\n' +
        'The **preview tree** on the right panel shows exactly what will be created: ' +
        'collection → environment folder → method + name hierarchy. Confirm the export, ' +
        'then watch the app navigate to the **Requests** tab showing the created collection.',

      preAction: async (ctx) => {
        ensureCatalogTab(ctx);
        await ensureDemoEntrySelected();
        await ensureEndpointsView(ctx);
        // Ensure export modal is open
        if (!document.querySelector(CAT.EXPORT_MODAL)) {
          const card = await ensureCardTryItOpen('GET', '/posts');
          if (card) {
            const btn = card.querySelector<HTMLElement>(CAT.EXPORT_TO_REQ_BTN);
            if (btn) btn.click();
            await waitForSelector(CAT.EXPORT_MODAL, 3000).catch(() => {});
          }
        }
      },

      action: async (ctx) => {
        // Spotlight the sample toggle on the endpoint row
        const sampleToggle = document.querySelector<HTMLElement>(CAT.EXPORT_SAMPLE_TOGGLE);
        if (sampleToggle) {
          sampleToggle.scrollIntoView({ block: 'nearest' });
          await spotlightEl(ctx, sampleToggle, 1100);
        }

        // Spotlight the preview tree — viewer sees collection → env → request hierarchy
        const preview = document.querySelector<HTMLElement>(CAT.EXPORT_PREVIEW);
        if (preview) {
          preview.scrollIntoView({ block: 'nearest' });
          await spotlightEl(ctx, preview, 1500);
        }

        // Confirm the export
        await ctx.delay(500);
        const confirmBtn = document.querySelector<HTMLElement>(CAT.EXPORT_CONFIRM_BTN);
        if (confirmBtn && !confirmBtn.hasAttribute('disabled')) {
          await spotlightEl(ctx, confirmBtn, 900);
          confirmBtn.click();
          await ctx.delay(1500);

          // Collapse all collections so the exported one stands out
          await shrinkAllCollections();
          await ctx.delay(600);

          // Expand the exported collection (versioned name from export)
          const expanded = await ensureCollectionExpanded(ctx, DEMO_ENTRY_NAME_VERSIONED);
          if (!expanded) await ensureCollectionExpanded(ctx, DEMO_ENTRY_NAME);
          await ctx.delay(600);

          // Expand sub-folders (e.g. "Production") inside the collection
          const colEl = document.querySelector<HTMLElement>(`[data-col-name="${DEMO_ENTRY_NAME_VERSIONED}"]`)
            ?? document.querySelector<HTMLElement>(`[data-col-name="${DEMO_ENTRY_NAME}"]`);
          const colGroup = colEl?.closest('.req-col-group');
          if (colGroup) {
            const folders = colGroup.querySelectorAll<HTMLElement>('.req-folder-header');
            for (const folder of folders) {
              const folderGroup = folder.closest('.req-folder-group');
              const reqList = folderGroup?.querySelector('.req-req-list');
              if (!reqList || reqList.getBoundingClientRect().height === 0) {
                folder.click();
                await ctx.delay(300);
              }
            }
          }
          await ctx.delay(400);

          // Click the exported "List all posts" request to show it
          const reqItems = document.querySelectorAll<HTMLElement>('[data-testid="req-req-item"]');
          for (const item of reqItems) {
            const name = item.getAttribute('data-req-name') || item.textContent || '';
            if (name.includes('List all posts') || name.includes('list all posts')) {
              item.scrollIntoView({ block: 'center' });
              item.click();
              await ctx.delay(800);
              await spotlightEl(ctx, item, 1500);
              break;
            }
          }
        } else {
          // Cannot confirm — close gracefully
          closeExportModalIfOpen();
          await ctx.delay(400);
        }
      },
    },

    // ── Step 3: Bulk Export — The Export Tab ────────────────────
    {
      id: 'cat3-bulk-tab',
      title: 'Bulk Export — The Export Tab',
      description:
        'Return to the Catalog and switch to the **Export to Requests** tab. This shows a ' +
        'full endpoint table with **all 12 endpoints** — each with a checkbox, method badge, ' +
        'custom name field, and **version badges**.\n\n' +
        'Version badges show **NEW** (never exported before) or **"from v1.0.0"** (already in ' +
        'a collection from a prior export). The **Select All** checkbox at the top lets you ' +
        'quickly toggle the full list. This prevents duplicate work across spec updates.',
      highlight: CAT.EXPORT_EP_TABLE,

      preAction: async (ctx) => {
        // Navigate back to Catalog (step 2 may have landed on Requests)
        ensureCatalogTab(ctx);
        await ctx.delay(200);
        await ensureDemoEntrySelected();
        closeExportModalIfOpen();
        // Switch to Export tab in preAction so the table is visible during reading
        const exportTab = document.querySelector<HTMLElement>(CAT.VIEW_EXPORT);
        if (exportTab) {
          exportTab.click();
          await ctx.delay(400);
        }
      },

      action: async (ctx) => {
        // Ensure Export tab is active (preAction should have done this)
        const exportTab = document.querySelector<HTMLElement>(CAT.VIEW_EXPORT);
        if (exportTab && !exportTab.classList.contains('active')) {
          exportTab.click();
          await ctx.delay(900);
          try { await waitForSelector(CAT.EXPORT_INLINE, 3000); } catch { /* best-effort */ }
          await ctx.delay(700);
        }

        const epTable = document.querySelector<HTMLElement>(CAT.EXPORT_EP_TABLE);

        // Spotlight a version badge — NEW vs "from v1.0.0"
        const versionBadge = epTable?.querySelector<HTMLElement>('.cat-version-badge');
        if (versionBadge) {
          versionBadge.scrollIntoView({ block: 'nearest' });
          await spotlightEl(ctx, versionBadge, 1200);
        }

        // Uncheck one endpoint to demonstrate exclusion
        let targetRow: HTMLElement | null = null;
        const descCells = epTable?.querySelectorAll<HTMLElement>('td.cat-send-ept-desc');
        if (descCells) {
          for (const cell of descCells) {
            if (cell.textContent?.trim() === 'Delete a post') {
              targetRow = cell.closest('tr') as HTMLElement | null;
              break;
            }
          }
        }
        if (targetRow) {
          targetRow.scrollIntoView({ block: 'nearest' });
          await spotlightEl(ctx, targetRow, 1000);
          const cb = targetRow.querySelector<HTMLInputElement>('input[type="checkbox"]');
          if (cb?.checked) {
            cb.click();
            await ctx.delay(800);
          }
          // Spotlight the updated count (e.g. "11 of 12") to show the change
          const countBadge = document.querySelector<HTMLElement>('.cat-send-count');
          if (countBadge) {
            countBadge.scrollIntoView({ block: 'nearest' });
            await spotlightEl(ctx, countBadge, 1000);
          }
        }

        // Spotlight the Export button at the bottom
        const exportBtn = document.querySelector<HTMLElement>('.cat-send-confirm-btn');
        if (exportBtn) {
          exportBtn.scrollIntoView({ block: 'nearest' });
          await spotlightEl(ctx, exportBtn, 1200);
        }
      },
    },

    // ── Step 4: Coverage Badges — IN REQUESTS ──────────────────
    {
      id: 'cat3-coverage',
      title: 'Coverage Badges — IN REQUESTS',
      description:
        'Switch back to the **Endpoints** tab. The exported endpoint now shows an ' +
        '**"IN REQUESTS"** badge in its header — a green indicator that it\'s already part of ' +
        'a Requests collection.\n\n' +
        'Hover the badge to see a **coverage popover** showing which collection and folder ' +
        'the endpoint was exported to. Click it to navigate directly to the request in the ' +
        'Requests workspace. This prevents duplicate exports and helps you track test coverage.',
      highlight: CAT.VIEW_ENDPOINTS,

      preAction: async (ctx) => {
        ensureCatalogTab(ctx);
        await ctx.delay(200);
        await ensureDemoEntrySelected();
        await ensureEndpointsView(ctx);
        closeExportModalIfOpen();
        collapseAllCards();
      },

      action: async (ctx) => {
        // Switch to Endpoints tab
        await ctx.click(CAT.VIEW_ENDPOINTS);
        await ensureEndpointsView(ctx);
        await ctx.delay(600);

        // Look for any endpoint card with a coverage badge
        const badge = document.querySelector<HTMLElement>(CAT.COVERAGE_BADGE);
        if (badge) {
          // Scroll to the card that has the badge
          const card = badge.closest<HTMLElement>('.sw-card');
          if (card) card.scrollIntoView({ block: 'center' });
          await ctx.delay(500);

          // Spotlight the coverage badge — "IN REQUESTS"
          await spotlightEl(ctx, badge, 1400);

          // Click to open the coverage popover
          badge.click();
          await ctx.delay(700);

          // Spotlight the popover showing collection path
          const popover = document.querySelector<HTMLElement>(CAT.COVERAGE_POPOVER);
          if (popover) {
            await spotlightEl(ctx, popover, 1600);

            // Spotlight and click the "Go to →" button to navigate
            const gotoBtn = popover.querySelector<HTMLElement>('.sw-coverage-popover-item');
            if (gotoBtn) {
              await spotlightEl(ctx, gotoBtn, 1200);
              gotoBtn.click();
              await ctx.delay(1200);

              // Spotlight the request in the Requests tab
              const reqItems = document.querySelectorAll<HTMLElement>('[data-testid="req-req-item"]');
              for (const item of reqItems) {
                const name = item.getAttribute('data-req-name') || item.textContent || '';
                if (name.includes('List all posts')) {
                  item.scrollIntoView({ block: 'center' });
                  await spotlightEl(ctx, item, 1500);
                  break;
                }
              }
            } else {
              const closeBtn = popover.querySelector<HTMLButtonElement>('.btn');
              if (closeBtn) closeBtn.click();
              await ctx.delay(400);
            }
          }
        } else {
          // No badge visible — explain context (no prior export in this session)
          const endpointList = document.querySelector<HTMLElement>(CAT.ENDPOINT_LIST);
          if (endpointList) {
            await spotlightEl(ctx, endpointList, 1500);
          }
        }
      },
    },

    // ── Step 5: Send to Harness ───────────────────────────────────
    {
      id: 'cat3-harness',
      title: 'Send to Harness',
      description:
        'Click **Send to Harness** in the execute bar to promote `POST /posts` directly ' +
        'to the Test Harness — no Requests collection needed.\n\n' +
        'The **Target** cascade picks where the test lands:\n' +
        '- **Environment** → **Microservice** → **Feature Group** (create) → **Scenario** (create)\n\n' +
        'Then the **Options** step shows Auth Mode and Validation — select **Status 200**. ' +
        'Click **Send to Harness** to confirm — then watch as we navigate to the Harness ' +
        'and spotlight the created **Feature Group**, **Scenario**, and the **Create a post** test.',
      highlight: CAT.SEND_TO_HARNESS_BTN,

      preAction: async (ctx) => {
        ensureCatalogTab(ctx);
        try { await ctx.waitFor(CAT.SIDEBAR, 3000); } catch { /* best-effort */ }
        await ensureDemoEntrySelected();
        await ensureEndpointsView(ctx);
        await closeHarnessModalIfOpen(ctx);
        collapseAllCards();
        await ensureCardTryItOpen('POST', '/posts');
      },

      action: async (ctx) => {
        const postCard = document.querySelector<HTMLElement>(CAT.endpointCard('POST', '/posts'));
        if (!postCard) return;
        postCard.scrollIntoView({ block: 'center' });
        await ctx.delay(500);

        const harnessBtn = postCard.querySelector<HTMLElement>(CAT.SEND_TO_HARNESS_BTN);
        if (!harnessBtn) return;
        harnessBtn.scrollIntoView({ block: 'nearest' });
        await spotlightEl(ctx, harnessBtn, 1200);
        harnessBtn.click();

        try { await waitForSelector(REQ.HARNESS_MODAL, 3000); } catch { return; }
        await ctx.delay(700);

        const modal = document.querySelector<HTMLElement>(REQ.HARNESS_MODAL);
        if (modal) await spotlightEl(ctx, modal, 900);

        // Target cascade
        await selectCascadeByName(ctx, REQ.HARNESS_CASCADE_ENV, CAT3_ENV_NAME, 1200);
        await selectCascadeByName(ctx, REQ.HARNESS_CASCADE_SVC, CAT3_SVC_NAME, 1200);
        await createCascadeItem(ctx, REQ.HARNESS_CASCADE_GROUP, CAT3_FG_NAME, 1100);
        await createCascadeItem(ctx, REQ.HARNESS_CASCADE_SCENARIO, CAT3_SCENARIO_NAME, 1100);

        // Next → Options
        const nextBtn = document.querySelector<HTMLButtonElement>(REQ.HARNESS_NEXT_BTN);
        if (nextBtn) {
          await spotlightEl(ctx, nextBtn, 1000);
          if (!nextBtn.disabled) { nextBtn.click(); await ctx.delay(800); }
        }

        // Options — spotlight each section
        const modal2 = document.querySelector<HTMLElement>(REQ.HARNESS_MODAL);
        if (modal2) {
          const summary = modal2.querySelector<HTMLElement>('.send-harness-target-summary');
          if (summary) await spotlightEl(ctx, summary, 1200);

          const preview = modal2.querySelector<HTMLElement>('.send-harness-preview-card');
          if (preview) await spotlightEl(ctx, preview, 1200);

          const authGroup = modal2.querySelectorAll<HTMLElement>('.send-harness-option-group')[0];
          if (authGroup) await spotlightEl(ctx, authGroup, 1200);

          const validationGroup = modal2.querySelectorAll<HTMLElement>('.send-harness-option-group')[1];
          if (validationGroup) {
            await spotlightEl(ctx, validationGroup, 1100);
            const status200 = Array.from(validationGroup.querySelectorAll<HTMLLabelElement>('.send-harness-option-card'))
              .find((c) => c.textContent?.includes('Status 200'));
            if (status200) {
              await spotlightEl(ctx, status200, 900);
              status200.click();
              await ctx.delay(600);
            }
          }

          // Confirm — actually create the test
          const confirmBtn = modal2.querySelector<HTMLElement>(REQ.HARNESS_CONFIRM_BTN);
          if (confirmBtn) {
            await spotlightEl(ctx, confirmBtn, 1200);
            confirmBtn.click();
            await ctx.delay(1200);
          }
        }

        // Navigate to Harness to show the created test
        ctx.navigateToTab('scenarios');
        await ctx.delay(1200);

        // Find and expand the Feature Group
        const fgHeaders = document.querySelectorAll<HTMLElement>('.feature-group-header');
        let targetFg: HTMLElement | null = null;
        for (const h of fgHeaders) {
          if (h.querySelector('.feature-group-name')?.textContent?.includes(CAT3_FG_NAME)) {
            targetFg = h; break;
          }
        }
        if (targetFg) {
          targetFg.scrollIntoView({ block: 'center' });
          await spotlightEl(ctx, targetFg, 1400);
          // Expand if collapsed
          const fgCard = targetFg.closest<HTMLElement>('.feature-group-card');
          if (fgCard && !fgCard.querySelector('.feature-group-body')) {
            targetFg.click();
            await ctx.delay(600);
          }
        }

        // Find and spotlight the Scenario
        const scHeaders = document.querySelectorAll<HTMLElement>('.scenario-group-header');
        let targetSc: HTMLElement | null = null;
        for (const h of scHeaders) {
          if (h.querySelector('.scenario-group-name')?.textContent?.includes(CAT3_SCENARIO_NAME)) {
            targetSc = h; break;
          }
        }
        if (targetSc) {
          targetSc.scrollIntoView({ block: 'center' });
          await spotlightEl(ctx, targetSc, 1400);
          // Expand if collapsed
          const scCard = targetSc.closest<HTMLElement>('.scenario-group-card');
          if (scCard && !scCard.querySelector('.scenario-group-body')) {
            targetSc.click();
            await ctx.delay(600);
          }
        }

        // Find and spotlight the test (e.g. "Create a post")
        const testCards = document.querySelectorAll<HTMLElement>('.test-card');
        for (const tc of testCards) {
          const name = tc.querySelector('.test-card-info strong')?.textContent ?? '';
          if (name.toLowerCase().includes('create') || name.toLowerCase().includes('post')) {
            tc.scrollIntoView({ block: 'center' });
            await spotlightEl(ctx, tc, 1800);
            break;
          }
        }
      },
    },

    // ── Step 6: Expose to Workflow — Preview Mode ──────────────
    {
      id: 'cat3-expose-preview',
      title: 'Expose to Workflow — Preview',
      description:
        'Each endpoint has a **Workflow Exposure** dropdown in the execute bar. ' +
        'Open it and select **Preview** — this makes the endpoint *temporarily* available ' +
        'in the Workflow Designer palette for testing.\n\n' +
        '**Preview** mode is ideal during development: the endpoint appears in the palette ' +
        'so you can wire it into workflow drafts, but it won\'t persist permanently — ' +
        'a reset or spec re-import will clear it. After selecting Preview, we switch to the ' +
        '**Workflow Designer** → **Catalog** palette so you can see **POST /posts** listed.',
      highlight: CAT.EXPOSE_TO_WORKFLOW,

      preAction: async (ctx) => {
        ensureCatalogTab(ctx);
        try { await ctx.waitFor(CAT.SIDEBAR, 3000); } catch { /* best-effort */ }
        await ensureDemoEntrySelected();
        await ensureEndpointsView(ctx);
        await closeHarnessModalIfOpen(ctx);
        collapseAllCards();
        await ensureCardTryItOpen('POST', '/posts');
        await setExposureQuiet(ctx, 'none');
      },

      action: async (ctx) => {
        const ok = await selectWorkflowExposure(ctx, 'preview');
        if (!ok) return;
        await ctx.delay(500);
        await showExposedEndpointInWorkflowPalette(ctx);
      },
    },

    // ── Step 7: Expose to Workflow — Published Mode ───────────
    {
      id: 'cat3-expose-published',
      title: 'Expose to Workflow — Published',
      description:
        'Now switch to **Published** — this *permanently* registers the endpoint as a ' +
        'drag-and-drop node in the Workflow Designer.\n\n' +
        '**Published** mode means the node persists across sessions, spec re-imports, and ' +
        'resets. It\'s the final "this endpoint is production-ready for automation" stamp.\n\n' +
        'After publishing, switch to the **Workflow Designer** — open the palette\'s ' +
        '**Catalog** tab and you\'ll see **POST /posts** listed as a ready-to-use workflow node.',
      highlight: CAT.EXPOSE_TO_WORKFLOW,

      preAction: async (ctx) => {
        ensureCatalogTab(ctx);
        try { await ctx.waitFor(CAT.SIDEBAR, 3000); } catch { /* best-effort */ }
        await ensureDemoEntrySelected();
        await ensureEndpointsView(ctx);
        await closeHarnessModalIfOpen(ctx);
        collapseAllCards();
        await ensureCardTryItOpen('POST', '/posts');
        await setExposureQuiet(ctx, 'preview');
      },

      action: async (ctx) => {
        const ok = await selectWorkflowExposure(ctx, 'published');
        if (!ok) return;
        await ctx.delay(500);
        await showExposedEndpointInWorkflowPalette(ctx);
      },
    },
  ],
};
