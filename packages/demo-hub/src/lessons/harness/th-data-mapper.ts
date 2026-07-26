/**
 * TH-11: Data Mapper for Validation
 *
 * Tour of the visual Data Mapper — layout, auto-mapping, operator pills,
 * view modes, verification, and saving rules back to the test editor.
 */
import type { DemoLesson, DemoActionContext } from '../../types';
import { HAR } from '@shared/selectors';
import {
  seedDemoEnvAndService,
  seedTh11FeatureGroup,
  deleteTh11DemoFg,
  ensureTh11FgExists,
  expandFirstFg,
  expandFirstScenario,
  spotlight,
  spotlightSel,
  isTestEditorOpen,
  closeTestEditorQuiet,
  clickValidationTab,
  closeDataMapperModal,
  isDataMapperOpen,
  clickMapperViewMode,
  fillMapperSearch,
  clearMapperSearch,
} from './th-demo-helpers';

async function ensureTh11Ready(ctx: DemoActionContext): Promise<void> {
  await ensureTh11FgExists(ctx);
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

export const thDataMapperLesson: DemoLesson = {
  id: 'th-data-mapper-validation',
  domainId: 'harness',
  category: 'validation',
  name: 'Data Mapper for Validation',
  description:
    'Use the visual Data Mapper to build validation rules — auto-map response fields, ' +
    'configure operators, switch between view modes, and verify rules against sample data.',
  estimatedMinutes: 6,
  initialTab: 'scenarios',
  allowedTabs: ['scenarios'],
  concept: {
    title: 'Visual Validation with the Data Mapper',
    body:
      'The **Data Mapper** provides a visual interface for building validation rules:\n\n' +
      '- **Source panel** shows the response JSON tree with type indicators\n' +
      '- **Target panel** shows validation rules with operator pills\n' +
      '- **Auto-map** creates mappings automatically using 3-tier name matching\n' +
      '- **24 operators** (equals, contains, regex, greater_than, is_not_empty, …)\n' +
      '- **View modes**: Code, Preview, Table, Rules (DSL), Lines (SVG canvas)\n' +
      '- **Verify All** checks every mapping against the sample response',
  },

  setup: async (ctx) => {
    deleteTh11DemoFg();
    await ctx.delay(200);
    await seedDemoEnvAndService(ctx);
    await seedTh11FeatureGroup(ctx);
    await ctx.delay(300);
    ctx.navigateToTab('scenarios');
    await ctx.delay(500);
    await expandFirstFg(ctx);
  },

  cleanup: async (ctx) => {
    if (isDataMapperOpen()) closeDataMapperModal();
    await ctx.delay(200);
    if (isTestEditorOpen()) await closeTestEditorQuiet(ctx);
    await ctx.delay(100);
    deleteTh11DemoFg();
    await ctx.delay(200);
  },

  steps: [
    // ── Step 1: Open the Data Mapper ─────────────────────────────
    {
      id: 'th11-open-mapper',
      title: 'Open the Data Mapper',
      description:
        'The **⚡ Data Mapper** button on the Validation tab opens a visual editor for building ' +
        'validation rules. The two-panel layout shows the **Source** response tree on the left ' +
        'and **Target** validation rules on the right, connected by a canvas of mapping lines.',
      highlight: HAR.TE_MAPPER_BTN,
      action: async (ctx) => {
        const mapperBtn = document.querySelector<HTMLElement>(HAR.TE_MAPPER_BTN);
        if (mapperBtn && !mapperBtn.hasAttribute('disabled')) {
          mapperBtn.click();
          await ctx.delay(800);
        }

        const source = document.querySelector<HTMLElement>(HAR.MAPPER_SOURCE);
        const target = document.querySelector<HTMLElement>(HAR.MAPPER_TARGET);
        if (source && target) {
          await spotlight(source, 800, ctx);
          await spotlight(target, 800, ctx);
        }

        await spotlightSel(ctx, HAR.MAPPER_TOOLBAR, 1200);
      },
      preAction: async (ctx) => {
        await ensureTh11Ready(ctx);
        if (isDataMapperOpen()) closeDataMapperModal();
        await ctx.delay(100);
        if (!isTestEditorOpen()) await ensureEditorOnValidation(ctx);
      },
      verify: HAR.MAPPER_MODAL,
    },

    // ── Step 2: Source Panel ─────────────────────────────────────
    {
      id: 'th11-source-panel',
      title: 'The Source Panel',
      description:
        'The **Source** panel displays the response JSON as a navigable tree. Each field shows a ' +
        '**type pill** (`obj`, `str`, `num`, `arr`, `bool`) so you know what you\'re mapping. ' +
        'Use the **search** input to filter fields, and check the **coverage dashboard** to see ' +
        'how much of the response is covered by validation rules.',
      highlight: HAR.MAPPER_SOURCE,
      action: async (ctx) => {
        const typePills = document.querySelectorAll<HTMLElement>(HAR.MAPPER_TYPE_PILL);
        if (typePills.length > 1) {
          await spotlight(typePills[0], 600, ctx);
          await spotlight(typePills[1], 600, ctx);
        }

        const searchInput = document.querySelector<HTMLElement>(HAR.MAPPER_SEARCH);
        if (searchInput) {
          fillMapperSearch('address');
          await ctx.delay(800);
          await spotlight(searchInput, 1000, ctx);
          clearMapperSearch();
          await ctx.delay(400);
        }

        const health = document.querySelector<HTMLElement>(HAR.MAPPER_HEALTH);
        if (health) await spotlight(health, 1000, ctx);
      },
      preAction: async (ctx) => {
        await ensureTh11Ready(ctx);
        if (!isDataMapperOpen()) await ensureMapperOpen(ctx);
        clearMapperSearch();
      },
      verify: HAR.MAPPER_SOURCE,
    },

    // ── Step 3: Auto-Map ─────────────────────────────────────────
    {
      id: 'th11-auto-map',
      title: 'Auto-Map',
      description:
        'The **Auto-map** button automatically creates mappings between source fields and target rules ' +
        'using 3-tier name matching: exact path, fuzzy name, and type-compatible. This gives you ' +
        'instant coverage that you can refine afterwards.',
      highlight: HAR.MAPPER_TOOLBAR,
      action: async (ctx) => {
        const autoMapBtn = document.querySelector<HTMLElement>(HAR.MAPPER_AUTOMAP);
        if (autoMapBtn) {
          autoMapBtn.click();
          await ctx.delay(1000);
        }

        const canvas = document.querySelector<HTMLElement>(HAR.MAPPER_CANVAS);
        if (canvas) await spotlight(canvas, 1500, ctx);

        const status = document.querySelector<HTMLElement>(HAR.MAPPER_STATUS);
        if (status) await spotlight(status, 1000, ctx);

        const pill = document.querySelector<HTMLElement>(HAR.MAPPER_OPERATOR_PILL);
        if (pill) await spotlight(pill, 1200, ctx);
      },
      preAction: async (ctx) => {
        await ensureTh11Ready(ctx);
        if (!isDataMapperOpen()) await ensureMapperOpen(ctx);
      },
      verify: HAR.MAPPER_OPERATOR_PILL,
    },

    // ── Step 4: Operator Pills ───────────────────────────────────
    {
      id: 'th11-operator-pill',
      title: 'Operator Pills',
      description:
        'Each mapped field has an **operator pill** controlling how the value is compared. ' +
        'Click a pill to open the **operator picker** — a categorized, searchable list of 24 operators ' +
        'including equals, contains, regex, greater_than, is_not_empty, type_is, and between.',
      highlight: HAR.MAPPER_OPERATOR_PILL,
      action: async (ctx) => {
        const pill = document.querySelector<HTMLElement>(HAR.MAPPER_OPERATOR_PILL);
        if (pill) {
          pill.click();
          await ctx.delay(500);

          const picker = document.querySelector<HTMLElement>(HAR.MAPPER_OPERATOR_PICKER);
          if (picker) {
            await spotlight(picker, 1500, ctx);

            const items = picker.querySelectorAll<HTMLElement>('.dm-op-picker-item');
            for (const item of items) {
              const label = item.querySelector('.dm-op-picker-label')?.textContent?.trim();
              if (label === 'is not empty') {
                item.click();
                await ctx.delay(500);
                break;
              }
            }
          } else {
            document.body.click();
            await ctx.delay(300);
          }
        }

        const updatedPill = document.querySelector<HTMLElement>(HAR.MAPPER_OPERATOR_PILL);
        if (updatedPill) await spotlight(updatedPill, 800, ctx);
      },
      preAction: async (ctx) => {
        await ensureTh11Ready(ctx);
        if (!isDataMapperOpen()) await ensureMapperOpen(ctx);
      },
      verify: HAR.MAPPER_OPERATOR_PILL,
    },

    // ── Step 5: View Modes & Verify ──────────────────────────────
    {
      id: 'th11-views-verify',
      title: 'View Modes & Verify',
      description:
        'Switch between **Code** (target ← source text), **Table** (JSON Path + Expected Value), ' +
        'and other view modes in the bottom dock. Click **Verify All** to check every mapping ' +
        'against the sample response — each gets a green ✓ or red ✗ badge.',
      highlight: HAR.MAPPER_TOOLBAR,
      action: async (ctx) => {
        await clickMapperViewMode(ctx, 'Code');
        const codeView = document.querySelector<HTMLElement>(HAR.MAPPER_CODE_VIEW);
        if (codeView) await spotlight(codeView, 1200, ctx);

        await clickMapperViewMode(ctx, 'Table');
        const tableView = document.querySelector<HTMLElement>(HAR.MAPPER_TABLE_VIEW);
        if (tableView) await spotlight(tableView, 1200, ctx);

        const verifyBtn = document.querySelector<HTMLElement>(HAR.MAPPER_VERIFY_BTN);
        if (verifyBtn) {
          verifyBtn.click();
          await ctx.delay(1200);
        }

        const badge = document.querySelector<HTMLElement>(HAR.MAPPER_VERIFY_BADGE);
        if (badge) await spotlight(badge, 1000, ctx);

        const summary = document.querySelector<HTMLElement>(HAR.MAPPER_VERIFY_SUMMARY);
        if (summary) await spotlight(summary, 1000, ctx);
      },
      preAction: async (ctx) => {
        await ensureTh11Ready(ctx);
        if (!isDataMapperOpen()) await ensureMapperOpen(ctx);
      },
      verify: HAR.MAPPER_TOOLBAR,
    },

    // ── Step 6: Save Rules ───────────────────────────────────────
    {
      id: 'th11-save',
      title: 'Save Rules',
      description:
        'Click **Save** to apply all mapped rules back to the test\'s validation configuration. ' +
        'The expected fields list in the Validation tab updates to reflect everything you built ' +
        'in the Data Mapper. Re-open the mapper anytime to refine your rules.',
      highlight: HAR.MAPPER_SAVE_BTN,
      action: async (ctx) => {
        const saveBtn = document.querySelector<HTMLElement>(HAR.MAPPER_SAVE_BTN);
        if (saveBtn) {
          saveBtn.click();
          await ctx.delay(800);
        }

        const rules = document.querySelector<HTMLElement>(HAR.TE_VALIDATION_RULES);
        if (rules) await spotlight(rules, 1200, ctx);
      },
      preAction: async (ctx) => {
        await ensureTh11Ready(ctx);
        if (!isDataMapperOpen()) await ensureMapperOpen(ctx);
      },
      verify: HAR.TE_VALIDATION_SEC,
    },
  ],
};
