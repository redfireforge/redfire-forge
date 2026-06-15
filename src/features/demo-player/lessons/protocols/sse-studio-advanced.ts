/**
 * Lesson 18: SSE Advanced Features
 *
 * Builds on Lesson 8 (SSE Studio) with production-level features:
 *  - Bookmarks and bookmark filtering
 *  - Stats footer (Events, Showing, Uptime, Types)
 *  - Auto-reconnect toggle
 *  - Last-Event-ID tracking
 *  - Clear & Export
 *
 * No Docker required — uses the dev server's built-in /api/sse-test endpoint.
 */
import type { DemoActionContext, DemoLesson } from '../../types';
import { SSE } from '../../../../shared/selectors';

const SSE_TEST_URL = 'http://localhost:3001/api/sse-test';

// ── Setup / Cleanup ────────────────────────────────────────────────

async function sseAdvancedSetup(ctx: DemoActionContext): Promise<void> {
  await ctx.delay(500);

  // Disconnect if already connected
  const connectBtn = document.querySelector(SSE.CONNECT_BTN) as HTMLButtonElement | null;
  if (connectBtn?.textContent?.includes('Disconnect')) {
    connectBtn.click();
    await ctx.delay(500);
  }

  // Clear existing events
  const clearBtn = document.querySelector(SSE.CLEAR_BTN) as HTMLButtonElement | null;
  if (clearBtn && !clearBtn.disabled) {
    clearBtn.click();
    await ctx.delay(200);
  }

  // Ensure Events tab is active
  const eventsTab = document.querySelector(SSE.RIGHT_TAB_EVENTS) as HTMLButtonElement | null;
  if (eventsTab) {
    eventsTab.click();
    await ctx.delay(200);
  }

  // Ensure Connect tab is active on the left
  const connectTab = document.querySelector(SSE.LEFT_TAB_CONNECT) as HTMLButtonElement | null;
  if (connectTab) {
    connectTab.click();
    await ctx.delay(200);
  }
}

async function sseAdvancedCleanup(ctx: DemoActionContext): Promise<void> {
  // Disconnect
  const connectBtn = document.querySelector(SSE.CONNECT_BTN) as HTMLButtonElement | null;
  if (connectBtn?.textContent?.includes('Disconnect')) {
    connectBtn.click();
    await ctx.delay(500);
  }

  // Clear events
  const clearBtn = document.querySelector(SSE.CLEAR_BTN) as HTMLButtonElement | null;
  if (clearBtn && !clearBtn.disabled) {
    clearBtn.click();
    await ctx.delay(200);
  }
}

// ── Lesson Definition ──────────────────────────────────────────────

export const sseStudioAdvancedLesson: DemoLesson = {
  id: 'sse-studio-advanced',
  domainId: 'protocols',
  category: 'sse',
  name: 'SSE Advanced Features',
  description: 'Master bookmarks, stats, auto-reconnect, Last-Event-ID, and export in SSE Studio.',
  estimatedMinutes: 3,
  initialTab: 'sse-studio',

  setup: sseAdvancedSetup,
  cleanup: sseAdvancedCleanup,

  concept: {
    title: 'SSE Advanced Features',
    body: `Lesson 8 covered the SSE basics — connecting, viewing live events, and exploring the console. Now we go deeper into the features that matter for **production SSE workflows**.

**What You'll Learn**
- **Bookmarks** — Star important events and filter the log to show only bookmarked items
- **Stats Footer** — Live metrics: event count, showing count, uptime, type breakdown
- **Auto-Reconnect** — Toggle automatic reconnection with configurable retry settings
- **Last-Event-ID** — How the browser resumes from where it left off after a reconnect
- **Clear & Export** — Clean the event log or export all events as JSON for offline analysis

**Why These Matter**
In production, SSE streams can run for hours and push thousands of events. Bookmarks let you mark events of interest. The stats footer gives you at-a-glance stream health. Auto-reconnect ensures resilience. Last-Event-ID enables seamless recovery. Export gives you an audit trail.`,
    keyTerms: [
      { term: 'Bookmark', definition: 'A starred event that persists in the current session. Use the filter to show only bookmarked events.' },
      { term: 'Last-Event-ID', definition: 'The ID of the most recent event. Sent as an HTTP header on reconnect so the server can resume from that point.' },
      { term: 'Auto-Reconnect', definition: 'When enabled, SSE Studio automatically retries the connection after unexpected disconnects.' },
      { term: 'Stats Footer', definition: 'The status bar at the bottom of the event log showing event count, uptime, and type breakdown.' },
    ],
    diagram: `<svg viewBox="0 0 400 130" xmlns="http://www.w3.org/2000/svg" style="font-family:system-ui,sans-serif">
  <rect x="0" y="0" width="400" height="130" rx="8" fill="#1e1e2e" />

  <!-- Event Stream -->
  <rect x="15" y="15" width="120" height="100" rx="4" fill="#2a2a3a" />
  <text x="75" y="33" text-anchor="middle" fill="#f59e0b" font-size="9" font-weight="bold">Event Stream</text>
  <text x="75" y="50" text-anchor="middle" fill="#888" font-size="7">★ Bookmarks</text>
  <text x="75" y="63" text-anchor="middle" fill="#888" font-size="7">📊 Stats Footer</text>
  <text x="75" y="76" text-anchor="middle" fill="#888" font-size="7">📥 Export JSON</text>
  <text x="75" y="89" text-anchor="middle" fill="#888" font-size="7">🗑 Clear Log</text>
  <text x="75" y="102" text-anchor="middle" fill="#888" font-size="7">🔍 Filter Types</text>

  <!-- Arrow -->
  <path d="M140,65 L195,65" stroke="#4ade80" stroke-width="2" marker-end="url(#arr18)" />

  <!-- Reconnect -->
  <rect x="200" y="15" width="90" height="100" rx="4" fill="#2a2a3a" />
  <text x="245" y="33" text-anchor="middle" fill="#60a5fa" font-size="9" font-weight="bold">Reconnect</text>
  <text x="245" y="50" text-anchor="middle" fill="#888" font-size="7">Auto-retry</text>
  <text x="245" y="63" text-anchor="middle" fill="#888" font-size="7">Last-Event-ID</text>
  <text x="245" y="76" text-anchor="middle" fill="#888" font-size="7">Resume stream</text>
  <text x="245" y="89" text-anchor="middle" fill="#888" font-size="7">Max retries</text>
  <text x="245" y="102" text-anchor="middle" fill="#888" font-size="7">Retry interval</text>

  <!-- Arrow 2 -->
  <path d="M295,65 L335,65" stroke="#c4b5fd" stroke-width="2" marker-end="url(#arr18)" />

  <!-- Server -->
  <rect x="340" y="25" width="50" height="80" rx="4" fill="#2a2a3a" />
  <text x="365" y="50" text-anchor="middle" fill="#f59e0b" font-size="9" font-weight="bold">Server</text>
  <text x="365" y="70" text-anchor="middle" fill="#888" font-size="7">id: N</text>
  <text x="365" y="83" text-anchor="middle" fill="#888" font-size="7">data: {}</text>
  <text x="365" y="96" text-anchor="middle" fill="#888" font-size="7">retry:</text>

  <defs><marker id="arr18" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#4ade80"/></marker></defs>
</svg>`,
  },

  steps: [
    // ── 1. Pick Up Where Lesson 8 Left Off ─────────────────────
    {
      id: 'sse-adv-intro',
      title: 'Pick Up Where Lesson 8 Left Off',
      description:
        'Welcome back to SSE Studio. In Lesson 8 you learned the basics — connecting, viewing events, searching, and using the console. Now we\'ll explore the advanced features that make SSE Studio a production-ready tool: bookmarks, live stats, auto-reconnect, and export.',
      highlight: SSE.STUDIO,
      preAction: async (ctx) => {
        // Connect and wait for events to accumulate
        await ctx.fill(SSE.URL_INPUT, SSE_TEST_URL);
        await ctx.delay(300);
        await ctx.click(SSE.CONNECT_BTN);
        await ctx.delay(3000);
      },
      pauseAfter: true,
    },

    // ── 2. Bookmark an Event ───────────────────────────────────
    {
      id: 'sse-adv-bookmark',
      title: 'Bookmark an Event',
      description:
        'Click the star icon (☆) on any event row to bookmark it. Bookmarked events show a filled star (★) and are tracked in the toolbar counter. Bookmarks persist for the current session — use them to flag events you want to revisit.',
      highlight: SSE.EVENT_ROW,
      action: async (ctx) => {
        // Click the bookmark star on the first visible event row
        const firstRow = document.querySelector(SSE.EVENT_ROW) as HTMLElement | null;
        if (firstRow) {
          const starBtn = firstRow.querySelector('.sse-bookmark-btn') as HTMLElement | null;
          if (starBtn) {
            starBtn.click();
            await ctx.delay(600);
          }
        }
        // Bookmark a second event for a better filter demo
        const rows = document.querySelectorAll(SSE.EVENT_ROW);
        if (rows.length >= 3) {
          const thirdRow = rows[2] as HTMLElement;
          const starBtn = thirdRow.querySelector('.sse-bookmark-btn') as HTMLElement | null;
          if (starBtn) {
            starBtn.click();
            await ctx.delay(400);
          }
        }
      },
      pauseAfter: true,
    },

    // ── 3. Filter to Bookmarked Events ─────────────────────────
    {
      id: 'sse-adv-bookmark-filter',
      title: 'Filter to Bookmarked Events',
      description:
        'Click the ★ filter button in the toolbar to show only your bookmarked events. The counter shows how many events are bookmarked. Click it again to return to the full event stream. This is essential when monitoring high-volume streams where you only want to see events you\'ve flagged.',
      highlight: SSE.BOOKMARK_FILTER,
      action: async (ctx) => {
        // Activate the bookmark filter
        await ctx.click(SSE.BOOKMARK_FILTER);
        await ctx.delay(1500);
        // Deactivate to show full list again
        await ctx.click(SSE.BOOKMARK_FILTER);
        await ctx.delay(500);
      },
      pauseAfter: true,
    },

    // ── 4. Stats Footer ────────────────────────────────────────
    {
      id: 'sse-adv-stats',
      title: 'Stats Footer',
      description:
        'The status bar at the bottom of the event log provides live metrics: total Events received, Showing count (changes with filters), connection Uptime, and a Type breakdown showing how many events of each type arrived (message, update, status). The status strip above shows connection state and Last-Event-ID.',
      highlight: SSE.STATUS_BAR,
      pauseAfter: true,
    },

    // ── 5. Auto-Reconnect ──────────────────────────────────────
    {
      id: 'sse-adv-reconnect',
      title: 'Auto-Reconnect',
      description:
        'Switch to the Connect tab to see the Reconnect section. The auto-reconnect toggle controls whether SSE Studio automatically retries the connection after unexpected disconnects. When enabled, you\'ll see the retry interval and maximum attempts. These values come from server defaults and the SSE retry field — they ensure your stream recovers without manual intervention.',
      highlight: SSE.LEFT_TAB_CONNECT,
      preAction: async (ctx) => {
        // Switch to Connect tab to show reconnect section
        await ctx.click(SSE.LEFT_TAB_CONNECT);
        await ctx.delay(300);
      },
      action: async (ctx) => {
        // Toggle auto-reconnect to demonstrate the setting
        const checkbox = document.querySelector('.sse-reconnect-card input[type="checkbox"]') as HTMLInputElement | null;
        if (checkbox) {
          // If it's already on, toggle off then on to show the change
          if (checkbox.checked) {
            checkbox.click();
            await ctx.delay(800);
            checkbox.click();
            await ctx.delay(600);
          } else {
            checkbox.click();
            await ctx.delay(800);
          }
        }
      },
      pauseAfter: true,
    },

    // ── 6. Last-Event-ID ───────────────────────────────────────
    {
      id: 'sse-adv-last-event-id',
      title: 'Last-Event-ID',
      description:
        'Look at the status strip — it shows the Last-Event-ID value, which is the ID of the most recent event received. When auto-reconnect triggers, SSE Studio sends this ID as an HTTP header so the server can resume from exactly where it left off. You can also see the per-event ID in the Event Detail panel by clicking any event.',
      highlight: SSE.STATE_LABEL,
      preAction: async (ctx) => {
        // Switch back to Events tab to show the status strip
        await ctx.click(SSE.RIGHT_TAB_EVENTS);
        await ctx.delay(300);
      },
      action: async (ctx) => {
        // Click an event to show the detail panel with Last-Event-ID
        const row = document.querySelector(SSE.EVENT_ROW) as HTMLElement | null;
        if (row) {
          row.click();
          await ctx.delay(1000);
        }
      },
      pauseAfter: true,
    },

    // ── 7. Clear & Export ──────────────────────────────────────
    {
      id: 'sse-adv-clear',
      title: 'Clear & Export',
      description:
        'The Export button saves all events as a JSON file — perfect for offline analysis, sharing, or archival. The Clear button resets the event log and bookmarks while preserving the uptime counter. Both are essential for long-running SSE sessions where the event log grows large.',
      highlight: SSE.CLEAR_BTN,
      action: async (ctx) => {
        // Close detail panel if open
        const closeBtn = document.querySelector('.sse-detail-close') as HTMLElement | null;
        if (closeBtn) {
          closeBtn.click();
          await ctx.delay(300);
        }
        // Demo export
        await ctx.click(SSE.EXPORT_BTN);
        await ctx.delay(1000);
        // Demo clear
        await ctx.click(SSE.CLEAR_BTN);
        await ctx.delay(500);
      },
      pauseAfter: true,
    },
  ],
};
