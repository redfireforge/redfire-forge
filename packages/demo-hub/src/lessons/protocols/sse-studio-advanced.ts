/**
 * Lesson 18: SSE Advanced Features
 *
 * Builds on SSE Studio with production-level features:
 *  - Bookmarks and bookmark filtering
 *  - Stats footer (Events, Showing, Uptime, Types)
 *  - Auto-reconnect toggle
 *  - Last-Event-ID tracking
 *  - Clear & Export
 *
 * No Docker required — uses the dev server's built-in /api/sse-test endpoint.
 */
import type { DemoActionContext, DemoLesson } from '../../types';
import { SSE } from '@shared/selectors';
import { showSpotlightRing } from '../../demoRipple';
import {
  cleanupDemoEnvironment,
  cleanupDemoMicroservice,
  ensureSseDemoHeaderContext,
  navigateToSseStudio,
  SSE_DEMO_ENV_NAME,
  SSE_DEMO_SVC_NAME,
} from '../env-manager-lesson-helpers';
import { closeExtraSseConnectionTabs } from '../setup-helpers';

/** Spotlight an element, hold for the viewer, then remove the ring. */
async function spotlightEl(
  ctx: DemoActionContext,
  el: HTMLElement | null,
  holdMs: number,
): Promise<void> {
  if (!el) return;
  el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  const remove = showSpotlightRing(el);
  try {
    await ctx.delay(holdMs);
  } finally {
    remove();
  }
}

const SSE_ENV_VAR_URL = '{{sseUrl}}/api/sse-test';

// ── Guard helpers ──────────────────────────────────────────────────

/**
 * Silently ensures SSE is connected with at least one event in the log
 * and the right pane is on the Events tab.  Safe to call even when already
 * connected — it checks state before acting.
 */
function isSseUrlResolvedInDom(): boolean {
  const preview = document.querySelector('.studio-endpoint-preview-url')?.textContent ?? '';
  if (preview && !preview.includes('{{') && /https?:\/\//i.test(preview)) return true;
  const indicator = document.querySelector('[data-testid="header-protocol-indicator"]')?.textContent ?? '';
  return Boolean(indicator && !/not resolved/i.test(indicator) && /https?:\/\//i.test(indicator));
}

/** Wait until the SSE URL preview no longer contains unresolved `{{…}}` tokens. */
async function waitForSseUrlResolved(ctx: DemoActionContext, timeoutMs = 1200): Promise<boolean> {
  if (isSseUrlResolvedInDom()) return true;
  // Iteration-capped (not wall-clock) so unit tests with mocked delay stay fast.
  const maxAttempts = Math.max(1, Math.ceil(timeoutMs / 50));
  for (let i = 0; i < maxAttempts; i++) {
    await ctx.delay(50);
    if (isSseUrlResolvedInDom()) return true;
  }
  return false;
}

async function ensureConnectedWithEvents(ctx: DemoActionContext): Promise<void> {
  // Quiet DOM click — no ripple. Events pane must be visible for bookmarks.
  document.querySelector<HTMLElement>(SSE.RIGHT_TAB_EVENTS)?.click();
  await ctx.delay(60);

  const connectBtn = document.querySelector(SSE.CONNECT_BTN) as HTMLButtonElement | null;
  const isConnected = connectBtn?.textContent?.includes('Disconnect');

  if (!isConnected) {
    await navigateToSseStudio(ctx);
    // Bridge-only header select (no Environment/Service dropdown open/close).
    await ensureSseDemoHeaderContext(ctx);
    await ctx.fill(SSE.URL_INPUT, SSE_ENV_VAR_URL);
    await ctx.delay(80);
    const resolved = await waitForSseUrlResolved(ctx);
    if (!resolved) {
      // Fallback so the advanced lesson can still demonstrate bookmarks/stats
      // when header selection races — concrete URL matches the demo endpoint.
      await ctx.fill(SSE.URL_INPUT, 'http://localhost:3001/api/sse-test');
      await ctx.delay(80);
    }
    await ctx.click(SSE.CONNECT_BTN);
    await ctx.delay(1500); // Wait for events to accumulate
  } else if (!document.querySelector(SSE.EVENT_ROW)) {
    await ctx.delay(1200); // Connected but no events yet — wait briefly
  }
}

// ── Setup / Cleanup ────────────────────────────────────────────────

async function sseAdvancedSetup(ctx: DemoActionContext): Promise<void> {
  // Quiet DOM-only cleanup — no ripples, no header dropdown tours.
  const connectBtn = document.querySelector(SSE.CONNECT_BTN) as HTMLButtonElement | null;
  if (connectBtn?.textContent?.includes('Disconnect')) {
    connectBtn.click();
    await ctx.delay(40);
  }

  await closeExtraSseConnectionTabs(ctx);

  const clearBtn = document.querySelector(SSE.CLEAR_BTN) as HTMLButtonElement | null;
  if (clearBtn && !clearBtn.disabled) {
    clearBtn.click();
    await ctx.delay(40);
  }

  document.querySelector<HTMLElement>(SSE.RIGHT_TAB_EVENTS)?.click();
  document.querySelector<HTMLElement>(SSE.LEFT_TAB_CONNECT)?.click();

  // Select SSE Demo / sse-demo via bridge only (no Environment/Service menu flash).
  await ensureSseDemoHeaderContext(ctx);
  await navigateToSseStudio(ctx);
}

async function sseAdvancedCleanup(ctx: DemoActionContext): Promise<void> {
  const connectBtn = document.querySelector(SSE.CONNECT_BTN) as HTMLButtonElement | null;
  if (connectBtn?.textContent?.includes('Disconnect')) {
    connectBtn.click();
    await ctx.delay(120);
  }

  await closeExtraSseConnectionTabs(ctx);

  const clearBtn = document.querySelector(SSE.CLEAR_BTN) as HTMLButtonElement | null;
  if (clearBtn && !clearBtn.disabled) {
    clearBtn.click();
    await ctx.delay(120);
  }

  // Remove demo data via bridge when available (no Environments tab flash).
  await cleanupDemoMicroservice(ctx, SSE_DEMO_SVC_NAME);
  await cleanupDemoEnvironment(ctx, SSE_DEMO_ENV_NAME);
  // Only return to SSE Studio when cleanup was allowed to navigate (restart path).
  // On Exit → Contents, navigateToTab is pinned to demo-hub and this is a no-op.
  await navigateToSseStudio(ctx);
}

// ── Lesson Definition ──────────────────────────────────────────────

export const sseStudioAdvancedLesson: DemoLesson = {
  id: 'sse-studio-advanced',
  domainId: 'protocols',
  category: 'sse',
  name: 'SSE Advanced Features',
  description: 'Master bookmarks, stats, auto-reconnect, Last-Event-ID, and export in SSE Studio.',
  estimatedMinutes: 5,
  initialTab: 'sse-studio',
  allowedTabs: ['environments', 'sse-studio'],

  setup: sseAdvancedSetup,
  cleanup: sseAdvancedCleanup,

  concept: {
    title: 'SSE Advanced Features',
    body: `SSE Studio covered the SSE basics — connecting, viewing live events, and exploring the console. Now we go deeper into the features that matter for **production SSE workflows**.

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
    // ── 1. Welcome Back to SSE Studio ─────────────────────────
    {
      id: 'sse-adv-intro',
      title: 'Welcome Back to SSE Studio',
      description:
        'Welcome back to SSE Studio. In the SSE Studio lesson you learned the basics — connecting, viewing events, searching, and using the console. ' +
        'Each **connection tab** above is an independent workspace — bookmarks, filters, and stats are all per-tab. ' +
        'Now we\'ll explore the advanced features that make SSE Studio a production-ready tool: bookmarks, live stats, auto-reconnect, and export.',
      highlight: SSE.NAV_TAB,
      preAction: async () => {
        document.querySelectorAll('.sse-row-selected').forEach((el) => {
          el.classList.remove('sse-row-selected');
        });
      },
      pauseAfter: true,
    },

    // ── 2. Bookmark an Event ───────────────────────────────────
    {
      id: 'sse-adv-bookmark',
      title: 'Bookmark an Event',
      description:
        'Click the star icon (☆) on any event row to bookmark it. Bookmarked events show a filled star (★) and are tracked in the toolbar counter. Bookmarks persist for the current session — use them to flag events you want to revisit.',
      // Reading phase: spotlight the star — not the whole event row.
      highlight: SSE.BOOKMARK_BTN,
      preAction: async (ctx) => {
        await ensureConnectedWithEvents(ctx);
        // Clear leftover bookmarks so this step starts from empty stars (☆).
        document.querySelectorAll<HTMLElement>('.sse-bookmark-btn.active').forEach((btn) => {
          btn.click();
        });
        await ctx.delay(200);
      },
      action: async (ctx) => {
        // Click the bookmark star on the first visible event row
        const firstRow = document.querySelector(SSE.EVENT_ROW) as HTMLElement | null;
        const starBtn = firstRow?.querySelector('.sse-bookmark-btn') as HTMLElement | null;
        if (starBtn) {
          starBtn.click();
          await ctx.delay(500); // React re-renders filled ★
          // Payoff 1: filled star on the row
          const filledStar =
            (firstRow?.querySelector('.sse-bookmark-btn.active') as HTMLElement | null) ?? starBtn;
          await spotlightEl(ctx, filledStar, 1200);
          // Payoff 2: toolbar bookmark counter (★ N)
          const counter = document.querySelector(SSE.BOOKMARK_FILTER) as HTMLElement | null;
          await spotlightEl(ctx, counter, 1200);
        }
        // Quietly bookmark a second event so the next filter step has ≥2 items
        const rows = document.querySelectorAll(SSE.EVENT_ROW);
        if (rows.length >= 3) {
          const thirdRow = rows[2] as HTMLElement;
          const secondStar = thirdRow.querySelector('.sse-bookmark-btn') as HTMLElement | null;
          if (secondStar && !secondStar.classList.contains('active')) {
            secondStar.click();
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
      preAction: async (ctx) => {
        await ensureConnectedWithEvents(ctx);
        // Ensure at least one bookmark exists so the filter is demonstrable
        const firstRow = document.querySelector(SSE.EVENT_ROW) as HTMLElement | null;
        if (firstRow) {
          const star = firstRow.querySelector('.sse-bookmark-btn') as HTMLElement | null;
          if (star && !star.classList.contains('active')) {
            star.click();
            await ctx.delay(300);
          }
        }
      },
      action: async (ctx) => {
        // Activate the bookmark filter
        await ctx.click(SSE.BOOKMARK_FILTER);
        await ctx.delay(1500);
        // Deactivate to show full list again
        await ctx.click(SSE.BOOKMARK_FILTER);
        await ctx.delay(800);
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
      preAction: async (ctx) => {
        await ensureConnectedWithEvents(ctx);
      },
      pauseAfter: true,
    },

    // ── 5. Auto-Reconnect ──────────────────────────────────────
    {
      id: 'sse-adv-reconnect',
      title: 'Auto-Reconnect',
      description:
        'The **Connect** tab\'s Reconnect section controls whether SSE Studio automatically retries after an unexpected disconnect. The **Auto-reconnect** toggle turns this on or off. When enabled, you\'ll see the retry interval and maximum attempts — these come from the server\'s retry field and ensure your stream recovers without manual intervention.',
      highlight: SSE.RECONNECT_CARD,
      preAction: async (ctx) => {
        // The reconnect toggle is disabled while connected — disconnect first so
        // the viewer can see the toggle change in the action phase.
        const connectBtn = document.querySelector(SSE.CONNECT_BTN) as HTMLButtonElement | null;
        if (connectBtn?.textContent?.includes('Disconnect')) {
          connectBtn.click();
          await ctx.delay(600);
        }
        // Navigate to the Connect tab to reveal the reconnect card
        await ctx.click(SSE.LEFT_TAB_CONNECT);
        await ctx.delay(400);
      },
      action: async (ctx) => {
        // Toggle auto-reconnect using ctx.click() so the viewer sees the ripple
        const checkbox = document.querySelector(SSE.RECONNECT_TOGGLE) as HTMLInputElement | null;
        if (checkbox) {
          if (checkbox.checked) {
            // Toggle off then back on to show the change clearly
            await ctx.click(SSE.RECONNECT_TOGGLE);
            await ctx.delay(800);
            await ctx.click(SSE.RECONNECT_TOGGLE);
            await ctx.delay(800);
          } else {
            await ctx.click(SSE.RECONNECT_TOGGLE);
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
        await ensureConnectedWithEvents(ctx);
        // Close Event Detail if already open so the click below is visible.
        const closeBtn = document.querySelector('.sse-detail-footer button') as HTMLElement | null;
        if (closeBtn) {
          closeBtn.click();
          await ctx.delay(300);
        }
      },
      action: async (ctx) => {
        // Click the LAST (most recent) row so the per-event ID in the detail
        // panel matches the Last-Event-ID shown on the status strip.
        const rows = document.querySelectorAll<HTMLElement>(SSE.EVENT_ROW);
        const row = rows[rows.length - 1] ?? null;
        if (!row) return;

        // 1) Spotlight the status strip so the viewer reads the overall Last-Event-ID
        const statusStrip = document.querySelector('[data-testid="sse-state-label"]') as HTMLElement | null;
        await spotlightEl(ctx, statusStrip, 1200);
        // 2) Spotlight the last event row the viewer is about to click
        await spotlightEl(ctx, row, 800);
        // 3) Click the last row (most recent event) to open its detail panel
        row.click();
        await ctx.waitFor(SSE.EVENT_DETAIL);
        await ctx.delay(700); // panel paints
        // 4) Spotlight Event Detail, then the per-event Last-Event-ID field
        const detail = document.querySelector(SSE.EVENT_DETAIL) as HTMLElement | null;
        await spotlightEl(ctx, detail, 1200);
        const detailLastId = document.querySelector(SSE.EVENT_DETAIL_LAST_ID) as HTMLElement | null;
        if (detailLastId) {
          await spotlightEl(ctx, detailLastId, 1200);
        } else {
          await ctx.delay(800); // still pause on the panel when ID is absent
        }
      },
      pauseAfter: true,
    },

    // ── 7. Clear & Export ──────────────────────────────────────
    {
      id: 'sse-adv-clear',
      title: 'Clear & Export',
      description:
        'First, click **Clear** to reset the event log and bookmarks (uptime stays). ' +
        'Then click **Export** to download the current log as JSON — useful for offline analysis, sharing, or archival. ' +
        'Together they keep long-running SSE sessions manageable.',
      // Reading opens on Clear — matches title order (Clear, then Export).
      highlight: SSE.CLEAR_BTN,
      preAction: async (ctx) => {
        await ensureConnectedWithEvents(ctx);
        // Close detail panel if open so Clear/Export are unobscured.
        const closeBtn = document.querySelector('.sse-detail-footer button') as HTMLElement | null;
        if (closeBtn) {
          closeBtn.click();
          await ctx.delay(200);
        }
      },
      action: async (ctx) => {
        // Beat 1: spotlight Clear → pause → click → pause so the empty log is visible
        const clearBtn = document.querySelector(SSE.CLEAR_BTN) as HTMLElement | null;
        await spotlightEl(ctx, clearBtn, 1400);
        await ctx.click(SSE.CLEAR_BTN);
        await ctx.delay(1200);

        // Beat 2: spotlight Export → pause → click → pause on the download outcome
        const exportBtn = document.querySelector(SSE.EXPORT_BTN) as HTMLElement | null;
        await spotlightEl(ctx, exportBtn, 1400);
        await ctx.click(SSE.EXPORT_BTN);
        await ctx.delay(1000);
      },
      pauseAfter: true,
    },

    // ── 8. Disconnect ───────────────────────────────────────────────
    {
      id: 'sse-adv-disconnect',
      title: 'Disconnect',
      description:
        'Click **Disconnect** to close the SSE stream. The status badge returns to grey and the uptime counter stops. ' +
        'Because **Auto-reconnect** is enabled, SSE Studio will only stay disconnected if you click Disconnect manually — ' +
        'any unexpected drop would trigger an automatic retry. You now have a complete picture of the SSE Studio advanced toolkit: ' +
        'bookmarks, live stats, resilient reconnection, and export.',
      highlight: SSE.CONNECT_BTN,
      pauseAfter: true,
      preAction: async (ctx) => {
        // Ensure we're on the Connect tab so the button is visible
        await ctx.click(SSE.LEFT_TAB_CONNECT);
        await ctx.delay(300);
      },
      action: async (ctx) => {
        // Only disconnect if currently connected
        const btn = document.querySelector(SSE.CONNECT_BTN) as HTMLButtonElement | null;
        if (btn?.textContent?.includes('Disconnect')) {
          await ctx.click(SSE.CONNECT_BTN);
          await ctx.delay(800);
        }
      },
    },
  ],
};
