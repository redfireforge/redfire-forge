/**
 * TH-15: Import, Export & cURL
 *
 * cURL import/export in the test editor, Import/Export dropdown menus,
 * FG-level export with version options, and auto-report toggle.
 */
import type { DemoLesson, DemoActionContext } from '../../types';
import { HAR } from '@shared/selectors';
import {
  seedDemoEnvAndService,
  seedTh15FeatureGroup,
  deleteTh15DemoFg,
  ensureTh15FgExists,
  expandFirstFg,
  expandFirstScenario,
  spotlight,
  spotlightSel,
  findModeButton,
  closeExportPopover,
} from './th-demo-helpers';
import { fillControlledInput } from '../setup-helpers';

const TEST_EDITOR_SEL = '.rf-builder-modal';

const CURL_EXAMPLE =
  `curl -X POST https://api.example.com/users \\
  -H 'Authorization: Bearer tok123' \\
  -H 'Content-Type: application/json' \\
  -d '{"name":"Alice","email":"alice@example.com"}'`;

/* ── local helpers ──────────────────────────────────────────── */

async function ensureTh15Ready(ctx: DemoActionContext): Promise<void> {
  await ensureTh15FgExists(ctx);
  if (!document.querySelector(HAR.FG_CARD)) {
    ctx.navigateToTab('scenarios');
    await ctx.delay(500);
  }
  await expandFirstFg(ctx);
  await expandFirstScenario(ctx);
}

function isEditorOpen(): boolean {
  return !!document.querySelector(TEST_EDITOR_SEL);
}

function closeEditor(): void {
  const cancelBtn = document.querySelector<HTMLElement>(HAR.TE_CANCEL_BTN);
  if (cancelBtn) { cancelBtn.click(); return; }
  const modal = document.querySelector<HTMLElement>(TEST_EDITOR_SEL);
  if (!modal) return;
  const close = modal.querySelector<HTMLElement>('.modal-close-btn');
  if (close) close.click();
}

async function openTestEditor(ctx: DemoActionContext): Promise<void> {
  if (isEditorOpen()) return;
  const editBtn = document.querySelector<HTMLElement>(HAR.TEST_EDIT_BTN);
  if (editBtn) {
    editBtn.click();
    await ctx.delay(600);
  }
}

async function switchToBuilderMode(ctx: DemoActionContext): Promise<void> {
  const btn = findModeButton('Builder');
  if (btn && !btn.classList.contains('active')) {
    btn.click();
    await ctx.delay(400);
  }
}

function closeDropdowns(): void {
  const openDropdown = document.querySelector<HTMLElement>(HAR.MODE_DROPDOWN);
  if (!openDropdown) return;
  const wrapper = openDropdown.closest<HTMLElement>('.mode-btn-dropdown-wrapper');
  const trigger = wrapper?.querySelector<HTMLElement>(HAR.MODE_BTN);
  if (trigger) trigger.click();
}

function findAutoReportLabel(): HTMLElement | null {
  const labels = document.querySelectorAll<HTMLElement>('.selection-actions .checkbox-label');
  for (const label of labels) {
    if (label.textContent?.includes('Auto-report')) return label;
  }
  return null;
}

/* ── lesson definition ──────────────────────────────────────── */

export const thImportExportCurlLesson: DemoLesson = {
  id: 'th-import-export-curl',
  domainId: 'harness',
  category: 'authoring',
  name: 'Import, Export & cURL',
  description:
    'Explore the import/export capabilities — cURL import to populate fields from a command, ' +
    'cURL export to generate a ready-to-paste command, Import/Export dropdown menus, ' +
    'FG-level export with version options, and the auto-report toggle.',
  estimatedMinutes: 5,
  initialTab: 'scenarios',
  allowedTabs: ['scenarios', 'runner'],
  concept: {
    title: 'Import, Export & cURL',
    body:
      'The Test Editor header provides multiple import/export paths:\n\n' +
      '- **cURL Import** — paste a cURL command to auto-populate all fields\n' +
      '- **cURL Export** — generate a ready-to-paste cURL command (with resolved tokens)\n' +
      '- **Import/Export ▾** — menus for test definitions, Excel templates, and data rows\n' +
      '- **FG Export** — card-level export with version checkboxes\n' +
      '- **Auto-report** — auto-download reports after each runner completion',
    keyTerms: [
      { term: 'cURL Import', definition: 'Paste a cURL command to auto-populate URL, method, headers, and body.' },
      { term: 'cURL Export', definition: 'Generate a ready-to-paste cURL with resolved variables and auth tokens.' },
      { term: 'FG Export', definition: 'Export an entire Feature Group with optional version snapshots.' },
    ],
    diagram: `<svg viewBox="0 0 380 80" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="10" width="75" height="60" rx="5" fill="#1e293b" stroke="#10b981" stroke-width="1.5"/>
      <text x="42" y="28" text-anchor="middle" fill="#10b981" font-size="7" font-weight="700">Import</text>
      <text x="42" y="42" text-anchor="middle" fill="#94a3b8" font-size="5.5">cURL paste</text>
      <text x="42" y="54" text-anchor="middle" fill="#94a3b8" font-size="5.5">JSON / CSV</text>
      <path d="M85 40 L115 40" stroke="#64748b" stroke-width="1.2" marker-end="url(#th15arr)"/>
      <rect x="120" y="5" width="100" height="70" rx="5" fill="#1e293b" stroke="#3b82f6" stroke-width="1.5"/>
      <text x="170" y="22" text-anchor="middle" fill="#3b82f6" font-size="7" font-weight="700">Test Editor</text>
      <text x="170" y="36" text-anchor="middle" fill="#94a3b8" font-size="5.5">URL + Method</text>
      <text x="170" y="48" text-anchor="middle" fill="#94a3b8" font-size="5.5">Headers + Body</text>
      <text x="170" y="60" text-anchor="middle" fill="#94a3b8" font-size="5.5">Auth + Validation</text>
      <path d="M225 40 L255 40" stroke="#64748b" stroke-width="1.2" marker-end="url(#th15arr)"/>
      <rect x="260" y="10" width="75" height="60" rx="5" fill="#1e293b" stroke="#f59e0b" stroke-width="1.5"/>
      <text x="297" y="28" text-anchor="middle" fill="#f59e0b" font-size="7" font-weight="700">Export</text>
      <text x="297" y="42" text-anchor="middle" fill="#94a3b8" font-size="5.5">cURL command</text>
      <text x="297" y="54" text-anchor="middle" fill="#94a3b8" font-size="5.5">FG + versions</text>
      <defs><marker id="th15arr" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill="#64748b"/></marker></defs>
    </svg>`,
  },

  setup: async (ctx) => {
    deleteTh15DemoFg();
    await ctx.delay(200);
    await seedDemoEnvAndService(ctx);
    await seedTh15FeatureGroup(ctx);
    await ctx.delay(300);
    ctx.navigateToTab('scenarios');
    await ctx.delay(500);
    await expandFirstFg(ctx);
    await expandFirstScenario(ctx);
  },

  cleanup: async (ctx) => {
    closeDropdowns();
    closeExportPopover();
    if (isEditorOpen()) closeEditor();
    await ctx.delay(200);
    deleteTh15DemoFg();
    await ctx.delay(200);
  },

  steps: [
    // ── Step 1: cURL Import ──────────────────────────────────────
    {
      id: 'th15-curl-import',
      title: 'cURL Import',
      description:
        'Start on the **Create User** test row — click **Edit** (the test action, not Import/Export).\n\n' +
        'In the Test Editor header, switch to **cURL Import** and paste a command. The parser ' +
        'fills in **method**, **URL**, **headers**, and **body** automatically. Then click ' +
        '**Import & Switch to Builder** inside the cURL panel (not the top **Import** toolbar ' +
        'button and not the **Import ▾** menu).',
      highlight: HAR.TEST_EDIT_BTN,
      action: async (ctx) => {
        if (!isEditorOpen()) {
          const editBtn = document.querySelector<HTMLElement>(HAR.TEST_EDIT_BTN);
          if (editBtn) {
            editBtn.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
            await spotlight(editBtn, 2000, ctx);
            await ctx.delay(400);
            editBtn.click();
            await ctx.delay(700);
          }
        }

        const curlModeBtn = findModeButton('cURL Import');
        if (curlModeBtn) {
          await spotlight(curlModeBtn, 900, ctx);
          if (!curlModeBtn.classList.contains('active')) {
            curlModeBtn.click();
            await ctx.delay(500);
          }
        }

        const textarea = document.querySelector<HTMLTextAreaElement>(`${HAR.CURL_MODE_PANEL} textarea`);
        if (textarea) {
          await spotlight(textarea, 1000, ctx);
          fillControlledInput(textarea, CURL_EXAMPLE);
          await ctx.delay(800);
        }

        const importBtn = document.querySelector<HTMLElement>(`${HAR.CURL_MODE_PANEL} .btn-primary`);
        if (importBtn) {
          await spotlight(importBtn, 1200, ctx);
          await ctx.delay(250);
          importBtn.click();
          await ctx.delay(700);
        }

        const urlInput = document.querySelector<HTMLElement>(HAR.TE_URL_INPUT);
        if (urlInput) await spotlight(urlInput, 1000, ctx);

        // Body tab opens automatically for JSON imports — show the pretty-printed payload
        const bodyEditor = document.querySelector<HTMLElement>(
          `${TEST_EDITOR_SEL} .body-code-textarea, ${TEST_EDITOR_SEL} textarea.body-code-textarea`,
        );
        if (bodyEditor) {
          await spotlight(bodyEditor, 1600, ctx);
          await ctx.delay(400);
        }
      },
      preAction: async (ctx) => {
        await ensureTh15Ready(ctx);
        closeDropdowns();
        closeExportPopover();
        // Keep the test Edit button visible for the reading spotlight
        if (isEditorOpen()) {
          closeEditor();
          await ctx.delay(300);
        }
      },
      verify: HAR.TE_URL_INPUT,
    },

    // ── Step 2: cURL Export ──────────────────────────────────────
    {
      id: 'th15-curl-export',
      title: 'cURL Export',
      description:
        'Switch to **cURL Export** to generate a ready-to-paste cURL command from the current ' +
        'test configuration. The command includes the resolved URL, all headers, body, and ' +
        'auth tokens. Use **Copy to Clipboard** to grab it, or **Refresh** to regenerate ' +
        'with a fresh OAuth2 token when applicable.',
      highlight: HAR.CURL_EXPORT_TEXTAREA,
      action: async (ctx) => {
        const textarea = document.querySelector<HTMLElement>(HAR.CURL_EXPORT_TEXTAREA);
        if (textarea) await spotlight(textarea, 1200, ctx);

        const actions = document.querySelector<HTMLElement>(`${HAR.CURL_MODE_PANEL} .curl-actions`);
        if (actions) {
          const btns = actions.querySelectorAll<HTMLElement>('.btn');
          for (const btn of btns) {
            if (btn.textContent?.includes('Copy')) {
              await spotlight(btn, 800, ctx);
              break;
            }
          }
          for (const btn of btns) {
            if (btn.textContent?.includes('Refresh')) {
              await spotlight(btn, 600, ctx);
              break;
            }
          }
        }

        await switchToBuilderMode(ctx);
      },
      preAction: async (ctx) => {
        await ensureTh15Ready(ctx);
        closeDropdowns();
        closeExportPopover();
        if (!isEditorOpen()) await openTestEditor(ctx);
        await switchToBuilderMode(ctx);
        await ctx.delay(200);

        const exportBtn = findModeButton('cURL Export');
        if (exportBtn && !exportBtn.classList.contains('active')) {
          exportBtn.click();
          await ctx.delay(600);
        }
      },
      verify: TEST_EDITOR_SEL,
    },

    // ── Step 3: Import & Export Menus ────────────────────────────
    {
      id: 'th15-editor-menus',
      title: 'Import & Export Menus',
      description:
        'Still in the **Test Editor** toolbar: **Import ▾** and **Export ▾** sit next to ' +
        'Builder / cURL.\n\n' +
        '**Import ▾** can load a saved **Test Definition** (.json) or import **Data Rows** ' +
        '(CSV/JSON) into the Data Source tab.\n\n' +
        '**Export ▾** offers **Test Definition**, **Excel Template** (.xlsx), and raw ' +
        '**Data as CSV** / **Data as JSON**.\n\n' +
        'We stay in the editor for this step — Feature Group export comes next.',
      highlight: HAR.MODE_TOGGLE,
      action: async (ctx) => {
        const importTrigger = findModeButton('Import ▾');
        if (importTrigger) {
          await spotlight(importTrigger, 600, ctx);
          importTrigger.click();
          await ctx.delay(400);
          const dropdown = document.querySelector<HTMLElement>(HAR.MODE_DROPDOWN);
          if (dropdown) await spotlight(dropdown, 1000, ctx);
          importTrigger.click();
          await ctx.delay(400);
        }

        const exportTrigger = findModeButton('Export ▾');
        if (exportTrigger) {
          await spotlight(exportTrigger, 600, ctx);
          exportTrigger.click();
          await ctx.delay(400);
          const dropdown = document.querySelector<HTMLElement>(HAR.MODE_DROPDOWN);
          if (dropdown) await spotlight(dropdown, 1200, ctx);
          exportTrigger.click();
          await ctx.delay(400);
        }

        // Leave the editor open — closing here jumped to Feature Groups with no explanation.
        await spotlightSel(ctx, HAR.MODE_TOGGLE, 900);
      },
      preAction: async (ctx) => {
        await ensureTh15Ready(ctx);
        closeDropdowns();
        closeExportPopover();
        if (!isEditorOpen()) await openTestEditor(ctx);
        await switchToBuilderMode(ctx);
      },
      verify: TEST_EDITOR_SEL,
    },

    // ── Step 4: FG Export with Version Options ───────────────────
    {
      id: 'th15-fg-export-versions',
      title: 'FG Export with Version Options',
      description:
        'On the **Import Export Demo** Feature Group row — the top card actions, not the ' +
        'scenario, test, or toolbar — click **Export**.\n\n' +
        'That button opens a **version options popover** when version data exists. Checkboxes ' +
        'let you include or exclude **Response Versions**, **Rules Versions**, **Definition ' +
        'Versions**, and **Structure History** — each showing a count. Uncheck to reduce file ' +
        'size when sharing or archiving.',
      highlight: HAR.FG_EXPORT_BTN,
      action: async (ctx) => {
        if (isEditorOpen()) {
          closeEditor();
          await ctx.delay(500);
        }

        closeExportPopover();
        await ctx.delay(200);

        const fgExportBtn = document.querySelector<HTMLElement>(HAR.FG_EXPORT_BTN)
          ?? document.querySelector<HTMLElement>('.feature-group-actions .export-opts-anchor .btn');

        if (fgExportBtn) {
          fgExportBtn.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
          // Hold long enough that the correct Export is unmistakable among the many on screen
          await spotlight(fgExportBtn, 2400, ctx);
          await ctx.delay(500);
          fgExportBtn.click();
          await ctx.delay(700);
        }

        const popover = document.querySelector<HTMLElement>(HAR.EXPORT_POPOVER);
        if (popover) {
          await spotlight(popover, 1500, ctx);

          const checks = popover.querySelectorAll<HTMLElement>(HAR.EXPORT_POPOVER_CHECK);
          if (checks.length > 0) {
            await spotlight(checks[0], 800, ctx);
          }
        }

        closeExportPopover();
        await ctx.delay(400);
      },
      preAction: async (ctx) => {
        await ensureTh15Ready(ctx);
        closeDropdowns();
        closeExportPopover();
        // Close editor quietly so the FG Export button is visible for the reading spotlight
        if (isEditorOpen()) {
          closeEditor();
          await ctx.delay(400);
        }
        await expandFirstFg(ctx);
        await expandFirstScenario(ctx);
        await ctx.delay(200);
      },
      verify: HAR.FG_EXPORT_BTN,
    },

    // ── Step 5: Auto-Report Toggle ──────────────────────────────
    {
      id: 'th15-auto-report',
      title: 'Auto-Report Toggle',
      description:
        'In the Test Runner, the **Auto-report** checkbox in the scenario selector toolbar ' +
        'enables automatic report download after every run. Choose from **HTML** (rich visual ' +
        'report), **JSON** (programmatic), or **Markdown** (documentation) — ideal for CI ' +
        'integration or sharing results with your team.',
      highlight: HAR.AUTO_REPORT_LABEL,
      action: async (ctx) => {
        const autoReportLabel = findAutoReportLabel();
        if (!autoReportLabel) {
          await spotlightSel(ctx, HAR.SCENARIO_SELECTOR, 900);
          await ctx.delay(300);
          return;
        }

        await spotlight(autoReportLabel, 1000, ctx);

        const checkbox = autoReportLabel.querySelector<HTMLInputElement>('input[type="checkbox"]');
        if (checkbox) {
          // Always create a visible interaction even when already enabled.
          checkbox.click();
          await ctx.delay(350);
          if (!checkbox.checked) {
            checkbox.click();
            await ctx.delay(500);
          }
        }

        const formatSelect = autoReportLabel.querySelector<HTMLElement>('.cs-wrapper, .custom-select');
        if (formatSelect) {
          await spotlight(formatSelect, 1000, ctx);

          const trigger = formatSelect.querySelector<HTMLElement>('.cs-trigger') ?? formatSelect;
          trigger.click();
          await ctx.delay(300);

          const menuItems = Array.from(document.querySelectorAll<HTMLElement>('body > .cs-menu .cs-item, body > .cs-menu [role="option"]'));
          const jsonOption = menuItems.find((item) => item.textContent?.trim() === 'JSON')
            ?? menuItems[1];
          if (jsonOption) {
            jsonOption.click();
            await ctx.delay(400);
          }
        }
      },
      preAction: async (ctx) => {
        closeExportPopover();
        if (isEditorOpen()) {
          closeEditor();
          await ctx.delay(450);
        }

        // Move to Test Runner after editor closes; retry if another panel blocked the first attempt.
        for (let i = 0; i < 3; i++) {
          ctx.navigateToTab('runner');
          await ctx.delay(450);
          if (document.querySelector(HAR.SCENARIO_SELECTOR)) break;
        }

        // Ensure runner selector and auto-report control are present before interaction.
        for (let i = 0; i < 14; i++) {
          if (document.querySelector(HAR.SCENARIO_SELECTOR) && findAutoReportLabel()) break;
          await ctx.delay(120);
        }
      },
      verify: HAR.SCENARIO_SELECTOR,
    },
  ],
};
