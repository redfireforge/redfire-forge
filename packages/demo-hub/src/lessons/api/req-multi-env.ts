/**
 * REQ-3 v2: Multi-Environment Requests
 *
 * 4 steps: create ENV collection → add request + resolved URL → switch env + send → summary.
 * Follows Lesson 1 guidelines: one spotlight at a time, pause before each beat,
 * no reading/action overlap noise, expand sidebar to show created request, hard cleanup.
 * Public API: DummyJSON
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
} from './req-demo-helpers';

const COLLECTION_NAME = 'DummyJSON';
const REQUEST_NAME = 'Search Laptops';
const ENV_PROD = 'production';
const ENV_STAGING = 'staging';
const BASE_URL_PROD = 'https://dummyjson.com';
const BASE_URL_STAGING = 'https://dummyjson.com';
const REQUEST_PATH = '/products/search?q=laptop&limit=3';
/** Sibling lesson collections — remove so this lesson starts clean. */
const SIBLING_COLLECTIONS = ['My API', 'User Service'] as const;
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

async function spotlightContextItem(
  ctx: DemoActionContext,
  text: string,
  holdMs = 1000,
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
  await ctx.delay(40);
  let guard = 0;
  while (document.querySelector(REQ.colByName(collectionName)) && guard < 4) {
    const col = firstVisible(REQ.colByName(collectionName));
    if (!col) break;
    col.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const opened = await openContextMenuForElement(ctx, col);
    if (!opened) break;
    const clicked = await clickContextItemVisible(ctx, 'Delete Collection');
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
  for (const name of SIBLING_COLLECTIONS) {
    await deleteCollectionByName(ctx, name);
  }
  await deleteCollectionByName(ctx, COLLECTION_NAME);
}

async function closeOpenOverlays(ctx: DemoActionContext): Promise<void> {
  dismissContextMenu();
  const modalClose = document.querySelector<HTMLElement>('.req-col-modal .btn-secondary')
    ?? document.querySelector<HTMLElement>('.req-col-modal .btn-ghost');
  if (modalClose) {
    modalClose.click();
    await ctx.delay(60);
  }
  if (document.querySelector(REQ.HISTORY_DROPDOWN)) {
    document.querySelector<HTMLElement>(REQ.HISTORY_TRIGGER)?.click();
    await ctx.delay(40);
  }
}

/**
 * Base URL rows are keyed by env id and ordered by existing RequestEnvs
 * (e.g. d01, t01 first). Never use baseInputs[0]/[1] — fill by env name label.
 */
function findBaseUrlInputByEnvName(envName: string): HTMLInputElement | null {
  const rows = document.querySelectorAll<HTMLElement>('.req-base-url-row');
  for (const row of rows) {
    const label = row.querySelector('.req-env-label')?.textContent?.trim().toLowerCase();
    if (label === envName.toLowerCase()) {
      return row.querySelector<HTMLInputElement>(REQ.BASE_URL_INPUT);
    }
  }
  return null;
}

async function waitForBaseUrlInputByEnvName(
  ctx: DemoActionContext,
  envName: string,
  attempts = 24,
): Promise<HTMLInputElement | null> {
  for (let i = 0; i < attempts; i += 1) {
    const input = findBaseUrlInputByEnvName(envName);
    if (input) return input;
    await ctx.delay(50);
  }
  return null;
}

async function ensureEnvWithBaseUrl(
  ctx: DemoActionContext,
  envName: string,
  baseUrl: string,
  options?: { visible?: boolean },
): Promise<void> {
  const visible = options?.visible ?? false;
  let input = findBaseUrlInputByEnvName(envName);
  if (!input) {
    const addEnvInput = document.querySelector<HTMLInputElement>(REQ.ADD_ENV_INPUT);
    const addBtn = document.querySelector<HTMLButtonElement>(REQ.ADD_ENV_BTN);
    if (addEnvInput && addBtn) {
      if (visible) await spotlightElNoScroll(ctx, addEnvInput, 800);
      fillControlledInput(addEnvInput, envName);
      await ctx.delay(160);
      if (visible) await spotlightElNoScroll(ctx, addBtn, 700);
      addBtn.click();
      input = await waitForBaseUrlInputByEnvName(ctx, envName);
    }
  }
  if (!input) return;
  fillControlledInput(input, baseUrl);
  if (visible) await spotlightElNoScroll(ctx, input, 900);
  else await ctx.delay(80);
}

async function openCollectionModalForCreate(ctx: DemoActionContext): Promise<boolean> {
  await ctx.click(REQ.SIDEBAR_ADD_BTN);
  await ctx.waitFor(REQ.ADD_ENV_COLLECTION, 1500);
  await ctx.click(REQ.ADD_ENV_COLLECTION);
  await ctx.waitFor(REQ.COLLECTION_MODAL, 2000);
  return !!document.querySelector(REQ.COLLECTION_MODAL);
}

async function openCollectionModalForEdit(ctx: DemoActionContext): Promise<boolean> {
  const col = firstVisible(REQ.colByName(COLLECTION_NAME));
  if (!col) return false;
  const opened = await openContextMenuForElement(ctx, col);
  if (!opened) return false;
  await clickContextItemVisible(ctx, 'Edit Collection');
  await ctx.waitFor(REQ.COLLECTION_MODAL, 2000);
  return !!document.querySelector(REQ.COLLECTION_MODAL);
}

async function saveCollectionModal(ctx: DemoActionContext): Promise<void> {
  document.querySelector<HTMLButtonElement>('.req-col-modal .btn-primary')?.click();
  await ctx.delay(300);
}

async function closeCollectionModalIfOpen(ctx: DemoActionContext): Promise<void> {
  const modalClose = document.querySelector<HTMLElement>('.req-col-modal .btn-secondary')
    ?? document.querySelector<HTMLElement>('.req-col-modal .btn-ghost');
  if (modalClose) {
    modalClose.click();
    await ctx.delay(60);
  }
}

function envBaseUrlLooksCorrect(envName: string, expectedUrl: string): boolean {
  const input = findBaseUrlInputByEnvName(envName);
  return !!input && input.value.trim() === expectedUrl;
}

/**
 * Quietly ensure DummyJSON exists with production + staging base URLs filled
 * on the correct env rows (not the first workspace envs like d01/t01).
 */
async function ensureMultiEnvCollection(ctx: DemoActionContext): Promise<void> {
  if (document.querySelector(REQ.colByName(COLLECTION_NAME))) {
    // Repair prior bad runs where base URLs were written onto the wrong env rows.
    const opened = await openCollectionModalForEdit(ctx);
    if (!opened) return;
    const ok =
      envBaseUrlLooksCorrect(ENV_PROD, BASE_URL_PROD)
      && envBaseUrlLooksCorrect(ENV_STAGING, BASE_URL_STAGING);
    if (ok) {
      await closeCollectionModalIfOpen(ctx);
      return;
    }
    await ensureEnvWithBaseUrl(ctx, ENV_PROD, BASE_URL_PROD, { visible: false });
    await ensureEnvWithBaseUrl(ctx, ENV_STAGING, BASE_URL_STAGING, { visible: false });
    await saveCollectionModal(ctx);
    return;
  }

  const opened = await openCollectionModalForCreate(ctx);
  if (!opened) return;

  const nameInput = document.querySelector<HTMLInputElement>('.req-col-modal .req-input');
  if (nameInput) {
    nameInput.focus();
    fillControlledInput(nameInput, COLLECTION_NAME);
  }

  await ensureEnvWithBaseUrl(ctx, ENV_PROD, BASE_URL_PROD, { visible: false });
  await ensureEnvWithBaseUrl(ctx, ENV_STAGING, BASE_URL_STAGING, { visible: false });
  await saveCollectionModal(ctx);
}

/**
 * If staging/production pills resolve without a DummyJSON host, open Edit and repair.
 * Avoids opening the modal on every step when config is already correct.
 */
async function repairBaseUrlsIfNeeded(ctx: DemoActionContext): Promise<void> {
  if (!document.querySelector(REQ.colByName(COLLECTION_NAME))) {
    await ensureMultiEnvCollection(ctx);
    return;
  }
  const staging = firstVisible(REQ.envPillByName(ENV_STAGING));
  const prod = firstVisible(REQ.envPillByName(ENV_PROD));
  if (!staging || !prod) {
    await ensureMultiEnvCollection(ctx);
    return;
  }
  staging.click();
  await ctx.delay(100);
  const resolved = (document.querySelector(REQ.RESOLVED_URL)?.textContent || '').trim();
  const ok = resolved.startsWith(BASE_URL_STAGING) || resolved.includes('dummyjson.com/');
  if (!ok) await ensureMultiEnvCollection(ctx);
}

async function ensureRequestReady(ctx: DemoActionContext): Promise<void> {
  await repairBaseUrlsIfNeeded(ctx);
  await ensureCollectionExpanded(ctx, COLLECTION_NAME);
  const existingReq = firstVisible(REQ.reqInCollection(COLLECTION_NAME, REQUEST_NAME));
  if (existingReq) {
    existingReq.click();
    await ctx.delay(100);
    const urlInput = document.querySelector<HTMLInputElement>(REQ.URL_INPUT);
    if (urlInput && urlInput.value !== REQUEST_PATH) {
      fillControlledInput(urlInput, REQUEST_PATH);
    }
    return;
  }

  const col = firstVisible(REQ.colByName(COLLECTION_NAME));
  if (!col) return;
  const opened = await openContextMenuForElement(ctx, col);
  if (!opened) return;
  await clickContextItemVisible(ctx, 'Add Request');
  await ctx.waitFor(REQ.URL_INPUT, 2200);

  const nameDisplay = firstVisible('.req-req-name-display');
  if (nameDisplay) {
    nameDisplay.click();
    await ctx.delay(80);
    const nameInput = firstVisible('.req-req-name-input') as HTMLInputElement | null;
    if (nameInput) {
      fillControlledInput(nameInput, REQUEST_NAME);
      nameInput.blur();
      await ctx.delay(80);
    }
  }

  const urlInput = document.querySelector<HTMLInputElement>(REQ.URL_INPUT);
  if (urlInput) fillControlledInput(urlInput, REQUEST_PATH);
}

export const reqMultiEnvLesson: DemoLesson = {
  id: 'req-multi-env',
  domainId: 'api',
  category: 'requests',
  name: 'Multi-Environment Requests',
  description:
    'Create an ENV collection with production and staging base URLs, then reuse one request path across both with instant URL resolution.',
  estimatedMinutes: 3,
  initialTab: 'requests',
  allowedTabs: ['requests'],

  concept: {
    title: 'One Request, Multiple Targets',
    body:
      'A **Multi-Environment (ENV) Collection** stores a base URL map and lets requests use ' +
      'relative paths. You write one path once, then switch environments with a single click.\n\n' +
      '**What this lesson demonstrates:**\n' +
      '- Creating an ENV collection from scratch\n' +
      '- Defining production and staging base URLs\n' +
      '- Adding a request with a relative path (`/products/search?...`)\n' +
      '- Using the env pill to switch targets and re-send quickly\n\n' +
      '**Why this matters:**\n' +
      '- No URL rewrites when moving between environments\n' +
      '- Cleaner request definitions for teams\n' +
      '- Ready for per-environment auth inheritance in larger projects',
    keyTerms: [
      { term: 'ENV Collection', definition: 'Collection mode where requests use relative paths with environment base URLs' },
      { term: 'Base URL Map', definition: 'Environment-to-host mapping stored at collection level' },
      { term: 'Relative Path', definition: 'Request path without host, resolved with the active environment base URL' },
      { term: 'Resolved URL', definition: 'Live preview of full URL after host + path composition' },
      { term: 'Env Pill', definition: 'Clickable badge that switches the active environment base URL' },
    ],
    diagram: `<svg viewBox="0 0 400 120" xmlns="http://www.w3.org/2000/svg">
      <rect x="130" y="5" width="140" height="28" rx="5" fill="#1e293b" stroke="#10b981" stroke-width="1.5"/>
      <text x="200" y="23" text-anchor="middle" fill="#10b981" font-size="10">ENV Collection: DummyJSON</text>
      <path d="M160 33 L80 55" stroke="#3b4a60" stroke-width="1"/>
      <path d="M240 33 L320 55" stroke="#3b4a60" stroke-width="1"/>
      <rect x="20" y="55" width="120" height="24" rx="4" fill="#1e293b" stroke="#3b82f6" stroke-width="1"/>
      <text x="80" y="71" text-anchor="middle" fill="#3b82f6" font-size="9">production: dummyjson.com</text>
      <rect x="260" y="55" width="120" height="24" rx="4" fill="#1e293b" stroke="#f59e0b" stroke-width="1"/>
      <text x="320" y="71" text-anchor="middle" fill="#f59e0b" font-size="9">staging: dummyjson.com</text>
      <path d="M200 33 L200 90" stroke="#94a3b8" stroke-width="1" stroke-dasharray="3"/>
      <rect x="110" y="90" width="180" height="22" rx="4" fill="#1e293b" stroke="#94a3b8" stroke-width="1"/>
      <text x="200" y="105" text-anchor="middle" fill="#f1f5f9" font-size="9">/products/search?q=laptop&limit=3</text>
    </svg>`,
  },

  setup: async (ctx) => {
    ctx.navigateToTab('requests');
    await ctx.delay(80);
    await closeOpenOverlays(ctx);
    await cleanupLessonCollections(ctx);
    await shrinkAllCollections();
    const sidebar = document.querySelector<HTMLElement>(REQ.SIDEBAR);
    if (sidebar) sidebar.scrollTop = 0;
  },

  cleanup: async (ctx) => {
    await closeOpenOverlays(ctx);
    await cleanupLessonCollections(ctx);
    ctx.navigateToTab('requests');
    await ctx.delay(60);
  },

  steps: [
    // ── Step 1: Create Multi-Env Collection ──
    {
      id: 'req3-create',
      title: 'Create Multi-Env Collection',
      description:
        'Click **+** to see Group / URL Collection / **ENV Collection**. Choose **ENV Collection**. ' +
        'Name it **"DummyJSON"**, review URL mode and the **Base URLs per Environment** map, ' +
        'add **production** and **staging** (both `https://dummyjson.com`), review Default Auth, then save.',
      highlight: REQ.SIDEBAR_ADD_BTN,
      preAction: async (ctx) => {
        ensureRequestsTab(ctx);
        await closeOpenOverlays(ctx);
        if (document.querySelector(REQ.colByName(COLLECTION_NAME))) return;
        await shrinkAllCollections();
      },
      action: async (ctx) => {
        if (document.querySelector(REQ.colByName(COLLECTION_NAME))) {
          // Repair prior bad runs (URLs written onto d01/t01 instead of production/staging).
          await ensureMultiEnvCollection(ctx);
          await spotlight(ctx, REQ.colByName(COLLECTION_NAME), 900);
          return;
        }

        // Reading already highlights + — click once, then pause on dropdown.
        await ctx.click(REQ.SIDEBAR_ADD_BTN);
        await ctx.waitFor(REQ.ADD_DROPDOWN, 1500);
        await spotlight(ctx, REQ.ADD_DROPDOWN, 1200);

        await spotlight(ctx, REQ.ADD_ENV_COLLECTION, 1000);
        await ctx.click(REQ.ADD_ENV_COLLECTION);
        await ctx.waitFor(REQ.COLLECTION_MODAL, 2000);
        await ctx.delay(280);

        const nameInput = document.querySelector<HTMLInputElement>('.req-col-modal .req-input');
        if (nameInput) {
          await spotlightElNoScroll(ctx, nameInput, 900);
          nameInput.focus();
          fillControlledInput(nameInput, COLLECTION_NAME);
          await ctx.delay(300);
        }

        const modeSwitcher = firstVisible('.req-col-modal .req-mode-switcher');
        if (modeSwitcher) await spotlightEl(ctx, modeSwitcher, 1100);

        const baseMap = firstVisible(REQ.BASE_URL_MAP);
        if (baseMap) await spotlightEl(ctx, baseMap, 1000);

        // Fill by env NAME — workspace may already have d01/t01 rows before these.
        await ensureEnvWithBaseUrl(ctx, ENV_PROD, BASE_URL_PROD, { visible: true });
        await ensureEnvWithBaseUrl(ctx, ENV_STAGING, BASE_URL_STAGING, { visible: true });

        const formGroups = document.querySelectorAll<HTMLElement>('.req-col-modal .req-form-group');
        const authGroup = Array.from(formGroups).find(g =>
          g.querySelector('label')?.textContent?.includes('Default Auth')
        );
        if (authGroup) await spotlightEl(ctx, authGroup, 1000);

        await saveCollectionModal(ctx);
        await spotlight(ctx, REQ.colByName(COLLECTION_NAME), 1100);
      },
    },

    // ── Step 2: Add Request & Resolved URL ──
    {
      id: 'req3-request',
      title: 'Add Request & See Resolved URL',
      description:
        'Right-click the collection and choose **Add Request**. Rename it **"Search Laptops"**, ' +
        'enter the relative path `/products/search?q=laptop&limit=3`, then read the **Resolved URL** ' +
        'and the **production / staging** env pills.',
      // No reading highlight on DummyJSON — Step 1 already showed it.
      preAction: async (ctx) => {
        ensureRequestsTab(ctx);
        await closeOpenOverlays(ctx);
        if (!document.querySelector(REQ.colByName(COLLECTION_NAME))) {
          await ensureMultiEnvCollection(ctx);
        }
      },
      action: async (ctx) => {
        const existing = firstVisible(REQ.reqInCollection(COLLECTION_NAME, REQUEST_NAME));
        if (!existing) {
          const col = firstVisible(REQ.colByName(COLLECTION_NAME));
          if (!col) return;
          const opened = await openContextMenuForElement(ctx, col);
          if (!opened) return;
          // Highlight only the menu action we take — not the whole menu then the item.
          await spotlightContextItem(ctx, 'Add Request', 1100);
          await clickContextItemVisible(ctx, 'Add Request');
          await ctx.waitFor(REQ.URL_INPUT, 2200);
          await ctx.delay(240);

          const nameDisplay = firstVisible('.req-req-name-display');
          if (nameDisplay) {
            nameDisplay.click();
            await ctx.delay(120);
            const nameInput = firstVisible('.req-req-name-input') as HTMLInputElement | null;
            if (nameInput) {
              await spotlightElNoScroll(ctx, nameInput, 900);
              fillControlledInput(nameInput, REQUEST_NAME);
              await ctx.delay(220);
              nameInput.blur();
            }
            await ctx.delay(120);
          }
        } else {
          existing.click();
          await ctx.delay(120);
        }

        const urlInput = firstVisible(REQ.URL_INPUT) as HTMLInputElement | null;
        if (urlInput) {
          await spotlightElNoScroll(ctx, urlInput, 800);
          if (urlInput.value !== REQUEST_PATH) {
            urlInput.focus();
            fillControlledInput(urlInput, REQUEST_PATH);
            await ctx.delay(300);
          }
          await spotlightElNoScroll(ctx, urlInput, 900);
        }

        await spotlight(ctx, REQ.RESOLVED_URL, 1200);
        await spotlight(ctx, REQ.ENV_BAR, 1100);

        // Leave production selected (workspace may also show d01/t01 with empty hosts).
        const prodPill = firstVisible(REQ.envPillByName(ENV_PROD));
        if (prodPill) {
          prodPill.click();
          await ctx.delay(160);
          await spotlight(ctx, REQ.RESOLVED_URL, 900);
        }

        // Expand sidebar so the created request is visible (no collection ring).
        await ensureCollectionExpanded(ctx, COLLECTION_NAME);
        const createdReq = firstVisible(REQ.reqInCollection(COLLECTION_NAME, REQUEST_NAME));
        if (createdReq) await spotlightElNoScroll(ctx, createdReq, 1000);
      },
    },

    // ── Step 3: Switch Environments & Send ──
    {
      id: 'req3-switch',
      title: 'Switch Environments & Send',
      description:
        'Click the **staging** pill and watch the **Resolved URL** update. Switch back to **production**, ' +
        'then **Send**. Review status, time, size, and the JSON response.',
      highlight: REQ.envPillByName(ENV_STAGING),
      preAction: async (ctx) => {
        ensureRequestsTab(ctx);
        await closeOpenOverlays(ctx);
        await ensureRequestReady(ctx);
        await ctx.waitFor(REQ.ENV_BAR, 2000);
      },
      action: async (ctx) => {
        // Reading already highlights staging — click once, then show resolved URL.
        const stagingPill = firstVisible(REQ.envPillByName(ENV_STAGING));
        if (stagingPill) {
          stagingPill.click();
          await ctx.delay(350);
          await spotlight(ctx, REQ.RESOLVED_URL, 1200);
        }

        const prodPill = firstVisible(REQ.envPillByName(ENV_PROD));
        if (prodPill) {
          await spotlightElNoScroll(ctx, prodPill, 1000);
          prodPill.click();
          await ctx.delay(350);
          await spotlight(ctx, REQ.RESOLVED_URL, 1100);
        }

        await spotlight(ctx, REQ.SEND_BTN, 1000);
        await ctx.click(REQ.SEND_BTN);
        await ctx.waitFor(REQ.STATUS_PILL, 5000);

        await spotlight(ctx, REQ.STATUS_PILL, 1100);
        await spotlight(ctx, REQ.RESPONSE_TIME, 900);
        await spotlight(ctx, REQ.RESPONSE_SIZE, 900);

        const json = firstVisible(REQ.JSON_PREVIEW);
        if (json) await spotlightEl(ctx, json, 1100);
      },
    },

    // ── Step 4: Summary ──
    {
      id: 'req3-summary',
      title: 'When to Use Multi-Env',
      description:
        'Use ENV collections when the same requests must run across development, staging, and production. ' +
        'Keep one relative-path request set, switch environments with pills, and avoid repetitive URL edits. ' +
        'Per-environment auth can also ride along with the active pill.',
      highlight: REQ.ENV_BAR,
      pauseAfter: true,
      preAction: async (ctx) => {
        ensureRequestsTab(ctx);
        await closeOpenOverlays(ctx);
        if (!document.querySelector(REQ.colByName(COLLECTION_NAME))) {
          await ensureMultiEnvCollection(ctx);
        }
        await ensureRequestReady(ctx);
      },
      // No action spotlights — reading highlight + pauseAfter is enough (avoids double rings).
    },
  ],
};
