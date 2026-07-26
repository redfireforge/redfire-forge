/**
 * TH-17: Data Mapper Expressions & DSL Editor
 *
 * Expression Editor 3-panel layout, function catalog, step debugger,
 * snippets/templates, DSL Rules editor with reference panel, and
 * inline verify with gutter markers.
 */
import type { DemoLesson, DemoActionContext } from '../../types';
import { HAR } from '@shared/selectors';
import {
  seedDemoEnvAndService,
  seedTh17FeatureGroup,
  deleteTh17DemoFg,
  ensureTh17FgExists,
  expandFirstFg,
  expandFirstScenario,
  spotlight,
  isTestEditorOpen,
  closeTestEditorQuiet,
  clickValidationTab,
  closeDataMapperModal,
  isDataMapperOpen,
  isExpressionEditorOpen,
  closeExpressionEditor,
  isRulesModalOpen,
  closeRulesModal,
  clickRulesToolbarButton,
  clickRulesReference,
} from './th-demo-helpers';

/* ── local helpers ──────────────────────────────────────────── */

async function ensureTh17Ready(ctx: DemoActionContext): Promise<void> {
  await ensureTh17FgExists(ctx);
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

async function ensureMapperOpen(ctx: DemoActionContext): Promise<void> {
  if (isDataMapperOpen()) return;
  await ensureEditorOnValidation(ctx);
  const mapperBtn = document.querySelector<HTMLElement>(HAR.TE_MAPPER_BTN);
  if (mapperBtn && !mapperBtn.hasAttribute('disabled')) {
    mapperBtn.click();
    await ctx.delay(800);
  }
}

function openExpressionEditorViaDoubleClick(): void {
  const badge = document.querySelector<HTMLElement>('.dm-mapped-badge');
  if (badge) {
    badge.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
  }
}

/* ── lesson definition ──────────────────────────────────────── */

export const thMapperExpressionsDslLesson: DemoLesson = {
  id: 'th-mapper-expressions-dsl',
  domainId: 'harness',
  category: 'validation',
  name: 'Expressions & DSL Editor',
  description:
    'Explore the Expression Editor for writing complex transformations with a function catalog and ' +
    'step debugger, then switch to the DSL Rules editor for text-based rule authoring with ' +
    'autocomplete, a reference panel, and inline verification.',
  estimatedMinutes: 5,
  initialTab: 'scenarios',
  allowedTabs: ['scenarios'],
  concept: {
    title: 'Beyond Simple Mappings',
    body:
      'The Data Mapper supports two advanced editing modes:\n\n' +
      '- **Expression Editor** — a 3-panel interface with a function catalog (8 categories), ' +
      'Monaco code editor, documentation, live preview, step-through debugger, and reusable snippets\n' +
      '- **DSL Rules Editor** — a Monaco-based text editor with custom syntax highlighting, ' +
      'autocomplete, 8-category reference panel (34 operators), and per-line verification with ' +
      'pass/fail gutter markers',
  },

  setup: async (ctx) => {
    deleteTh17DemoFg();
    await ctx.delay(200);
    await seedDemoEnvAndService(ctx);
    await seedTh17FeatureGroup(ctx);
    await ctx.delay(300);
    ctx.navigateToTab('scenarios');
    await ctx.delay(500);
    await expandFirstFg(ctx);
  },

  cleanup: async (ctx) => {
    if (isRulesModalOpen()) closeRulesModal();
    await ctx.delay(200);
    if (isExpressionEditorOpen()) closeExpressionEditor();
    await ctx.delay(200);
    if (isDataMapperOpen()) closeDataMapperModal();
    await ctx.delay(200);
    if (isTestEditorOpen()) await closeTestEditorQuiet(ctx);
    await ctx.delay(100);
    deleteTh17DemoFg();
    await ctx.delay(200);
  },

  steps: [
    // ── Step 1: Expression Editor Layout ─────────────────────────
    {
      id: 'th17-expression-editor',
      title: 'Expression Editor Layout',
      description:
        'Double-click a mapped badge on a target tree node to open the **Expression Editor**. ' +
        'It has three panels: the **function catalog** on the left with 8 categories and search, ' +
        'the **Monaco editor** in the center for writing expressions, and the **documentation panel** ' +
        'on the right showing function details, reusable snippets, and templates. ' +
        'The **live preview** section below the editor shows the evaluated result from your sample data.',
      highlight: HAR.EXPR_MODAL,
      action: async (ctx) => {
        const sidebar = document.querySelector<HTMLElement>(HAR.EXPR_SIDEBAR);
        if (sidebar) await spotlight(sidebar, 1000, ctx);

        const editorArea = document.querySelector<HTMLElement>(HAR.EXPR_EDITOR_AREA);
        if (editorArea) await spotlight(editorArea, 800, ctx);

        const docs = document.querySelector<HTMLElement>(HAR.EXPR_DOCS);
        if (docs) await spotlight(docs, 800, ctx);

        const preview = document.querySelector<HTMLElement>(HAR.EXPR_PREVIEW);
        if (preview) await spotlight(preview, 1000, ctx);
      },
      preAction: async (ctx) => {
        await ensureTh17Ready(ctx);
        if (isRulesModalOpen()) closeRulesModal();
        if (!isDataMapperOpen()) {
          await ensureMapperOpen(ctx);
        }
        if (!isExpressionEditorOpen()) {
          openExpressionEditorViaDoubleClick();
          await ctx.delay(800);
        }
      },
      verify: HAR.EXPR_MODAL,
    },

    // ── Step 2: Function Catalog & Step Debugger ─────────────────
    {
      id: 'th17-catalog-debug',
      title: 'Function Catalog & Step Debugger',
      description:
        'The **function catalog** on the left lets you search and browse functions across 8 categories ' +
        '(String, Math, Array, Object, Conditional, JSON, Date/Time, Encoding). Click a function to ' +
        'see its **documentation** — signature, description, and examples — with an **Insert** button ' +
        'to add it to your expression. The **Step Debug** toggle shows evaluation broken into ' +
        'incremental steps so you can see exactly what each part of a complex expression produces.',
      highlight: HAR.EXPR_SIDEBAR,
      action: async (ctx) => {
        const searchInput = document.querySelector<HTMLElement>(HAR.EXPR_FN_SEARCH);
        if (searchInput) await spotlight(searchInput, 800, ctx);

        const fnList = document.querySelector<HTMLElement>(HAR.EXPR_FN_LIST);
        if (fnList) await spotlight(fnList, 800, ctx);

        const docs = document.querySelector<HTMLElement>(HAR.EXPR_DOCS);
        if (docs) await spotlight(docs, 1200, ctx);

        const debugToggle = document.querySelector<HTMLElement>(HAR.EXPR_DEBUG_TOGGLE);
        if (debugToggle) {
          await spotlight(debugToggle, 800, ctx);
          debugToggle.click();
          await ctx.delay(600);
        }

        const stepDebugger = document.querySelector<HTMLElement>(HAR.EXPR_STEP_DEBUGGER);
        if (stepDebugger) await spotlight(stepDebugger, 1200, ctx);
      },
      preAction: async (ctx) => {
        await ensureTh17Ready(ctx);
        if (isRulesModalOpen()) closeRulesModal();
        if (!isDataMapperOpen()) await ensureMapperOpen(ctx);
        if (!isExpressionEditorOpen()) {
          openExpressionEditorViaDoubleClick();
          await ctx.delay(800);
        }
      },
      verify: HAR.EXPR_MODAL,
    },

    // ── Step 3: Snippets & Function Templates ────────────────────
    {
      id: 'th17-snippets-templates',
      title: 'Snippets & Function Templates',
      description:
        'The right panel contains **Reusable Snippets** — save frequently-used expressions with a ' +
        'name and reuse them across mappings. Below that, **Function Templates** offer a searchable ' +
        'library of ~35 transformation patterns you can insert at the cursor. The "Compose current" ' +
        'checkbox wraps your existing expression inside the selected template.',
      highlight: HAR.EXPR_DOCS,
      action: async (ctx) => {
        const snippets = document.querySelector<HTMLElement>(HAR.EXPR_SNIPPETS);
        if (snippets) await spotlight(snippets, 1000, ctx);

        const templates = document.querySelector<HTMLElement>(HAR.EXPR_TEMPLATES);
        if (templates) await spotlight(templates, 1000, ctx);

        closeExpressionEditor();
        await ctx.delay(400);
      },
      preAction: async (ctx) => {
        await ensureTh17Ready(ctx);
        if (isRulesModalOpen()) closeRulesModal();
        if (!isDataMapperOpen()) await ensureMapperOpen(ctx);
        if (!isExpressionEditorOpen()) {
          openExpressionEditorViaDoubleClick();
          await ctx.delay(800);
        }
      },
      verify: HAR.MAPPER_TOOLBAR,
    },

    // ── Step 4: DSL Rules Editor & Reference Panel ───────────────
    {
      id: 'th17-dsl-rules-editor',
      title: 'DSL Rules Editor & Reference',
      description:
        'Click **Rules** in the Data Mapper toolbar to open the **Validation Rules Modal** — ' +
        'a Monaco-based editor with custom `validation-dsl` syntax highlighting. Operators appear ' +
        'in distinct colors, paths are colored, and autocomplete suggests operators and field paths. ' +
        'Toggle the **Reference** panel to browse 8 categories of 34 operators with syntax, ' +
        'examples, and one-click Insert into the editor.',
      highlight: HAR.VR_MODAL,
      action: async (ctx) => {
        const editor = document.querySelector<HTMLElement>(HAR.VR_EDITOR);
        if (editor) await spotlight(editor, 1200, ctx);

        clickRulesReference();
        await ctx.delay(600);

        const refPane = document.querySelector<HTMLElement>(HAR.VR_REFERENCE);
        if (refPane) await spotlight(refPane, 1200, ctx);
      },
      preAction: async (ctx) => {
        await ensureTh17Ready(ctx);
        if (isExpressionEditorOpen()) {
          closeExpressionEditor();
          await ctx.delay(300);
        }
        if (!isDataMapperOpen()) await ensureMapperOpen(ctx);
        if (!isRulesModalOpen()) {
          clickRulesToolbarButton();
          await ctx.delay(700);
        }
      },
      verify: HAR.VR_MODAL,
    },

    // ── Step 5: DSL Inline Verify ────────────────────────────────
    {
      id: 'th17-dsl-verify',
      title: 'DSL Inline Verify',
      description:
        'Click **▶ Verify** in the Rules modal header to evaluate every DSL rule against the ' +
        'sample response. Each line gets a **gutter marker** — green bars with inline ✓ for ' +
        'passing rules, red bars with "← Got: …" for failing rules. The header stats show ' +
        'total pass and fail counts. This is the fastest way to validate your entire rule set.',
      highlight: HAR.VR_VERIFY_BTN,
      action: async (ctx) => {
        const verifyBtn = document.querySelector<HTMLElement>(HAR.VR_VERIFY_BTN);
        if (verifyBtn) {
          await spotlight(verifyBtn, 800, ctx);
          verifyBtn.click();
          await ctx.delay(800);
        }

        const editorPane = document.querySelector<HTMLElement>(HAR.VR_EDITOR);
        if (editorPane) await spotlight(editorPane, 1200, ctx);

        const passStat = document.querySelector<HTMLElement>(HAR.VR_STAT_PASS);
        const failStat = document.querySelector<HTMLElement>(HAR.VR_STAT_FAIL);
        const statsEl = passStat ?? failStat;
        if (statsEl) await spotlight(statsEl, 800, ctx);

        closeRulesModal();
        await ctx.delay(400);
      },
      preAction: async (ctx) => {
        await ensureTh17Ready(ctx);
        if (isExpressionEditorOpen()) {
          closeExpressionEditor();
          await ctx.delay(300);
        }
        if (!isDataMapperOpen()) await ensureMapperOpen(ctx);
        if (!isRulesModalOpen()) {
          clickRulesToolbarButton();
          await ctx.delay(700);
        }
      },
      verify: HAR.MAPPER_TOOLBAR,
    },
  ],
};
