/**
 * REQ-7: Multi-Tab Requests
 *
 * 6 steps: create collection & first named request → add second request →
 * tab switching & response cache → rename (bidirectional sync) →
 * close tab & close-other-tabs → bulk select & delete.
 *
 * Setup only clears stale artifacts and shrinks existing collections.
 * The lesson itself visibly creates the demo collection so the viewer
 * sees the naming prompt and auto-tab-open in action.
 */
import type { DemoActionContext, DemoLesson } from '../../types';
import { REQ } from '@shared/selectors';
import { showSpotlightRing } from '../../demoRipple';
import { fillControlledInput } from '../setup-helpers';
import {
  ensureRequestsTab,
  createCollectionViaModal,
  triggerContextMenu,
  clickContextMenuItem,
  dismissContextMenu,
  ensureCollectionExpanded,
  selectRequestByName,
  shrinkAllCollections,
  captureLessonCleanupBaseline,
  cleanupLessonArtifacts,
  forceDeleteCollectionsByExactName,
  cleanupOtherRequestDemoCollections,
  getRequestTabCount,
  closeAllRequestTabs,
  closeExtraRequestTabs,
  closeOtherRequestTabsQuiet,
  findRequestTabIndexByLabel,
  renameRequestTabByLabel,
} from './req-demo-helpers';

const LESSON_ID = 'req-multi-tab';
const COLLECTION_NAME = 'Multi-Tab Demo';
const REQ_GET_NAME = 'Get Users';
const REQ_POST_NAME = 'Create Post';
const GET_URL = 'https://jsonplaceholder.typicode.com/users';
const POST_URL = 'https://jsonplaceholder.typicode.com/posts';
const RENAMED_LABEL = 'Users API';

// ─── Setup / Cleanup ────────────────────────────────────────────────

async function multiTabSetup(ctx: DemoActionContext): Promise<void> {
  ensureRequestsTab(ctx);
  await ctx.delay(400);

  await forceDeleteCollectionsByExactName(ctx, COLLECTION_NAME);

  captureLessonCleanupBaseline(LESSON_ID, {
    collectionExactNames: [COLLECTION_NAME],
    requestExactNames: [REQ_GET_NAME, REQ_POST_NAME],
  });

  // Delete demo collections left behind by prior lessons (e.g. DummyJSON &
  // Product Service from the Multi-Environment lesson) so this lesson starts clean.
  await cleanupOtherRequestDemoCollections(ctx, [COLLECTION_NAME]);
  await shrinkAllCollections();
  await ctx.delay(200);
  // Close every leftover tab (incl. orphans from deleted demo collections like
  // DummyJSON / Search Laptops) — closeExtra leaves one tab and can keep an
  // orphan active, which shows "No Request Selected" in the editor.
  await closeAllRequestTabs(ctx);
  await ctx.delay(200);
}

async function multiTabCleanup(ctx: DemoActionContext): Promise<void> {
  await closeExtraRequestTabs(ctx);
  await ctx.delay(200);
  // Clear any lingering bulk selection
  const clearBtn = document.querySelector<HTMLElement>(REQ.CLEAR_SELECTION);
  if (clearBtn) { clearBtn.click(); await ctx.delay(100); }
  ensureRequestsTab(ctx);
  await ctx.delay(200);
  await cleanupLessonArtifacts(ctx, LESSON_ID, {
    collectionExactNames: [COLLECTION_NAME],
    requestExactNames: [REQ_GET_NAME, REQ_POST_NAME],
  });
  await cleanupOtherRequestDemoCollections(ctx, [COLLECTION_NAME]);
}

// ─── Helpers ────────────────────────────────────────────────────────

async function ensureRequestOpen(
  ctx: DemoActionContext,
  reqName: string,
): Promise<void> {
  await ensureCollectionExpanded(ctx, COLLECTION_NAME);
  // Scope to the demo collection — a same-named request in another collection
  // (e.g. leftover "Users API") must never be selected instead.
  const reqEl = document.querySelector<HTMLElement>(
    REQ.reqInCollection(COLLECTION_NAME, reqName),
  );
  if (!reqEl) return;
  reqEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  reqEl.click();
  await ctx.delay(300);
}

async function addRequestWithPrompt(
  ctx: DemoActionContext,
  _colName: string,
  reqName: string,
  url: string,
  method?: string,
): Promise<boolean> {
  // Wait for the naming prompt to appear. If it never does (e.g. the context
  // menu / "Add Request" click failed), bail out WITHOUT touching the active
  // request — otherwise we'd corrupt the currently-open request's method/URL.
  await ctx.waitFor(REQ.NEW_REQ_NAME, 2500);
  const promptInput = document.querySelector<HTMLInputElement>(REQ.NEW_REQ_NAME);
  if (!promptInput) return false;

  fillControlledInput(promptInput, reqName);
  await ctx.delay(100);
  const createBtn = document.querySelector<HTMLButtonElement>(`${REQ.NEW_REQ_PROMPT} .btn-primary`);
  if (!createBtn) return false;
  createBtn.click();
  await ctx.delay(400);

  if (method) {
    const trigger = document.querySelector<HTMLButtonElement>('.req-method-trigger');
    if (trigger) {
      const currentLabel = trigger.querySelector('.req-method-label');
      if (currentLabel && currentLabel.textContent?.trim() !== method) {
        trigger.click();
        await ctx.delay(200);
        const options = document.querySelectorAll<HTMLButtonElement>('.req-method-option');
        for (const opt of options) {
          const label = opt.querySelector('.req-method-option-label');
          if (label && label.textContent?.trim() === method) {
            opt.click();
            await ctx.delay(200);
            break;
          }
        }
      }
    }
  }

  const urlInput = document.querySelector<HTMLInputElement>(REQ.URL_INPUT);
  if (urlInput) {
    fillControlledInput(urlInput, url);
    await ctx.delay(200);
  }
  return true;
}

/**
 * Open the collection's context menu and click "Add Request", retrying if a
 * stale/other menu opens first. Returns true once the naming prompt is visible.
 */
async function openAddRequestPrompt(ctx: DemoActionContext): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    dismissContextMenu();
    await ctx.delay(150);
    const col = document.querySelector<HTMLElement>(REQ.colByName(COLLECTION_NAME));
    if (!col) return false;
    triggerContextMenu(col);
    await ctx.delay(300);
    const clicked = await clickContextMenuItem(ctx, 'Add Request');
    if (clicked) {
      await ctx.waitFor(REQ.NEW_REQ_PROMPT, 2000);
      if (document.querySelector(REQ.NEW_REQ_PROMPT)) return true;
    }
    await ctx.delay(200);
  }
  return false;
}

// ─── Lesson ─────────────────────────────────────────────────────────

export const reqMultiTabLesson: DemoLesson = {
  id: LESSON_ID,
  domainId: 'api',
  category: 'requests',
  name: 'Multi-Tab Requests',
  description:
    'Create named requests, open them as independent tabs, send & cache responses, rename with sync, close tabs, and bulk-delete.',
  estimatedMinutes: 4,
  initialTab: 'requests',
  allowedTabs: ['requests'],

  setup: multiTabSetup,
  cleanup: multiTabCleanup,

  concept: {
    title: 'Multi-Tab Requests — Work on Multiple APIs at Once',
    body: `Every request you open gets its own **tab** in the editor. No more losing your response when switching to a different endpoint.

**What you'll learn:**
- **Named requests** — a prompt asks for a name when you create a request (with duplicate validation)
- **Method badges** — each tab shows a color-coded badge (green GET, blue POST, amber PUT, red DELETE)
- **Per-tab response cache** — send, switch tabs, come back — your response is still there
- **Bidirectional rename** — rename a tab and the request name updates; rename a request and the tab updates
- **Close other tabs** — one click to close everything except the active tab
- **Bulk select & delete** — hover to reveal checkboxes, select multiple, and delete with a confirmation modal

**Why it matters:**
API development rarely involves a single endpoint. You might test a GET to list resources, then POST to create one, then GET again to verify. With tabs, all three stay open and ready — no re-sending, no losing context.

**Capacity:** Up to **50 tabs** open simultaneously. Close any tab except the last one.`,
    keyTerms: [
      { term: 'Request Tab', definition: 'An independent editor workspace for one request — its own URL, method, body, auth, headers, response, and history.' },
      { term: 'Named Request', definition: 'When you add a request, a prompt asks for its name. Duplicate names within the same collection level are rejected.' },
      { term: 'Method Badge', definition: 'Color-coded label on each tab: green (GET), blue (POST), amber (PUT), red (DELETE), purple (PATCH).' },
      { term: 'Bidirectional Sync', definition: 'Renaming a tab renames the request, and vice versa — they always stay in sync.' },
      { term: 'Close Other Tabs', definition: 'Icon button at the right end of the tab bar that closes every tab except the currently active one.' },
      { term: 'Bulk Select', definition: 'Hover over a request to reveal a checkbox. Check multiple, then delete them all via the floating action bar.' },
    ],
    diagram: `<svg viewBox="0 0 500 220" xmlns="http://www.w3.org/2000/svg" style="font-family:system-ui,sans-serif">
  <rect x="0" y="0" width="500" height="220" rx="8" fill="#1e1e2e" />

  <!-- Tab bar -->
  <rect x="10" y="10" width="480" height="34" rx="5" fill="#0f172a" stroke="#3b4a60" stroke-width="1" />

  <!-- Tab 1 (active): GET Users -->
  <rect x="14" y="14" width="150" height="26" rx="4" fill="#1e293b" stroke="#3b82f6" stroke-width="1.5" />
  <text x="22" y="31" fill="#22c55e" font-size="10" font-weight="bold">GET</text>
  <text x="48" y="31" fill="#f1f5f9" font-size="11">Get Users</text>
  <text x="150" y="31" fill="#a8b8cc" font-size="10">×</text>

  <!-- Tab 2: POST Create Post -->
  <rect x="170" y="14" width="150" height="26" rx="4" fill="#0f172a" stroke="#3b4a60" stroke-width="1" />
  <text x="178" y="31" fill="#3b82f6" font-size="10" font-weight="bold">POST</text>
  <text x="210" y="31" fill="#a8b8cc" font-size="11">Create Post</text>
  <text x="306" y="31" fill="#a8b8cc" font-size="10">×</text>

  <!-- Add button -->
  <rect x="326" y="15" width="24" height="24" rx="4" fill="#1e293b" />
  <text x="333" y="32" fill="#a8b8cc" font-size="14">+</text>
  <text x="356" y="32" fill="#a8b8cc" font-size="9">2/50</text>

  <!-- Tab 1 content area (active) -->
  <rect x="10" y="52" width="230" height="158" rx="4" fill="#0f172a" stroke="#3b82f6" stroke-width="1" />
  <text x="18" y="68" fill="#3b82f6" font-size="10" font-weight="bold">TAB 1 — Get Users</text>
  <text x="18" y="84" fill="#22c55e" font-size="9">GET</text>
  <text x="40" y="84" fill="#a8b8cc" font-size="9">jsonplaceholder.typicode.com/users</text>

  <!-- Response -->
  <rect x="18" y="94" width="214" height="108" rx="3" fill="#1e293b" stroke="#3b4a60" stroke-width="1" />
  <text x="26" y="110" fill="#22c55e" font-size="10" font-weight="bold">200 OK</text>
  <text x="80" y="110" fill="#a8b8cc" font-size="9">245ms · 8.2 KB</text>
  <line x1="26" y1="116" x2="224" y2="116" stroke="#3b4a60" stroke-width="0.5" />
  <text x="26" y="130" fill="#a8b8cc" font-size="9">[</text>
  <text x="34" y="142" fill="#a8b8cc" font-size="9">  { "id": 1, "name": "Leanne" },</text>
  <text x="34" y="154" fill="#a8b8cc" font-size="9">  { "id": 2, "name": "Ervin" },</text>
  <text x="34" y="166" fill="#a8b8cc" font-size="9">  ...</text>
  <text x="26" y="178" fill="#a8b8cc" font-size="9">]</text>
  <text x="26" y="196" fill="#22c55e" font-size="8">✓ Cached — survives tab switch</text>

  <!-- Tab 2 content area (inactive, dimmed) -->
  <rect x="260" y="52" width="230" height="158" rx="4" fill="#0f172a" stroke="#3b4a60" stroke-width="1" opacity="0.5" />
  <text x="268" y="68" fill="#3b82f6" font-size="10" font-weight="bold" opacity="0.5">TAB 2 — Create Post</text>
  <text x="268" y="84" fill="#3b82f6" font-size="9" opacity="0.5">POST</text>
  <text x="294" y="84" fill="#a8b8cc" font-size="9" opacity="0.5">jsonplaceholder.typicode.com/posts</text>
  <rect x="268" y="94" width="214" height="108" rx="3" fill="#1e293b" stroke="#3b4a60" stroke-width="1" opacity="0.5" />
  <text x="276" y="130" fill="#a8b8cc" font-size="10" opacity="0.5">201 Created</text>
  <text x="276" y="148" fill="#a8b8cc" font-size="9" opacity="0.5">Own response cache</text>
  <text x="276" y="164" fill="#a8b8cc" font-size="9" opacity="0.5">Independent from Tab 1</text>
  <text x="276" y="196" fill="#22c55e" font-size="8" opacity="0.5">✓ Cached — survives tab switch</text>
</svg>`,
  },

  steps: [
    // ── 1. Create Collection & First Named Request ─────────────────
    {
      id: 'req7-create-first',
      title: 'Create a Collection & Your First Named Request',
      description:
        'We start by creating a **Multi-Tab Demo** collection, then adding a request named **Get Users** inside it.\n\n' +
        'Watch the **New Request prompt** — it asks for a name before creating. ' +
        'The name is validated: empty and duplicate names are rejected. ' +
        'Once created, the request appears in the sidebar **and** a tab opens automatically.',
      preAction: async (ctx) => {
        ensureRequestsTab(ctx);
        await ctx.delay(200);
        // If the collection already exists from a prior run, skip creation
        if (document.querySelector(REQ.colByName(COLLECTION_NAME))) {
          await ensureCollectionExpanded(ctx, COLLECTION_NAME);
        }
      },
      action: async (ctx) => {
        // Only create if it doesn't already exist
        if (!document.querySelector(REQ.colByName(COLLECTION_NAME))) {
          await createCollectionViaModal(ctx, COLLECTION_NAME);
          await ctx.delay(600);
        }
        await ensureCollectionExpanded(ctx, COLLECTION_NAME);
        await ctx.delay(400);

        // Spotlight the new collection
        const colEl = document.querySelector<HTMLElement>(REQ.colByName(COLLECTION_NAME));
        if (colEl) {
          const remove = showSpotlightRing(colEl);
          await ctx.delay(1200);
          remove();
        }

        // Only add the request if it doesn't already exist
        if (!document.querySelector(REQ.reqByName(REQ_GET_NAME))) {
          const opened = await openAddRequestPrompt(ctx);
          if (opened) {
            // Spotlight the naming prompt
            const prompt = document.querySelector<HTMLElement>(REQ.NEW_REQ_PROMPT);
            if (prompt) {
              const removeP = showSpotlightRing(prompt);
              await ctx.delay(1200);
              removeP();
            }

            await addRequestWithPrompt(ctx, COLLECTION_NAME, REQ_GET_NAME, GET_URL, 'GET');
            await ctx.delay(600);
          }
        }

        // Ensure the new request is visible/selected, then drop any leftover
        // product tabs (Close All cannot remove the last pre-demo tab).
        await ensureRequestOpen(ctx, REQ_GET_NAME);
        await closeOtherRequestTabsQuiet(ctx);
        await ctx.delay(600);
      },
      verify: REQ.TAB_ITEM,
      pauseAfter: true,
    },

    // ── 2. Add a Second Request — Two Tabs Open ────────────────────
    {
      id: 'req7-create-second',
      title: 'Add a Second Request — Two Tabs Side by Side',
      description:
        'Add a **Create Post** request using the same naming prompt. ' +
        'Once created, a **second tab** appears automatically with a blue **POST** badge.\n\n' +
        'Both tabs stay open — method badges make them easy to tell apart: ' +
        '**green** for GET, **blue** for POST, **amber** for PUT, **red** for DELETE.',
      preAction: async (ctx) => {
        ensureRequestsTab(ctx);
        await ensureCollectionExpanded(ctx, COLLECTION_NAME);
        // Make sure the first request exists
        if (!document.querySelector(REQ.reqByName(REQ_GET_NAME))) {
          await ensureRequestOpen(ctx, REQ_GET_NAME);
        }
        await selectRequestByName(ctx, REQ_GET_NAME, COLLECTION_NAME);
        await closeOtherRequestTabsQuiet(ctx);
      },
      action: async (ctx) => {
        if (!document.querySelector(REQ.reqByName(REQ_POST_NAME))) {
          // Reliably open the "Add Request" naming prompt (retries if a stale
          // or wrong context menu opens first).
          const opened = await openAddRequestPrompt(ctx);
          if (!opened) return;

          await addRequestWithPrompt(ctx, COLLECTION_NAME, REQ_POST_NAME, POST_URL, 'POST');
          await ctx.delay(600);
        } else {
          await selectRequestByName(ctx, REQ_POST_NAME, COLLECTION_NAME);
          await ctx.delay(400);
        }
      },
      pauseAfter: true,
    },

    // ── 3. Switch Tabs & Per-Tab Response Cache ────────────────────
    {
      id: 'req7-switch-cache',
      title: 'Switch Tabs & Per-Tab Response Cache',
      description:
        'Click any tab to switch. The editor **instantly** swaps to that request\'s URL, method, and state.\n\n' +
        'Now we\'ll **send** the GET request, switch to the other tab, then switch back — ' +
        'the response is **still there**. Each tab keeps its own response cache. ' +
        'No more losing context when switching between endpoints.',
      highlight: REQ.TAB_BAR,
      preAction: async (ctx) => {
        ensureRequestsTab(ctx);
        if (getRequestTabCount() < 2) {
          await ensureRequestOpen(ctx, REQ_GET_NAME);
          await ensureRequestOpen(ctx, REQ_POST_NAME);
        }
        // Prefer the lesson GET by name — never assume tab index 0 (orphan
        // leftovers like Search Laptops can sit at index 0 and empty the editor).
        await selectRequestByName(ctx, REQ_GET_NAME, COLLECTION_NAME);
        const urlInput = document.querySelector<HTMLInputElement>(REQ.URL_INPUT);
        if (urlInput && !urlInput.value) {
          fillControlledInput(urlInput, GET_URL);
          await ctx.delay(100);
        }
      },
      action: async (ctx) => {
        // Send the request
        await ctx.click(REQ.SEND_BTN);
        await ctx.waitFor(REQ.STATUS_PILL, 8000);
        await ctx.delay(1200);

        // Switch to POST tab — no response there
        await selectRequestByName(ctx, REQ_POST_NAME, COLLECTION_NAME);
        await ctx.delay(800);

        // Switch back — response preserved (the key teaching moment)
        await selectRequestByName(ctx, REQ_GET_NAME, COLLECTION_NAME);
        const statusEl = document.querySelector<HTMLElement>(REQ.STATUS_PILL);
        if (statusEl) {
          const remove = showSpotlightRing(statusEl);
          await ctx.delay(1500);
          remove();
        }
      },
      verify: REQ.STATUS_PILL,
      pauseAfter: 2000,
    },

    // ── 4. Rename — Bidirectional Sync ─────────────────────────────
    {
      id: 'req7-rename-sync',
      title: 'Rename a Tab — Name Stays in Sync',
      description:
        '**Double-click** any tab to rename it. Type **"' + RENAMED_LABEL + '"** and press **Enter**.\n\n' +
        'Watch the sidebar — the request name updates to match. Tab and request names are ' +
        '**always in sync**: rename either one and the other follows automatically.',
      highlight: REQ.TAB_LABEL,
      preAction: async (ctx) => {
        ensureRequestsTab(ctx);
        await ensureRequestOpen(ctx, REQ_GET_NAME);
        await selectRequestByName(ctx, REQ_GET_NAME, COLLECTION_NAME);
        // Drop leftover product tabs so rename cannot hit index 0 by mistake.
        await closeOtherRequestTabsQuiet(ctx);
        await ensureRequestOpen(ctx, REQ_POST_NAME);
        await selectRequestByName(ctx, REQ_GET_NAME, COLLECTION_NAME);
      },
      action: async (ctx) => {
        // Already renamed from a prior run? spotlight and continue.
        if (findRequestTabIndexByLabel(RENAMED_LABEL) >= 0) {
          const idx = findRequestTabIndexByLabel(RENAMED_LABEL);
          const tabs = document.querySelectorAll<HTMLElement>(`${REQ.TAB_BAR} [role="tab"]`);
          if (tabs[idx]) {
            const remove = showSpotlightRing(tabs[idx]);
            await ctx.delay(1200);
            remove();
          }
        } else {
          const renamed = await renameRequestTabByLabel(ctx, REQ_GET_NAME, RENAMED_LABEL);
          if (!renamed) return;
          await ctx.delay(600);

          const idx = findRequestTabIndexByLabel(RENAMED_LABEL);
          const tabs = document.querySelectorAll<HTMLElement>(`${REQ.TAB_BAR} [role="tab"]`);
          if (idx >= 0 && tabs[idx]) {
            const remove = showSpotlightRing(tabs[idx]);
            await ctx.delay(1200);
            remove();
          }
        }

        // Spotlight the synced sidebar name (scoped to the demo collection)
        await ensureCollectionExpanded(ctx, COLLECTION_NAME);
        await ctx.delay(300);
        const sidebarReq = document.querySelector<HTMLElement>(
          REQ.reqInCollection(COLLECTION_NAME, RENAMED_LABEL),
        );
        if (sidebarReq) {
          const remove2 = showSpotlightRing(sidebarReq);
          await ctx.delay(1200);
          remove2();
        }
      },
      pauseAfter: true,
    },

    // ── 5. Close Tab & Close Other Tabs ────────────────────────────
    {
      id: 'req7-close-tabs',
      title: 'Close a Tab & Close Other Tabs',
      description:
        'Click the **×** on a tab to close it. The last tab can never be closed.\n\n' +
        'Right-click a tab for **Close Others** and **Close Tabs to the Right**. ' +
        'Or use the small icon at the **right end** of the tab bar — ' +
        'it closes every tab except the active one in a single click.',
      highlight: REQ.TAB_BAR,
      preAction: async (ctx) => {
        ensureRequestsTab(ctx);
        const keepName = findRequestTabIndexByLabel(RENAMED_LABEL) >= 0
          ? RENAMED_LABEL
          : REQ_GET_NAME;
        await ensureRequestOpen(ctx, keepName);
        await selectRequestByName(ctx, keepName, COLLECTION_NAME);
        await closeOtherRequestTabsQuiet(ctx);
        await ensureRequestOpen(ctx, REQ_POST_NAME);
        await selectRequestByName(ctx, keepName, COLLECTION_NAME);
      },
      action: async (ctx) => {
        // Close the POST tab via × button (never assume tab indices include product tabs)
        const postIdx = findRequestTabIndexByLabel(REQ_POST_NAME);
        const tabs = document.querySelectorAll<HTMLElement>(`${REQ.TAB_BAR} [role="tab"]`);
        if (postIdx >= 0 && tabs.length >= 2) {
          const postTab = tabs[postIdx];
          const closeBtn = postTab?.querySelector<HTMLElement>(REQ.TAB_CLOSE);
          if (closeBtn) {
            closeBtn.setAttribute('data-lesson-target', 'req7-close');
            await ctx.click('[data-lesson-target="req7-close"]');
            await ctx.delay(800);
          }
        }

        // Re-open so we have 2+ tabs for the close-all demo
        await ensureRequestOpen(ctx, REQ_POST_NAME);
        await ctx.delay(400);
        const keepName = findRequestTabIndexByLabel(RENAMED_LABEL) >= 0
          ? RENAMED_LABEL
          : REQ_GET_NAME;
        await selectRequestByName(ctx, keepName, COLLECTION_NAME);

        // Spotlight the close-other-tabs button
        const closeAllBtn = document.querySelector<HTMLElement>(REQ.TAB_CLOSE_ALL);
        if (closeAllBtn) {
          const remove = showSpotlightRing(closeAllBtn);
          await ctx.delay(1500);
          remove();
          await ctx.delay(300);
          closeAllBtn.click();
          await ctx.delay(800);
        }

        await ctx.delay(600);
      },
      pauseAfter: true,
    },

    // ── 6. Bulk Select & Delete ────────────────────────────────────
    {
      id: 'req7-bulk-delete',
      title: 'Bulk Select & Delete Requests',
      description:
        '**Hover** over any request in the sidebar — a **checkbox** appears. ' +
        'Click it to select. Once any item is checked, all checkboxes become visible ' +
        'and a **floating action bar** slides in at the bottom.\n\n' +
        'Select multiple requests, click **Delete**, and review the **confirmation modal** — ' +
        'each item shows its HTTP method badge. You can deselect items right from the modal.',
      preAction: async (ctx) => {
        ensureRequestsTab(ctx);
        await ensureCollectionExpanded(ctx, COLLECTION_NAME);
        const clearBtn = document.querySelector<HTMLElement>(REQ.CLEAR_SELECTION);
        if (clearBtn) { clearBtn.click(); await ctx.delay(200); }
      },
      action: async (ctx) => {
        await ensureCollectionExpanded(ctx, COLLECTION_NAME);
        await ctx.delay(400);

        // Select two requests via checkboxes
        const req1 = document.querySelector<HTMLElement>(`[data-req-name="${RENAMED_LABEL}"] ${REQ.BULK_CHECKBOX}`) ??
                      document.querySelector<HTMLElement>(`[data-req-name="${REQ_GET_NAME}"] ${REQ.BULK_CHECKBOX}`);
        if (req1) {
          req1.click();
          await ctx.delay(600);
        }

        const req2 = document.querySelector<HTMLElement>(`[data-req-name="${REQ_POST_NAME}"] ${REQ.BULK_CHECKBOX}`);
        if (req2) {
          req2.click();
          await ctx.delay(600);
        }

        // Spotlight the bulk bar
        const bulkBar = document.querySelector<HTMLElement>(REQ.BULK_BAR);
        if (bulkBar) {
          const remove = showSpotlightRing(bulkBar);
          await ctx.delay(1500);
          remove();
        }

        // Click delete to show the confirmation modal
        const deleteBtn = document.querySelector<HTMLElement>(REQ.BULK_DELETE);
        if (deleteBtn) {
          deleteBtn.click();
          await ctx.delay(800);
        }

        // Spotlight the modal
        const modal = document.querySelector<HTMLElement>(REQ.BULK_DELETE_CONFIRM);
        if (modal) {
          const remove2 = showSpotlightRing(modal);
          await ctx.delay(2000);
          remove2();
        }

        // Cancel — keep requests intact for lesson replays
        const cancelBtn = document.querySelector<HTMLButtonElement>('.req-bulk-modal__cancel');
        if (cancelBtn) {
          cancelBtn.click();
          await ctx.delay(400);
        }

        // Clear selection
        const clearBtn = document.querySelector<HTMLElement>(REQ.CLEAR_SELECTION);
        if (clearBtn) {
          clearBtn.click();
          await ctx.delay(400);
        }
      },
      pauseAfter: true,
    },
  ],
};
