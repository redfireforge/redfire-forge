/**
 * AM-22 `am-22-workflow` — Workflow Orchestration: Start → Apply → Reset →
 * Assert → Stop.
 *
 * Scenario: a checkout mock is already in the workspace and the Designer
 * opens on an empty canvas. The lesson drops the five mock blocks plus an
 * HTTP call, configures isolation and journal assertions live, and
 * connects each node as it lands (Start → Apply → HTTP → Assert → Reset
 * → Stop). Quick Test then runs the lifecycle green. Curriculum:
 * `docs/plan/future/apimock/apimock-demo-curriculum-v2.md` §5 Track E.
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
  domainId: 'protocols',
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
  contentVersion: 3,
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
        'The Designer is already on a blank canvas. Collapse the app '
        + 'Workflows list so the palette and canvas have the width. Type '
        + '**Mock** in **Search all blocks** — the match highlight is the '
        + 'whole family, Actions and Logic together.\n\n'
        + 'Hold each result: Start, Apply, Reset, Stop, then **Assert Mock '
        + 'Calls**. Five blocks, one job: the mock is a node you drop, not a '
        + 'process you babysit in a terminal. The next steps drop them live.',
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
        'Click **Start Mock Server** to drop it. Connect the blank **Start** '
        + 'trigger into it, then click **Fit View** so both nodes sit in '
        + 'frame.\n\n'
        + 'Open config and pick **Cart API** — that is the checkout mock '
        + 'already in the workspace. Hold **Isolate run**: it stays on so this '
        + 'graph gets a private port and cannot clobber the Studio tab.\n\n'
        + 'Hold **Save port as** `mockPort` and **Save base URL as** '
        + '`mockBaseUrl`. Those names are what HTTP will consume. Save, then '
        + 'hold the configured node on the canvas.',
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
        'Click **Apply Definition** and drop it. Connect it under **Start Mock '
        + 'Server**, then click **Fit View** so the chain stays in frame.\n\n'
        + 'Open config and pick **Cart API** so this node knows which contract '
        + 'to push. Hold the isolated-run hint — downstream mock nodes talk to '
        + '`{{mockServerId}}` from Start, not the Studio tab\'s id. Apply is '
        + 'how a second scenario swaps routes without a restart. This first '
        + 'run reapplies the cart definition before the POST. Save, then hold '
        + 'the node.',
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
        'Click **HTTP Request** in the palette and drop it. Connect it under '
        + '**Apply Definition**, then click **Fit View**.\n\n'
        + 'Open config, set the method to **POST**, and fill the URL with '
        + `\`${AM22_HTTP_URL}\`. Hold the filled field so the template is `
        + 'readable — there is no hard-coded port. Start has not run yet, so '
        + 'the URL is a promise: when Quick Test binds the isolated listener, '
        + 'this node posts `/cart` at whatever port isolation chose. Save, '
        + 'then hold the HTTP node.',
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
        'Click **Assert Mock Calls** under Logic and drop it. Connect it under '
        + '**HTTP Request**, then click **Fit View**.\n\n'
        + `Pick the server, fill **Min count** ${AM22_ASSERT_MIN}, **Status** `
        + `${AM22_ASSERT_STATUS}, and **Body contains** \`${AM22_ASSERT_BODY}\`. `
        + 'Hold **Header key** / **Header value**, then fill **Last call '
        + `within** ${AM22_ASSERT_RECENCY} ms. The journal is the audit trail. `
        + 'A green HTTP node only means the request returned; this node proves '
        + 'the mock actually saw it. Save, then hold the assert node.',
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
        'Click **Reset Mock State** and drop it. Connect it under **Assert '
        + 'Mock Calls**, then click **Fit View**.\n\n'
        + 'Open config, pick the server, and hold the rewind hint: this node '
        + 'clears scenario state, sequence cursors, and match counters on the '
        + 'running listener. Without Reset, the next loop would inherit the '
        + 'last cart. With it, every iteration starts EMPTY even though this '
        + 'checkout mock is a simple POST today. Save, then hold the node.',
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
        'Click **Stop Mock Server** and drop it. Connect it under **Reset Mock '
        + 'State**, then click **Fit View**.\n\n'
        + 'Open config, pick the server, and Save. Hold the node on the '
        + 'canvas — teardown is a first-class step, not an afterthought you '
        + 'hope the process exit will handle. Stop is idempotent by default: '
        + 'an already-dead listener is still success. That is what keeps Quick '
        + 'Test from leaving an orphan port when an earlier node fails.',
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
        'The graph is already wired as each node landed. Walk **Start Mock '
        + 'Server** → Apply → HTTP → Assert → Reset → Stop so the execution '
        + 'order is readable — Apply sits before the POST so the definition is '
        + 'hot-swapped first.\n\n'
        + 'Click **Fit View** and hold the full graph. Five mock nodes plus '
        + 'HTTP, wired. The next click runs the whole lifecycle.',
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
        'Open **Console** first so the run log stays on screen. Then click '
        + '**Quick Test**. Hold each node as it turns green in order: '
        + 'Start, Apply, HTTP, Assert, Reset, Stop. Then hold the assert '
        + 'node\'s evidence — the sublabel still shows min count, and the '
        + 'pass badge is the journal proof, not a log line.\n\n'
        + 'All green means the isolated listener started, `/cart` was posted, '
        + 'the journal matched, state rewound, and the port was released. '
        + 'That is the orchestration the Studio tab cannot do alone.',
      highlight: WF.CONSOLE_BADGE,
      preAction: ensureAm22ForQuickTest,
      action: async (ctx) => {
        await runAm22QuickTest(ctx);
      },
      verify: am22PassSelector(API_MOCK.CANVAS_ASSERT),
    },
  ],
};
