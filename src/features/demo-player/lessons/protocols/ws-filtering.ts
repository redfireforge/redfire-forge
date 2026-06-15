/** Lesson 6: Filtering, Diff & Schema — search modes, compare, and JSON schema validation */
import type { DemoActionContext, DemoLesson } from '../../types';
import { wsSetup, wsCleanup, disconnectWebSocket, clearEvents, connectToMockServer } from '../setup-helpers';
import { WS } from '../../../../shared/selectors';

// ── Helpers ────────────────────────────────────────────────────────

/** Send a message via the Compose panel and wait for echo. */
async function sendMessage(ctx: DemoActionContext, message: string): Promise<void> {
  await ctx.click(WS.LEFT_TAB_COMPOSE);
  await ctx.delay(200);
  await ctx.fill(WS.MESSAGE_INPUT, message);
  await ctx.delay(100);
  await ctx.click(WS.SEND_BTN);
  await ctx.delay(800);
}

/**
 * Guard: ensure the Events tab is visible (search bar present).
 * Used by multiple preActions — skipping to any Events-based step
 * from Schema tab or another context would otherwise leave the toolbar
 * buttons inaccessible.
 */
async function ensureEventsTab(ctx: DemoActionContext): Promise<void> {
  if (!document.querySelector(WS.SEARCH_INPUT)) {
    await ctx.click(WS.RIGHT_TAB_EVENTS);
    await ctx.delay(300);
  }
}

/**
 * Guard: close the diff modal and exit compare mode silently.
 * Used by steps that need a clean state before navigating away from Events.
 */
async function closeDiffAndCompare(ctx: DemoActionContext): Promise<void> {
  const diffClose = document.querySelector(WS.DIFF_CLOSE) as HTMLButtonElement | null;
  if (diffClose) {
    diffClose.click();
    await ctx.delay(300);
  }
  const cancelBtn = document.querySelector(WS.COMPARE_CANCEL) as HTMLButtonElement | null;
  if (cancelBtn) {
    cancelBtn.click();
    await ctx.delay(200);
  }
}

/**
 * Guard: ensure compare mode is active and the diff modal is open.
 * Used by diff-view and diff-close preActions so skipping to those steps
 * always shows a real diff rather than an empty state.
 */
async function ensureDiffOpen(ctx: DemoActionContext): Promise<void> {
  await ensureEventsTab(ctx);
  // Close filter bar if open — rows must be fully visible for row clicks
  if (document.querySelector(WS.FILTER_BAR)) {
    await ctx.click(WS.FILTER_TOGGLE_BTN);
    await ctx.delay(200);
  }
  // Clear any active search so all 9 rows are visible
  const searchEl = document.querySelector(WS.SEARCH_INPUT) as HTMLInputElement | null;
  if (searchEl && searchEl.value) {
    await ctx.fill(WS.SEARCH_INPUT, '');
    await ctx.delay(150);
  }
  // If diff already open, nothing to do
  if (document.querySelector(WS.DIFF_MODAL)) return;
  // Enter compare mode if not already active
  if (!document.querySelector(WS.COMPARE_BANNER)) {
    await ctx.click(WS.COMPARE_BTN);
    await ctx.delay(400);
  }
  // Click the two greeting rows (rows[1] and rows[5]) to open the diff
  const rows = document.querySelectorAll(WS.MESSAGE_ROW);
  if (rows.length >= 6) {
    (rows[1] as HTMLElement).click();
    await ctx.delay(400);
    (rows[5] as HTMLElement).click();
    await ctx.waitFor(WS.DIFF_MODAL, 4000);
  }
}

/**
 * Setup: start mock, connect, send 4 varied messages for filtering/diff demos.
 * Messages have different structures to make search/filter/diff interesting.
 */
async function filteringSetup(ctx: DemoActionContext): Promise<void> {
  // Wait for UI
  await ctx.delay(500);
  // Disconnect any existing connection
  await disconnectWebSocket(ctx);
  await ctx.delay(200);
  // Clear leftover events
  await clearEvents(ctx);
  await ctx.delay(200);
  // Start mock + switch to client
  await wsSetup(ctx);
  await ctx.delay(300);
  // Connect
  await connectToMockServer(ctx);
  // Send 4 varied messages for filtering/diff demos
  await sendMessage(ctx, '{"type": "greeting", "message": "Hello WebSocket!"}');
  await sendMessage(ctx, '{"type": "status", "code": 200, "online": true}');
  await sendMessage(ctx, '{"type": "greeting", "message": "Hello again!"}');
  await sendMessage(ctx, '{"type": "error", "code": 500, "message": "Something went wrong"}');
  // Switch to Events tab so the user sees the messages
  await ctx.click(WS.RIGHT_TAB_EVENTS);
  await ctx.delay(300);
}

/** Cleanup: close diff/compare mode, disconnect, clear, stop mock. */
async function filteringCleanup(ctx: DemoActionContext): Promise<void> {
  // Close diff modal if open
  const diffClose = document.querySelector(WS.DIFF_CLOSE) as HTMLButtonElement | null;
  if (diffClose) {
    diffClose.click();
    await ctx.delay(300);
  }
  // Exit compare mode if active
  const cancelBtn = document.querySelector(WS.COMPARE_CANCEL) as HTMLButtonElement | null;
  if (cancelBtn) {
    cancelBtn.click();
    await ctx.delay(200);
  }
  // Close filter bar if open
  const filterBar = document.querySelector(WS.FILTER_BAR);
  if (filterBar) {
    const toggleBtn = document.querySelector(WS.FILTER_TOGGLE_BTN) as HTMLButtonElement | null;
    if (toggleBtn) {
      toggleBtn.click();
      await ctx.delay(200);
    }
  }
  // Switch back to events tab
  await ctx.click(WS.RIGHT_TAB_EVENTS);
  await ctx.delay(200);
  // Standard cleanup
  await wsCleanup(ctx);
}

export const wsFilteringLesson: DemoLesson = {
  id: 'ws-filtering',
  domainId: 'protocols',
  category: 'websocket',
  name: 'Filtering, Diff & Schema',
  description: 'Search, compare, and validate your WebSocket messages with powerful analysis tools.',
  estimatedMinutes: 4,
  initialTab: 'websocket-studio',

  setup: filteringSetup,
  cleanup: filteringCleanup,

  concept: {
    title: 'Message Analysis Tools',
    body: `Once you have a live WebSocket connection, you need to **find, compare, and validate** messages efficiently. RedfireForge provides three layers of analysis:

**1. Search & Filter**
- **Text search**: Simple substring matching across message payloads
- **Regex search**: Pattern matching with full regex support — find all error codes, timestamps, etc.
- **JSONPath search**: Query JSON payloads with JSONPath expressions like \`$.type\` or \`$..message\`
- **Filter bar**: Filter by message size, time range, and content type
- **Direction filter**: Show only sent (↑), received (↓), or bookmarked messages

**2. Diff & Compare**
- Select any two messages and see a **side-by-side structural diff**
- JSON changes highlighted: additions (green), removals (red), modifications (yellow)
- Line-level diff with line numbers for precise comparison
- Quick diff from detail panel: compare with previous/next message in one click

**3. Schema Validation**
- Define **JSON Schemas** for your message payloads
- Live validation badges: ✓ (valid) or ✗ (invalid) on each message
- Filter messages by validation status (valid only / invalid only)
- Auto-generate schemas from existing messages

These tools turn raw WebSocket traffic into **actionable intelligence**.`,
    keyTerms: [
      { term: 'Text Search', definition: 'Simple substring matching across all message payloads.' },
      { term: 'Regex Search', definition: 'Pattern matching with regular expressions for complex queries.' },
      { term: 'JSONPath', definition: 'Query language for JSON — find values at specific paths like $.type or $..id.' },
      { term: 'Diff', definition: 'Side-by-side comparison showing structural changes between two messages.' },
      { term: 'JSON Schema', definition: 'A standard format for describing the expected structure of JSON data.' },
    ],
    diagram: `<svg viewBox="0 0 400 160" xmlns="http://www.w3.org/2000/svg" style="font-family:system-ui,sans-serif">
  <rect x="0" y="0" width="400" height="160" rx="8" fill="#1e1e2e" />

  <!-- Messages column -->
  <rect x="10" y="15" width="120" height="130" rx="4" fill="#2a2a3a" />
  <text x="70" y="32" text-anchor="middle" fill="#aaa" font-size="10" font-weight="bold">Messages</text>
  <rect x="16" y="38" width="108" height="16" rx="2" fill="#3a3a5a" />
  <text x="22" y="50" fill="#4ade80" font-size="8">↑ greeting</text>
  <text x="112" y="50" fill="#888" font-size="7">✓</text>
  <rect x="16" y="58" width="108" height="16" rx="2" fill="#3a3a5a" />
  <text x="22" y="70" fill="#60a5fa" font-size="8">↓ status</text>
  <text x="112" y="70" fill="#888" font-size="7">✓</text>
  <rect x="16" y="78" width="108" height="16" rx="2" fill="#4a3a5a" stroke="#7c3aed" stroke-width="1" />
  <text x="22" y="90" fill="#4ade80" font-size="8">↑ greeting</text>
  <text x="112" y="90" fill="#888" font-size="7">✓</text>
  <rect x="16" y="98" width="108" height="16" rx="2" fill="#5a3a3a" />
  <text x="22" y="110" fill="#60a5fa" font-size="8">↓ error</text>
  <text x="112" y="110" fill="#ef4444" font-size="7">✗</text>
  <text x="70" y="135" text-anchor="middle" fill="#666" font-size="8">✓ valid  ✗ invalid</text>

  <!-- Search -->
  <rect x="145" y="15" width="115" height="45" rx="4" fill="#2a2a3a" />
  <text x="202" y="30" text-anchor="middle" fill="#7c3aed" font-size="9" font-weight="bold">🔍 Search</text>
  <rect x="151" y="35" width="30" height="14" rx="2" fill="#3a3a5a" />
  <text x="166" y="45" text-anchor="middle" fill="#aaa" font-size="7">Text</text>
  <rect x="184" y="35" width="35" height="14" rx="2" fill="#7c3aed" opacity="0.3" />
  <text x="201" y="45" text-anchor="middle" fill="#c4b5fd" font-size="7">Regex</text>
  <rect x="222" y="35" width="32" height="14" rx="2" fill="#3a3a5a" />
  <text x="238" y="45" text-anchor="middle" fill="#aaa" font-size="7">JSON</text>

  <!-- Diff -->
  <rect x="145" y="68" width="115" height="38" rx="4" fill="#2a2a3a" />
  <text x="202" y="83" text-anchor="middle" fill="#22c55e" font-size="9" font-weight="bold">⇔ Diff</text>
  <text x="202" y="98" text-anchor="middle" fill="#888" font-size="8">Side-by-side compare</text>

  <!-- Schema -->
  <rect x="145" y="113" width="115" height="32" rx="4" fill="#2a2a3a" />
  <text x="202" y="128" text-anchor="middle" fill="#f59e0b" font-size="9" font-weight="bold">📋 Schema</text>
  <text x="202" y="140" text-anchor="middle" fill="#888" font-size="8">Validate · ✓ ✗ badges</text>

  <!-- Arrows -->
  <path d="M130,50 L145,35" stroke="#7c3aed" stroke-width="1" opacity="0.5" />
  <path d="M130,85 L145,85" stroke="#22c55e" stroke-width="1" opacity="0.5" />
  <path d="M130,107 L145,127" stroke="#f59e0b" stroke-width="1" opacity="0.5" />

  <!-- Flow labels -->
  <text x="330" y="30" text-anchor="middle" fill="#999" font-size="9">Find → Compare</text>
  <text x="330" y="50" text-anchor="middle" fill="#999" font-size="9">→ Validate</text>
  <text x="330" y="80" text-anchor="middle" fill="#666" font-size="8">3 layers of</text>
  <text x="330" y="95" text-anchor="middle" fill="#666" font-size="8">message analysis</text>
</svg>`,
  },

  steps: [
    // ── 1. Search Modes ──────────────────────────────────────────
    {
      id: 'filter-search',
      title: 'Search Modes',
      description:
        'The search bar supports three modes: Text (simple substring), Regex (pattern matching), and JSONPath (query JSON structure). Let\'s try a text search to find "greeting" messages.',
      highlight: WS.SEARCH_MODE_PILLS,
      preAction: async (ctx) => {
        // Ensure we're on Events tab
        await ensureEventsTab(ctx);
      },
      action: async (ctx) => {
        // Type a search term
        await ctx.fill(WS.SEARCH_INPUT, 'greeting');
        await ctx.delay(800);
      },
      pauseAfter: true,
    },

    // ── 2. Direction Filter ──────────────────────────────────────
    {
      id: 'filter-direction',
      title: 'Direction Filter',
      description:
        'Filter messages by direction — show only sent (↑), received (↓), or bookmarked messages. Combined with search, this lets you quickly isolate exactly the traffic you need.',
      highlight: WS.DIRECTION_FILTER,
      preAction: async (ctx) => {
        // Ensure we're on Events tab so the direction filter is accessible
        await ensureEventsTab(ctx);
      },
      action: async (ctx) => {
        // Select "Sent" to show only sent messages
        await ctx.selectOption(WS.DIRECTION_FILTER, 'sent');
        await ctx.delay(800);
      },
      pauseAfter: true,
    },

    // ── 3. Filter Bar ────────────────────────────────────────────
    {
      id: 'filter-bar',
      title: 'Advanced Filters',
      description:
        'Click "Filters" to expand the filter bar with size, time range, and content type filters. These compose with search and direction — think of them as AND conditions.',
      highlight: WS.FILTER_TOGGLE_BTN,
      preAction: async (ctx) => {
        // Ensure Events tab is visible before touching toolbar controls
        await ensureEventsTab(ctx);
        // Reset direction filter to "All" and clear search
        await ctx.selectOption(WS.DIRECTION_FILTER, 'all');
        await ctx.delay(200);
        await ctx.fill(WS.SEARCH_INPUT, '');
        await ctx.delay(200);
      },
      action: async (ctx) => {
        // Toggle filter bar open
        await ctx.click(WS.FILTER_TOGGLE_BTN);
        await ctx.delay(800);
      },
      verify: WS.FILTER_BAR,
      pauseAfter: true,
    },

    // ── 4. Compare Mode ──────────────────────────────────────────
    {
      id: 'diff-compare',
      title: 'Compare Mode',
      description:
        'Click "Compare" to enter compare mode. Then click any two messages to see a side-by-side structural diff — perfect for spotting changes between similar responses.',
      highlight: WS.COMPARE_BTN,
      preAction: async (ctx) => {
        // Ensure Events tab is visible so the toolbar is accessible
        await ensureEventsTab(ctx);
        // Close filter bar if open
        if (document.querySelector(WS.FILTER_BAR)) {
          await ctx.click(WS.FILTER_TOGGLE_BTN);
          await ctx.delay(300);
        }
      },
      action: async (ctx) => {
        // Enter compare mode
        await ctx.click(WS.COMPARE_BTN);
        await ctx.delay(500);
      },
      verify: WS.COMPARE_BANNER,
      pauseAfter: true,
    },

    // ── 5. Select Messages & View Diff ───────────────────────────
    {
      id: 'diff-view',
      title: 'View the Diff',
      description:
        'Click two messages to compare them. The diff modal shows structural changes: additions in green, removals in red, and modifications in yellow. You can swap sides or copy the unified diff.',
      highlight: WS.COMPARE_BANNER,
      preAction: async (ctx) => {
        // Guard: ensure Events tab, close any existing diff, enter compare mode.
        // Handles skip-to-step from any earlier or later step. (Rule 4)
        await ensureEventsTab(ctx);
        // Close filter bar if open — rows must be unobstructed
        if (document.querySelector(WS.FILTER_BAR)) {
          await ctx.click(WS.FILTER_TOGGLE_BTN);
          await ctx.delay(200);
        }
        // Clear search so all 9 rows are visible (row indices must match expectations)
        const searchEl = document.querySelector(WS.SEARCH_INPUT) as HTMLInputElement | null;
        if (searchEl && searchEl.value) {
          await ctx.fill(WS.SEARCH_INPUT, '');
          await ctx.delay(150);
        }
        // Close diff if already open — viewer should see the selection, not a stale diff
        if (document.querySelector(WS.DIFF_MODAL)) {
          const closeBtn = document.querySelector(WS.DIFF_CLOSE) as HTMLButtonElement | null;
          if (closeBtn) closeBtn.click();
          await ctx.delay(300);
        }
        // Ensure compare mode is active so row clicks select for comparison
        if (!document.querySelector(WS.COMPARE_BANNER)) {
          await ctx.click(WS.COMPARE_BTN);
          await ctx.delay(400);
        }
      },
      action: async (ctx) => {
        // Click two "greeting" message rows to compare them.
        // After setup, message order is: Connected, sent#1, echo#1, sent#2, echo#2, sent#3, echo#3, sent#4, echo#4
        // rows[1] = sent greeting "Hello WebSocket!"
        // rows[5] = sent greeting "Hello again!"
        const rows = document.querySelectorAll(WS.MESSAGE_ROW);
        if (rows.length >= 6) {
          (rows[1] as HTMLElement).click();
          await ctx.delay(600);
          (rows[5] as HTMLElement).click();
          // Wait for diff modal to appear — more robust than a fixed delay (Rule 5)
          await ctx.waitFor(WS.DIFF_MODAL, 5000);
          await ctx.delay(600); // brief pause so user sees the diff rendered
        }
      },
      verify: WS.DIFF_MODAL,
      pauseAfter: true,
    },

    // ── 6. Close Diff & Exit Compare ─────────────────────────────
    {
      id: 'diff-close',
      title: 'Close the Diff',
      description:
        'Close the diff modal to return to the message list. You can also press Escape. Closing the diff exits compare mode automatically.',
      highlight: WS.DIFF_CLOSE,
      preAction: async (ctx) => {
        // Guard: if user skipped step 5, the diff modal may not be open.
        // Silently set up compare mode and open a diff so the close button exists. (Rule 4)
        await ensureDiffOpen(ctx);
      },
      action: async (ctx) => {
        await ctx.click(WS.DIFF_CLOSE);
        await ctx.delay(500);
      },
      pauseAfter: true,
    },

    // ── 7. Enable Schema Validation ─────────────────────────────
    {
      id: 'schema-intro',
      title: 'Schema Validation',
      description:
        'The Schema tab lets you attach JSON Schemas to your connection — each message ' +
        'is then validated in real time. The **Validate** checkbox arms the engine; once ' +
        'enabled, every message gets a live ✓ or ✗ badge. We have no schemas yet — ' +
        'let\'s enable validation first, then add one.',
      highlight: WS.RIGHT_TAB_SCHEMA,
      preAction: async (ctx) => {
        // Guard: close any open diff and exit compare mode before switching tabs. (Rule 4)
        await closeDiffAndCompare(ctx);
      },
      action: async (ctx) => {
        // Navigate to Schema tab with ripple — user sees the empty schema panel
        await ctx.click(WS.RIGHT_TAB_SCHEMA);
        await ctx.waitFor(WS.VALIDATION_TOGGLE);
        await ctx.delay(800);
        // Enable the Validate toggle with ripple — arms the validation engine
        const toggle = document.querySelector(WS.VALIDATION_TOGGLE) as HTMLInputElement | null;
        if (toggle && !toggle.checked) {
          await ctx.click(WS.VALIDATION_TOGGLE);
          await ctx.delay(600);
        }
      },
      pauseAfter: true,
    },

    // ── 8. Add a JSON Schema ─────────────────────────────────────
    {
      id: 'schema-add',
      title: 'Add a JSON Schema',
      description:
        'Click **+ Add** to open the schema editor. Hit **Generate** to auto-build a ' +
        'schema from your existing received messages — no JSON expertise needed. ' +
        'Then name it "Greeting Schema", set direction to **Both** (validate sent AND ' +
        'received), and replace the generated schema with a strict greeting-only one: ' +
        '`required: [type, message]` plus `enum: ["greeting"]` ensures only greeting ' +
        'messages pass. Hit **Add** to save.',
      highlight: WS.SCHEMA_ADD_BTN,
      preAction: async (ctx) => {
        // Guard: close diff/compare, navigate to Schema tab, enable validation toggle. (Rule 4)
        await closeDiffAndCompare(ctx);
        await ctx.click(WS.RIGHT_TAB_SCHEMA);
        await ctx.waitFor(WS.VALIDATION_TOGGLE);
        const toggle = document.querySelector(WS.VALIDATION_TOGGLE) as HTMLInputElement | null;
        if (toggle && !toggle.checked) {
          await ctx.click(WS.VALIDATION_TOGGLE);
          await ctx.delay(300);
        }
      },
      action: async (ctx) => {
        // Open the Add Schema form — user sees the empty editor
        await ctx.click(WS.SCHEMA_ADD_BTN);
        await ctx.waitFor(WS.SCHEMA_NAME_INPUT);
        await ctx.delay(600);

        // Demonstrate Generate — auto-build a schema from existing received messages
        await ctx.click(WS.SCHEMA_GENERATE_BTN);
        await ctx.delay(1800); // pause so user can READ the auto-generated schema

        // Name the schema
        await ctx.fill(WS.SCHEMA_NAME_INPUT, 'Greeting Schema');
        await ctx.delay(500);

        // Set direction to "both" — validate sent AND received messages
        await ctx.selectOption(WS.SCHEMA_DIRECTION_SELECT, 'both');
        await ctx.delay(500);

        // Replace with a strict greeting-only schema so status/error messages show ✗
        const schema = JSON.stringify({
          type: 'object',
          required: ['type', 'message'],
          properties: {
            type: { type: 'string', enum: ['greeting'] },
            message: { type: 'string' },
          },
        }, null, 2);
        await ctx.fill(WS.SCHEMA_TEXTAREA, schema);
        await ctx.delay(900); // user reads the JSON before we save

        // Save — user sees the schema card appear
        await ctx.click(WS.SCHEMA_SAVE_BTN);
        await ctx.delay(700);
      },
      verify: WS.SCHEMA_CARD,
      pauseAfter: true,
    },

    // ── 9. Validation Badges ─────────────────────────────────────
    {
      id: 'schema-validate',
      title: 'Live Validation Badges',
      description:
        'Switch back to Events — every JSON message now shows a validation badge. ' +
        'The two **greeting** messages show ✓ (valid) because they match the schema. ' +
        '**Status** and **error** messages show ✗ (invalid) — they lack the required ' +
        '`type: "greeting"` field. Use the **Validation** dropdown to filter to ' +
        'valid-only or invalid-only — perfect for spotting unexpected message formats.',
      highlight: WS.RIGHT_TAB_EVENTS,
      preAction: async (ctx) => {
        // Guard: if user skipped steps 7–8 (clicked Next during reading),
        // the schema may not exist. Create it quietly so this step works.
        // Also ensure the validation toggle is enabled even if schema already exists.
        if (!document.querySelector(WS.VALIDATION_TOGGLE)) {
          await ctx.click(WS.RIGHT_TAB_SCHEMA);
          await ctx.waitFor(WS.VALIDATION_TOGGLE);
        }
        // Enable validation toggle regardless of whether schema exists
        const toggle = document.querySelector(WS.VALIDATION_TOGGLE) as HTMLInputElement | null;
        if (toggle && !toggle.checked) {
          await ctx.click(WS.VALIDATION_TOGGLE);
          await ctx.delay(300);
        }
        // Create schema if absent
        if (!document.querySelector(WS.SCHEMA_CARD)) {
          await ctx.click(WS.SCHEMA_ADD_BTN);
          await ctx.waitFor(WS.SCHEMA_NAME_INPUT);
          await ctx.fill(WS.SCHEMA_NAME_INPUT, 'Greeting Schema');
          await ctx.selectOption(WS.SCHEMA_DIRECTION_SELECT, 'both');
          const schema = JSON.stringify({
            type: 'object',
            required: ['type', 'message'],
            properties: {
              type: { type: 'string', enum: ['greeting'] },
              message: { type: 'string' },
            },
          }, null, 2);
          await ctx.fill(WS.SCHEMA_TEXTAREA, schema);
          await ctx.click(WS.SCHEMA_SAVE_BTN);
          await ctx.waitFor(WS.SCHEMA_CARD, 3000);
        }
      },
      action: async (ctx) => {
        // Switch back to events tab — user sees validation badges on each message
        await ctx.click(WS.RIGHT_TAB_EVENTS);
        await ctx.delay(800);
      },
      pauseAfter: true,
    },
  ],
};
