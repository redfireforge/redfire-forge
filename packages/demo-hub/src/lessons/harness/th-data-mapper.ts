/**
 * TH-11: Data Mapper for Validation
 *
 * Tour of the visual Data Mapper — layout, auto-mapping, operator pills,
 * Expression Editor, Mapping View (Code / Table List & Pivot), Verify All
 * vs Fetch & Verify, and saving rules back to the test editor.
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
  isTestEditorOpen,
  closeTestEditorQuiet,
  clickValidationTab,
  closeDataMapperModal,
  isDataMapperOpen,
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
  if (!isDataMapperOpen()) {
    await ensureEditorOnValidation(ctx);
    const mapperBtn = document.querySelector<HTMLElement>(HAR.TE_MAPPER_BTN);
    if (mapperBtn && !mapperBtn.hasAttribute('disabled')) {
      mapperBtn.click();
      await ctx.delay(800);
    }
  }
  // Dismiss schema drift banner if visible
  const acceptBtn = document.querySelector<HTMLElement>('.dm-drift-btn--accept');
  if (acceptBtn) {
    acceptBtn.click();
    await ctx.delay(300);
  }
}

export const thDataMapperLesson: DemoLesson = {
  id: 'th-data-mapper-validation',
  domainId: 'harness',
  category: 'validation',
  name: 'Data Mapper for Validation',
  description:
    'Build validation rules visually — auto-map fields, set operators, edit expressions, ' +
    'review Code/Table views, and verify against sample data or a live API response.',
  estimatedMinutes: 10,
  initialTab: 'scenarios',
  allowedTabs: ['scenarios'],
  concept: {
    title: 'Visual Validation with the Data Mapper',
    body:
      'The **Data Mapper** turns a response body into validation rules with a two-panel layout:\n\n' +
      '- **Source panel** — response JSON tree with type pills, search, and coverage health\n' +
      '- **Target panel** — mapped rules with **operator pills** (equals, is_not_empty, …)\n' +
      '- **Auto-map** — creates mappings instantly via 3-tier name matching\n' +
      '- **Expression Editor** — double-click a mapped badge to write functions and preview live\n' +
      '- **Mapping View** — bottom panel with **Code** lines or **Table** (List / Pivot layouts)\n' +
      '- **Verify All** — checks rules against stored sample data (offline)\n' +
      '- **Fetch & Verify** — hits the live API, then verifies against a fresh response\n' +
      '- **Save** — applies mapped rules back to the test, then Verify in the editor\n' +
      '- **Host Override** — ad-hoc base URL for Verify (point at dev / qa / prod without changing Settings)',
    keyTerms: [
      { term: 'Auto-map', definition: 'Creates mappings automatically using exact path, fuzzy name, and type matching.' },
      { term: 'Operator Pill', definition: 'Inline badge on each target node that sets how the value is compared.' },
      { term: 'Expression Editor', definition: 'Opened by double-clicking a mapped badge — function catalog, fixed values, and live preview.' },
      { term: 'Mapping View', definition: 'Bottom dock showing Code lines or a Table (List / Pivot) of all mappings.' },
      { term: 'Verify All', definition: 'Checks every mapping against the stored sample response — instant, offline.' },
      { term: 'Fetch & Verify', definition: 'Fetches a live API response, then verifies rules against real data.' },
      { term: 'Host Override', definition: 'Temporarily overrides the Settings base URL for Verify — switch between env hosts without changing the global config.' },
    ],
    diagram: `<svg viewBox="0 0 420 95" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="8" width="88" height="78" rx="5" fill="#1e293b" stroke="#3b82f6" stroke-width="1.5"/>
      <text x="49" y="24" text-anchor="middle" fill="#3b82f6" font-size="7" font-weight="700">Source</text>
      <text x="49" y="40" text-anchor="middle" fill="#94a3b8" font-size="5.5">{ id: 1 }</text>
      <text x="49" y="52" text-anchor="middle" fill="#94a3b8" font-size="5.5">{ name: "..." }</text>
      <text x="49" y="64" text-anchor="middle" fill="#94a3b8" font-size="5.5">{ email: "..." }</text>
      <text x="49" y="78" text-anchor="middle" fill="#64748b" font-size="5">type pills</text>
      <path d="M98 30 L140 30" stroke="#10b981" stroke-width="1.5" stroke-dasharray="4"/>
      <path d="M98 48 L140 48" stroke="#10b981" stroke-width="1.5" stroke-dasharray="4"/>
      <path d="M98 66 L140 66" stroke="#10b981" stroke-width="1.5" stroke-dasharray="4"/>
      <text x="119" y="22" text-anchor="middle" fill="#10b981" font-size="5">auto-map</text>
      <rect x="145" y="8" width="100" height="78" rx="5" fill="#1e293b" stroke="#f59e0b" stroke-width="1.5"/>
      <text x="195" y="24" text-anchor="middle" fill="#f59e0b" font-size="7" font-weight="700">Target</text>
      <text x="195" y="40" text-anchor="middle" fill="#94a3b8" font-size="5.5">id equals 1</text>
      <text x="195" y="52" text-anchor="middle" fill="#94a3b8" font-size="5.5">name is_not_empty</text>
      <text x="195" y="64" text-anchor="middle" fill="#94a3b8" font-size="5.5">dbl-click → expr</text>
      <text x="195" y="78" text-anchor="middle" fill="#64748b" font-size="5">operator pills</text>
      <path d="M250 35 L275 28" stroke="#64748b" stroke-width="1.2" marker-end="url(#th11arr)"/>
      <path d="M250 55 L275 62" stroke="#64748b" stroke-width="1.2" marker-end="url(#th11arr)"/>
      <rect x="280" y="5" width="64" height="40" rx="5" fill="#1e293b" stroke="#a78bfa" stroke-width="1.5"/>
      <text x="312" y="22" text-anchor="middle" fill="#a78bfa" font-size="6.5" font-weight="700">Mapping</text>
      <text x="312" y="34" text-anchor="middle" fill="#a78bfa" font-size="5.5">Code · Table</text>
      <rect x="280" y="52" width="64" height="36" rx="5" fill="#1e293b" stroke="#10b981" stroke-width="1.5"/>
      <text x="312" y="68" text-anchor="middle" fill="#10b981" font-size="6.5" font-weight="700">Verify</text>
      <text x="312" y="80" text-anchor="middle" fill="#10b981" font-size="5">All · Fetch</text>
      <path d="M349 25 L370 25" stroke="#64748b" stroke-width="1.2" marker-end="url(#th11arr)"/>
      <path d="M349 70 L370 70" stroke="#64748b" stroke-width="1.2" marker-end="url(#th11arr)"/>
      <rect x="375" y="18" width="40" height="60" rx="5" fill="#1e293b" stroke="#3b82f6" stroke-width="1.5"/>
      <text x="395" y="42" text-anchor="middle" fill="#3b82f6" font-size="6.5" font-weight="700">Save</text>
      <text x="395" y="56" text-anchor="middle" fill="#94a3b8" font-size="5">to test</text>
      <defs><marker id="th11arr" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill="#64748b"/></marker></defs>
    </svg>`,
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
      highlight: HAR.TEST_EDIT_BTN,
      action: async (ctx) => {
        // 1. Highlight Edit button and click to open test editor
        if (!isTestEditorOpen()) {
          await expandFirstFg(ctx);
          await expandFirstScenario(ctx);
          await ctx.delay(400);
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

        // 3. Highlight Data Mapper button and click it
        const mapperBtn = document.querySelector<HTMLElement>(HAR.TE_MAPPER_BTN);
        if (mapperBtn && !mapperBtn.hasAttribute('disabled')) {
          await spotlight(mapperBtn, 2000, ctx);
          mapperBtn.click();
          await ctx.delay(800);
        }

        // Dismiss schema drift banner if it appears
        const driftAccept = document.querySelector<HTMLElement>('.dm-drift-btn--accept');
        if (driftAccept) {
          driftAccept.click();
          await ctx.delay(300);
        }

        // 4. Pause to let the viewer see the two-panel layout
        await ctx.delay(1500);

        // Spotlight the "Source" panel header label
        const sourceHeader = document.querySelector<HTMLElement>('.dm-panel-header');
        if (sourceHeader) await spotlight(sourceHeader, 2000, ctx);

        // Spotlight the "Target" panel header label
        const targetHeaders = document.querySelectorAll<HTMLElement>('.dm-panel-header');
        if (targetHeaders.length > 1) await spotlight(targetHeaders[1], 2000, ctx);
      },
      preAction: async (ctx) => {
        await ensureTh11Ready(ctx);
        if (isDataMapperOpen()) closeDataMapperModal();
        await ctx.delay(100);
        if (isTestEditorOpen()) await closeTestEditorQuiet(ctx);
        await ctx.delay(100);
        await expandFirstFg(ctx);
        await expandFirstScenario(ctx);
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
        // Spotlight type pills so the viewer sees them
        const typePills = document.querySelectorAll<HTMLElement>(HAR.MAPPER_TYPE_PILL);
        if (typePills.length > 1) {
          await spotlight(typePills[0], 1200, ctx);
          await spotlight(typePills[1], 1200, ctx);
        }

        // Highlight the search input BEFORE typing
        const searchInput = document.querySelector<HTMLElement>(HAR.MAPPER_SEARCH);
        if (searchInput) {
          await spotlight(searchInput, 1800, ctx);
          fillMapperSearch('address');
          await ctx.delay(1500);
          // Spotlight the filtered tree results
          const filteredNodes = document.querySelectorAll<HTMLElement>('.dm-tree-node');
          if (filteredNodes.length > 0) {
            await spotlight(filteredNodes[0], 1800, ctx);
          }
          await ctx.delay(800);
          clearMapperSearch();
          await ctx.delay(600);
        }

        // Spotlight the coverage health bar
        const health = document.querySelector<HTMLElement>(HAR.MAPPER_HEALTH);
        if (health) await spotlight(health, 2000, ctx);
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
      highlight: HAR.MAPPER_AUTOMAP,
      action: async (ctx) => {
        // Spotlight the Auto-map button before clicking
        const autoMapBtn = document.querySelector<HTMLElement>(HAR.MAPPER_AUTOMAP);
        if (autoMapBtn) {
          await spotlight(autoMapBtn, 2500, ctx);
          autoMapBtn.click();
          await ctx.delay(2500);
        }

        // Spotlight the mapping status bar (e.g. "13 mapped")
        const status = document.querySelector<HTMLElement>(HAR.MAPPER_STATUS);
        if (status) await spotlight(status, 2500, ctx);

        // Spotlight a specific operator pill on a mapped node
        const pill = document.querySelector<HTMLElement>(HAR.MAPPER_OPERATOR_PILL);
        if (pill) await spotlight(pill, 2500, ctx);
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
        // Spotlight the operator pill before clicking
        const pill = document.querySelector<HTMLElement>(HAR.MAPPER_OPERATOR_PILL);
        if (pill) {
          await spotlight(pill, 2500, ctx);
          pill.click();
          await ctx.delay(1200);

          const picker = document.querySelector<HTMLElement>(HAR.MAPPER_OPERATOR_PICKER);
          if (picker) {
            await spotlight(picker, 3000, ctx);

            // Find and spotlight the "is not empty" item before clicking
            const items = picker.querySelectorAll<HTMLElement>('.dm-op-picker-item');
            for (const item of items) {
              const label = item.querySelector('.dm-op-picker-label')?.textContent?.trim();
              if (label === 'is not empty') {
                await spotlight(item, 2500, ctx);
                item.click();
                await ctx.delay(1200);
                break;
              }
            }
          } else {
            document.body.click();
            await ctx.delay(300);
          }
        }

        // Spotlight the updated pill showing the new operator
        await ctx.delay(600);
        const updatedPill = document.querySelector<HTMLElement>(HAR.MAPPER_OPERATOR_PILL);
        if (updatedPill) await spotlight(updatedPill, 2500, ctx);
      },
      preAction: async (ctx) => {
        await ensureTh11Ready(ctx);
        if (!isDataMapperOpen()) await ensureMapperOpen(ctx);
      },
      verify: HAR.MAPPER_OPERATOR_PILL,
    },

    // ── Step 5: Expression Editor ─────────────────────────────────
    {
      id: 'th11-expression-editor',
      title: 'Expression Editor',
      description:
        '**Double-click** any mapped badge (green pill showing source → target) on the Target panel ' +
        'to open the **Expression Editor**. Here you can write custom expressions, choose functions ' +
        'from the catalog (String, Math, Array, DateTime…), set fixed values, and preview the result ' +
        'live against your sample data.',
      highlight: HAR.MAPPER_TARGET,
      action: async (ctx) => {
        // 1. Spotlight the Target panel header so viewer knows where to look
        const targetHeader = document.querySelectorAll<HTMLElement>('.dm-panel-header');
        if (targetHeader.length > 1) await spotlight(targetHeader[1], 2000, ctx);

        // 2. Spotlight the "Target" section with mapped nodes to orient the viewer
        const targetNodes = document.querySelectorAll<HTMLElement>('.dm-target-tree .dm-tree-node');
        if (targetNodes.length > 1) {
          targetNodes[1].scrollIntoView({ block: 'nearest' });
          await ctx.delay(500);
        }

        // 3. Find and spotlight a mapped badge (green pill) — highlight with long pause
        const badge = document.querySelector<HTMLElement>('.dm-mapped-badge');
        if (badge) {
          badge.scrollIntoView({ block: 'nearest' });
          await ctx.delay(400);
          await spotlight(badge, 3000, ctx);

          // 4. Double-click the badge to open Expression Editor
          badge.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
          await ctx.delay(1500);
        }

        // 5. Wait for the Expression Editor modal to appear
        const start = Date.now();
        let exprModal: HTMLElement | null = null;
        while (Date.now() - start < 5000) {
          exprModal = document.querySelector<HTMLElement>('.dm-expr-modal');
          if (exprModal) break;
          await ctx.delay(200);
        }

        if (exprModal) {
          // 6. Spotlight the Variable Name field
          const varRow = exprModal.querySelector<HTMLElement>('.dm-expr-variable-row');
          if (varRow) await spotlight(varRow, 2500, ctx);

          // 7. Spotlight the function catalog sidebar
          const sidebar = exprModal.querySelector<HTMLElement>('.dm-expr-sidebar');
          if (sidebar) await spotlight(sidebar, 2500, ctx);

          // 8. Spotlight the Live Preview section
          const preview = exprModal.querySelector<HTMLElement>('.dm-expr-preview-section');
          if (preview) await spotlight(preview, 2500, ctx);

          await ctx.delay(1000);

          // 9. Close the Expression Editor (Cancel)
          const cancelBtn = exprModal.querySelector<HTMLElement>('.dm-expr-btn--cancel');
          if (cancelBtn) {
            cancelBtn.click();
            await ctx.delay(600);
          }
        }
      },
      preAction: async (ctx) => {
        await ensureTh11Ready(ctx);
        if (!isDataMapperOpen()) await ensureMapperOpen(ctx);
        // Close Expression Editor if already open
        const existing = document.querySelector<HTMLElement>('.dm-expr-modal .dm-expr-btn--cancel');
        if (existing) { existing.click(); await ctx.delay(300); }
      },
      verify: HAR.MAPPER_OPERATOR_PILL,
    },

    // ── Step 6: Code View ──────────────────────────────────────────
    {
      id: 'th11-code-view',
      title: 'Code View',
      description:
        'The **Code** view shows each mapping as a readable text line: `target ← source`. ' +
        'This is useful for quickly reviewing all your rules in a compact format, ' +
        'copying them for documentation, or spotting misconfigured mappings at a glance.',
      highlight: HAR.MAPPER_CODE_BTN,
      action: async (ctx) => {
        // Spotlight and click the "Code" mode button
        const codeBtn = document.querySelector<HTMLElement>(HAR.MAPPER_CODE_BTN);
        if (codeBtn) {
          await spotlight(codeBtn, 2500, ctx);
          codeBtn.click();
          await ctx.delay(1800);
        }

        // Spotlight the entire Mapping View box so viewer sees the full code output
        const codeView = document.querySelector<HTMLElement>(HAR.MAPPER_CODE_VIEW);
        if (codeView) await spotlight(codeView, 3000, ctx);
      },
      preAction: async (ctx) => {
        await ensureTh11Ready(ctx);
        if (!isDataMapperOpen()) await ensureMapperOpen(ctx);
      },
      verify: HAR.MAPPER_CODE_VIEW,
    },

    // ── Step 7: Table View (List & Pivot) ──────────────────────────
    {
      id: 'th11-table-view',
      title: 'Table View (List & Pivot)',
      description:
        'Inside the **Mapping View** panel, switch from Code to **Table** mode. ' +
        'It has two sub-modes:\n\n' +
        '• **List** — flat table with Target, Source, Before/After, Trace, and Status columns\n\n' +
        '• **Pivot** — groups rows by common array prefix for compact comparison\n\n' +
        'Use List for reviewing individual rules; Pivot for array-heavy validations.',
      highlight: HAR.MAPPER_CODE_VIEW,
      action: async (ctx) => {
        // Ensure the Mapping View panel is open (via top toolbar "Code" button)
        if (!document.querySelector(HAR.MAPPER_CODE_VIEW)) {
          const codeBtn = document.querySelector<HTMLElement>(HAR.MAPPER_CODE_BTN);
          if (codeBtn) {
            codeBtn.click();
            await ctx.delay(1000);
          }
        }

        // Find the Code/Table mode toggle inside the Mapping View panel
        const tableModeBtn = Array.from(document.querySelectorAll<HTMLElement>('.dm-code-view-mode-btn'))
          .find(b => b.textContent?.trim() === 'Table');
        if (tableModeBtn) {
          await spotlight(tableModeBtn, 2500, ctx);
          tableModeBtn.click();
          await ctx.delay(1500);
        }

        // Spotlight List badge, then the Mapping View box only (not the table —
        // table height can overflow and draw a longer ring outside the panel)
        const listBtn = Array.from(document.querySelectorAll<HTMLElement>('.validation-fields-view-btn'))
          .find(b => b.textContent?.trim() === 'List');
        if (listBtn) await spotlight(listBtn, 2500, ctx);

        const mappingView = document.querySelector<HTMLElement>(HAR.MAPPER_CODE_VIEW);
        if (mappingView) await spotlight(mappingView, 3000, ctx);

        // Spotlight and click Pivot badge (if available)
        const pivotBtn = Array.from(document.querySelectorAll<HTMLElement>('.validation-fields-view-btn'))
          .find(b => b.textContent?.trim() === 'Pivot');
        if (pivotBtn && !pivotBtn.hasAttribute('disabled')) {
          await spotlight(pivotBtn, 2500, ctx);
          pivotBtn.click();
          await ctx.delay(1500);
          const afterPivot = document.querySelector<HTMLElement>(HAR.MAPPER_CODE_VIEW);
          if (afterPivot) await spotlight(afterPivot, 3000, ctx);
        }
      },
      preAction: async (ctx) => {
        await ensureTh11Ready(ctx);
        if (!isDataMapperOpen()) await ensureMapperOpen(ctx);
        // Ensure Mapping View panel is open
        if (!document.querySelector(HAR.MAPPER_CODE_VIEW)) {
          const codeBtn = document.querySelector<HTMLElement>(HAR.MAPPER_CODE_BTN);
          if (codeBtn) { codeBtn.click(); await ctx.delay(500); }
        }
      },
      verify: HAR.MAPPER_CODE_VIEW,
    },

    // ── Step 8: Verify All vs Fetch & Verify ───────────────────────
    {
      id: 'th11-verify',
      title: 'Verify All vs Fetch & Verify',
      description:
        'Two verification modes:\n\n' +
        '• **Verify All** — checks rules against the stored **sample data** (instant, offline, no network needed)\n\n' +
        '• **Fetch & Verify** — hits the **live API**, fetches a fresh response, and verifies rules against real data\n\n' +
        'Use Verify All during design iteration; Fetch & Verify for final confirmation before saving.',
      highlight: HAR.MAPPER_VERIFY_BTN,
      action: async (ctx) => {
        // Find both verify buttons
        const verifyBtns = document.querySelectorAll<HTMLElement>(HAR.MAPPER_VERIFY_BTN);
        const verifyAllBtn = Array.from(verifyBtns).find(b => b.textContent?.includes('Verify All'));
        const fetchVerifyBtn = Array.from(verifyBtns).find(b => b.textContent?.includes('Fetch'));

        // Spotlight "Verify All" button with explanation pause
        if (verifyAllBtn) {
          await spotlight(verifyAllBtn, 3000, ctx);
          verifyAllBtn.click();
          await ctx.delay(2000);
        }

        // Spotlight verification badges on nodes
        const badge = document.querySelector<HTMLElement>(HAR.MAPPER_VERIFY_BADGE);
        if (badge) await spotlight(badge, 2500, ctx);

        // Spotlight the summary bar
        const summary = document.querySelector<HTMLElement>(HAR.MAPPER_VERIFY_SUMMARY);
        if (summary) await spotlight(summary, 2500, ctx);

        // Now spotlight "Fetch & Verify" button
        if (fetchVerifyBtn) {
          await spotlight(fetchVerifyBtn, 3000, ctx);
          fetchVerifyBtn.click();

          // Spotlight the "Fetching live response…" toast while it is visible
          const toastStart = Date.now();
          let toast: HTMLElement | null = null;
          while (Date.now() - toastStart < 4000) {
            const candidate = document.querySelector<HTMLElement>('.dm-toast');
            if (candidate?.textContent?.includes('Fetching live response')) {
              toast = candidate;
              break;
            }
            await ctx.delay(100);
          }
          if (toast) await spotlight(toast, 2500, ctx);
          else await ctx.delay(1500);

          // Show updated summary after live fetch completes
          await ctx.delay(1000);
          const updatedSummary = document.querySelector<HTMLElement>(HAR.MAPPER_VERIFY_SUMMARY);
          if (updatedSummary) await spotlight(updatedSummary, 2500, ctx);
        }
      },
      preAction: async (ctx) => {
        await ensureTh11Ready(ctx);
        if (!isDataMapperOpen()) await ensureMapperOpen(ctx);
      },
      verify: HAR.MAPPER_VERIFY_BADGE,
    },

    // ── Step 9: Save & Verify ─────────────────────────────────────
    {
      id: 'th11-save',
      title: 'Save & Verify',
      description:
        'Click **Save** to apply all mapped rules back to the test\'s validation configuration. ' +
        'Then click **Verify** to run the rules against the live API response. ' +
        'When you see the green **PASSED** bar, click the **Response** badge to expand the live ' +
        'HTTP status and response body that was validated.',
      highlight: HAR.MAPPER_SAVE_BTN,
      action: async (ctx) => {
        // Spotlight and click Save
        const saveBtn = document.querySelector<HTMLElement>(HAR.MAPPER_SAVE_BTN);
        if (saveBtn) {
          await spotlight(saveBtn, 1800, ctx);
          saveBtn.click();
          await ctx.delay(1000);
        }

        // Spotlight the rules summary table
        const rules = document.querySelector<HTMLElement>(HAR.TE_VALIDATION_RULES);
        if (rules) await spotlight(rules, 2000, ctx);

        // Scroll down and spotlight the Verify button
        const verifyBtn = document.querySelector<HTMLElement>(HAR.TE_VERIFY_BTN);
        if (verifyBtn) {
          verifyBtn.scrollIntoView({ block: 'center', behavior: 'smooth' });
          await ctx.delay(600);
          await spotlight(verifyBtn, 2500, ctx);
          verifyBtn.click();
          await ctx.delay(2000);
        }

        // Wait for the PASSED/FAILED result bar
        const resultStart = Date.now();
        let result: HTMLElement | null = null;
        while (Date.now() - resultStart < 10000) {
          result = document.querySelector<HTMLElement>(HAR.TE_VERIFY_RESULT);
          if (result) break;
          await ctx.delay(300);
        }
        if (result) {
          result.scrollIntoView({ block: 'center', behavior: 'smooth' });
          await ctx.delay(400);
          await spotlight(result, 2500, ctx);

          // Spotlight and click the Response badge
          const responseToggle = result.querySelector<HTMLElement>('button[aria-label="Toggle response details"]');
          if (responseToggle) {
            await spotlight(responseToggle, 2500, ctx);
            responseToggle.click();
            await ctx.delay(1000);

            // Spotlight the expanded response details (status + body)
            const responseDetail = result.querySelector<HTMLElement>('.validate-response-detail');
            if (responseDetail) {
              responseDetail.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
              await ctx.delay(400);
              await spotlight(responseDetail, 3000, ctx);
            }
          }
        }
      },
      preAction: async (ctx) => {
        await ensureTh11Ready(ctx);
        if (!isDataMapperOpen()) await ensureMapperOpen(ctx);
      },
      verify: HAR.TE_VALIDATION_SEC,
    },

    // ── Step 10: Host Override ────────────────────────────────────
    {
      id: 'th11-host-override',
      title: 'Host Override (Ad-hoc Verify)',
      description:
        '**Host Override** lets you temporarily replace the Settings base URL when verifying — ' +
        'useful for ad-hoc checks against **dev**, **qa**, or **prod** without changing the global environment.\n\n' +
        'Enable the checkbox, confirm the override URL, then click **Verify** to run rules against that host.',
      highlight: HAR.TE_HOST_OVERRIDE,
      action: async (ctx) => {
        // Ensure test editor is open on Validation (mapper closed)
        if (isDataMapperOpen()) {
          closeDataMapperModal();
          await ctx.delay(500);
        }
        await ensureEditorOnValidation(ctx);
        await ctx.delay(400);

        // Scroll to the verify row
        const verifyRow = document.querySelector<HTMLElement>('.validate-response-row');
        if (verifyRow) {
          verifyRow.scrollIntoView({ block: 'center', behavior: 'smooth' });
          await ctx.delay(500);
        }

        // Spotlight Host Override checkbox (disabled URL first, then enable)
        const hostToggle = document.querySelector<HTMLElement>(HAR.TE_HOST_OVERRIDE);
        const hostCheckbox = hostToggle?.querySelector<HTMLInputElement>('input[type="checkbox"]');
        if (hostToggle && hostCheckbox) {
          // Show the disabled URL input before enabling
          const hostInput = document.querySelector<HTMLElement>(HAR.TE_HOST_INPUT);
          if (hostInput) await spotlight(hostInput, 2000, ctx);

          await spotlight(hostToggle, 2500, ctx);
          if (!hostCheckbox.checked) {
            hostCheckbox.click();
            await ctx.delay(800);
          }

          // Spotlight the now-enabled URL input — this is the ad-hoc host
          const enabledInput = document.querySelector<HTMLInputElement>(HAR.TE_HOST_INPUT);
          if (enabledInput) {
            await spotlight(enabledInput, 3000, ctx);
            // Ensure a working override URL is present for the live verify
            if (!enabledInput.value.trim()) {
              const useSettings = document.querySelector<HTMLElement>(
                '.validate-response-row button[title="Use Settings base URL"]',
              );
              if (useSettings) {
                await spotlight(useSettings, 1500, ctx);
                useSettings.click();
                await ctx.delay(600);
              } else {
                await ctx.fill(HAR.TE_HOST_INPUT, 'https://jsonplaceholder.typicode.com');
                await ctx.delay(600);
              }
            }
          }
        }

        // Spotlight and click Verify with the override host
        const verifyBtn = document.querySelector<HTMLElement>(HAR.TE_VERIFY_BTN);
        if (verifyBtn) {
          await spotlight(verifyBtn, 2500, ctx);
          verifyBtn.click();
          await ctx.delay(2000);
        }

        // Spotlight the PASSED result
        const resultStart = Date.now();
        let result: HTMLElement | null = null;
        while (Date.now() - resultStart < 10000) {
          result = document.querySelector<HTMLElement>(HAR.TE_VERIFY_RESULT);
          if (result) break;
          await ctx.delay(300);
        }
        if (result) {
          result.scrollIntoView({ block: 'center', behavior: 'smooth' });
          await ctx.delay(400);
          await spotlight(result, 3000, ctx);
        }
      },
      preAction: async (ctx) => {
        await ensureTh11Ready(ctx);
        if (isDataMapperOpen()) {
          closeDataMapperModal();
          await ctx.delay(300);
        }
        await ensureEditorOnValidation(ctx);
        // Reset Host Override off so the enable action is visible
        const checkbox = document.querySelector<HTMLInputElement>(
          `${HAR.TE_HOST_OVERRIDE} input[type="checkbox"]`,
        );
        if (checkbox?.checked) {
          checkbox.click();
          await ctx.delay(200);
        }
      },
      verify: HAR.TE_VERIFY_RESULT,
    },
  ],
};
