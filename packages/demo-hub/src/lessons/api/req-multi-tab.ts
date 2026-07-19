/**
 * REQ-7: Multi-Tab Requests
 *
 * 7 steps: tour tab bar → open first request → open second tab → switch tabs →
 * send & see per-tab cache → rename tab → close tab.
 *
 * Setup creates a "Multi-Tab Demo" URL collection with two requests
 * (Get Users GET, Create Post POST) so the lesson focuses entirely on tab
 * features. Cleanup removes the collection and extra tabs.
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
  ensureCollectionExpanded,
  selectRequestByName,
  shrinkAllCollections,
  captureLessonCleanupBaseline,
  cleanupLessonArtifacts,
  getRequestTabCount,
  closeExtraRequestTabs,
  clickRequestTabByIndex,
  renameRequestTabByIndex,
} from './req-demo-helpers';

const LESSON_ID = 'req-multi-tab';
const COLLECTION_NAME = 'Multi-Tab Demo';
const REQ_GET_NAME = 'Get Users';
const REQ_POST_NAME = 'Create Post';
const GET_URL = 'https://jsonplaceholder.typicode.com/users';
const POST_URL = 'https://jsonplaceholder.typicode.com/posts';
const RENAMED_LABEL = 'Users API';

const SIBLING_COLLECTIONS = ['API Demos', 'My API', 'User Service', 'DummyJSON', 'Product Service'] as const;

// ─── Setup / Cleanup ────────────────────────────────────────────────

async function addRequestViaContextMenu(
  ctx: DemoActionContext,
  colName: string,
  reqName: string,
  url: string,
  method?: string,
): Promise<void> {
  const col = document.querySelector<HTMLElement>(REQ.colByName(colName));
  if (!col) return;
  triggerContextMenu(col);
  await ctx.delay(200);
  await clickContextMenuItem(ctx, 'Add Request');
  await ctx.delay(500);

  const nameDisplay = document.querySelector<HTMLElement>('.req-req-name-display');
  if (nameDisplay) {
    nameDisplay.click();
    await ctx.delay(200);
    const nameInput = document.querySelector<HTMLInputElement>('.req-req-name-input');
    if (nameInput) {
      fillControlledInput(nameInput, reqName);
      await ctx.delay(100);
      nameInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await ctx.delay(200);
    }
  }

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
}

async function multiTabSetup(ctx: DemoActionContext): Promise<void> {
  ensureRequestsTab(ctx);
  await ctx.delay(400);

  captureLessonCleanupBaseline(LESSON_ID, {
    collectionExactNames: [COLLECTION_NAME],
    requestExactNames: [REQ_GET_NAME, REQ_POST_NAME],
  });

  for (const col of SIBLING_COLLECTIONS) {
    const el = document.querySelector(REQ.colByName(col));
    if (el) {
      const group = el.closest('.req-col-group');
      if (group) {
        const header = group.querySelector<HTMLElement>('[data-testid="req-col-item"]');
        if (header) header.click();
      }
    }
  }
  await shrinkAllCollections();
  await ctx.delay(200);

  if (document.querySelector(REQ.colByName(COLLECTION_NAME))) {
    await cleanupLessonArtifacts(ctx, LESSON_ID, {
      collectionExactNames: [COLLECTION_NAME],
    });
    captureLessonCleanupBaseline(LESSON_ID, {
      collectionExactNames: [COLLECTION_NAME],
      requestExactNames: [REQ_GET_NAME, REQ_POST_NAME],
    });
  }

  await createCollectionViaModal(ctx, COLLECTION_NAME);
  await ctx.delay(400);
  await ensureCollectionExpanded(ctx, COLLECTION_NAME);

  await addRequestViaContextMenu(ctx, COLLECTION_NAME, REQ_GET_NAME, GET_URL, 'GET');
  await ctx.delay(300);

  await addRequestViaContextMenu(ctx, COLLECTION_NAME, REQ_POST_NAME, POST_URL, 'POST');
  await ctx.delay(300);

  await closeExtraRequestTabs(ctx);
  await ctx.delay(200);
}

async function multiTabCleanup(ctx: DemoActionContext): Promise<void> {
  await closeExtraRequestTabs(ctx);
  await ctx.delay(200);
  ensureRequestsTab(ctx);
  await ctx.delay(200);
  await cleanupLessonArtifacts(ctx, LESSON_ID, {
    collectionExactNames: [COLLECTION_NAME],
    requestExactNames: [REQ_GET_NAME, REQ_POST_NAME],
  });
}

// ─── Helpers ────────────────────────────────────────────────────────

async function ensureRequestOpen(
  ctx: DemoActionContext,
  reqName: string,
): Promise<void> {
  await ensureCollectionExpanded(ctx, COLLECTION_NAME);
  const reqEl = document.querySelector<HTMLElement>(REQ.reqByName(reqName));
  if (!reqEl) return;
  reqEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  reqEl.click();
  await ctx.delay(300);
}

// ─── Lesson ─────────────────────────────────────────────────────────

export const reqMultiTabLesson: DemoLesson = {
  id: LESSON_ID,
  domainId: 'api',
  category: 'requests',
  name: 'Multi-Tab Requests',
  description:
    'Open multiple requests as independent tabs — each with its own method badge, response cache, and editor state.',
  estimatedMinutes: 4,
  initialTab: 'requests',
  allowedTabs: ['requests'],

  setup: multiTabSetup,
  cleanup: multiTabCleanup,

  concept: {
    title: 'Multi-Tab Requests — Work on Multiple APIs at Once',
    body: `Every request you open gets its own **tab** in the editor. No more losing your response when switching to a different endpoint.

**What you'll learn:**
- **Method badges** — each tab shows a color-coded badge (green for GET, blue for POST, amber for PUT, red for DELETE) so you can identify requests at a glance
- **Per-tab response cache** — send a request, switch to another tab, come back — your response is still there
- **Rename & organize** — double-click a tab to give it a meaningful name
- **Independent state** — each tab remembers its own active sub-tab (Body, Auth, Headers), scroll position, and history

**Why it matters:**
API development rarely involves a single endpoint. You might test a GET to list resources, then POST to create one, then GET again to verify. With tabs, all three stay open and ready — no re-sending, no losing context.

**Capacity:** Up to **8 tabs** open simultaneously. Close any tab except the last one.`,
    keyTerms: [
      { term: 'Request Tab', definition: 'An independent editor workspace for one request — its own URL, method, body, auth, headers, response, and history.' },
      { term: 'Method Badge', definition: 'Color-coded label on each tab: green (GET), blue (POST), amber (PUT), red (DELETE), purple (PATCH).' },
      { term: 'Per-Tab Response', definition: 'Each tab maintains its own response cache. Switching tabs never clears a response you already received.' },
      { term: 'Tab Rename', definition: 'Double-click a tab label to rename it. Renamed tabs keep their custom label even when the request name changes.' },
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
  <text x="356" y="32" fill="#a8b8cc" font-size="9">2/8</text>

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
    // ── 1. Tour the Tab Bar ─────────────────────────────────────────
    {
      id: 'req7-tab-bar',
      title: 'The Request Tab Bar',
      description:
        'Every request you open appears as a **tab** above the editor. ' +
        'Each tab is an independent workspace with its own **method badge**, **URL**, **body**, **auth**, and **response cache**. ' +
        'Up to 8 tabs can be open at once.\n\n' +
        'The **+** button at the right opens a new blank tab. ' +
        'The counter next to it shows how many tabs are in use.',
      highlight: REQ.TAB_BAR,
      preAction: async (ctx) => {
        ensureRequestsTab(ctx);
        await ctx.delay(200);
      },
      action: async (ctx) => {
        const el = document.querySelector<HTMLElement>(REQ.TAB_ADD);
        if (el) {
          const remove = showSpotlightRing(el);
          await ctx.delay(1200);
          remove();
        }
      },
      pauseAfter: true,
    },

    // ── 2. Open First Request ───────────────────────────────────────
    {
      id: 'req7-open-first',
      title: 'Open a Request — Tab Appears',
      description:
        'Click **Get Users** in the sidebar. A tab opens with a green **GET** badge. ' +
        'The editor loads the request URL and is ready to send.\n\n' +
        'Notice the tab label matches the request name — if you rename the request later, ' +
        'the tab updates automatically.',
      highlight: REQ.reqByName(REQ_GET_NAME),
      preAction: async (ctx) => {
        ensureRequestsTab(ctx);
        await closeExtraRequestTabs(ctx);
        await ctx.delay(200);
        await ensureCollectionExpanded(ctx, COLLECTION_NAME);
      },
      action: async (ctx) => {
        await selectRequestByName(ctx, REQ_GET_NAME, COLLECTION_NAME);
        await ctx.delay(600);

        const tabBar = document.querySelector<HTMLElement>(REQ.TAB_BAR);
        if (tabBar) {
          const remove = showSpotlightRing(tabBar);
          await ctx.delay(1200);
          remove();
        }
      },
      verify: REQ.TAB_ITEM,
      pauseAfter: true,
    },

    // ── 3. Open Second Tab ──────────────────────────────────────────
    {
      id: 'req7-second-tab',
      title: 'Open a Second Tab — Side by Side',
      description:
        'Click **Create Post** in the sidebar. A **second tab** appears with a blue **POST** badge. ' +
        'Both tabs stay open — you\'re not replacing the first request, you\'re adding a new workspace.\n\n' +
        'The method badges make it easy to tell tabs apart at a glance: ' +
        '**green** for GET, **blue** for POST, **amber** for PUT, **red** for DELETE.',
      highlight: REQ.reqByName(REQ_POST_NAME),
      preAction: async (ctx) => {
        ensureRequestsTab(ctx);
        await ensureCollectionExpanded(ctx, COLLECTION_NAME);
        await ensureRequestOpen(ctx, REQ_GET_NAME);
      },
      action: async (ctx) => {
        await selectRequestByName(ctx, REQ_POST_NAME, COLLECTION_NAME);
        await ctx.delay(800);

        const tabs = document.querySelectorAll<HTMLElement>(`${REQ.TAB_BAR} [role="tab"]`);
        if (tabs.length >= 2) {
          const remove = showSpotlightRing(tabs[0]);
          await ctx.delay(900);
          remove();
          const remove2 = showSpotlightRing(tabs[1]);
          await ctx.delay(900);
          remove2();
        }
      },
      pauseAfter: true,
    },

    // ── 4. Switch Between Tabs ──────────────────────────────────────
    {
      id: 'req7-switch',
      title: 'Switch Between Tabs',
      description:
        'Click any tab to switch to it. Watch the editor **instantly** swap to that request\'s URL, method, and editor state. ' +
        'Each tab remembers which sub-tab was active (Body, Auth, Headers) and restores it when you switch back.\n\n' +
        'Try it: we\'ll switch to **Get Users**, then back to **Create Post** — ' +
        'both remember exactly where you left off.',
      highlight: REQ.TAB_BAR,
      preAction: async (ctx) => {
        ensureRequestsTab(ctx);
        if (getRequestTabCount() < 2) {
          await ensureRequestOpen(ctx, REQ_GET_NAME);
          await ensureRequestOpen(ctx, REQ_POST_NAME);
        }
      },
      action: async (ctx) => {
        await clickRequestTabByIndex(ctx, 0, 800);

        const urlInput = document.querySelector<HTMLElement>(REQ.URL_INPUT);
        if (urlInput) {
          const remove = showSpotlightRing(urlInput);
          await ctx.delay(1000);
          remove();
        }

        await clickRequestTabByIndex(ctx, 1, 800);

        const urlInput2 = document.querySelector<HTMLElement>(REQ.URL_INPUT);
        if (urlInput2) {
          const remove2 = showSpotlightRing(urlInput2);
          await ctx.delay(1000);
          remove2();
        }
      },
      pauseAfter: true,
    },

    // ── 5. Per-Tab Response Cache ───────────────────────────────────
    {
      id: 'req7-cache',
      title: 'Per-Tab Response Cache',
      description:
        'This is the key benefit of tabs: **each tab keeps its own response**. ' +
        'We\'ll send a GET request, switch to the other tab, then switch back — ' +
        'the response is **still there**, no need to re-send.\n\n' +
        'Without tabs, switching requests would blank out your response. ' +
        'With tabs, you can compare responses from different endpoints side by side.',
      highlight: REQ.SEND_BTN,
      preAction: async (ctx) => {
        ensureRequestsTab(ctx);
        if (getRequestTabCount() < 2) {
          await ensureRequestOpen(ctx, REQ_GET_NAME);
          await ensureRequestOpen(ctx, REQ_POST_NAME);
        }
        await clickRequestTabByIndex(ctx, 0, 300);
        const urlInput = document.querySelector<HTMLInputElement>(REQ.URL_INPUT);
        if (urlInput && !urlInput.value) {
          fillControlledInput(urlInput, GET_URL);
          await ctx.delay(100);
        }
      },
      action: async (ctx) => {
        await ctx.click(REQ.SEND_BTN);
        await ctx.waitFor(REQ.STATUS_PILL, 8000);
        await ctx.delay(1500);

        const statusEl = document.querySelector<HTMLElement>(REQ.STATUS_PILL);
        if (statusEl) {
          const remove = showSpotlightRing(statusEl);
          await ctx.delay(1200);
          remove();
        }

        await clickRequestTabByIndex(ctx, 1, 800);

        const placeholder = document.querySelector<HTMLElement>(REQ.RESP_PLACEHOLDER);
        if (placeholder) {
          const remove2 = showSpotlightRing(placeholder);
          await ctx.delay(1000);
          remove2();
        }

        await clickRequestTabByIndex(ctx, 0, 800);

        const statusEl2 = document.querySelector<HTMLElement>(REQ.STATUS_PILL);
        if (statusEl2) {
          const remove3 = showSpotlightRing(statusEl2);
          await ctx.delay(1500);
          remove3();
        }
      },
      verify: REQ.STATUS_PILL,
      pauseAfter: 2000,
    },

    // ── 6. Rename a Tab ─────────────────────────────────────────────
    {
      id: 'req7-rename',
      title: 'Rename a Tab',
      description:
        '**Double-click** any tab to rename it. Type a custom name and press **Enter**. ' +
        'Renamed tabs keep their custom label even when the underlying request name changes — ' +
        'useful for giving tabs meaningful names like "Users API" or "Auth Test".\n\n' +
        'Press **Escape** to cancel a rename. Maximum 40 characters.',
      highlight: REQ.TAB_LABEL,
      preAction: async (ctx) => {
        ensureRequestsTab(ctx);
        if (getRequestTabCount() < 2) {
          await ensureRequestOpen(ctx, REQ_GET_NAME);
          await ensureRequestOpen(ctx, REQ_POST_NAME);
        }
        await clickRequestTabByIndex(ctx, 0, 200);
      },
      action: async (ctx) => {
        await renameRequestTabByIndex(ctx, 0, RENAMED_LABEL);
        await ctx.delay(600);

        const tabs = document.querySelectorAll<HTMLElement>(`${REQ.TAB_BAR} [role="tab"]`);
        const renamedTab = tabs[0];
        if (renamedTab) {
          const remove = showSpotlightRing(renamedTab);
          await ctx.delay(1400);
          remove();
        }
      },
      pauseAfter: true,
    },

    // ── 7. Close a Tab ──────────────────────────────────────────────
    {
      id: 'req7-close',
      title: 'Close a Tab',
      description:
        'Click the **×** button on any tab to close it. The neighboring tab is selected automatically.\n\n' +
        'The **last tab** can never be closed — there\'s always at least one workspace open. ' +
        'Notice the × button disappears when only one tab remains.\n\n' +
        'Right-click any tab for more options: **Close Others**, **Close Tabs to the Right**, **Duplicate**, and **Copy Label**.',
      highlight: REQ.TAB_CLOSE,
      preAction: async (ctx) => {
        ensureRequestsTab(ctx);
        if (getRequestTabCount() < 2) {
          await ensureRequestOpen(ctx, REQ_GET_NAME);
          await ensureRequestOpen(ctx, REQ_POST_NAME);
        }
        await clickRequestTabByIndex(ctx, 0, 200);
      },
      action: async (ctx) => {
        const tabs = document.querySelectorAll<HTMLElement>(`${REQ.TAB_BAR} [role="tab"]`);
        if (tabs.length < 2) return;
        const lastTab = tabs[tabs.length - 1];
        const closeBtn = lastTab?.querySelector<HTMLElement>(REQ.TAB_CLOSE);
        if (closeBtn) {
          closeBtn.setAttribute('data-lesson-target', 'req7-close');
          await ctx.click('[data-lesson-target="req7-close"]');
          await ctx.delay(800);
        }

        const remainingTabs = document.querySelectorAll<HTMLElement>(`${REQ.TAB_BAR} [role="tab"]`);
        if (remainingTabs.length === 1) {
          const singleTab = remainingTabs[0];
          if (singleTab) {
            const remove = showSpotlightRing(singleTab);
            await ctx.delay(1200);
            remove();
          }
        }
      },
      pauseAfter: true,
    },
  ],
};
