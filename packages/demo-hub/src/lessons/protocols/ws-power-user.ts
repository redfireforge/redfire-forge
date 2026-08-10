/**
 * Lesson 17: Power User — Tabs & Keyboard
 *
 * Builds on Lesson 4 (ws-tabs) with advanced tab features:
 *  - Drag-and-drop reorder
 *  - Keyboard navigation (Arrow, F2, Delete)
 *  - Per-tab auth and shell tab persistence
 *
 * No Docker required — uses the built-in mock echo server.
 */
import type { DemoActionContext, DemoLesson } from '../../types';
import { seedWsConnectionTabsQuiet } from '../../adapters';
import { showSpotlightRing } from '../../demoRipple';
import {
  clearEvents,
  closeExtraConnectionTabs,
  disconnectWebSocket,
  fillControlledInput,
  firstVisibleEl,
  startMockServerQuiet,
  stopMockServerQuiet,
  switchToClientModeQuiet,
} from '../setup-helpers';
import { WS } from '@shared/selectors';
import { firstVisibleElement } from '../../utils/domVisibility';

const POWER_USER_TAB_LABELS = ['Server A', 'Server B', 'Staging'] as const;
const DEMO_BEARER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.demo-power-user';

/** Steady spotlight holds — longer than a flash so the viewer can fixate. */
const HOLD = {
  look: 1100,
  beat: 800,
  outcome: 1300,
};

/**
 * Steady (non-pulsing) spotlight + pause on one control.
 * Prefer this over outline/opacity flashes — a held ring draws attention cleanly.
 */
async function spotlightHold(
  ctx: DemoActionContext,
  el: HTMLElement | null | undefined,
  holdMs: number = HOLD.look,
): Promise<void> {
  if (!el) return;
  el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  const remove = showSpotlightRing(el, { steady: true });
  try {
    await ctx.delay(holdMs);
  } finally {
    remove();
  }
}

/** Dispatch a keyboard event marked so useDemoShortcuts ignores it. */
function dispatchDemoKey(target: HTMLElement, key: string): void {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  (event as KeyboardEvent & { __demoAction?: boolean }).__demoAction = true;
  target.dispatchEvent(event);
}

/** Focus a tab for keyboard demos (spotlightHold provides the visible cue). */
function focusTabVisible(tab: HTMLElement): void {
  try {
    tab.focus({ focusVisible: true } as FocusOptions);
  } catch {
    tab.focus();
  }
}

/** Get a tab by index (0-based) from the connection tab bar */
function getTabByIndex(index: number): HTMLElement | null {
  const tabs = document.querySelectorAll(`${WS.CONN_TAB_BAR} [role="tab"]`);
  return (tabs[index] as HTMLElement) ?? null;
}

function getTabLabels(): string[] {
  return Array.from(
    document.querySelectorAll(`${WS.CONN_TAB_BAR} [role="tab"] .ws-conn-tab-label`),
  ).map((el) => el.textContent?.trim() ?? '');
}

function findTabByLabel(label: string): HTMLElement | null {
  const tabs = document.querySelectorAll(`${WS.CONN_TAB_BAR} [role="tab"]`);
  for (const t of tabs) {
    if (t.querySelector('.ws-conn-tab-label')?.textContent?.trim() === label) {
      return t as HTMLElement;
    }
  }
  return null;
}

/**
 * Rename a specific tab by index (0-based).
 * click → focus → F2 → fill → Enter
 * @param paceMs base delay between beats — keep low for quiet setup/guards.
 */
async function renameTabByIndex(
  ctx: DemoActionContext,
  index: number,
  name: string,
  paceMs = 300,
  opts: { spotlight?: boolean } = {},
): Promise<void> {
  const tab = getTabByIndex(index);
  if (!tab) return;
  const useSpotlight = opts.spotlight !== false && paceMs >= 400;

  tab.click();
  await ctx.delay(paceMs);
  if (useSpotlight) await spotlightHold(ctx, tab, HOLD.look);
  else {
    focusTabVisible(tab);
    await ctx.delay(Math.max(120, Math.min(200, paceMs)));
  }
  focusTabVisible(tab);
  dispatchDemoKey(tab, 'F2');
  await ctx.delay(paceMs);

  let input = document.querySelector(WS.CONN_TAB_RENAME) as HTMLInputElement | null;
  if (!input) {
    tab.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    await ctx.delay(Math.max(200, paceMs));
    input = document.querySelector(WS.CONN_TAB_RENAME) as HTMLInputElement | null;
  }
  if (!input) return;

  // Hold the rename field so the viewer sees the input before typing.
  if (useSpotlight) await spotlightHold(ctx, input, HOLD.beat);
  fillControlledInput(input, '');
  await ctx.delay(Math.max(200, paceMs));
  fillControlledInput(input, name);
  if (useSpotlight) await spotlightHold(ctx, input, HOLD.look);
  else await ctx.delay(Math.max(500, paceMs));
  dispatchDemoKey(input, 'Enter');
  await ctx.delay(Math.max(300, paceMs));
  // Outcome: renamed tab label
  if (useSpotlight) {
    const renamed = getTabByIndex(index);
    await spotlightHold(ctx, renamed, HOLD.outcome);
  }
}

/**
 * Focus a tab, hold a steady spotlight, then dispatch a keyboard event.
 */
async function pressKeyOnTab(
  ctx: DemoActionContext,
  key: string,
  tab: HTMLElement | null,
  opts: { activateFirst?: boolean; paceMs?: number; spotlight?: boolean } = {},
): Promise<void> {
  if (!tab) return;
  const paceMs = opts.paceMs ?? 350;
  if (opts.activateFirst !== false) {
    tab.click();
    await ctx.delay(paceMs);
  }
  focusTabVisible(tab);
  if (opts.spotlight !== false && paceMs >= 400) {
    await spotlightHold(ctx, tab, HOLD.look);
  } else {
    await ctx.delay(Math.max(150, paceMs - 100));
  }
  dispatchDemoKey(tab, key);
  await ctx.delay(paceMs);
}

/**
 * Show drag feedback with steady spotlights, then reorder via the quiet seed bridge.
 * Native HTML5 DnD cannot carry a synthetic DataTransfer in Chrome demos,
 * so we paint the same opacity / drop-indicator classes the product uses.
 */
async function demonstrateTabReorder(
  ctx: DemoActionContext,
  fromIndex: number,
  toIndex: number,
): Promise<void> {
  const source = getTabByIndex(fromIndex);
  const target = getTabByIndex(toIndex);
  if (!source || !target || fromIndex === toIndex) return;

  const labels = getTabLabels();
  if (labels.length < 2 || fromIndex >= labels.length || toIndex >= labels.length) return;

  // 1) Look at the source tab (steady hold — not a flash)
  await spotlightHold(ctx, source, HOLD.look);

  source.classList.add('ws-conn-tab-dragging');
  await spotlightHold(ctx, source, HOLD.beat);

  const dropClass = fromIndex < toIndex ? 'ws-conn-tab-drop-after' : 'ws-conn-tab-drop-before';
  target.classList.add(dropClass);
  // 2) Look at the drop target / indicator
  await spotlightHold(ctx, target, HOLD.outcome);

  const next = [...labels];
  const [moved] = next.splice(fromIndex, 1);
  if (moved === undefined) {
    source.classList.remove('ws-conn-tab-dragging');
    target.classList.remove('ws-conn-tab-drop-before', 'ws-conn-tab-drop-after');
    return;
  }
  next.splice(toIndex, 0, moved);

  source.classList.remove('ws-conn-tab-dragging');
  target.classList.remove('ws-conn-tab-drop-before', 'ws-conn-tab-drop-after');
  seedWsConnectionTabsQuiet(next);
  await ctx.delay(400);
  // 3) Outcome — tab now at its new index
  const landed = findTabByLabel(moved) ?? getTabByIndex(toIndex);
  await spotlightHold(ctx, landed, HOLD.outcome);
}

/** Select Bearer auth type (visible) and return whether it succeeded. */
async function selectBearerAuthVisible(ctx: DemoActionContext): Promise<void> {
  await ctx.click(WS.LEFT_TAB_AUTH);
  await ctx.waitFor(WS.AUTH_TYPE_TRIGGER);
  await ctx.delay(500);

  const sel = firstVisibleEl<HTMLSelectElement>(WS.AUTH_TYPE_DROPDOWN);
  if (sel?.value === 'bearer') return;

  const trigger = firstVisibleEl<HTMLElement>(WS.AUTH_TYPE_TRIGGER);
  if (trigger) {
    await ctx.click(WS.AUTH_TYPE_TRIGGER);
    await ctx.delay(400);
    try {
      await ctx.waitFor(WS.authTypeOpt('bearer'), 2000);
      await ctx.click(WS.authTypeOpt('bearer'));
      await ctx.delay(500);
      return;
    } catch {
      /* fall through to selectOption */
    }
  }
  if (sel) {
    await ctx.selectOption(WS.AUTH_TYPE_DROPDOWN, 'bearer');
    await ctx.delay(400);
  }
}

/**
 * Ensure exactly 3 named tabs exist: Server A, Server B, Staging.
 * Prefer the quiet seed bridge (no + Add / F2 flash). Falls back to DOM
 * rename only when the bridge is unavailable (unit tests / early mount).
 */
async function ensureThreeNamedTabs(ctx: DemoActionContext, paceMs = 40): Promise<void> {
  if (seedWsConnectionTabsQuiet([...POWER_USER_TAB_LABELS])) {
    await ctx.delay(80);
    return;
  }
  // Fallback — quiet DOM path (tests without the studio bridge)
  await closeExtraConnectionTabs(ctx);
  await ctx.delay(40);
  const count = document.querySelectorAll(`${WS.CONN_TAB_BAR} [role="tab"]`).length;
  for (let i = count; i < 3; i++) {
    firstVisibleEl<HTMLElement>(WS.CONN_TAB_ADD)?.click();
    await ctx.delay(paceMs);
  }
  await renameTabByIndex(ctx, 0, 'Server A', paceMs);
  await renameTabByIndex(ctx, 1, 'Server B', paceMs);
  await renameTabByIndex(ctx, 2, 'Staging', paceMs);
  firstVisibleEl<HTMLElement>(WS.CONN_TAB_FIRST)?.click();
  await ctx.delay(40);
}

function threeNamedTabsReady(): boolean {
  const labels = Array.from(
    document.querySelectorAll(`${WS.CONN_TAB_BAR} [role="tab"] .ws-conn-tab-label`),
  ).map((el) => el.textContent?.trim());
  return labels.length >= 3
    && labels[0] === POWER_USER_TAB_LABELS[0]
    && labels[1] === POWER_USER_TAB_LABELS[1]
    && labels[2] === POWER_USER_TAB_LABELS[2];
}

// ── Setup / Cleanup ─────────────────────────────────────────────

/**
 * Quiet setup — REST mock + three named tabs via seed bridge (no tab-bar flash).
 * Must not open Mock mode or run add/rename tours while Live is visible.
 */
async function powerUserSetup(ctx: DemoActionContext): Promise<void> {
  const dcBtn = firstVisibleElement<HTMLButtonElement>(WS.DISCONNECT_BTN);
  if (dcBtn && !dcBtn.disabled) {
    dcBtn.click();
    await ctx.delay(40);
  }
  await startMockServerQuiet(ctx, 9876);
  await switchToClientModeQuiet(ctx);
  await ensureThreeNamedTabs(ctx, 40);
  const eventsTab = firstVisibleElement<HTMLElement>(WS.RIGHT_TAB_EVENTS);
  if (eventsTab?.getAttribute('aria-selected') !== 'true') {
    eventsTab?.click();
    await ctx.delay(40);
  }
}

async function powerUserCleanup(ctx: DemoActionContext): Promise<void> {
  await closeExtraConnectionTabs(ctx);
  await disconnectWebSocket(ctx);
  await clearEvents(ctx);
  await stopMockServerQuiet(ctx, 9876);
  await switchToClientModeQuiet(ctx);
}

// ── Lesson ──────────────────────────────────────────────────────

export const wsPowerUserLesson: DemoLesson = {
  id: 'ws-power-user',
  domainId: 'protocols',
  category: 'websocket',
  name: 'Power User: Tabs & Keyboard',
  description: 'Master tab drag-reorder, keyboard shortcuts, and per-tab persistence for a keyboard-first workflow.',
  estimatedMinutes: 6,
  initialTab: 'websocket-studio',
  // Teach the real tab bar — never add/rename a temporary "demo" tab at start.
  skipStudioTabIsolation: true,

  setup: powerUserSetup,
  cleanup: powerUserCleanup,

  concept: {
    title: 'Power User: Tabs & Keyboard',
    body: `Lesson 4 covered the basics — add, switch, rename, close. This lesson goes deeper into the features that make tab management fast and keyboard-first.

**Drag to Reorder**

Grab any connection tab and drag it to a new position. While dragging, the source tab fades and drop indicators appear to show where the tab will land. Tab order is saved automatically.

**Keyboard Shortcuts**

| Shortcut | Action |
|---|---|
| **← / →** | Move focus between tabs (wraps around) |
| **Home / End** | Jump to first / last tab |
| **Enter / Space** | Activate focused tab |
| **F2** | Start inline rename |
| **Delete** | Close focused tab |
| **Double-click** | Start rename |
| **Middle-click** | Close tab |

**Per-Tab Persistence**

Each connection tab remembers its own state independently:
- **Auth settings** — Bearer tokens, API keys, etc. stay with their tab
- **Shell tabs** — Tab 1 can be on Console while Tab 2 is on Events
- **URL & draft** — each tab has its own URL field and connection draft

The split pane width is shared across all tabs (resizing affects all). Shell tab selection (Connect/Auth/Events/Console) is per-tab.`,
    keyTerms: [
      { term: 'Roving Tabindex', definition: 'Only the active tab has tabIndex=0; arrow keys move focus between tabs without activating them.' },
      { term: 'Native DnD', definition: 'Tab reordering uses HTML5 drag-and-drop. The dragged tab fades (opacity) and drop indicators show before/after positions.' },
      { term: 'Per-Tab State', definition: 'Auth, URL draft, and shell tab selection (left/right pane) are stored independently for each connection tab.' },
    ],
    diagram: `<svg viewBox="0 0 480 248" xmlns="http://www.w3.org/2000/svg" style="font-family:system-ui,sans-serif;display:block">
  <defs>
    <linearGradient id="activeTabGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#4c3d8f"/>
      <stop offset="100%" stop-color="#312b5c"/>
    </linearGradient>
    <linearGradient id="keyGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#38365a"/>
      <stop offset="100%" stop-color="#26243e"/>
    </linearGradient>
    <filter id="keyShadow" x="-10%" y="-10%" width="120%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="1" flood-color="#0008"/>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="480" height="248" rx="10" fill="#181825"/>

  <!-- ══ Section 1: Tab Bar ══════════════════════════════════════ -->
  <rect x="12" y="12" width="456" height="44" rx="6" fill="#1e1e2e" stroke="#2e2e4a" stroke-width="1"/>

  <!-- Active tab: Server A -->
  <rect x="18" y="17" width="112" height="34" rx="5" fill="url(#activeTabGrad)" stroke="#7c3aed" stroke-width="1.5"/>
  <!-- Bottom accent line -->
  <rect x="18" y="48" width="112" height="3" rx="1" fill="#7c3aed"/>
  <circle cx="30" cy="34" r="4.5" fill="#22c55e"/>
  <text x="40" y="38" fill="#e2e0f0" font-size="11.5" font-weight="600">Server A</text>
  <!-- Keyboard focus ring -->
  <rect x="17" y="16" width="114" height="36" rx="6" fill="none" stroke="#a78bfa" stroke-width="1" stroke-dasharray="3,3" opacity="0.6"/>

  <!-- Tab: Server B -->
  <rect x="136" y="17" width="112" height="34" rx="5" fill="#242438" stroke="#35354f" stroke-width="1"/>
  <circle cx="148" cy="34" r="4.5" fill="#6b7280"/>
  <text x="158" y="38" fill="#7d7d9e" font-size="11.5">Server B</text>

  <!-- Tab: Staging -->
  <rect x="254" y="17" width="100" height="34" rx="5" fill="#242438" stroke="#35354f" stroke-width="1"/>
  <circle cx="266" cy="34" r="4.5" fill="#6b7280"/>
  <text x="276" y="38" fill="#7d7d9e" font-size="11.5">Staging</text>

  <!-- Add button -->
  <rect x="362" y="20" width="28" height="28" rx="5" fill="#2e2e48" stroke="#45455f" stroke-width="1"/>
  <text x="369" y="38" fill="#a78bfa" font-size="17" font-weight="200">+</text>

  <!-- Focus annotation -->
  <text x="400" y="31" fill="#6d5fe6" font-size="9" font-weight="600">FOCUSED</text>
  <text x="400" y="43" fill="#6d5fe6" font-size="9" opacity="0.7">tabIndex=0</text>

  <!-- ══ Section 2: Keyboard shortcuts (left) + Per-tab state (right) ══ -->

  <!-- Left panel: Keyboard shortcuts -->
  <rect x="12" y="64" width="222" height="116" rx="6" fill="#1e1e2e" stroke="#2e2e4a" stroke-width="1"/>
  <text x="20" y="80" fill="#6d5fe6" font-size="9" font-weight="700" letter-spacing="1">KEYBOARD SHORTCUTS</text>

  <!-- Row: ← → -->
  <!-- Left key -->
  <rect x="20" y="87" width="26" height="22" rx="4" fill="url(#keyGrad)" stroke="#4a4a6a" stroke-width="1" filter="url(#keyShadow)"/>
  <rect x="20" y="87" width="26" height="20" rx="4" fill="#38365a"/>
  <text x="28" y="103" fill="#c4b5fd" font-size="13">←</text>
  <!-- Right key -->
  <rect x="50" y="87" width="26" height="22" rx="4" fill="url(#keyGrad)" stroke="#4a4a6a" stroke-width="1" filter="url(#keyShadow)"/>
  <rect x="50" y="87" width="26" height="20" rx="4" fill="#38365a"/>
  <text x="58" y="103" fill="#c4b5fd" font-size="13">→</text>
  <text x="82" y="101" fill="#9ca3af" font-size="10">Move focus between tabs</text>

  <!-- Row: Home / End -->
  <rect x="20" y="115" width="40" height="22" rx="4" fill="url(#keyGrad)" stroke="#4a4a6a" stroke-width="1" filter="url(#keyShadow)"/>
  <rect x="20" y="115" width="40" height="20" rx="4" fill="#38365a"/>
  <text x="27" y="130" fill="#c4b5fd" font-size="9.5" font-weight="600">Home</text>
  <text x="82" y="129" fill="#9ca3af" font-size="10">Jump to first / last tab</text>

  <!-- Row: F2 -->
  <rect x="20" y="143" width="30" height="22" rx="4" fill="url(#keyGrad)" stroke="#4a4a6a" stroke-width="1" filter="url(#keyShadow)"/>
  <rect x="20" y="143" width="30" height="20" rx="4" fill="#1e3a4a"/>
  <text x="27" y="158" fill="#7dd3fc" font-size="10" font-weight="700">F2</text>
  <text x="56" y="157" fill="#9ca3af" font-size="10">Inline rename</text>

  <!-- Row: Delete -->
  <rect x="20" y="164" width="42" height="22" rx="4" fill="url(#keyGrad)" stroke="#4a4a6a" stroke-width="1" filter="url(#keyShadow)"/>
  <rect x="20" y="164" width="42" height="20" rx="4" fill="#3a1e2a"/>
  <text x="25" y="179" fill="#fca5a5" font-size="9.5" font-weight="600">Delete</text>
  <text x="68" y="178" fill="#9ca3af" font-size="10">Close focused tab</text>

  <!-- Right panel: Per-tab state -->
  <rect x="242" y="64" width="226" height="116" rx="6" fill="#1e1e2e" stroke="#2e2e4a" stroke-width="1"/>
  <text x="250" y="80" fill="#6d5fe6" font-size="9" font-weight="700" letter-spacing="1">PER-TAB STATE</text>

  <!-- Table header -->
  <rect x="250" y="84" width="210" height="18" rx="3" fill="#252540"/>
  <text x="258" y="96" fill="#6b7280" font-size="9" font-weight="600">TAB</text>
  <text x="315" y="96" fill="#6b7280" font-size="9" font-weight="600">AUTH</text>
  <text x="393" y="96" fill="#6b7280" font-size="9" font-weight="600">SHELL</text>

  <!-- Row: Server A -->
  <rect x="250" y="104" width="210" height="20" rx="2" fill="#252545"/>
  <text x="258" y="118" fill="#a78bfa" font-size="10" font-weight="600">Server A</text>
  <rect x="307" y="107" width="60" height="14" rx="3" fill="#1a3a2a"/>
  <text x="312" y="118" fill="#4ade80" font-size="9">Bearer •••</text>
  <rect x="385" y="107" width="48" height="14" rx="3" fill="#1a2535"/>
  <text x="390" y="118" fill="#7dd3fc" font-size="9">Console</text>

  <!-- Row: Server B -->
  <rect x="250" y="126" width="210" height="20" rx="2" fill="#1e1e2e"/>
  <text x="258" y="140" fill="#a78bfa" font-size="10">Server B</text>
  <text x="315" y="140" fill="#6b7280" font-size="9">None</text>
  <rect x="385" y="129" width="44" height="14" rx="3" fill="#1a2535"/>
  <text x="390" y="140" fill="#7dd3fc" font-size="9">Events</text>

  <!-- Row: Staging -->
  <rect x="250" y="148" width="210" height="20" rx="2" fill="#252545"/>
  <text x="258" y="162" fill="#a78bfa" font-size="10">Staging</text>
  <rect x="307" y="151" width="54" height="14" rx="3" fill="#1a3530"/>
  <text x="312" y="162" fill="#34d399" font-size="9">API Key</text>
  <rect x="385" y="151" width="48" height="14" rx="3" fill="#1a2535"/>
  <text x="390" y="162" fill="#7dd3fc" font-size="9">Connect</text>

  <!-- Isolation icon -->
  <text x="250" y="176" fill="#6b7280" font-size="9" font-style="italic">Each tab stores state independently</text>

  <!-- ══ Section 3: Drag to Reorder ════════════════════════════ -->
  <rect x="12" y="188" width="456" height="50" rx="6" fill="#1e1e2e" stroke="#2e2e4a" stroke-width="1"/>
  <text x="20" y="203" fill="#6d5fe6" font-size="9" font-weight="700" letter-spacing="1">DRAG TO REORDER</text>

  <!-- Source tab (being dragged — faded) -->
  <rect x="20" y="208" width="96" height="24" rx="4" fill="#312b5c" stroke="#7c3aed" stroke-width="1.5" opacity="0.4"/>
  <circle cx="31" cy="220" r="3.5" fill="#22c55e" opacity="0.4"/>
  <text x="40" y="224" fill="#c4b5fd" font-size="10" opacity="0.45">Server A</text>
  <!-- Drag arrow -->
  <text x="122" y="224" fill="#7c3aed" font-size="16">›</text>
  <text x="134" y="224" fill="#7c3aed" font-size="16">›</text>

  <!-- Target tab (drop zone with left-edge indicator) -->
  <rect x="152" y="208" width="96" height="24" rx="4" fill="#242438" stroke="#45456a" stroke-width="1"/>
  <rect x="152" y="208" width="3" height="24" rx="1" fill="#a78bfa"/>
  <circle cx="163" cy="220" r="3.5" fill="#6b7280"/>
  <text x="172" y="224" fill="#7d7d9e" font-size="10">Server B</text>

  <!-- After-drop result -->
  <text x="258" y="218" fill="#3a3a5a" font-size="18">→</text>
  <rect x="276" y="208" width="96" height="24" rx="4" fill="#312b5c" stroke="#7c3aed" stroke-width="1.5"/>
  <circle cx="287" cy="220" r="3.5" fill="#22c55e"/>
  <text x="296" y="224" fill="#e2e0f0" font-size="10">Server A</text>
  <rect x="378" y="208" width="80" height="24" rx="4" fill="#242438" stroke="#45456a" stroke-width="1"/>
  <circle cx="389" cy="220" r="3.5" fill="#6b7280"/>
  <text x="398" y="224" fill="#7d7d9e" font-size="10">Server B</text>

  <!-- Saved badge -->
  <rect x="380" y="189" width="80" height="16" rx="3" fill="#14532d" opacity="0.8"/>
  <text x="388" y="200" fill="#4ade80" font-size="9">✓ Order saved</text>
</svg>`,
  },

  steps: [
    // ── 1. Three Tabs Ready ─────────────────────────────────
    {
      id: 'pu-setup-tabs',
      title: 'Three Tabs Ready',
      description:
        'We start with three named tabs: **Server A**, **Server B**, and **Staging**. Watch us click through each one — every tab is its own workspace with its own URL draft and shell state. The active tab keeps `tabIndex=0` as the keyboard focus anchor.',
      highlight: WS.CONN_TAB_BAR,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        if (!threeNamedTabsReady()) {
          await ensureThreeNamedTabs(ctx, 40);
        }
      },
      action: async (ctx: DemoActionContext) => {
        await ctx.waitFor(WS.CONN_TAB_BAR);
        await ctx.delay(300);

        // Tour each tab: steady spotlight → pause → click (no flashing outline).
        const tabA = findTabByLabel('Server A') ?? getTabByIndex(0);
        await spotlightHold(ctx, tabA, HOLD.look);
        tabA?.click();
        await ctx.delay(HOLD.beat);

        const tabB = findTabByLabel('Server B') ?? getTabByIndex(1);
        await spotlightHold(ctx, tabB, HOLD.look);
        tabB?.click();
        await ctx.delay(HOLD.beat);

        const tabStaging = findTabByLabel('Staging') ?? getTabByIndex(2);
        await spotlightHold(ctx, tabStaging, HOLD.look);
        tabStaging?.click();
        await ctx.delay(HOLD.beat);

        const backToA = findTabByLabel('Server A') ?? getTabByIndex(0);
        await spotlightHold(ctx, backToA, HOLD.look);
        await ctx.click(WS.CONN_TAB_FIRST);
        await ctx.delay(HOLD.outcome);
      },
    },

    // ── 2. Drag to Reorder ──────────────────────────────────
    {
      id: 'pu-drag-reorder',
      title: 'Drag to Reorder',
      description:
        'Grab a tab and drag it to a new position. The demo **highlights Server A**, then holds on **Staging** with a drop indicator, then pauses on **Server A** in its new place. Order is saved automatically — you can drag any tab the same way.',
      highlight: WS.CONN_TAB_BAR,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        // Always restore canonical order so the drag demo is predictable.
        if (!threeNamedTabsReady()) {
          await ensureThreeNamedTabs(ctx, 40);
        } else {
          // Reseed if a prior drag left tabs out of order.
          const labels = getTabLabels();
          if (labels[0] !== 'Server A' || labels[1] !== 'Server B' || labels[2] !== 'Staging') {
            await ensureThreeNamedTabs(ctx, 40);
          }
        }
      },
      action: async (ctx: DemoActionContext) => {
        // Move Server A (0) to the end (index 2) with visible drag feedback.
        await demonstrateTabReorder(ctx, 0, 2);
      },
    },

    // ── 3. Arrow Key Navigation ─────────────────────────────
    {
      id: 'pu-kbd-arrow',
      title: 'Arrow Key Navigation',
      description:
        'With a tab focused, press **→** to move focus to the next tab (and **←** for the previous). Arrow keys move **focus only** — the active tab does not change until you press **Enter** or **Space**. Watch the steady highlight pause on each tab, then Enter activate it.',
      highlight: WS.CONN_TAB_BAR,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        if (!threeNamedTabsReady()) {
          await ensureThreeNamedTabs(ctx, 40);
        }
        // Start from the first tab so arrow navigation is easy to follow.
        await ctx.click(WS.CONN_TAB_FIRST);
        await ctx.delay(200);
      },
      action: async (ctx: DemoActionContext) => {
        const tab1 = getTabByIndex(0);
        if (!tab1) return;

        // Hold focus on Server A, then ArrowRight moves the ring to the next tab.
        focusTabVisible(tab1);
        await spotlightHold(ctx, tab1, HOLD.look);
        dispatchDemoKey(tab1, 'ArrowRight');
        await ctx.delay(HOLD.beat);

        const tab2 = getTabByIndex(1) ?? tab1;
        focusTabVisible(tab2);
        await spotlightHold(ctx, tab2, HOLD.look);
        dispatchDemoKey(tab2, 'Enter');
        await spotlightHold(ctx, tab2, HOLD.outcome);

        // Arrow again → Enter activates the third tab.
        dispatchDemoKey(tab2, 'ArrowRight');
        await ctx.delay(HOLD.beat);
        const tab3 = getTabByIndex(2) ?? tab2;
        focusTabVisible(tab3);
        await spotlightHold(ctx, tab3, HOLD.look);
        dispatchDemoKey(tab3, 'Enter');
        await spotlightHold(ctx, tab3, HOLD.outcome);
      },
    },

    // ── 4. F2 to Rename ─────────────────────────────────────
    {
      id: 'pu-kbd-rename',
      title: 'F2 to Rename',
      description:
        'Press **F2** on the focused tab to enter inline rename mode. Watch the label turn into an input — we type **Production** and press **Enter** to commit. **Escape** cancels; **double-click** also starts rename.',
      highlight: WS.CONN_TAB_BAR,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        const tabs = document.querySelectorAll(`${WS.CONN_TAB_BAR} [role="tab"]`);
        if (tabs.length < 1) {
          await ensureThreeNamedTabs(ctx, 40);
        }
      },
      action: async (ctx: DemoActionContext) => {
        const tabs = document.querySelectorAll(`${WS.CONN_TAB_BAR} [role="tab"]`);
        if (tabs.length > 0) {
          // Slower pacing so F2 → empty field → typed name → Enter is watchable.
          await renameTabByIndex(ctx, tabs.length - 1, 'Production', 550);
        }
      },
    },

    // ── 5. Delete to Close ──────────────────────────────────
    {
      id: 'pu-kbd-delete',
      title: 'Delete to Close',
      description:
        'Press **Delete** on the focused tab to close it. Watch **Server B** disappear — focus moves to a neighbor automatically. Connected tabs ask for confirmation first; ours are idle so the close is instant.',
      highlight: WS.CONN_TAB_BAR,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        const hasSvrB = !!findTabByLabel('Server B');
        if (!hasSvrB) {
          await ctx.click(WS.CONN_TAB_ADD);
          await ctx.delay(400);
          const newTabs = document.querySelectorAll(`${WS.CONN_TAB_BAR} [role="tab"]`);
          await renameTabByIndex(ctx, newTabs.length - 1, 'Server B', 200);
        }
      },
      action: async (ctx: DemoActionContext) => {
        const svrBTab = findTabByLabel('Server B');
        if (!svrBTab) return;
        await pressKeyOnTab(ctx, 'Delete', svrBTab, { paceMs: 450, spotlight: true });
        // Outcome — remaining tab bar after close
        const bar = firstVisibleElement<HTMLElement>(WS.CONN_TAB_BAR);
        await spotlightHold(ctx, bar, HOLD.outcome);
      },
    },

    // ── 6. Auth Persists per Tab ─────────────────────────────
    {
      id: 'pu-auth-persist',
      title: 'Auth Persists per Tab',
      description:
        'Each connection tab stores its own auth draft. On **Server A** we open **Auth**, pick **Bearer**, and paste a demo token. Switch to another tab — its Auth panel is still empty. Switch back — Server A\'s token is still there.',
      highlight: WS.AUTH_PANEL,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        const tabs = document.querySelectorAll(`${WS.CONN_TAB_BAR} [role="tab"]`);
        if (tabs.length < 2) {
          await ctx.click(WS.CONN_TAB_ADD);
          await ctx.delay(400);
        }
        await ctx.click(WS.CONN_TAB_FIRST);
        await ctx.delay(200);
        await ctx.click(WS.LEFT_TAB_CONNECT);
        await ctx.delay(200);
      },
      action: async (ctx: DemoActionContext) => {
        const tabA = findTabByLabel('Server A') ?? getTabByIndex(0);
        await spotlightHold(ctx, tabA, HOLD.look);

        await selectBearerAuthVisible(ctx);
        const authTrigger = firstVisibleElement<HTMLElement>(WS.AUTH_TYPE_TRIGGER);
        await spotlightHold(ctx, authTrigger, HOLD.look);

        const tokenInput = firstVisibleElement<HTMLElement>(WS.AUTH_PANE_INPUTS);
        await spotlightHold(ctx, tokenInput, HOLD.beat);
        await ctx.fill(WS.AUTH_PANE_INPUTS, DEMO_BEARER_TOKEN);
        await spotlightHold(ctx, tokenInput ?? firstVisibleElement<HTMLElement>(WS.AUTH_PANEL), HOLD.outcome);

        // Other tab — Auth should not show Server A's token.
        const tabs = document.querySelectorAll(`${WS.CONN_TAB_BAR} [role="tab"]`);
        if (tabs.length >= 2) {
          const other = tabs[tabs.length - 1] as HTMLElement;
          await spotlightHold(ctx, other, HOLD.look);
          other.click();
          await ctx.delay(HOLD.beat);
          await ctx.click(WS.LEFT_TAB_AUTH);
          await spotlightHold(ctx, firstVisibleElement<HTMLElement>(WS.AUTH_PANEL), HOLD.outcome);
        }

        // Back to Server A — token still present.
        await spotlightHold(ctx, findTabByLabel('Server A') ?? getTabByIndex(0), HOLD.look);
        await ctx.click(WS.CONN_TAB_FIRST);
        await ctx.delay(HOLD.beat);
        await ctx.click(WS.LEFT_TAB_AUTH);
        await spotlightHold(
          ctx,
          firstVisibleElement<HTMLElement>(WS.AUTH_PANE_INPUTS)
            ?? firstVisibleElement<HTMLElement>(WS.AUTH_PANEL),
          HOLD.outcome,
        );
      },
    },

    // ── 7. Shell Tabs Persist per Tab ────────────────────────
    {
      id: 'pu-pane-persist',
      title: 'Shell Tabs Persist per Tab',
      description:
        'Shell tabs (Connect / Auth / Events / Console) are remembered **per connection tab**. Watch: set **Server A** to **Console**, set the other tab to **Events**, then flip between them — each returns to its last shell tab.',
      highlight: WS.CONN_TAB_BAR,
      pauseAfter: true,
      verify: WS.RIGHT_TAB_EVENTS,
      preAction: async (ctx: DemoActionContext) => {
        const tabs = document.querySelectorAll(`${WS.CONN_TAB_BAR} [role="tab"]`);
        if (tabs.length < 2) {
          await ctx.click(WS.CONN_TAB_ADD);
          await ctx.delay(400);
        }
        // Quiet baseline: both tabs on Connect + Events so the action's switches are obvious.
        const allTabs = document.querySelectorAll(`${WS.CONN_TAB_BAR} [role="tab"]`);
        const lastTab = allTabs[allTabs.length - 1] as HTMLElement | null;
        if (lastTab) {
          lastTab.click();
          await ctx.delay(150);
          firstVisibleEl<HTMLElement>(WS.LEFT_TAB_CONNECT)?.click();
          firstVisibleEl<HTMLElement>(WS.RIGHT_TAB_EVENTS)?.click();
          await ctx.delay(120);
        }
        await ctx.click(WS.CONN_TAB_FIRST);
        await ctx.delay(150);
        firstVisibleEl<HTMLElement>(WS.LEFT_TAB_CONNECT)?.click();
        firstVisibleEl<HTMLElement>(WS.RIGHT_TAB_EVENTS)?.click();
        await ctx.delay(150);
      },
      action: async (ctx: DemoActionContext) => {
        // Server A → Console (spotlight each shell control, then hold the outcome)
        await spotlightHold(ctx, findTabByLabel('Server A') ?? getTabByIndex(0), HOLD.look);
        await ctx.click(WS.CONN_TAB_FIRST);
        await ctx.delay(HOLD.beat);
        const consoleTab = firstVisibleElement<HTMLElement>(WS.RIGHT_TAB_CONSOLE);
        await spotlightHold(ctx, consoleTab, HOLD.look);
        await ctx.click(WS.RIGHT_TAB_CONSOLE);
        await spotlightHold(ctx, consoleTab ?? firstVisibleElement<HTMLElement>(WS.RIGHT_TAB_CONSOLE), HOLD.outcome);

        // Other tab → Events
        const tabs = document.querySelectorAll(`${WS.CONN_TAB_BAR} [role="tab"]`);
        if (tabs.length >= 2) {
          const other = tabs[tabs.length - 1] as HTMLElement;
          await spotlightHold(ctx, other, HOLD.look);
          other.click();
          await ctx.delay(HOLD.beat);
          const eventsTab = firstVisibleElement<HTMLElement>(WS.RIGHT_TAB_EVENTS);
          await spotlightHold(ctx, eventsTab, HOLD.look);
          await ctx.click(WS.RIGHT_TAB_EVENTS);
          await spotlightHold(ctx, eventsTab ?? firstVisibleElement<HTMLElement>(WS.RIGHT_TAB_EVENTS), HOLD.outcome);
        }

        // Back to Server A — Console restored
        await spotlightHold(ctx, findTabByLabel('Server A') ?? getTabByIndex(0), HOLD.look);
        await ctx.click(WS.CONN_TAB_FIRST);
        await spotlightHold(ctx, firstVisibleElement<HTMLElement>(WS.RIGHT_TAB_CONSOLE), HOLD.outcome);

        // Other tab again — Events still selected
        const tabsAgain = document.querySelectorAll(`${WS.CONN_TAB_BAR} [role="tab"]`);
        if (tabsAgain.length >= 2) {
          const otherAgain = tabsAgain[tabsAgain.length - 1] as HTMLElement;
          await spotlightHold(ctx, otherAgain, HOLD.look);
          otherAgain.click();
          await spotlightHold(ctx, firstVisibleElement<HTMLElement>(WS.RIGHT_TAB_EVENTS), HOLD.outcome);
        }
      },
    },
  ],
};
