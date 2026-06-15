/** Lesson 13: Advanced Mock Server — rules engine, delays, template variables */
import type { DemoLesson } from '../../types';
import { startMockServer, stopMockServer, switchToClientMode, disconnectWebSocket } from '../setup-helpers';
import { WS } from '../../../../shared/selectors';

export const wsMockServerAdvancedLesson: DemoLesson = {
  id: 'ws-mock-server-advanced',
  domainId: 'protocols',
  category: 'websocket',
  name: 'Advanced Mock Server',
  description: 'Go beyond echo — write response rules, set delays, use template variables, and test rules before going live.',
  estimatedMinutes: 3,
  initialTab: 'websocket-studio',

  setup: async (ctx) => {
    // Switch to Mock mode so the rules pane is accessible
    await ctx.click(WS.MODE_MOCK);
    await ctx.delay(500); // allow async rule-load from storage to settle
    // Delete any leftover rules one at a time to avoid React stale-closure issues
    const deleteFirstRule = (): boolean => {
      const btn = document.querySelector<HTMLButtonElement>(WS.MOCK_RULE_DELETE_ANY);
      if (btn) { btn.click(); return true; }
      return false;
    };
    while (deleteFirstRule()) await ctx.delay(250);
    // Start the server and go to client mode for a clean starting position
    await startMockServer(ctx);
    await switchToClientMode(ctx);
  },

  cleanup: async (ctx) => {
    await disconnectWebSocket(ctx);
    // Delete rules created during the demo so they don't leak into the next run
    await ctx.click(WS.MODE_MOCK);
    await ctx.delay(400);
    const deleteFirstRule = (): boolean => {
      const btn = document.querySelector<HTMLButtonElement>(WS.MOCK_RULE_DELETE_ANY);
      if (btn) { btn.click(); return true; }
      return false;
    };
    while (deleteFirstRule()) await ctx.delay(250);
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
      action: async (ctx) => {
        await ctx.click(WS.MOCK_ADD_RULE);
        await ctx.delay(800); // let the user see the card expand
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
      action: async (ctx) => {
        // Click the visible toggle label (not the CSS-hidden checkbox) for correct ripple positioning
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
    },
    {
      id: 'mock-adv-live',
      title: 'Rules Fire Live — Connect and Test',
      description: `Push the rules to the server and verify them live.

**What happens:**
1. Switch to **Client mode**, connect to \`ws://localhost:9876\`
2. Send \`ping\` — the rule fires and responds with \`{"type":"pong","ts":"…"}\` after 200ms
3. Send a non-matching message — the fallback (echo) responds immediately

Watch the Events panel to see rule-matched vs fallback responses side by side.`,
      highlight: WS.SEND_BTN,
      pauseAfter: true,
      preAction: async (ctx) => {
        // Ensure mock server is running before connecting
        await ctx.click(WS.MODE_MOCK);
        await ctx.delay(300);
        const startBtn = document.querySelector(WS.MOCK_START_BTN) as HTMLButtonElement | null;
        if (startBtn && !startBtn.disabled) {
          startBtn.click();
          await ctx.delay(800);
        }
        // Switch to client mode and connect
        await ctx.click(WS.MODE_CLIENT);
        await ctx.delay(300);
        await ctx.click(WS.LEFT_TAB_CONNECT);
        await ctx.fill(WS.URL_INPUT, 'ws://localhost:9876');
        await ctx.click(WS.CONNECT_BTN);
        await ctx.delay(1500); // wait for connection to establish
        await ctx.click(WS.LEFT_TAB_COMPOSE);
      },
      action: async (ctx) => {
        // Send ping — rule fires with template response + 200ms delay
        await ctx.fill(WS.MESSAGE_INPUT, 'ping');
        await ctx.delay(400);
        await ctx.click(WS.SEND_BTN);
        await ctx.delay(1500); // let user see the rule-matched pong response
        // Send a non-matching message — fallback echo fires immediately
        await ctx.fill(WS.MESSAGE_INPUT, 'hello world');
        await ctx.delay(400);
        await ctx.click(WS.SEND_BTN);
        await ctx.delay(1200); // let user see the fallback echo response
      },
      verify: WS.MESSAGE_ROW,
    },
  ],
};
