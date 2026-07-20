/**
 * REQ-4 v2: Request Body & Authentication
 *
 * 4 steps: create a URL collection & add a POST request → add a JSON body & send
 * (see 201) → configure Bearer Token auth → cURL import/export.
 * Public APIs: JSONPlaceholder (POST), HTTPBin (echo for cURL).
 * Follows v2 principles: create from scratch, rich spotlights, no Gallery.
 */
import type { DemoLesson, DemoActionContext } from '../../types';
import { REQ } from '@shared/selectors';
import { showSpotlightRing } from '../../demoRipple';
import { fillControlledInput } from '../setup-helpers';
import {
  ensureRequestsTab,
  triggerContextMenu,
  dismissContextMenu,
  shrinkAllCollections,
  selectRequestByName,
  closeExtraRequestTabs,
  fillNewRequestPrompt,
  cleanupOtherRequestDemoCollections,
} from './req-demo-helpers';

const COLLECTION_NAME = 'API Demos';
const REQUEST_NAME = 'Create Post';
const POST_URL = 'https://jsonplaceholder.typicode.com/posts';

const JSON_BODY = JSON.stringify({ title: 'Hello World', body: 'My first post via RedfireForge', userId: 1 }, null, 2);
const DEMO_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyIjoiZGVtbyJ9.sample-demo-token';
const CURL_IMPORT_CMD = `curl -X POST https://httpbin.org/post \\
  -H 'Content-Type: application/json' \\
  -H 'X-Custom-Header: RedfireForge-Demo' \\
  -d '{"message": "Hello from cURL"}'`;

let activeSpotlightCleanup: (() => void) | null = null;

async function spotlight(ctx: DemoActionContext, selector: string, holdMs: number): Promise<void> {
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) return;
  activeSpotlightCleanup?.();
  activeSpotlightCleanup = null;
  el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  const remove = showSpotlightRing(el);
  activeSpotlightCleanup = remove;
  try {
    await ctx.delay(holdMs);
  } finally {
    remove();
    if (activeSpotlightCleanup === remove) activeSpotlightCleanup = null;
  }
}

async function spotlightEl(ctx: DemoActionContext, el: HTMLElement, holdMs: number): Promise<void> {
  activeSpotlightCleanup?.();
  activeSpotlightCleanup = null;
  el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  const remove = showSpotlightRing(el);
  activeSpotlightCleanup = remove;
  try {
    await ctx.delay(holdMs);
  } finally {
    remove();
    if (activeSpotlightCleanup === remove) activeSpotlightCleanup = null;
  }
}

async function spotlightElNoScroll(ctx: DemoActionContext, el: HTMLElement, holdMs: number): Promise<void> {
  activeSpotlightCleanup?.();
  activeSpotlightCleanup = null;
  const remove = showSpotlightRing(el);
  activeSpotlightCleanup = remove;
  try {
    await ctx.delay(holdMs);
  } finally {
    remove();
    if (activeSpotlightCleanup === remove) activeSpotlightCleanup = null;
  }
}

function isVisible(el: Element | null): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;
  const style = getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
}

function firstVisible(selector: string): HTMLElement | null {
  return Array.from(document.querySelectorAll<HTMLElement>(selector)).find(isVisible) ?? null;
}

async function openContextMenuForElement(ctx: DemoActionContext, el: HTMLElement): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    triggerContextMenu(el);
    await ctx.waitFor(REQ.CONTEXT_MENU, 700);
    if (firstVisible(REQ.CONTEXT_MENU)) return true;
    await ctx.delay(120);
  }
  return !!firstVisible(REQ.CONTEXT_MENU);
}

async function clickContextItemVisible(ctx: DemoActionContext, text: string): Promise<boolean> {
  const menu = firstVisible(REQ.CONTEXT_MENU);
  if (!menu) return false;
  const btn = Array.from(menu.querySelectorAll<HTMLButtonElement>('button'))
    .find(b => b.textContent?.trim() === text);
  if (!btn) return false;
  btn.click();
  await ctx.delay(180);
  return true;
}

/** Spotlight a context-menu item so the viewer sees which action we take. */
async function spotlightContextItem(
  ctx: DemoActionContext,
  text: string,
  holdMs = 1000,
): Promise<void> {
  const menu = firstVisible(REQ.CONTEXT_MENU);
  if (!menu) return;
  const btn = Array.from(menu.querySelectorAll<HTMLButtonElement>('button'))
    .find(b => b.textContent?.trim() === text);
  if (btn) await spotlightElNoScroll(ctx, btn, holdMs);
}

async function deleteCollectionByName(ctx: DemoActionContext, collectionName: string): Promise<void> {
  ensureRequestsTab(ctx);
  await ctx.delay(40);
  let guard = 0;
  while (document.querySelector(REQ.colByName(collectionName)) && guard < 4) {
    const col = firstVisible(REQ.colByName(collectionName));
    if (!col) break;
    col.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const opened = await openContextMenuForElement(ctx, col);
    if (!opened) break;
    const clicked = await clickContextItemVisible(ctx, 'Delete Collection');
    if (!clicked) { dismissContextMenu(); break; }
    const confirmBtn = document.querySelector<HTMLElement>('.req-confirm-dialog .req-confirm-ok');
    if (confirmBtn) { confirmBtn.click(); await ctx.delay(120); }
    guard += 1;
  }
}

async function closeOpenOverlays(ctx: DemoActionContext): Promise<void> {
  dismissContextMenu();
  const modalClose = document.querySelector<HTMLElement>('.req-col-modal .btn-secondary')
    ?? document.querySelector<HTMLElement>('.req-col-modal .btn-ghost');
  if (modalClose) { modalClose.click(); await ctx.delay(60); }
  // Close cURL panels
  const curlClose = document.querySelector<HTMLElement>('.req-curl-actions .btn-ghost');
  if (curlClose) { curlClose.click(); await ctx.delay(60); }
}

async function createCollectionIfNeeded(ctx: DemoActionContext): Promise<void> {
  if (document.querySelector(REQ.colByName(COLLECTION_NAME))) return;
  await ctx.click(REQ.SIDEBAR_ADD_BTN);
  await ctx.waitFor(REQ.ADD_DROPDOWN, 1500);
  await ctx.click(REQ.ADD_URL_COLLECTION);
  await ctx.waitFor(REQ.COLLECTION_MODAL, 2000);
  const nameInput = document.querySelector<HTMLInputElement>('.req-col-modal .req-input');
  if (nameInput) fillControlledInput(nameInput, COLLECTION_NAME);
  await ctx.delay(80);
  document.querySelector<HTMLButtonElement>('.req-col-modal .btn-primary')?.click();
  await ctx.delay(200);
}

async function ensureRequestExists(ctx: DemoActionContext): Promise<void> {
  await createCollectionIfNeeded(ctx);
  const existing = document.querySelector(REQ.reqByName(REQUEST_NAME));
  if (existing) { await selectRequestByName(ctx, REQUEST_NAME, COLLECTION_NAME); return; }
  const col = firstVisible(REQ.colByName(COLLECTION_NAME));
  if (!col) return;
  const opened = await openContextMenuForElement(ctx, col);
  if (!opened) return;
  await clickContextItemVisible(ctx, 'Add Request');
  await fillNewRequestPrompt(ctx, REQUEST_NAME);
  await ctx.waitFor(REQ.URL_INPUT, 2200);
}

async function ensurePostMethodAndUrl(ctx: DemoActionContext): Promise<void> {
  await ensureRequestExists(ctx);
  // Set method to POST via the custom select
  const methodWrapper = document.querySelector<HTMLElement>(REQ.METHOD_SELECT);
  if (methodWrapper) {
    const trigger = methodWrapper.querySelector<HTMLButtonElement>('button');
    if (trigger && !trigger.textContent?.includes('POST')) {
      trigger.click();
      await ctx.delay(60);
      const postOption = Array.from(document.querySelectorAll<HTMLElement>('[role="option"]'))
        .find(o => o.textContent?.includes('POST'));
      if (postOption) postOption.click();
      await ctx.delay(60);
    }
  }
  const urlInput = document.querySelector<HTMLInputElement>(REQ.URL_INPUT);
  if (urlInput && urlInput.value !== POST_URL) fillControlledInput(urlInput, POST_URL);
}

export const reqBodyAuthLesson: DemoLesson = {
  id: 'req-body-auth',
  domainId: 'api',
  category: 'requests',
  name: 'Request Body & Authentication',
  description:
    'Create a POST request from scratch with a JSON body, send it to see a 201 Created response, ' +
    'configure Bearer Token authentication, and learn cURL import/export for sharing requests.',
  estimatedMinutes: 4,
  initialTab: 'requests',
  allowedTabs: ['requests'],

  concept: {
    title: 'Bodies, Auth & cURL',
    body:
      'Every API call can carry a **body** (the payload you send) and **auth** (your identity proof).\n\n' +
      '**Body Modes:**\n' +
      '- **JSON** — structured data (most common for REST)\n' +
      '- **Form Data** — key-value pairs (file uploads, HTML forms)\n' +
      '- **Form URL Encoded** — encoded key-value pairs\n' +
      '- **XML / Plain Text / File** — other formats\n\n' +
      '**Auth Types:**\n' +
      '- **Bearer Token** — `Authorization: Bearer <token>` header\n' +
      '- **Basic Auth** — base64-encoded username:password\n' +
      '- **API Key** — custom header or query parameter\n' +
      '- **Inherit** — use the parent collection\'s auth\n\n' +
      '**cURL** is the universal language of HTTP. Import any cURL command to auto-fill ' +
      'the request, or export your request as cURL to share with teammates.',
    keyTerms: [
      { term: 'Body Mode', definition: 'Format of the request payload — JSON, Form Data, URL-Encoded, XML, etc.' },
      { term: 'Bearer Token', definition: 'Authorization header carrying a JWT or opaque token for API access' },
      { term: 'Auth Inheritance', definition: 'Requests inherit auth from their parent collection unless overridden' },
      { term: 'cURL Import', definition: 'Paste a cURL command to auto-populate method, URL, headers, and body' },
    ],
    diagram: `<svg viewBox="0 0 400 120" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="10" width="120" height="45" rx="5" fill="#1e293b" stroke="#3b82f6" stroke-width="1.5"/>
      <text x="70" y="28" text-anchor="middle" fill="#3b82f6" font-size="9">Request</text>
      <text x="70" y="42" text-anchor="middle" fill="#94a3b8" font-size="8">POST + JSON Body</text>
      <path d="M130 32 L170 32" stroke="#94a3b8" stroke-width="1" marker-end="url(#arr4)"/>
      <rect x="170" y="10" width="100" height="45" rx="5" fill="#1e293b" stroke="#f59e0b" stroke-width="1.5"/>
      <text x="220" y="28" text-anchor="middle" fill="#f59e0b" font-size="9">Auth Layer</text>
      <text x="220" y="42" text-anchor="middle" fill="#94a3b8" font-size="8">Bearer Token</text>
      <path d="M270 32 L310 32" stroke="#94a3b8" stroke-width="1" marker-end="url(#arr4)"/>
      <rect x="310" y="10" width="80" height="45" rx="5" fill="#1e293b" stroke="#10b981" stroke-width="1.5"/>
      <text x="350" y="28" text-anchor="middle" fill="#10b981" font-size="9">Server</text>
      <text x="350" y="42" text-anchor="middle" fill="#94a3b8" font-size="8">201 Created</text>
      <rect x="10" y="75" width="380" height="35" rx="5" fill="#1e293b" stroke="#94a3b8" stroke-width="1" stroke-dasharray="3"/>
      <text x="200" y="96" text-anchor="middle" fill="#94a3b8" font-size="9">curl -X POST ... -H 'Authorization: Bearer ...' -d '{...}'</text>
      <defs><marker id="arr4" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" fill="none" stroke="#94a3b8" stroke-width="1"/></marker></defs>
    </svg>`,
  },

  setup: async (ctx) => {
    ctx.navigateToTab('requests');
    await ctx.delay(80);
    await closeExtraRequestTabs(ctx);
    await closeOpenOverlays(ctx);
    await deleteCollectionByName(ctx, COLLECTION_NAME);
    await cleanupOtherRequestDemoCollections(ctx, [COLLECTION_NAME]);
    await shrinkAllCollections();
  },

  cleanup: async (ctx) => {
    await closeOpenOverlays(ctx);
    await closeExtraRequestTabs(ctx);
    await deleteCollectionByName(ctx, COLLECTION_NAME);
    await cleanupOtherRequestDemoCollections(ctx, [COLLECTION_NAME]);
    ctx.navigateToTab('requests');
    await ctx.delay(60);
  },

  steps: [
    // ── Step 1: Create a Collection & Add a POST Request ──
    {
      id: 'req4-setup',
      title: 'Create a Collection & Add a Request',
      description:
        'Collections group related requests. Click the **+** button, choose **URL Collection**, ' +
        'name it **"API Demos"**, and save. A URL Collection holds requests that each carry their ' +
        'own full URL — perfect for ad-hoc APIs you\'re exploring.\n\n' +
        'Then **right-click** the collection and choose **Add Request**. Name it **"Create Post"**, ' +
        'switch the method to **POST**, and set the URL to `jsonplaceholder.typicode.com/posts`.',
      highlight: REQ.SIDEBAR_ADD_BTN,
      preAction: async (ctx) => {
        ensureRequestsTab(ctx);
        await closeOpenOverlays(ctx);
        await deleteCollectionByName(ctx, COLLECTION_NAME);
        await cleanupOtherRequestDemoCollections(ctx, [COLLECTION_NAME]);
        await shrinkAllCollections();
      },
      action: async (ctx) => {
        // ── Create the collection (skip if it already exists) ──
        if (!document.querySelector(REQ.colByName(COLLECTION_NAME))) {
          await spotlight(ctx, REQ.SIDEBAR_ADD_BTN, 800);
          await ctx.click(REQ.SIDEBAR_ADD_BTN);
          await ctx.waitFor(REQ.ADD_DROPDOWN, 1500);
          await spotlight(ctx, REQ.ADD_URL_COLLECTION, 900);
          await ctx.click(REQ.ADD_URL_COLLECTION);
          await ctx.waitFor(REQ.COLLECTION_MODAL, 2000);
          await ctx.delay(300);

          const nameInput = document.querySelector<HTMLInputElement>('.req-col-modal .req-input');
          if (nameInput) {
            await spotlightElNoScroll(ctx, nameInput, 800);
            nameInput.focus();
            fillControlledInput(nameInput, COLLECTION_NAME);
            await ctx.delay(350);
          }
          document.querySelector<HTMLButtonElement>('.req-col-modal .btn-primary')?.click();
          await ctx.delay(400);
          await spotlight(ctx, REQ.colByName(COLLECTION_NAME), 1100);
        }

        // ── Add the request (rapid Next / restart guard) ──
        if (document.querySelector(REQ.reqInCollection(COLLECTION_NAME, REQUEST_NAME))) {
          await ensurePostMethodAndUrl(ctx);
          await selectRequestByName(ctx, REQUEST_NAME, COLLECTION_NAME);
          const existing = firstVisible(REQ.reqByName(REQUEST_NAME));
          if (existing) await spotlightEl(ctx, existing, 1200);
          return;
        }

        // Right-click the collection → show the context menu → highlight Add Request.
        const col = firstVisible(REQ.colByName(COLLECTION_NAME));
        if (!col) return;
        await spotlightEl(ctx, col, 800);
        const opened = await openContextMenuForElement(ctx, col);
        if (!opened) return;
        await spotlightContextItem(ctx, 'Add Request', 1100);
        await clickContextItemVisible(ctx, 'Add Request');
        await ctx.delay(300);
        const prompt = document.querySelector<HTMLElement>('[data-testid="req-new-request-prompt"]');
        if (prompt) await spotlightElNoScroll(ctx, prompt, 900);
        await fillNewRequestPrompt(ctx, REQUEST_NAME);
        await ctx.waitFor(REQ.URL_INPUT, 2200);
        await ctx.delay(240);

        // Change method to POST (show the full method list).
        const methodWrapper = document.querySelector<HTMLElement>(REQ.METHOD_SELECT);
        if (methodWrapper) {
          await spotlightElNoScroll(ctx, methodWrapper, 900);
          const trigger = methodWrapper.querySelector<HTMLButtonElement>('button');
          if (trigger) {
            trigger.click();
            await ctx.delay(400);
            const postOption = Array.from(document.querySelectorAll<HTMLElement>('[role="option"]'))
              .find(o => o.textContent?.includes('POST'));
            if (postOption) {
              await spotlightElNoScroll(ctx, postOption, 800);
              postOption.click();
              await ctx.delay(300);
            }
          }
        }

        // Fill the URL.
        const urlInput = document.querySelector<HTMLInputElement>(REQ.URL_INPUT);
        if (urlInput) {
          await spotlightElNoScroll(ctx, urlInput, 800);
          urlInput.focus();
          fillControlledInput(urlInput, POST_URL);
          await ctx.delay(400);
          await spotlightElNoScroll(ctx, urlInput, 900);
        }

        // Reveal & select the new request in the sidebar.
        await selectRequestByName(ctx, REQUEST_NAME, COLLECTION_NAME);
        await ctx.delay(300);
        const createdReq = firstVisible(REQ.reqByName(REQUEST_NAME))
          ?? document.querySelector<HTMLElement>(REQ.reqInCollection(COLLECTION_NAME, REQUEST_NAME));
        if (createdReq) await spotlightEl(ctx, createdReq, 1300);
      },
    },

    // ── Step 2: Add a JSON Body & Send (see 201) ──
    {
      id: 'req4-body-send',
      title: 'Add a JSON Body & Send',
      description:
        'Open the **Body** tab and pick the **JSON** body type — the selector offers **JSON**, ' +
        '**Form Data**, **URL Encoded**, **XML**, **Plain Text**, **File**, and **None**. ' +
        'Paste a JSON payload; this is the data the POST request sends to the server.\n\n' +
        'Then click **Send**. Watch the response: **201 Created** means the server accepted the ' +
        'new post, and the body includes a generated `id`. Status colors: **green** = 2xx success, ' +
        '**yellow** = 3xx redirect, **red** = 4xx/5xx error.',
      highlight: REQ.TAB_BODY,
      preAction: async (ctx) => {
        ensureRequestsTab(ctx);
        await closeOpenOverlays(ctx);
        await ensurePostMethodAndUrl(ctx);
      },
      action: async (ctx) => {
        // ── Add the JSON body ──
        const bodyTab = document.querySelector<HTMLElement>(REQ.TAB_BODY);
        if (bodyTab) {
          await spotlightElNoScroll(ctx, bodyTab, 800);
          bodyTab.click();
          await ctx.delay(500);
        }

        // Open the body-type selector and pick JSON (show all modes first).
        const bodyTypeTrigger = document.querySelector<HTMLElement>(REQ.BODY_TYPE_TRIGGER);
        if (bodyTypeTrigger) {
          await spotlightElNoScroll(ctx, bodyTypeTrigger, 1000);
          bodyTypeTrigger.click();
          await ctx.delay(400);
          const jsonOption = Array.from(document.querySelectorAll<HTMLElement>('.body-type-dropdown-item'))
            .find(o => o.textContent?.includes('JSON'));
          if (jsonOption) {
            await spotlightElNoScroll(ctx, jsonOption, 800);
            jsonOption.click();
            await ctx.delay(400);
          }
        }

        // Paste the JSON payload.
        const bodyTextarea = document.querySelector<HTMLTextAreaElement>('.body-code-textarea');
        if (bodyTextarea) {
          bodyTextarea.focus();
          fillControlledInput(bodyTextarea, JSON_BODY);
          await ctx.delay(400);
          await spotlightElNoScroll(ctx, bodyTextarea, 1400);
        }

        // ── Send & inspect the 201 response ──
        await spotlight(ctx, REQ.SEND_BTN, 1000);
        await ctx.click(REQ.SEND_BTN);
        await ctx.waitFor(REQ.STATUS_PILL, 5000);

        await spotlight(ctx, REQ.STATUS_PILL, 1100);
        await spotlight(ctx, REQ.RESPONSE_TIME, 800);
        await spotlight(ctx, REQ.RESPONSE_SIZE, 800);

        const json = firstVisible(REQ.JSON_PREVIEW);
        if (json) await spotlightEl(ctx, json, 1200);
      },
    },

    // ── Step 3: Configure Bearer Token Auth ──
    {
      id: 'req4-auth',
      title: 'Configure Bearer Token',
      description:
        'Click the **Auth** tab to configure authentication. Select **Bearer Token** from the ' +
        'auth type dropdown. This adds an `Authorization: Bearer <token>` header to every request.\n\n' +
        'The dropdown shows all auth options: **Inherit from Collection**, **No Auth**, ' +
        '**Bearer Token**, **Basic Auth**, **API Key**, and **Global Auth Profile**.',
      highlight: REQ.TAB_AUTH,
      preAction: async (ctx) => {
        ensureRequestsTab(ctx);
        await closeOpenOverlays(ctx);
        await ensurePostMethodAndUrl(ctx);
      },
      action: async (ctx) => {
        // Click Auth tab
        const authTab = document.querySelector<HTMLElement>(REQ.TAB_AUTH);
        if (authTab) {
          await spotlightElNoScroll(ctx, authTab, 800);
          authTab.click();
          await ctx.delay(400);
        }

        // Spotlight auth type select and open it
        const authWrapper = document.querySelector<HTMLElement>(REQ.AUTH_TYPE_SELECT);
        if (authWrapper) {
          await spotlightElNoScroll(ctx, authWrapper, 900);
          const trigger = authWrapper.querySelector<HTMLButtonElement>('.req-auth-type-trigger');
          if (trigger) {
            trigger.click();
            await ctx.delay(400);
            const bearerOption = Array.from(authWrapper.querySelectorAll<HTMLElement>('[role="option"]'))
              .find(o => o.textContent?.includes('Bearer'));
            if (bearerOption) {
              await spotlightElNoScroll(ctx, bearerOption, 800);
              bearerOption.click();
              await ctx.delay(400);
            }
          }
        }

        // Fill the token field
        await ctx.waitFor(REQ.AUTH_TOKEN_INPUT, 2000);
        const tokenInput = document.querySelector<HTMLInputElement>(REQ.AUTH_TOKEN_INPUT);
        if (tokenInput) {
          await spotlightElNoScroll(ctx, tokenInput, 800);
          tokenInput.focus();
          fillControlledInput(tokenInput, DEMO_TOKEN);
          await ctx.delay(400);
          await spotlightElNoScroll(ctx, tokenInput, 1000);
        }

        // Spotlight the prefix field
        const prefixInput = document.querySelector<HTMLInputElement>(REQ.AUTH_PREFIX_INPUT);
        if (prefixInput) {
          await spotlightElNoScroll(ctx, prefixInput, 800);
        }

      },
    },

    // ── Step 4: cURL Import & Export ──
    {
      id: 'req4-curl',
      title: 'cURL Import & Export',
      description:
        'Click the **action menu** (▾) and select **cURL Import**. Paste a `curl` command — ' +
        'the request method, URL, headers, and body are auto-populated.\n\n' +
        'Then export back to cURL to share with teammates. The generated command includes ' +
        'your method, URL, headers, body, and auth — ready to paste into a terminal.',
      highlight: REQ.ACTION_MENU_BTN,
      preAction: async (ctx) => {
        ensureRequestsTab(ctx);
        await closeOpenOverlays(ctx);
        await ensurePostMethodAndUrl(ctx);
      },
      action: async (ctx) => {
        // 1. Open action menu
        await spotlight(ctx, REQ.ACTION_MENU_BTN, 900);
        await ctx.click(REQ.ACTION_MENU_BTN);
        await ctx.waitFor(REQ.ACTION_DROPDOWN, 1500);
        await ctx.delay(400);

        // Spotlight import button only
        const importBtn = document.querySelector<HTMLElement>(REQ.CURL_IMPORT_BTN);
        if (importBtn) {
          await spotlightElNoScroll(ctx, importBtn, 800);
          importBtn.click();
          await ctx.delay(400);
        }
        await ctx.waitFor(REQ.CURL_TEXTAREA, 2000);

        // Fill cURL command
        const textarea = document.querySelector<HTMLTextAreaElement>(REQ.CURL_TEXTAREA);
        if (textarea) {
          await spotlightElNoScroll(ctx, textarea, 800);
          textarea.focus();
          fillControlledInput(textarea, CURL_IMPORT_CMD);
          await ctx.delay(500);
          await spotlightElNoScroll(ctx, textarea, 1000);
        }

        // Click Apply
        const applyBtn = document.querySelector<HTMLElement>(REQ.CURL_APPLY_BTN);
        if (applyBtn) {
          await spotlightElNoScroll(ctx, applyBtn as HTMLElement, 800);
          (applyBtn as HTMLButtonElement).click();
          await ctx.delay(600);
        }

        // Spotlight the populated URL (from httpbin)
        const urlInput = document.querySelector<HTMLInputElement>(REQ.URL_INPUT);
        if (urlInput) await spotlightElNoScroll(ctx, urlInput, 1000);

        // Now export — open action menu again
        await ctx.delay(400);
        await ctx.click(REQ.ACTION_MENU_BTN);
        await ctx.waitFor(REQ.ACTION_DROPDOWN, 1500);
        const exportBtn = document.querySelector<HTMLElement>(REQ.CURL_EXPORT_BTN);
        if (exportBtn) {
          await spotlightElNoScroll(ctx, exportBtn, 800);
          exportBtn.click();
          await ctx.delay(400);
        }
        await ctx.waitFor(REQ.CURL_EXPORT_PANEL, 2000);

        // Spotlight the generated cURL output
        const exportTextarea = document.querySelector<HTMLElement>(REQ.CURL_EXPORT_TEXTAREA);
        if (exportTextarea) {
          await spotlightElNoScroll(ctx, exportTextarea, 1500);
        }

        // Close the export panel
        await ctx.delay(300);
        const closeBtn = document.querySelector<HTMLElement>('.req-curl-actions .btn-ghost');
        if (closeBtn) { closeBtn.click(); await ctx.delay(300); }
      },
    },
  ],
};
