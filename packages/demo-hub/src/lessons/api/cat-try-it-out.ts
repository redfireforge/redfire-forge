/**
 * CAT-2 — Live API Execution
 *
 * 7 steps: configure the Host Strategy (From Spec → Environment + Microservice →
 * Custom URL hostname → back to From Spec) → open Try It Out on POST /posts with
 * auto-generated body → execute GET /posts/{id} with a path parameter → Send to
 * Harness (Target cascade) → Send to Harness Options → authorize via Auth panel →
 * copy as cURL.
 *
 * This lesson teaches everything about live execution from the Catalog: where
 * requests go, how to fill parameters, how to authenticate, and how to export
 * the configured request as a terminal command.
 *
 * Uses the real JSONPlaceholder API (CORS-friendly, no auth required for GETs).
 */
import type { DemoLesson, DemoActionContext } from '../../types';
import { CAT, REQ } from '@shared/selectors';
import {
  JSONPLACEHOLDER_API_SPEC,
  seedCatalogEntry,
  deleteCatalogEntryByName,
  deleteCollectionsByName,
  selectCatalogEntryByName,
  ensureCatalogTab,
  ensureEndpointsView,
  ensureCardTryItOpen,
  collapseAllCards,
  closeAuthPanelIfOpen,
  spotlight,
  spotlightEl,
  waitForSelector,
  closeEditModalIfOpen,
  resetHostStrategyToFromSpec,
} from './cat-demo-helpers';
import { fillControlledInput } from '../setup-helpers';
import { cleanupOtherRequestDemoCollections } from './req-demo-helpers';
import {
  ensureSettingsEnvironment,
  ensureSettingsMicroservice,
  getDemoBridgeWindow,
} from '../../adapters';

// ─── Constants ──────────────────────────────────────────────────

const DEMO_ENTRY_NAME = 'JSONPlaceholder API';
const DEMO_ENTRY_NAME_VERSIONED = 'JSONPlaceholder API (1.0.0)';
const DEMO_CUSTOM_HOST = 'https://staging.example.com';
const CAT2_ENV_NAME = 'demo';
const CAT2_SVC_NAME = 'jsonplaceholder';
const CAT2_FG_NAME = 'Catalog Demo Tests';
const CAT2_SCENARIO_NAME = 'GET Post by ID';
const CAT2_SVC_BASE = 'https://jsonplaceholder.typicode.com';

/** Quietly close the Send to Harness modal if open. */
async function closeHarnessModalIfOpen(ctx: DemoActionContext): Promise<void> {
  const modal = document.querySelector(REQ.HARNESS_MODAL);
  if (!modal) return;
  const cancel = document.querySelector<HTMLElement>(REQ.HARNESS_CANCEL_BTN)
    ?? document.querySelector<HTMLElement>('.send-harness-cancel-btn');
  cancel?.click();
  await ctx.delay(250);
}

function cleanupDemoFeatureGroups(): void {
  getDemoBridgeWindow().__demoDeleteFeatureGroupsByName?.(CAT2_FG_NAME);
}

/** Ensure env + microservice exist so the Target cascade can be filled. */
function ensureHarnessTargets(): void {
  const envId = ensureSettingsEnvironment(CAT2_ENV_NAME);
  if (envId) {
    ensureSettingsMicroservice(CAT2_SVC_NAME, { [envId]: CAT2_SVC_BASE });
  }
}

/** Execute GET /posts/{id} if needed so Send to Harness appears. */
async function ensureGetPostExecuted(ctx: DemoActionContext): Promise<void> {
  await ensureCardTryItOpen('GET', '/posts/{id}');
  const getCard = document.querySelector<HTMLElement>(CAT.endpointCard('GET', '/posts/{id}'));
  if (!getCard) return;
  if (getCard.querySelector(CAT.LIVE_RESPONSE) && getCard.querySelector(CAT.SAVE_AS_TEST_BTN)) {
    return;
  }
  const paramInput = getCard.querySelector<HTMLInputElement>(CAT.paramInput('id'));
  if (paramInput && !paramInput.value) {
    fillControlledInput(paramInput, '1');
  }
  const execBtn = getCard.querySelector<HTMLElement>(CAT.EXECUTE_BTN);
  if (execBtn) execBtn.click();
  try {
    await waitForSelector(
      `${CAT.endpointCard('GET', '/posts/{id}')} ${CAT.SAVE_AS_TEST_BTN}`,
      10000,
    );
  } catch {
    try {
      await waitForSelector(
        `${CAT.endpointCard('GET', '/posts/{id}')} ${CAT.LIVE_RESPONSE}`,
        4000,
      );
    } catch { /* network may fail */ }
  }
  await ctx.delay(200);
}

/** Open a cascade field, spotlight options, pick by name (or first item). */
async function selectCascadeByName(
  ctx: DemoActionContext,
  fieldSel: string,
  matchName: string,
  holdMs = 1000,
): Promise<void> {
  const field = document.querySelector<HTMLElement>(fieldSel);
  if (!field) return;
  await spotlightEl(ctx, field, holdMs);
  const trigger = field.querySelector<HTMLButtonElement>('.cascade-dropdown-trigger');
  if (!trigger) return;
  trigger.click();
  await ctx.delay(450);
  const items = Array.from(field.querySelectorAll<HTMLButtonElement>('.cascade-dropdown-item:not(.cascade-dropdown-create)'));
  const match = items.find((i) => {
    const name = i.querySelector('.cascade-dropdown-item-name')?.textContent?.trim().toLowerCase();
    return name === matchName.toLowerCase();
  }) ?? items[0];
  if (match) {
    match.scrollIntoView({ block: 'nearest' });
    await spotlightEl(ctx, match, 900);
    match.click();
    await ctx.delay(550);
  }
}

/** Open cascade → + Create New → fill name, with spotlights. */
async function createCascadeItem(
  ctx: DemoActionContext,
  fieldSel: string,
  newName: string,
  holdMs = 1000,
): Promise<void> {
  const field = document.querySelector<HTMLElement>(fieldSel);
  if (!field) return;
  await spotlightEl(ctx, field, holdMs);

  // Already in create mode (e.g. Scenario auto-opens after new Feature Group)
  let input = field.querySelector<HTMLInputElement>('input');
  if (!input) {
    const trigger = field.querySelector<HTMLButtonElement>('.cascade-dropdown-trigger');
    if (trigger) {
      trigger.click();
      await ctx.delay(400);
    }
    const createBtn = field.querySelector<HTMLButtonElement>('.cascade-dropdown-create');
    if (createBtn) {
      await spotlightEl(ctx, createBtn, 800);
      createBtn.click();
      await ctx.delay(400);
    }
    input = field.querySelector<HTMLInputElement>('input');
  }

  if (input) {
    await spotlightEl(ctx, input, 700);
    fillControlledInput(input, newName);
    input.blur();
    await ctx.delay(500);
  }
  await spotlightEl(ctx, field, 900);
}

/**
 * Environment mode: if no microservice is linked, the Edit modal opens —
 * pick the first real microservice, save, then activate Environment.
 * Otherwise open the env dropdown and select an option (prefer index 1 to
 * show a Base URL change when multiple envs exist).
 */
async function demonstrateEnvironmentMode(ctx: DemoActionContext): Promise<void> {
  const envBtn = document.querySelector<HTMLElement>(CAT.HOST_ENVIRONMENT);
  if (!envBtn) return;

  await spotlightEl(ctx, envBtn, 900);
  envBtn.click();
  await ctx.delay(700);

  // Path A — Edit modal: link a microservice first
  const msSelect = document.querySelector<HTMLElement>(CAT.EDIT_MICROSERVICE_SELECT);
  if (msSelect) {
    await spotlightEl(ctx, msSelect, 1100);
    const trigger = msSelect.querySelector<HTMLElement>('.cat-dark-select__trigger');
    trigger?.click();
    await ctx.delay(500);

    const options = Array.from(
      document.querySelectorAll<HTMLElement>('.cat-dark-select__option'),
    );
    const firstSvc = options.find((opt) => {
      const label = opt.querySelector('.cat-dark-select__option-label')?.textContent?.trim() ?? '';
      return Boolean(label) && !label.includes('None');
    });
    if (firstSvc) {
      await spotlightEl(ctx, firstSvc, 1200);
      firstSvc.click();
      await ctx.delay(700);
    }

    const preview = document.querySelector<HTMLElement>('.cat-edit-env-preview');
    if (preview) {
      await spotlightEl(ctx, preview, 1400);
    }

    const saveBtn = document.querySelector<HTMLElement>(CAT.EDIT_SAVE_BTN);
    if (saveBtn) {
      await spotlightEl(ctx, saveBtn, 700);
      saveBtn.click();
      await ctx.delay(900);
    }

    // Linking does not switch strategy — click Environment again to activate it
    const envBtn2 = document.querySelector<HTMLElement>(CAT.HOST_ENVIRONMENT);
    if (envBtn2) {
      await spotlightEl(ctx, envBtn2, 700);
      envBtn2.click();
      await ctx.delay(700);
    }
  }

  // Path B / after link — env CustomSelect (microservice environments)
  const envSelect = document.querySelector<HTMLElement>(CAT.HOST_ENV_SELECT);
  if (envSelect) {
    await spotlightEl(ctx, envSelect, 1100);
    const trigger = envSelect.querySelector<HTMLElement>('.cs-trigger, button');
    trigger?.click();
    await ctx.delay(500);

    const items = Array.from(document.querySelectorAll<HTMLElement>('.cs-menu .cs-item, .cs-item'));
    // Spotlight each option so the viewer sees env name + base URL
    for (let i = 0; i < Math.min(items.length, 3); i++) {
      await spotlightEl(ctx, items[i], 900);
    }
    // Prefer a non-first option when available so Base URL visibly changes
    const pick = items[Math.min(1, items.length - 1)] ?? items[0];
    if (pick) {
      pick.click();
      await ctx.delay(600);
    } else {
      trigger?.click();
    }
  }

  const baseUrl = document.querySelector<HTMLElement>(CAT.BASE_URL);
  if (baseUrl) {
    await spotlightEl(ctx, baseUrl, 1200);
  }
}

// ─── Helpers ────────────────────────────────────────────────────

/** Ensure the demo entry exists in the sidebar. Seeds it if missing. */
async function ensureDemoEntry(): Promise<void> {
  if (document.querySelector(CAT.entryByName(DEMO_ENTRY_NAME))) return;
  await seedCatalogEntry(DEMO_ENTRY_NAME, JSONPLACEHOLDER_API_SPEC);
  await waitForSelector(CAT.entryByName(DEMO_ENTRY_NAME), 3000);
}

/** Ensure the demo entry is selected and the main panel is visible. */
async function ensureDemoEntrySelected(): Promise<void> {
  await ensureDemoEntry();
  selectCatalogEntryByName(DEMO_ENTRY_NAME);
  await new Promise(r => setTimeout(r, 150));
}

// ─── Lesson ─────────────────────────────────────────────────────

export const catTryItOutLesson: DemoLesson = {
  id: 'cat-try-execute',
  domainId: 'api',
  category: 'catalog',
  name: 'Live API Execution',
  description:
    'Execute real API calls from the Catalog — configure Host Strategy, Try It Out, ' +
    'Send to Harness, authenticate with Bearer tokens, and copy cURL.',
  estimatedMinutes: 8,
  initialTab: 'catalog',
  allowedTabs: ['catalog', 'environments'],

  concept: {
    title: 'Live API Testing, Right Inside the Catalog',
    body:
      'Every endpoint card has a **Try It Out** button that turns the read-only view ' +
      'into an interactive sandbox — similar to Swagger UI\'s execute mode, but integrated ' +
      'with your testing workflow.\n\n' +
      '**What you learn in this lesson:**\n' +
      '- How the **Host Strategy** controls where requests are sent (From Spec / Environment / Custom URL)\n' +
      '- How to open **Try It Out**, edit the auto-generated body, and **Execute** a live POST\n' +
      '- How **path parameters** (like `/posts/{id}`) become dedicated input fields\n' +
      '- How **Send to Harness** promotes a live response into the Harness (Target + Options)\n' +
      '- How the **Auth panel** lets you configure Bearer tokens, API keys, or Basic auth\n' +
      '- How to export the configured request as a **cURL** command\n\n' +
      '**Why Host Strategy matters:** Before executing any request, you need to decide where ' +
      'it goes. "From Spec" uses the URL in the OpenAPI spec, "Environment" uses your linked ' +
      'microservice URLs, and "Custom URL" lets you point at localhost or staging.',
    keyTerms: [
      { term: 'Host Strategy', definition: 'How the Catalog resolves the base URL: from the spec\'s `servers`, from an app environment, or a custom URL' },
      { term: 'Try It Out', definition: 'Turns an endpoint card into an interactive form — fill parameters, edit the body, and execute a live request' },
      { term: 'Schema Stub', definition: 'Auto-generated JSON from the request body schema — field names and types pre-filled so you can edit, not start from scratch' },
      { term: 'Path Parameter', definition: 'A URL template variable like {id} — Try It Out creates a dedicated input field so you can fill it before executing' },
      { term: 'Send to Harness', definition: 'After a 2xx Execute response, promotes the Try It Out config into the Test Harness via a Target + Options wizard' },
      { term: 'Authorize', definition: 'Opens the auth configuration panel — set Bearer tokens, API keys, or Basic auth that apply to all subsequent requests' },
    ],
    diagram: `<svg viewBox="0 0 460 90" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="25" width="90" height="40" rx="6" fill="#1e293b" stroke="#8b5cf6" stroke-width="1.5"/>
      <text x="50" y="44" text-anchor="middle" fill="#f1f5f9" font-size="9">Host Strategy</text>
      <text x="50" y="57" text-anchor="middle" fill="#94a3b8" font-size="7">base URL</text>
      <path d="M100 45 L135 45" stroke="#3b82f6" stroke-width="1.5" marker-end="url(#cat2arr)"/>
      <rect x="140" y="25" width="90" height="40" rx="6" fill="#1e293b" stroke="#3b82f6" stroke-width="1.5"/>
      <text x="185" y="44" text-anchor="middle" fill="#f1f5f9" font-size="9">Try It Out</text>
      <text x="185" y="57" text-anchor="middle" fill="#94a3b8" font-size="7">params · body</text>
      <path d="M235 45 L270 45" stroke="#f59e0b" stroke-width="1.5" marker-end="url(#cat2arr)"/>
      <rect x="275" y="25" width="80" height="40" rx="6" fill="#1e293b" stroke="#f59e0b" stroke-width="1.5"/>
      <text x="315" y="44" text-anchor="middle" fill="#f1f5f9" font-size="9">Execute</text>
      <text x="315" y="57" text-anchor="middle" fill="#94a3b8" font-size="7">HTTP call</text>
      <path d="M360 45 L395 45" stroke="#10b981" stroke-width="1.5" marker-end="url(#cat2arr)"/>
      <rect x="400" y="25" width="55" height="40" rx="6" fill="#1e293b" stroke="#10b981" stroke-width="1.5"/>
      <text x="427" y="44" text-anchor="middle" fill="#f1f5f9" font-size="9">Response</text>
      <text x="427" y="57" text-anchor="middle" fill="#94a3b8" font-size="7">201 ✓</text>
      <defs><marker id="cat2arr" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill="#94a3b8"/></marker></defs>
    </svg>`,
  },

  setup: async (ctx) => {
    closeEditModalIfOpen();
    closeAuthPanelIfOpen();
    ensureCatalogTab(ctx);
    await ctx.delay(80);
    deleteCollectionsByName(DEMO_ENTRY_NAME);
    deleteCollectionsByName(DEMO_ENTRY_NAME_VERSIONED);
    await ctx.delay(200);
    await cleanupOtherRequestDemoCollections(ctx);
    ensureHarnessTargets();
    await seedCatalogEntry(DEMO_ENTRY_NAME, JSONPLACEHOLDER_API_SPEC);
    await waitForSelector(CAT.entryByName(DEMO_ENTRY_NAME), 3000);
    selectCatalogEntryByName(DEMO_ENTRY_NAME);
    await ctx.delay(200);
  },

  cleanup: async (ctx) => {
    await closeHarnessModalIfOpen(ctx);
    closeEditModalIfOpen();
    closeAuthPanelIfOpen();
    collapseAllCards();
    cleanupDemoFeatureGroups();
    deleteCatalogEntryByName(DEMO_ENTRY_NAME);
    deleteCollectionsByName(DEMO_ENTRY_NAME);
    deleteCollectionsByName(DEMO_ENTRY_NAME_VERSIONED);
    await cleanupOtherRequestDemoCollections(ctx);
    ensureCatalogTab(ctx);
    await ctx.delay(60);
  },

  steps: [
    // ── Step 1: Host Strategy — Where Requests Go ───────────────
    {
      id: 'cat2-host',
      title: 'Host Strategy — Where Requests Go',
      description:
        'Before executing any request, you need to know **where it goes**. Watch how ' +
        'each Host Strategy mode changes the **resolved Base URL**:\n\n' +
        '- **From Spec** (default) — uses the `servers` URL from the OpenAPI spec\n' +
        '- **Environment** — links a **Microservice** and picks an env so the base URL ' +
        'comes from your Environments settings\n' +
        '- **Custom URL** — type any hostname (staging, localhost, production)\n\n' +
        'We end back on **From Spec** so the live Execute steps hit JSONPlaceholder.',
      highlight: CAT.HOST_STRATEGY,

      preAction: async (ctx) => {
        ensureCatalogTab(ctx);
        await ensureDemoEntrySelected();
        await ensureEndpointsView(ctx);
        closeEditModalIfOpen();
        resetHostStrategyToFromSpec();
      },

      action: async (ctx) => {
        // ── 1. From Spec (default) ──────────────────────────────
        await spotlight(ctx, CAT.HOST_STRATEGY, 1000);

        const fromSpecBtn = document.querySelector<HTMLElement>(CAT.HOST_FROM_SPEC);
        if (fromSpecBtn) {
          await spotlightEl(ctx, fromSpecBtn, 900);
        }

        const serverSelect = document.querySelector<HTMLElement>(CAT.HOST_SERVER_SELECT);
        if (serverSelect) {
          await spotlightEl(ctx, serverSelect, 1000);
        }

        const baseUrl = document.querySelector<HTMLElement>(CAT.BASE_URL);
        if (baseUrl) {
          await spotlightEl(ctx, baseUrl, 1100);
        }

        // ── 2. Environment — link Microservice + pick env ───────
        await demonstrateEnvironmentMode(ctx);

        // ── 3. Custom URL — type a different hostname ───────────
        const customBtn = document.querySelector<HTMLElement>(CAT.HOST_CUSTOM_URL);
        if (customBtn) {
          await spotlightEl(ctx, customBtn, 900);
          customBtn.click();
          await ctx.delay(600);

          const hostInput = document.querySelector<HTMLInputElement>(CAT.HOST_INPUT);
          if (hostInput) {
            await spotlightEl(ctx, hostInput, 800);
            fillControlledInput(hostInput, DEMO_CUSTOM_HOST);
            await ctx.delay(700);
            await spotlightEl(ctx, hostInput, 1000);
          }

          const customBase = document.querySelector<HTMLElement>(CAT.BASE_URL);
          if (customBase) {
            await spotlightEl(ctx, customBase, 1200);
          }
        }

        // ── 4. Back to From Spec for live Execute steps ─────────
        if (fromSpecBtn) {
          fromSpecBtn.click();
          await ctx.delay(600);
          await spotlightEl(ctx, fromSpecBtn, 800);
          const restoredBase = document.querySelector<HTMLElement>(CAT.BASE_URL);
          if (restoredBase) {
            await spotlightEl(ctx, restoredBase, 1000);
          }
        }
      },
    },

    // ── Step 2: Try It Out — POST /posts ────────────────────────
    {
      id: 'cat2-try-post',
      title: 'Try It Out — POST /posts',
      description:
        'Find **POST /posts** (the "Create a post" endpoint) and expand its card. Click ' +
        '**Try it out** — the request body textarea is **auto-generated** from the OpenAPI ' +
        'schema: `title`, `body`, and `userId` with their correct types.\n\n' +
        'Edit the body to meaningful values, then click **Execute**. The real JSONPlaceholder ' +
        'API returns a **201 Created** response with a generated `id: 101`, your title echoed ' +
        'back, and the response time in milliseconds. This is a live HTTP call, not a mock.',

      preAction: async (ctx) => {
        ensureCatalogTab(ctx);
        await ensureDemoEntrySelected();
        await ensureEndpointsView(ctx);
        closeEditModalIfOpen();
        resetHostStrategyToFromSpec();
        collapseAllCards();
      },

      action: async (ctx) => {
        // Find and scroll to the POST /posts card
        const postCard = document.querySelector<HTMLElement>(CAT.endpointCard('POST', '/posts'));
        if (!postCard) return;
        postCard.scrollIntoView({ block: 'center' });
        await ctx.delay(500);

        // Expand the card
        const header = postCard.querySelector<HTMLElement>('.sw-header');
        if (header) header.click();
        await ctx.delay(800);

        // Click "Try it out"
        const tryitBtn = postCard.querySelector<HTMLElement>(CAT.TRYIT_BTN);
        if (tryitBtn) {
          await spotlightEl(ctx, tryitBtn, 900);
          tryitBtn.click();
        }
        await ctx.delay(800);

        // Spotlight the auto-generated body — viewer sees pre-filled JSON from schema
        const bodyEditor = postCard.querySelector<HTMLTextAreaElement>(CAT.BODY_EDITOR);
        if (bodyEditor) {
          await spotlightEl(ctx, bodyEditor, 1500);

          // Edit the body with realistic data
          const edited = JSON.stringify({
            title: 'Hello from RedfireForge',
            body: 'This post was created from the Catalog Try It Out demo.',
            userId: 1,
          }, null, 2);
          fillControlledInput(bodyEditor, edited);
          bodyEditor.dispatchEvent(new Event('input', { bubbles: true }));
          bodyEditor.dispatchEvent(new Event('change', { bubbles: true }));
          await ctx.delay(700);

          // Spotlight the edited body so viewer sees the change
          await spotlightEl(ctx, bodyEditor, 1000);
        }

        // Click Execute
        const execBtn = postCard.querySelector<HTMLElement>(CAT.EXECUTE_BTN);
        if (execBtn) {
          await spotlightEl(ctx, execBtn, 900);
          execBtn.click();
        }

        // Wait for the live response to appear
        try {
          await waitForSelector(
            `${CAT.endpointCard('POST', '/posts')} ${CAT.LIVE_RESPONSE}`,
            8000,
          );
        } catch { /* Network may fail — still continue */ }
        await ctx.delay(800);

        // Scroll the response into view so the viewer can read it
        const response = postCard.querySelector<HTMLElement>(CAT.LIVE_RESPONSE);
        if (response) {
          response.scrollIntoView({ block: 'nearest' });
          await ctx.delay(600);
        }
      },
    },

    // ── Step 3: Path Parameters — GET /posts/{id} ───────────────
    {
      id: 'cat2-path-param',
      title: 'Path Parameters — GET /posts/{id}',
      description:
        'Endpoints with **path parameters** like `/posts/{id}` get a dedicated input field ' +
        'for each template variable. Expand **GET /posts/{id}**, click **Try it out**, and ' +
        'fill `id = 1` in the **Parameters table**.\n\n' +
        'Click **Execute** — the API returns a single post (id: 1), proving the `{id}` was ' +
        'correctly substituted into the URL. This is how you test individual resources.',

      preAction: async (ctx) => {
        ensureCatalogTab(ctx);
        await ensureDemoEntrySelected();
        await ensureEndpointsView(ctx);
        collapseAllCards();
      },

      action: async (ctx) => {
        // Find and scroll to GET /posts/{id}
        const getCard = document.querySelector<HTMLElement>(CAT.endpointCard('GET', '/posts/{id}'));
        if (!getCard) return;
        getCard.scrollIntoView({ block: 'center' });
        await ctx.delay(500);

        // Expand the card
        const header = getCard.querySelector<HTMLElement>('.sw-header');
        if (header) header.click();
        await ctx.delay(700);

        // Click "Try it out"
        const tryitBtn = getCard.querySelector<HTMLElement>(CAT.TRYIT_BTN);
        if (tryitBtn) {
          tryitBtn.click();
        }
        await ctx.delay(600);

        // Spotlight the `id` parameter input — the key teaching
        const paramInput = getCard.querySelector<HTMLInputElement>(CAT.paramInput('id'));
        if (paramInput) {
          await spotlightEl(ctx, paramInput, 1200);

          // Fill the parameter value
          paramInput.focus();
          fillControlledInput(paramInput, '1');
          paramInput.dispatchEvent(new Event('input', { bubbles: true }));
          paramInput.dispatchEvent(new Event('change', { bubbles: true }));
          await ctx.delay(600);

          // Spotlight again to show the filled value
          await spotlightEl(ctx, paramInput, 800);
        }

        // Execute
        const execBtn = getCard.querySelector<HTMLElement>(CAT.EXECUTE_BTN);
        if (execBtn) {
          await spotlightEl(ctx, execBtn, 800);
          execBtn.click();
        }

        // Wait for response
        try {
          await waitForSelector(
            `${CAT.endpointCard('GET', '/posts/{id}')} ${CAT.LIVE_RESPONSE}`,
            8000,
          );
        } catch { /* Network may fail */ }
        await ctx.delay(1000);

        // Spotlight the response — single post data
        const response = getCard.querySelector<HTMLElement>(CAT.LIVE_RESPONSE);
        if (response) {
          response.scrollIntoView({ block: 'nearest' });
          await spotlightEl(ctx, response, 1600);
        }
      },
    },

    // ── Step 4: Send to Harness — Target ─────────────────────────
    {
      id: 'cat2-save-test',
      title: 'Send to Harness — Choose Target',
      description:
        'After a successful Execute, **Send to Harness** appears under the response. Click it ' +
        'to open the **Send to Harness** modal — a two-step promotion wizard.\n\n' +
        '**Step 1 — Target** picks where the test lands:\n' +
        '- **Environment** — which env the harness run uses\n' +
        '- **Microservice** — which service under that env\n' +
        '- **Feature Group** — create or pick a group\n' +
        '- **Test Scenario** — create or pick a scenario\n\n' +
        'Fill each cascade field, then click **Next** to continue to Options.',
      highlight: CAT.SAVE_AS_TEST_BTN,

      preAction: async (ctx) => {
        ensureCatalogTab(ctx);
        await ctx.delay(400);
        await ensureDemoEntrySelected();
        await ensureEndpointsView(ctx);
        closeAuthPanelIfOpen();
        closeEditModalIfOpen();
        await closeHarnessModalIfOpen(ctx);
        resetHostStrategyToFromSpec();
        await ensureGetPostExecuted(ctx);
      },

      action: async (ctx) => {
        const getCard = document.querySelector<HTMLElement>(CAT.endpointCard('GET', '/posts/{id}'));
        if (!getCard) return;

        const response = getCard.querySelector<HTMLElement>(CAT.LIVE_RESPONSE);
        if (response) {
          response.scrollIntoView({ block: 'nearest' });
          await ctx.delay(500);
        }

        const saveBtn = getCard.querySelector<HTMLElement>(CAT.SAVE_AS_TEST_BTN);
        if (!saveBtn) return;
        saveBtn.scrollIntoView({ block: 'nearest' });
        await spotlightEl(ctx, saveBtn, 1400);
        saveBtn.click();

        await waitForSelector(REQ.HARNESS_MODAL, 3000);
        await ctx.delay(700);

        const modal = document.querySelector<HTMLElement>(REQ.HARNESS_MODAL);
        if (modal) {
          await spotlightEl(ctx, modal, 1000);
        }

        // Walk each Target cascade field with content-based pauses
        await selectCascadeByName(ctx, REQ.HARNESS_CASCADE_ENV, CAT2_ENV_NAME, 1200);
        await selectCascadeByName(ctx, REQ.HARNESS_CASCADE_SVC, CAT2_SVC_NAME, 1200);
        await createCascadeItem(ctx, REQ.HARNESS_CASCADE_GROUP, CAT2_FG_NAME, 1100);
        await createCascadeItem(ctx, REQ.HARNESS_CASCADE_SCENARIO, CAT2_SCENARIO_NAME, 1100);

        // Spotlight the Next button — viewer sees it's ready
        const nextBtn = document.querySelector<HTMLButtonElement>(REQ.HARNESS_NEXT_BTN);
        if (nextBtn) {
          await spotlightEl(ctx, nextBtn, 1100);
        }
      },
    },

    // ── Step 5: Send to Harness — Options ────────────────────────
    {
      id: 'cat2-save-options',
      title: 'Send to Harness — Options',
      description:
        '**Step 2 — Options** confirms the target path and lets you tune the harness test:\n\n' +
        '- **Target summary** — Environment / Microservice / Feature Group / Scenario breadcrumb\n' +
        '- **Preview card** — method, URL, and auth inherited from Try It Out\n' +
        '- **Auth Mode** — Snapshot (freeze current auth) or Inherit (use Harness auth)\n' +
        '- **Validation** — None, or assert **Status 200**\n\n' +
        'We select **Status 200**, then **Cancel** — the full **Send to Harness** confirm is ' +
        'covered in the Requests promotion lesson.',
      highlight: REQ.HARNESS_MODAL,

      preAction: async (ctx) => {
        ensureCatalogTab(ctx);
        await ctx.delay(400);
        await ensureDemoEntrySelected();
        await ensureEndpointsView(ctx);
        closeAuthPanelIfOpen();
        resetHostStrategyToFromSpec();
        await ensureGetPostExecuted(ctx);

        // Rebuild Target → Options if the modal was closed / skipped
        if (!document.querySelector(REQ.HARNESS_MODAL)) {
          const getCard = document.querySelector<HTMLElement>(CAT.endpointCard('GET', '/posts/{id}'));
          const saveBtn = getCard?.querySelector<HTMLElement>(CAT.SAVE_AS_TEST_BTN);
          if (saveBtn) {
            saveBtn.click();
            await waitForSelector(REQ.HARNESS_MODAL, 3000).catch(() => {});
            await ctx.delay(400);
            await selectCascadeByName(ctx, REQ.HARNESS_CASCADE_ENV, CAT2_ENV_NAME, 200);
            await selectCascadeByName(ctx, REQ.HARNESS_CASCADE_SVC, CAT2_SVC_NAME, 200);
            await createCascadeItem(ctx, REQ.HARNESS_CASCADE_GROUP, CAT2_FG_NAME, 200);
            await createCascadeItem(ctx, REQ.HARNESS_CASCADE_SCENARIO, CAT2_SCENARIO_NAME, 200);
          }
        }
        // Ensure we're still on the Target step (not yet on Options)
        // — step action will click Next to transition visibly
      },

      action: async (ctx) => {
        const modal = document.querySelector<HTMLElement>(REQ.HARNESS_MODAL);
        if (!modal) return;

        // Click Next to transition to Options — viewer sees the page change
        const nextBtn = modal.querySelector<HTMLButtonElement>(REQ.HARNESS_NEXT_BTN);
        if (nextBtn && !nextBtn.disabled) {
          await spotlightEl(ctx, nextBtn, 900);
          nextBtn.click();
          await ctx.delay(800);
        }

        // Step indicator — Options active
        const optionsStep = modal.querySelector<HTMLElement>('.send-harness-step.active');
        if (optionsStep) {
          await spotlightEl(ctx, optionsStep, 900);
        }

        const summary = modal.querySelector<HTMLElement>('.send-harness-target-summary');
        if (summary) {
          await spotlightEl(ctx, summary, 1400);
        }

        const preview = modal.querySelector<HTMLElement>('.send-harness-preview-card');
        if (preview) {
          await spotlightEl(ctx, preview, 1300);
        }

        const authGroup = modal.querySelectorAll<HTMLElement>('.send-harness-option-group')[0];
        if (authGroup) {
          await spotlightEl(ctx, authGroup, 1400);
        }

        const validationGroup = modal.querySelectorAll<HTMLElement>('.send-harness-option-group')[1];
        if (validationGroup) {
          await spotlightEl(ctx, validationGroup, 1200);
          const status200 = Array.from(validationGroup.querySelectorAll<HTMLLabelElement>('.send-harness-option-card'))
            .find((card) => card.textContent?.includes('Status 200'));
          if (status200) {
            await spotlightEl(ctx, status200, 1000);
            status200.click();
            await ctx.delay(700);
            await spotlightEl(ctx, status200, 900);
          }
        }

        const editorToggle = modal.querySelector<HTMLElement>('.send-harness-editor-toggle');
        if (editorToggle) {
          await spotlightEl(ctx, editorToggle, 900);
        }

        const confirmBtn = modal.querySelector<HTMLElement>(REQ.HARNESS_CONFIRM_BTN);
        if (confirmBtn) {
          await spotlightEl(ctx, confirmBtn, 1000);
        }

        // Close without creating — keep Catalog lesson focused
        const cancelBtn = modal.querySelector<HTMLElement>(REQ.HARNESS_CANCEL_BTN);
        if (cancelBtn) {
          await spotlightEl(ctx, cancelBtn, 800);
          cancelBtn.click();
          await ctx.delay(600);
        }
      },
    },

    {
      id: 'cat2-auth',
      title: 'Authorize Your Requests',
      description:
        'Click **Authorize** to open the auth panel, then open the **Type** dropdown. ' +
        'It lists every auth mode: Inherit from Spec, From Environment, No Auth, Bearer, ' +
        'Basic, and API Key.\n\n' +
        'Select **Bearer Token** and type a token value. The **prefix field** lets you customize ' +
        'the `Authorization` header format (default: "Bearer"). The **Verify Auth** button tests ' +
        'your credentials against the API. Once set, all subsequent Execute calls include this auth.',
      highlight: CAT.AUTH_TYPE_SELECT,

      preAction: async (ctx) => {
        ensureCatalogTab(ctx);
        await ensureDemoEntrySelected();
        await ensureEndpointsView(ctx);
        await closeHarnessModalIfOpen(ctx);
        // Open the auth panel so the Type dropdown is visible for reading spotlight
        if (!document.querySelector(CAT.AUTH_PANEL)) {
          const authBtn = document.querySelector<HTMLElement>(CAT.AUTHORIZE_BTN);
          authBtn?.click();
          await waitForSelector(CAT.AUTH_PANEL, 2000);
          await ctx.delay(300);
        }
      },

      action: async (ctx) => {
        // Ensure panel is open
        if (!document.querySelector(CAT.AUTH_PANEL)) {
          await spotlight(ctx, CAT.AUTHORIZE_BTN, 900);
          await ctx.click(CAT.AUTHORIZE_BTN);
          await waitForSelector(CAT.AUTH_PANEL, 2000);
          await ctx.delay(600);
        }

        const authPanel = document.querySelector<HTMLElement>(CAT.AUTH_PANEL);
        if (!authPanel) return;

        // Spotlight the Type CustomSelect, then open its menu
        const typeSelect = authPanel.querySelector<HTMLElement>(CAT.AUTH_TYPE_SELECT);
        if (!typeSelect) return;
        await spotlightEl(ctx, typeSelect, 1200);

        const trigger = typeSelect.querySelector<HTMLElement>('.cs-trigger');
        if (trigger) {
          await spotlightEl(ctx, trigger, 800);
          trigger.click();
          await ctx.delay(500);
        }

        // Spotlight the open menu, then each option so the viewer sees all modes
        const menu = document.querySelector<HTMLElement>('.cs-menu');
        if (menu) {
          await spotlightEl(ctx, menu, 1000);
          const items = Array.from(menu.querySelectorAll<HTMLElement>('.cs-item'));
          for (const item of items.slice(0, 6)) {
            await spotlightEl(ctx, item, 700);
          }

          // Select Bearer Token
          const bearerOpt = items.find((item) => {
            const label = item.querySelector('.cs-item-label')?.textContent?.trim().toLowerCase()
              ?? item.textContent?.trim().toLowerCase()
              ?? '';
            return label.includes('bearer');
          });
          if (bearerOpt) {
            await spotlightEl(ctx, bearerOpt, 1000);
            bearerOpt.click();
            await ctx.delay(700);
          } else {
            // Close menu if Bearer not found
            trigger?.click();
          }
        }

        // Spotlight the token input field
        const tokenInput = authPanel.querySelector<HTMLInputElement>(CAT.AUTH_TOKEN_INPUT);
        if (tokenInput) {
          await spotlightEl(ctx, tokenInput, 1000);
          tokenInput.focus();
          fillControlledInput(tokenInput, 'demo-token-2024');
          await ctx.delay(700);
          await spotlightEl(ctx, tokenInput, 800);
        }

        // Spotlight the prefix field (customizable Authorization header format)
        const prefixInput = authPanel.querySelector<HTMLElement>(CAT.AUTH_PREFIX_INPUT);
        if (prefixInput) {
          await spotlightEl(ctx, prefixInput, 1000);
        }

        // Spotlight and click the Verify Auth button
        const verifyBtn = authPanel.querySelector<HTMLElement>(CAT.VERIFY_AUTH_BTN);
        if (verifyBtn) {
          await spotlightEl(ctx, verifyBtn, 1000);
          await ctx.click(CAT.VERIFY_AUTH_BTN);
          await ctx.delay(1500);

          // Spotlight the result badge (one-line with close button)
          const verifyResult = authPanel.querySelector<HTMLElement>('.ceb-verify-result');
          if (verifyResult) {
            await spotlightEl(ctx, verifyResult, 1800);
          }
        }

        // Close the auth panel
        await ctx.delay(500);
        closeAuthPanelIfOpen();
        await ctx.delay(700);
      },
    },

    // ── Step 6: Copy as cURL ────────────────────────────────────
    {
      id: 'cat2-curl',
      title: 'Copy as cURL',
      description:
        'Switch to **POST /posts** — a richer endpoint with method, headers, and a JSON body. ' +
        'Click the **cURL** button in the execute bar to see the full command: `-X POST`, ' +
        '`Content-Type` header, and `-d` body data.\n\n' +
        'Toggle between **multi-line** (readable) and **single-line** (paste-ready) formats. ' +
        'Click **Copy** to grab it — ready to paste into a terminal or CI script.',
      highlight: CAT.CURL_BTN,

      preAction: async (ctx) => {
        ensureCatalogTab(ctx);
        await ensureDemoEntrySelected();
        await ensureEndpointsView(ctx);
        await closeHarnessModalIfOpen(ctx);
        closeAuthPanelIfOpen();
        collapseAllCards();
        await ensureCardTryItOpen('POST', '/posts');
      },

      action: async (ctx) => {
        const postCard = document.querySelector<HTMLElement>(CAT.endpointCard('POST', '/posts'));
        if (!postCard) return;
        postCard.scrollIntoView({ block: 'center' });
        await ctx.delay(400);

        // Click the cURL button
        const curlBtn = postCard.querySelector<HTMLElement>(CAT.CURL_BTN);
        if (curlBtn) {
          curlBtn.scrollIntoView({ block: 'nearest' });
          await spotlightEl(ctx, curlBtn, 900);
          curlBtn.click();
        }
        await ctx.delay(900);

        // Spotlight the cURL syntax-highlighted box
        const curlBox = postCard.querySelector<HTMLElement>(CAT.CURL_BOX);
        if (curlBox) {
          curlBox.scrollIntoView({ block: 'nearest' });
          await spotlightEl(ctx, curlBox, 1800);

          // Toggle to single-line — viewer sees the command collapse
          const toggleBtns = curlBox.querySelectorAll<HTMLElement>('.sw-curl-toggle');
          const multiBtn = toggleBtns[0]; // ⏎ multi-line
          const singleBtn = toggleBtns[1]; // ― single-line
          if (singleBtn) {
            await spotlightEl(ctx, singleBtn, 900);
            singleBtn.click();
            await ctx.delay(1200);
            await spotlightEl(ctx, curlBox.querySelector<HTMLElement>('.sw-curl-hl') ?? curlBox, 1400);
          }
          // Toggle back to multi-line — viewer sees it expand
          if (multiBtn) {
            await spotlightEl(ctx, multiBtn, 900);
            multiBtn.click();
            await ctx.delay(1200);
            await spotlightEl(ctx, curlBox.querySelector<HTMLElement>('.sw-curl-hl') ?? curlBox, 1400);
          }

          // Click Copy button
          const copyBtn = curlBox.querySelector<HTMLElement>('.sw-copy-btn');
          if (copyBtn) {
            await spotlightEl(ctx, copyBtn, 800);
            copyBtn.click();
            await ctx.delay(1000);
          }
        }
      },
    },
  ],
};
