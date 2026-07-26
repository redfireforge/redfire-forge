/**
 * TH-10: Assertions Deep Dive
 *
 * Teaches all assertion types — response assertions, field/type assertions,
 * JSON Schema & custom predicates, presets, and the Regex Builder modal.
 */
import type { DemoLesson, DemoActionContext } from '../../types';
import { HAR } from '@shared/selectors';
import {
  seedDemoEnvAndService,
  seedTh10FeatureGroup,
  deleteTh10DemoFg,
  ensureTh10FgExists,
  expandFirstFg,
  expandFirstScenario,
  spotlight,
  isTestEditorOpen,
  closeTestEditorQuiet,
  openAssertionAddMenu,
  closeAssertionAddMenu,
  selectAssertionType,
  clickValidationTab,
  closeRegexBuilderModal,
  closePresetsPanel,
} from './th-demo-helpers';

async function ensureTh10Ready(ctx: DemoActionContext): Promise<void> {
  await ensureTh10FgExists(ctx);
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

export const thAssertionsDeepDiveLesson: DemoLesson = {
  id: 'th-assertions-deep-dive',
  domainId: 'harness',
  category: 'validation',
  name: 'Assertions Deep Dive',
  description:
    'Master all assertion types — response checks, field validation, JSON Schema, custom predicates, ' +
    'presets, and the visual Regex Builder.',
  estimatedMinutes: 6,
  initialTab: 'scenarios',
  allowedTabs: ['scenarios'],
  concept: {
    title: 'Assertion Types & Categories',
    body:
      'RedfireForge provides **17+ assertion types** organized in 4 categories:\n\n' +
      '- **Response** — Status Code, Response Time SLA, Response Header, Body Size\n' +
      '- **Field Validation** — Regex, Numeric Compare, Date Compare, Type Check, Field Exists\n' +
      '- **Array & Structure** — Array Length, Array Contains, Each Element, Contains Subset\n' +
      '- **Schema & Advanced** — JSON Schema, Custom Predicate\n\n' +
      'Every assertion supports a **NOT** modifier to invert its logic. ' +
      'Use **Presets** for quick setup, and the **Regex Builder** for visual pattern construction.',
  },

  setup: async (ctx) => {
    deleteTh10DemoFg();
    await ctx.delay(200);
    await seedDemoEnvAndService(ctx);
    await seedTh10FeatureGroup(ctx);
    await ctx.delay(300);
    ctx.navigateToTab('scenarios');
    await ctx.delay(500);
    await expandFirstFg(ctx);
  },

  cleanup: async (ctx) => {
    closePresetsPanel();
    closeAssertionAddMenu();
    closeRegexBuilderModal();
    await ctx.delay(100);
    if (isTestEditorOpen()) await closeTestEditorQuiet(ctx);
    await ctx.delay(100);
    deleteTh10DemoFg();
    await ctx.delay(200);
  },

  steps: [
    // ── Step 1: The Assertion Menu ─────────────────────────────
    {
      id: 'th10-assertion-menu',
      title: 'The Assertion Menu',
      description:
        'The **+ Add** button opens a categorized assertion menu with 4 categories for HTTP tests: ' +
        '**Response** (Status Code, Response Time SLA, Header, Body Size), ' +
        '**Field Validation** (Regex, Numeric, Date, Type Check, Field Exists), ' +
        '**Array & Structure** (Array Length, Contains, Each Element, Subset), ' +
        'and **Schema & Advanced** (JSON Schema, Custom Predicate). ' +
        'Each type has a search filter for quick access.',
      highlight: HAR.TE_ASSERTIONS_ADD_BTN,
      action: async (ctx) => {
        await openAssertionAddMenu(ctx);

        const menu = document.querySelector<HTMLElement>(HAR.TE_ASSERTIONS_ADD_MENU);
        if (menu) await spotlight(menu, 1500, ctx);

        const headers = document.querySelectorAll<HTMLElement>('.aam-category-header');
        for (const header of headers) {
          await spotlight(header, 600, ctx);
        }

        closeAssertionAddMenu();
        await ctx.delay(300);
      },
      preAction: async (ctx) => {
        await ensureTh10Ready(ctx);
        closeAssertionAddMenu();
        closePresetsPanel();
        if (!isTestEditorOpen()) await ensureEditorOnValidation(ctx);
      },
      verify: HAR.TE_ASSERTIONS_SECTION,
    },

    // ── Step 2: Response Assertions & NOT ──────────────────────
    {
      id: 'th10-response',
      title: 'Response Assertions & NOT',
      description:
        'Add **Status Code** and **Response Time SLA** — the two most common assertions. ' +
        'The **NOT** toggle (available on every assertion type) inverts the check logic. ' +
        'Status Code supports pattern matching: `2xx` matches any 200-range status.',
      highlight: HAR.TE_ASSERTIONS_SECTION,
      action: async (ctx) => {
        await openAssertionAddMenu(ctx);
        await selectAssertionType(ctx, 'Status Code');

        const rows = document.querySelectorAll<HTMLElement>(HAR.TE_ASSERTION_ROW);
        const statusRow = rows[rows.length - 1];
        if (statusRow) await spotlight(statusRow, 1000, ctx);

        await openAssertionAddMenu(ctx);
        await selectAssertionType(ctx, 'Response Time SLA');

        const rows2 = document.querySelectorAll<HTMLElement>(HAR.TE_ASSERTION_ROW);
        const timeRow = rows2[rows2.length - 1];
        if (timeRow) await spotlight(timeRow, 1000, ctx);

        const notToggle = timeRow?.querySelector<HTMLElement>(HAR.TE_ASSERTION_NOT);
        if (notToggle) {
          await spotlight(notToggle, 800, ctx);
          notToggle.click();
          await ctx.delay(800);
          notToggle.click();
          await ctx.delay(400);
        }
      },
      preAction: async (ctx) => {
        await ensureTh10Ready(ctx);
        if (!isTestEditorOpen()) await ensureEditorOnValidation(ctx);
        closeAssertionAddMenu();
      },
      verify: HAR.TE_ASSERTION_ROW,
    },

    // ── Step 3: Field & Type Assertions ────────────────────────
    {
      id: 'th10-field-type',
      title: 'Field & Type Assertions',
      description:
        'Add **Numeric Compare** with the **JSONPath picker** — a searchable tree of response ' +
        'fields that lets you select paths visually instead of typing them. ' +
        'Then add **Field Exists** to verify a field is present without checking its value.',
      highlight: HAR.TE_ASSERTIONS_LIST,
      action: async (ctx) => {
        await openAssertionAddMenu(ctx);
        await selectAssertionType(ctx, 'Numeric Compare');

        const rows = document.querySelectorAll<HTMLElement>(HAR.TE_ASSERTION_ROW);
        const numRow = rows[rows.length - 1];
        if (numRow) await spotlight(numRow, 1200, ctx);

        const jppBtn = numRow?.querySelector<HTMLElement>(HAR.TE_JPP_BTN);
        if (jppBtn) {
          jppBtn.click();
          await ctx.delay(400);

          const jppMenu = document.querySelector<HTMLElement>(HAR.TE_JPP_MENU);
          if (jppMenu) {
            await spotlight(jppMenu, 1200, ctx);

            const items = jppMenu.querySelectorAll<HTMLElement>(HAR.TE_JPP_ITEM);
            for (const item of items) {
              if (item.textContent?.includes('lat') || item.textContent?.includes('geo.lat')) {
                item.click();
                await ctx.delay(400);
                break;
              }
            }
          }
        }

        await openAssertionAddMenu(ctx);
        await selectAssertionType(ctx, 'Field Exists');

        const rows2 = document.querySelectorAll<HTMLElement>(HAR.TE_ASSERTION_ROW);
        const existsRow = rows2[rows2.length - 1];
        if (existsRow) await spotlight(existsRow, 1000, ctx);
      },
      preAction: async (ctx) => {
        await ensureTh10Ready(ctx);
        if (!isTestEditorOpen()) await ensureEditorOnValidation(ctx);
        closeAssertionAddMenu();
      },
      verify: HAR.TE_ASSERTION_ROW,
    },

    // ── Step 4: JSON Schema & Custom ───────────────────────────
    {
      id: 'th10-schema-custom',
      title: 'JSON Schema & Custom',
      description:
        'Add **JSON Schema** to validate the entire response structure. Click **Generate from Response** ' +
        'to auto-build a schema from the sample response — types, required fields, and nested objects ' +
        'are all inferred. Add a **Custom Predicate** for logic that goes beyond built-in operators.',
      highlight: HAR.TE_ASSERTIONS_LIST,
      action: async (ctx) => {
        await openAssertionAddMenu(ctx);
        await selectAssertionType(ctx, 'JSON Schema');

        const schemaField = document.querySelector<HTMLElement>(HAR.TE_ASSERTION_SCHEMA);
        if (schemaField) {
          const toolbar = schemaField.querySelector<HTMLElement>(HAR.TE_SCHEMA_TOOLBAR);
          if (toolbar) await spotlight(toolbar, 1200, ctx);

          const genBtn = Array.from(schemaField.querySelectorAll<HTMLElement>('.assertion-schema-action'))
            .find(b => b.textContent?.includes('Generate'));
          if (genBtn) {
            genBtn.click();
            await ctx.delay(800);
            await spotlight(schemaField, 1500, ctx);
          }
        }

        await openAssertionAddMenu(ctx);
        await selectAssertionType(ctx, 'Custom Predicate');

        const rows = document.querySelectorAll<HTMLElement>(HAR.TE_ASSERTION_ROW);
        const customRow = rows[rows.length - 1];
        if (customRow) {
          await spotlight(customRow, 1000, ctx);

          const exprInput = customRow.querySelector<HTMLInputElement>(HAR.TE_CUSTOM_EXPR);
          if (exprInput) {
            const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
            nativeSetter?.call(exprInput, '$exists($.body.address)');
            exprInput.dispatchEvent(new Event('input', { bubbles: true }));
            await ctx.delay(400);
          }

          const descInput = customRow.querySelector<HTMLInputElement>(HAR.TE_CUSTOM_DESC);
          if (descInput) {
            const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
            nativeSetter?.call(descInput, 'Has address data');
            descInput.dispatchEvent(new Event('input', { bubbles: true }));
            await ctx.delay(400);
          }
        }
      },
      preAction: async (ctx) => {
        await ensureTh10Ready(ctx);
        if (!isTestEditorOpen()) await ensureEditorOnValidation(ctx);
        closeAssertionAddMenu();
      },
      verify: HAR.TE_ASSERTION_ROW,
    },

    // ── Step 5: Assertion Presets ───────────────────────────────
    {
      id: 'th10-presets',
      title: 'Assertion Presets',
      description:
        'The **📋 Presets** button opens a curated library of assertion sets organized by category: ' +
        'API Validation, Data Quality, and Security. Select a preset to apply a validated group of ' +
        'assertions in one click — great for consistency across your test suite.',
      highlight: HAR.TE_PRESETS_WRAP,
      action: async (ctx) => {
        const presetsBtn = document.querySelector<HTMLElement>('.assertion-preset-wrap .btn-outline');
        if (presetsBtn) {
          presetsBtn.click();
          await ctx.delay(500);
        }

        const panel = document.querySelector<HTMLElement>(HAR.TE_PRESETS_MENU);
        if (panel) await spotlight(panel, 1200, ctx);

        const firstCard = document.querySelector<HTMLElement>(HAR.TE_PRESET_CARD);
        if (firstCard) {
          await spotlight(firstCard, 1000, ctx);
          firstCard.click();
          await ctx.delay(600);
        }

        const rows = document.querySelectorAll<HTMLElement>(HAR.TE_ASSERTION_ROW);
        if (rows.length > 0) await spotlight(rows[rows.length - 1], 1000, ctx);
      },
      preAction: async (ctx) => {
        await ensureTh10Ready(ctx);
        if (!isTestEditorOpen()) await ensureEditorOnValidation(ctx);
        closePresetsPanel();
        closeAssertionAddMenu();
      },
      verify: HAR.TE_ASSERTION_ROW,
    },

    // ── Step 6: Regex Builder ──────────────────────────────────
    {
      id: 'th10-regex-builder',
      title: 'The Regex Builder',
      description:
        'The **Regex Builder** provides a visual modal for constructing regex assertions. ' +
        'Pick a response field from the **JSON tree**, browse the **Pattern Library** for common patterns ' +
        '(email, UUID, URL, ISO date), and see a **live preview** showing MATCH or NO MATCH ' +
        'against the actual field value.',
      highlight: HAR.TE_ASSERTIONS_ADD_BTN,
      action: async (ctx) => {
        await openAssertionAddMenu(ctx);
        await selectAssertionType(ctx, 'Regex Builder\u2026');

        await ctx.delay(600);

        const modal = document.querySelector<HTMLElement>(HAR.TE_REGEX_MODAL);
        if (modal) {
          await spotlight(modal, 1200, ctx);

          const tree = modal.querySelector<HTMLElement>(HAR.TE_REGEX_TREE);
          if (tree) await spotlight(tree, 1000, ctx);

          const leaves = modal.querySelectorAll<HTMLElement>('[data-testid^="tree-leaf-"]');
          for (const leaf of leaves) {
            if (leaf.textContent?.includes('email')) {
              leaf.click();
              await ctx.delay(600);
              break;
            }
          }

          const libToggle = Array.from(modal.querySelectorAll<HTMLElement>('button'))
            .find(b => b.textContent?.includes('Pattern Library'));
          if (libToggle) {
            libToggle.click();
            await ctx.delay(500);

            const patternLib = modal.querySelector<HTMLElement>('[data-testid="pattern-library"]');
            if (patternLib) await spotlight(patternLib, 1200, ctx);

            const emailEntry = modal.querySelectorAll<HTMLElement>('[data-testid^="pattern-entry-"]');
            for (const entry of emailEntry) {
              if (entry.textContent?.includes('Email')) {
                entry.click();
                await ctx.delay(600);
                break;
              }
            }
          }

          const preview = modal.querySelector<HTMLElement>(HAR.TE_REGEX_PREVIEW);
          if (preview) await spotlight(preview, 1500, ctx);

          const applyBtn = Array.from(modal.querySelectorAll<HTMLElement>('.modal-footer .btn'))
            .find(b => b.textContent?.includes('Apply'));
          if (applyBtn && !applyBtn.hasAttribute('disabled')) {
            applyBtn.click();
            await ctx.delay(500);
          } else {
            closeRegexBuilderModal();
            await ctx.delay(300);
          }
        }
      },
      preAction: async (ctx) => {
        await ensureTh10Ready(ctx);
        if (!isTestEditorOpen()) await ensureEditorOnValidation(ctx);
        closeAssertionAddMenu();
        closeRegexBuilderModal();
      },
      verify: HAR.TE_ASSERTION_ROW,
    },
  ],
};
