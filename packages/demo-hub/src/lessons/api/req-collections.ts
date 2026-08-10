/**
 * REQ-2 v2: Collections & Organization
 *
 * 4 steps: create collection + requests → folders & move → search & duplicate → gallery/export tip.
 * Everything from scratch. Rich spotlighting on every UI section.
 * Public API: JSONPlaceholder
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
  ensureCollectionExpanded,
  closeExtraRequestTabs,
  fillNewRequestPrompt,
  dismissNewRequestPrompt,
  dismissDuplicateRequestPrompt,
  cleanupOtherRequestDemoCollections,
} from './req-demo-helpers';

const COLLECTION_NAME = 'User Service';
const REQ_1_NAME = 'List Users';
const REQ_1_URL = 'https://jsonplaceholder.typicode.com/users';
const REQ_2_NAME = 'Get User';
const REQ_2_URL = 'https://jsonplaceholder.typicode.com/users/1';
const FOLDER_NAME = 'Single';
const DUP_NAME = 'List Users (page 2)';
let activeSpotlightCleanup: (() => void) | null = null;

// ─── Helpers ─────────────────────────────────────────────────────

async function spotlight(ctx: DemoActionContext, selector: string, holdMs: number): Promise<void> {
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) return;
  // Ensure a single spotlight ring at a time.
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
  // Ensure a single spotlight ring at a time.
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
  // Ensure a single spotlight ring at a time.
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

async function ensureRequestVisible(ctx: DemoActionContext, requestSelector: string): Promise<HTMLElement | null> {
  const alreadyVisible = firstVisible(requestSelector);
  if (alreadyVisible) return alreadyVisible;
  const col = firstVisible(REQ.colByName(COLLECTION_NAME));
  if (!col) return null;
  const group = col.closest('.req-col-group');
  const list = group?.querySelector('.req-req-list');
  // Expand only when collapsed, avoid repeated header toggles.
  if (!list) {
    col.click();
    await ctx.delay(220);
  }
  return firstVisible(requestSelector);
}

async function ensureFolderExpandedByName(ctx: DemoActionContext, folderName: string): Promise<HTMLElement | null> {
  const folderNameEl = firstVisible(`.req-folder-name[title="${folderName}"]`);
  if (!folderNameEl) return null;
  const folderGroup = folderNameEl.closest('.req-folder-group');
  const list = folderGroup?.querySelector('.req-folder-requests');
  if (!list) {
    const header = folderGroup?.querySelector<HTMLElement>('.req-folder-header');
    header?.click();
    await ctx.delay(240);
  }
  return firstVisible(`.req-folder-name[title="${folderName}"]`);
}

function firstVisibleInFolderByName(folderName: string, requestName: string): HTMLElement | null {
  const folderNameEls = Array.from(document.querySelectorAll<HTMLElement>(`.req-folder-name[title="${folderName}"]`));
  for (const nameEl of folderNameEls) {
    const folderGroup = nameEl.closest('.req-folder-group');
    if (!folderGroup) continue;
    const reqEl = Array.from(folderGroup.querySelectorAll<HTMLElement>(`[data-req-name="${requestName}"]`)).find(isVisible) ?? null;
    if (reqEl) return reqEl;
  }
  return null;
}

async function spotlightContextItem(
  ctx: DemoActionContext,
  text: string,
  holdMs = 900,
): Promise<HTMLButtonElement | null> {
  const menu = firstVisible(REQ.CONTEXT_MENU);
  if (!menu) return null;
  const btn = Array.from(menu.querySelectorAll<HTMLButtonElement>('button'))
    .find(b => b.textContent?.trim() === text);
  if (!btn) return null;
  await spotlightElNoScroll(ctx, btn, holdMs);
  return btn;
}

async function deleteCollectionByName(ctx: DemoActionContext, collectionName: string): Promise<void> {
  ensureRequestsTab(ctx);
  await ctx.delay(60);
  let guard = 0;
  while (document.querySelector(REQ.colByName(collectionName)) && guard < 4) {
    const col = firstVisible(REQ.colByName(collectionName));
    if (!col) break;
    const opened = await openContextMenuForElement(ctx, col);
    if (!opened) break;
    const clicked = await clickContextItemVisible(ctx, 'Delete Collection');
    if (!clicked) { dismissContextMenu(); break; }
    const confirmBtn = document.querySelector<HTMLElement>('.req-confirm-dialog .req-confirm-ok');
    if (confirmBtn) { confirmBtn.click(); await ctx.delay(100); }
    guard++;
  }
}

async function deleteCollectionIfExists(ctx: DemoActionContext): Promise<void> {
  await deleteCollectionByName(ctx, COLLECTION_NAME);
}

async function ensureCollectionWithRequests(ctx: DemoActionContext): Promise<void> {
  ensureRequestsTab(ctx);
  if (!document.querySelector(REQ.colByName(COLLECTION_NAME))) {
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
  }

  // Add first request if missing
  if (!document.querySelector(REQ.reqInCollection(COLLECTION_NAME, REQ_1_NAME))) {
    const col = firstVisible(REQ.colByName(COLLECTION_NAME));
    if (col) {
      const opened = await openContextMenuForElement(ctx, col);
      if (!opened) return;
      await clickContextItemVisible(ctx, 'Add Request');
      await fillNewRequestPrompt(ctx, REQ_1_NAME);
      await ctx.waitFor(REQ.URL_INPUT, 2000);
      const urlInput = firstVisible(REQ.URL_INPUT) as HTMLInputElement | null;
      if (urlInput) { urlInput.focus(); fillControlledInput(urlInput, REQ_1_URL); }
      await ctx.delay(100);
    }
  }

  // Add second request if missing
  if (!document.querySelector(REQ.reqInCollection(COLLECTION_NAME, REQ_2_NAME))) {
    const col = firstVisible(REQ.colByName(COLLECTION_NAME));
    if (col) {
      const opened = await openContextMenuForElement(ctx, col);
      if (!opened) return;
      await clickContextItemVisible(ctx, 'Add Request');
      await fillNewRequestPrompt(ctx, REQ_2_NAME);
      await ctx.waitFor(REQ.URL_INPUT, 2000);
      const urlInput = firstVisible(REQ.URL_INPUT) as HTMLInputElement | null;
      if (urlInput) { urlInput.focus(); fillControlledInput(urlInput, REQ_2_URL); }
      await ctx.delay(100);
    }
  }
}

// ─── Lesson ──────────────────────────────────────────────────────

export const reqCollectionsLesson: DemoLesson = {
  id: 'req-collections',
  domainId: 'api',
  category: 'requests',
  name: 'Collections & Organization',
  description:
    'Create a collection with requests, organize with folders, use search and duplicate, ' +
    'and learn all the tools for managing your API workspace.',
  estimatedMinutes: 3,
  initialTab: 'requests',
  // 'gallery' is allowed so Step 4 can navigate to the Gallery page without
  // triggering the "Leave the live demo?" exit confirmation.
  allowedTabs: ['requests', 'gallery'],

  concept: {
    title: 'Organizing Your API Library',
    body:
      'Collections group related API requests — like Postman collections but with ' +
      'built-in environment awareness.\n\n' +
      '**Three collection types:**\n' +
      '- **URL** (Direct) — each request stores its full URL\n' +
      '- **ENV** (Multi-Environment) — requests use relative paths; base URL switches per environment\n' +
      '- **GRP** (Group) — organizational container that holds other collections\n\n' +
      '**Folder-based structure:**\n' +
      '- Use folders to group related endpoints (for example, single-resource vs list endpoints)\n' +
      '- Keep large collections easy to navigate as your API surface grows\n\n' +
      '**Right-click context menu workflow:**\n' +
      '- Add Request, Add Folder, Add Sub-Collection\n' +
      '- Move requests with **Move to...** submenu\n' +
      '- Duplicate requests to create variations quickly\n' +
      '- Export/import at collection scope for sharing and reuse\n\n' +
      '**Daily productivity tools:**\n' +
      '- Sidebar search filters requests instantly as you type\n' +
      '- Expand/Shrink All controls help manage large trees\n' +
      '- Header export/import buttons support team collaboration and backup',
    keyTerms: [
      { term: 'URL Collection', definition: 'Direct mode — each request has an absolute URL' },
      { term: 'ENV Collection', definition: 'Multi-Environment mode — base URL changes per environment' },
      { term: 'Folder', definition: 'Organizes requests within a collection by endpoint group' },
      { term: 'Context Menu', definition: 'Right-click any item for Move, Duplicate, Rename, Export, Delete' },
      { term: 'Move to...', definition: 'Context-menu submenu to move a request into another folder/target' },
      { term: 'Duplicate', definition: 'Creates a fast copy of a request for parameter/method variations' },
      { term: 'Sidebar Search', definition: 'Filters collections and requests in real time while typing' },
      { term: 'Export / Import', definition: 'Share and restore request collections as JSON files' },
    ],
    diagram: `<svg viewBox="0 0 400 130" xmlns="http://www.w3.org/2000/svg">
      <rect x="140" y="5" width="120" height="30" rx="5" fill="#1e293b" stroke="#f59e0b" stroke-width="1.5"/>
      <text x="200" y="24" text-anchor="middle" fill="#f59e0b" font-size="10">GRP Collection</text>
      <path d="M165 35 L90 55" stroke="#3b4a60" stroke-width="1"/>
      <path d="M235 35 L310 55" stroke="#3b4a60" stroke-width="1"/>
      <rect x="40" y="55" width="100" height="28" rx="5" fill="#1e293b" stroke="#3b82f6" stroke-width="1.5"/>
      <text x="90" y="73" text-anchor="middle" fill="#3b82f6" font-size="10">URL Collection</text>
      <rect x="260" y="55" width="100" height="28" rx="5" fill="#1e293b" stroke="#10b981" stroke-width="1.5"/>
      <text x="310" y="73" text-anchor="middle" fill="#10b981" font-size="10">ENV Collection</text>
      <path d="M70 83 L50 100" stroke="#3b4a60" stroke-width="1"/>
      <path d="M110 83 L130 100" stroke="#3b4a60" stroke-width="1"/>
      <rect x="20" y="100" width="60" height="22" rx="4" fill="#1e293b" stroke="#3b4a60" stroke-width="1"/>
      <text x="50" y="115" text-anchor="middle" fill="#94a3b8" font-size="9">Folder A</text>
      <rect x="100" y="100" width="60" height="22" rx="4" fill="#1e293b" stroke="#3b4a60" stroke-width="1"/>
      <text x="130" y="115" text-anchor="middle" fill="#94a3b8" font-size="9">Folder B</text>
      <rect x="260" y="100" width="100" height="22" rx="4" fill="#1e293b" stroke="#3b4a60" stroke-width="1"/>
      <text x="310" y="115" text-anchor="middle" fill="#94a3b8" font-size="9">dev / staging / prod</text>
    </svg>`,
  },

  setup: async (ctx) => {
    ctx.navigateToTab('requests');
    await ctx.delay(80);
    dismissNewRequestPrompt();
    await closeExtraRequestTabs(ctx);
    await cleanupOtherRequestDemoCollections(ctx, [COLLECTION_NAME]);
    await deleteCollectionIfExists(ctx);
    await shrinkAllCollections();
    const sidebar = document.querySelector<HTMLElement>(REQ.SIDEBAR);
    if (sidebar) sidebar.scrollTop = 0;
  },

  cleanup: async (ctx) => {
    dismissContextMenu();
    dismissNewRequestPrompt();
    dismissDuplicateRequestPrompt();
    const modalClose = document.querySelector<HTMLElement>('.req-col-modal .btn-secondary');
    if (modalClose) { modalClose.click(); await ctx.delay(60); }
    const search = document.querySelector<HTMLInputElement>(REQ.SIDEBAR_SEARCH);
    if (search && search.value) fillControlledInput(search, '');
    await closeExtraRequestTabs(ctx);
    await deleteCollectionIfExists(ctx);
    await cleanupOtherRequestDemoCollections(ctx, [COLLECTION_NAME]);
    ctx.navigateToTab('requests');
    await ctx.delay(60);
  },

  steps: [
    // ── Step 1: Create Collection with Requests ──
    {
      id: 'req2-create',
      title: 'Create Collection with Requests',
      description:
        'Create a **"User Service"** collection, then add two requests from scratch:\n' +
        '- **"List Users"** — `GET /users` (returns all 10 users)\n' +
        '- **"Get User"** — `GET /users/1` (returns a single user by ID)\n\n' +
        'Each request opens in its own **tab** — you can switch between them without losing context.\n\n' +
        'The **context menu** (right-click any collection) gives you: Add Request, ' +
        'Add Folder, Add Sub-Collection, Edit Collection, Duplicate, Export, and Delete.',
      highlight: REQ.colByName(COLLECTION_NAME),
      preAction: async (ctx) => {
        ensureRequestsTab(ctx);
        if (document.querySelector(REQ.colByName(COLLECTION_NAME))) return;
        await shrinkAllCollections();
      },
      action: async (ctx) => {
        if (document.querySelector(REQ.reqInCollection(COLLECTION_NAME, REQ_2_NAME))) {
          await spotlight(ctx, REQ.colByName(COLLECTION_NAME), 1000);
          return;
        }

        // 1. Click + and spotlight dropdown (skip + spotlight to avoid flashing)
        await ctx.click(REQ.SIDEBAR_ADD_BTN);
        await ctx.waitFor(REQ.ADD_DROPDOWN, 1500);
        await ctx.delay(400);

        // 2. Click URL Collection → modal
        await spotlight(ctx, REQ.ADD_URL_COLLECTION, 1100);
        await ctx.click(REQ.ADD_URL_COLLECTION);
        await ctx.waitFor(REQ.COLLECTION_MODAL, 2000);
        await ctx.delay(300);

        // 3. Fill collection name first (then explain other sections)
        const nameInput = document.querySelector<HTMLInputElement>('.req-col-modal .req-input');
        if (nameInput) {
          await spotlightElNoScroll(ctx, nameInput, 1000);
          nameInput.focus();
          fillControlledInput(nameInput, COLLECTION_NAME);
        }
        await ctx.delay(350);

        // 4. Highlight URL mode section
        const modeSwitcher = firstVisible('.req-col-modal .req-mode-switcher');
        if (modeSwitcher) await spotlightEl(ctx, modeSwitcher, 1300);

        // 5. Highlight Default Auth section
        const formGroups = document.querySelectorAll<HTMLElement>('.req-col-modal .req-form-group');
        const authGroup = Array.from(formGroups).find(
          g => g.querySelector('label')?.textContent?.includes('Default Auth')
        );
        if (authGroup) await spotlightEl(ctx, authGroup, 1200);

        // 6. Save
        const saveBtn = document.querySelector<HTMLButtonElement>('.req-col-modal .btn-primary');
        if (saveBtn) saveBtn.click();
        await ctx.delay(400);

        // 4. Spotlight new collection
        await spotlight(ctx, REQ.colByName(COLLECTION_NAME), 800);

        // 5. Right-click → spotlight context menu → Add Request
        const col = firstVisible(REQ.colByName(COLLECTION_NAME));
        if (!col) return;
        const opened1 = await openContextMenuForElement(ctx, col);
        if (!opened1) return;
        await spotlightContextItem(ctx, 'Add Request', 1100);
        await clickContextItemVisible(ctx, 'Add Request');
        await ctx.delay(300);
        const prompt1 = document.querySelector<HTMLElement>(REQ.NEW_REQ_PROMPT);
        if (prompt1) await spotlightElNoScroll(ctx, prompt1, 900);
        await fillNewRequestPrompt(ctx, REQ_1_NAME);
        await ctx.waitFor(REQ.URL_INPUT, 2000);
        await ctx.delay(320);

        // 6. Fill URL for "List Users"
        const urlInput1 = firstVisible(REQ.URL_INPUT) as HTMLInputElement | null;
        if (urlInput1) {
          await spotlightEl(ctx, urlInput1, 900);
          urlInput1.focus();
          fillControlledInput(urlInput1, REQ_1_URL);
        }
        await ctx.delay(300);
        // Immediately show the created request in the sidebar (expand if collapsed).
        const createdReq1 = await ensureRequestVisible(ctx, REQ.reqInCollection(COLLECTION_NAME, REQ_1_NAME));
        if (createdReq1) await spotlightElNoScroll(ctx, createdReq1, 1200);

        // 7. Add second request
        const opened2 = await openContextMenuForElement(ctx, col);
        if (!opened2) return;
        await spotlightContextItem(ctx, 'Add Request', 1100);
        await clickContextItemVisible(ctx, 'Add Request');
        await ctx.delay(300);
        const prompt2 = document.querySelector<HTMLElement>(REQ.NEW_REQ_PROMPT);
        if (prompt2) await spotlightElNoScroll(ctx, prompt2, 900);
        await fillNewRequestPrompt(ctx, REQ_2_NAME);
        await ctx.waitFor(REQ.URL_INPUT, 2000);
        await ctx.delay(320);

        const urlInput2 = firstVisible(REQ.URL_INPUT) as HTMLInputElement | null;
        if (urlInput2) {
          await spotlightEl(ctx, urlInput2, 900);
          urlInput2.focus();
          fillControlledInput(urlInput2, REQ_2_URL);
        }
        await ctx.delay(300);
        // Ensure the second created request is visible in the sidebar (expand if collapsed).
        await ensureRequestVisible(ctx, REQ.reqInCollection(COLLECTION_NAME, REQ_2_NAME));
      },
    },

    // ── Step 2: Create Folder & Move ──
    {
      id: 'req2-folders',
      title: 'Create Folder & Move',
      description:
        'Right-click the collection to create a folder called **"Single"** — it will hold ' +
        'requests that operate on individual resources.\n\n' +
        'Then right-click **"Get User"** and use **"Move to…"** to move it into the folder. ' +
        'The submenu shows all available folders and collections you can move to.',
      highlight: REQ.colByName(COLLECTION_NAME),
      preAction: async (ctx) => {
        ensureRequestsTab(ctx);
        if (!document.querySelector(REQ.colByName(COLLECTION_NAME))) {
          await ensureCollectionWithRequests(ctx);
        }
        await ensureCollectionExpanded(ctx, COLLECTION_NAME);
        dismissContextMenu();
      },
      action: async (ctx) => {
        // 1. Right-click collection → spotlight context menu
        const col = firstVisible(REQ.colByName(COLLECTION_NAME));
        if (!col) return;
        const opened1 = await openContextMenuForElement(ctx, col);
        if (!opened1) return;
        await ctx.delay(400);

        // 2. Click "Add Folder"
        await spotlightContextItem(ctx, 'Add Folder', 1100);
        await clickContextItemVisible(ctx, 'Add Folder');
        await ctx.waitFor(REQ.FOLDER_NAME_INPUT, 2000);

        // 3. Spotlight inline folder name input and fill
        await spotlight(ctx, REQ.FOLDER_NAME_INPUT, 1200);
        const folderInput = document.querySelector<HTMLInputElement>(REQ.FOLDER_NAME_INPUT);
        if (folderInput) {
          folderInput.focus();
          fillControlledInput(folderInput, FOLDER_NAME);
          await ctx.delay(300);
          folderInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        }
        await ctx.delay(400);

        // 4. Spotlight created folder
        const folder = firstVisible('.req-folder-group .req-folder-name');
        if (folder) await spotlightEl(ctx, folder, 1200);

        // 5. Right-click "Get User" → spotlight context menu
        const reqEl = firstVisible(REQ.reqInCollection(COLLECTION_NAME, REQ_2_NAME));
        if (!reqEl) return;
        const opened2 = await openContextMenuForElement(ctx, reqEl);
        if (!opened2) return;
        await ctx.delay(400);

        // 6. Click "Move to…" → navigable submenu
        const menu = document.querySelector(REQ.CONTEXT_MENU);
        if (!menu) return;
        const moveBtn = Array.from(menu.querySelectorAll('button'))
          .find(b => b.textContent?.trim().startsWith('Move to'));
        if (moveBtn) {
          await spotlightEl(ctx, moveBtn as HTMLElement, 1000);
          (moveBtn as HTMLElement).click();
          await ctx.delay(400);

          // 6a. Submenu shows collection list — click our collection to drill down
          const submenu = document.querySelector<HTMLElement>('.req-ctx-submenu');
          if (submenu) {
            await spotlightEl(ctx, submenu, 1200);
            const colBtn = Array.from(submenu.querySelectorAll('button'))
              .find(b => b.textContent?.includes(COLLECTION_NAME));
            if (colBtn) {
              await spotlightEl(ctx, colBtn as HTMLElement, 900);
              (colBtn as HTMLElement).click();
              await ctx.delay(400);
            }

            // 6b. Now inside collection — click the folder to drill into it
            const folderBtn = Array.from(submenu.querySelectorAll('button'))
              .find(b => b.textContent?.includes(FOLDER_NAME));
            if (folderBtn) {
              await spotlightEl(ctx, folderBtn as HTMLElement, 900);
              (folderBtn as HTMLElement).click();
              await ctx.delay(400);
            }

            // 6c. Now inside folder — click "Move here"
            const moveHereBtn = Array.from(submenu.querySelectorAll('button'))
              .find(b => b.textContent?.includes('Move here'));
            if (moveHereBtn) {
              await spotlightEl(ctx, moveHereBtn as HTMLElement, 1000);
              (moveHereBtn as HTMLElement).click();
              await ctx.delay(400);
            }
          }
        }

        // 7. Spotlight the moved request inside folder
        await ctx.delay(200);
        await ensureCollectionExpanded(ctx, COLLECTION_NAME);
        const folderShown = await ensureFolderExpandedByName(ctx, FOLDER_NAME);
        if (folderShown) await spotlightElNoScroll(ctx, folderShown, 900);
        const movedReq = firstVisibleInFolderByName(FOLDER_NAME, REQ_2_NAME);
        if (movedReq) await spotlightEl(ctx, movedReq, 1400);
      },
    },

    // ── Step 3: Search & Duplicate ──
    {
      id: 'req2-search',
      title: 'Search & Duplicate',
      description:
        'The **search bar** instantly filters all collections and requests as you type — ' +
        'perfect for large API libraries with dozens of endpoints.\n\n' +
        'Then right-click a request and choose **"Duplicate"** — a prompt lets you name ' +
        'the copy (e.g. **"List Users (page 2)"**). This is the fastest way to create ' +
        'request variations with different query params, pagination offsets, etc.',
      highlight: REQ.SIDEBAR_SEARCH,
      preAction: async (ctx) => {
        ensureRequestsTab(ctx);
        dismissDuplicateRequestPrompt();
        if (!document.querySelector(REQ.colByName(COLLECTION_NAME))) {
          await ensureCollectionWithRequests(ctx);
        }
        await ensureCollectionExpanded(ctx, COLLECTION_NAME);
        dismissContextMenu();
        const search = document.querySelector<HTMLInputElement>(REQ.SIDEBAR_SEARCH);
        if (search && search.value) fillControlledInput(search, '');
      },
      action: async (ctx) => {
        // 1. Spotlight search input
        await spotlight(ctx, REQ.SIDEBAR_SEARCH, 1200);

        // 2. Focus and type "List"
        const searchInput = document.querySelector<HTMLInputElement>(REQ.SIDEBAR_SEARCH);
        if (searchInput) {
          searchInput.focus();
          await ctx.delay(150);
          fillControlledInput(searchInput, 'List');
        }
        await ctx.delay(900);

        // 3. Spotlight filtered results
        const sidebar = document.querySelector<HTMLElement>(REQ.SIDEBAR);
        if (sidebar) await spotlightEl(ctx, sidebar, 1400);

        // 4. Clear search
        if (searchInput) fillControlledInput(searchInput, '');
        await ctx.delay(300);

        // 5. Right-click "List Users" → spotlight context menu
        const reqEl = firstVisible(REQ.reqInCollection(COLLECTION_NAME, REQ_1_NAME));
        if (!reqEl) return;
        const opened = await openContextMenuForElement(ctx, reqEl);
        if (!opened) return;

        // 6. Spotlight the Duplicate menu item
        await ctx.delay(400);
        await spotlightContextItem(ctx, 'Duplicate', 1000);

        // 7. Click Duplicate → naming prompt appears
        await clickContextItemVisible(ctx, 'Duplicate');
        await ctx.delay(400);

        // 8. Spotlight the duplicate naming prompt, type a custom name, and confirm
        const dupPrompt = document.querySelector<HTMLElement>(REQ.DUP_REQ_PROMPT);
        if (dupPrompt) {
          await spotlightElNoScroll(ctx, dupPrompt, 1000);
          const nameInput = dupPrompt.querySelector<HTMLInputElement>('[data-testid="req-dup-request-name"]');
          if (nameInput) {
            nameInput.focus();
            fillControlledInput(nameInput, DUP_NAME);
            await ctx.delay(600);
          }
          const confirmBtn = dupPrompt.querySelector<HTMLButtonElement>('.btn-primary');
          if (confirmBtn) confirmBtn.click();
          await ctx.delay(400);
        }
      },
    },

    // ── Step 4: Gallery & Sharing Tools ──
    {
      id: 'req2-tools',
      title: 'Gallery & Sharing Tools',
      description:
        'Beyond manual creation, the sidebar header has powerful tools:\n' +
        '- **Export** (↑) — exports all collections as a single JSON file for team sharing\n' +
        '- **Import** (↓) — imports JSON collections with deduplication\n' +
        '- **Expand/Shrink All** — bulk collapse or expand the entire tree\n\n' +
        'And the **Gallery** page (in the left activity bar) has **50+ pre-built samples** ' +
        'against live APIs (JSONPlaceholder, DummyJSON, PokéAPI, etc.) — one-click import ' +
        'into your workspace.',
      highlight: REQ.SIDEBAR_EXPORT_BTN,
      preAction: async (ctx) => {
        ensureRequestsTab(ctx);
        dismissContextMenu();
      },
      action: async (ctx) => {
        // 1. Spotlight Export button
        await spotlight(ctx, REQ.SIDEBAR_EXPORT_BTN, 1000);

        // 2. Spotlight Import button
        await spotlight(ctx, REQ.SIDEBAR_IMPORT_BTN, 1000);

        // 3. Spotlight Expand/Shrink All toggle
        await spotlight(ctx, REQ.SIDEBAR_EXPAND_ALL, 800);

        // 4. Click Gallery in the activity bar to show pre-built samples
        const galleryBtn = document.querySelector<HTMLElement>('.ab-btn[title="Gallery"]');
        if (galleryBtn) {
          await spotlightEl(ctx, galleryBtn, 900);
          galleryBtn.click();
          await ctx.delay(600);
        }

        // 5. Spotlight the Gallery page
        const galleryPage = document.querySelector<HTMLElement>('.gallery-page');
        if (galleryPage) await spotlightEl(ctx, galleryPage, 1800);

        // 6. Navigate back to Requests
        await ctx.delay(400);
        ctx.navigateToTab('requests');
        await ctx.delay(300);
      },
    },
  ],
};
