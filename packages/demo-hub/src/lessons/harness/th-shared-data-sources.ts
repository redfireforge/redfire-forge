/**
 * TH-21: Shared Data Sources (Dedicated Lesson)
 *
 * 7 steps covering the full Shared Data Sources workflow:
 * Open & Create → Configure Fetch URL → cURL Import → Parameterize Wizard →
 * Auth Configuration → Data Grid & Used By → + Create Test
 *
 * Realistic scenario: a User Directory API (jsonplaceholder /users) with
 * user IDs and expected name / username / email validation — shared across
 * multiple tests in a feature group. Endpoints are live and verifiable.
 */
import type { DemoLesson, DemoActionContext } from '../../types';
import { HAR } from '@shared/selectors';
import {
  spotlight,
  seedTh21Full,
  cleanupTh21,
  closeSharedDsModal,
  closeInlineNameFormQuiet,
  closeTestEditorQuiet,
  isTestEditorOpen,
  expandFirstFg,
  expandFirstScenario,
  TH21_SHARED_DS_NAME,
} from './th-demo-helpers';

/* ── Local constants ─────────────────────────────────────────── */

const CURL_COMMAND =
  'curl -X GET "https://jsonplaceholder.typicode.com/users/{{userId}}" ' +
  '-H "Authorization: Bearer sk_live_4eC39HqLyjWDarjtT1zdp7dc" ' +
  '-H "Accept: application/json"';

/* ── Local helpers ───────────────────────────────────────────── */

function findSharedDsBtn(): HTMLElement | null {
  return document.querySelector<HTMLElement>(HAR.SHARED_DS_BTN)
    ?? Array.from(document.querySelectorAll<HTMLElement>('button'))
      .find(b => b.textContent?.includes('Shared Data Sources')) ?? null;
}

async function ensureModalOpen(ctx: DemoActionContext): Promise<boolean> {
  if (document.querySelector(HAR.SHARED_DS_MODAL)) return true;
  const btn = findSharedDsBtn();
  if (!btn) return false;
  btn.click();
  try { await ctx.waitFor(HAR.SHARED_DS_MODAL, 5000); } catch { return false; }
  await ctx.delay(400);
  return true;
}

/**
 * Select this lesson's own "User Directory" shared data source by name —
 * never assume position 0. The environment's real shared-data-source list may
 * already contain other (possibly sensitive, user-owned) entries that sort
 * before ours, and blindly clicking the first `.shared-ds-list-item` would
 * select and display someone else's real data during the walkthrough.
 */
async function ensureSharedDsSelected(ctx: DemoActionContext): Promise<void> {
  const items = Array.from(document.querySelectorAll<HTMLElement>('.shared-ds-list-item'));
  const target = items.find(
    (el) => el.querySelector('.shared-ds-list-name')?.textContent?.trim() === TH21_SHARED_DS_NAME,
  );
  if (target && !target.classList.contains('active')) {
    target.click();
    await ctx.delay(300);
  }
}

/** Find this lesson's own "User Directory" row in the shared-ds list panel. */
function findTh21SharedDsListItem(): HTMLElement | null {
  return Array.from(document.querySelectorAll<HTMLElement>('.shared-ds-list-item'))
    .find((el) => el.querySelector('.shared-ds-list-name')?.textContent?.trim() === TH21_SHARED_DS_NAME) ?? null;
}

function fillTextarea(selector: string, value: string): void {
  const el = document.querySelector<HTMLTextAreaElement>(selector);
  if (!el) return;
  const nativeSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
  nativeSetter?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

/** Close the Create Parameterized Copy wizard if it is open. */
async function closeVariablesWizardIfOpen(ctx: DemoActionContext): Promise<void> {
  const dialog = document.querySelector<HTMLElement>(HAR.DS_SETUP_DIALOG);
  if (!dialog) return;
  const cancelBtn = Array.from(dialog.querySelectorAll<HTMLElement>('button'))
    .find(b => b.textContent?.trim() === 'Cancel');
  cancelBtn?.click();
  for (let i = 0; i < 15 && document.querySelector(HAR.DS_SETUP_DIALOG); i++) {
    await ctx.delay(120);
  }
}

function findWizardBtn(labelPart: string): HTMLElement | null {
  const wizard = document.querySelector<HTMLElement>(HAR.DS_SETUP_DIALOG);
  if (!wizard) return null;
  return Array.from(wizard.querySelectorAll<HTMLElement>('button'))
    .find((btn) => btn.textContent?.trim().includes(labelPart) && !btn.hasAttribute('disabled'))
    ?? null;
}

/**
 * Quietly re-run cURL Import & Apply so the Create Parameterized Copy wizard
 * is open (for rapid-Next / restart recovery).
 */
async function ensureVariablesWizardOpen(ctx: DemoActionContext): Promise<boolean> {
  if (document.querySelector(HAR.DS_SETUP_DIALOG)) return true;
  if (!document.querySelector(HAR.SHARED_DS_MODAL)) {
    await ensureModalOpen(ctx);
  }
  await ensureSharedDsSelected(ctx);

  const actionBar = document.querySelector<HTMLElement>('.shared-ds-fetch-actions');
  const curlBtn = actionBar
    ? Array.from(actionBar.querySelectorAll<HTMLElement>('button'))
      .find(b => b.textContent?.includes('cURL Import'))
    : null;
  if (curlBtn && !document.querySelector('.shared-ds-curl-import')) {
    curlBtn.click();
    await ctx.delay(400);
  }

  const curlSection = document.querySelector<HTMLElement>('.shared-ds-curl-import');
  if (curlSection) {
    fillTextarea('.shared-ds-curl-input', CURL_COMMAND);
    await ctx.delay(200);
    const importBtn = Array.from(curlSection.querySelectorAll<HTMLElement>('button'))
      .find(b => b.textContent?.includes('Import'));
    importBtn?.click();
    await ctx.delay(800);
  }

  for (let i = 0; i < 20 && !document.querySelector(HAR.DS_SETUP_DIALOG); i++) {
    await ctx.delay(150);
  }
  return !!document.querySelector(HAR.DS_SETUP_DIALOG);
}

/**
 * Walk Create Parameterized Copy: Detect Variables → Columns → Validate →
 * Column Order → Review, then Cancel (tour only — Create Test is a later step).
 */
async function tourParameterizedCopyWizard(ctx: DemoActionContext): Promise<void> {
  const dialog = document.querySelector<HTMLElement>(HAR.DS_SETUP_DIALOG);
  if (!dialog) return;

  // Payoff on Detect Variables (path {{userId}} already selected)
  await spotlight(dialog, 2000, ctx);
  await ctx.delay(700);

  const stages = [
    'Next: Columns',
    'Next: Validate Fields',
    'Next: Column Order',
    'Next: Review',
  ] as const;

  for (const label of stages) {
    const nextBtn = findWizardBtn(label);
    if (!nextBtn) continue;
    await spotlight(nextBtn, 1400, ctx);
    await ctx.delay(350);
    nextBtn.click();
    await ctx.delay(900);
    const stagePanel = document.querySelector<HTMLElement>(HAR.DS_SETUP_DIALOG);
    if (stagePanel) {
      await spotlight(stagePanel, 1600, ctx);
      await ctx.delay(500);
    }
  }

  // End on Review — Cancel so we do not create a test here (step "+ Create Test" does that).
  const cancelBtn = findWizardBtn('Cancel');
  if (cancelBtn) {
    await spotlight(cancelBtn, 1400, ctx);
    await ctx.delay(400);
    cancelBtn.click();
    for (let i = 0; i < 15 && document.querySelector(HAR.DS_SETUP_DIALOG); i++) {
      await ctx.delay(120);
    }
    await ctx.delay(400);
  } else {
    await closeVariablesWizardIfOpen(ctx);
  }
}

/* ── Lesson definition ───────────────────────────────────────── */

export const thSharedDataSourcesLesson: DemoLesson = {
  id: 'th-shared-data-sources',
  domainId: 'harness',
  category: 'data-driven',
  name: 'Shared Data Sources',
  description:
    'Master shared data sources — reusable parameterized datasets for user directories, ' +
    'catalog APIs, and multi-environment test suites. Learn cURL import, fetch ' +
    'configuration, and test linking.',
  estimatedMinutes: 8,
  initialTab: 'scenarios',
  allowedTabs: ['scenarios'],

  concept: {
    title: 'Shared Data Sources',
    body:
      'Shared Data Sources let you maintain **one dataset** used by **many tests**.\n\n' +
      'Instead of duplicating rows across test scenarios, create a shared data source ' +
      'once and link it to any parameterized test. When the API evolves, update the ' +
      'shared source — all linked tests stay in sync.\n\n' +
      '**Key capabilities:**\n' +
      '- **cURL Import** — paste a cURL command to auto-configure method, URL, headers, and auth\n' +
      '- **Fetch Configuration** — template URL with `{{variables}}` mapped to data columns\n' +
      '- **Bearer / API Key / OAuth2** — full auth support for protected endpoints\n' +
      '- **Populate from API** — fetch real responses and map them to table rows via Data Mapper\n' +
      '- **+ Create Test** — instantly create a linked test from the shared data source\n' +
      '- **Used By tracking** — see which tests reference this dataset at a glance',
    keyTerms: [
      { term: 'Shared Data Source', definition: 'A reusable dataset at the environment+service level, linked to multiple parameterized tests.' },
      { term: 'Fetch Config', definition: 'The API endpoint configuration (method, URL, headers, auth) used to populate or refresh rows.' },
      { term: 'cURL Import', definition: 'Paste a cURL command to auto-fill the fetch configuration — URL, headers, auth extracted automatically.' },
      { term: 'Used By', definition: 'Shows which tests reference this shared data source — updates to the source cascade to all linked tests.' },
      { term: '+ Create Test', definition: 'Generate a new parameterized test pre-linked to the shared data source with matching columns.' },
    ],
    diagram: `<svg viewBox="0 0 400 90" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="10" width="110" height="70" rx="6" fill="#1e293b" stroke="#f59e0b" stroke-width="1.5"/>
      <text x="60" y="28" text-anchor="middle" fill="#f59e0b" font-size="7" font-weight="700">Shared DS</text>
      <text x="60" y="42" text-anchor="middle" fill="#94a3b8" font-size="5">5 rows • 4 cols</text>
      <text x="60" y="55" text-anchor="middle" fill="#94a3b8" font-size="5">Fetch: GET /users/{{id}}</text>
      <text x="60" y="68" text-anchor="middle" fill="#94a3b8" font-size="5">Auth: Bearer token</text>
      <path d="M120 35 L155 25" stroke="#64748b" stroke-width="1.2" marker-end="url(#th21arr)"/>
      <path d="M120 55 L155 65" stroke="#64748b" stroke-width="1.2" marker-end="url(#th21arr)"/>
      <rect x="160" y="5" width="100" height="35" rx="5" fill="#1e293b" stroke="#3b82f6" stroke-width="1.2"/>
      <text x="210" y="18" text-anchor="middle" fill="#3b82f6" font-size="6" font-weight="600">Test: GET /users</text>
      <text x="210" y="30" text-anchor="middle" fill="#94a3b8" font-size="5">linked → Shared DS</text>
      <rect x="160" y="50" width="100" height="35" rx="5" fill="#1e293b" stroke="#3b82f6" stroke-width="1.2"/>
      <text x="210" y="63" text-anchor="middle" fill="#3b82f6" font-size="6" font-weight="600">Test: GET /todos</text>
      <text x="210" y="75" text-anchor="middle" fill="#94a3b8" font-size="5">linked → Shared DS</text>
      <path d="M265 22 L295 22" stroke="#10b981" stroke-width="1" stroke-dasharray="3,2" marker-end="url(#th21arr2)"/>
      <path d="M265 67 L295 67" stroke="#10b981" stroke-width="1" stroke-dasharray="3,2" marker-end="url(#th21arr2)"/>
      <rect x="300" y="5" width="90" height="80" rx="5" fill="#1e293b" stroke="#10b981" stroke-width="1.2"/>
      <text x="345" y="22" text-anchor="middle" fill="#10b981" font-size="6" font-weight="600">Test Runner</text>
      <text x="345" y="38" text-anchor="middle" fill="#94a3b8" font-size="5">Row 1: userId 1</text>
      <text x="345" y="50" text-anchor="middle" fill="#94a3b8" font-size="5">Row 2: userId 2</text>
      <text x="345" y="62" text-anchor="middle" fill="#94a3b8" font-size="5">Row 3: userId 3</text>
      <text x="345" y="74" text-anchor="middle" fill="#94a3b8" font-size="5">Row 4: userId 4</text>
      <defs>
        <marker id="th21arr" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#64748b"/></marker>
        <marker id="th21arr2" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#10b981"/></marker>
      </defs>
    </svg>`,
  },

  // ── Setup ────────────────────────────────────────────────────
  setup: async (ctx) => {
    ctx.navigateToTab('scenarios');
    await ctx.delay(300);
    await closeVariablesWizardIfOpen(ctx);
    cleanupTh21();
    closeInlineNameFormQuiet();
    await closeTestEditorQuiet(ctx);
    closeSharedDsModal();
    await ctx.delay(200);
    await seedTh21Full(ctx);
    await ctx.delay(400);
    await expandFirstFg(ctx);
    await expandFirstScenario(ctx);
  },

  // ── Cleanup ──────────────────────────────────────────────────
  cleanup: async (ctx) => {
    await closeVariablesWizardIfOpen(ctx);
    closeSharedDsModal();
    await closeTestEditorQuiet(ctx);
    closeInlineNameFormQuiet();
    cleanupTh21();
    await ctx.delay(200);
  },

  // ── Steps ────────────────────────────────────────────────────
  steps: [
    // ── Step 1: Open & Explore ─────────────────────────────────
    {
      id: 'th21-open-modal',
      title: 'Open Shared Data Sources',
      description:
        'Click **📦 Shared Data Sources** in the page header to open the management modal.\n\n' +
        'The modal has a **two-panel layout**: the left panel lists all shared data sources ' +
        'with **+ New** and search. The right panel shows the selected data source with its ' +
        'full data grid, fetch configuration, and action bar.\n\n' +
        'Our demo scenario already has a **"User Directory"** dataset with 5 rows — ' +
        'each row is a different user (name, username, expected email). Two tests ' +
        'are linked to it: `GET /users/{{userId}}` and `GET /users/{{userId}}/todos`.',
      highlight: HAR.SHARED_DS_BTN,
      pauseAfter: true,

      preAction: async (ctx) => {
        closeSharedDsModal();
        await closeTestEditorQuiet(ctx);
        await ctx.delay(300);
        const btn = findSharedDsBtn();
        btn?.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
      },

      action: async (ctx) => {
        const btn = findSharedDsBtn();
        if (!btn) return;

        await spotlight(btn, 1200, ctx);
        await ctx.delay(400);
        btn.click();
        await ctx.waitFor(HAR.SHARED_DS_MODAL, 5000);
        await ctx.delay(1200);

        // Select the User Directory item FIRST — before any spotlighting —
        // so an unrelated real shared data source is never shown on screen even
        // briefly (the modal may default-select whatever was most recently used).
        await ensureSharedDsSelected(ctx);
        await ctx.delay(600);

        // Spotlight the "User Directory" row in the list — not the whole
        // list panel — so the highlight clearly points at our dataset among
        // any other (possibly real, user-owned) entries in the list.
        const listItem = findTh21SharedDsListItem();
        if (listItem) {
          listItem.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
          await spotlight(listItem, 2200, ctx);
          await ctx.delay(800);
        }

        // Spotlight the editor panel with the data grid
        const editorPanel = document.querySelector<HTMLElement>(HAR.SHARED_DS_EDITOR);
        if (editorPanel) {
          await spotlight(editorPanel, 2500, ctx);
          await ctx.delay(1000);
        }
      },

      verify: HAR.SHARED_DS_MODAL,
    },

    // ── Step 2: Fetch URL Configuration ────────────────────────
    {
      id: 'th21-fetch-url',
      title: 'Fetch URL & Template Variables',
      description:
        'The **Fetch Panel** shows the configured API endpoint. The URL uses `{{userId}}` ' +
        'as a template variable — mapped to the `userId` column in the data grid.\n\n' +
        'The **mapping chips** below the URL show how many columns map to each target: path ' +
        'variables, query params, headers, body fields, and validate columns.\n\n' +
        'Click any chip to jump to its Params/Headers/Body tab. Template variables are ' +
        'auto-detected from `{{...}}` tokens in the URL and headers.',
      highlight: HAR.SHARED_DS_FETCH,
      pauseAfter: true,

      preAction: async (ctx) => {
        if (!document.querySelector(HAR.SHARED_DS_MODAL)) {
          await ensureModalOpen(ctx);
        }
        await ensureSharedDsSelected(ctx);
      },

      action: async (ctx) => {
        if (!document.querySelector(HAR.SHARED_DS_MODAL)) {
          await ensureModalOpen(ctx);
          await ensureSharedDsSelected(ctx);
        }

        // Spotlight the fetch URL bar
        const urlBar = document.querySelector<HTMLElement>('.shared-ds-fetch-url-bar');
        if (urlBar) {
          urlBar.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
          await spotlight(urlBar, 2800, ctx);
          await ctx.delay(900);
        }

        // Spotlight the mapping chips row
        const mappingPreview = document.querySelector<HTMLElement>('.shared-ds-mapping-preview');
        if (mappingPreview) {
          await spotlight(mappingPreview, 2200, ctx);
          await ctx.delay(800);
        }

        // Click Params tab to show the detected variables
        const paramsTab = Array.from(document.querySelectorAll<HTMLElement>('.builder-tab'))
          .find(t => t.textContent?.includes('Params'));
        if (paramsTab) {
          paramsTab.click();
          await ctx.delay(800);
          const paramsContent = document.querySelector<HTMLElement>('.shared-ds-params-tab');
          if (paramsContent) {
            await spotlight(paramsContent, 2200, ctx);
            await ctx.delay(1000);
          }
        }
      },

      verify: HAR.SHARED_DS_FETCH,
    },

    // ── Step 3: cURL Import ────────────────────────────────────
    {
      id: 'th21-curl-import',
      title: 'cURL Import',
      description:
        'Click **cURL Import** to expand the import section. Paste any cURL command — ' +
        'RedfireForge extracts the method, URL, headers, and authentication automatically.\n\n' +
        'Because this data source maps a **Path** column to `userId`, the URL must keep ' +
        'the `{{userId}}` placeholder (not a hardcoded `/users/1`). Otherwise you get a ' +
        '**Mapping issues** warning: `path:userId has no matching URL placeholder`.\n\n' +
        'After **Import & Apply**, the fetch config updates and the **Create Parameterized Copy** ' +
        'wizard opens on **Detect Variables** — we walk that wizard in the next step.',
      highlight: HAR.SHARED_DS_FETCH,
      pauseAfter: true,

      preAction: async (ctx) => {
        if (!document.querySelector(HAR.SHARED_DS_MODAL)) {
          await ensureModalOpen(ctx);
        }
        await ensureSharedDsSelected(ctx);
        await closeVariablesWizardIfOpen(ctx);
        // Collapse cURL section if already open (for clean demo)
        const curlSection = document.querySelector('.shared-ds-curl-import');
        if (curlSection) {
          const cancelBtn = curlSection.querySelector<HTMLElement>('button:last-child');
          cancelBtn?.click();
          await ctx.delay(300);
        }
      },

      action: async (ctx) => {
        if (!document.querySelector(HAR.SHARED_DS_MODAL)) {
          await ensureModalOpen(ctx);
          await ensureSharedDsSelected(ctx);
        }

        // Find and click "cURL Import" button
        const actionBar = document.querySelector<HTMLElement>('.shared-ds-fetch-actions');
        const curlBtn = actionBar
          ? Array.from(actionBar.querySelectorAll<HTMLElement>('button'))
            .find(b => b.textContent?.includes('cURL Import'))
          : null;

        if (curlBtn) {
          curlBtn.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
          await spotlight(curlBtn, 2400, ctx);
          await ctx.delay(700);
          curlBtn.click();
          await ctx.delay(800);
        }

        // Fill the cURL textarea
        const curlSection = document.querySelector<HTMLElement>('.shared-ds-curl-import');
        if (curlSection) {
          await spotlight(curlSection, 1800, ctx);
          await ctx.delay(600);
          fillTextarea('.shared-ds-curl-input', CURL_COMMAND);
          await ctx.delay(1500);

          // Click "Import & Apply"
          const importBtn = Array.from(curlSection.querySelectorAll<HTMLElement>('button'))
            .find(b => b.textContent?.includes('Import'));
          if (importBtn) {
            await spotlight(importBtn, 1800, ctx);
            await ctx.delay(600);
            importBtn.click();
            await ctx.delay(1200);
          }
        }

        // Leave the Create Parameterized Copy wizard open for the next step.
        const wizard = document.querySelector<HTMLElement>(HAR.DS_SETUP_DIALOG);
        if (wizard) {
          await spotlight(wizard, 2200, ctx);
          await ctx.delay(800);
        }
      },

      verify: HAR.DS_SETUP_DIALOG,
    },

    // ── Step 4: Create Parameterized Copy wizard ───────────────
    {
      id: 'th21-param-wizard',
      title: 'Parameterize Wizard',
      description:
        '**Import & Apply** opened **Create Parameterized Copy**. Walk every stage so you ' +
        'see how a fetch URL with `{{userId}}` becomes a parameterized test:\n\n' +
        '1. **Detect Variables** — `{{userId}}` is selected as a path variable\n' +
        '2. **Configure Columns** — review column mapping\n' +
        '3. **Validate Fields** — optional response assertions\n' +
        '4. **Column Order** — arrange columns\n' +
        '5. **Review** — confirm the copy\n\n' +
        'We **Cancel** on Review — creating a linked test is covered in the final step ' +
        '(**+ Create Test**). This walk is the tour of the wizard itself.',
      highlight: HAR.DS_SETUP_DIALOG,
      pauseAfter: true,

      preAction: async (ctx) => {
        if (!document.querySelector(HAR.SHARED_DS_MODAL)) {
          await ensureModalOpen(ctx);
        }
        await ensureSharedDsSelected(ctx);
        await ensureVariablesWizardOpen(ctx);
      },

      action: async (ctx) => {
        await ensureVariablesWizardOpen(ctx);
        await tourParameterizedCopyWizard(ctx);

        // After Cancel, show the updated fetch URL bar from the cURL import
        const urlBar = document.querySelector<HTMLElement>('.shared-ds-fetch-url-bar');
        if (urlBar) {
          urlBar.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
          await spotlight(urlBar, 2000, ctx);
          await ctx.delay(700);
        }
      },

      verify: HAR.SHARED_DS_FETCH,
    },

    // ── Step 5: Auth Configuration ─────────────────────────────
    {
      id: 'th21-auth-config',
      title: 'Authentication',
      description:
        'Click the **Auth** tab to see the authentication configuration. Our cURL import ' +
        'automatically detected the Bearer token from the `Authorization` header.\n\n' +
        'Shared Data Sources support multiple auth types:\n' +
        '- **Bearer Token** — with configurable prefix and token value\n' +
        '- **Basic Auth** — username/password pair\n' +
        '- **API Key** — key name + value, sent in header or query param\n' +
        '- **OAuth2 Client Credentials** — token URL, client ID, client secret\n\n' +
        'Auth credentials can use `{{variables}}` from environment settings — the token ' +
        'resolves at fetch time, not at configuration time.',
      highlight: HAR.SHARED_DS_FETCH,
      pauseAfter: true,

      preAction: async (ctx) => {
        if (!document.querySelector(HAR.SHARED_DS_MODAL)) {
          await ensureModalOpen(ctx);
        }
        await ensureSharedDsSelected(ctx);
        await closeVariablesWizardIfOpen(ctx);
      },

      action: async (ctx) => {
        if (!document.querySelector(HAR.SHARED_DS_MODAL)) {
          await ensureModalOpen(ctx);
          await ensureSharedDsSelected(ctx);
        }

        // Click Auth tab
        const authTab = Array.from(document.querySelectorAll<HTMLElement>('.builder-tab'))
          .find(t => t.textContent?.includes('Auth'));
        if (authTab) {
          authTab.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
          await spotlight(authTab, 2000, ctx);
          await ctx.delay(600);
          authTab.click();
          await ctx.delay(900);
        }

        // Spotlight the auth panel content
        const authContent = document.querySelector<HTMLElement>('.builder-tab-content');
        if (authContent) {
          await spotlight(authContent, 2800, ctx);
          await ctx.delay(1200);
        }
      },

      verify: HAR.SHARED_DS_FETCH,
    },

    // ── Step 6: Data Grid & Used By ────────────────────────────
    {
      id: 'th21-data-grid-used-by',
      title: 'Data Grid & Used By',
      description:
        'Scroll down to see the **data grid** — the actual rows that drive parameterized ' +
        'execution. Each row has a user ID, name, username, and expected email.\n\n' +
        'The **Used By** section at the bottom shows which tests reference this shared ' +
        'data source. When you update rows, add columns, or refresh from the API — **all ' +
        'linked tests get the changes automatically**. No need to update each test individually.\n\n' +
        'Disabled rows (like the "Contractor") are skipped during execution but preserved for ' +
        'documentation and future re-enablement.',
      highlight: HAR.SHARED_DS_GRID,
      pauseAfter: true,

      preAction: async (ctx) => {
        if (!document.querySelector(HAR.SHARED_DS_MODAL)) {
          await ensureModalOpen(ctx);
        }
        await ensureSharedDsSelected(ctx);
        await closeVariablesWizardIfOpen(ctx);
        // Collapse fetch expanded section to show data grid clearly
        const tabs = document.querySelectorAll<HTMLElement>('.builder-tab.active');
        for (const tab of tabs) {
          const parent = tab.closest('.shared-ds-fetch-panel');
          if (parent) { tab.click(); await ctx.delay(200); break; }
        }
      },

      action: async (ctx) => {
        await closeVariablesWizardIfOpen(ctx);
        if (!document.querySelector(HAR.SHARED_DS_MODAL)) {
          await ensureModalOpen(ctx);
          await ensureSharedDsSelected(ctx);
        }

        // Collapse any open fetch tab to reveal the data grid
        const activeTabs = document.querySelectorAll<HTMLElement>('.builder-tab.active');
        for (const tab of activeTabs) {
          const parent = tab.closest('.shared-ds-fetch-panel');
          if (parent) { tab.click(); await ctx.delay(300); break; }
        }

        // Spotlight the data grid viewport directly.
        const dataGrid = document.querySelector<HTMLElement>(HAR.SHARED_DS_GRID);
        if (dataGrid) {
          dataGrid.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
          await spotlight(dataGrid, 2200, ctx);
          await ctx.delay(700);
        }

        // Expand and spotlight the "Used By" section
        const usedByToggle = document.querySelector<HTMLElement>(HAR.SHARED_DS_USED_BY_TOGGLE);
        if (usedByToggle) {
          usedByToggle.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
          await spotlight(usedByToggle, 1600, ctx);
          await ctx.delay(400);
          // Expand if collapsed
          const usedByRoot = document.querySelector<HTMLElement>(HAR.SHARED_DS_USED_BY);
          if (usedByRoot && !usedByRoot.classList.contains('expanded')) {
            usedByToggle.click();
            await ctx.delay(500);
          }
          const usedBySection = document.querySelector<HTMLElement>(HAR.SHARED_DS_USED_BY_LIST)
            ?? document.querySelector<HTMLElement>(HAR.SHARED_DS_USED_BY);
          if (usedBySection) {
            usedBySection.scrollIntoView({ block: 'end', behavior: 'instant' as ScrollBehavior });
            await ctx.delay(250);
            await spotlight(usedBySection, 2000, ctx);
            await ctx.delay(700);
          }
        }
      },

      verify: HAR.SHARED_DS_USED_BY,
    },

    // ── Step 7: + Create Test ──────────────────────────────────
    {
      id: 'th21-create-test',
      title: '+ Create Test from Shared DS',
      description:
        'Click **+ Create Test**, confirm in the dialog, then watch the new card appear under ' +
        '**Shared DS Demo → User Directory**.\n\n' +
        'The test inherits the shared URL template, columns, and auth — already linked, ready to run.',
      highlight: HAR.SHARED_DS_FETCH,
      pauseAfter: true,

      preAction: async (ctx) => {
        if (isTestEditorOpen()) await closeTestEditorQuiet(ctx);
        if (!document.querySelector(HAR.SHARED_DS_MODAL)) {
          await ensureModalOpen(ctx);
        }
        await ensureSharedDsSelected(ctx);
        await closeVariablesWizardIfOpen(ctx);
      },

      action: async (ctx) => {
        if (!document.querySelector(HAR.SHARED_DS_MODAL)) {
          await ensureModalOpen(ctx);
          await ensureSharedDsSelected(ctx);
        }

        // 1) + Create Test
        const actionBar = document.querySelector<HTMLElement>('.shared-ds-fetch-actions');
        const createTestBtn = actionBar
          ? Array.from(actionBar.querySelectorAll<HTMLElement>('button'))
            .find(b => b.textContent?.includes('Create Test'))
          : null;

        if (createTestBtn) {
          createTestBtn.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
          await spotlight(createTestBtn, 1800, ctx);
          await ctx.delay(450);
          createTestBtn.click();
          await ctx.delay(800);
        }

        // 2) Confirm in the create dialog
        const createModal = document.querySelector<HTMLElement>('.create-test-modal');
        if (createModal) {
          const confirmBtn = Array.from(createModal.querySelectorAll<HTMLElement>('button'))
            .find(b => b.textContent?.trim() === 'Create Test');
          if (confirmBtn) {
            await spotlight(confirmBtn, 1600, ctx);
            await ctx.delay(400);
            confirmBtn.click();
            await ctx.delay(1000);
          }
        }

        // Create Test opens the editor — close quietly so the tree is the payoff
        if (isTestEditorOpen()) {
          await closeTestEditorQuiet(ctx);
          await ctx.delay(400);
        }
        if (document.querySelector(HAR.SHARED_DS_MODAL)) {
          closeSharedDsModal();
          for (let i = 0; i < 12 && document.querySelector(HAR.SHARED_DS_MODAL); i++) {
            await ctx.delay(100);
          }
        }

        // 3) One spotlight on the new test card — no second pass / scenario re-ring
        ctx.navigateToTab('scenarios');
        await ctx.delay(400);
        await expandFirstFg(ctx);
        await expandFirstScenario(ctx);
        await ctx.delay(500);

        const createdName = `Test from ${TH21_SHARED_DS_NAME}`;
        const testCards = Array.from(document.querySelectorAll<HTMLElement>(HAR.TEST_CARD));
        const createdCard = testCards.find(c => c.textContent?.includes(createdName))
          ?? testCards[testCards.length - 1];

        if (createdCard) {
          createdCard.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
          await spotlight(createdCard, 2400, ctx);
          await ctx.delay(700);
        }
      },

      verify: HAR.TEST_CARD,
    },
  ],
};
