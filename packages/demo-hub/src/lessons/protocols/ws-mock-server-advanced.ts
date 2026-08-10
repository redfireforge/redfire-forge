/** Lesson 13: Advanced Mock Server — rules engine, delays, template variables */
import type { DemoActionContext, DemoLesson } from '../../types';
import {
  startMockServer,
  stopMockServer,
  switchToClientMode,
  disconnectWebSocket,
  clearAllMockRules,
} from '../setup-helpers';
import { WS } from '@shared/selectors';
import { firstVisibleElement } from '../../utils/domVisibility';
import { showSpotlightRing } from '../../demoRipple';

/** Port captured quietly in mock-adv-live preAction for the visible Connect beat. */
let _advLivePort = '9876';

/** Spotlight a visible element, hold so the viewer can read, then clear. */
async function spotlightAndPause(
  ctx: DemoActionContext,
  selector: string,
  holdMs: number,
): Promise<void> {
  const el = firstVisibleElement<HTMLElement>(selector);
  if (!el) {
    await ctx.delay(holdMs);
    return;
  }
  el.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
  const dispose = showSpotlightRing(el);
  try {
    await ctx.delay(holdMs);
  } finally {
    dispose();
  }
}

export const wsMockServerAdvancedLesson: DemoLesson = {
  id: 'ws-mock-server-advanced',
  domainId: 'protocols',
  category: 'websocket',
  name: 'Advanced Mock Server',
  description: 'Go beyond echo — write response rules, set delays, use template variables, and test rules before going live.',
  estimatedMinutes: 4,
  initialTab: 'websocket-studio',

  setup: async (ctx) => {
    // Switch to Mock mode so the rules pane is accessible (skip if already there)
    const alreadyMock = !!document.querySelector('[data-testid="mode-mock"].active, [data-testid="mode-mock"][aria-selected="true"]');
    if (!alreadyMock) {
      document.querySelector<HTMLElement>(WS.MODE_MOCK)?.click();
    }
    // Wait for async per-port rule hydrate from storage, then clear leftovers.
    // clearAllMockRules retries so a late hydrate cannot resurrect old cards.
    await ctx.delay(600);
    await clearAllMockRules(ctx);
    // Start the server and go to client mode for a clean starting position
    await startMockServer(ctx);
    await switchToClientMode(ctx);
  },

  cleanup: async (ctx) => {
    await disconnectWebSocket(ctx);
    // Delete rules created during the demo so they don't leak into the next run
    await ctx.click(WS.MODE_MOCK);
    await ctx.delay(400);
    await clearAllMockRules(ctx);
    await stopMockServer(ctx);
    await switchToClientMode(ctx);
  },

  concept: {
    title: 'Mock Server Rules Engine',
    body: `Lesson 1 showed the Mock Server in echo mode — every message bounced straight back. That's useful for a quick smoke test, but real-world scenarios need **conditional responses**.

The Rules Engine lets you define patterns:
- **Match** incoming messages by exact text, substring, or regex
- **Respond** with custom JSON, a delay, or a close-connection frame
- **Enable / disable** individual rules without deleting them
- **Priority order** — the first matching rule wins; fallback handles the rest

**Template variables** make responses dynamic:
\`\`\`
{"ts": "{{timestamp}}", "id": "{{uuid}}", "echo": "{{message}}"}
\`\`\`

**Rule Test Preview** lets you paste a sample message and see which rule fires before you start the server — no trial-and-error.

**Fallback mode** controls what happens when no rule matches:
- \`echo\` — send the message back unchanged (default)
- \`ignore\` — silently discard the message
- \`close\` — terminate the connection`,

    keyTerms: [
      { term: 'Match pattern', definition: 'The text, substring, or regex the incoming message is compared against. First matching rule wins.' },
      { term: 'Fallback mode', definition: 'What the server does when no rule matches: echo (default), ignore, or close the connection.' },
      { term: 'Template variable', definition: 'A placeholder like {{timestamp}} or {{uuid}} replaced with a live value when the response is sent.' },
      { term: 'Rule priority', definition: 'Rules are evaluated top-to-bottom. Drag to reorder — earlier rules have higher priority.' },
    ],

    diagram: `<svg viewBox="0 0 460 160" xmlns="http://www.w3.org/2000/svg">
  <!-- Client -->
  <rect x="10" y="60" width="90" height="40" rx="6" fill="var(--primary)" opacity="0.2" stroke="var(--primary)" stroke-width="1.5"/>
  <text x="55" y="85" text-anchor="middle" fill="var(--text)" font-size="12" font-family="system-ui">Client</text>
  <!-- Rules Engine -->
  <rect x="160" y="30" width="140" height="100" rx="6" fill="var(--accent)" opacity="0.1" stroke="var(--accent)" stroke-width="1.5" stroke-dasharray="4 3"/>
  <text x="230" y="55" text-anchor="middle" fill="var(--text)" font-size="11" font-family="system-ui" font-weight="600">Rules Engine</text>
  <rect x="175" y="62" width="110" height="20" rx="3" fill="var(--accent)" opacity="0.25"/>
  <text x="230" y="76" text-anchor="middle" fill="var(--text)" font-size="10" font-family="system-ui">Rule 1: /ping → pong</text>
  <rect x="175" y="87" width="110" height="20" rx="3" fill="var(--accent)" opacity="0.18"/>
  <text x="230" y="101" text-anchor="middle" fill="var(--text)" font-size="10" font-family="system-ui">Rule 2: /error → close</text>
  <text x="230" y="122" text-anchor="middle" fill="var(--text-muted)" font-size="10" font-family="system-ui" font-style="italic">fallback: echo</text>
  <!-- Response -->
  <rect x="360" y="60" width="90" height="40" rx="6" fill="var(--success)" opacity="0.2" stroke="var(--success)" stroke-width="1.5"/>
  <text x="405" y="85" text-anchor="middle" fill="var(--text)" font-size="12" font-family="system-ui">Response</text>
  <!-- Arrows -->
  <line x1="100" y1="75" x2="160" y2="75" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#adv-a1)"/>
  <text x="130" y="70" text-anchor="middle" fill="var(--text-muted)" font-size="9">/ping</text>
  <line x1="300" y1="75" x2="360" y2="75" stroke="var(--success)" stroke-width="1.5" marker-end="url(#adv-a2)"/>
  <text x="330" y="70" text-anchor="middle" fill="var(--text-muted)" font-size="9">pong</text>
  <defs>
    <marker id="adv-a1" markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="none" stroke="var(--primary)" stroke-width="1.5"/></marker>
    <marker id="adv-a2" markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="none" stroke="var(--success)" stroke-width="1.5"/></marker>
  </defs>
</svg>`,
  },

  steps: [
    {
      id: 'mock-adv-rules-tab',
      title: 'Switch to Mock Mode — Rules Tab',
      description: `Lesson 1 kept you in echo mode the whole time. There's a **Rules tab** in the mock panel that reveals the real power.

Switch to **Mock mode**, then click the **Rules** tab in the right panel. You'll see an empty rule list and an **+ Add Rule** button at the bottom.`,
      highlight: WS.MODE_MOCK,
      pauseAfter: true,
      action: async (ctx) => {
        await ctx.click(WS.MODE_MOCK);
        // MOCK_TAB_RULES only renders in Mock mode — wait before clicking
        await ctx.waitFor(WS.MOCK_TAB_RULES);
        await ctx.delay(400);
        await ctx.click(WS.MOCK_TAB_RULES);
        await ctx.delay(300);
      },
    },
    {
      id: 'mock-adv-add-rule',
      title: 'Add Your First Rule',
      description: `Click **+ Add Rule** to create a new response rule. A rule card expands with fields:

- **Pattern** — the text to match in incoming messages
- **Response** — what to send back
- **Delay** — optional ms pause before responding

Change the **Match type** dropdown to **Contains**, then type \`ping\` in the **Pattern** field. The rule will fire whenever any client sends a message containing "ping".`,
      highlight: WS.MOCK_ADD_RULE,
      pauseAfter: true,
      preAction: async (ctx) => {
        // Guard: Mock mode + Rules tab + empty list (no leftover Rule 1/2 from prior runs)
        await ctx.click(WS.MODE_MOCK);
        await ctx.delay(300);
        await ctx.waitFor(WS.MOCK_TAB_RULES);
        await ctx.click(WS.MOCK_TAB_RULES);
        await ctx.delay(200);
        await clearAllMockRules(ctx);
      },
      action: async (ctx) => {
        // Only create a rule when the list is empty — never stack a "Rule 2"
        // on top of an uncleared leftover.
        if (!firstVisibleElement(WS.MOCK_RULE_FIRST)) {
          await ctx.click(WS.MOCK_ADD_RULE);
          await ctx.delay(800); // let the user see the card expand
        } else {
          // Expand the existing single card if somehow one remains
          const expand = firstVisibleElement<HTMLElement>('[data-testid^="rule-expand-"]')
            ?? firstVisibleElement<HTMLElement>('.ws-mock-rule-header');
          expand?.click();
          await ctx.delay(500);
        }
        // Change match type from 'any' → 'contains' so the pattern input appears in the DOM
        await ctx.selectOption(WS.MOCK_RULE_MATCH_TYPE_FIRST, 'contains');
        await ctx.delay(500); // let user see the dropdown change
        await ctx.waitFor(WS.MOCK_RULE_PATTERN_FIRST);
        await ctx.fill(WS.MOCK_RULE_PATTERN_FIRST, 'ping');
        await ctx.delay(600); // let user read the filled value
      },
    },
    {
      id: 'mock-adv-response',
      title: 'Set the Response — With a Template Variable',
      description: `Change the **Response type** to **Template**, then fill in the response textarea with a dynamic JSON payload:

\`\`\`json
{"type": "pong", "ts": "{{timestamp}}"}
\`\`\`

\`{{timestamp}}\` is replaced with the current Unix timestamp every time the rule fires — so each response is unique. Other built-in variables: \`{{uuid}}\`, \`{{message}}\` (echoes the raw input), \`{{rand}}\` (random number).`,
      highlight: WS.MOCK_RULE_RESPONSE_TYPE_FIRST,
      pauseAfter: true,
      preAction: async (ctx) => {
        // Guard: ensure Mock mode + Rules tab + rule card open
        await ctx.click(WS.MODE_MOCK);
        await ctx.delay(300);
        await ctx.waitFor(WS.MOCK_TAB_RULES);
        await ctx.click(WS.MOCK_TAB_RULES);
        await ctx.delay(200);
        if (!firstVisibleElement(WS.MOCK_RULE_RESPONSE_TYPE_FIRST)) {
          // Rule card closed or no rule — open/create one
          const ruleNameBtn = firstVisibleElement<HTMLElement>('.ws-mock-rule-name');
          if (ruleNameBtn) {
            ruleNameBtn.click();
            await ctx.delay(200);
          } else {
            const addBtn = firstVisibleElement<HTMLButtonElement>(WS.MOCK_ADD_RULE);
            if (addBtn) { addBtn.click(); await ctx.delay(200); }
            const matchSel = firstVisibleElement<HTMLSelectElement>(WS.MOCK_RULE_MATCH_TYPE_FIRST);
            if (matchSel) {
              matchSel.value = 'contains';
              matchSel.dispatchEvent(new Event('change', { bubbles: true }));
              await ctx.delay(200);
            }
          }
        }
      },
      action: async (ctx) => {
        // Change response type from 'echo' → 'template' so the data textarea appears in the DOM
        await ctx.selectOption(WS.MOCK_RULE_RESPONSE_TYPE_FIRST, 'template');
        await ctx.delay(500); // let user see dropdown change
        await ctx.waitFor(WS.MOCK_RULE_RESPONSE_FIRST);
        await ctx.fill(WS.MOCK_RULE_RESPONSE_FIRST, '{"type": "pong", "ts": "{{timestamp}}"}');
        await ctx.delay(800); // let user read the JSON template
      },
    },
    {
      id: 'mock-adv-delay',
      title: 'Add a Response Delay',
      description: `The **Delay** field simulates network latency. Set it to \`200\` ms — now every "ping" response will arrive 200ms after the message is received.

This is useful for:
- Testing loading spinners and skeleton states
- Simulating slow backends in CI
- Reproducing race conditions`,
      highlight: WS.MOCK_RULE_DELAY_FIRST,
      pauseAfter: true,
      preAction: async (ctx) => {
        // Guard: ensure Mock mode + Rules tab + rule card open (delay input is inside isOpen block)
        await ctx.click(WS.MODE_MOCK);
        await ctx.delay(300);
        await ctx.waitFor(WS.MOCK_TAB_RULES);
        await ctx.click(WS.MOCK_TAB_RULES);
        await ctx.delay(200);
        if (!firstVisibleElement(WS.MOCK_RULE_RESPONSE_TYPE_FIRST)) {
          const ruleNameBtn = firstVisibleElement<HTMLElement>('.ws-mock-rule-name');
          if (ruleNameBtn) {
            ruleNameBtn.click();
            await ctx.delay(200);
          } else {
            const addBtn = firstVisibleElement<HTMLButtonElement>(WS.MOCK_ADD_RULE);
            if (addBtn) { addBtn.click(); await ctx.delay(200); }
            const matchSel = firstVisibleElement<HTMLSelectElement>(WS.MOCK_RULE_MATCH_TYPE_FIRST);
            if (matchSel) {
              matchSel.value = 'contains';
              matchSel.dispatchEvent(new Event('change', { bubbles: true }));
              await ctx.delay(200);
            }
          }
        }
      },
      action: async (ctx) => {
        await ctx.fill(WS.MOCK_RULE_DELAY_FIRST, '200');
        await ctx.delay(600); // let user read the filled value
      },
    },
    {
      id: 'mock-adv-test-preview',
      title: 'Rule Test Preview — Verify Before You Connect',
      description: `The **Test Preview** section lets you paste a sample message and instantly see which rule would fire — without starting the server or connecting a client.

Type \`ping\` in the test input and watch the preview show your rule's response with \`{{timestamp}}\` resolved to a real value.

**Fix problems before they reach clients** — no trial-and-error debugging.`,
      highlight: WS.MOCK_TEST_SECTION,
      pauseAfter: true,
      preAction: async (ctx) => {
        // Guard: ensure Mock mode + Rules tab (test section is always in the rules pane)
        await ctx.click(WS.MODE_MOCK);
        await ctx.delay(300);
        await ctx.waitFor(WS.MOCK_TAB_RULES);
        await ctx.click(WS.MOCK_TAB_RULES);
        await ctx.delay(200);
      },
      action: async (ctx) => {
        await ctx.fill(WS.MOCK_TEST_INPUT, 'ping');
        await ctx.delay(1200); // let user see and read the preview result
      },
    },
    {
      id: 'mock-adv-toggle',
      title: 'Enable / Disable a Rule',
      description: `Every rule has an **enable/disable toggle**. Click it to disable the rule — the card dims and the rule is skipped during matching. The fallback mode takes over.

This is much safer than deleting a rule you might need again. Toggle the rule off and back on to confirm it works.`,
      highlight: WS.MOCK_RULE_TOGGLE_LABEL_FIRST,
      pauseAfter: true,
      preAction: async (ctx) => {
        // Guard: ensure Mock mode + Rules tab + at least one rule (toggle needs a rule card)
        await ctx.click(WS.MODE_MOCK);
        await ctx.delay(300);
        await ctx.waitFor(WS.MOCK_TAB_RULES);
        await ctx.click(WS.MOCK_TAB_RULES);
        await ctx.delay(200);
        if (!firstVisibleElement(WS.MOCK_RULE_TOGGLE_LABEL_FIRST)) {
          const addBtn = firstVisibleElement<HTMLButtonElement>(WS.MOCK_ADD_RULE);
          if (addBtn) { addBtn.click(); await ctx.delay(200); }
        }
        // Scroll the rule card into view so the toggle is fully visible
        firstVisibleElement<HTMLElement>(WS.MOCK_RULE_TOGGLE_LABEL_FIRST)
          ?.closest('[data-testid^="rule-card-"], .ws-mock-rule-card')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        await ctx.delay(300);
      },
      action: async (ctx) => {
        // Ensure the rule card is fully visible before spotlighting the toggle
        firstVisibleElement<HTMLElement>(WS.MOCK_RULE_TOGGLE_LABEL_FIRST)
          ?.closest('[data-testid^="rule-card-"], .ws-mock-rule-card')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        await ctx.delay(400);
        await ctx.click(WS.MOCK_RULE_TOGGLE_LABEL_FIRST);
        await ctx.delay(1200); // let user see the disabled/dimmed state
        await ctx.click(WS.MOCK_RULE_TOGGLE_LABEL_FIRST);
        await ctx.delay(600); // let user see re-enabled state
      },
    },
    {
      id: 'mock-adv-fallback',
      title: 'Fallback Mode — What Happens When No Rule Matches',
      description: `The **Fallback** dropdown (in the server controls, above the start button) controls what happens when an incoming message doesn't match any rule:

| Mode | Behaviour |
|---|---|
| \`echo\` | Sends the message straight back *(default)* |
| \`ignore\` | Silently discards the message |
| \`close\` | Disconnects the client |

Leave it on \`echo\` — unmatched messages still get a response, so your app won't silently hang.`,
      highlight: WS.MOCK_FALLBACK_SELECT,
      pauseAfter: true,
      preAction: async (ctx) => {
        // Guard: MOCK_FALLBACK_SELECT only renders in Mock mode
        await ctx.click(WS.MODE_MOCK);
        await ctx.delay(300);
        // Remove any orphaned CustomSelect portal left by a prior pass
        document.querySelectorAll('body > .cs-menu').forEach((m) => m.remove());
      },
      action: async (ctx) => {
        // Must use the *visible* Fallback select — inactive WS tabs keep their own
        // Mock chrome mounted (display:none). Opening a hidden select portals the
        // menu at (0,0) → floating Echo/Ignore/Close in the corner.
        const selectEl = firstVisibleElement<HTMLElement>(WS.MOCK_FALLBACK_SELECT);
        if (selectEl) {
          const dispose = showSpotlightRing(selectEl);
          await ctx.delay(600);
          dispose();
          const trigger = selectEl.querySelector<HTMLElement>('.cs-trigger');
          trigger?.click();
          await ctx.delay(300);
          // Prefer the menu belonging to this trigger (aria-controls / nearest open).
          const menu = document.querySelector<HTMLElement>('body > .cs-menu');
          if (menu) {
            const disposeMenu = showSpotlightRing(menu);
            await ctx.delay(1800);
            disposeMenu();
          } else {
            await ctx.delay(1800);
          }
          // Close without a bare Escape on document (that exits the live demo).
          // Mark synthetic Escape so useDemoShortcuts ignores it, and fire on the
          // trigger so CustomSelect's key handler collapses the menu.
          if (trigger) {
            const esc = new KeyboardEvent('keydown', {
              key: 'Escape',
              bubbles: true,
              cancelable: true,
            });
            (esc as KeyboardEvent & { __demoAction?: boolean }).__demoAction = true;
            trigger.dispatchEvent(esc);
            await ctx.delay(100);
            // Belt: toggle-close if still expanded
            if (trigger.getAttribute('aria-expanded') === 'true') {
              trigger.click();
              await ctx.delay(100);
            }
          }
          // Belt: strip any leftover portaled menus so they cannot stick in the corner
          document.querySelectorAll('body > .cs-menu').forEach((m) => m.remove());
          await ctx.delay(150);
        } else {
          await ctx.delay(600);
        }
      },
    },
    {
      id: 'mock-adv-live',
      title: 'Rules Fire Live — Connect and Test',
      description:
        'Watch the full live path, one beat at a time:\n\n' +
        '1. **Connect** — open the Connect panel, set this tab\'s mock URL, click **Connect** (status turns green)\n' +
        '2. **Events** — confirm the Connected system row\n' +
        '3. **Send `ping`** — the rule replies with `{"type":"pong","ts":"…"}` after the 200ms delay\n' +
        '4. **Send `hello world`** — no rule matches, so **Fallback: echo** returns the same text\n\n' +
        'Keep your eyes on the Events log for rule-matched vs echo responses.',
      // Reading spotlight: Connect panel — Connect beats run first in action().
      highlight: WS.LEFT_TAB_CONNECT,
      pauseAfter: true,
      preAction: async (ctx) => {
        // Quiet only: ensure mock is listening and capture port. Visible Connect/Send
        // beats belong in action() so the viewer can follow them.
        document.querySelectorAll('body > .cs-menu').forEach((m) => m.remove());
        const mockActive = !!document.querySelector(
          '[data-testid="mode-mock"].active, [data-testid="mode-mock"][aria-selected="true"]',
        );
        if (!mockActive) {
          document.querySelector<HTMLElement>(WS.MODE_MOCK)?.click();
          await ctx.delay(160);
        }
        const startBtn = firstVisibleElement<HTMLButtonElement>(WS.MOCK_START_BTN);
        if (startBtn && !startBtn.disabled) {
          startBtn.click();
          await ctx.delay(400);
        }
        const portInput = firstVisibleElement<HTMLInputElement>(WS.MOCK_PORT_INPUT);
        _advLivePort = portInput?.value?.trim() || '9876';
        // Land on Client → Connect so the reading spotlight matches the UI.
        document.querySelector<HTMLElement>(WS.MODE_CLIENT)?.click();
        await ctx.delay(120);
        document.querySelector<HTMLElement>(WS.LEFT_TAB_CONNECT)?.click();
        await ctx.delay(120);
      },
      action: async (ctx) => {
        // ── 1. Connect configuration (visible) ─────────────────────────
        await spotlightAndPause(ctx, WS.MODE_CLIENT, 700);
        await ctx.click(WS.MODE_CLIENT);
        await ctx.delay(500);
        await spotlightAndPause(ctx, WS.LEFT_TAB_CONNECT, 900);
        await ctx.click(WS.LEFT_TAB_CONNECT);
        await ctx.waitFor(WS.URL_INPUT);
        await ctx.delay(500);

        await spotlightAndPause(ctx, WS.URL_INPUT, 1000);
        await ctx.fill(WS.URL_INPUT, `ws://localhost:${_advLivePort}`);
        await spotlightAndPause(ctx, WS.URL_INPUT, 1200);

        if (!firstVisibleElement(WS.STATUS_CONNECTED)) {
          await spotlightAndPause(ctx, WS.CONNECT_BTN, 1100);
          await ctx.click(WS.CONNECT_BTN);
          await ctx.waitFor(WS.STATUS_CONNECTED);
          await spotlightAndPause(ctx, WS.STATUS_CONNECTED, 1000);
        } else {
          await spotlightAndPause(ctx, WS.STATUS_CONNECTED, 800);
        }

        // ── 2. Events — connection row ─────────────────────────────────
        await spotlightAndPause(ctx, WS.RIGHT_TAB_EVENTS, 800);
        await ctx.click(WS.RIGHT_TAB_EVENTS);
        await ctx.delay(900);

        // ── 3. Send ping (rule match) ──────────────────────────────────
        await spotlightAndPause(ctx, WS.LEFT_TAB_SEND, 900);
        await ctx.click(WS.LEFT_TAB_SEND);
        await ctx.waitFor(WS.MESSAGE_INPUT);
        await ctx.delay(500);

        await ctx.fill(WS.MESSAGE_INPUT, 'ping');
        await spotlightAndPause(ctx, WS.MESSAGE_INPUT, 1100);
        await spotlightAndPause(ctx, WS.SEND_BTN, 800);
        await ctx.click(WS.SEND_BTN);
        // Rule delay 200ms + Events settle — let viewer see pong arrive
        await ctx.click(WS.RIGHT_TAB_EVENTS);
        await ctx.delay(1600);

        // ── 4. Send non-match (echo fallback) ──────────────────────────
        await ctx.click(WS.LEFT_TAB_SEND);
        await ctx.delay(500);
        await ctx.fill(WS.MESSAGE_INPUT, 'hello world');
        await spotlightAndPause(ctx, WS.MESSAGE_INPUT, 1100);
        await spotlightAndPause(ctx, WS.SEND_BTN, 800);
        await ctx.click(WS.SEND_BTN);
        await ctx.click(WS.RIGHT_TAB_EVENTS);
        await ctx.delay(1400);
        // Leave Events visible for the step outcome / verify
        await spotlightAndPause(ctx, WS.MESSAGE_ROW, 1000);
      },
      verify: WS.MESSAGE_ROW,
    },
  ],
};
