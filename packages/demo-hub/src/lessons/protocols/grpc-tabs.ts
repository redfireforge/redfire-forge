/**
 * GRPC-Tabs: Multi-Tab gRPC Calls
 *
 * 7 steps: tour tab bar → reflect on tab 1 → select method + fill → send →
 * add tab 2 → duplicate tab (gRPC unique) → close a tab.
 * Backfill lesson — gRPC has had full multi-tab with no lesson until now.
 */
import type { DemoLesson, DemoActionContext } from '../../types';
import { GRPC } from '@shared/selectors';
import {
  grpcFirstCallSetup,
  grpcFirstCallCleanup,
  closeExtraGrpcTabsQuiet,
  ensureGrpcStudioSubNavQuiet,
} from './grpc-lesson-helpers';
import { GRPC_DEMO_TARGET } from './grpc-lesson-helpers/constants';

const GRPC_TAB_SELECTOR = `${GRPC.TAB_BAR} [role="tab"]`;

function getGrpcTabCount(): number {
  return document.querySelectorAll(GRPC_TAB_SELECTOR).length;
}

async function switchToGrpcTab(ctx: DemoActionContext, index: number): Promise<void> {
  const tabs = document.querySelectorAll<HTMLElement>(GRPC_TAB_SELECTOR);
  const tab = tabs[index];
  if (tab && tab.getAttribute('aria-selected') !== 'true') {
    tab.click();
    await ctx.delay(300);
  }
}

export const grpcTabsLesson: DemoLesson = {
  id: 'grpc-tabs',
  domainId: 'protocols',
  category: 'grpc',
  name: 'Multi-Tab gRPC Calls',
  description:
    'Work with multiple gRPC method calls simultaneously. Each tab binds to its own method, ' +
    'request body, metadata, and streaming session — plus gRPC\'s unique Duplicate tab feature.',
  estimatedMinutes: 4,
  initialTab: 'grpc-studio',

  setup: async (ctx) => {
    await grpcFirstCallSetup(ctx, { resetSchemaDrafts: false });
  },

  cleanup: async (ctx) => {
    await closeExtraGrpcTabsQuiet(ctx);
    await grpcFirstCallCleanup(ctx);
  },

  concept: {
    title: 'Per-Tab Method Binding',
    body: `Each gRPC Studio tab is a **fully independent call workspace** — its own method binding, request body, metadata, auth, and streaming session.

**What you'll learn:**
- **Tab 1** connects to a server, reflects, selects a method, and sends a unary call
- **Add Tab 2** creates a fresh workspace — new method binding, empty request
- **Duplicate** clones an entire tab configuration for quick variations
- Switching tabs **preserves responses** — no re-execution needed

**Why per-tab matters for gRPC:**
Unlike REST where each request is a URL, gRPC binds to a **service + method** pair with a typed protobuf schema. Duplicating a tab lets you clone the method binding, tweak one field, and compare results — faster than configuring from scratch.

**Key facts:**
- Each tab stores: target, method, request body, metadata, auth, response
- **Duplicate** copies everything including filled request fields
- Closing a tab with an active stream **cancels the stream** automatically`,
    keyTerms: [
      { term: 'Method Binding', definition: 'Each tab is bound to a specific service/method pair from the reflected or loaded schema.' },
      { term: 'Duplicate Tab', definition: 'gRPC-specific feature: clone an entire configured tab (method + body + metadata) to tweak one parameter.' },
      { term: 'Per-Tab Response', definition: 'Each tab caches its own response — switching tabs restores the last result without re-sending.' },
    ],
    diagram: `<svg viewBox="0 0 400 120" xmlns="http://www.w3.org/2000/svg" style="font-family:system-ui,sans-serif">
  <rect x="0" y="0" width="400" height="120" rx="6" fill="#1e1e2e"/>
  <rect x="8" y="8" width="384" height="26" rx="4" fill="#2a2a3a"/>
  <rect x="12" y="11" width="130" height="20" rx="3" fill="#3a3a5a" stroke="#f59e0b" stroke-width="1.5"/>
  <text x="20" y="25" fill="#fbbf24" font-size="8" font-weight="bold">U</text>
  <text x="32" y="25" fill="#e0e0e0" font-size="9">Echo — Unary</text>
  <rect x="146" y="11" width="140" height="20" rx="3" fill="#2a2a3a" stroke="#444" stroke-width="1"/>
  <text x="154" y="25" fill="#f59e0b" font-size="8" font-weight="bold">U</text>
  <text x="166" y="25" fill="#bbb" font-size="9">Echo — Duplicate</text>
  <rect x="290" y="13" width="18" height="16" rx="3" fill="#3a3a5a"/>
  <text x="295" y="25" fill="#aaa" font-size="12">+</text>
  <rect x="8" y="42" width="186" height="68" rx="4" fill="#1a1a2e" stroke="#f59e0b" stroke-width="1"/>
  <text x="16" y="58" fill="#fbbf24" font-size="9" font-weight="bold">TAB 1 — echo.EchoService/Echo</text>
  <text x="16" y="74" fill="#888" font-size="8">Body: {"message": "Hello"}</text>
  <text x="16" y="90" fill="#22c55e" font-size="8">Response: OK — {"message": "Hello"}</text>
  <text x="16" y="104" fill="#555" font-size="7">Status: OK · 12ms</text>
  <rect x="202" y="42" width="190" height="68" rx="4" fill="#1a1a2e" stroke="#0ea5e9" stroke-width="1"/>
  <text x="210" y="58" fill="#7dd3fc" font-size="9" font-weight="bold">TAB 2 — echo.EchoService/Echo</text>
  <text x="210" y="74" fill="#888" font-size="8">Body: {"message": "World"}</text>
  <text x="210" y="90" fill="#22c55e" font-size="8">Response: OK — {"message": "World"}</text>
  <text x="210" y="104" fill="#555" font-size="7">Status: OK · 8ms</text>
</svg>`,
  },

  steps: [
    {
      id: 'grpc-tabs-intro',
      title: 'Your gRPC Tab Bar',
      description:
        'The **tab bar** at the top of gRPC Studio lets you work with multiple method calls simultaneously. ' +
        'Each tab is an independent workspace with its own method binding, request body, metadata, and response.\n\n' +
        'You can **drag tabs** to reorder them, **right-click** for a context menu, or use the **+** button to add new calls. ' +
        'gRPC also offers a unique **Duplicate** button to clone an entire configured tab.',
      highlight: GRPC.TAB_BAR,
      preAction: async (ctx) => {
        await ensureGrpcStudioSubNavQuiet(ctx);
      },
      pauseAfter: true,
    },

    {
      id: 'grpc-tabs-reflect',
      title: 'Tab 1 — Reflect and Select Method',
      description:
        'On **Tab 1**, set the target to `localhost:50051` and click **Reflect** to discover available services. ' +
        'Then select **echo.EchoService/Echo** — a unary RPC. The tab now has a **method binding** that stays ' +
        'with this tab even when you switch to another.',
      highlight: GRPC.REFLECT_BTN,
      preAction: async (ctx) => {
        await ensureGrpcStudioSubNavQuiet(ctx);
        await switchToGrpcTab(ctx, 0);
      },
      action: async (ctx) => {
        await ctx.fill(GRPC.TARGET_INPUT, GRPC_DEMO_TARGET);
        await ctx.delay(500);
        await ctx.click(GRPC.REFLECT_BTN);
        await ctx.waitFor(GRPC.EXPLORER_TREE, 5000);
        await ctx.delay(1000);
        const echoSel = GRPC.METHOD('echo.EchoService', 'Echo');
        await ctx.click(echoSel);
        await ctx.delay(600);
      },
      verify: GRPC.REQUEST_TAB_FORM,
      pauseAfter: true,
    },

    {
      id: 'grpc-tabs-send',
      title: 'Fill Request and Send',
      description:
        'Enter `Hello from Tab 1` in the message field and click **Send Unary**. ' +
        'The response appears in the right panel — this response is **cached in Tab 1** and will ' +
        'persist when you switch to another tab.',
      highlight: GRPC.SEND_BTN,
      preAction: async (ctx) => {
        await ensureGrpcStudioSubNavQuiet(ctx);
        await switchToGrpcTab(ctx, 0);
      },
      action: async (ctx) => {
        await ctx.click(GRPC.REQUEST_TAB_FORM);
        await ctx.delay(400);
        await ctx.fill('.grpc-form-field input[type="text"]', 'Hello from Tab 1');
        await ctx.delay(500);
        await ctx.click(GRPC.SEND_BTN);
        await ctx.waitFor(GRPC.RESPONSE_BODY, 5000);
        await ctx.delay(1000);
      },
      verify: GRPC.RESPONSE_BODY,
      pauseAfter: true,
    },

    {
      id: 'grpc-tabs-add',
      title: 'Add Tab 2 — Fresh Workspace',
      description:
        'Click **+** to create a new tab. Tab 2 starts with a **clean slate** — no method binding, ' +
        'no request body, no cached response. Tab 1\'s method binding and response stay intact in memory.\n\n' +
        'Each new tab inherits the current target but nothing else — you pick its method independently.',
      highlight: GRPC.ADD_TAB,
      preAction: async (ctx) => {
        await ensureGrpcStudioSubNavQuiet(ctx);
      },
      action: async (ctx) => {
        if (getGrpcTabCount() < 2) {
          await ctx.click(GRPC.ADD_TAB);
          await ctx.delay(800);
        }
      },
      pauseAfter: true,
    },

    {
      id: 'grpc-tabs-duplicate',
      title: 'Duplicate Tab — Clone a Configured Call',
      description:
        'Switch back to **Tab 1** and click the **duplicate** icon on its tab. A new tab appears with ' +
        'the **exact same method binding, request body, and metadata** — ready for you to tweak one field ' +
        'and compare results.\n\n' +
        'This is gRPC\'s unique advantage over starting from scratch: duplicating a complex protobuf ' +
        'request with nested fields saves significant configuration time.',
      highlight: GRPC.TAB_BAR,
      preAction: async (ctx) => {
        await ensureGrpcStudioSubNavQuiet(ctx);
        await switchToGrpcTab(ctx, 0);
      },
      action: async (ctx) => {
        const tabs = document.querySelectorAll<HTMLElement>(GRPC_TAB_SELECTOR);
        const firstTab = tabs[0];
        if (!firstTab) return;
        const tabId = firstTab.getAttribute('data-testid') ?? '';
        const dupBtn = document.querySelector<HTMLElement>(`[data-testid="grpc-tab-duplicate-${tabId}"]`);
        if (dupBtn) {
          dupBtn.setAttribute('data-lesson-target', 'grpc-tabs-dup');
          await ctx.click('[data-lesson-target="grpc-tabs-dup"]');
          await ctx.delay(1000);
        }
      },
      pauseAfter: true,
    },

    {
      id: 'grpc-tabs-switch',
      title: 'Switch Tabs — Responses Persist',
      description:
        'Click through your tabs — each one restores its cached response instantly. ' +
        'Tab 1\'s Echo response, the duplicated tab\'s cloned state, and Tab 2\'s empty workspace ' +
        'all stay independent.\n\n' +
        'This makes side-by-side comparison practical: send with one parameter on Tab 1, ' +
        'tweak the duplicate, send again, and compare without re-running anything.',
      highlight: GRPC.TAB_BAR,
      preAction: async (ctx) => {
        await ensureGrpcStudioSubNavQuiet(ctx);
      },
      action: async (ctx) => {
        const tabCount = getGrpcTabCount();
        if (tabCount >= 2) {
          await switchToGrpcTab(ctx, 0);
          await ctx.delay(800);
          await switchToGrpcTab(ctx, 1);
          await ctx.delay(800);
          if (tabCount >= 3) {
            await switchToGrpcTab(ctx, 2);
            await ctx.delay(800);
          }
          await switchToGrpcTab(ctx, 0);
          await ctx.delay(400);
        }
      },
      pauseAfter: true,
    },

    {
      id: 'grpc-tabs-close',
      title: 'Close a Tab — Stream Cancelled',
      description:
        'Click **x** on any extra tab to close it. If a tab has an **active streaming session**, ' +
        'the stream is cancelled automatically — no orphaned RPC calls.\n\n' +
        'The remaining tabs and their responses are completely unaffected.',
      highlight: GRPC.TAB_BAR,
      preAction: async (ctx) => {
        await ensureGrpcStudioSubNavQuiet(ctx);
      },
      action: async (ctx) => {
        const tabs = document.querySelectorAll<HTMLElement>(GRPC_TAB_SELECTOR);
        if (tabs.length >= 2) {
          const lastTab = tabs[tabs.length - 1];
          const tabId = lastTab?.getAttribute('data-testid') ?? '';
          if (tabId) {
            const closeBtn = document.querySelector<HTMLElement>(`[data-testid="grpc-tab-close-${tabId}"]`);
            if (closeBtn) {
              closeBtn.click();
              await ctx.delay(600);
            }
          }
        }
      },
      pauseAfter: true,
    },
  ],
};
