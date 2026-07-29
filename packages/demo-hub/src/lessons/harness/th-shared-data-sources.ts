/**
 * TH-21: Shared Data Sources (Dedicated Lesson)
 *
 * 6 steps covering the full Shared Data Sources workflow:
 * Open & Create → Configure Fetch URL → cURL Import → Auth Configuration →
 * Data Grid & Used By → + Create Test
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
  expandFirstFg,
  expandFirstScenario,
  TH21_SHARED_DS_NAME,
} from './th-demo-helpers';

/* ── Local constants ─────────────────────────────────────────── */

const CURL_COMMAND =
  'curl -X GET "https://jsonplaceholder.typicode.com/users/1" ' +
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

/**
 * The real app auto-opens the "Create Parameterized Copy" variable wizard
 * (`.ds-setup-dialog`) after cURL Import & Apply. Our lesson doesn't feature
 * that wizard in this step, so close it before spotlighting anything else —
 * otherwise the next highlight targets an element now hidden behind it.
 */
async function closeVariablesWizardIfOpen(ctx: DemoActionContext): Promise<void> {
  const dialog = document.querySelector<HTMLElement>('.ds-setup-dialog');
  if (!dialog) return;
  const cancelBtn = Array.from(dialog.querySelectorAll<HTMLElement>('button'))
    .find(b => b.textContent?.trim() === 'Cancel');
  cancelBtn?.click();
  for (let i = 0; i < 15 && document.querySelector('.ds-setup-dialog'); i++) {
    await ctx.delay(120);
  }
}

async function closeSharedDsVisibly(ctx: DemoActionContext): Promise<void> {
  const modal = document.querySelector<HTMLElement>(HAR.SHARED_DS_MODAL);
  if (!modal) return;
  const closeBtn = Array.from(modal.querySelectorAll<HTMLElement>('.shared-ds-footer button'))
    .find(b => {
      const t = b.textContent?.trim();
      return t === 'Close' || t === 'Cancel';
    });
  if (closeBtn) {
    closeBtn.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
    await spotlight(closeBtn, 1600, ctx);
    await ctx.delay(500);
    closeBtn.click();
  } else {
    closeSharedDsModal();
  }
  for (let i = 0; i < 15 && document.querySelector(HAR.SHARED_DS_MODAL); i++) {
    await ctx.delay(120);
  }
  await ctx.delay(500);
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
  estimatedMinutes: 7,
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
        'This is the fastest way to configure a shared data source from an existing API call. ' +
        'Copy a cURL from your browser DevTools, Postman, or API docs and paste it here.\n\n' +
        'After clicking **Import & Apply**, the fetch configuration updates instantly — ' +
        'URL, method, headers, and auth are all populated from the parsed cURL.',
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
            // Import & Apply auto-opens the "Create Parameterized Copy" variable
            // wizard on top of the modal — close it, it's not part of this step.
            await closeVariablesWizardIfOpen(ctx);
          }
        }

        // Show the updated URL bar after import
        const urlBar = document.querySelector<HTMLElement>('.shared-ds-fetch-url-bar');
        if (urlBar) {
          await spotlight(urlBar, 2000, ctx);
          await ctx.delay(800);
        }
      },

      verify: HAR.SHARED_DS_FETCH,
    },

    // ── Step 4: Auth Configuration ─────────────────────────────
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

    // ── Step 5: Data Grid & Used By ────────────────────────────
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
      highlight: HAR.SHARED_DS_EDITOR,
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

        // Spotlight the data editor content (the grid)
        const editorContent = document.querySelector<HTMLElement>('.shared-ds-editor-content');
        if (editorContent) {
          editorContent.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
          await spotlight(editorContent, 3000, ctx);
          await ctx.delay(1200);
        }

        // Expand and spotlight the "Used By" section
        const usedByToggle = document.querySelector<HTMLElement>('.shared-ds-used-by-toggle');
        if (usedByToggle) {
          usedByToggle.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
          usedByToggle.click();
          await ctx.delay(600);
          const usedBySection = document.querySelector<HTMLElement>(HAR.SHARED_DS_USED_BY);
          if (usedBySection) {
            // This section sits at the very bottom of the scroll body, just above
            // the modal footer. `block: 'end'` pins its full content (test chips +
            // "Run Preview" line) clear of the footer so nothing is clipped.
            usedBySection.scrollIntoView({ block: 'end', behavior: 'instant' as ScrollBehavior });
            await ctx.delay(300);
            await spotlight(usedBySection, 2800, ctx);
            await ctx.delay(1200);
          }
        }
      },

      verify: HAR.SHARED_DS_USED_BY,
    },

    // ── Step 6: + Create Test ──────────────────────────────────
    {
      id: 'th21-create-test',
      title: '+ Create Test from Shared DS',
      description:
        'Click **+ Create Test** to generate a new parameterized test that is automatically ' +
        'linked to this shared data source.\n\n' +
        'The created test inherits the URL template, columns, and auth from the shared ' +
        'data source — you get a ready-to-run test with zero configuration. This is the ' +
        'fastest path from "I have API data" to "I have a running test suite".\n\n' +
        'Multiple tests can share the same data source — update the source once, and every ' +
        'linked test picks up the changes on the next run.',
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

        // Find the "+ Create Test" button in the fetch actions bar
        const actionBar = document.querySelector<HTMLElement>('.shared-ds-fetch-actions');
        const createTestBtn = actionBar
          ? Array.from(actionBar.querySelectorAll<HTMLElement>('button'))
            .find(b => b.textContent?.includes('Create Test'))
          : null;

        if (createTestBtn) {
          createTestBtn.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
          await spotlight(createTestBtn, 3000, ctx);
          await ctx.delay(1200);
          createTestBtn.click();
          await ctx.delay(1000);

          // If a create-test modal/popup appeared, spotlight it briefly
          const popup = document.querySelector<HTMLElement>('.popup-modal, .create-test-modal');
          if (popup) {
            await spotlight(popup, 2500, ctx);
            await ctx.delay(1200);
            // Close the popup
            const cancelBtn = Array.from(popup.querySelectorAll<HTMLElement>('button'))
              .find(b => {
                const t = b.textContent?.trim();
                return t === 'Cancel' || t === 'Close';
              });
            cancelBtn?.click();
            await ctx.delay(500);
          }
        }

        // Close the shared DS modal visibly
        await closeSharedDsVisibly(ctx);
      },

      verify: HAR.SHARED_DS_BTN,
    },
  ],
};
