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
import { showSpotlightRing } from '../../demoRipple';

/** Spotlight a group of elements together by drawing one ring around all of them. */
async function spotlightGroup(elements: HTMLElement[], holdMs: number, ctx: DemoActionContext): Promise<void> {
  if (elements.length === 0) return;
  // Scroll the last element into view so the entire group is visible
  elements[elements.length - 1].scrollIntoView({ block: 'nearest', inline: 'nearest' });
  const rects = elements.map(el => el.getBoundingClientRect());
  const top = Math.min(...rects.map(r => r.top));
  const left = Math.min(...rects.map(r => r.left));
  const right = Math.max(...rects.map(r => r.right));
  const bottom = Math.max(...rects.map(r => r.bottom));
  const anchor = document.createElement('div');
  anchor.style.cssText = `position:fixed;top:${top}px;left:${left}px;width:${right - left}px;height:${bottom - top}px;pointer-events:none;`;
  document.body.appendChild(anchor);
  const remove = showSpotlightRing(anchor);
  await ctx.delay(holdMs);
  remove();
  anchor.remove();
}

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
  estimatedMinutes: 10,
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
    keyTerms: [
      { term: 'NOT Modifier', definition: 'Inverts any assertion — e.g. status NOT 200 means "anything except 200".' },
      { term: 'Presets', definition: 'Curated assertion bundles (API Validation, Data Quality, Security) applied in one click.' },
      { term: 'Regex Builder', definition: 'Visual modal for constructing regex assertions with a Pattern Library and live preview.' },
      { term: 'JSONPath Picker', definition: 'Searchable tree of response fields — click a leaf to auto-fill the assertion path.' },
      { term: 'Custom Predicate', definition: 'Free-form JavaScript expression evaluated against the response body for advanced checks.' },
    ],
    diagram: `<svg viewBox="0 0 400 170" xmlns="http://www.w3.org/2000/svg">
      <text x="200" y="14" text-anchor="middle" fill="#94a3b8" font-size="7" font-weight="600" letter-spacing="1">ASSERTION CATEGORIES</text>
      <rect x="5" y="24" width="90" height="60" rx="6" fill="#1e293b" stroke="#3b82f6" stroke-width="1.5"/>
      <text x="50" y="40" text-anchor="middle" fill="#3b82f6" font-size="7.5" font-weight="700">Response</text>
      <text x="50" y="52" text-anchor="middle" fill="#94a3b8" font-size="5.5">Status · Time SLA</text>
      <text x="50" y="62" text-anchor="middle" fill="#94a3b8" font-size="5.5">Header · Body Size</text>
      <text x="50" y="76" text-anchor="middle" fill="#64748b" font-size="5" font-style="italic">4 types</text>
      <rect x="105" y="24" width="90" height="60" rx="6" fill="#1e293b" stroke="#10b981" stroke-width="1.5"/>
      <text x="150" y="40" text-anchor="middle" fill="#10b981" font-size="7.5" font-weight="700">Field Validation</text>
      <text x="150" y="52" text-anchor="middle" fill="#94a3b8" font-size="5.5">Regex · Numeric · Date</text>
      <text x="150" y="62" text-anchor="middle" fill="#94a3b8" font-size="5.5">Type Check · Exists</text>
      <text x="150" y="76" text-anchor="middle" fill="#64748b" font-size="5" font-style="italic">5 types</text>
      <rect x="205" y="24" width="90" height="60" rx="6" fill="#1e293b" stroke="#f59e0b" stroke-width="1.5"/>
      <text x="250" y="40" text-anchor="middle" fill="#f59e0b" font-size="7.5" font-weight="700">Array &amp; Structure</text>
      <text x="250" y="52" text-anchor="middle" fill="#94a3b8" font-size="5.5">Length · Contains</text>
      <text x="250" y="62" text-anchor="middle" fill="#94a3b8" font-size="5.5">Each · Subset</text>
      <text x="250" y="76" text-anchor="middle" fill="#64748b" font-size="5" font-style="italic">4 types</text>
      <rect x="305" y="24" width="90" height="60" rx="6" fill="#1e293b" stroke="#a855f7" stroke-width="1.5"/>
      <text x="350" y="40" text-anchor="middle" fill="#a855f7" font-size="7.5" font-weight="700">Schema &amp; Advanced</text>
      <text x="350" y="52" text-anchor="middle" fill="#94a3b8" font-size="5.5">JSON Schema</text>
      <text x="350" y="62" text-anchor="middle" fill="#94a3b8" font-size="5.5">Custom Predicate</text>
      <text x="350" y="76" text-anchor="middle" fill="#64748b" font-size="5" font-style="italic">2 types</text>
      <rect x="30" y="100" width="140" height="50" rx="6" fill="#1e293b" stroke="#64748b" stroke-width="1" stroke-dasharray="3,2"/>
      <text x="100" y="116" text-anchor="middle" fill="#f472b6" font-size="7" font-weight="700">NOT Modifier</text>
      <text x="100" y="128" text-anchor="middle" fill="#94a3b8" font-size="5.5">Invert any assertion logic</text>
      <text x="100" y="140" text-anchor="middle" fill="#64748b" font-size="5">status NOT 200 → "anything except 200"</text>
      <rect x="230" y="100" width="140" height="50" rx="6" fill="#1e293b" stroke="#64748b" stroke-width="1" stroke-dasharray="3,2"/>
      <text x="300" y="116" text-anchor="middle" fill="#f472b6" font-size="7" font-weight="700">Quick Setup</text>
      <text x="300" y="128" text-anchor="middle" fill="#94a3b8" font-size="5.5">Presets · Regex Builder</text>
      <text x="300" y="140" text-anchor="middle" fill="#64748b" font-size="5">One-click bundles &amp; visual patterns</text>
      <line x1="100" y1="90" x2="100" y2="100" stroke="#64748b" stroke-width="0.8" stroke-dasharray="2,2"/>
      <line x1="300" y1="90" x2="300" y2="100" stroke="#64748b" stroke-width="0.8" stroke-dasharray="2,2"/>
    </svg>`,
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
      highlight: HAR.TEST_EDIT_BTN,
      action: async (ctx) => {
        // 1. Highlight Edit button and click it to open the test editor
        if (!isTestEditorOpen()) {
          const editBtn = document.querySelector<HTMLElement>(HAR.TEST_EDIT_BTN);
          if (editBtn) {
            await spotlight(editBtn, 2000, ctx);
            editBtn.click();
            await ctx.delay(800);
          }
        }

        // 2. Highlight Validation tab and click it
        const tabs = document.querySelectorAll<HTMLElement>('.builder-tab');
        const validationTab = Array.from(tabs).find(t => t.textContent?.includes('Validation'));
        if (validationTab && !validationTab.classList.contains('active')) {
          await spotlight(validationTab, 2000, ctx);
          validationTab.click();
          await ctx.delay(600);
        } else if (validationTab) {
          await spotlight(validationTab, 1500, ctx);
        }

        // 3. Highlight + Add button then open assertion menu
        const addBtn = document.querySelector<HTMLElement>(HAR.TE_ASSERTIONS_ADD_BTN);
        if (addBtn) await spotlight(addBtn, 2000, ctx);

        await openAssertionAddMenu(ctx);

        const menu = document.querySelector<HTMLElement>(HAR.TE_ASSERTIONS_ADD_MENU);
        if (menu) {
          const categories = menu.querySelectorAll<HTMLElement>('.aam-category');
          for (const cat of categories) {
            await spotlight(cat, 2500, ctx);
          }

          const searchInput = menu.querySelector<HTMLElement>('input');
          if (searchInput) await spotlight(searchInput, 1500, ctx);
        }

        closeAssertionAddMenu();
        await ctx.delay(400);
      },
      preAction: async (ctx) => {
        await ensureTh10Ready(ctx);
        await expandFirstScenario(ctx);
        await ctx.delay(300);
        closeAssertionAddMenu();
        closePresetsPanel();
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
      highlight: HAR.TE_ASSERTIONS_ADD_BTN,
      action: async (ctx) => {
        // Add Status Code
        await openAssertionAddMenu(ctx);
        await ctx.delay(400);
        const statusItem = Array.from(document.querySelectorAll<HTMLElement>('.aam-grid-item'))
          .find(i => i.querySelector('.aam-label')?.textContent?.trim() === 'Status Code');
        if (statusItem) await spotlight(statusItem, 1500, ctx);
        await selectAssertionType(ctx, 'Status Code');
        await ctx.delay(600);

        // Add Response Time SLA
        await openAssertionAddMenu(ctx);
        await ctx.delay(400);
        const slaItem = Array.from(document.querySelectorAll<HTMLElement>('.aam-grid-item'))
          .find(i => i.querySelector('.aam-label')?.textContent?.trim() === 'Response Time SLA');
        if (slaItem) await spotlight(slaItem, 1500, ctx);
        await selectAssertionType(ctx, 'Response Time SLA');
        await ctx.delay(600);

        // Demonstrate the NOT toggle on the TIME row
        const rows2 = document.querySelectorAll<HTMLElement>(HAR.TE_ASSERTION_ROW);
        const timeRow = rows2[rows2.length - 1];
        const notToggle = timeRow?.querySelector<HTMLElement>(HAR.TE_ASSERTION_NOT);
        if (notToggle) {
          await spotlight(notToggle, 1200, ctx);
          notToggle.click();
          await ctx.delay(1200);
          notToggle.click();
          await ctx.delay(800);
        }

        // Group highlight both assertions added in this step
        const allRows = document.querySelectorAll<HTMLElement>(HAR.TE_ASSERTION_ROW);
        await spotlightGroup(Array.from(allRows).slice(-2), 2500, ctx);
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
      highlight: HAR.TE_ASSERTIONS_ADD_BTN,
      action: async (ctx) => {
        // Add Numeric Compare
        await openAssertionAddMenu(ctx);
        await ctx.delay(400);
        const numItem = Array.from(document.querySelectorAll<HTMLElement>('.aam-grid-item'))
          .find(i => i.querySelector('.aam-label')?.textContent?.trim() === 'Numeric Compare');
        if (numItem) await spotlight(numItem, 1500, ctx);
        await selectAssertionType(ctx, 'Numeric Compare');
        await ctx.delay(600);

        // Demonstrate JSONPath picker on the new row
        const rows = document.querySelectorAll<HTMLElement>(HAR.TE_ASSERTION_ROW);
        const numRow = rows[rows.length - 1];
        const jppBtn = numRow?.querySelector<HTMLElement>(HAR.TE_JPP_BTN);
        if (jppBtn) {
          await spotlight(jppBtn, 1200, ctx);
          jppBtn.click();
          await ctx.delay(600);

          const jppMenu = document.querySelector<HTMLElement>(HAR.TE_JPP_MENU);
          if (jppMenu) {
            await spotlight(jppMenu, 2000, ctx);
            // Find and click the geo.lat item
            const items = jppMenu.querySelectorAll<HTMLElement>(HAR.TE_JPP_ITEM);
            for (const item of items) {
              if (item.textContent?.includes('lat') || item.textContent?.includes('geo.lat')) {
                await spotlight(item, 1200, ctx);
                item.click();
                await ctx.delay(800);
                break;
              }
            }
          }
        }

        // Add Field Exists
        await openAssertionAddMenu(ctx);
        await ctx.delay(400);
        const existsItem = Array.from(document.querySelectorAll<HTMLElement>('.aam-grid-item'))
          .find(i => i.querySelector('.aam-label')?.textContent?.trim() === 'Field Exists');
        if (existsItem) await spotlight(existsItem, 1500, ctx);
        await selectAssertionType(ctx, 'Field Exists');
        await ctx.delay(600);

        // Group highlight both assertions added in this step (Numeric + Exists)
        const allRows = document.querySelectorAll<HTMLElement>(HAR.TE_ASSERTION_ROW);
        await spotlightGroup(Array.from(allRows).slice(-2), 2500, ctx);
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
      highlight: HAR.TE_ASSERTIONS_ADD_BTN,
      action: async (ctx) => {
        // Open menu and spotlight JSON Schema
        await openAssertionAddMenu(ctx);
        await ctx.delay(400);

        const schemaItem = Array.from(document.querySelectorAll<HTMLElement>('.aam-grid-item'))
          .find(i => i.querySelector('.aam-label')?.textContent?.trim() === 'JSON Schema');
        if (schemaItem) await spotlight(schemaItem, 1000, ctx);

        await selectAssertionType(ctx, 'JSON Schema');
        await ctx.delay(600);

        const schemaField = document.querySelector<HTMLElement>(HAR.TE_ASSERTION_SCHEMA);
        if (schemaField) {
          // Spotlight and click the Generate button
          const genBtn = Array.from(schemaField.querySelectorAll<HTMLElement>('.assertion-schema-action'))
            .find(b => b.textContent?.includes('Generate'));
          if (genBtn) {
            await spotlight(genBtn, 1500, ctx);
            genBtn.click();
            await ctx.delay(2000);
          }
        }

        // Add Custom Predicate
        await openAssertionAddMenu(ctx);
        await ctx.delay(400);
        const customItem = Array.from(document.querySelectorAll<HTMLElement>('.aam-grid-item'))
          .find(i => i.querySelector('.aam-label')?.textContent?.trim() === 'Custom Predicate');
        if (customItem) await spotlight(customItem, 1500, ctx);
        await selectAssertionType(ctx, 'Custom Predicate');
        await ctx.delay(600);

        // Fill expression and description
        const rows = document.querySelectorAll<HTMLElement>(HAR.TE_ASSERTION_ROW);
        const customRow = rows[rows.length - 1];
        if (customRow) {
          const exprInput = customRow.querySelector<HTMLInputElement>(HAR.TE_CUSTOM_EXPR);
          if (exprInput) {
            const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
            nativeSetter?.call(exprInput, '$exists($.body.address)');
            exprInput.dispatchEvent(new Event('input', { bubbles: true }));
            await ctx.delay(600);
          }
          const descInput = customRow.querySelector<HTMLInputElement>(HAR.TE_CUSTOM_DESC);
          if (descInput) {
            const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
            nativeSetter?.call(descInput, 'Has address data');
            descInput.dispatchEvent(new Event('input', { bubbles: true }));
            await ctx.delay(600);
          }
        }

        // Group highlight both assertions added in this step (Schema + Custom)
        const allRows = document.querySelectorAll<HTMLElement>(HAR.TE_ASSERTION_ROW);
        await spotlightGroup(Array.from(allRows).slice(-2), 2500, ctx);
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
        'The **Presets** button opens a curated library of assertion sets organized by category: ' +
        'API Validation, Data Quality, and Security. Select a preset to apply a validated group of ' +
        'assertions in one click — great for consistency across your test suite.',
      highlight: HAR.TE_PRESETS_WRAP,
      action: async (ctx) => {
        // Spotlight the Presets button before clicking
        const presetsBtn = document.querySelector<HTMLElement>('.assertion-preset-wrap .btn-outline');
        if (presetsBtn) {
          await spotlight(presetsBtn, 1200, ctx);
          presetsBtn.click();
          await ctx.delay(800);
        }

        // Spotlight the entire presets panel
        const panel = document.querySelector<HTMLElement>(HAR.TE_PRESETS_MENU);
        if (panel) await spotlight(panel, 2500, ctx);

        // Click the first preset card — track rows before to identify new ones
        const rowsBefore = document.querySelectorAll<HTMLElement>(HAR.TE_ASSERTION_ROW).length;
        const cards = document.querySelectorAll<HTMLElement>(HAR.TE_PRESET_CARD);
        const firstCard = cards[0] as HTMLElement | undefined;
        if (firstCard) {
          await spotlight(firstCard, 1500, ctx);
          firstCard.click();
          await ctx.delay(1000);
        }

        // Spotlight each newly added row individually so the viewer can read its config
        const allRows = Array.from(document.querySelectorAll<HTMLElement>(HAR.TE_ASSERTION_ROW));
        const newRows = allRows.slice(rowsBefore);
        if (newRows.length > 0) {
          const list = document.querySelector<HTMLElement>(HAR.TE_ASSERTIONS_LIST);
          for (const row of newRows) {
            row.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            if (list) await ctx.delay(200);
            await spotlight(row, 2200, ctx);
          }
          // Final group highlight to show them together
          if (list) list.scrollTop = list.scrollHeight;
          await ctx.delay(300);
          await spotlightGroup(newRows, 2000, ctx);
        }
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
      action: async (ctx) => {
        // Open menu and spotlight Regex Builder item
        await openAssertionAddMenu(ctx);
        await ctx.delay(400);

        const regexItem = Array.from(document.querySelectorAll<HTMLElement>('.aam-grid-item'))
          .find(i => i.querySelector('.aam-label')?.textContent?.includes('Regex Builder'));
        if (regexItem) await spotlight(regexItem, 1000, ctx);

        await selectAssertionType(ctx, 'Regex Builder\u2026');
        await ctx.delay(800);

        const modal = document.querySelector<HTMLElement>(HAR.TE_REGEX_MODAL);
        if (modal) {

          // Find and click the email leaf directly
          const leaves = modal.querySelectorAll<HTMLElement>('[data-testid^="tree-leaf-"]');
          let emailLeaf: HTMLElement | null = null;
          for (const leaf of leaves) {
            if (leaf.textContent?.includes('email')) {
              emailLeaf = leaf;
              break;
            }
          }

          if (emailLeaf) {
            await spotlight(emailLeaf, 1500, ctx);
            emailLeaf.click();
            await ctx.delay(1000);
          }

          // Spotlight the Pattern Library toggle
          const libToggle = Array.from(modal.querySelectorAll<HTMLElement>('button'))
            .find(b => b.textContent?.includes('Pattern Library'));
          if (libToggle) {
            await spotlight(libToggle, 1000, ctx);
            libToggle.click();
            await ctx.delay(800);

            // Spotlight the Pattern Library panel
            const patternLib = modal.querySelector<HTMLElement>('[data-testid="pattern-library"]');
            if (patternLib) await spotlight(patternLib, 1800, ctx);

            // Find the Email pattern entry
            const entries = modal.querySelectorAll<HTMLElement>('[data-testid^="pattern-entry-"]');
            let emailEntry: HTMLElement | null = null;
            for (const entry of entries) {
              if (entry.textContent?.includes('Email')) {
                emailEntry = entry;
                break;
              }
            }

            // Click the Email pattern entry
            if (emailEntry) {
              await spotlight(emailEntry, 1000, ctx);
              emailEntry.click();
              await ctx.delay(1000);
            }
          }

          // Spotlight the live preview result
          const preview = modal.querySelector<HTMLElement>(HAR.TE_REGEX_PREVIEW);
          if (preview) await spotlight(preview, 2000, ctx);

          // Spotlight and click Apply Assertion
          const applyBtn = Array.from(modal.querySelectorAll<HTMLElement>('button'))
            .find(b => b.textContent?.trim() === 'Apply Assertion');
          if (applyBtn && !applyBtn.hasAttribute('disabled')) {
            await spotlight(applyBtn, 1000, ctx);
            applyBtn.click();
            await ctx.delay(800);
          } else {
            closeRegexBuilderModal();
            await ctx.delay(500);
          }

          // Spotlight the newly added regex assertion row
          const rows = document.querySelectorAll<HTMLElement>(HAR.TE_ASSERTION_ROW);
          if (rows.length > 0) await spotlight(rows[rows.length - 1], 1500, ctx);
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
