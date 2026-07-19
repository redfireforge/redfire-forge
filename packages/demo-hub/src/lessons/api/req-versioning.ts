/**
 * REQ-6 v2: Definition Versioning & History
 *
 * 4 steps: create two requests from scratch → edit & navigate (auto-snapshot) →
 * compare versions side-by-side → restore & rename.
 * Public API: JSONPlaceholder. Follows v2 principles: create from scratch, rich spotlights.
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
  ensureCollectionExpanded,
  closeExtraRequestTabs,
} from './req-demo-helpers';

const COLLECTION_NAME = 'Version Demo';
const REQUEST_1_NAME = 'Users';
const REQUEST_1_URL = 'https://jsonplaceholder.typicode.com/users';
const REQUEST_2_NAME = 'Posts';
const REQUEST_2_URL = 'https://jsonplaceholder.typicode.com/posts';
const EDITED_URL_SUFFIX = '?_limit=5';
const HEADER_KEY = 'X-Demo-Version';
const HEADER_VALUE = 'v2';

let activeSpotlightCleanup: (() => void) | null = null;

async function spotlight(ctx: DemoActionContext, selector: string, holdMs: number): Promise<void> {
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) return;
  activeSpotlightCleanup?.();
  activeSpotlightCleanup = null;
  el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  const remove = showSpotlightRing(el);
  activeSpotlightCleanup = remove;
  try { await ctx.delay(holdMs); } finally { remove(); if (activeSpotlightCleanup === remove) activeSpotlightCleanup = null; }
}

async function spotlightEl(ctx: DemoActionContext, el: HTMLElement, holdMs: number): Promise<void> {
  activeSpotlightCleanup?.();
  activeSpotlightCleanup = null;
  el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  const remove = showSpotlightRing(el);
  activeSpotlightCleanup = remove;
  try { await ctx.delay(holdMs); } finally { remove(); if (activeSpotlightCleanup === remove) activeSpotlightCleanup = null; }
}

async function spotlightElNoScroll(ctx: DemoActionContext, el: HTMLElement, holdMs: number): Promise<void> {
  activeSpotlightCleanup?.();
  activeSpotlightCleanup = null;
  const remove = showSpotlightRing(el);
  activeSpotlightCleanup = remove;
  try { await ctx.delay(holdMs); } finally { remove(); if (activeSpotlightCleanup === remove) activeSpotlightCleanup = null; }
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
  const diffModal = document.querySelector<HTMLElement>('.test-def-diff-modal .btn');
  if (diffModal) { diffModal.click(); await ctx.delay(60); }
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

async function addRequestSilently(ctx: DemoActionContext, name: string, url: string): Promise<void> {
  const existing = document.querySelector(REQ.reqByName(name));
  if (existing) return;
  const col = firstVisible(REQ.colByName(COLLECTION_NAME));
  if (!col) return;
  const opened = await openContextMenuForElement(ctx, col);
  if (!opened) return;
  await clickContextItemVisible(ctx, 'Add Request');
  await ctx.waitFor(REQ.URL_INPUT, 2200);
  const nameDisplay = firstVisible('.req-req-name-display');
  if (nameDisplay) {
    nameDisplay.click();
    await ctx.delay(60);
    const nameInput = firstVisible('.req-req-name-input') as HTMLInputElement | null;
    if (nameInput) { fillControlledInput(nameInput, name); nameInput.blur(); await ctx.delay(60); }
  }
  const urlInput = document.querySelector<HTMLInputElement>(REQ.URL_INPUT);
  if (urlInput) fillControlledInput(urlInput, url);
  await ctx.delay(80);
}

async function ensureBothRequests(ctx: DemoActionContext): Promise<void> {
  await createCollectionIfNeeded(ctx);
  await ensureCollectionExpanded(ctx, COLLECTION_NAME);
  await addRequestSilently(ctx, REQUEST_1_NAME, REQUEST_1_URL);
  await addRequestSilently(ctx, REQUEST_2_NAME, REQUEST_2_URL);
}

export const reqVersioningLesson: DemoLesson = {
  id: 'req-versioning',
  domainId: 'api',
  category: 'requests',
  name: 'Definition Versioning & History',
  description:
    'Never lose a working request. Learn how auto-snapshots capture every change, ' +
    'compare versions side-by-side, and restore previous definitions with one click.',
  estimatedMinutes: 3,
  initialTab: 'requests',
  allowedTabs: ['requests'],

  concept: {
    title: 'Never Lose a Working Request',
    body:
      'RedfireForge **auto-snapshots** your request definitions whenever you navigate away.\n\n' +
      '**How it works:**\n' +
      '- Edit a request (URL, headers, body, auth)\n' +
      '- Switch to another request tab or sidebar item → snapshot fires silently\n' +
      '- Up to **15 versions** per request (oldest pruned automatically)\n\n' +
      '**What you can do with versions:**\n' +
      '- **Compare** any two versions side-by-side (URL, headers, body, auth diffs)\n' +
      '- **Restore** to any previous snapshot with one click\n' +
      '- **Rename** versions for easy identification ("before pagination", "v1-stable")\n\n' +
      'The snapshot is a frozen copy of: name, URL, method, headers, body, body type, and auth.',
    keyTerms: [
      { term: 'Auto-Snapshot', definition: 'Invisible save triggered when you navigate away from an edited request' },
      { term: 'Definition Version', definition: 'A frozen point-in-time copy of URL, method, headers, body, params' },
      { term: 'Version Diff', definition: 'Side-by-side comparison highlighting what changed between two versions' },
      { term: 'Restore', definition: 'One-click revert to any previous definition version' },
    ],
    diagram: `<svg viewBox="0 0 400 100" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="10" width="90" height="30" rx="4" fill="#1e293b" stroke="#3b82f6" stroke-width="1.5"/>
      <text x="55" y="29" text-anchor="middle" fill="#3b82f6" font-size="8">Edit Request</text>
      <path d="M100 25 L135 25" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#arr6)"/>
      <rect x="135" y="10" width="80" height="30" rx="4" fill="#1e293b" stroke="#f59e0b" stroke-width="1.5"/>
      <text x="175" y="29" text-anchor="middle" fill="#f59e0b" font-size="8">Navigate</text>
      <path d="M215 25 L250 25" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#arr6)"/>
      <rect x="250" y="10" width="70" height="30" rx="4" fill="#1e293b" stroke="#10b981" stroke-width="1.5"/>
      <text x="285" y="29" text-anchor="middle" fill="#10b981" font-size="8">Snapshot</text>
      <path d="M320 25 L355 25" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#arr6)"/>
      <rect x="330" y="10" width="60" height="30" rx="4" fill="#1e293b" stroke="#a855f7" stroke-width="1.5"/>
      <text x="360" y="29" text-anchor="middle" fill="#a855f7" font-size="8">History</text>
      <rect x="10" y="55" width="380" height="35" rx="4" fill="#1e293b" stroke="#94a3b8" stroke-width="1" stroke-dasharray="3"/>
      <text x="200" y="71" text-anchor="middle" fill="#94a3b8" font-size="7">Compare ← Diff → Restore</text>
      <text x="200" y="83" text-anchor="middle" fill="#64748b" font-size="6">max 15 versions · oldest auto-pruned</text>
      <defs><marker id="arr6" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" fill="none" stroke="#94a3b8" stroke-width="1"/></marker></defs>
    </svg>`,
  },

  setup: async (ctx) => {
    ctx.navigateToTab('requests');
    await ctx.delay(80);
    await closeExtraRequestTabs(ctx);
    await closeOpenOverlays(ctx);
    await deleteCollectionByName(ctx, COLLECTION_NAME);
    await shrinkAllCollections();
  },

  cleanup: async (ctx) => {
    await closeOpenOverlays(ctx);
    await closeExtraRequestTabs(ctx);
    await deleteCollectionByName(ctx, COLLECTION_NAME);
    ctx.navigateToTab('requests');
    await ctx.delay(60);
  },

  steps: [
    // ── Step 1: Create Two Requests ──
    {
      id: 'req6-create',
      title: 'Create Two Requests',
      description:
        'Create a **"Version Demo"** URL Collection with two requests:\n' +
        '- **"Users"** → `https://jsonplaceholder.typicode.com/users`\n' +
        '- **"Posts"** → `https://jsonplaceholder.typicode.com/posts`\n\n' +
        'We need two requests because auto-snapshot triggers when you **navigate away** from one to another.',
      highlight: REQ.SIDEBAR_ADD_BTN,
      preAction: async (ctx) => {
        ensureRequestsTab(ctx);
        await closeOpenOverlays(ctx);
        await deleteCollectionByName(ctx, COLLECTION_NAME);
      },
      action: async (ctx) => {
        // Create collection
        await spotlight(ctx, REQ.SIDEBAR_ADD_BTN, 800);
        await ctx.click(REQ.SIDEBAR_ADD_BTN);
        await ctx.waitFor(REQ.ADD_DROPDOWN, 1500);
        await ctx.click(REQ.ADD_URL_COLLECTION);
        await ctx.waitFor(REQ.COLLECTION_MODAL, 2000);
        const nameInput = document.querySelector<HTMLInputElement>('.req-col-modal .req-input');
        if (nameInput) { nameInput.focus(); fillControlledInput(nameInput, COLLECTION_NAME); await ctx.delay(200); }
        document.querySelector<HTMLButtonElement>('.req-col-modal .btn-primary')?.click();
        await ctx.delay(300);
        await spotlight(ctx, REQ.colByName(COLLECTION_NAME), 900);

        // Add "Users" request
        const col = firstVisible(REQ.colByName(COLLECTION_NAME));
        if (!col) return;
        let opened = await openContextMenuForElement(ctx, col);
        if (!opened) return;
        await clickContextItemVisible(ctx, 'Add Request');
        await ctx.waitFor(REQ.URL_INPUT, 2200);
        await ctx.delay(200);
        const nameDisplay1 = firstVisible('.req-req-name-display');
        if (nameDisplay1) {
          nameDisplay1.click();
          await ctx.delay(80);
          const ni = firstVisible('.req-req-name-input') as HTMLInputElement | null;
          if (ni) { fillControlledInput(ni, REQUEST_1_NAME); ni.blur(); await ctx.delay(80); }
        }
        const urlInput1 = document.querySelector<HTMLInputElement>(REQ.URL_INPUT);
        if (urlInput1) {
          fillControlledInput(urlInput1, REQUEST_1_URL);
          await ctx.delay(300);
          await spotlightElNoScroll(ctx, urlInput1, 800);
        }

        // Add "Posts" request
        const col2 = firstVisible(REQ.colByName(COLLECTION_NAME));
        if (!col2) return;
        opened = await openContextMenuForElement(ctx, col2);
        if (!opened) return;
        await clickContextItemVisible(ctx, 'Add Request');
        await ctx.waitFor(REQ.URL_INPUT, 2200);
        await ctx.delay(200);
        const nameDisplay2 = firstVisible('.req-req-name-display');
        if (nameDisplay2) {
          nameDisplay2.click();
          await ctx.delay(80);
          const ni2 = firstVisible('.req-req-name-input') as HTMLInputElement | null;
          if (ni2) { fillControlledInput(ni2, REQUEST_2_NAME); ni2.blur(); await ctx.delay(80); }
        }
        const urlInput2 = document.querySelector<HTMLInputElement>(REQ.URL_INPUT);
        if (urlInput2) {
          fillControlledInput(urlInput2, REQUEST_2_URL);
          await ctx.delay(300);
          await spotlightElNoScroll(ctx, urlInput2, 800);
        }

        // Spotlight both in the sidebar
        const req1 = firstVisible(REQ.reqByName(REQUEST_1_NAME));
        const req2 = firstVisible(REQ.reqByName(REQUEST_2_NAME));
        if (req1) await spotlightElNoScroll(ctx, req1, 800);
        if (req2) await spotlightElNoScroll(ctx, req2, 800);
      },
    },

    // ── Step 2: Edit & Navigate (Auto-Snapshot) ──
    {
      id: 'req6-edit',
      title: 'Edit & Navigate (Auto-Snapshot)',
      description:
        'Select **"Users"**, append `?_limit=5` to the URL, then add a custom header ' +
        '`X-Demo-Version: v2`. Now click **"Posts"** in the sidebar (or switch tabs) — ' +
        'this triggers an **auto-snapshot** of the edited "Users" request.\n\n' +
        'Click back to "Users" and open the **History** tab to see the captured version ' +
        'with a change summary.',
      highlight: REQ.URL_INPUT,
      preAction: async (ctx) => {
        ensureRequestsTab(ctx);
        await closeOpenOverlays(ctx);
        await ensureBothRequests(ctx);
        await selectRequestByName(ctx, REQUEST_1_NAME, COLLECTION_NAME);
      },
      action: async (ctx) => {
        // Select "Users"
        await selectRequestByName(ctx, REQUEST_1_NAME, COLLECTION_NAME);
        await ctx.delay(300);

        // Edit URL — append limit
        const urlInput = document.querySelector<HTMLInputElement>(REQ.URL_INPUT);
        if (urlInput) {
          await spotlightElNoScroll(ctx, urlInput, 800);
          const currentUrl = urlInput.value;
          if (!currentUrl.includes(EDITED_URL_SUFFIX)) {
            fillControlledInput(urlInput, currentUrl + EDITED_URL_SUFFIX);
          }
          await ctx.delay(400);
          await spotlightElNoScroll(ctx, urlInput, 900);
        }

        // Add header
        const headersTab = document.querySelector<HTMLElement>(REQ.TAB_HEADERS);
        if (headersTab) {
          await spotlightElNoScroll(ctx, headersTab, 700);
          headersTab.click();
          await ctx.delay(400);
        }
        const addBtn = document.querySelector<HTMLElement>('[data-testid="req-headers-add-btn"]');
        if (addBtn) {
          addBtn.click();
          await ctx.delay(250);
        }
        const rows = document.querySelectorAll('[data-testid^="req-headers-row-"]');
        const lastRow = rows[rows.length - 1];
        if (lastRow) {
          const keyInput = lastRow.querySelector<HTMLInputElement>('.ws-connect-kv-key');
          const valueInput = lastRow.querySelector<HTMLInputElement>('.ws-connect-kv-value');
          if (keyInput) { fillControlledInput(keyInput, HEADER_KEY); await ctx.delay(200); }
          if (valueInput) {
            fillControlledInput(valueInput, HEADER_VALUE);
            await ctx.delay(300);
            if (valueInput instanceof HTMLElement) await spotlightElNoScroll(ctx, valueInput, 800);
          }
        }

        // Navigate to "Posts" → triggers auto-snapshot
        const postsReq = firstVisible(REQ.reqByName(REQUEST_2_NAME));
        if (postsReq) {
          await spotlightElNoScroll(ctx, postsReq, 900);
          postsReq.click();
          await ctx.delay(600);
        }

        // Navigate back to "Users"
        await selectRequestByName(ctx, REQUEST_1_NAME, COLLECTION_NAME);
        await ctx.delay(400);

        // Open History tab
        const historyTab = document.querySelector<HTMLElement>(REQ.TAB_HISTORY);
        if (historyTab) {
          await spotlightElNoScroll(ctx, historyTab, 800);
          historyTab.click();
          await ctx.delay(500);
        }

        // Spotlight the version list
        await spotlight(ctx, REQ.VERSION_PANEL, 1200);
      },
    },

    // ── Step 3: Compare Versions ──
    {
      id: 'req6-compare',
      title: 'Compare Versions',
      description:
        'Select **two versions** using the checkboxes, then click **"Compare"**. ' +
        'The diff modal shows side-by-side changes across tabs:\n\n' +
        '- **Overview** — URL, method, name changes\n' +
        '- **Headers** — added, removed, modified headers\n' +
        '- **Body** — JSON diff with line-by-line changes\n' +
        '- **Auth** — authentication configuration changes\n\n' +
        'The URL change (`?_limit=5` added) and new header (`X-Demo-Version`) are highlighted.',
      highlight: REQ.VERSION_COMPARE_BTN,
      preAction: async (ctx) => {
        ensureRequestsTab(ctx);
        await closeOpenOverlays(ctx);
        await ensureBothRequests(ctx);
        await selectRequestByName(ctx, REQUEST_1_NAME, COLLECTION_NAME);
        const historyTab = document.querySelector<HTMLElement>(REQ.TAB_HISTORY);
        if (historyTab && !document.querySelector(REQ.VERSION_PANEL)) {
          historyTab.click();
          await ctx.delay(150);
        }
      },
      action: async (ctx) => {
        const items = document.querySelectorAll<HTMLElement>(REQ.VERSION_ITEM);
        if (items.length >= 2) {
          // Select two versions
          await spotlightElNoScroll(ctx, items[0], 800);
          items[0].click();
          await ctx.delay(300);
          await spotlightElNoScroll(ctx, items[1], 800);
          items[1].click();
          await ctx.delay(400);

          // Click Compare
          const compareBtn = document.querySelector<HTMLElement>(REQ.VERSION_COMPARE_BTN);
          if (compareBtn) {
            await spotlightElNoScroll(ctx, compareBtn, 900);
            compareBtn.click();
            await ctx.delay(800);
          }

          // Spotlight the diff modal
          const diffModal = document.querySelector<HTMLElement>('.test-def-diff-modal');
          if (diffModal) {
            await spotlightEl(ctx, diffModal, 1500);
            // Close it
            const closeBtn = diffModal.querySelector<HTMLElement>('.test-def-diff-header .btn');
            if (closeBtn) { closeBtn.click(); await ctx.delay(300); }
          }
        } else {
          // Not enough versions yet — spotlight what's there
          await spotlight(ctx, REQ.VERSION_PANEL, 1200);
        }
      },
    },

    // ── Step 4: Restore & Rename ──
    {
      id: 'req6-restore',
      title: 'Restore & Rename',
      description:
        'Click **"↩ Restore"** on the original version to revert — `?_limit=5` disappears, ' +
        'the extra header is removed. Restore creates a new version entry before reverting, ' +
        'so you can always undo.\n\n' +
        'Then click **"✏ Rename"** on any version and type a meaningful label like ' +
        '"before pagination" — easier to find than timestamps.',
      highlight: REQ.VERSION_RESTORE_BTN,
      preAction: async (ctx) => {
        ensureRequestsTab(ctx);
        await closeOpenOverlays(ctx);
        await ensureBothRequests(ctx);
        await selectRequestByName(ctx, REQUEST_1_NAME, COLLECTION_NAME);
        const historyTab = document.querySelector<HTMLElement>(REQ.TAB_HISTORY);
        if (historyTab && !document.querySelector(REQ.VERSION_PANEL)) {
          historyTab.click();
          await ctx.delay(150);
        }
      },
      action: async (ctx) => {
        // Restore the original (last item in the list)
        const items = document.querySelectorAll<HTMLElement>(REQ.VERSION_ITEM);
        if (items.length > 0) {
          const lastItem = items[items.length - 1];
          const restoreBtn = lastItem.querySelector<HTMLElement>(REQ.VERSION_RESTORE_BTN);
          if (restoreBtn) {
            await spotlightElNoScroll(ctx, restoreBtn, 900);
            restoreBtn.click();
            await ctx.delay(700);
          }
        }

        // Spotlight the reverted URL
        const urlInput = document.querySelector<HTMLInputElement>(REQ.URL_INPUT);
        if (urlInput) await spotlightElNoScroll(ctx, urlInput, 1000);

        // Rename a version
        const updatedItems = document.querySelectorAll<HTMLElement>(REQ.VERSION_ITEM);
        if (updatedItems.length > 0) {
          const firstItem = updatedItems[0];
          const renameBtn = firstItem.querySelector<HTMLElement>(REQ.VERSION_RENAME_BTN);
          if (renameBtn) {
            await spotlightElNoScroll(ctx, renameBtn, 800);
            renameBtn.click();
            await ctx.delay(300);
          }
          const renameInput = document.querySelector<HTMLInputElement>(REQ.VERSION_RENAME_INPUT);
          if (renameInput) {
            await spotlightElNoScroll(ctx, renameInput, 700);
            fillControlledInput(renameInput, 'before pagination');
            await ctx.delay(400);
            renameInput.blur();
            await ctx.delay(400);
          }
          // Spotlight the renamed entry
          const renamedItem = document.querySelectorAll<HTMLElement>(REQ.VERSION_ITEM)[0];
          if (renamedItem) await spotlightElNoScroll(ctx, renamedItem, 1000);
        }
      },
    },
  ],
};
