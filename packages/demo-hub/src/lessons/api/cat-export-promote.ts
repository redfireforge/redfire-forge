/**
 * CAT-3 — Export to Requests
 *
 * 5 steps: export one endpoint from the Try It Out bar → configure the export
 * modal (sample toggle, preview tree, environments, target group) → tour the
 * bulk Export tab with version badges → see coverage badges on exported
 * endpoints → demonstrate Send to Harness and Expose to Workflow (actually
 * clicking them, not just spotlight-only).
 *
 * This lesson bridges Catalog → Requests → Harness/Workflow — showing the full
 * promotion pipeline from API spec to automated testing.
 */
import type { DemoLesson } from '../../types';
import { CAT } from '@shared/selectors';
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

// ─── Constants ──────────────────────────────────────────────────

const DEMO_ENTRY_NAME = 'JSONPlaceholder API';

// ─── Helpers ────────────────────────────────────────────────────

/** Ensure the demo entry exists in the sidebar. Seeds it if missing. */
async function ensureDemoEntry(): Promise<void> {
  if (document.querySelector(CAT.entryByName(DEMO_ENTRY_NAME))) return;
  await seedCatalogEntry(DEMO_ENTRY_NAME, JSONPLACEHOLDER_API_SPEC);
  await waitForSelector(CAT.entryByName(DEMO_ENTRY_NAME), 3000);
}

/** Ensure the demo entry is selected. */
async function ensureDemoEntrySelected(): Promise<void> {
  await ensureDemoEntry();
  selectCatalogEntryByName(DEMO_ENTRY_NAME);
  await new Promise(r => setTimeout(r, 150));
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
  estimatedMinutes: 5,
  initialTab: 'catalog',
  allowedTabs: ['catalog', 'requests'],

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
    // Pre-clean orphaned request collections from previous runs
    deleteCollectionsByName(DEMO_ENTRY_NAME);
    ensureCatalogTab(ctx);
    await ctx.delay(80);
    await seedCatalogEntry(DEMO_ENTRY_NAME, JSONPLACEHOLDER_API_SPEC);
    await waitForSelector(CAT.entryByName(DEMO_ENTRY_NAME), 3000);
    selectCatalogEntryByName(DEMO_ENTRY_NAME);
    await ctx.delay(200);
  },

  cleanup: async (ctx) => {
    closeExportModalIfOpen();
    collapseAllCards();
    deleteCatalogEntryByName(DEMO_ENTRY_NAME);
    // Remove exported request collections (created in step 2)
    deleteCollectionsByName(DEMO_ENTRY_NAME);
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
      highlight: CAT.EXPORT_TO_REQ_BTN,

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
      highlight: CAT.EXPORT_MODAL,

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
          // App navigates to Requests tab — viewer sees created collection
          await ctx.delay(1500);

          // Spotlight the created request in the Requests workspace
          const reqItem = document.querySelector<HTMLElement>('[data-testid="request-item"]');
          if (reqItem) {
            await spotlightEl(ctx, reqItem, 1200);
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
      highlight: CAT.VIEW_EXPORT,

      preAction: async (ctx) => {
        // Navigate back to Catalog (step 2 may have landed on Requests)
        ensureCatalogTab(ctx);
        await ctx.delay(200);
        await ensureDemoEntrySelected();
        closeExportModalIfOpen();
      },

      action: async (ctx) => {
        // Click the Export to Requests tab
        const exportTab = document.querySelector<HTMLElement>(CAT.VIEW_EXPORT);
        if (!exportTab) return;
        await spotlightEl(ctx, exportTab, 800);
        exportTab.click();
        await ctx.delay(900);

        // Wait for the inline export panel
        try {
          await waitForSelector(CAT.EXPORT_INLINE, 3000);
        } catch { /* tab may not have inline panel wired */ }
        await ctx.delay(700);

        // Spotlight the full endpoint table — viewer sees all 12 endpoints
        const epTable = document.querySelector<HTMLElement>(CAT.EXPORT_EP_TABLE);
        if (epTable) {
          epTable.scrollIntoView({ block: 'nearest' });
          await spotlightEl(ctx, epTable, 1800);
        }

        // Spotlight Select All checkbox at top
        const selectAll = epTable?.querySelector<HTMLElement>('input[type="checkbox"]');
        if (selectAll) {
          await spotlightEl(ctx, selectAll, 900);
        }

        // Spotlight version badges — NEW vs "from v1.0.0"
        const versionBadge = epTable?.querySelector<HTMLElement>('.cat-version-badge');
        if (versionBadge) {
          versionBadge.scrollIntoView({ block: 'nearest' });
          await spotlightEl(ctx, versionBadge, 1200);
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

            // Close the popover
            const closeBtn = popover.querySelector<HTMLButtonElement>('.btn');
            if (closeBtn) closeBtn.click();
            await ctx.delay(400);
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

    // ── Step 5: Send to Harness & Expose to Workflow ────────────
    {
      id: 'cat3-harness',
      title: 'Send to Harness & Expose to Workflow',
      description:
        'Expand **POST /posts** with Try It Out active. Two integration shortcuts live ' +
        'in the execute bar:\n\n' +
        '- **Send to Harness** — promotes the endpoint (with its current parameters and body) ' +
        'directly to the **Test Harness** as a test scenario. No collection needed.\n' +
        '- **Expose to Workflow** checkbox — when checked, this endpoint becomes available as a ' +
        'node in the **Workflow Designer\'s** Catalog palette. Build multi-step test flows by ' +
        'combining exposed endpoints with other node types.\n\n' +
        'Watch as we check the **Expose to Workflow** checkbox to demonstrate the action.',
      highlight: CAT.SEND_TO_HARNESS_BTN,

      preAction: async (ctx) => {
        ensureCatalogTab(ctx);
        await ensureDemoEntrySelected();
        await ensureEndpointsView(ctx);
        collapseAllCards();
        await ensureCardTryItOpen('POST', '/posts');
      },

      action: async (ctx) => {
        const postCard = document.querySelector<HTMLElement>(CAT.endpointCard('POST', '/posts'));
        if (!postCard) return;
        postCard.scrollIntoView({ block: 'center' });
        await ctx.delay(500);

        // Spotlight the "Send to Harness" button
        const harnessBtn = postCard.querySelector<HTMLElement>(CAT.SEND_TO_HARNESS_BTN);
        if (harnessBtn) {
          harnessBtn.scrollIntoView({ block: 'nearest' });
          await spotlightEl(ctx, harnessBtn, 1200);
        }

        await ctx.delay(400);

        // Spotlight the "Expose to Workflow" checkbox
        const exposeCheckbox = postCard.querySelector<HTMLElement>(CAT.EXPOSE_TO_WORKFLOW);
        if (exposeCheckbox) {
          await spotlightEl(ctx, exposeCheckbox, 1200);

          // Actually check the Expose to Workflow checkbox — demonstrate the action
          const input = exposeCheckbox.querySelector<HTMLInputElement>('input[type="checkbox"]')
            ?? (exposeCheckbox.tagName === 'INPUT' ? exposeCheckbox as unknown as HTMLInputElement : null);
          if (input && !input.checked) {
            input.click();
            await ctx.delay(900);

            // Spotlight confirmation — viewer sees the endpoint is now exposed
            await spotlightEl(ctx, exposeCheckbox, 1000);
          } else if (exposeCheckbox.tagName === 'LABEL') {
            exposeCheckbox.click();
            await ctx.delay(900);
            await spotlightEl(ctx, exposeCheckbox, 1000);
          }
        }

        // Brief spotlight on the full execute bar to show both actions in context
        const execBar = postCard.querySelector<HTMLElement>('.sw-exec-bar');
        if (execBar) {
          execBar.scrollIntoView({ block: 'nearest' });
          await spotlightEl(ctx, execBar, 1200);
        }
      },
    },
  ],
};
