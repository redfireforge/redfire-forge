/**
 * AM-02 `am-02-multi-server` — Multi-Server Workspace: Tabs, Ports & Binding.
 *
 * Scenario: a checkout flow that talks to two services. One service mock is already
 * in the workspace (quiet corpus); the payments mock beside it is authored live.
 * Curriculum: `docs/plan/future/apimock/apimock-demo-curriculum-v2.md` §5 Track A.
 */
import { API_MOCK } from '@shared/selectors';
import type { DemoLesson } from '../../types';
import {
  AM02_BASE_PATH,
  AM02_COPY_NAME,
  AM02_CORPUS_NAME,
  AM02_PAYMENTS_NAME,
  cleanupAm02,
  ensureAm02BasePath,
  ensureAm02BothRunning,
  ensureAm02Closeable,
  ensureAm02Corpus,
  ensureAm02CorpusActive,
  ensureAm02Duplicate,
  ensureAm02Renamed,
  ensureAm02SecondServer,
  prepareAm02Workspace,
  runAm02Duplicate,
  runAm02PersistAndClose,
  runAm02Rename,
  runAm02ReorderAndCeiling,
  runAm02Settings,
  runAm02StartBoth,
  runAm02SwitchTab,
  runAm02TabsAndNew,
} from './api-mock-am02-helpers';

const DIAGRAM = `
<svg viewBox="0 0 700 430" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="One workspace, many servers: tabs, ports, and per-server state">
  <defs>
    <marker id="am02-arrow" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
      <path d="M0,0 L10,4 L0,8 Z" fill="#94a3b8" />
    </marker>
  </defs>
  <rect x="0" y="0" width="700" height="430" fill="#0f172a" />

  <text x="26" y="34" fill="#f1f5f9" font-family="system-ui" font-size="16" font-weight="600">One workspace · one tab per mock server</text>

  <rect x="26" y="54" width="648" height="34" rx="6" fill="#1e293b" stroke="#3b4a60" />
  <circle cx="52" cy="71" r="5" fill="#22c55e" />
  <text x="66" y="76" fill="#f1f5f9" font-family="system-ui" font-size="12">Users API</text>
  <text x="134" y="76" fill="#64748b" font-family="ui-monospace" font-size="11">:4600</text>
  <circle cx="212" cy="71" r="5" fill="#22c55e" />
  <text x="226" y="76" fill="#f1f5f9" font-family="system-ui" font-size="12">Payments</text>
  <text x="298" y="76" fill="#64748b" font-family="ui-monospace" font-size="11">:4601</text>
  <circle cx="376" cy="71" r="5" fill="#64748b" />
  <text x="390" y="76" fill="#a8b8cc" font-family="system-ui" font-size="12">Users API copy</text>
  <text x="490" y="76" fill="#64748b" font-family="ui-monospace" font-size="11">:4602</text>
  <text x="640" y="77" fill="#3b82f6" font-family="system-ui" font-size="16">+</text>

  <text x="26" y="120" fill="#a8b8cc" font-family="system-ui" font-size="11">Each tab owns its own definition, port, runtime status, journal, and settings.</text>

  <rect x="26" y="140" width="205" height="150" rx="8" fill="#1e293b" stroke="#3b82f6" />
  <text x="42" y="164" fill="#a8b8cc" font-family="system-ui" font-size="11" letter-spacing="1">ACTIVE TAB</text>
  <text x="42" y="188" fill="#f1f5f9" font-family="system-ui" font-size="12">rules · journal · settings</text>
  <text x="42" y="210" fill="#64748b" font-family="system-ui" font-size="11">Switching tabs swaps all</text>
  <text x="42" y="226" fill="#64748b" font-family="system-ui" font-size="11">three at once — nothing</text>
  <text x="42" y="242" fill="#64748b" font-family="system-ui" font-size="11">is shared between servers.</text>
  <text x="42" y="270" fill="#22c55e" font-family="ui-monospace" font-size="11">● Running · gen 1</text>

  <line x1="231" y1="215" x2="291" y2="215" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#am02-arrow)" />
  <text x="236" y="206" fill="#3b82f6" font-family="system-ui" font-size="10">bind</text>

  <rect x="291" y="140" width="180" height="150" rx="8" fill="#1e293b" stroke="#3b4a60" />
  <text x="307" y="164" fill="#a8b8cc" font-family="system-ui" font-size="11" letter-spacing="1">ADDRESS</text>
  <text x="307" y="190" fill="#f1f5f9" font-family="ui-monospace" font-size="11">host : port</text>
  <text x="307" y="212" fill="#f1f5f9" font-family="ui-monospace" font-size="11">+ base path</text>
  <text x="307" y="240" fill="#64748b" font-family="system-ui" font-size="11">127.0.0.1 → this machine</text>
  <text x="307" y="256" fill="#f59e0b" font-family="system-ui" font-size="11">0.0.0.0 → your whole LAN</text>
  <text x="307" y="280" fill="#64748b" font-family="ui-monospace" font-size="10">:4601/payments/v1</text>

  <rect x="491" y="140" width="183" height="150" rx="8" fill="#1e293b" stroke="#3b4a60" />
  <text x="507" y="164" fill="#a8b8cc" font-family="system-ui" font-size="11" letter-spacing="1">DUPLICATE</text>
  <text x="507" y="190" fill="#f1f5f9" font-family="system-ui" font-size="11">rules cloned</text>
  <text x="507" y="212" fill="#f1f5f9" font-family="system-ui" font-size="11">new port claimed</text>
  <text x="507" y="234" fill="#f87171" font-family="system-ui" font-size="11">private keys dropped</text>
  <text x="507" y="262" fill="#64748b" font-family="system-ui" font-size="11">a clone is a draft —</text>
  <text x="507" y="278" fill="#64748b" font-family="system-ui" font-size="11">it starts stopped</text>

  <text x="26" y="330" fill="#f1f5f9" font-family="system-ui" font-size="14" font-weight="600">Ports are the shared resource</text>
  <text x="26" y="354" fill="#a8b8cc" font-family="system-ui" font-size="12">New and duplicated servers claim the next free port in 4600–4699, so listeners never collide.</text>
  <text x="26" y="376" fill="#a8b8cc" font-family="system-ui" font-size="12">Up to 8 tabs stay open at once; closing a running tab stops its listener and frees the port.</text>
  <text x="26" y="404" fill="#64748b" font-family="system-ui" font-size="11">Tabs, their order, and the active tab are saved with the workspace and restored on reload.</text>
</svg>
`;

export const apiMockAm02Lesson: DemoLesson = {
  id: 'am-02-multi-server',
  domainId: 'api-mock',
  category: 'api-mock',
  name: 'Multi-Server Workspace: Tabs, Ports & Binding',
  description:
    'Run two mocks side by side: add a server, rename its tab, give it a base path, bind both '
    + 'listeners, duplicate a tab, reorder the stack, and close a running server safely.',
  estimatedMinutes: 6,
  initialTab: 'api-mock-studio',
  contentVersion: 1,
  concept: {
    title: 'Why one workspace holds many servers',
    body:
      'Real features rarely depend on one service. A checkout screen reads a user profile, quotes a '
      + 'price, takes a payment, and writes an order — four APIs, four teams, four different states of '
      + '"not ready yet". Mocking that with a single fake server forces every endpoint into one port and '
      + 'one namespace, and the moment two services disagree about `/status` you are stuck.\n\n'
      + 'The Studio models it the way your architecture already does: **one tab per mock server**. Each '
      + 'tab owns a complete server — its own rules, port, base path, runtime status, journal, and '
      + 'settings. Nothing is shared, so a request to one mock can never be answered by another mock\'s '
      + 'rule, and you can start, stop, and restart them independently while the others keep serving.\n\n'
      + 'Two things make that practical. **Auto-ports**: new and duplicated servers claim the next free '
      + 'port in the 4600–4699 range, so you never hand-pick numbers or debug a collision. And the '
      + '**base path**: a prefix like `/api/v1` applied at the server, so every rule inherits it and your '
      + 'mock URL matches the real service\'s URL shape without repeating the prefix in each rule.\n\n'
      + 'The last piece is where a mock is reachable *from*. Binding to `127.0.0.1` keeps it on your '
      + 'machine; binding to `0.0.0.0` publishes it to every device on your network — useful for a phone '
      + 'or a container, risky on shared Wi-Fi, and something the Studio warns you about inline.\n\n'
      + 'A tab can **Start with zero rules**. Start binds the port; it does not wait for a catalog. Until '
      + 'you add a rule, every request to that listen URL — GET, POST, or any other method — is unmatched '
      + 'and returns **404**. That is the empty-listener contract, not a bug.\n\n'
      + 'This lesson builds the second server live in eight steps: add, rename, configure, bind both, '
      + 'switch, duplicate, reorder, and close safely.',
    keyTerms: [
      { term: 'Tab = server', definition: 'Every tab is a whole mock server: rules, port, journal, and settings. Switching tabs swaps the entire workspace, not just the rule list.' },
      { term: 'Auto-port', definition: 'New and duplicated servers claim the next free port in 4600–4699, so two listeners never fight over the same number.' },
      { term: 'Base path', definition: 'A server-level URL prefix (for example `/api/v1`). Every rule inherits it, so mock URLs match the real service shape without repeating the prefix.' },
      { term: 'Bind address', definition: 'Which network interface the listener attaches to. `127.0.0.1` and `localhost` are this machine only (`localhost` is the hostname in the URL). `0.0.0.0` exposes the mock to every device on your LAN.' },
      { term: 'Empty listener', definition: 'A server can Start with zero rules. The port is bound; every request is unmatched and returns 404 until you add a rule. GET and POST are the same — there is nothing to match yet.' },
      { term: 'Duplicate tab', definition: 'Clones a server\'s rules onto a fresh port, drops private keys and sensitive variable values, and leaves the clone stopped — a draft, not a second listener.' },
      { term: 'Tab ceiling', definition: 'At most 8 servers stay open at once. The guardrail keeps port use and memory bounded; close a tab to make room for another — the closed server is still saved.' },
      { term: 'Stop and close', definition: 'Closing a tab whose listener is running asks first, then drains the listener and releases the port before removing the tab.' },
      { term: 'Saved servers', definition: 'The library of every server you have saved. Closing a tab parks the definition there — rules, examples, and settings intact — and only Delete Server… removes it (with a 5-second undo).' },
    ],
    diagram: DIAGRAM,
  },
  prepareBeforeNavigate: prepareAm02Workspace,
  cleanup: cleanupAm02,
  steps: [
    {
      id: 'tabs-and-new',
      title: 'One tab per server — add the second',
      description:
        `The workspace already holds a mock of the **${AM02_CORPUS_NAME}** service, and its tab tells you `
        + 'three things at a glance: the server name, the `:port` it listens on, and a status dot that is '
        + 'grey while nothing is bound. The **+** button adds a second, independent server — watch it '
        + 'claim the *next free* port instead of reusing the first one, which is why two mocks can run '
        + 'together without a collision. The new tab opens on an empty rule list: a server is a container, '
        + 'and rules come later. **Start** is still allowed — it claims the port; unmatched requests return '
        + '**404** until a rule exists.',
      highlight: API_MOCK.SERVER_TABS,
      preAction: ensureAm02Corpus,
      action: runAm02TabsAndNew,
      verify: API_MOCK.ROUTES_EMPTY,
    },
    {
      id: 'rename',
      title: 'Rename the tab in place',
      description:
        '`Mock Server 2` is a useless label once three mocks are open, and naming is the cheapest way to '
        + 'keep a stack readable. Press **F2** on the focused tab (double-click does the same) and the '
        + `label becomes an input; type **${AM02_PAYMENTS_NAME}** and press Enter. The name is not `
        + 'cosmetic — it is what workflow nodes, exports, and the tab tooltip use to identify this server, '
        + 'so pick the service it stands in for.',
      highlight: API_MOCK.ACTIVE_TAB,
      preAction: ensureAm02SecondServer,
      action: runAm02Rename,
      verify: API_MOCK.tabTitled(AM02_PAYMENTS_NAME),
    },
    {
      id: 'settings-general',
      title: 'Base path and bind address',
      description:
        'Everything about *where* this server lives sits on the **General** tab: name, host, port, and '
        + 'base path — with a live **Listen URL** at the top that reassembles as you edit. First the base '
        + `path: **${AM02_BASE_PATH}** is applied once at the server, and every rule inherits it, so your `
        + 'mock URLs match the real service without repeating the prefix.\n\n'
        + '**Host** is who can reach the listener. The three options are not interchangeable:\n\n'
        + '- **`127.0.0.1` (loopback)** — this machine only, as an IP. Default and safest. Clients hit '
        + '`http://127.0.0.1:port`.\n'
        + '- **`localhost`** — still this machine only. The listener binds the same loopback; the '
        + 'difference is the hostname in the Listen URL (`http://localhost:port`), which some clients and '
        + 'TLS certificates expect by name rather than by IP.\n'
        + '- **`0.0.0.0` (LAN)** — binds every network interface. A phone, a container, or another device '
        + 'on your Wi-Fi can reach this mock. The Studio warns inline because that is the right choice on '
        + 'a trusted LAN and the wrong one on café Wi-Fi.\n\n'
        + 'We try **`0.0.0.0`**, read the warning, then switch back to loopback before saving.',
      highlight: API_MOCK.SETTINGS,
      preAction: ensureAm02Renamed,
      action: runAm02Settings,
      verify: API_MOCK.ADDRESS,
    },
    {
      id: 'start-both',
      title: 'Bind both listeners at once',
      description:
        `Start is per server, not per workspace. **${AM02_PAYMENTS_NAME}** still has no rules — that is `
        + 'fine. Start binds the port; it does not require a catalog. Until you add a rule, every request '
        + 'to that listen URL — GET, POST, or any other method — is unmatched and returns **404** '
        + '(`not_found`). The empty Studio says so while the listener is running. The payments mock binds '
        + `first, then the spotlight switches to the **${AM02_CORPUS_NAME}** tab and starts that one too — `
        + 'two real listeners on two ports, both serving at the same time, which is what makes a '
        + 'multi-service front end testable. The payoff is in the tab bar: each tab carries its own status '
        + 'dot, so one glance tells you which mocks are live without opening any of them.',
      highlight: API_MOCK.START,
      preAction: ensureAm02BasePath,
      action: runAm02StartBoth,
      verify: API_MOCK.TAB_STATUS_DOT_RUNNING,
    },
    {
      id: 'switch-tab',
      title: 'A tab switch swaps the whole workspace',
      description:
        `The **${AM02_CORPUS_NAME}** tab shows its rules and its address. Click over to `
        + `**${AM02_PAYMENTS_NAME}** and everything changes together: an empty rule list that explains `
        + `every request will **404** until a rule exists, a different port, and the ${AM02_BASE_PATH} `
        + 'prefix on the address. The journal, variables, and settings switch with it — a request that '
        + 'lands on one server is never explained by the other server\'s rules. That isolation is why '
        + 'per-service mocks stay debuggable as the stack grows.',
      highlight: API_MOCK.SERVER_TABS,
      preAction: ensureAm02BothRunning,
      action: runAm02SwitchTab,
      verify: API_MOCK.FIRST_ROUTE,
    },
    {
      id: 'duplicate',
      title: 'Duplicate a server to fork its rules',
      description:
        'When you want to try a variant — different latency, a v2 contract, a failure profile — do not '
        + 'rebuild the rules. Right-click the tab and choose **Duplicate Tab**: the clone keeps every rule '
        + 'and folder, claims the next free port, and drops private keys and sensitive variable values so '
        + 'you never copy a secret sideways. Notice its dot: the clone arrives **stopped**. Runtime is not '
        + 'cloned, only the definition, so nothing binds until you start it deliberately.',
      highlight: API_MOCK.ACTIVE_TAB,
      preAction: ensureAm02CorpusActive,
      action: runAm02Duplicate,
      verify: API_MOCK.tabTitled(AM02_COPY_NAME),
    },
    {
      id: 'reorder-and-ceiling',
      title: 'Order the stack, and the 8-tab ceiling',
      description:
        'Tabs are draggable, so the workspace can mirror how you actually think about the stack — '
        + 'gateway first, downstream services after, throwaway clones at the end. The spotlight reads the '
        + 'current order, drags the last tab to the front, then reads the order again. Order is cosmetic '
        + 'for matching but it is saved with the workspace, so the layout you build is the layout you come '
        + 'back to. The **+** button also has a limit: eight servers per workspace. That ceiling keeps port '
        + 'use and memory bounded, and past it the button disables and tells you to close a tab first.',
      highlight: API_MOCK.SERVER_TABS,
      preAction: ensureAm02Duplicate,
      action: runAm02ReorderAndCeiling,
      verify: API_MOCK.SERVER_TAB,
    },
    {
      id: 'persist-and-close',
      title: 'Saved workspace, safe close',
      description:
        'Everything you just built is persisted: the tab set, their order, the active tab, and each '
        + 'server\'s definition. Reload the app and the workspace comes back — and because runtime status '
        + 'is *not* stored, the Studio re-checks every listener on load and shows what is genuinely bound '
        + 'rather than what was bound last time. Closing a running tab asks first and offers '
        + '**Stop & Close**, which drains the listener before the tab disappears — the other servers keep '
        + 'serving throughout. Closing is *not* deleting: watch the **Saved servers** count stay put and '
        + 'pick up a "1 closed" hint. The rules, examples, and settings are parked in the library, one '
        + 'click from coming back.',
      highlight: API_MOCK.SERVER_TABS,
      preAction: ensureAm02Closeable,
      action: runAm02PersistAndClose,
      verify: API_MOCK.tabTitled(AM02_CORPUS_NAME),
    },
  ],
};
