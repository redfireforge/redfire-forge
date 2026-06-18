/**
 * Lesson 15: Reliability — Auto-Reconnect & Stats
 *
 * Demonstrates the features that keep WebSocket connections healthy:
 *  - Stats tab with live msg/s sparkline, bytes, and frame types
 *  - Auto-reconnect settings (max attempts, interval, backoff)
 *  - Close with code/reason for controlled disconnects
 *  - URL history for quick reconnection
 *
 * No Docker required — uses the built-in mock echo server.
 */
import type { DemoActionContext, DemoLesson } from '../../types';
import { WS } from '../../../../shared/selectors';
import { wsSetup, wsCleanup, connectToMockServer, disconnectWebSocket } from '../setup-helpers';

// ── Constants ──────────────────────────────────────────────────
const MOCK_URL = 'ws://localhost:9876';

// ── Setup / Cleanup ─────────────────────────────────────────────

async function reliabilitySetup(ctx: DemoActionContext): Promise<void> {
  await ctx.delay(400);
  await wsSetup(ctx);
  await ctx.delay(200);
  // Clear stale subprotocols/protocol from previous lessons
  await ctx.click(WS.LEFT_TAB_CONNECT);
  await ctx.delay(200);
  await ctx.fill(WS.SUBPROTOCOLS_INPUT, '');
  await ctx.delay(200);
  await ctx.selectOption(WS.PROTOCOL_SELECT, 'raw');
  await ctx.delay(200);
}

async function reliabilityCleanup(ctx: DemoActionContext): Promise<void> {
  // Reset protocol/subprotocols before standard cleanup
  await ctx.click(WS.LEFT_TAB_CONNECT);
  await ctx.delay(200);
  await ctx.fill(WS.SUBPROTOCOLS_INPUT, '');
  await ctx.delay(200);
  await ctx.selectOption(WS.PROTOCOL_SELECT, 'raw');
  await ctx.delay(200);
  await wsCleanup(ctx);
}

// ── Lesson ──────────────────────────────────────────────────────

export const wsReliabilityLesson: DemoLesson = {
  id: 'ws-reliability',
  domainId: 'protocols',
  category: 'websocket',
  name: 'Auto-Reconnect & Stats',
  description: 'Monitor connection health with live stats, configure auto-reconnect, and use close-with-code for controlled disconnects.',
  estimatedMinutes: 3,
  initialTab: 'websocket-studio',

  setup: reliabilitySetup,
  cleanup: reliabilityCleanup,

  concept: {
    title: 'Reliability: Keeping Connections Healthy',
    body: `Production WebSocket connections drop — servers restart, networks hiccup, load balancers time out. RedfireForge has three features that help you stay resilient and informed.

**Stats Tab**

The **Stats** tab in the right panel shows live connection metrics:
- **Msg/s** with a 60-point sparkline that updates every second
- **Bytes In / Out** with per-second rates
- **Frame Types** — a segmented bar showing the mix of text, binary, and control frames

When the connection drops, rates go to zero and the sparkline flattens — instant visual feedback.

**Auto-Reconnect**

In the Connect panel, the **Auto-Reconnect Settings** section lets you configure what happens when a connection drops unexpectedly (close code ≠ 1000):
- **Max Attempts** — how many times to retry (1–50)
- **Retry Interval** — base delay between retries (500ms–60s)
- **Backoff Multiplier** — exponential backoff (1×, 1.5×, or 2×)

When active, a progress banner shows retry status with a cancel button.

**Close with Code**

The caret (▾) next to Disconnect opens a dropdown for sending a custom close frame. You pick a **close code** (1000 Normal, 1001 Going Away, etc.) and optional **reason string**. This is essential for testing how your server handles different disconnect scenarios.`,
    keyTerms: [
      {
        term: 'Close Code',
        definition: 'A numeric status code sent in the WebSocket close frame. 1000 = normal closure, 1001 = going away, 1006 = abnormal (no close frame). Only codes 1000 and 1001 are considered "clean" disconnects.',
      },
      {
        term: 'Auto-Reconnect',
        definition: 'Automatic retry logic that fires when a connection drops with a non-1000 close code. Configurable max attempts, retry interval, and exponential backoff.',
      },
      {
        term: 'Backoff Multiplier',
        definition: 'Each retry waits longer than the last: interval × multiplier^attempt. A 2× backoff with 3s base means retries at 3s, 6s, 12s, 24s — preventing thundering-herd reconnection storms.',
      },
      {
        term: 'Sparkline',
        definition: 'A small inline chart in the Stats tab that plots message throughput over the last 60 seconds. Useful for spotting traffic patterns and connection drops at a glance.',
      },
    ],
    diagram: `<pre>┌─────────────────────────────────────────────────────────┐
│  Connect Panel                                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │ URL: ws://localhost:9876                          │  │
│  │ [Connect]  [Disconnect ▾]  [Save as Profile]     │  │
│  │                                                   │  │
│  │ ● Connected  ws://localhost:9876  ↑3 ↓5  12ms    │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  Auto-Reconnect Settings                                │
│  ☑ Auto-reconnect on unexpected disconnect              │
│  Max Attempts: 5    Interval: 3000ms    Backoff: 2×     │
├──────────────────────────────────────────────────────────┤
│  Stats Tab                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ Msg/s    │ │ Bytes In │ │ Bytes Out│ │ Frames   │  │
│  │ 12.5/s   │ │ 4.2 KB   │ │ 1.1 KB  │ │ ■■■■□□   │  │
│  │ ╱╲╱╲╱╲   │ │ 420 B/s  │ │ 112 B/s │ │ text 80% │  │
│  │ sparkline│ │          │ │         │ │ bin  20% │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
└──────────────────────────────────────────────────────────┘</pre>`,
  },

  steps: [
    // ── 1. Connect ────────────────────────────────────────
    {
      id: 'rel-connect',
      title: 'Connect to the Mock Server',
      description:
        'First, let\'s establish a connection to the built-in mock echo server. The demo fills in `ws://localhost:9876` and clicks **Connect**. Watch the status bar turn green with a latency measurement and uptime counter.',
      highlight: WS.CONNECT_BTN,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        await ctx.click(WS.LEFT_TAB_CONNECT);
        await ctx.delay(200);
        await ctx.fill(WS.URL_INPUT, MOCK_URL);
        await ctx.delay(200);
      },
      action: async (ctx: DemoActionContext) => {
        await ctx.click(WS.CONNECT_BTN);
        await ctx.delay(1200);
        await ctx.click(WS.RIGHT_TAB_EVENTS);
        await ctx.delay(800);
      },
      verify: WS.STATUS_CONNECTED,
    },

    // ── 2. Stats Tab ──────────────────────────────────────
    {
      id: 'rel-stats-tab',
      title: 'The Stats Tab',
      description:
        'The **Stats** tab in the right panel shows live connection metrics: **Msg/s** with a sparkline chart, **Bytes In** and **Bytes Out** with per-second rates, and a **Frame Types** bar showing the mix of text, binary, and control frames. Right now the per-second rates are at zero — we haven\'t sent any messages yet.',
      highlight: WS.RIGHT_TAB_STATS,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        await ctx.click(WS.RIGHT_TAB_STATS);
        await ctx.delay(300);
      },
      action: async (ctx: DemoActionContext) => {
        await ctx.delay(1000);
      },
    },

    // ── 3. Live Sparkline ─────────────────────────────────
    {
      id: 'rel-stats-live',
      title: 'Live Metrics & Sparkline',
      description:
        'The demo sends a burst of five messages — watch the **Msg/s** sparkline jump as the echo server bounces them back. The bytes counters climb and the frame types bar fills in. Every second the sparkline updates, plotting throughput over the last 60 seconds.',
      highlight: WS.STATS_MSG_RATE,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        // Guard: must be connected to show the spike; reconnect silently if needed.
        if (!document.querySelector(WS.STATUS_CONNECTED)) {
          await connectToMockServer(ctx);
        }
        // Switch to Send, send a burst, then back to Stats
        await ctx.click(WS.LEFT_TAB_SEND);
        await ctx.delay(200);
        await ctx.fill(WS.MESSAGE_INPUT, '{"ping":1}');
        await ctx.delay(200);
      },
      action: async (ctx: DemoActionContext) => {
        // Send 5 messages — re-fill each time because Send clears the input
        for (let i = 0; i < 5; i++) {
          await ctx.fill(WS.MESSAGE_INPUT, `{"ping":${i + 1}}`);
          await ctx.delay(200);
          await ctx.click(WS.SEND_BTN);
          await ctx.delay(350);
        }
        await ctx.delay(600);
        // Switch to Stats to observe the spike
        await ctx.click(WS.RIGHT_TAB_STATS);
        await ctx.delay(1800);
      },
    },

    // ── 4. Auto-Reconnect Settings ────────────────────────
    {
      id: 'rel-reconnect-settings',
      title: 'Auto-Reconnect Settings',
      description:
        'Back on the Connect tab, scroll down to **Auto-Reconnect Settings**. The checkbox enables automatic retries when a connection drops unexpectedly (close code ≠ 1000). You configure **Max Attempts** (default 5), **Retry Interval** (default 3000ms), and **Backoff Multiplier** (1×, 1.5×, or 2× exponential). These settings are saved with connection profiles.',
      highlight: WS.RECONNECT_SETTINGS,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        await ctx.click(WS.LEFT_TAB_CONNECT);
        await ctx.delay(300);
      },
      action: async (ctx: DemoActionContext) => {
        // Scroll the reconnect settings into view
        const settings = document.querySelector(WS.RECONNECT_SETTINGS);
        if (settings) settings.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await ctx.delay(1200);
      },
    },

    // ── 5. Close with Code ────────────────────────────────
    {
      id: 'rel-close-code',
      title: 'Close with Code / Reason',
      description:
        'The **▾ caret** next to the Disconnect button opens the close-with-code panel. Choose a preset close code (1000 Normal, 1001 Going Away, 1008 Policy Violation, etc.), add an optional reason string, and click **Close with Code**. The demo sends close code **1001** with reason "Demo lesson complete" — this tells the server the client is intentionally going away.',
      highlight: WS.DISCONNECT_CARET,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        // Guard: caret is disabled when disconnected; reconnect silently if needed.
        if (!document.querySelector(WS.STATUS_CONNECTED)) {
          await connectToMockServer(ctx);
        }
        await ctx.click(WS.LEFT_TAB_CONNECT);
        await ctx.delay(200);
      },
      action: async (ctx: DemoActionContext) => {
        // Open the close-with-code dropdown
        await ctx.click(WS.DISCONNECT_CARET);
        // Rule 5: the close panel is conditionally rendered — wait for it to appear.
        await ctx.waitFor(WS.CLOSE_CODE_INPUT);
        await ctx.delay(400);
        // Fill close code and reason
        await ctx.fill(WS.CLOSE_CODE_INPUT, '1001');
        await ctx.delay(600);
        await ctx.fill(WS.CLOSE_REASON_INPUT, 'Demo lesson complete');
        await ctx.delay(600);
        // Send the close frame
        await ctx.click(WS.CLOSE_WITH_CODE_BTN);
        await ctx.delay(1200);
      },
    },

    // ── 6. Stats After Disconnect ─────────────────────────
    {
      id: 'rel-stats-zero',
      title: 'Stats After Disconnect',
      description:
        'After disconnecting, the Stats tab shows what happened: per-second rates drop to **zero**, the sparkline flatlines, and bytes/frame totals freeze at their final values. This gives you a clear before-and-after picture of when the connection was lost.',
      highlight: WS.RIGHT_TAB_STATS,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        // Guard: must be disconnected so rates show zero flatline; disconnect silently if still active.
        await disconnectWebSocket(ctx);
      },
      action: async (ctx: DemoActionContext) => {
        await ctx.click(WS.RIGHT_TAB_STATS);
        await ctx.delay(1400);
      },
    },

    // ── 7. URL History ────────────────────────────────────
    {
      id: 'rel-history',
      title: 'URL History',
      description:
        'Back on the Connect tab, the URL field has a **history dropdown** (▾) showing recently connected URLs. After connecting to `ws://localhost:9876`, it appears in the list with its protocol badge. Click any history entry to instantly fill the URL field — great for reconnecting to servers you use frequently.',
      highlight: WS.URL_HISTORY_TRIGGER,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        await ctx.click(WS.LEFT_TAB_CONNECT);
        await ctx.delay(300);
      },
      action: async (ctx: DemoActionContext) => {
        await ctx.click(WS.URL_HISTORY_TRIGGER);
        await ctx.delay(2000);
        await ctx.click(WS.URL_HISTORY_TRIGGER);
        await ctx.delay(600);
      },
    },
  ],
};
