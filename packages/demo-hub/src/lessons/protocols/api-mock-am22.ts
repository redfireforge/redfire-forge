/**
 * AM-22 `am-22-workflow` — Workflow Orchestration: Start → Apply → Reset →
 * Assert → Stop.
 *
 * Scenario: a checkout mock is already in the workspace and the Designer
 * opens on an empty canvas. The lesson drops the five mock blocks plus an
 * HTTP call, configures isolation and journal assertions live, and
 * connects each node as it lands (Start → Apply → HTTP → Assert → Reset
 * → Stop). Quick Test then runs the lifecycle green. Curriculum:
 * API Mock demo curriculum v2 §5 Track E.
 */
import { API_MOCK, WF } from '@shared/selectors';
import type { DemoLesson } from '../../types';
import {
  AM22_ASSERT_BODY,
  AM22_ASSERT_MIN,
  AM22_ASSERT_RECENCY,
  AM22_ASSERT_STATUS,
  AM22_HTTP_URL,
  am22PassSelector,
  cleanupAm22,
  ensureAm22Designer,
  ensureAm22ForPalette,
  ensureAm22ForApply,
  ensureAm22ForAssert,
  ensureAm22ForHttp,
  ensureAm22ForQuickTest,
  ensureAm22ForReset,
  ensureAm22ForStart,
  ensureAm22ForStop,
  ensureAm22ForWire,
  prepareAm22Workspace,
  runAm22ApplyNode,
  runAm22AssertNode,
  runAm22DesignerPalette,
  runAm22HttpNode,
  runAm22QuickTest,
  runAm22ResetNode,
  runAm22StartNode,
  runAm22StopNode,
  runAm22Wire,
} from './api-mock-am22-helpers';
import { cleanupWorkflowDemoRunUi } from '../wf-demo-helpers';

const DIAGRAM = `
<svg viewBox="0 0 700 430" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Workflow that starts an isolated mock, applies the definition, posts to cart, asserts the journal, resets state, and stops">
  <rect x="0" y="0" width="700" height="430" fill="#0f172a" />

  <text x="26" y="34" fill="#f1f5f9" font-family="system-ui" font-size="16" font-weight="600">The mock is a node in the graph, not a side terminal.</text>
  <text x="26" y="54" fill="#64748b" font-family="system-ui" font-size="10">isolate · mockBaseUrl · apply · assert journal · reset · stop</text>

  <rect x="26" y="76" width="120" height="58" rx="8" fill="#1e293b" stroke="#38bdf8" />
  <text x="46" y="110" fill="#38bdf8" font-family="system-ui" font-size="12" font-weight="600">Start Mock</text>
  <rect x="166" y="76" width="120" height="58" rx="8" fill="#1e293b" stroke="#a78bfa" />
  <text x="186" y="110" fill="#a78bfa" font-family="system-ui" font-size="12" font-weight="600">Apply</text>
  <rect x="306" y="76" width="120" height="58" rx="8" fill="#1e293b" stroke="#f59e0b" />
  <text x="326" y="110" fill="#f59e0b" font-family="system-ui" font-size="12" font-weight="600">HTTP POST</text>
  <rect x="446" y="76" width="120" height="58" rx="8" fill="#1e293b" stroke="#22c55e" />
  <text x="466" y="110" fill="#22c55e" font-family="system-ui" font-size="12" font-weight="600">Assert</text>
  <rect x="26" y="168" width="120" height="58" rx="8" fill="#1e293b" stroke="#f97316" />
  <text x="46" y="202" fill="#f97316" font-family="system-ui" font-size="12" font-weight="600">Reset</text>
  <rect x="166" y="168" width="120" height="58" rx="8" fill="#1e293b" stroke="#94a3b8" />
  <text x="186" y="202" fill="#94a3b8" font-family="system-ui" font-size="12" font-weight="600">Stop</text>

  <path d="M146 105 H166" stroke="#64748b" stroke-width="2" marker-end="url(#am22arrow)" />
  <path d="M286 105 H306" stroke="#64748b" stroke-width="2" marker-end="url(#am22arrow)" />
  <path d="M426 105 H446" stroke="#64748b" stroke-width="2" marker-end="url(#am22arrow)" />
  <path d="M506 134 V148 H86 V168" stroke="#64748b" stroke-width="2" fill="none" marker-end="url(#am22arrow)" />
  <path d="M146 197 H166" stroke="#64748b" stroke-width="2" marker-end="url(#am22arrow)" />
  <defs>
    <marker id="am22arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L6,3 L0,6 Z" fill="#64748b" />
    </marker>
  </defs>

  <rect x="26" y="250" width="648" height="70" rx="8" fill="#1e293b" stroke="#3b4a60" />
  <text x="42" y="278" fill="#f1f5f9" font-family="system-ui" font-size="12" font-weight="600">Isolate publishes mockPort / mockBaseUrl so HTTP never hard-codes a Studio tab port.</text>
  <text x="42" y="300" fill="#a8b8cc" font-family="system-ui" font-size="11">Assert reads the journal (min count, status, body, recency) — not a log scrape.</text>

  <rect x="26" y="338" width="648" height="70" rx="8" fill="#1e293b" stroke="#22c55e" />
  <text x="42" y="366" fill="#22c55e" font-family="system-ui" font-size="12" font-weight="600">Quick Test runs Start → Apply → POST /cart → Assert → Reset → Stop. Nodes turn green in order.</text>
  <text x="42" y="388" fill="#a8b8cc" font-family="system-ui" font-size="11">Stop is guaranteed teardown. Reset rewinds state so the next iteration starts clean.</text>
</svg>
`;

export const apiMockAm22Lesson: DemoLesson = {
  id: 'am-22-workflow',
  domainId: 'api-mock',
  category: 'api-mock',
  name: 'Workflow Orchestration: Start → Apply → Reset → Assert → Stop',
  description:
    'Open the Designer on an empty canvas, expand the API Mock palette, and '
    + 'drop Start, HTTP, Apply, Reset, Assert, and Stop. Isolate the listener '
    + `so HTTP can call \`${AM22_HTTP_URL}\`. Assert the journal (min `
    + `${AM22_ASSERT_MIN}, status ${AM22_ASSERT_STATUS}, body contains `
    + `\`${AM22_ASSERT_BODY}\`), wire the graph, then Quick Test until every `
    + 'node is green.',
  estimatedMinutes: 8,
  initialTab: 'workflow',
  allowedTabs: ['workflow', 'api-mock-studio'],
  collapseAppSidebarOnStart: true,
  contentVersion: 4,
  concept: {
    title: 'A mock that lives in the graph can start, prove, rewind, and stop with the run.',
    body:
      'Studio is where you author the contract. The **Workflow Designer** is '
      + 'where that contract becomes a repeatable lifecycle: start a private '
      + 'listener, hit it, assert the journal, rewind state, and tear down — '
      + 'without touching the Studio tab that is still open on the side.\n\n'
      + '**Isolate run** is the reason this is safe in parallel. The Start '
      + 'node binds an ephemeral server id and publishes `mockPort` / '
      + '`mockBaseUrl` so downstream HTTP never hard-codes a port that would '
      + 'clobber your Studio listener. **Apply** hot-swaps the definition mid-'
      + 'run for a second scenario. **Reset** rewinds the state machine and '
      + 'counters so the next iteration does not inherit the last cart. '
      + '**Assert Mock Calls** reads the journal — min count, status, body, '
      + 'header, recency — instead of scraping logs. **Stop** is guaranteed '
      + 'teardown even when an earlier node fails.\n\n'
      + '**Quick Test** is the one-click proof. Nodes turn green in order, and '
      + 'the assert node keeps the route and count as evidence you can read '
      + 'without opening a terminal.',
    keyTerms: [
      {
        term: 'Isolate run',
        definition:
          'Start binds a run-scoped server id and a private port so this workflow cannot collide with the Studio tab or another parallel run.',
      },
      {
        term: 'mockBaseUrl',
        definition:
          'The variable Start publishes after bind (`http://127.0.0.1:<port>`). HTTP and other nodes consume it instead of a hard-coded listen address.',
      },
      {
        term: 'Apply Definition',
        definition:
          'Hot-applies the current mock routes onto the running listener so a second scenario can swap rules without a restart.',
      },
      {
        term: 'Reset Mock State',
        definition:
          'Rewinds scenario state, sequence cursors, and match counters on the running listener so the next iteration starts clean.',
      },
      {
        term: 'Assert Mock Calls',
        definition:
          'Checks the mock journal: min/exact count, status, body substring, header, and how recently the last matching call arrived.',
      },
      {
        term: 'Quick Test',
        definition:
          'Runs the whole Designer graph once. Nodes turn green in order; the assert node keeps route and count as the run\'s evidence.',
      },
    ],
    diagram: DIAGRAM,
  },
  prepareBeforeNavigate: prepareAm22Workspace,
  setup: async (ctx) => {
    await ensureAm22Designer(ctx);
  },
  cleanup: async (ctx) => {
    await cleanupWorkflowDemoRunUi(ctx);
    await cleanupAm22();
  },
  steps: [
    {
      id: 'designer-palette',
      title: 'Mocks belong in the test graph, not a side terminal',
      description:
        'A mock is usually something you babysit: a terminal window, a port '
        + 'to remember, a process to kill when you are done. The **Workflow '
        + 'Designer** treats it as what it should be — a node you drop into a '
        + 'graph. Search **Mock** in the palette and the whole family lights up '
        + 'at once, Actions and Logic together: Start, Apply, Reset, Stop, and '
        + '**Assert Mock Calls**.\n\n'
        + 'That is the mental shift for this entire lesson — five blocks, one '
        + 'job. The *lifecycle* of a mock becomes part of the test graph '
        + 'instead of a thing you run on the side. The next steps drop them '
        + 'onto the canvas one at a time.',
      highlight: WF.PAL_SEARCH,
      preAction: ensureAm22ForPalette,
      action: async (ctx) => {
        await runAm22DesignerPalette(ctx);
      },
      verify: WF.PAL_API_MOCK_START,
    },
    {
      id: 'start-node',
      title: 'The lifecycle node, and why isolation matters',
      description:
        '**Start Mock Server** is where the lifecycle begins, and its most '
        + 'important setting is **Isolate run**. Left on, it binds an '
        + '*ephemeral* server id and a private port for this graph alone — '
        + 'which is the only reason you can run this workflow while a Studio '
        + 'tab is still live on the same mock without the two clobbering each '
        + 'other.\n\n'
        + 'Point it at the **Cart API** already in the workspace, and have it '
        + 'publish its port and address as `mockPort` / `mockBaseUrl`. Those '
        + 'names matter: they are the handle every downstream node uses instead '
        + 'of hard-coding a port that isolation is free to change.',
      highlight: WF.PAL_API_MOCK_START,
      preAction: ensureAm22ForStart,
      action: async (ctx) => {
        await runAm22StartNode(ctx);
      },
      verify: API_MOCK.CANVAS_START,
    },
    {
      id: 'apply-node',
      title: 'Hot-swap the rule set mid-run for a second scenario',
      description:
        'Starting a listener binds the port; **Apply Definition** decides '
        + '*what rules it serves*. Separating the two is what makes a second '
        + 'scenario possible — Apply can hot-swap the route set onto the '
        + 'running listener mid-run, with no restart, so one graph can test '
        + '“empty cart” then “full cart” back to back.\n\n'
        + 'Point this node at the **Cart API** too, and note it talks to '
        + '`{{mockServerId}}` from Start, not the Studio tab’s id — the '
        + 'isolation from the previous step flows straight through. This first '
        + 'run simply reapplies the cart contract before the POST, '
        + 'establishing the pattern.',
      highlight: WF.PAL_API_MOCK_APPLY,
      preAction: ensureAm22ForApply,
      action: async (ctx) => {
        await runAm22ApplyNode(ctx);
      },
      verify: API_MOCK.CANVAS_APPLY,
    },
    {
      id: 'http-node',
      title: 'Downstream nodes consume the published base URL',
      description:
        'This is the payoff of publishing `mockBaseUrl`: the **HTTP Request** '
        + `node posts to \`${AM22_HTTP_URL}\` — a template, not a hard-coded `
        + '`localhost:4600`. Start has not run yet, so that URL is a '
        + '*promise*.\n\n'
        + 'When Quick Test binds the isolated listener on whatever port it '
        + 'chooses, this node resolves the variable and hits the right place '
        + 'automatically. That indirection is exactly what lets the same graph '
        + 'run in parallel, in CI, or on a colleague’s machine without anyone '
        + 'editing a port by hand.',
      highlight: WF.PAL_HTTP,
      preAction: ensureAm22ForHttp,
      action: async (ctx) => {
        await runAm22HttpNode(ctx);
      },
      verify: WF.NODE_HTTP,
    },
    {
      id: 'assert-node',
      title: 'Assert against the journal, not your logs',
      description:
        'A green HTTP node only tells you the *request came back* — it says '
        + 'nothing about whether the mock actually did the right thing. '
        + '**Assert Mock Calls** closes that gap by reading the mock’s '
        + `**journal** directly: min count ${AM22_ASSERT_MIN}, status `
        + `${AM22_ASSERT_STATUS}, body containing \`${AM22_ASSERT_BODY}\`, an `
        + `optional header, and how recently (${AM22_ASSERT_RECENCY} ms) the `
        + 'last matching call arrived.\n\n'
        + 'That is the difference between a smoke test and a real one: instead '
        + 'of scraping logs and hoping, the assertion queries the source of '
        + 'truth about what the mock actually received.',
      highlight: WF.PAL_API_MOCK_ASSERT,
      preAction: ensureAm22ForAssert,
      action: async (ctx) => {
        await runAm22AssertNode(ctx);
      },
      verify: API_MOCK.CANVAS_ASSERT,
    },
    {
      id: 'reset-node',
      title: 'Rewind the state machine between iterations',
      description:
        'State is what makes the *second* iteration lie. A stateful mock that '
        + 'still remembers the last cart will happily pass a run that should '
        + 'have started empty. **Reset Mock State** rewinds scenario state, '
        + 'sequence cursors, and match counters on the running listener so '
        + 'every loop begins from a known-clean baseline.\n\n'
        + 'Today’s checkout mock is a simple POST, so the effect is subtle — '
        + 'but wiring Reset in now is the habit that keeps a stateful suite '
        + 'honest later. A test you cannot repeat cleanly is not really a test.',
      highlight: WF.PAL_API_MOCK_RESET,
      preAction: ensureAm22ForReset,
      action: async (ctx) => {
        await runAm22ResetNode(ctx);
      },
      verify: API_MOCK.CANVAS_RESET,
    },
    {
      id: 'stop-node',
      title: 'Guaranteed teardown, even on failure',
      description:
        'Teardown is a first-class step, not something you hope the process '
        + 'exit will handle. **Stop Mock Server** releases the isolated port '
        + 'deterministically, and it is idempotent by design — stopping an '
        + 'already-dead listener still counts as success.\n\n'
        + 'That idempotency is what makes it safe to run *unconditionally* at '
        + 'the end of the graph: even if an earlier node fails, Stop still '
        + 'fires and you do not leak an orphan port. Reliable cleanup is what '
        + 'lets you run this workflow a hundred times without slowly filling '
        + 'the machine with zombie listeners.',
      highlight: WF.PAL_API_MOCK_STOP,
      preAction: ensureAm22ForStop,
      action: async (ctx) => {
        await runAm22StopNode(ctx);
      },
      verify: API_MOCK.CANVAS_STOP,
    },
    {
      id: 'wire',
      title: 'Start → Apply → HTTP → Assert → Reset → Stop',
      description:
        'With every node on the canvas, the last thing to confirm is the '
        + '*order*, because execution follows the wires. Trace the chain '
        + '**Start → Apply → HTTP → Assert → Reset → Stop** and one placement '
        + 'earns a second look: Apply sits *before* the POST, so the contract '
        + 'is hot-swapped in before any traffic arrives.\n\n'
        + 'Fit the whole graph in view and read it as one lifecycle — five '
        + 'mock nodes plus HTTP, connected end to end. The next click runs it.',
      highlight: WF.FIT_VIEW_BTN,
      preAction: ensureAm22ForWire,
      action: async (ctx) => {
        await runAm22Wire(ctx);
      },
      verify: '.react-flow__edge',
    },
    {
      id: 'quick-test',
      title: 'One click runs the whole lifecycle',
      description:
        '**Quick Test** runs the entire graph once, and the payoff is '
        + 'watching the lifecycle prove itself: nodes turn green in order — '
        + 'Start, Apply, HTTP, Assert, Reset, Stop — each one gating the next. '
        + 'Open the **Console** first so the run log stays on screen beside '
        + 'the canvas.\n\n'
        + 'The assert node is the one to linger on: its pass badge and the '
        + 'min-count sublabel are *journal evidence*, not a log line you have '
        + 'to trust. All green means the isolated listener started, `/cart` was '
        + 'posted and seen, state rewound, and the port was released — the full '
        + 'orchestration a lone Studio tab simply cannot perform.',
      highlight: WF.CONSOLE_BADGE,
      preAction: ensureAm22ForQuickTest,
      action: async (ctx) => {
        await runAm22QuickTest(ctx);
      },
      verify: am22PassSelector(API_MOCK.CANVAS_ASSERT),
    },
  ],
};
