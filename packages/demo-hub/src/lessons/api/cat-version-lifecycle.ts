/**
 * CAT-4 — Version Management & Spec Lifecycle
 *
 * 5 steps: export the original spec (download) → re-import an updated spec
 * (adds new endpoints, creates version 2) → browse version history (2 entries) →
 * compare two versions (diff summary with added/changed/removed) → restore the
 * original version.
 *
 * This lesson covers the full lifecycle of an API spec in the Catalog — from
 * initial import through multiple iterations, with diff tools and rollback
 * capability.
 */
import type { DemoLesson, DemoActionContext } from '../../types';
import { CAT } from '@shared/selectors';
import {
  JSONPLACEHOLDER_API_SPEC,
  seedCatalogEntry,
  deleteCatalogEntryByName,
  deleteCollectionsByName,
  selectCatalogEntryByName,
  ensureCatalogTab,
  ensureCatalogOverviewView,
  seedSecondVersion,
  ensureSecondVersionSeeded,
  resetSecondVersionFlag,
  openVersionHistoryModal,
  closeVersionHistoryIfOpen,
  spotlight,
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

/** Ensure the demo entry is selected on the Overview sub-tab. */
async function ensureDemoEntryOnOverview(ctx: DemoActionContext): Promise<void> {
  ensureCatalogTab(ctx);
  await ensureDemoEntry();
  selectCatalogEntryByName(DEMO_ENTRY_NAME);
  await new Promise(r => setTimeout(r, 150));
  await ensureCatalogOverviewView(ctx);
}

// ─── Lesson ─────────────────────────────────────────────────────

export const catVersionLifecycleLesson: DemoLesson = {
  id: 'cat-version-lifecycle',
  domainId: 'api',
  category: 'catalog',
  name: 'Version Management & Spec Lifecycle',
  description:
    'Manage API spec versions — export the original spec, update with re-import, browse ' +
    'version history, compare changes, and restore previous versions.',
  estimatedMinutes: 5,
  initialTab: 'catalog',
  allowedTabs: ['catalog'],

  concept: {
    title: 'Track How Your API Evolves Over Time',
    body:
      'APIs change — new endpoints get added, parameters get renamed, response schemas evolve. ' +
      'The Catalog tracks every version of your spec so you can:\n\n' +
      '- **Export the original** — download the exact YAML/JSON you imported, byte-for-byte\n' +
      '- **Re-import / Update** — load a new version of the same API; duplicates are detected automatically\n' +
      '- **Browse Version History** — see every imported version with timestamps and metadata\n' +
      '- **Compare two versions** — a structured diff showing added, removed, and changed endpoints\n' +
      '- **Restore** — roll back to any previous version while keeping the full history intact\n\n' +
      '**Why this matters for teams:** When a backend team ships a new API version, you can ' +
      're-import their updated spec, compare what changed, update your test coverage for new ' +
      'endpoints, and always roll back if something breaks.',
    keyTerms: [
      { term: 'Export Spec', definition: 'Downloads the original imported YAML/JSON — not a re-serialized version, but the exact source file' },
      { term: 'Re-import', definition: 'Loads an updated version of an existing API spec; the Catalog detects the match by title and adds a new version' },
      { term: 'Version History', definition: 'A timeline of every imported version: label, format badge, CURRENT tag, import timestamp, and spec size' },
      { term: 'Version Compare', definition: 'Structured diff between two selected versions: added endpoints, removed endpoints, and parameter/schema changes' },
      { term: 'Restore', definition: 'Makes a previous version the active one — the restored version becomes CURRENT while newer versions remain in history' },
    ],
    diagram: `<svg viewBox="0 0 440 90" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="30" width="75" height="35" rx="6" fill="#1e293b" stroke="#3b82f6" stroke-width="1.5"/>
      <text x="42" y="49" text-anchor="middle" fill="#f1f5f9" font-size="8">v1.0.0</text>
      <text x="42" y="60" text-anchor="middle" fill="#94a3b8" font-size="7">12 endpoints</text>
      <path d="M85 47 L120 47" stroke="#f59e0b" stroke-width="1.5" marker-end="url(#cat4arr)"/>
      <rect x="125" y="30" width="75" height="35" rx="6" fill="#1e293b" stroke="#f59e0b" stroke-width="1.5"/>
      <text x="162" y="49" text-anchor="middle" fill="#f1f5f9" font-size="8">v2.0.0</text>
      <text x="162" y="60" text-anchor="middle" fill="#94a3b8" font-size="7">+1 endpoint</text>
      <path d="M205 47 L240 47" stroke="#8b5cf6" stroke-width="1.5" marker-end="url(#cat4arr)"/>
      <rect x="245" y="25" width="85" height="45" rx="6" fill="#1e293b" stroke="#8b5cf6" stroke-width="1.5"/>
      <text x="287" y="44" text-anchor="middle" fill="#f1f5f9" font-size="8">Compare</text>
      <text x="287" y="56" text-anchor="middle" fill="#94a3b8" font-size="7">+added −removed</text>
      <text x="287" y="66" text-anchor="middle" fill="#94a3b8" font-size="7">~changed</text>
      <path d="M335 47 L370 47" stroke="#10b981" stroke-width="1.5" marker-end="url(#cat4arr)"/>
      <rect x="375" y="30" width="60" height="35" rx="6" fill="#1e293b" stroke="#10b981" stroke-width="1.5"/>
      <text x="405" y="49" text-anchor="middle" fill="#f1f5f9" font-size="8">Restore</text>
      <text x="405" y="60" text-anchor="middle" fill="#94a3b8" font-size="7">rollback</text>
      <defs><marker id="cat4arr" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill="#94a3b8"/></marker></defs>
    </svg>`,
  },

  setup: async (ctx) => {
    ensureCatalogTab(ctx);
    await ctx.delay(80);
    closeVersionHistoryIfOpen();
    // Start fresh: seed JSONPlaceholder v1 + v2 so all steps have 2 versions
    deleteCatalogEntryByName(DEMO_ENTRY_NAME);
    await ctx.delay(400);
    await seedCatalogEntry(DEMO_ENTRY_NAME, JSONPLACEHOLDER_API_SPEC);
    await waitForSelector(CAT.entryByName(DEMO_ENTRY_NAME), 3000);
    selectCatalogEntryByName(DEMO_ENTRY_NAME);
    // Give React time to commit the entry state before adding v2
    await ctx.delay(600);
    // Seed the second version (v2) so Compare works even if user skips Step 2
    await ensureSecondVersionSeeded();
    await ctx.delay(300);
  },

  cleanup: async (ctx) => {
    closeVersionHistoryIfOpen();
    deleteCatalogEntryByName(DEMO_ENTRY_NAME);
    deleteCollectionsByName(DEMO_ENTRY_NAME);
    resetSecondVersionFlag();
    ensureCatalogTab(ctx);
    await ctx.delay(60);
  },

  steps: [
    // ── Step 1: Export the Original Spec ────────────────────────
    {
      id: 'cat4-export-spec',
      title: 'Export the Original Spec',
      description:
        'On the **Overview** tab, find the **Export Spec** quick action button. This downloads ' +
        'the **exact YAML/JSON file** you originally imported — not a re-serialized or processed ' +
        'version, but the raw source byte-for-byte.\n\n' +
        'This is useful when you need to share the spec with another team, load it into a ' +
        'different tool (Postman, Insomnia, Swagger Editor), or archive a known-good version ' +
        'for CI/CD pipelines.',
      highlight: CAT.EXPORT_SPEC_BTN,

      preAction: async (ctx) => {
        await ensureDemoEntryOnOverview(ctx);
      },

      action: async (ctx) => {
        // Ensure we're on the Overview tab
        await ensureCatalogOverviewView(ctx);
        await ctx.delay(600);

        // Spotlight the Quick Actions row
        const quickActions = document.querySelector<HTMLElement>(CAT.OVERVIEW_QUICK_ACTIONS)
          ?? document.querySelector<HTMLElement>('.cat-ov-quick-actions');
        if (quickActions) {
          quickActions.scrollIntoView({ block: 'nearest' });
          await spotlightEl(ctx, quickActions, 1000);
        }

        // Spotlight the Export Spec button specifically
        await spotlight(ctx, CAT.EXPORT_SPEC_BTN, 1200);

        // Click Export Spec — triggers a file download
        const exportBtn = document.querySelector<HTMLElement>(CAT.EXPORT_SPEC_BTN);
        if (exportBtn) {
          exportBtn.click();
          await ctx.delay(1200);

          // Spotlight any success feedback (toast or badge)
          const successToast = document.querySelector<HTMLElement>('.toast-success, .cat-export-feedback');
          if (successToast) {
            await spotlightEl(ctx, successToast, 1000);
          }
        }
      },
    },

    // ── Step 2: Re-import — Update the Spec ────────────────────
    {
      id: 'cat4-reimport',
      title: 'Re-import — Update the Spec',
      description:
        'Click **Re-import** on the Overview. The import modal opens in **re-import mode** — ' +
        'the title shows "Re-import / Update Specification" and the Catalog automatically ' +
        'detects this is the same API (by title match).\n\n' +
        'Load an updated spec with a new endpoint (GET /posts/{id}/comments). The preview shows ' +
        '**"will add new version"** — confirming that the current version will be preserved and ' +
        'a new one added alongside it. Click **Update** to add version 2.',
      highlight: CAT.REIMPORT_BTN,

      preAction: async (ctx) => {
        await ensureDemoEntryOnOverview(ctx);
      },

      action: async (ctx) => {
        await ensureCatalogOverviewView(ctx);
        await ctx.delay(500);

        // Spotlight the Re-import button
        await spotlight(ctx, CAT.REIMPORT_BTN, 1000);

        // Click Re-import
        const reimportBtn = document.querySelector<HTMLElement>(CAT.REIMPORT_BTN);
        if (reimportBtn) {
          reimportBtn.click();
        }
        await ctx.delay(1000);

        // Wait for the re-import modal/flow
        const importPreview = document.querySelector<HTMLElement>(CAT.IMPORT_PREVIEW);
        if (importPreview) {
          // Spotlight the "duplicate detection" indicator
          await spotlightEl(ctx, importPreview, 1200);
        }

        // Programmatically seed the v2 spec (simulates the re-import action)
        await seedSecondVersion(ctx);
        await ctx.delay(1000);

        // Close any import modal
        const modal = document.querySelector('.cat-modal');
        if (modal) {
          const closeBtn = modal.querySelector<HTMLButtonElement>('.cat-btn:not(.cat-btn-primary)');
          if (closeBtn) closeBtn.click();
          await ctx.delay(300);
        }

        // Spotlight the updated overview — new endpoint count, version count
        await ensureCatalogOverviewView(ctx);
        await ctx.delay(800);

        const overview = document.querySelector<HTMLElement>(CAT.OVERVIEW);
        if (overview) {
          overview.scrollIntoView({ block: 'start' });
          await spotlightEl(ctx, overview, 1400);
        }
      },
    },

    // ── Step 3: Browse Version History ──────────────────────────
    {
      id: 'cat4-history',
      title: 'Browse Version History',
      description:
        'Click **Version History** on the Overview. The modal shows **2 entries**: the original ' +
        'import and the updated version you just added.\n\n' +
        'Each version displays: **version label** (v1.0.0, v2.0.0), **format badge** ' +
        '(OpenAPI 3.0.3), **CURRENT** tag on the active version, **import timestamp**, ' +
        'and **spec size**. The **checkbox selectors** next to each version are used for ' +
        'comparing — select two versions to enable the Compare button.',
      highlight: CAT.VERSION_HISTORY_BTN,

      preAction: async (ctx) => {
        await ensureDemoEntryOnOverview(ctx);
        // Guard: ensure v2 exists (user may have skipped step 2)
        await ensureSecondVersionSeeded();
        // Verify the entry actually has 2 versions — if not, wait and retry
        await new Promise(r => setTimeout(r, 400));
        await ensureSecondVersionSeeded();
        closeVersionHistoryIfOpen();
      },

      action: async (ctx) => {
        // Click Version History
        await spotlight(ctx, CAT.VERSION_HISTORY_BTN, 900);
        const historyBtn = document.querySelector<HTMLElement>(CAT.VERSION_HISTORY_BTN);
        if (historyBtn) {
          historyBtn.click();
        }
        await ctx.delay(1000);

        // Wait for and spotlight the version list — 2 entries
        try {
          await waitForSelector(CAT.VERSION_LIST, 3000);
        } catch { /* modal may not have loaded */ }
        await ctx.delay(800);

        // Spotlight the full version list
        await spotlight(ctx, CAT.VERSION_LIST, 1500);

        // Spotlight individual version items — metadata: label, format, date
        const versionItems = document.querySelectorAll<HTMLElement>(CAT.VERSION_ITEM);
        if (versionItems.length > 0) {
          await spotlightEl(ctx, versionItems[0], 1200);
          if (versionItems.length > 1) {
            await spotlightEl(ctx, versionItems[1], 1000);
          }
        }

        // Spotlight the checkboxes — used for compare
        const checkbox = document.querySelector<HTMLElement>(CAT.VERSION_CHECKBOX);
        if (checkbox) {
          await spotlightEl(ctx, checkbox, 1000);
        }
      },
    },

    // ── Step 4: Compare Two Versions ────────────────────────────
    {
      id: 'cat4-compare',
      title: 'Compare Two Versions',
      description:
        'Check both version checkboxes to select them for comparison, then click **Compare**. ' +
        'The diff view shows:\n\n' +
        '- **Summary badges**: + added, − removed, ~ changed endpoint counts\n' +
        '- **Added endpoints** section: the new `GET /posts/{id}/comments` from the re-import\n' +
        '- **Changed endpoints** section: detail bullets showing parameter, body, or response changes\n\n' +
        'This structured diff helps you understand exactly what changed between API versions ' +
        'without reading raw YAML diffs.',
      highlight: CAT.VERSION_COMPARE_BTN,

      preAction: async (ctx) => {
        // Ensure Version History modal is open with both versions
        ensureCatalogTab(ctx);
        await ensureDemoEntry();
        selectCatalogEntryByName(DEMO_ENTRY_NAME);
        // Guard: ensure v2 exists (user may have skipped step 2)
        await ensureSecondVersionSeeded();
        if (!document.querySelector(CAT.VERSION_HISTORY_MODAL)) {
          await openVersionHistoryModal(ctx);
        }
      },

      action: async (ctx) => {
        // Check both version checkboxes
        const checkboxes = document.querySelectorAll<HTMLInputElement>(
          `${CAT.VERSION_LIST} input[type="checkbox"]`,
        );
        checkboxes.forEach(cb => {
          if (!cb.checked) cb.click();
        });
        await ctx.delay(800);

        // Spotlight the Compare button
        await spotlight(ctx, CAT.VERSION_COMPARE_BTN, 900);

        // Click Compare
        const compareBtn = document.querySelector<HTMLElement>(CAT.VERSION_COMPARE_BTN);
        if (compareBtn) {
          compareBtn.click();
        }
        await ctx.delay(1200);

        // Spotlight the diff summary badges (+ added, − removed, ~ changed)
        const diffSummary = document.querySelector<HTMLElement>(CAT.VERSION_DIFF_SUMMARY);
        if (diffSummary) {
          await spotlightEl(ctx, diffSummary, 1200);
        }

        // Spotlight the full diff panel — added/changed/removed sections
        const diffPanel = document.querySelector<HTMLElement>(CAT.VERSION_DIFF);
        if (diffPanel) {
          diffPanel.scrollIntoView({ block: 'nearest' });
          await spotlightEl(ctx, diffPanel, 1800);
        }
      },
    },

    // ── Step 5: Restore a Previous Version ──────────────────────
    {
      id: 'cat4-restore',
      title: 'Restore a Previous Version',
      description:
        'Each version in the history has a **Restore** button. Click it on the original ' +
        'version (v1.0.0) — a confirmation dialog appears.\n\n' +
        'After restoring, the **original version becomes CURRENT** again. Close the history ' +
        'modal and check the Overview: the endpoint count and format badge reflect the ' +
        'restored version. The updated version (v2.0.0) **remains in history** for future ' +
        'reference — nothing is deleted, just the active pointer moves.',
      highlight: CAT.VERSION_RESTORE_BTN,

      preAction: async (ctx) => {
        ensureCatalogTab(ctx);
        await ensureDemoEntry();
        selectCatalogEntryByName(DEMO_ENTRY_NAME);
        // Guard: ensure v2 exists (user may have skipped step 2)
        await ensureSecondVersionSeeded();
        if (!document.querySelector(CAT.VERSION_HISTORY_MODAL)) {
          await openVersionHistoryModal(ctx);
        }
      },

      action: async (ctx) => {
        // Find and spotlight the Restore button on the first (original) version
        const restoreBtn = document.querySelector<HTMLElement>(CAT.VERSION_RESTORE_BTN);
        if (restoreBtn) {
          restoreBtn.scrollIntoView({ block: 'nearest' });
          await spotlightEl(ctx, restoreBtn, 1100);

          // Click Restore
          restoreBtn.click();
          await ctx.delay(1200);

          // Spotlight the confirmation/result — original is now CURRENT
          const currentBadge = document.querySelector<HTMLElement>('.cat-version-current');
          if (currentBadge) {
            await spotlightEl(ctx, currentBadge, 1200);
          }
        }

        // Close the history modal
        await ctx.delay(600);
        closeVersionHistoryIfOpen();
        await ctx.delay(800);

        // Spotlight the Overview showing restored version's endpoint count and format
        await ensureCatalogOverviewView(ctx);
        await ctx.delay(600);

        const formatBadge = document.querySelector<HTMLElement>(CAT.OVERVIEW_SPEC_FORMAT);
        if (formatBadge) {
          await spotlightEl(ctx, formatBadge, 1200);
        }

        const overview = document.querySelector<HTMLElement>(CAT.OVERVIEW);
        if (overview) {
          await spotlightEl(ctx, overview, 1000);
        }
      },
      verify: CAT.OVERVIEW,
    },
  ],
};
