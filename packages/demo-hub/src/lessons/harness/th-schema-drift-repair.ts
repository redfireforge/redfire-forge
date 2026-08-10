/**
 * TH-19: Schema Drift & Repair
 *
 * 6 steps: Drift Banner → Schema Diff Modal → Repair Suggestions →
 * Accept & Update → Fix Validation & Repair (Replace) → Health Dashboard.
 *
 * Demonstrates how the Data Mapper detects when the API response
 * schema changes, classifies severity, suggests repairs, and tracks
 * mapping quality.
 */
import type { DemoLesson, DemoActionContext } from '../../types';
import { HAR } from '@shared/selectors';
import {
  spotlight,
  seedDemoEnvAndService,
  deleteTh19DemoFg,
  seedTh19FeatureGroup,
  ensureTh19FgExists,
  injectTh19OldSnapshot,
  expandFirstFg,
  expandFirstScenario,
  isTestEditorOpen,
  closeTestEditorQuiet,
  closeInlineNameFormQuiet,
  closeDataMapperModal,
  isDataMapperOpen,
  clickValidationTab,
  closeDiffModal,
  isDiffModalOpen,
  isDriftBannerVisible,
  waitForDriftBanner,
} from './th-demo-helpers';

/* ── local helpers ──────────────────────────────────────────── */

async function ensureTh19Ready(ctx: DemoActionContext): Promise<void> {
  await ensureTh19FgExists(ctx);
  if (!document.querySelector(HAR.FG_CARD)) {
    ctx.navigateToTab('scenarios');
    await ctx.delay(500);
  }
  await expandFirstFg(ctx);
  await expandFirstScenario(ctx);
}

async function openTh19TestEditor(ctx: DemoActionContext): Promise<void> {
  if (isTestEditorOpen()) return;
  await expandFirstFg(ctx);
  await expandFirstScenario(ctx);
  await ctx.delay(300);
  const editBtn = document.querySelector<HTMLElement>(HAR.TEST_EDIT_BTN);
  if (editBtn) {
    editBtn.click();
    await ctx.delay(600);
  }
}

async function ensureEditorOnValidation(ctx: DemoActionContext): Promise<void> {
  if (!isTestEditorOpen()) {
    await openTh19TestEditor(ctx);
    await ctx.waitFor(HAR.TE_PROP_CARD, 5000);
    await ctx.delay(400);
  }
  await clickValidationTab(ctx);
}

async function ensureMapperOpen(ctx: DemoActionContext): Promise<void> {
  if (isDataMapperOpen()) return;
  await ensureEditorOnValidation(ctx);
  const mapperBtn = document.querySelector<HTMLElement>(HAR.TE_MAPPER_BTN);
  if (mapperBtn && !mapperBtn.hasAttribute('disabled')) {
    mapperBtn.click();
    await ctx.delay(1200);
  }
}

/**
 * Open the Data Mapper with a stale schema snapshot so the Drift Banner is
 * visible. Re-injects + reopens once if detection hasn't fired yet.
 */
async function ensureMapperWithDrift(ctx: DemoActionContext): Promise<void> {
  closeDiffModal();
  if (isDataMapperOpen() && isDriftBannerVisible()) return;

  if (isDataMapperOpen()) {
    closeDataMapperModal();
    await ctx.delay(400);
  }

  injectTh19OldSnapshot();
  await ensureMapperOpen(ctx);
  if (await waitForDriftBanner(ctx, 2500)) return;

  closeDataMapperModal();
  await ctx.delay(400);
  injectTh19OldSnapshot();
  await ensureMapperOpen(ctx);
  await waitForDriftBanner(ctx, 2500);
}

/* ── lesson definition ──────────────────────────────────────── */

export const thSchemaDriftRepairLesson: DemoLesson = {
  id: 'th-schema-drift-repair',
  domainId: 'harness',
  category: 'validation',
  name: 'Schema Drift & Repair',
  description:
    'See how the Data Mapper detects API schema changes, classifies drift severity, ' +
    'suggests repairs for broken mappings, and tracks quality via the Health Dashboard.',
  estimatedMinutes: 9,
  initialTab: 'scenarios',
  allowedTabs: ['scenarios'],

  concept: {
    title: 'Schema Drift Detection',
    body:
      'APIs evolve — fields get added, removed, renamed, or change type. The Data Mapper ' +
      'detects these changes automatically by comparing a saved **schema snapshot** against ' +
      'the current response.\n\n' +
      '**Drift types:**\n' +
      '- **Added** (info) — new field in the response\n' +
      '- **Removed** (breaking) — field disappeared, mappings may break\n' +
      '- **Type Changed** (warning) — field exists but type differs\n' +
      '- **Nullable Changed** (info) — field nullability changed\n\n' +
      '**Repair engine:** For removed fields, fuzzy name matching (Levenshtein distance) ' +
      'suggests similarly-named new fields as replacements.\n\n' +
      '**Accept vs Repair:** Accept & Update only refreshes the snapshot baseline. Broken mappings ' +
      'stay until you **Replace**/remap them (or Apply from Schema Diff) — watch **Validation & Repair**.\n\n' +
      '**Health Dashboard:** Continuous quality score showing coverage, broken mappings, ' +
      'drift warnings, and type mismatches.',
    keyTerms: [
      { term: 'Schema Snapshot', definition: 'Saved response structure — the baseline for drift comparison.' },
      { term: 'Drift Detection', definition: 'Automatic comparison between saved snapshot and current response.' },
      { term: 'Repair Suggestion', definition: 'Fuzzy match recommendation for fixing broken mappings.' },
      { term: 'Validation & Repair', definition: 'Panel listing broken mappings that remain after Accept until you Replace/remap them.' },
      { term: 'Health Dashboard', definition: 'Quality metrics bar: coverage, broken, drift, type mismatches.' },
    ],
    diagram: `<svg viewBox="0 0 360 80" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="5" width="80" height="70" rx="5" fill="#1e293b" stroke="#3b82f6" stroke-width="1.5"/>
      <text x="45" y="20" text-anchor="middle" fill="#3b82f6" font-size="7" font-weight="700">Old Snapshot</text>
      <text x="45" y="34" text-anchor="middle" fill="#94a3b8" font-size="5">$.userName</text>
      <text x="45" y="46" text-anchor="middle" fill="#94a3b8" font-size="5">$.age: string</text>
      <text x="45" y="58" text-anchor="middle" fill="#ef4444" font-size="5">7 fields</text>
      <path d="M90 40 L120 40" stroke="#64748b" stroke-width="1.2" marker-end="url(#th19arr)"/>
      <rect x="125" y="5" width="100" height="70" rx="5" fill="#1e293b" stroke="#f59e0b" stroke-width="1.5"/>
      <text x="175" y="20" text-anchor="middle" fill="#f59e0b" font-size="7" font-weight="700">Drift Detection</text>
      <text x="175" y="34" text-anchor="middle" fill="#a6e3a1" font-size="5">+ metadata.version</text>
      <text x="175" y="46" text-anchor="middle" fill="#eb6f92" font-size="5">− userName</text>
      <text x="175" y="58" text-anchor="middle" fill="#f5a623" font-size="5">≠ age: string→number</text>
      <path d="M230 40 L260 40" stroke="#64748b" stroke-width="1.2" marker-end="url(#th19arr)"/>
      <rect x="265" y="5" width="90" height="70" rx="5" fill="#1e293b" stroke="#10b981" stroke-width="1.5"/>
      <text x="310" y="20" text-anchor="middle" fill="#10b981" font-size="7" font-weight="700">Repair</text>
      <text x="310" y="36" text-anchor="middle" fill="#94a3b8" font-size="5">userName →</text>
      <text x="310" y="48" text-anchor="middle" fill="#94a3b8" font-size="5">user_name</text>
      <text x="310" y="62" text-anchor="middle" fill="#94a3b8" font-size="5">(distance: 1)</text>
      <defs><marker id="th19arr" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill="#64748b"/></marker></defs>
    </svg>`,
  },

  // ── Setup ────────────────────────────────────────────────────
  setup: async (ctx) => {
    ctx.navigateToTab('scenarios');
    await ctx.delay(300);
    deleteTh19DemoFg();
    closeInlineNameFormQuiet();
    if (isDataMapperOpen()) closeDataMapperModal();
    await closeTestEditorQuiet(ctx);
    await ctx.delay(200);
    await seedDemoEnvAndService(ctx);
    await seedTh19FeatureGroup(ctx);
    injectTh19OldSnapshot();
    await ctx.delay(300);
    await expandFirstFg(ctx);
    await expandFirstScenario(ctx);
  },

  // ── Cleanup ──────────────────────────────────────────────────
  cleanup: async (ctx) => {
    closeDiffModal();
    if (isDataMapperOpen()) closeDataMapperModal();
    await ctx.delay(200);
    await closeTestEditorQuiet(ctx);
    closeInlineNameFormQuiet();
    deleteTh19DemoFg();
    delete (window as unknown as Record<string, unknown>).__demoTh19Ids;
    await ctx.delay(200);
  },

  steps: [
    // ── Step 1: Schema Drift Detection ────────────────────────────
    {
      id: 'th19-drift-banner',
      title: 'Schema Drift Detection',
      description:
        'Open the Data Mapper and notice the **Drift Banner** at the top — the Data Mapper ' +
        'saves a schema snapshot every time you click Done. When the API response changes ' +
        'shape, it detects the differences automatically.\n\n' +
        'The banner shows:\n' +
        '- Whether changes are **breaking** (⛔ red — removed fields with active mappings) ' +
        'or **non-breaking** (⚠ amber — type changes, new fields)\n' +
        '- A count of changes: added, removed, type changed\n' +
        '- Three actions: **Show Diff**, **Accept & Update**, or dismiss',
      highlight: HAR.DRIFT_BANNER,

      preAction: async (ctx) => {
        await ensureTh19Ready(ctx);
        await ensureMapperWithDrift(ctx);
      },

      action: async (ctx) => {
        // Belt for rapid Next — detection can finish after preAction.
        if (!isDriftBannerVisible()) {
          await ensureMapperWithDrift(ctx);
        }

        const banner = document.querySelector<HTMLElement>(HAR.DRIFT_BANNER);
        if (!banner) return;

        banner.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        await spotlight(banner, 2500, ctx);
        await ctx.delay(600);

        const title = banner.querySelector<HTMLElement>('.dm-drift-banner-title');
        if (title) {
          await spotlight(title, 1800, ctx);
          await ctx.delay(500);
        }

        const detail = banner.querySelector<HTMLElement>('.dm-drift-banner-detail');
        if (detail) {
          await spotlight(detail, 1800, ctx);
          await ctx.delay(500);
        }

        const breakingItems = banner.querySelectorAll<HTMLElement>('.dm-drift-item--breaking');
        for (const item of Array.from(breakingItems).slice(0, 2)) {
          await spotlight(item, 1600, ctx);
          await ctx.delay(400);
        }

        const actions = banner.querySelector<HTMLElement>('.dm-drift-banner-actions');
        if (actions) {
          await spotlight(actions, 2000, ctx);
          await ctx.delay(600);
        }
      },

      verify: HAR.DRIFT_BANNER,
    },

    // ── Step 2: Schema Diff Modal ─────────────────────────────────
    {
      id: 'th19-diff-modal',
      title: 'Schema Diff Modal',
      description:
        'Click **Show Diff** to see every schema change in a tabular view. Each row shows:\n\n' +
        '- **Severity** — 🔴 Breaking (removed field with affected mappings), 🟡 Warning ' +
        '(type changed), 🟢 Info (added field)\n' +
        '- **Field Path** — the JSON path that changed\n' +
        '- **Change Type** — added (+), removed (−), type changed (≠), nullable (~)\n' +
        '- **Saved vs Current Type** — what the field type was before and after\n' +
        '- **Affected Mappings** — how many mappings reference this field\n' +
        '- **Repair** — suggestions for fixing broken mappings',
      highlight: HAR.DRIFT_DIFF_BTN,

      preAction: async (ctx) => {
        await ensureTh19Ready(ctx);
        closeDiffModal();
        await ensureMapperWithDrift(ctx);
      },

      action: async (ctx) => {
        if (!isDriftBannerVisible()) {
          await ensureMapperWithDrift(ctx);
        }

        // Viewer must SEE the Show Diff click — never hide it in preAction.
        const diffBtn = document.querySelector<HTMLElement>(HAR.DRIFT_DIFF_BTN);
        if (diffBtn && !isDiffModalOpen()) {
          diffBtn.scrollIntoView({ block: 'nearest', inline: 'nearest' });
          await spotlight(diffBtn, 2200, ctx);
          await ctx.delay(500);
          await ctx.click(HAR.DRIFT_DIFF_BTN);
          await ctx.waitFor(HAR.DIFF_SHELL, 5000);
          await ctx.delay(1400);
        }

        const modal = document.querySelector<HTMLElement>(HAR.DIFF_SHELL);
        if (!modal) return;

        await spotlight(modal, 1800, ctx);
        await ctx.delay(600);

        const summaryBadges = modal.querySelector<HTMLElement>('.dm-diff-summary-badges');
        if (summaryBadges) {
          await spotlight(summaryBadges, 2000, ctx);
          await ctx.delay(600);
        }

        // Spotlight only actionable severities — breaking + warning.
        // Info rows (added fields) are summarized by the badge; walking each is noisy.
        const table = modal.querySelector<HTMLElement>(HAR.DIFF_TABLE);
        if (table) {
          const focusRows = Array.from(table.querySelectorAll<HTMLElement>('tbody tr')).filter(
            (row) =>
              row.classList.contains('dm-diff-row--breaking')
              || row.classList.contains('dm-diff-row--warning'),
          );
          for (const row of focusRows) {
            row.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            await spotlight(row, 1800, ctx);
            await ctx.delay(500);
          }
        }

        const affected = modal.querySelectorAll<HTMLElement>(HAR.DIFF_AFFECTED);
        if (affected.length > 0) {
          await spotlight(affected[0], 1600, ctx);
          await ctx.delay(600);
        }
      },

      verify: HAR.DIFF_SHELL,
    },

    // ── Step 3: Repair Suggestions ────────────────────────────────
    {
      id: 'th19-repair',
      title: 'Repair Suggestions',
      description:
        'The **Repair** column shows suggestions for fixing broken mappings. For removed fields, ' +
        'the engine uses **Levenshtein fuzzy name matching** to find similarly-named new fields.\n\n' +
        'For example, if `$.userName` was removed and `$.user_name` was added, the repair ' +
        'engine suggests the new path with a confidence score (high/medium/low) based on edit ' +
        'distance.\n\n' +
        'Click **Apply** on individual suggestions, or use **Apply all repairs** to batch-fix ' +
        'all recoverable mappings at once.\n\n' +
        'We\'ll look at the suggestions here — after Accept & Update we\'ll fix the leftover ' +
        '`userName` issue from **Validation & Repair** with **Replace** (pick `user_name` on both trees).',
      highlight: HAR.DIFF_SHELL,

      preAction: async (ctx) => {
        await ensureTh19Ready(ctx);
        await ensureMapperWithDrift(ctx);
        // Quiet recovery only — if modal already open, leave it; otherwise open without tour.
        if (!isDiffModalOpen()) {
          const diffBtn = document.querySelector<HTMLElement>(HAR.DRIFT_DIFF_BTN);
          if (diffBtn) {
            diffBtn.click();
            await ctx.waitFor(HAR.DIFF_SHELL, 4000);
            await ctx.delay(600);
          }
        }
      },

      action: async (ctx) => {
        if (!isDiffModalOpen()) {
          const diffBtn = document.querySelector<HTMLElement>(HAR.DRIFT_DIFF_BTN);
          if (diffBtn) {
            await spotlight(diffBtn, 1500, ctx);
            await ctx.delay(400);
            await ctx.click(HAR.DRIFT_DIFF_BTN);
            await ctx.waitFor(HAR.DIFF_SHELL, 5000);
            await ctx.delay(1000);
          }
        }

        const modal = document.querySelector<HTMLElement>(HAR.DIFF_SHELL);
        if (!modal) return;

        await spotlight(modal, 1500, ctx);
        await ctx.delay(500);

        const repairCells = modal.querySelectorAll<HTMLElement>(HAR.DIFF_REPAIR_CELL);
        let shown = 0;
        for (const cell of repairCells) {
          const repairBtn = cell.querySelector<HTMLElement>(HAR.REPAIR_BTN);
          if (!repairBtn) continue;
          cell.scrollIntoView({ block: 'nearest', inline: 'nearest' });
          await spotlight(cell, 2200, ctx);
          await ctx.delay(600);
          shown += 1;
          if (shown >= 2) break;
        }

        const batchBtn = modal.querySelector<HTMLElement>(HAR.REPAIR_BATCH);
        if (batchBtn) {
          await spotlight(batchBtn, 2000, ctx);
          await ctx.delay(800);
        }

        // Show only — Apply happens in step 5 after Accept & Update.
        await ctx.delay(1000);
        closeDiffModal();
        await ctx.delay(900);
      },

      verify: HAR.DRIFT_BANNER,
    },

    // ── Step 4: Accept & Update Snapshot ──────────────────────────
    {
      id: 'th19-accept-update',
      title: 'Accept & Update Snapshot',
      description:
        'Click **Accept & Update** to review the schema changes, then confirm in the ' +
        'Schema Diff footer. That saves the current response schema as the new baseline.\n\n' +
        '**Important:** Accept & Update only refreshes the snapshot — it does **not** rewrite ' +
        'mappings. After accept, the drift banner dismisses, but **Validation & Repair** still ' +
        'flags broken paths like `$.userName` (the live schema has `user_name`).\n\n' +
        'Next we\'ll **Replace** that broken mapping with `user_name` — without closing the mapper.',
      highlight: HAR.DRIFT_ACCEPT_BTN,

      preAction: async (ctx) => {
        await ensureTh19Ready(ctx);
        closeDiffModal();
        await ensureMapperWithDrift(ctx);
      },

      action: async (ctx) => {
        if (!isDriftBannerVisible()) {
          await ensureMapperWithDrift(ctx);
        }

        const banner = document.querySelector<HTMLElement>(HAR.DRIFT_BANNER);
        if (banner) {
          await spotlight(banner, 1800, ctx);
          await ctx.delay(500);
        }

        const acceptBtn = document.querySelector<HTMLElement>(HAR.DRIFT_ACCEPT_BTN);
        if (acceptBtn) {
          await spotlight(acceptBtn, 2200, ctx);
          await ctx.delay(600);
          // Banner Accept opens Schema Diff in acceptMode; confirm in the footer.
          await ctx.click(HAR.DRIFT_ACCEPT_BTN);
          await ctx.waitFor(HAR.DIFF_SHELL, 5000);
          await ctx.delay(1000);

          const modal = document.querySelector<HTMLElement>(HAR.DIFF_SHELL);
          if (modal) {
            await spotlight(modal, 1600, ctx);
            await ctx.delay(500);
            const confirmBtn = Array.from(
              modal.querySelectorAll<HTMLElement>('.dm-diff-footer button'),
            ).find((btn) => /Accept/.test(btn.textContent ?? ''));
            if (confirmBtn) {
              await spotlight(confirmBtn, 1800, ctx);
              await ctx.delay(400);
              confirmBtn.click();
              await ctx.delay(1200);
            }
          }
        }

        // Banner gone, but Validation & Repair still flags $.userName — that is the teaching point.
        if (!isDriftBannerVisible()) {
          const repairPanel = document.querySelector<HTMLElement>(HAR.VALIDATION_REPAIR_PANEL);
          if (repairPanel) {
            repairPanel.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            await spotlight(repairPanel, 2200, ctx);
            await ctx.delay(1000);
          } else {
            const toolbar = document.querySelector<HTMLElement>(HAR.MAPPER_TOOLBAR);
            if (toolbar) {
              await spotlight(toolbar, 1600, ctx);
              await ctx.delay(700);
            }
          }
        }
      },

      verify: HAR.VALIDATION_REPAIR_PANEL,
    },

    // ── Step 5: Fix Validation & Repair (Replace remap) ───────────
    {
      id: 'th19-apply-validation-repair',
      title: 'Fix Validation & Repair',
      description:
        '**Validation & Repair** still lists the unresolved `$.userName` mapping — Accept & Update ' +
        'only saved the new baseline; it did **not** remap the field.\n\n' +
        'Stay in the mapper (no close/reopen). Click the live **`user_name`** field on **Source**, ' +
        'then on **Target**, and press **Replace** on the issue row. That remaps ' +
        '`userName` → `user_name`. Watch the Validation & Repair panel disappear.',
      highlight: HAR.VALIDATION_REPAIR_PANEL,

      preAction: async (ctx) => {
        await ensureTh19Ready(ctx);
        closeDiffModal();
        // Never close/reopen the mapper here — just recover if the user skipped earlier steps.
        if (!isDataMapperOpen()) {
          await ensureMapperOpen(ctx);
          await ctx.delay(600);
        }
        if (!document.querySelector(HAR.VALIDATION_REPAIR_PANEL) && isDriftBannerVisible()) {
          const acceptBtn = document.querySelector<HTMLElement>(HAR.DRIFT_ACCEPT_BTN);
          if (acceptBtn) {
            acceptBtn.click();
            await ctx.waitFor(HAR.DIFF_SHELL, 4000);
            const modal = document.querySelector<HTMLElement>(HAR.DIFF_SHELL);
            const confirmBtn = modal
              ? Array.from(modal.querySelectorAll<HTMLElement>('.dm-diff-footer button')).find((btn) =>
                /Accept/.test(btn.textContent ?? ''),
              )
              : undefined;
            confirmBtn?.click();
            await ctx.delay(800);
          }
        }
        if (!document.querySelector(HAR.VALIDATION_REPAIR_PANEL) && !isDriftBannerVisible()) {
          // Last resort for Restart mid-lesson: seed drift + accept quietly (still no flash tour).
          await ensureMapperWithDrift(ctx);
          const acceptBtn = document.querySelector<HTMLElement>(HAR.DRIFT_ACCEPT_BTN);
          if (acceptBtn) {
            acceptBtn.click();
            await ctx.waitFor(HAR.DIFF_SHELL, 4000);
            const modal = document.querySelector<HTMLElement>(HAR.DIFF_SHELL);
            const confirmBtn = modal
              ? Array.from(modal.querySelectorAll<HTMLElement>('.dm-diff-footer button')).find((btn) =>
                /Accept/.test(btn.textContent ?? ''),
              )
              : undefined;
            confirmBtn?.click();
            await ctx.delay(800);
          }
        }
      },

      action: async (ctx) => {
        if (!isDataMapperOpen()) {
          await ensureMapperOpen(ctx);
          await ctx.delay(800);
        }
        closeDiffModal();

        // 1) Spotlight the leftover Validation & Repair issue.
        const repairPanel = document.querySelector<HTMLElement>(HAR.VALIDATION_REPAIR_PANEL);
        if (repairPanel) {
          repairPanel.scrollIntoView({ block: 'nearest', inline: 'nearest' });
          await spotlight(repairPanel, 2200, ctx);
          await ctx.delay(800);

          const row = repairPanel.querySelector<HTMLElement>(HAR.VALIDATION_REPAIR_ROW);
          if (row) {
            await spotlight(row, 1800, ctx);
            await ctx.delay(700);
          }
        }

        // 2) Pick the renamed live fields — no mapper close/reopen.
        const clickTreePath = async (panel: 'source' | 'target', path: string) => {
          const node = document.querySelector<HTMLElement>(
            `.dm-panel--${panel} .dm-tree-node[data-path="${path}"]`,
          );
          if (!node) return false;
          node.scrollIntoView({ block: 'nearest', inline: 'nearest' });
          await spotlight(node, 1400, ctx);
          node.click();
          await ctx.delay(700);
          return true;
        };

        await clickTreePath('source', 'user_name');
        await clickTreePath('target', 'user_name');

        // 3) Replace remaps the broken userName mapping onto the selection.
        const replaceBtn = Array.from(
          document.querySelectorAll<HTMLElement>(`${HAR.VALIDATION_REPAIR_PANEL} button`),
        ).find((btn) => btn.textContent?.trim() === 'Replace');
        if (replaceBtn) {
          await spotlight(replaceBtn, 1800, ctx);
          await ctx.delay(500);
          replaceBtn.click();
          await ctx.delay(1400);
        }

        // 4) Payoff — Validation & Repair should be gone; pause on Health.
        await ctx.delay(600);
        if (!document.querySelector(HAR.VALIDATION_REPAIR_PANEL)) {
          const health = document.querySelector<HTMLElement>(HAR.MAPPER_HEALTH);
          if (health) {
            await spotlight(health, 1800, ctx);
            await ctx.delay(900);
          } else {
            const toolbar = document.querySelector<HTMLElement>(HAR.MAPPER_TOOLBAR);
            if (toolbar) {
              await spotlight(toolbar, 1600, ctx);
              await ctx.delay(800);
            }
          }
        }
      },

      verify: HAR.MAPPER_HEALTH,
    },

    // ── Step 6: Mapping Health Dashboard ──────────────────────────
    {
      id: 'th19-health-dashboard',
      title: 'Mapping Health Dashboard',
      description:
        'The **Health Dashboard** bar sits below the toolbar and provides a continuous ' +
        'quality score for your validation mappings.\n\n' +
        'Five metrics at a glance:\n' +
        '- **Status** — Healthy (green), Warnings (amber), or Broken (red)\n' +
        '- **Coverage** — percentage of response fields covered by mappings\n' +
        '- **Broken** — mappings referencing non-existent paths (clickable → opens diff)\n' +
        '- **Drift** — schema change warnings since last snapshot (clickable → opens diff)\n' +
        '- **Type mismatches** — source/target type conflicts\n\n' +
        'After applying repairs, Broken and Drift should be clear. Aim for high coverage and ' +
        'a Healthy status for reliable test results.',
      highlight: HAR.MAPPER_HEALTH,

      preAction: async (ctx) => {
        await ensureTh19Ready(ctx);
        closeDiffModal();
        if (!isDataMapperOpen()) {
          await ensureMapperOpen(ctx);
          await ctx.delay(600);
        }
      },

      action: async (ctx) => {
        if (!isDataMapperOpen()) {
          await ensureMapperOpen(ctx);
          await ctx.delay(800);
        }

        const health = document.querySelector<HTMLElement>(HAR.MAPPER_HEALTH);
        if (!health) return;

        health.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        await spotlight(health, 2500, ctx);
        await ctx.delay(700);

        const status = health.querySelector<HTMLElement>('.dm-health-status');
        if (status) {
          await spotlight(status, 1600, ctx);
          await ctx.delay(500);
        }

        const metrics = health.querySelectorAll<HTMLElement>('.dm-health-metric');
        for (const metric of Array.from(metrics).slice(0, 4)) {
          await spotlight(metric, 1400, ctx);
          await ctx.delay(400);
        }

        const clickableMetrics = health.querySelectorAll<HTMLElement>(
          '.dm-health-metric--critical, .dm-health-metric--warning',
        );
        if (clickableMetrics.length > 0) {
          await spotlight(clickableMetrics[0], 1800, ctx);
          await ctx.delay(700);
        }
      },

      verify: HAR.MAPPER_HEALTH,
    },
  ],
};
