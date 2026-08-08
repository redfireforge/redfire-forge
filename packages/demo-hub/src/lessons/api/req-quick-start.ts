/**
 * REQ-1 v2: Quick Start — Your First Request
 *
 * 4 steps: create collection → add request → send → explore response.
 * Everything from scratch — no Gallery imports.
 * Each step highlights features in detail so the user sees everything available.
 * Public API: JSONPlaceholder (https://jsonplaceholder.typicode.com/users)
 */
import type { DemoLesson, DemoActionContext } from '../../types';
import { REQ } from '@shared/selectors';
import { showSpotlightRing } from '../../demoRipple';
import { fillControlledInput } from '../setup-helpers';
import {
  ensureRequestsTab,
  triggerContextMenu,
  clickContextMenuItem,
  dismissContextMenu,
  shrinkAllCollections,
  ensureCollectionExpanded,
  closeAllRequestTabs,
  fillNewRequestPrompt,
  dismissNewRequestPrompt,
  cleanupOtherRequestDemoCollections,
  selectRequestByName,
  getActiveRequestTabLabel,
} from './req-demo-helpers';

const COLLECTION_NAME = 'My API';
const REQUEST_NAME = 'Get Users';
const REQUEST_URL = 'https://jsonplaceholder.typicode.com/users';
let activeSpotlightCleanup: (() => void) | null = null;

/** True when the lesson's URL-collection request is the active editor (not a leftover ENV tab). */
function isLessonRequestActive(): boolean {
  if (!document.querySelector(REQ.reqInCollection(COLLECTION_NAME, REQUEST_NAME))) return false;
  const tabLabel = getActiveRequestTabLabel()?.trim();
  if (tabLabel === REQUEST_NAME) return true;
  const nameEl = document.querySelector(REQ.NAME_DISPLAY);
  return nameEl?.textContent?.trim() === REQUEST_NAME;
}

function fillLessonUrlIfNeeded(): void {
  const urlInput = firstVisible(REQ.URL_INPUT) as HTMLInputElement | null;
  if (urlInput && urlInput.value !== REQUEST_URL) {
    urlInput.focus();
    fillControlledInput(urlInput, REQUEST_URL);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────

async function spotlight(ctx: DemoActionContext, selector: string, holdMs: number): Promise<void> {
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) return;
  activeSpotlightCleanup?.();
  activeSpotlightCleanup = null;
  el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  const remove = showSpotlightRing(el);
  activeSpotlightCleanup = remove;
  try { await ctx.delay(holdMs); } finally {
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
  try { await ctx.delay(holdMs); } finally {
    remove();
    if (activeSpotlightCleanup === remove) activeSpotlightCleanup = null;
  }
}

async function spotlightElNoScroll(ctx: DemoActionContext, el: HTMLElement, holdMs: number): Promise<void> {
  activeSpotlightCleanup?.();
  activeSpotlightCleanup = null;
  const remove = showSpotlightRing(el);
  activeSpotlightCleanup = remove;
  try { await ctx.delay(holdMs); } finally {
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
  const els = Array.from(document.querySelectorAll<HTMLElement>(selector));
  return els.find(isVisible) ?? null;
}

async function openCollectionContextMenu(ctx: DemoActionContext): Promise<boolean> {
  const col = firstVisible(REQ.colByName(COLLECTION_NAME));
  if (!col) return false;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    triggerContextMenu(col);
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

async function spotlightContextItem(ctx: DemoActionContext, text: string, holdMs = 900): Promise<boolean> {
  const menu = firstVisible(REQ.CONTEXT_MENU);
  if (!menu) return false;
  const btn = Array.from(menu.querySelectorAll<HTMLButtonElement>('button'))
    .find(b => b.textContent?.trim() === text);
  if (!btn) return false;
  await spotlightElNoScroll(ctx, btn, holdMs);
  return true;
}

async function deleteCollectionByName(ctx: DemoActionContext, collectionName: string): Promise<void> {
  ensureRequestsTab(ctx);
  await ctx.delay(60);
  let guard = 0;
  while (document.querySelector(REQ.colByName(collectionName)) && guard < 4) {
    const col = document.querySelector<HTMLElement>(REQ.colByName(collectionName));
    if (!col) break;
    col.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    triggerContextMenu(col);
    await ctx.delay(140);
    const clicked = await clickContextMenuItem(ctx, 'Delete Collection');
    if (!clicked) {
      dismissContextMenu();
      break;
    }
    const confirmBtn = document.querySelector<HTMLElement>('.req-confirm-dialog .req-confirm-ok');
    if (confirmBtn) {
      confirmBtn.click();
      await ctx.delay(120);
    }
    guard += 1;
  }
}

async function cleanupLessonCollections(ctx: DemoActionContext): Promise<void> {
  // Remove leftovers from sibling Request lessons so Lesson 1 starts clean.
  await deleteCollectionByName(ctx, COLLECTION_NAME);
  await cleanupOtherRequestDemoCollections(ctx, [COLLECTION_NAME]);
}

async function ensureCollectionAndRequest(ctx: DemoActionContext): Promise<void> {
  ensureRequestsTab(ctx);
  dismissNewRequestPrompt();

  if (document.querySelector(REQ.colByName(COLLECTION_NAME))) {
    // Never treat an unrelated open editor (e.g. leftover ENV request) as "ready".
    if (document.querySelector(REQ.reqInCollection(COLLECTION_NAME, REQUEST_NAME))) {
      await selectRequestByName(ctx, REQUEST_NAME, COLLECTION_NAME);
      fillLessonUrlIfNeeded();
      return;
    }
    const opened = await openCollectionContextMenu(ctx);
    if (opened) {
      await clickContextItemVisible(ctx, 'Add Request');
      await fillNewRequestPrompt(ctx, REQUEST_NAME);
      await ctx.waitFor(REQ.URL_INPUT, 2200);
      fillLessonUrlIfNeeded();
      await ctx.delay(100);
    }
    return;
  }

  // Create collection silently
  await ctx.click(REQ.SIDEBAR_ADD_BTN);
  await ctx.waitFor(REQ.ADD_URL_COLLECTION, 1500);
  await ctx.click(REQ.ADD_URL_COLLECTION);
  await ctx.waitFor(REQ.COLLECTION_MODAL, 2000);
  const nameInput = document.querySelector<HTMLInputElement>('.req-col-modal .req-input');
  if (nameInput) { nameInput.focus(); fillControlledInput(nameInput, COLLECTION_NAME); }
  const saveBtn = document.querySelector<HTMLButtonElement>('.req-col-modal .btn-primary');
  if (saveBtn) saveBtn.click();
  await ctx.delay(300);

  // Add request silently
  const col = firstVisible(REQ.colByName(COLLECTION_NAME));
  if (col) {
    const opened = await openCollectionContextMenu(ctx);
    if (opened) {
      await clickContextItemVisible(ctx, 'Add Request');
      await fillNewRequestPrompt(ctx, REQUEST_NAME);
    }
    await ctx.waitFor(REQ.URL_INPUT, 2200);
    fillLessonUrlIfNeeded();
    await ctx.delay(100);
  }
}

// ─── Lesson ──────────────────────────────────────────────────────

export const reqQuickStartLesson: DemoLesson = {
  id: 'req-quick-start',
  domainId: 'api',
  category: 'requests',
  name: 'Quick Start',
  description:
    'Create a collection, add your first GET request, send it, and explore the response — all from scratch in 2 minutes.',
  estimatedMinutes: 3,
  initialTab: 'requests',
  allowedTabs: ['requests'],

  concept: {
    title: 'Your First HTTP Request',
    body:
      'The **Requests** workbench is your personal HTTP client — organized by collections, ' +
      'with history, auth inheritance, and promotion to the Test Harness.\n\n' +
      '**What you build in this lesson:**\n' +
      '- Create a new URL collection from scratch\n' +
      '- Add a request using the collection context menu\n' +
      '- Send a real GET call to JSONPlaceholder (`/users`)\n' +
      '- Inspect response JSON, console transcript, and response history\n\n' +
      '**How to read the Request Editor:**\n' +
      '- **Top row:** HTTP method + URL + Send button\n' +
      '- **Left tabs:** Params, Body, Auth, Headers, History (request definition)\n' +
      '- **Right tabs:** Preview, Headers, Console (response inspection)\n\n' +
      '**What success looks like:**\n' +
      '- Green `200 OK` status badge\n' +
      '- Response time and payload size visible\n' +
      '- JSON body rendered in preview tree\n' +
      '- History entry ("Just now") available for quick replay/compare',
    keyTerms: [
      { term: 'Collection', definition: 'A container of related requests; used to keep endpoints organized by feature/domain' },
      { term: 'Request', definition: 'One HTTP operation (method + URL + options) you can send, version, and promote to Harness' },
      { term: 'Response History', definition: 'The last 10 sends per request, each restorable for debugging and comparison' },
    ],
    diagram: `<svg viewBox="0 0 400 100" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="30" width="90" height="40" rx="6" fill="#1e293b" stroke="#3b82f6" stroke-width="1.5"/>
      <text x="55" y="55" text-anchor="middle" fill="#f1f5f9" font-size="11">Collection</text>
      <path d="M105 50 L155 50" stroke="#3b82f6" stroke-width="1.5" marker-end="url(#arr)"/>
      <rect x="160" y="30" width="90" height="40" rx="6" fill="#1e293b" stroke="#10b981" stroke-width="1.5"/>
      <text x="205" y="55" text-anchor="middle" fill="#f1f5f9" font-size="11">Request</text>
      <path d="M255 50 L305 50" stroke="#10b981" stroke-width="1.5" marker-end="url(#arr)"/>
      <rect x="310" y="30" width="80" height="40" rx="6" fill="#1e293b" stroke="#f59e0b" stroke-width="1.5"/>
      <text x="350" y="55" text-anchor="middle" fill="#f1f5f9" font-size="11">Response</text>
      <defs><marker id="arr" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill="#94a3b8"/></marker></defs>
    </svg>`,
  },

  setup: async (ctx) => {
    ctx.navigateToTab('requests');
    await ctx.delay(80);
    await closeAllRequestTabs(ctx);
    await cleanupLessonCollections(ctx);
    await shrinkAllCollections();
    const sidebar = document.querySelector<HTMLElement>(REQ.SIDEBAR);
    if (sidebar) sidebar.scrollTop = 0;
  },

  cleanup: async (ctx) => {
    dismissContextMenu();
    dismissNewRequestPrompt();
    const modalClose = document.querySelector<HTMLElement>('.req-col-modal .btn-secondary');
    if (modalClose) { modalClose.click(); await ctx.delay(60); }
    if (document.querySelector(REQ.HISTORY_DROPDOWN)) {
      const trigger = document.querySelector<HTMLElement>(REQ.HISTORY_TRIGGER);
      if (trigger) { trigger.click(); await ctx.delay(60); }
    }
    await closeAllRequestTabs(ctx);
    await cleanupLessonCollections(ctx);
    ctx.navigateToTab('requests');
    await ctx.delay(60);
  },

  steps: [
    // ── Step 1: Create a Collection ──
    {
      id: 'req1-create-collection',
      title: 'Create a Collection',
      description:
        'Click the **+** button to see three options:\n' +
        '- **Group** — a simple folder for logical grouping\n' +
        '- **URL Collection** — each request stores its own full URL\n' +
        '- **ENV Collection** — requests use relative paths + switchable base URLs per environment\n\n' +
        'We\'ll create a **URL Collection** called **"My API"**. The modal lets you configure ' +
        'the collection name, link a microservice, choose URL mode (Direct vs Multi-Environment), ' +
        'and set default authentication that all requests will inherit.',
      highlight: REQ.SIDEBAR_ADD_BTN,
      preAction: async (ctx) => {
        ensureRequestsTab(ctx);
        if (document.querySelector(REQ.colByName(COLLECTION_NAME))) return;
        await shrinkAllCollections();
      },
      action: async (ctx) => {
        if (document.querySelector(REQ.colByName(COLLECTION_NAME))) {
          await spotlight(ctx, REQ.colByName(COLLECTION_NAME), 900);
          return;
        }

        // Reading phase already highlights + — click once, then pause on dropdown options.
        await ctx.click(REQ.SIDEBAR_ADD_BTN);
        await ctx.waitFor(REQ.ADD_DROPDOWN, 1500);
        await ctx.delay(400);

        await spotlight(ctx, REQ.ADD_URL_COLLECTION, 900);
        await ctx.click(REQ.ADD_URL_COLLECTION);
        await ctx.waitFor(REQ.COLLECTION_MODAL, 2000);
        await ctx.delay(280);

        const nameInput = document.querySelector<HTMLInputElement>('.req-col-modal .req-input');
        if (nameInput) {
          await spotlightElNoScroll(ctx, nameInput, 900);
          nameInput.focus();
          fillControlledInput(nameInput, COLLECTION_NAME);
          await ctx.delay(300);
        }

        const modeSwitcher = document.querySelector<HTMLElement>('.req-col-modal .req-mode-switcher');
        if (modeSwitcher) await spotlightEl(ctx, modeSwitcher, 1100);

        const formGroups = document.querySelectorAll<HTMLElement>('.req-col-modal .req-form-group');
        const authGroup = Array.from(formGroups).find(
          g => g.querySelector('label')?.textContent?.includes('Default Auth')
        );
        if (authGroup) await spotlightEl(ctx, authGroup, 1000);

        const saveBtn = document.querySelector<HTMLButtonElement>('.req-col-modal .btn-primary');
        if (saveBtn) saveBtn.click();
        await ctx.delay(350);

        await spotlight(ctx, REQ.colByName(COLLECTION_NAME), 1000);
      },
    },

    // ── Step 2: Add a Request ──
    {
      id: 'req1-add-request',
      title: 'Add a Request',
      description:
        'Right-click the collection to open the **context menu**. Choose **"Add Request"** — ' +
        'the editor opens in its own **tab** with **GET** as the default method ' +
        '(GET / POST / PUT / PATCH / DELETE / HEAD / OPTIONS). ' +
        'Type the URL: `https://jsonplaceholder.typicode.com/users`.',
      // No reading-phase highlight — Step 1 already showed My API; re-highlighting it is noise.
      preAction: async (ctx) => {
        ensureRequestsTab(ctx);
        dismissNewRequestPrompt();
        if (!document.querySelector(REQ.colByName(COLLECTION_NAME))) {
          await ensureCollectionAndRequest(ctx);
        } else if (document.querySelector(REQ.reqInCollection(COLLECTION_NAME, REQUEST_NAME))) {
          // Quiet recover: open the lesson request so a leftover ENV tab is not used.
          if (!isLessonRequestActive()) {
            await selectRequestByName(ctx, REQUEST_NAME, COLLECTION_NAME);
          }
          fillLessonUrlIfNeeded();
        }
      },
      action: async (ctx) => {
        // Only skip the visible "Add Request" tour when the lesson request already exists.
        // An unrelated open editor (ENV leftover) must NOT skip creation — filling JSONPlaceholder
        // into a multi-env path field gets stripToRelative()'d back to `/users` + GM base URL.
        const demoReqExists = !!document.querySelector(
          REQ.reqInCollection(COLLECTION_NAME, REQUEST_NAME),
        );
        if (!demoReqExists) {
          const opened = await openCollectionContextMenu(ctx);
          if (!opened) {
            await ensureCollectionAndRequest(ctx);
          } else {
            await spotlightContextItem(ctx, 'Add Request', 1100);
            await clickContextItemVisible(ctx, 'Add Request');
            await ctx.delay(400);

            // Spotlight the naming prompt, fill the request name
            const prompt = firstVisible(REQ.NEW_REQ_PROMPT);
            if (prompt) {
              await spotlightElNoScroll(ctx, prompt, 1000);
              const promptInput = document.querySelector<HTMLInputElement>(REQ.NEW_REQ_NAME);
              if (promptInput) {
                fillControlledInput(promptInput, REQUEST_NAME);
                await ctx.delay(400);
              }
              const createBtn = document.querySelector<HTMLButtonElement>(`${REQ.NEW_REQ_PROMPT} .btn-primary`);
              if (createBtn) createBtn.click();
              await ctx.delay(500);
            }

            await ctx.waitFor(REQ.URL_INPUT, 2200);
            await ctx.delay(260);
          }
        } else if (!isLessonRequestActive()) {
          await selectRequestByName(ctx, REQUEST_NAME, COLLECTION_NAME);
          await ctx.delay(200);
        }

        await spotlight(ctx, REQ.METHOD_SELECT, 1000);

        const input = firstVisible(REQ.URL_INPUT) as HTMLInputElement | null;
        if (input) {
          await spotlightElNoScroll(ctx, input, 700);
          if (input.value !== REQUEST_URL) {
            input.focus();
            fillControlledInput(input, REQUEST_URL);
            await ctx.delay(350);
          }
          await spotlightElNoScroll(ctx, input, 900);
        }

        await ensureCollectionExpanded(ctx, COLLECTION_NAME);
        const createdReq =
          firstVisible(REQ.reqInCollection(COLLECTION_NAME, REQUEST_NAME))
          ?? firstVisible(`.req-col-group:has(${REQ.colByName(COLLECTION_NAME)}) ${REQ.REQ_ITEM}`);
        if (createdReq) await spotlightElNoScroll(ctx, createdReq, 1000);
      },
    },

    // ── Step 3: Send & See Response ──
    {
      id: 'req1-send',
      title: 'Send & See Response',
      description:
        'Click **Send** to fire the GET request. Then walk the response UI one piece at a time:\n' +
        '- **Status**, **time**, and **size** — outcome metrics\n' +
        '- **Preview** — JSON body tree\n' +
        '- **Headers** — click to inspect response headers, then return to Preview\n' +
        '- **Expand All / Collapse All** — click each to open and compact the JSON tree',
      highlight: REQ.SEND_BTN,
      preAction: async (ctx) => {
        ensureRequestsTab(ctx);
        if (!isLessonRequestActive()) {
          await ensureCollectionAndRequest(ctx);
        }
        fillLessonUrlIfNeeded();
        await ctx.waitFor(REQ.SEND_BTN, 2000);
      },
      action: async (ctx) => {
        // Reading ring clears when Acting starts — click Send, then one spotlight at a time.
        await ctx.click(REQ.SEND_BTN);
        await ctx.waitFor(REQ.STATUS_PILL, 5000);

        await spotlight(ctx, REQ.STATUS_PILL, 1100);
        await spotlight(ctx, REQ.RESPONSE_TIME, 1000);
        await spotlight(ctx, REQ.RESPONSE_SIZE, 1000);

        await spotlight(ctx, REQ.RESP_TAB_PREVIEW, 1000);
        const jsonPreview = firstVisible(REQ.JSON_PREVIEW);
        if (jsonPreview) await spotlightEl(ctx, jsonPreview, 1100);

        // Headers: highlight → click → pause on content
        await spotlight(ctx, REQ.RESP_TAB_HEADERS, 1000);
        await ctx.click(REQ.RESP_TAB_HEADERS);
        await ctx.delay(450);
        const headersList = document.querySelector<HTMLElement>('.req-resp-headers-list');
        if (headersList) await spotlightEl(ctx, headersList, 1100);

        // Back to Preview so Expand/Collapse tools are available
        await spotlight(ctx, REQ.RESP_TAB_PREVIEW, 800);
        await ctx.click(REQ.RESP_TAB_PREVIEW);
        await ctx.delay(400);

        // Expand All / Collapse All: highlight → click → pause on result
        await spotlight(ctx, REQ.RESP_EXPAND_ALL, 1000);
        await ctx.click(REQ.RESP_EXPAND_ALL);
        await ctx.delay(450);
        const expandedTree = firstVisible(REQ.JSON_PREVIEW);
        if (expandedTree) await spotlightEl(ctx, expandedTree, 900);

        await spotlight(ctx, REQ.RESP_COLLAPSE_ALL, 1000);
        await ctx.click(REQ.RESP_COLLAPSE_ALL);
        await ctx.delay(450);
        const collapsedTree = firstVisible(REQ.JSON_PREVIEW);
        if (collapsedTree) await spotlightEl(ctx, collapsedTree, 900);
      },
    },

    // ── Step 4: Console & History ──
    {
      id: 'req1-explore',
      title: 'Console & History',
      description:
        'Open the **Console** tab to see the full HTTP transcript: request headers, response ' +
        'headers, timing, and redirects.\n\n' +
        'Then open **"Just now"** for **Response History** — the last 10 sends are recorded. ' +
        'Click any entry to restore that response instantly.',
      highlight: REQ.RESP_TAB_CONSOLE,
      preAction: async (ctx) => {
        ensureRequestsTab(ctx);
        if (!document.querySelector(REQ.STATUS_PILL)) {
          if (!isLessonRequestActive()) {
            await ensureCollectionAndRequest(ctx);
          }
          fillLessonUrlIfNeeded();
          const sendBtn = document.querySelector<HTMLElement>(REQ.SEND_BTN);
          if (sendBtn) sendBtn.click();
          await ctx.waitFor(REQ.STATUS_PILL, 5000);
        }
        // Quiet prep only — stay on Preview so Console click is the one visible tab change.
        const previewTab = document.querySelector<HTMLElement>(REQ.RESP_TAB_PREVIEW);
        if (previewTab && !previewTab.classList.contains('active')) {
          previewTab.click();
        }
        if (document.querySelector(REQ.HISTORY_DROPDOWN)) {
          const trigger = document.querySelector<HTMLElement>(REQ.HISTORY_TRIGGER);
          if (trigger) trigger.click();
          await ctx.delay(40);
        }
      },
      action: async (ctx) => {
        // Reading already highlights Console — click once, then show the log.
        await ctx.click(REQ.RESP_TAB_CONSOLE);
        await ctx.waitFor(REQ.CONSOLE_LOG, 1500);
        await spotlight(ctx, REQ.CONSOLE_LOG, 1400);

        // History: spotlight trigger → open → spotlight entry → close dropdown.
        await spotlight(ctx, REQ.HISTORY_TRIGGER, 1000);
        await ctx.click(REQ.HISTORY_TRIGGER);
        await ctx.waitFor(REQ.HISTORY_DROPDOWN, 2000);
        await ctx.delay(220);
        const entry = document.querySelector<HTMLElement>(REQ.HISTORY_ENTRY);
        if (entry) await spotlightEl(ctx, entry, 1100);

        // Hide history after the viewer has seen it.
        if (document.querySelector(REQ.HISTORY_DROPDOWN)) {
          const trigger = document.querySelector<HTMLElement>(REQ.HISTORY_TRIGGER);
          if (trigger) {
            trigger.click();
            await ctx.delay(220);
          }
        }
      },
    },
  ],
};
