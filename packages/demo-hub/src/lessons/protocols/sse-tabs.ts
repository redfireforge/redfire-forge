/**
 * SSE-Tabs: Multi-Connection SSE Tabs
 *
 * 6 steps: tour tab bar → connect tab 1 → add tab 2 → connect tab 2 →
 * switch tabs (per-tab event buffer isolation) → close a tab.
 * Mirrors ws-tabs.ts closely since SSE reuses the WS tab-bar pattern.
 * Requires the dev server's built-in /api/sse-test endpoint.
 */
import type { DemoActionContext, DemoLesson } from '../../types';
import { SSE } from '@shared/selectors';
import { closeExtraSseConnectionTabs } from '../setup-helpers';
import {
  ensureSseDemoHeaderContext,
  navigateToSseStudio,
} from '../env-manager-lesson-helpers';

const SSE_TAB_SELECTOR = `${SSE.CONN_TAB_BAR} ${SSE.CONN_TAB_ITEM}`;
const SSE_URL_1 = '{{sseUrl}}/api/sse-test';
const SSE_URL_2 = '{{sseUrl}}/api/sse-test?interval=3000';

function getSseTabCount(): number {
  return document.querySelectorAll(SSE_TAB_SELECTOR).length;
}

async function ensureTwoSseTabs(ctx: DemoActionContext): Promise<void> {
  if (getSseTabCount() < 2) {
    const addBtn = document.querySelector<HTMLElement>(SSE.CONN_TAB_ADD);
    if (addBtn) {
      addBtn.click();
      await ctx.delay(400);
    }
  }
}

async function switchToSseTab(ctx: DemoActionContext, index: number): Promise<void> {
  const tabs = document.querySelectorAll<HTMLElement>(SSE_TAB_SELECTOR);
  const tab = tabs[index];
  if (tab) {
    tab.click();
    await ctx.delay(300);
  }
}

async function disconnectSseIfConnected(ctx: DemoActionContext): Promise<void> {
  const connectBtn = document.querySelector<HTMLButtonElement>(SSE.CONNECT_BTN);
  if (connectBtn?.textContent?.includes('Disconnect')) {
    connectBtn.click();
    await ctx.delay(500);
  }
}

async function clearSseEvents(ctx: DemoActionContext): Promise<void> {
  const clearBtn = document.querySelector<HTMLButtonElement>(SSE.CLEAR_BTN);
  if (clearBtn && !clearBtn.disabled) {
    clearBtn.click();
    await ctx.delay(200);
  }
}

async function sseTabsSetup(ctx: DemoActionContext): Promise<void> {
  await ctx.delay(300);
  await disconnectSseIfConnected(ctx);
  await closeExtraSseConnectionTabs(ctx);
  await clearSseEvents(ctx);
  await ensureSseDemoHeaderContext(ctx);
  await navigateToSseStudio(ctx);
  const connectTab = document.querySelector<HTMLElement>(SSE.LEFT_TAB_CONNECT);
  if (connectTab) {
    connectTab.click();
    await ctx.delay(200);
  }
}

async function sseTabsCleanup(ctx: DemoActionContext): Promise<void> {
  // Quiet teardown only — Exit → Contents pins navigateToTab to demo-hub, so
  // do not force a Studio/header tour here (that was the Contents-page flash).
  await disconnectSseIfConnected(ctx);
  await closeExtraSseConnectionTabs(ctx);
  await clearSseEvents(ctx);
}

export const sseTabsLesson: DemoLesson = {
  id: 'sse-tabs',
  domainId: 'protocols',
  category: 'sse',
  name: 'Multi-Connection SSE Tabs',
  description:
    'Run two SSE streams simultaneously in separate tabs — each with its own URL, ' +
    'connection state, and event buffer. Watch events flow independently and learn per-tab isolation.',
  estimatedMinutes: 4,
  initialTab: 'sse-studio',

  setup: sseTabsSetup,
  cleanup: sseTabsCleanup,

  concept: {
    title: 'Multi-Tab SSE Streams',
    body: `RedfireForge lets you monitor **multiple SSE streams** simultaneously — each in its own tab with an **independent event buffer**.

**What you'll see in this lesson:**
- **Tab 1** connects to an SSE endpoint and receives live events
- **Tab 2** connects to a **different URL** with its own stream
- Both streams run simultaneously with **separate event logs**
- Switching tabs instantly restores that tab's buffered events — no data loss

**Why it matters:**
Real-world debugging often requires comparing event streams side by side — production vs staging, different event filters, or monitoring two microservices at once. Per-tab isolation gives you that without any configuration overlap.

**Key facts:**
- Each tab stores its own URL, connection state, and event buffer
- Closing a connected tab **automatically disconnects** the SSE stream
- Event filters and bookmarks are per-tab`,
    keyTerms: [
      { term: 'Per-Tab Buffer', definition: 'Each tab maintains its own event log — switching tabs preserves every event received on that connection.' },
      { term: 'Connection Isolation', definition: 'Tab 1 and Tab 2 connect to different URLs and cannot see each other\'s events.' },
      { term: 'Auto-Disconnect', definition: 'Closing a tab automatically terminates its SSE connection — no orphaned streams.' },
    ],
    diagram: `<svg viewBox="0 0 400 140" xmlns="http://www.w3.org/2000/svg" style="font-family:system-ui,sans-serif">
  <rect x="0" y="0" width="400" height="140" rx="6" fill="#1e1e2e"/>
  <rect x="8" y="8" width="384" height="26" rx="4" fill="#2a2a3a"/>
  <rect x="12" y="11" width="110" height="20" rx="3" fill="#3a3a5a" stroke="#10b981" stroke-width="1.5"/>
  <circle cx="22" cy="21" r="3.5" fill="#22c55e"/>
  <text x="30" y="25" fill="#e0e0e0" font-size="10">Tab 1 — /sse-test</text>
  <rect x="126" y="11" width="120" height="20" rx="3" fill="#2a2a3a" stroke="#444" stroke-width="1"/>
  <circle cx="136" cy="21" r="3.5" fill="#22c55e"/>
  <text x="144" y="25" fill="#bbb" font-size="10">Tab 2 — /sse-alt</text>
  <rect x="250" y="13" width="18" height="16" rx="3" fill="#3a3a5a"/>
  <text x="255" y="25" fill="#aaa" font-size="12">+</text>
  <rect x="8" y="42" width="186" height="88" rx="4" fill="#1a1a2e" stroke="#10b981" stroke-width="1"/>
  <text x="16" y="58" fill="#6ee7b7" font-size="9" font-weight="bold">TAB 1 — Events</text>
  <text x="16" y="74" fill="#888" font-size="8">event: update  id: 42</text>
  <text x="16" y="88" fill="#888" font-size="8">event: status  id: 43</text>
  <text x="16" y="102" fill="#888" font-size="8">event: message id: 44</text>
  <text x="16" y="120" fill="#555" font-size="7">3 events · Connected</text>
  <rect x="202" y="42" width="190" height="88" rx="4" fill="#1a1a2e" stroke="#0ea5e9" stroke-width="1"/>
  <text x="210" y="58" fill="#7dd3fc" font-size="9" font-weight="bold">TAB 2 — Events</text>
  <text x="210" y="74" fill="#888" font-size="8">event: heartbeat id: 1</text>
  <text x="210" y="88" fill="#888" font-size="8">event: heartbeat id: 2</text>
  <text x="210" y="102" fill="#888" font-size="8">event: heartbeat id: 3</text>
  <text x="210" y="120" fill="#555" font-size="7">3 events · Connected</text>
</svg>`,
  },

  steps: [
    {
      id: 'sse-tabs-intro',
      title: 'Your SSE Connection Tab Bar',
      description:
        'Look at the **tab bar** above the SSE workspace. Each tab is an independent SSE connection — ' +
        'its own URL, connection state, and event buffer. Tab 1 is ready for you to connect.\n\n' +
        'You can **drag tabs** to reorder them, **right-click** for a context menu, or use the **+** button to add new connections.',
      highlight: SSE.CONN_TAB_BAR,
      preAction: async (ctx) => {
        await ensureSseDemoHeaderContext(ctx);
        await navigateToSseStudio(ctx);
        await ctx.delay(300);
      },
      pauseAfter: true,
    },

    {
      id: 'sse-tabs-connect1',
      title: 'Tab 1 — Connect to SSE Stream',
      description:
        'On **Tab 1**, enter the SSE URL `{{sseUrl}}/api/sse-test` and click **Connect**. ' +
        'Events will start flowing in real time — each event shows its type badge, ' +
        'timestamp, and payload.',
      highlight: SSE.CONNECT_BTN,
      preAction: async (ctx) => {
        await ensureSseDemoHeaderContext(ctx);
        await navigateToSseStudio(ctx);
        await switchToSseTab(ctx, 0);
        const connectTab = document.querySelector<HTMLElement>(SSE.LEFT_TAB_CONNECT);
        if (connectTab) { connectTab.click(); await ctx.delay(200); }
      },
      action: async (ctx) => {
        await ctx.fill(SSE.URL_INPUT, SSE_URL_1);
        await ctx.delay(500);
        await ctx.click(SSE.CONNECT_BTN);
        await ctx.delay(1500);
        await ctx.click(SSE.RIGHT_TAB_EVENTS);
        await ctx.delay(800);
      },
      verify: SSE.EVENT_ROW,
      pauseAfter: true,
    },

    {
      id: 'sse-tabs-add',
      title: 'Add Tab 2 — Fresh Workspace',
      description:
        'Click **+** to create a second tab. Tab 2 starts with a **clean slate** — no events, ' +
        'no connection, no URL. Tab 1\'s stream continues running in the background, ' +
        'buffering events even while you\'re on Tab 2.',
      highlight: SSE.CONN_TAB_ADD,
      preAction: async (ctx) => {
        await ensureSseDemoHeaderContext(ctx);
        await navigateToSseStudio(ctx);
        if (getSseTabCount() >= 2) return;
        await switchToSseTab(ctx, 0);
      },
      action: async (ctx) => {
        if (getSseTabCount() < 2) {
          await ctx.delay(300);
          await ctx.click(SSE.CONN_TAB_ADD);
          await ctx.delay(600);
        }
      },
      pauseAfter: true,
    },

    {
      id: 'sse-tabs-connect2',
      title: 'Tab 2 — Connect to a Different URL',
      description:
        'On **Tab 2**, enter a different URL — `{{sseUrl}}/api/sse-test?interval=3000`. ' +
        'Click **Connect** to start a second SSE stream. Both tabs are now **green** ' +
        'but receiving **completely separate event streams**.',
      highlight: SSE.CONNECT_BTN,
      preAction: async (ctx) => {
        await ensureSseDemoHeaderContext(ctx);
        await navigateToSseStudio(ctx);
        await ensureTwoSseTabs(ctx);
        await switchToSseTab(ctx, 1);
        const connectTab = document.querySelector<HTMLElement>(SSE.LEFT_TAB_CONNECT);
        if (connectTab) { connectTab.click(); await ctx.delay(200); }
      },
      action: async (ctx) => {
        await ctx.fill(SSE.URL_INPUT, SSE_URL_2);
        await ctx.delay(500);
        await ctx.click(SSE.CONNECT_BTN);
        await ctx.delay(1500);
        await ctx.click(SSE.RIGHT_TAB_EVENTS);
        await ctx.delay(800);
      },
      verify: SSE.EVENT_ROW,
      pauseAfter: true,
    },

    {
      id: 'sse-tabs-switch',
      title: 'Switch Tabs — Buffers Are Isolated',
      description:
        'Click **Tab 1** — its buffered events are restored instantly from memory. Tab 2\'s events ' +
        'stay in their own buffer. Switch back to Tab 2 and confirm: **zero cross-contamination**.\n\n' +
        'This per-tab isolation means you can compare production vs staging SSE streams side by side ' +
        'without any interference.',
      highlight: SSE.CONN_TAB_BAR,
      preAction: async (ctx) => {
        await navigateToSseStudio(ctx);
        await ensureTwoSseTabs(ctx);
      },
      action: async (ctx) => {
        await switchToSseTab(ctx, 0);
        await ctx.click(SSE.RIGHT_TAB_EVENTS);
        await ctx.delay(1000);
        await switchToSseTab(ctx, 1);
        await ctx.click(SSE.RIGHT_TAB_EVENTS);
        await ctx.delay(1000);
      },
      pauseAfter: true,
    },

    {
      id: 'sse-tabs-close',
      title: 'Close a Tab — Stream Disconnects',
      description:
        'Click **x** on Tab 2 to close it. The SSE stream disconnects automatically — ' +
        'no orphaned connections. Tab 1 and its event buffer are completely unaffected.\n\n' +
        'Connected tabs show a **confirmation prompt** before closing to prevent accidental disconnects.',
      highlight: SSE.CONN_TAB_BAR,
      preAction: async (ctx) => {
        await navigateToSseStudio(ctx);
        await ensureTwoSseTabs(ctx);
        await switchToSseTab(ctx, 1);
        await disconnectSseIfConnected(ctx);
        await switchToSseTab(ctx, 0);
        await ctx.delay(200);
      },
      action: async (ctx) => {
        const tabs = document.querySelectorAll<HTMLElement>(SSE_TAB_SELECTOR);
        if (tabs.length >= 2) {
          const lastTab = tabs[tabs.length - 1];
          const closeBtn = lastTab?.querySelector<HTMLElement>(SSE.CONN_TAB_CLOSE);
          if (closeBtn) {
            closeBtn.click();
            await ctx.delay(600);
          }
        }
      },
      pauseAfter: true,
    },
  ],
};
