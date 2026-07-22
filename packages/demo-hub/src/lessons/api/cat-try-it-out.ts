/**
 * CAT-2 — Live API Execution
 *
 * 6 steps: configure the Host Strategy (From Spec / Environment / Custom URL) →
 * open Try It Out on POST /posts with auto-generated body → execute GET /posts/{id}
 * with a path parameter → save the response as a Test → authorize requests via
 * the Auth panel (Bearer token) → copy as cURL.
 *
 * This lesson teaches everything about live execution from the Catalog: where
 * requests go, how to fill parameters, how to authenticate, and how to export
 * the configured request as a terminal command.
 *
 * Uses the real JSONPlaceholder API (CORS-friendly, no auth required for GETs).
 */
import type { DemoLesson } from '../../types';
import { CAT } from '@shared/selectors';
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
} from './cat-demo-helpers';
import { fillControlledInput } from '../setup-helpers';

// ─── Constants ──────────────────────────────────────────────────

const DEMO_ENTRY_NAME = 'JSONPlaceholder API';

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
    'Execute real API calls from the Catalog — configure where requests go (Host Strategy), ' +
    'fill parameters, authenticate with Bearer tokens, and copy cURL commands.',
  estimatedMinutes: 6,
  initialTab: 'catalog',
  allowedTabs: ['catalog'],

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
    ensureCatalogTab(ctx);
    await ctx.delay(80);
    await seedCatalogEntry(DEMO_ENTRY_NAME, JSONPLACEHOLDER_API_SPEC);
    await waitForSelector(CAT.entryByName(DEMO_ENTRY_NAME), 3000);
    selectCatalogEntryByName(DEMO_ENTRY_NAME);
    await ctx.delay(200);
  },

  cleanup: async (ctx) => {
    closeAuthPanelIfOpen();
    collapseAllCards();
    deleteCatalogEntryByName(DEMO_ENTRY_NAME);
    deleteCollectionsByName(DEMO_ENTRY_NAME);
    ensureCatalogTab(ctx);
    await ctx.delay(60);
  },

  steps: [
    // ── Step 1: Host Strategy — Where Requests Go ───────────────
    {
      id: 'cat2-host',
      title: 'Host Strategy — Where Requests Go',
      description:
        'Before executing any request, you need to know **where it goes**. The Host Strategy ' +
        'selector above the endpoint list offers three modes:\n\n' +
        '- **From Spec** (default) — uses the `servers` URL defined in the OpenAPI spec\n' +
        '- **Environment** — uses a base URL from a linked microservice or app environment\n' +
        '- **Custom URL** — lets you type any URL (localhost, staging, production)\n\n' +
        'The **resolved Base URL** below the buttons shows the active target. Watch it ' +
        'change when you switch to **Custom URL** and back to **From Spec**.',
      highlight: CAT.HOST_STRATEGY,

      preAction: async (ctx) => {
        ensureCatalogTab(ctx);
        await ensureDemoEntrySelected();
        await ensureEndpointsView(ctx);
      },

      action: async (ctx) => {
        // Spotlight the Host Strategy button group — the 3 modes
        await spotlight(ctx, CAT.HOST_STRATEGY, 1200);

        // Spotlight "From Spec" — the active default (800ms per button as spec says)
        const fromSpecBtn = document.querySelector<HTMLElement>(CAT.HOST_FROM_SPEC);
        if (fromSpecBtn) {
          await spotlightEl(ctx, fromSpecBtn, 900);
        }

        // Spotlight "Environment" button
        const envBtn = document.querySelector<HTMLElement>(CAT.HOST_ENVIRONMENT);
        if (envBtn) {
          await spotlightEl(ctx, envBtn, 800);
        }

        // Spotlight "Custom URL" button
        const customBtn = document.querySelector<HTMLElement>(CAT.HOST_CUSTOM_URL);
        if (customBtn) {
          await spotlightEl(ctx, customBtn, 800);
        }

        // Spotlight the base URL display — viewer sees the resolved URL
        const baseUrl = document.querySelector<HTMLElement>(CAT.BASE_URL);
        if (baseUrl) {
          await spotlightEl(ctx, baseUrl, 1100);
        }

        // Switch to Custom URL to demonstrate the URL change
        if (customBtn) {
          customBtn.click();
          await ctx.delay(800);

          // Spotlight the updated base URL — viewer sees it changed
          const updatedBaseUrl = document.querySelector<HTMLElement>(CAT.BASE_URL);
          if (updatedBaseUrl) {
            await spotlightEl(ctx, updatedBaseUrl, 1000);
          }
        }

        // Switch back to From Spec
        if (fromSpecBtn) {
          fromSpecBtn.click();
          await ctx.delay(600);
          await spotlightEl(ctx, fromSpecBtn, 800);
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
      highlight: CAT.endpointCard('POST', '/posts'),

      preAction: async (ctx) => {
        ensureCatalogTab(ctx);
        await ensureDemoEntrySelected();
        await ensureEndpointsView(ctx);
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

        // Wait for the live response
        try {
          await waitForSelector(
            `${CAT.endpointCard('POST', '/posts')} ${CAT.LIVE_RESPONSE}`,
            8000,
          );
        } catch { /* Network may fail — still continue */ }
        await ctx.delay(1000);

        // Spotlight the response — status code, body, timing
        const response = postCard.querySelector<HTMLElement>(CAT.LIVE_RESPONSE);
        if (response) {
          response.scrollIntoView({ block: 'nearest' });
          await spotlightEl(ctx, response, 1800);
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
      highlight: CAT.endpointCard('GET', '/posts/{id}'),

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

    // ── Step 4: Save as Test ─────────────────────────────────────
    {
      id: 'cat2-save-test',
      title: 'Save as Test',
      description:
        'After a successful Execute, a **Save as Test** button appears below the response. ' +
        'Click it to promote the endpoint — with its current parameters, body, and response — ' +
        'directly into the **Test Harness** as a ready-to-run test scenario.\n\n' +
        'This shortcut skips the Requests collection entirely: you go straight from a live ' +
        'API call in the Catalog to a repeatable performance test. The saved test inherits ' +
        'the method, URL, headers, and body you configured in Try It Out.',
      highlight: CAT.SAVE_AS_TEST_BTN,

      preAction: async (ctx) => {
        ensureCatalogTab(ctx);
        await ensureDemoEntrySelected();
        await ensureEndpointsView(ctx);
        closeAuthPanelIfOpen();
        // Need a successful response on GET /posts/{id} for the button to appear
        await ensureCardTryItOpen('GET', '/posts/{id}');
        const getCard = document.querySelector<HTMLElement>(CAT.endpointCard('GET', '/posts/{id}'));
        if (getCard) {
          const hasResponse = getCard.querySelector(CAT.LIVE_RESPONSE);
          if (!hasResponse) {
            // Execute the request silently
            const paramInput = getCard.querySelector<HTMLInputElement>(CAT.paramInput('id'));
            if (paramInput && !paramInput.value) {
              fillControlledInput(paramInput, '1');
            }
            const execBtn = getCard.querySelector<HTMLElement>(CAT.EXECUTE_BTN);
            if (execBtn) execBtn.click();
            try {
              await waitForSelector(
                `${CAT.endpointCard('GET', '/posts/{id}')} ${CAT.LIVE_RESPONSE}`,
                8000,
              );
            } catch { /* Network may fail */ }
          }
        }
      },

      action: async (ctx) => {
        const getCard = document.querySelector<HTMLElement>(CAT.endpointCard('GET', '/posts/{id}'));
        if (!getCard) return;

        // Scroll to the response area so the Save as Test button is visible
        const response = getCard.querySelector<HTMLElement>(CAT.LIVE_RESPONSE);
        if (response) {
          response.scrollIntoView({ block: 'nearest' });
          await ctx.delay(600);
        }

        // Spotlight the Save as Test button
        const saveBtn = getCard.querySelector<HTMLElement>(CAT.SAVE_AS_TEST_BTN);
        if (saveBtn) {
          saveBtn.scrollIntoView({ block: 'nearest' });
          await spotlightEl(ctx, saveBtn, 2000);
        }
      },
    },

    {
      id: 'cat2-auth',
      title: 'Authorize Your Requests',
      description:
        'Click **Authorize** to open the auth configuration panel. The **auth type selector** ' +
        'offers multiple options: Inherit from Spec, From Environment, No Auth, Bearer, Basic, ' +
        'and API Key.\n\n' +
        'Select **Bearer Token** and type a token value. The **prefix field** lets you customize ' +
        'the `Authorization` header format (default: "Bearer"). The **Verify Auth** button tests ' +
        'your credentials against the API. Once set, all subsequent Execute calls include this auth.',
      highlight: CAT.AUTHORIZE_BTN,

      preAction: async (ctx) => {
        ensureCatalogTab(ctx);
        await ensureDemoEntrySelected();
        await ensureEndpointsView(ctx);
        closeAuthPanelIfOpen();
      },

      action: async (ctx) => {
        // Spotlight and click the Authorize button
        await spotlight(ctx, CAT.AUTHORIZE_BTN, 1000);
        await ctx.click(CAT.AUTHORIZE_BTN);
        await ctx.delay(800);

        // Wait for and spotlight the auth panel
        const authPanel = document.querySelector<HTMLElement>(CAT.AUTH_PANEL);
        if (!authPanel) return;
        await spotlightEl(ctx, authPanel, 800);

        // Spotlight the auth type selector — viewer sees all options
        const typeSelect = authPanel.querySelector<HTMLElement>(CAT.AUTH_TYPE_SELECT);
        if (typeSelect) {
          await spotlightEl(ctx, typeSelect, 1400);
        }

        // Select Bearer Token (click the option or change the select)
        if (typeSelect) {
          const selectEl = typeSelect as HTMLSelectElement;
          if (selectEl.tagName === 'SELECT') {
            selectEl.value = 'bearer';
            selectEl.dispatchEvent(new Event('change', { bubbles: true }));
          } else {
            // It might be a custom dropdown — try clicking Bearer option
            const bearerOpt = authPanel.querySelector<HTMLElement>('[data-auth-type="bearer"]');
            if (bearerOpt) bearerOpt.click();
          }
        }
        await ctx.delay(800);

        // Spotlight the token input field
        const tokenInput = authPanel.querySelector<HTMLInputElement>(CAT.AUTH_TOKEN_INPUT);
        if (tokenInput) {
          await spotlightEl(ctx, tokenInput, 900);

          // Fill in a demo token
          tokenInput.focus();
          fillControlledInput(tokenInput, 'demo-token-2024');
          tokenInput.dispatchEvent(new Event('input', { bubbles: true }));
          tokenInput.dispatchEvent(new Event('change', { bubbles: true }));
          await ctx.delay(600);
        }

        // Spotlight the prefix field (customizable Authorization header format)
        const prefixInput = authPanel.querySelector<HTMLElement>(CAT.AUTH_PREFIX_INPUT);
        if (prefixInput) {
          await spotlightEl(ctx, prefixInput, 900);
        }

        // Spotlight the Verify Auth button — explain it tests credentials
        const verifyBtn = authPanel.querySelector<HTMLElement>(CAT.VERIFY_AUTH_BTN);
        if (verifyBtn) {
          await spotlightEl(ctx, verifyBtn, 1200);
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
        'On any endpoint with Try It Out active, click the **cURL** button in the execute ' +
        'bar. The generated curl command appears with syntax highlighting — multi-line, with ' +
        'all headers, the URL, and your auth token already filled in.\n\n' +
        'Toggle between **multi-line** and **single-line** formats. Click **Copy** to grab ' +
        'it to the clipboard — ready to paste into a terminal or CI script.',
      highlight: CAT.CURL_BTN,

      preAction: async (ctx) => {
        ensureCatalogTab(ctx);
        await ensureDemoEntrySelected();
        await ensureEndpointsView(ctx);
        closeAuthPanelIfOpen();
        await ensureCardTryItOpen('GET', '/posts/{id}');
      },

      action: async (ctx) => {
        const getCard = document.querySelector<HTMLElement>(CAT.endpointCard('GET', '/posts/{id}'));
        if (!getCard) return;
        getCard.scrollIntoView({ block: 'center' });
        await ctx.delay(400);

        // Click the cURL button
        const curlBtn = getCard.querySelector<HTMLElement>(CAT.CURL_BTN);
        if (curlBtn) {
          await spotlightEl(ctx, curlBtn, 900);
          curlBtn.click();
        }
        await ctx.delay(900);

        // Spotlight the cURL syntax-highlighted box
        const curlBox = getCard.querySelector<HTMLElement>(CAT.CURL_BOX);
        if (curlBox) {
          curlBox.scrollIntoView({ block: 'nearest' });
          await spotlightEl(ctx, curlBox, 1800);

          // Spotlight the multi-line/single-line toggle if present
          const toggleBtn = curlBox.querySelector<HTMLElement>('.sw-curl-toggle');
          if (toggleBtn) {
            await spotlightEl(ctx, toggleBtn, 800);
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
