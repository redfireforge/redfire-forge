/**
 * TH-5b — Convert to Parameterized Test
 *
 * 3 steps: convert a normal test via the Parameterize button →
 * walk the Create Parameterized Copy wizard → review the converted test.
 *
 * Teaches the shortcut conversion path — taking an existing standard test
 * and creating a parameterized copy with a data source.
 */
import type { DemoLesson } from '../../types';
import { HAR } from '@shared/selectors';
import { purgeAllSpotlightRings } from '../../demoRipple';
import {
  spotlight,
  deleteTh5DemoFg,
  deleteTh5DemoScenarios,
  ensureTh5FgExists,
  ensureTh5StandardFgExists,
  expandFirstFg,
  expandFirstScenario,
  expandTh5Fg,
  closeTestEditorQuiet,
  closeInlineNameFormQuiet,
  isTestEditorOpen,
  seedDemoEnvAndService,
  seedTh5EmptyFg,
  fillDsRowLabel,
  fillDsDataCell,
  TH5_FG_NAME,
  TH5_SCENARIO_NAME,
} from './th-demo-helpers';

// ─── Lesson ──────────────────────────────────────────────────────

export const thDataSourcesConvertLesson: DemoLesson = {
  id: 'th-data-sources-convert',
  domainId: 'harness',
  category: 'data-driven',
  name: 'Convert to Parameterized Test',
  description:
    'Convert an existing standard test into a parameterized copy that lives in ' +
    'its own Parameterized Scenario — ready for the Parameterized Runner.',
  estimatedMinutes: 3,
  initialTab: 'scenarios',
  allowedTabs: ['scenarios'],
  contentVersion: 13,

  concept: {
    title: 'Convert an Existing Test',
    body:
      'Already have a working standard test? Use **📋 Parameterize** to create a ' +
      'data-driven copy — without touching the original.\n\n' +
      '**What you\'ll do:**\n' +
      '1. Create a Standard scenario with a normal test (URL with `{{userId}}`)\n' +
      '2. Open that test and click **📋 Parameterize** → walk the 5-step wizard\n' +
      '3. On the Review step, name the **new Parameterized Scenario** that will hold the copy\n' +
      '4. Save — the original test stays in the Standard scenario; the copy lands in its own Parameterized Scenario\n\n' +
      '**Key insight:** The two tests stay separate. The standard test runs in Test Runner; ' +
      'the parameterized copy appears in **Parameterized Runner** because it lives in a Parameterized Scenario.',
    keyTerms: [
      { term: 'Parameterize Button', definition: 'Appears in the toolbar of any existing saved standard test — opens the conversion wizard. Not shown on brand-new unsaved tests.' },
      { term: 'Create Parameterized Copy', definition: 'A 5-step wizard that auto-detects {{placeholders}}, configures columns, and creates a new parameterized test.' },
      { term: 'Parameterized Scenario', definition: 'Scenario kind that holds data-driven tests. Tests here appear in the Parameterized Runner.' },
      { term: 'New Scenario Name', definition: 'Set on the wizard\'s Review step — names the Parameterized Scenario that will own the converted copy.' },
      { term: 'Param Badge', definition: 'Visual indicator on a test card showing it is parameterized and has a data source.' },
    ],
    diagram: `<svg viewBox="0 0 420 110" xmlns="http://www.w3.org/2000/svg">
      <!-- Standard Scenario -->
      <rect x="5" y="5" width="108" height="100" rx="5" fill="#1e293b" stroke="#64748b" stroke-width="1.5"/>
      <text x="59" y="19" text-anchor="middle" fill="#94a3b8" font-size="5.5" font-weight="700">Standard Scenario</text>
      <rect x="13" y="26" width="92" height="52" rx="4" fill="#0f172a" stroke="#64748b" stroke-width="1"/>
      <text x="59" y="40" text-anchor="middle" fill="#cbd5e1" font-size="5">Get User by ID</text>
      <text x="59" y="52" text-anchor="middle" fill="#94a3b8" font-size="4.5">/users/{{"{{"}}userId{{"}}"}}</text>
      <text x="59" y="64" text-anchor="middle" fill="#64748b" font-size="4">no data source</text>
      <text x="59" y="95" text-anchor="middle" fill="#64748b" font-size="4.5">stays untouched</text>
      <!-- Arrow to wizard -->
      <path d="M118 55 L138 55" stroke="#64748b" stroke-width="1" marker-end="url(#arr2)"/>
      <!-- Wizard box -->
      <rect x="143" y="20" width="105" height="70" rx="5" fill="#1e293b" stroke="#a855f7" stroke-width="1.5"/>
      <text x="195" y="35" text-anchor="middle" fill="#a855f7" font-size="6" font-weight="700">📋 Parameterize</text>
      <text x="195" y="47" text-anchor="middle" fill="#94a3b8" font-size="4.5">Detect Variables</text>
      <text x="195" y="57" text-anchor="middle" fill="#94a3b8" font-size="4.5">Configure Columns</text>
      <text x="195" y="67" text-anchor="middle" fill="#94a3b8" font-size="4.5">Review → Name Scenario</text>
      <text x="195" y="79" text-anchor="middle" fill="#a6e3a1" font-size="4.5">Create &amp; Open</text>
      <!-- Arrow to result -->
      <path d="M253 55 L273 55" stroke="#64748b" stroke-width="1" marker-end="url(#arr2)"/>
      <!-- Parameterized Scenario -->
      <rect x="278" y="5" width="137" height="100" rx="5" fill="#1e293b" stroke="#3b82f6" stroke-width="1.5"/>
      <text x="346" y="19" text-anchor="middle" fill="#3b82f6" font-size="5.5" font-weight="700">Parameterized Scenario</text>
      <rect x="286" y="26" width="121" height="52" rx="4" fill="#0f172a" stroke="#3b82f6" stroke-width="1"/>
      <text x="346" y="40" text-anchor="middle" fill="#cbd5e1" font-size="5">Get User by ID (Param)</text>
      <rect x="296" y="46" width="30" height="10" rx="5" fill="#1e3a5f" stroke="#3b82f6" stroke-width="0.8"/>
      <text x="311" y="53" text-anchor="middle" fill="#93c5fd" font-size="4" font-weight="700">Param</text>
      <text x="346" y="64" text-anchor="middle" fill="#64748b" font-size="4">data source ready</text>
      <text x="346" y="84" text-anchor="middle" fill="#3b82f6" font-size="4.5">→ Parameterized Runner</text>
      <text x="346" y="95" text-anchor="middle" fill="#a6e3a1" font-size="4">runs per data row</text>
      <defs><marker id="arr2" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill="#64748b"/></marker></defs>
    </svg>`,
  },

  // ── Setup ────────────────────────────────────────────────────
  setup: async (ctx) => {
    ctx.navigateToTab('scenarios');
    await ctx.delay(300);
    closeInlineNameFormQuiet();
    await closeTestEditorQuiet(ctx);
    deleteTh5DemoScenarios();
    deleteTh5DemoFg();
    await ctx.delay(200);
    // Seed the empty FG shell so it's visible in the tree before step 1 begins.
    const ids = await seedDemoEnvAndService(ctx);
    if (ids) {
      (window as unknown as Record<string, unknown>).__demoTh5Ids = ids;
      await seedTh5EmptyFg(ctx, ids);
      await expandTh5Fg(ctx);
    }
    await ctx.delay(200);
  },

  // ── Cleanup ──────────────────────────────────────────────────
  cleanup: async (ctx) => {
    await closeTestEditorQuiet(ctx);
    closeInlineNameFormQuiet();
    deleteTh5DemoScenarios();
    deleteTh5DemoFg();
    delete (window as unknown as Record<string, unknown>).__demoTh5Ids;
    await ctx.delay(200);
  },

  steps: [
    // ── Step 1: Create a Standard Test ──────────────────────────
    {
      id: 'th5b-create-standard-test',
      title: 'Create a Standard Test',
      description:
        'The **📋 Parameterize** button only appears on **existing saved** standard tests — ' +
        'it converts a working test into a parameterized copy.\n\n' +
        'First, we\'ll create a **Standard scenario** and save a test with a ' +
        '`{{userId}}` URL placeholder. Once it\'s saved, the Parameterize button will ' +
        'appear in the toolbar — ready to convert it in the next step.',

      preAction: async (ctx) => {
        ctx.navigateToTab('scenarios');
        await ctx.delay(200);
        closeInlineNameFormQuiet();
        await closeTestEditorQuiet(ctx);
        const ids = await seedDemoEnvAndService(ctx);
        if (ids) {
          (window as unknown as Record<string, unknown>).__demoTh5Ids = ids;
        }
        deleteTh5DemoFg();
        await ctx.delay(200);

        // Seed an empty FG (no scenarios) so the "+ Scenario" button is visible,
        // then open the inline form — the scenario-kind selector is now in the
        // DOM and will be spotlighted during the reading phase via `highlight`.
        if (ids) {
          await seedTh5EmptyFg(ctx, ids);
        }
        await expandTh5Fg(ctx);
        await ctx.delay(200);
        // Target the + Scenario button inside Data-Driven Demo specifically
        const th5Card = Array.from(document.querySelectorAll<HTMLElement>(HAR.FG_CARD))
          .find(c => c.querySelector(HAR.FG_NAME)?.textContent?.trim() === TH5_FG_NAME);
        const addScenarioBtn = th5Card?.querySelector<HTMLElement>(HAR.ADD_SCENARIO_BTN)
          ?? document.querySelector<HTMLElement>(HAR.ADD_SCENARIO_BTN);
        addScenarioBtn?.click();
        await ctx.waitFor(HAR.SCENARIO_NAME_INPUT, 3000);
        await ctx.delay(200);
      },

      highlight: '.scenario-kind-selector',

      action: async (ctx) => {
        // Spotlight the Standard option so the learner clearly sees it selected.
        const standardRadio = document.querySelector<HTMLInputElement>('input[name="scenario-kind"][value="standard"]');
        if (standardRadio) {
          const label = standardRadio.closest<HTMLElement>('label');
          if (label) {
            await spotlight(label, 1400, ctx);
          }
          standardRadio.click();
          standardRadio.dispatchEvent(new Event('change', { bubbles: true }));
          await ctx.delay(200);
        }

        await ctx.fill(HAR.SCENARIO_NAME_INPUT, TH5_SCENARIO_NAME);
        await ctx.delay(220);
        const confirmScBtn = document.querySelector<HTMLElement>('.inline-name-form.nested .btn.btn-primary');
        if (confirmScBtn) {
          await spotlight(confirmScBtn, 700, ctx);
          await ctx.delay(150);
          confirmScBtn.click();
        }
        await ctx.delay(450);

        // Add normal test (+ Test)
        await expandFirstScenario(ctx);
        await ctx.delay(220);
        const addTestBtn = document.querySelector<HTMLElement>(HAR.ADD_TEST_BTN);
        if (addTestBtn) {
          await spotlight(addTestBtn, 900, ctx);
          await ctx.delay(200);
          addTestBtn.click();
        }
        await ctx.waitFor(HAR.TE_PROP_CARD, 5000);
        await ctx.delay(450);

        const nameInput = document.querySelector<HTMLInputElement>(HAR.TE_NAME_INPUT);
        if (nameInput) {
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
          setter?.call(nameInput, 'Get User by ID');
          nameInput.dispatchEvent(new Event('input', { bubbles: true }));
          await ctx.delay(220);
        }

        const urlInput = document.querySelector<HTMLInputElement>(HAR.TE_URL_INPUT);
        if (urlInput) {
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
          setter?.call(urlInput, 'https://jsonplaceholder.typicode.com/users/{{userId}}');
          urlInput.dispatchEvent(new Event('input', { bubbles: true }));
          await ctx.delay(260);
        }

        const saveBtn = document.querySelector<HTMLElement>(HAR.TE_SAVE_BTN);
        if (saveBtn) {
          await spotlight(saveBtn, 900, ctx);
          await ctx.delay(200);
          saveBtn.click();
          await ctx.delay(800);
        }

        // Spotlight the test card in the tree
        const testCard = document.querySelector<HTMLElement>(HAR.TEST_CARD);
        if (testCard) {
          await spotlight(testCard, 1800, ctx);
        }
      },

      verify: HAR.TEST_CARD,
    },

    // ── Step 2: Parameterize & Configure ────────────────────────
    {
      id: 'th5b-parameterize-wizard',
      title: 'Parameterize & Configure',
      description:
        'Open the saved test and click **📋 Parameterize** in the toolbar — it appears ' +
        'because the test is already saved.\n\n' +
        'Click **Create Parameterized Copy** to launch the wizard:\n' +
        '1. **Detect Variables** — `{{userId}}` auto-detected\n' +
        '2. **Configure Columns** — review column mapping\n' +
        '3. **Validate Fields** — optional response assertions\n' +
        '4. **Column Order** — arrange columns\n' +
        '5. **Review** — set the **New Scenario Name** for the Parameterized Scenario that will hold the copy\n\n' +
        'After **Create & Open**, add a row label and fill `userId = 1`. ' +
        'The original test stays untouched in the Standard scenario.',

      preAction: async (ctx) => {
        // Ensure we have a standard test to convert
        if (!document.querySelector(HAR.TEST_CARD)) {
          ctx.navigateToTab('scenarios');
          await ctx.delay(200);
          closeInlineNameFormQuiet();
          await closeTestEditorQuiet(ctx);
          deleteTh5DemoFg();
          await ctx.delay(200);
          await ensureTh5StandardFgExists(ctx, { force: true });
          await ctx.delay(300);
          await expandFirstFg(ctx);
          await expandFirstScenario(ctx);
          await ctx.delay(200);
        }
      },

      action: async (ctx) => {
        // Open the editor via Edit button
        const editBtn = document.querySelector<HTMLElement>(HAR.TEST_EDIT_BTN);
        if (editBtn) {
          await spotlight(editBtn, 1200, ctx);
          await ctx.delay(300);
          editBtn.click();
          await ctx.waitFor(HAR.TE_PROP_CARD, 5000);
          await ctx.delay(600);
        }

        // Click the Parameterize button in the header toolbar
        const paramBtn = document.querySelector<HTMLElement>(HAR.TE_PARAMETERIZE_BTN);
        if (paramBtn) {
          await spotlight(paramBtn, 2000, ctx);
          await ctx.delay(400);
          paramBtn.click();
          // Kill the ring before the Data/Parameterize tab swaps in.
          purgeAllSpotlightRings();
        }
        await ctx.delay(800);

        // Click "Create Parameterized Copy" button.
        // NOTE: do NOT spotlight this button — it stays mounted in the
        // background behind the wizard, and a live-tracking ring on it shows
        // through as a ghost highlight over the wizard content.
        const createBtn = Array.from(document.querySelectorAll<HTMLElement>('.parameterize-empty .btn-primary'))
          .find(btn => btn.textContent?.includes('Create Parameterized Copy'));
        if (createBtn) {
          createBtn.click();
          // Kill any lingering ring so nothing tracks the backgrounded button.
          purgeAllSpotlightRings();
        }
        // Wait for the setup wizard to open
        await ctx.delay(900);

        // Walk through the wizard stages
        const findWizard = () => document.querySelector<HTMLElement>('.ds-setup-dialog, .full-panel-modal');
        const findBtnInWizard = (labelPart: string): HTMLElement | null => {
          const wizard = findWizard();
          if (!wizard) return null;
          return Array.from(wizard.querySelectorAll<HTMLElement>('button'))
            .find((btn) => btn.textContent?.trim().includes(labelPart) && !btn.hasAttribute('disabled')) ?? null;
        };

        const nextColumnsBtn = findBtnInWizard('Next: Columns');
        if (nextColumnsBtn) {
          await spotlight(nextColumnsBtn, 1600, ctx);
          await ctx.delay(250);
          nextColumnsBtn.click();
          await ctx.delay(900);
        }

        const nextValidate = findBtnInWizard('Next: Validate Fields');
        if (nextValidate) {
          await spotlight(nextValidate, 1500, ctx);
          await ctx.delay(250);
          nextValidate.click();
          await ctx.delay(900);
        }

        const nextOrder = findBtnInWizard('Next: Column Order');
        if (nextOrder) {
          await spotlight(nextOrder, 1500, ctx);
          await ctx.delay(250);
          nextOrder.click();
          await ctx.delay(900);
        }

        const nextReview = findBtnInWizard('Next: Review');
        if (nextReview) {
          await spotlight(nextReview, 1500, ctx);
          await ctx.delay(250);
          nextReview.click();
          await ctx.delay(900);
        }

        // On the Review step: spotlight and fill the "New Scenario Name" field
        // so the copy lands in a Parameterized scenario (visible in Parameterized Runner).
        const newScenarioInput = document.querySelector<HTMLInputElement>('[data-testid="param-new-scenario-name-input"]');
        if (newScenarioInput) {
          await spotlight(newScenarioInput, 2000, ctx);
          await ctx.delay(400);
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
          setter?.call(newScenarioInput, 'User Tests (Parameterized)');
          newScenarioInput.dispatchEvent(new Event('input', { bubbles: true }));
          await ctx.delay(1200);
        }

        const createOpenBtn = findBtnInWizard('Create & Open');
        if (createOpenBtn) {
          await spotlight(createOpenBtn, 1700, ctx);
          await ctx.delay(250);
          createOpenBtn.click();
          await ctx.delay(1200);
        }

        // Arrive on the newly converted test editor
        await ctx.waitFor(HAR.TE_PROP_CARD, 5000);
        await ctx.delay(400);

        // Give the first data row a readable label so the grid isn't blank.
        await ctx.waitFor('.data-source-row', 4000);
        const rowLabelInput = document.querySelector<HTMLElement>('.data-source-row .data-source-label-input');
        if (rowLabelInput) {
          rowLabelInput.scrollIntoView({ block: 'center', inline: 'nearest' });
          await spotlight(rowLabelInput, 1100, ctx);
          fillDsRowLabel(0, 'Sample User');
          await ctx.delay(700);
        }

        // Replace the placeholder value ({{userId}}) with a concrete sample id
        // so the row runs against a real value instead of the variable itself.
        const userIdCell = document.querySelector<HTMLElement>('input.data-source-cell-input[data-row="0"][data-col="0"]');
        if (userIdCell) {
          userIdCell.scrollIntoView({ block: 'center', inline: 'nearest' });
          await spotlight(userIdCell, 1100, ctx);
          fillDsDataCell(0, 0, '1');
          await ctx.delay(700);
        }
      },

      verify: HAR.TE_PROP_CARD,
    },

    // ── Step 3: Save & Confirm Conversion ───────────────────────
    {
      id: 'th5b-confirm-converted',
      title: 'Save & Confirm Conversion',
      description:
        'Finalize the conversion:\n\n' +
        '1. Review the **Data Source** tab — `userId` column and data row are pre-wired\n' +
        '2. Click **Save** in the converted test editor\n' +
        '3. Close the editor — you now have **two separate scenarios**:\n\n' +
        '   - **User Tests** (Standard) → original test, unchanged, runs in Test Runner\n' +
        '   - **User Tests (Parameterized)** (Parameterized) → copy with Param badge, runs in **Parameterized Runner**\n\n' +
        'The conversion is complete. Use the Parameterized Runner to execute the copy against multiple data rows.',
      highlight: HAR.TE_DS_TAB,

      preAction: async (ctx) => {
        // If the converted editor isn't open, rebuild a parameterized test to review.
        if (isTestEditorOpen() && document.querySelector(HAR.TE_PROP_CARD)) return;

        ctx.navigateToTab('scenarios');
        await ctx.delay(200);
        closeInlineNameFormQuiet();
        await closeTestEditorQuiet(ctx);
        deleteTh5DemoFg();
        await ctx.delay(200);
        await ensureTh5FgExists(ctx, { force: true });
        await ctx.delay(300);
        await expandFirstFg(ctx);
        await expandFirstScenario(ctx);
        await ctx.delay(220);

        const cards = Array.from(document.querySelectorAll<HTMLElement>(HAR.TEST_CARD));
        const convertedCard = cards.find((card) => /\(Parameterized\)/i.test(card.textContent ?? '')) ?? cards[0] ?? null;
        const editBtn = convertedCard?.querySelector<HTMLElement>(HAR.TEST_EDIT_BTN) ?? document.querySelector<HTMLElement>(HAR.TEST_EDIT_BTN);
        if (editBtn) {
          editBtn.click();
          await ctx.waitFor(HAR.TE_PROP_CARD, 5000);
          await ctx.delay(400);
        }

        // Land on the Data Source tab so the parameterized config is visible.
        const dsTab = document.querySelector<HTMLElement>(HAR.TE_DS_TAB);
        if (dsTab) {
          dsTab.click();
          await ctx.delay(300);
        }
      },

      action: async (ctx) => {
        // Reveal the parameterized Data Source configuration
        const dsTab = document.querySelector<HTMLElement>(HAR.TE_DS_TAB);
        if (dsTab) {
          await spotlight(dsTab, 1200, ctx);
          dsTab.click();
          await ctx.delay(450);
          const dsGrid = document.querySelector<HTMLElement>(HAR.DS_GRID);
          if (dsGrid) {
            dsGrid.scrollIntoView({ block: 'center', inline: 'nearest' });
            await spotlight(dsGrid, 2000, ctx);
            await ctx.delay(300);
          }
        }

        // Save the converted test editor
        const saveBtn = document.querySelector<HTMLElement>(HAR.TE_SAVE_BTN);
        if (saveBtn) {
          await spotlight(saveBtn, 1400, ctx);
          await ctx.delay(220);
          saveBtn.click();
          await ctx.delay(900);
        }

        // Close the editor and return to the tree
        await closeTestEditorQuiet(ctx);
        await ctx.delay(250);

        // Expand the feature group and ALL scenarios so both are visible
        await expandFirstFg(ctx);
        await ctx.delay(300);
        const allScenarioHeaders = document.querySelectorAll<HTMLElement>(HAR.SCENARIO_HEADER);
        for (const header of allScenarioHeaders) {
          const expandIcon = header.querySelector('.expand-icon');
          if (expandIcon && !expandIcon.classList.contains('expanded')) {
            header.click();
            await ctx.delay(350);
          }
        }
        await ctx.delay(400);

        // Spotlight the Parameterized scenario header (new copy destination)
        const paramScenarioHeader = Array.from(document.querySelectorAll<HTMLElement>(HAR.SCENARIO_HEADER))
          .find(h => /parameterized/i.test(h.textContent ?? ''));
        if (paramScenarioHeader) {
          await spotlight(paramScenarioHeader, 1600, ctx);
          await ctx.delay(200);
        }

        // Spotlight the Param badge on the converted test card
        const paramBadge = document.querySelector<HTMLElement>(HAR.TEST_PARAM_BADGE);
        if (paramBadge) {
          await spotlight(paramBadge, 2200, ctx);
        }
      },

      verify: HAR.TEST_PARAM_BADGE,
    },
  ],
};
