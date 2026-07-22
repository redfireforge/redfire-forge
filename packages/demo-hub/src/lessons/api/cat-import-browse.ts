/**
 * CAT-1 — Import & Explore Your API
 *
 * 4 steps: import the JSONPlaceholder spec from the Sample Gallery → deep tour
 * of the Overview (format badge, method stats, servers, by-tag breakdown, and
 * quick action buttons) → browse endpoints by tag with expanded card detail →
 * filter endpoints and explore the resolved base URL.
 *
 * Host Strategy is NOT in this lesson (moved to CAT-2 where it's needed before
 * live execution). This lesson focuses on understanding the Catalog's
 * information architecture.
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
  ensureCatalogOverviewView,
  ensureEndpointsView,
  spotlight,
  spotlightEl,
  waitForSelector,
} from './cat-demo-helpers';
import { fillControlledInput } from '../setup-helpers';

// ─── Constants ──────────────────────────────────────────────────

const DEMO_ENTRY_NAME = 'JSONPlaceholder API';
const GALLERY_SAMPLE_ID = 'catalog-jsonplaceholder';

// ─── Helpers ────────────────────────────────────────────────────

/** Close the Import modal if it is open (quiet — no ripple). */
async function closeImportModalIfOpen(): Promise<void> {
  const modal = document.querySelector('.cat-modal');
  if (!modal) return;
  const closeBtn = modal.querySelector<HTMLButtonElement>('.cat-btn:not(.cat-btn-primary)');
  if (closeBtn) closeBtn.click();
  await new Promise(r => setTimeout(r, 200));
}

/** Ensure the demo entry exists in the sidebar (seeds if missing). */
async function ensureDemoEntry(): Promise<void> {
  if (document.querySelector(CAT.entryByName(DEMO_ENTRY_NAME))) return;
  await seedCatalogEntry(DEMO_ENTRY_NAME, JSONPLACEHOLDER_API_SPEC);
  await waitForSelector(CAT.entryByName(DEMO_ENTRY_NAME), 3000);
}

/** Ensure the demo entry is selected and the main panel is visible. */
async function ensureDemoEntrySelected(): Promise<void> {
  await ensureDemoEntry();
  selectCatalogEntryByName(DEMO_ENTRY_NAME);
  await new Promise(r => setTimeout(r, 150));
}

// ─── Lesson ─────────────────────────────────────────────────────

export const catImportBrowseLesson: DemoLesson = {
  id: 'cat-import-browse',
  domainId: 'api',
  category: 'catalog',
  name: 'Import & Explore Your API',
  description:
    'Import a spec from the built-in Sample Gallery, then tour the Overview and Endpoint ' +
    'Browser — the Swagger-UI-style interface for exploring every route, parameter, and schema.',
  estimatedMinutes: 4,
  initialTab: 'catalog',
  allowedTabs: ['catalog'],

  concept: {
    title: 'Your API Library, Automatically Organized',
    body:
      'The **API Catalog** imports OpenAPI 3.x or Swagger 2.0 specs and presents them in a ' +
      'structured, browsable interface — much like Swagger UI, but integrated with your testing ' +
      'workflow.\n\n' +
      '**What you do in this lesson:**\n' +
      '- Open the **Import** modal and pick a spec from the **Sample Gallery**\n' +
      '- Tour the **Overview** tab — format badge, endpoint stats, servers, tags, and quick action buttons\n' +
      '- Browse the **Endpoints** tab — tag folders, expandable cards with parameters and response schemas\n' +
      '- **Filter** endpoints by keyword and explore the resolved base URL\n\n' +
      '**Import sources:** You can import from a file (drag & drop), paste raw YAML/JSON, ' +
      'fetch from a URL, or pick a pre-built sample from the gallery. This lesson uses the gallery — ' +
      'the fastest way to get started.',
    keyTerms: [
      { term: 'OpenAPI Spec', definition: 'A machine-readable description of a REST API — paths, parameters, schemas, and security — in YAML or JSON' },
      { term: 'Tag Group', definition: 'Endpoints organized by their OpenAPI `tags` field (e.g. "Posts", "Users") — like folders for your routes' },
      { term: 'Endpoint Card', definition: 'An expandable card showing one route\'s method, path, parameters, request body, and response codes' },
      { term: 'Quick Actions', definition: 'One-click buttons on the Overview: Re-import, Export Spec, Convert/Upgrade, and Version History' },
    ],
    diagram: `<svg viewBox="0 0 420 90" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="25" width="90" height="40" rx="6" fill="#1e293b" stroke="#3b82f6" stroke-width="1.5"/>
      <text x="50" y="44" text-anchor="middle" fill="#f1f5f9" font-size="9">OpenAPI YAML</text>
      <text x="50" y="57" text-anchor="middle" fill="#94a3b8" font-size="7">paths · schemas</text>
      <path d="M100 45 L145 45" stroke="#3b82f6" stroke-width="1.5" marker-end="url(#cat1arr)"/>
      <rect x="150" y="25" width="70" height="40" rx="6" fill="#1e293b" stroke="#f59e0b" stroke-width="1.5"/>
      <text x="185" y="49" text-anchor="middle" fill="#f1f5f9" font-size="9">Import</text>
      <path d="M225 45 L270 45" stroke="#10b981" stroke-width="1.5" marker-end="url(#cat1arr)"/>
      <rect x="275" y="15" width="135" height="60" rx="6" fill="#1e293b" stroke="#10b981" stroke-width="1.5"/>
      <text x="342" y="34" text-anchor="middle" fill="#f1f5f9" font-size="9">API Catalog</text>
      <text x="342" y="49" text-anchor="middle" fill="#94a3b8" font-size="7">Overview · Endpoints</text>
      <text x="342" y="63" text-anchor="middle" fill="#94a3b8" font-size="7">Try It Out · Export</text>
      <defs><marker id="cat1arr" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill="#94a3b8"/></marker></defs>
    </svg>`,
  },

  setup: async (ctx) => {
    ensureCatalogTab(ctx);
    await ctx.delay(80);
    await closeImportModalIfOpen();
    deleteCatalogEntryByName(DEMO_ENTRY_NAME);
    await ctx.delay(200);
  },

  cleanup: async (ctx) => {
    await closeImportModalIfOpen();
    deleteCatalogEntryByName(DEMO_ENTRY_NAME);
    deleteCollectionsByName(DEMO_ENTRY_NAME);
    ensureCatalogTab(ctx);
    await ctx.delay(60);
  },

  steps: [
    // ── Step 1: Import from the Sample Gallery ──────────────────
    {
      id: 'cat1-import',
      title: 'Import from the Sample Gallery',
      description:
        'Click **+ Import Spec** to open the Import modal. You\'ll see **4 import tabs** — ' +
        'Upload, Paste, URL, and Gallery — each a different way to bring in a spec. Switch to ' +
        'the **Sample Gallery** tab: it contains pre-built OpenAPI specs for real public APIs.\n\n' +
        'Pick **JSONPlaceholder API** — a clean REST API with posts, comments, users, and todos. ' +
        'The **preview panel** shows the parsed title, version, endpoint count, and servers ' +
        'before you commit. Click **Import** and the spec appears in the sidebar, ready to explore.',
      highlight: CAT.IMPORT_BTN,

      preAction: async (ctx) => {
        ensureCatalogTab(ctx);
        await closeImportModalIfOpen();
        deleteCatalogEntryByName(DEMO_ENTRY_NAME);
        await ctx.delay(200);
      },

      action: async (ctx) => {
        // Spotlight the "+ Import Spec" button so viewer sees where to begin
        await spotlight(ctx, CAT.IMPORT_BTN, 1500);
        await ctx.delay(600);
        await ctx.click(CAT.IMPORT_BTN);
        await ctx.waitFor(CAT.IMPORT_TAB_GALLERY, 3000);
        await ctx.delay(1200);

        // Spotlight the 4 import tabs — viewer reads the options (Upload, Paste, URL, Gallery)
        const tabRow = document.querySelector<HTMLElement>('.cat-import-tabs');
        if (tabRow) {
          await spotlightEl(ctx, tabRow, 1800);
        }
        await ctx.delay(600);

        // Switch to Sample Gallery tab
        await ctx.click(CAT.IMPORT_TAB_GALLERY);
        await ctx.waitFor(CAT.IMPORT_GALLERY_GRID, 2000);
        await ctx.delay(1000);

        // Spotlight the gallery grid so viewer sees all available sample specs
        await spotlight(ctx, CAT.IMPORT_GALLERY_GRID, 2000);
        await ctx.delay(800);

        // Click the JSONPlaceholder card
        const card = document.querySelector<HTMLElement>(CAT.importGalleryCard(GALLERY_SAMPLE_ID));
        if (card) {
          card.scrollIntoView({ block: 'nearest' });
          await ctx.delay(400);
          await spotlightEl(ctx, card, 1600);
          await ctx.delay(500);
          card.click();
        }

        // Wait for the preview panel to render
        await ctx.waitFor(CAT.IMPORT_PREVIEW, 4000);
        await ctx.delay(1200);

        // Spotlight the preview — viewer reads parsed title, version, endpoints, servers
        await spotlight(ctx, CAT.IMPORT_PREVIEW, 2200);
        await ctx.delay(800);

        // Spotlight and click Import button
        await spotlight(ctx, CAT.IMPORT_CONFIRM_BTN, 1200);
        await ctx.delay(400);
        await ctx.click(CAT.IMPORT_CONFIRM_BTN);
        await ctx.delay(1400);

        // Entry appears in sidebar — spotlight it so viewer sees the result
        await ctx.waitFor(CAT.entryByName(DEMO_ENTRY_NAME), 3000);
        await ctx.delay(800);
        await spotlight(ctx, CAT.entryByName(DEMO_ENTRY_NAME), 1800);
      },
    },

    // ── Step 2: Tour the Overview ───────────────────────────────
    {
      id: 'cat1-overview',
      title: 'Tour the Overview',
      description:
        'The **Overview** tab shows the spec at a glance. Pay attention to:\n\n' +
        '- The **format badge** — "OpenAPI 3.0.3" — confirms the spec version\n' +
        '- The **Servers** section showing the base URL from the spec\n' +
        '- The **method stats** chart — GET/POST/PUT/DELETE counts at a glance\n' +
        '- The **By Tag** breakdown — posts, comments, users, todos with counts\n' +
        '- The **Quick Actions** row: **Re-import**, **Export Spec**, **Convert/Upgrade**, ' +
        'and **Version History** — each with a distinct purpose explained below.',
      highlight: CAT.VIEW_OVERVIEW,

      preAction: async (ctx) => {
        ensureCatalogTab(ctx);
        await ensureDemoEntrySelected();
      },

      action: async (ctx) => {
        // Switch to Overview tab
        await spotlight(ctx, CAT.VIEW_OVERVIEW, 800);
        await ctx.click(CAT.VIEW_OVERVIEW);
        await ensureCatalogOverviewView(ctx);
        await ctx.delay(700);

        // Spotlight the format badge — "OpenAPI 3.0.3"
        const formatBadge = document.querySelector<HTMLElement>(CAT.OVERVIEW_SPEC_FORMAT);
        if (formatBadge) {
          await spotlightEl(ctx, formatBadge, 1200);
        }

        // Spotlight the Servers section — base URL
        const serversSection = document.querySelector<HTMLElement>(CAT.OVERVIEW_SERVERS)
          ?? document.querySelector<HTMLElement>('.cat-ov-server-list');
        if (serversSection) {
          serversSection.scrollIntoView({ block: 'nearest' });
          await spotlightEl(ctx, serversSection, 1100);
        }

        // Spotlight the method stats bars (GET/POST/PUT/DELETE breakdown)
        const methodStats = document.querySelector<HTMLElement>(CAT.OVERVIEW_METHOD_STATS);
        if (methodStats) {
          methodStats.scrollIntoView({ block: 'nearest' });
          await spotlightEl(ctx, methodStats, 1200);
        }

        // Spotlight the By Tag breakdown
        const byTag = document.querySelector<HTMLElement>(CAT.OVERVIEW_BY_TAG)
          ?? document.querySelector<HTMLElement>('.cat-ov-tag-breakdown');
        if (byTag) {
          byTag.scrollIntoView({ block: 'nearest' });
          await spotlightEl(ctx, byTag, 1100);
        }

        // Spotlight the Quick Actions row — Re-import, Export Spec, Convert, History
        const quickActions = document.querySelector<HTMLElement>(CAT.OVERVIEW_QUICK_ACTIONS)
          ?? document.querySelector<HTMLElement>('.cat-ov-quick-actions');
        if (quickActions) {
          quickActions.scrollIntoView({ block: 'nearest' });
          await spotlightEl(ctx, quickActions, 1400);
        }
      },
    },

    // ── Step 3: Browse Endpoints by Tag ─────────────────────────
    {
      id: 'cat1-endpoints',
      title: 'Browse Endpoints by Tag',
      description:
        'Switch to the **Endpoints** tab. Endpoints are grouped by their OpenAPI **tags** — ' +
        '"posts", "users", "comments", and more. Each tag is a collapsible folder.\n\n' +
        'Expand a tag to see endpoint cards. Expand **GET /posts/{id}** to see its full detail: ' +
        '**path parameters** (editable `{id}` field), **response codes** (200, 404), and the ' +
        '**response model** with example values and type information. This is your read-only ' +
        'reference — like Swagger UI, but inside your testing workbench.',
      highlight: CAT.VIEW_ENDPOINTS,

      preAction: async (ctx) => {
        ensureCatalogTab(ctx);
        await ensureDemoEntrySelected();
      },

      action: async (ctx) => {
        // Switch to Endpoints tab
        await spotlight(ctx, CAT.VIEW_ENDPOINTS, 800);
        await ctx.click(CAT.VIEW_ENDPOINTS);
        await ensureEndpointsView(ctx);
        await ctx.delay(700);

        // Spotlight the tag folders so viewer sees the grouping structure
        const firstTagGroup = document.querySelector<HTMLElement>(CAT.TAG_GROUP);
        if (firstTagGroup) {
          await spotlightEl(ctx, firstTagGroup, 1100);
        }

        // Spotlight the endpoint list — viewer sees all cards under the first tag
        await spotlight(ctx, CAT.ENDPOINT_LIST, 1000);

        // Find and expand GET /posts/{id} to show full card details
        const targetCard = document.querySelector<HTMLElement>(
          CAT.endpointCard('GET', '/posts/{id}'),
        ) ?? document.querySelector<HTMLElement>(CAT.ENDPOINT_CARD);

        if (targetCard) {
          targetCard.scrollIntoView({ block: 'nearest' });
          await ctx.delay(400);

          // Click the card header to expand it
          const header = targetCard.querySelector<HTMLElement>('.sw-header');
          if (header) header.click();
          await ctx.delay(900);

          // Spotlight the expanded card — viewer sees params, responses, model
          await spotlightEl(ctx, targetCard, 1800);

          // Spotlight the parameters section specifically
          const paramsSection = targetCard.querySelector<HTMLElement>('.sw-params');
          if (paramsSection) {
            await spotlightEl(ctx, paramsSection, 1000);
          }

          // Spotlight the response section
          const responseSection = targetCard.querySelector<HTMLElement>('.sw-responses');
          if (responseSection) {
            responseSection.scrollIntoView({ block: 'nearest' });
            await spotlightEl(ctx, responseSection, 1200);
          }
        }
      },
    },

    // ── Step 4: Filter & Explore ────────────────────────────────
    {
      id: 'cat1-filter',
      title: 'Filter & Explore',
      description:
        'Type **"user"** in the filter box to instantly narrow the endpoint list to ' +
        'user-related routes. The filter matches against **path**, **method**, **summary**, ' +
        'and **operationId** — so you can find any endpoint instantly, even in a spec with ' +
        'hundreds of routes.\n\n' +
        'Clear the filter to see all endpoints again. Notice the **resolved Base URL** ' +
        'at the top — this shows where requests will be sent. The **Hide deprecated** ' +
        'checkbox (when available) lets you focus only on active endpoints.',
      highlight: CAT.ENDPOINT_FILTER,

      preAction: async (ctx) => {
        ensureCatalogTab(ctx);
        await ensureDemoEntrySelected();
        await ensureEndpointsView(ctx);
      },

      action: async (ctx) => {
        // Spotlight the filter input
        await spotlight(ctx, CAT.ENDPOINT_FILTER, 900);

        // Type "user" to filter
        const filterInput = document.querySelector<HTMLInputElement>(CAT.ENDPOINT_FILTER);
        if (filterInput) {
          filterInput.focus();
          fillControlledInput(filterInput, 'user');
          filterInput.dispatchEvent(new Event('input', { bubbles: true }));
          filterInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
        await ctx.delay(900);

        // Spotlight the filtered endpoint list — viewer sees only user routes
        await spotlight(ctx, CAT.ENDPOINT_LIST, 1300);

        // Clear the filter
        await ctx.delay(600);
        if (filterInput) {
          fillControlledInput(filterInput, '');
          filterInput.dispatchEvent(new Event('input', { bubbles: true }));
          filterInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
        await ctx.delay(600);

        // Spotlight the Hide deprecated checkbox (explain when it appears)
        const hideDeprecated = document.querySelector<HTMLElement>(CAT.HIDE_DEPRECATED);
        if (hideDeprecated) {
          await spotlightEl(ctx, hideDeprecated, 1000);
        }

        // Spotlight the resolved Base URL at top
        const baseUrl = document.querySelector<HTMLElement>(CAT.BASE_URL);
        if (baseUrl) {
          baseUrl.scrollIntoView({ block: 'nearest' });
          await spotlightEl(ctx, baseUrl, 1200);
        }
      },
    },
  ],
};
