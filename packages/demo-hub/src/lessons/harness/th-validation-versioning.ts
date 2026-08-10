/**
 * TH-12: Validation Versioning
 *
 * Track validation changes with Response Versions and Rules Versions —
 * save snapshots, preview, compare side-by-side, and restore.
 */
import type { DemoLesson, DemoActionContext } from '../../types';
import { HAR } from '@shared/selectors';
import {
  seedDemoEnvAndService,
  seedTh12FeatureGroup,
  deleteTh12DemoFg,
  ensureTh12FgExists,
  expandFirstFg,
  expandFirstScenario,
  spotlight,
  isTestEditorOpen,
  closeTestEditorQuiet,
  clickValidationTab,
  clickVersionRowAction,
  closeVersionPreviewModal,
  closeVersionDiffModal,
} from './th-demo-helpers';

/* ── local helpers ──────────────────────────────────────────── */

async function ensureTh12Ready(ctx: DemoActionContext): Promise<void> {
  await ensureTh12FgExists(ctx);
  if (!document.querySelector(HAR.FG_CARD)) {
    ctx.navigateToTab('scenarios');
    await ctx.delay(500);
  }
  await expandFirstFg(ctx);
}

async function ensureEditorOnValidation(ctx: DemoActionContext): Promise<void> {
  if (!isTestEditorOpen()) {
    await expandFirstFg(ctx);
    await expandFirstScenario(ctx);
    await ctx.delay(300);
    const editBtn = document.querySelector<HTMLElement>(HAR.TEST_EDIT_BTN);
    if (editBtn) {
      editBtn.click();
      await ctx.delay(700);
    }
  }
  await clickValidationTab(ctx);
}

/** Scroll the version panel into view within the editor body. */
function scrollToPanel(sel: string): void {
  const panel = document.querySelector<HTMLElement>(sel);
  if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/** Ensure the version panel is expanded (not collapsed). */
function ensurePanelExpanded(sel: string): void {
  const panel = document.querySelector<HTMLElement>(sel);
  if (!panel) return;
  const toggle = panel.querySelector<HTMLElement>('.version-collapse-toggle');
  if (toggle && toggle.getAttribute('aria-expanded') === 'false') {
    toggle.click();
  }
}

/** Click the "Compare" button within a version panel section. */
function clickCompareButton(panelSel: string): boolean {
  const panel = document.querySelector<HTMLElement>(panelSel);
  if (!panel) return false;
  const actions = panel.querySelector<HTMLElement>('.version-panel-actions');
  if (!actions) return false;
  const btns = actions.querySelectorAll<HTMLElement>('.btn.btn-sm');
  for (const btn of btns) {
    if (btn.textContent?.trim() === 'Compare') {
      btn.click();
      return true;
    }
  }
  return false;
}

/* ── lesson definition ──────────────────────────────────────── */

export const thValidationVersioningLesson: DemoLesson = {
  id: 'th-validation-versioning',
  domainId: 'harness',
  category: 'validation',
  name: 'Validation Versioning',
  description:
    'Track validation changes over time — save response and rules snapshots, ' +
    'preview historical states, compare versions side by side, and restore previous configurations.',
  estimatedMinutes: 6,
  initialTab: 'scenarios',
  allowedTabs: ['scenarios'],
  concept: {
    title: 'Response Versions & Rules Versions',
    body:
      'Validation versioning provides two independent history tracks:\n\n' +
      '- **Response Versions** — snapshot the API response body + validation settings whenever you fetch or save\n' +
      '- **Rules Versions** — snapshot your validation rules (expected fields, operators, assertions) independently\n\n' +
      'Each version can be **previewed**, **compared** side-by-side, or **restored** to roll back changes.',
    keyTerms: [
      { term: 'Response Version', definition: 'Snapshot of the API response body and validation settings.' },
      { term: 'Rules Version', definition: 'Snapshot of validation rules, operators, and assertions.' },
      { term: 'Version Diff', definition: 'Side-by-side comparison highlighting added, removed, and changed lines.' },
    ],
    diagram: `<svg viewBox="0 0 380 80" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="5" width="80" height="70" rx="5" fill="#1e293b" stroke="#3b82f6" stroke-width="1.5"/>
      <text x="45" y="22" text-anchor="middle" fill="#3b82f6" font-size="7" font-weight="700">Response</text>
      <text x="45" y="36" text-anchor="middle" fill="#94a3b8" font-size="5.5">v1 (initial)</text>
      <text x="45" y="48" text-anchor="middle" fill="#94a3b8" font-size="5.5">v2 (updated)</text>
      <text x="45" y="60" text-anchor="middle" fill="#94a3b8" font-size="5.5">v3 (current)</text>
      <rect x="105" y="5" width="80" height="70" rx="5" fill="#1e293b" stroke="#f59e0b" stroke-width="1.5"/>
      <text x="145" y="22" text-anchor="middle" fill="#f59e0b" font-size="7" font-weight="700">Rules</text>
      <text x="145" y="36" text-anchor="middle" fill="#94a3b8" font-size="5.5">v1 (3 rules)</text>
      <text x="145" y="48" text-anchor="middle" fill="#94a3b8" font-size="5.5">v2 (5 rules)</text>
      <text x="145" y="60" text-anchor="middle" fill="#94a3b8" font-size="5.5">v3 (current)</text>
      <path d="M190 30 L230 30" stroke="#64748b" stroke-width="1.2" marker-end="url(#th12arr)"/>
      <path d="M190 55 L230 55" stroke="#64748b" stroke-width="1.2" marker-end="url(#th12arr)"/>
      <rect x="235" y="5" width="65" height="30" rx="4" fill="#1e293b" stroke="#a855f7" stroke-width="1.2"/>
      <text x="267" y="24" text-anchor="middle" fill="#a855f7" font-size="6.5" font-weight="600">Preview</text>
      <rect x="235" y="45" width="65" height="30" rx="4" fill="#1e293b" stroke="#10b981" stroke-width="1.2"/>
      <text x="267" y="64" text-anchor="middle" fill="#10b981" font-size="6.5" font-weight="600">Compare</text>
      <path d="M305 20 L330 20" stroke="#64748b" stroke-width="1" marker-end="url(#th12arr)"/>
      <path d="M305 60 L330 60" stroke="#64748b" stroke-width="1" marker-end="url(#th12arr)"/>
      <rect x="335" y="5" width="40" height="30" rx="4" fill="#1e293b" stroke="#ef4444" stroke-width="1.2"/>
      <text x="355" y="24" text-anchor="middle" fill="#ef4444" font-size="6" font-weight="600">Restore</text>
      <rect x="335" y="45" width="40" height="30" rx="4" fill="#1e293b" stroke="#3b82f6" stroke-width="1.2"/>
      <text x="355" y="64" text-anchor="middle" fill="#3b82f6" font-size="6" font-weight="600">Diff</text>
      <defs><marker id="th12arr" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill="#64748b"/></marker></defs>
    </svg>`,
  },

  setup: async (ctx) => {
    deleteTh12DemoFg();
    await ctx.delay(200);
    await seedDemoEnvAndService(ctx);
    await seedTh12FeatureGroup(ctx);
    await ctx.delay(300);
    ctx.navigateToTab('scenarios');
    await ctx.delay(500);
    await expandFirstFg(ctx);
  },

  cleanup: async (ctx) => {
    closeVersionPreviewModal();
    closeVersionDiffModal();
    await ctx.delay(200);
    if (isTestEditorOpen()) await closeTestEditorQuiet(ctx);
    await ctx.delay(100);
    deleteTh12DemoFg();
    await ctx.delay(200);
  },

  steps: [
    // ── Step 1: Response Versions ────────────────────────────────
    {
      id: 'th12-response-versions',
      title: 'Response Versions',
      description:
        'The **Response Versions** panel at the bottom of the Validation tab tracks every snapshot ' +
        'of the API response. Each version stores the response body plus the validation mode and ' +
        'settings at the time it was saved. The latest matching version shows a green **current** pill.',
      highlight: HAR.RESP_VERSION_PANEL,
      action: async (ctx) => {
        scrollToPanel(HAR.RESP_VERSION_PANEL);
        await ctx.delay(500);
        ensurePanelExpanded(HAR.RESP_VERSION_PANEL);
        await ctx.delay(300);

        const items = document.querySelectorAll<HTMLElement>(`${HAR.RESP_VERSION_PANEL} .version-item`);
        if (items.length > 0) {
          await spotlight(items[0], 800, ctx);
        }
        if (items.length > 1) {
          await spotlight(items[items.length - 1], 800, ctx);
        }

        const currentTag = document.querySelector<HTMLElement>(`${HAR.RESP_VERSION_PANEL} ${HAR.VERSION_CURRENT_TAG}`);
        if (currentTag) await spotlight(currentTag, 800, ctx);
      },
      preAction: async (ctx) => {
        await ensureTh12Ready(ctx);
        closeVersionPreviewModal();
        closeVersionDiffModal();
        await ensureEditorOnValidation(ctx);
        scrollToPanel(HAR.RESP_VERSION_PANEL);
        ensurePanelExpanded(HAR.RESP_VERSION_PANEL);
      },
      verify: HAR.RESP_VERSION_PANEL,
    },

    // ── Step 2: Preview a Response Version ───────────────────────
    {
      id: 'th12-preview-response',
      title: 'Preview a Response Version',
      description:
        'Click **Preview** on an older version to see the exact response body that was captured. ' +
        'The modal shows the pretty-printed JSON with validation mode tags in the header — useful ' +
        'for debugging when the API response changes unexpectedly.',
      highlight: HAR.RESP_VERSION_PANEL,
      action: async (ctx) => {
        const items = document.querySelectorAll<HTMLElement>(`${HAR.RESP_VERSION_PANEL} .version-item`);
        const lastIdx = items.length - 1;
        if (lastIdx >= 0) {
          clickVersionRowAction(HAR.RESP_VERSION_PANEL, lastIdx, 'Preview');
          await ctx.delay(600);
        }

        const modal = document.querySelector<HTMLElement>(HAR.VERSION_PREVIEW_MODAL);
        if (modal) {
          await spotlight(modal, 1200, ctx);

          const body = modal.querySelector<HTMLElement>('.vp-body');
          if (body) await spotlight(body, 1000, ctx);
        }

        closeVersionPreviewModal();
        await ctx.delay(400);
      },
      preAction: async (ctx) => {
        await ensureTh12Ready(ctx);
        closeVersionPreviewModal();
        closeVersionDiffModal();
        await ensureEditorOnValidation(ctx);
        scrollToPanel(HAR.RESP_VERSION_PANEL);
        ensurePanelExpanded(HAR.RESP_VERSION_PANEL);
      },
      verify: HAR.RESP_VERSION_PANEL,
    },

    // ── Step 3: Compare Response Versions ────────────────────────
    {
      id: 'th12-compare-responses',
      title: 'Compare Response Versions',
      description:
        'The **Compare** button opens a side-by-side diff showing exactly how the API response ' +
        'evolved between two versions — added fields in green, removed in red, changed values highlighted. ' +
        'Switch between the **Response** and **Validation Rules** tabs to see both layers.',
      highlight: HAR.RESP_VERSION_PANEL,
      action: async (ctx) => {
        clickCompareButton(HAR.RESP_VERSION_PANEL);
        await ctx.delay(700);

        const modal = document.querySelector<HTMLElement>(HAR.VERSION_DIFF_MODAL);
        if (modal) {
          const infoBar = modal.querySelector<HTMLElement>(HAR.VERSION_DIFF_INFO);
          if (infoBar) await spotlight(infoBar, 1000, ctx);

          const viewer = modal.querySelector<HTMLElement>(HAR.VERSION_DIFF_VIEWER);
          if (viewer) await spotlight(viewer, 1500, ctx);

          const tabs = modal.querySelector<HTMLElement>(HAR.VERSION_DIFF_TABS);
          if (tabs) {
            await spotlight(tabs, 1000, ctx);
          }
        }

        closeVersionDiffModal();
        await ctx.delay(400);
      },
      preAction: async (ctx) => {
        await ensureTh12Ready(ctx);
        closeVersionPreviewModal();
        closeVersionDiffModal();
        await ensureEditorOnValidation(ctx);
        scrollToPanel(HAR.RESP_VERSION_PANEL);
        ensurePanelExpanded(HAR.RESP_VERSION_PANEL);
      },
      verify: HAR.RESP_VERSION_PANEL,
    },

    // ── Step 4: Rules Versions ───────────────────────────────────
    {
      id: 'th12-rules-versions',
      title: 'Rules Versions',
      description:
        'The **Rules Versions** panel tracks changes to your validation configuration separately ' +
        'from the response. Each version captures expected fields, operators, assertions, and mode ' +
        'settings. The badge shows a summary like `SELECTIVE · INCLUDE · 4 RULES · UNORDERED`.',
      highlight: HAR.RULES_VERSION_PANEL,
      action: async (ctx) => {
        scrollToPanel(HAR.RULES_VERSION_PANEL);
        await ctx.delay(500);
        ensurePanelExpanded(HAR.RULES_VERSION_PANEL);
        await ctx.delay(300);

        const items = document.querySelectorAll<HTMLElement>(`${HAR.RULES_VERSION_PANEL} .version-item`);
        if (items.length > 0) {
          await spotlight(items[0], 800, ctx);
        }
        if (items.length > 1) {
          const tag = items[1].querySelector<HTMLElement>(HAR.VERSION_RULES_TAG);
          if (tag) await spotlight(tag, 1000, ctx);
        }

        const saveBtn = document.querySelector<HTMLElement>(`${HAR.RULES_VERSION_PANEL} .version-panel-actions .btn-accent`);
        if (saveBtn) await spotlight(saveBtn, 800, ctx);
      },
      preAction: async (ctx) => {
        await ensureTh12Ready(ctx);
        closeVersionPreviewModal();
        closeVersionDiffModal();
        await ensureEditorOnValidation(ctx);
        scrollToPanel(HAR.RULES_VERSION_PANEL);
        ensurePanelExpanded(HAR.RULES_VERSION_PANEL);
      },
      verify: HAR.RULES_VERSION_PANEL,
    },

    // ── Step 5: Restore a Rules Version ──────────────────────────
    {
      id: 'th12-restore-rules',
      title: 'Restore a Rules Version',
      description:
        'Click **Restore** on a previous rules version to roll back your validation configuration. ' +
        'The expected fields, operators, and mode settings are replaced immediately. Use this when ' +
        'recent edits broke your validation and you want to go back to a known-good state.',
      highlight: HAR.RULES_VERSION_PANEL,
      action: async (ctx) => {
        const items = document.querySelectorAll<HTMLElement>(`${HAR.RULES_VERSION_PANEL} .version-item`);
        let restoreIdx = -1;
        for (let i = 0; i < items.length; i++) {
          if (!items[i].classList.contains('version-current')) {
            restoreIdx = i;
            break;
          }
        }

        if (restoreIdx >= 0) {
          const btns = items[restoreIdx].querySelectorAll<HTMLElement>('.version-item-actions .btn');
          for (const btn of btns) {
            if (btn.textContent?.trim() === 'Restore') {
              await spotlight(btn, 800, ctx);
              btn.click();
              break;
            }
          }
          await ctx.delay(600);
        }

        const rules = document.querySelector<HTMLElement>(HAR.TE_VALIDATION_RULES);
        if (rules) {
          scrollToPanel(HAR.TE_VALIDATION_RULES);
          await spotlight(rules, 1200, ctx);
        }

        scrollToPanel(HAR.RULES_VERSION_PANEL);
        await ctx.delay(300);
        const currentTag = document.querySelector<HTMLElement>(`${HAR.RULES_VERSION_PANEL} ${HAR.VERSION_CURRENT_TAG}`);
        if (currentTag) await spotlight(currentTag, 1000, ctx);
      },
      preAction: async (ctx) => {
        await ensureTh12Ready(ctx);
        closeVersionPreviewModal();
        closeVersionDiffModal();
        await ensureEditorOnValidation(ctx);
        scrollToPanel(HAR.RULES_VERSION_PANEL);
        ensurePanelExpanded(HAR.RULES_VERSION_PANEL);
      },
      verify: HAR.RULES_VERSION_PANEL,
    },

    // ── Step 6: Compare Rules Versions ───────────────────────────
    {
      id: 'th12-compare-rules',
      title: 'Compare Rules Versions',
      description:
        'The **Compare** button for rules versions opens a side-by-side diff showing which rules ' +
        'were added, removed, or changed between two snapshots. This is essential when refactoring ' +
        'validation — see exactly how your assertions evolved.',
      highlight: HAR.RULES_VERSION_PANEL,
      action: async (ctx) => {
        clickCompareButton(HAR.RULES_VERSION_PANEL);
        await ctx.delay(700);

        const modal = document.querySelector<HTMLElement>(HAR.VERSION_DIFF_MODAL);
        if (modal) {
          const infoBar = modal.querySelector<HTMLElement>(HAR.VERSION_DIFF_INFO);
          if (infoBar) await spotlight(infoBar, 1200, ctx);

          const viewer = modal.querySelector<HTMLElement>(HAR.VERSION_DIFF_VIEWER);
          if (viewer) await spotlight(viewer, 1500, ctx);
        }

        closeVersionDiffModal();
        await ctx.delay(400);
      },
      preAction: async (ctx) => {
        await ensureTh12Ready(ctx);
        closeVersionPreviewModal();
        closeVersionDiffModal();
        await ensureEditorOnValidation(ctx);
        scrollToPanel(HAR.RULES_VERSION_PANEL);
        ensurePanelExpanded(HAR.RULES_VERSION_PANEL);
      },
      verify: HAR.RULES_VERSION_PANEL,
    },
  ],
};
