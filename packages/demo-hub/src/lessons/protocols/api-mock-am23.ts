/**
 * AM-23 `am-23-harness-ci` — Test Runner Fixtures & CI Handoff.
 *
 * Scenario: the store library is already in the workspace and a small
 * smoke suite is seeded. The lesson opens Test Runner, binds that mock
 * as a fixture with Isolate on, runs the suite, then exports the
 * workspace and the copyable CLI commands CI consumes.
 * Curriculum: `docs/plan/future/apimock/apimock-demo-curriculum-v2.md` §5 Track E.
 */
import { API_MOCK, HAR } from '@shared/selectors';
import type { DemoLesson } from '../../types';
import {
  AM23_CLI_SIMULATE,
  AM23_CLI_VERIFY,
  cleanupAm23,
  ensureAm23ForArtifact,
  ensureAm23ForCli,
  ensureAm23ForEvidence,
  ensureAm23ForIsolate,
  ensureAm23ForRun,
  ensureAm23ForTeardown,
  prepareAm23Workspace,
  runAm23Artifact,
  runAm23CliHandoff,
  runAm23Evidence,
  runAm23FixturePanel,
  runAm23Isolate,
  runAm23Suite,
  runAm23Teardown,
} from './api-mock-am23-helpers';

const DIAGRAM = `
<svg viewBox="0 0 700 430" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Test Runner starts an isolated mock, runs the suite, stops the listener, then exports the workspace for CLI verify">
  <rect x="0" y="0" width="700" height="430" fill="#0f172a" />

  <text x="26" y="34" fill="#f1f5f9" font-family="system-ui" font-size="16" font-weight="600">The mock starts and stops with the run.</text>
  <text x="26" y="54" fill="#64748b" font-family="system-ui" font-size="10">fixture · isolate · mock base URL · journal · workspace.json · CLI</text>

  <rect x="26" y="76" width="140" height="58" rx="8" fill="#1e293b" stroke="#38bdf8" />
  <text x="40" y="110" fill="#38bdf8" font-family="system-ui" font-size="12" font-weight="600">Fixture + Store</text>
  <rect x="186" y="76" width="140" height="58" rx="8" fill="#1e293b" stroke="#a78bfa" />
  <text x="208" y="110" fill="#a78bfa" font-family="system-ui" font-size="12" font-weight="600">Isolate run</text>
  <rect x="346" y="76" width="140" height="58" rx="8" fill="#1e293b" stroke="#f59e0b" />
  <text x="378" y="110" fill="#f59e0b" font-family="system-ui" font-size="12" font-weight="600">Run suite</text>
  <rect x="506" y="76" width="168" height="58" rx="8" fill="#1e293b" stroke="#94a3b8" />
  <text x="536" y="110" fill="#94a3b8" font-family="system-ui" font-size="12" font-weight="600">Stop · free port</text>

  <path d="M166 105 H186" stroke="#64748b" stroke-width="2" marker-end="url(#am23arrow)" />
  <path d="M326 105 H346" stroke="#64748b" stroke-width="2" marker-end="url(#am23arrow)" />
  <path d="M486 105 H506" stroke="#64748b" stroke-width="2" marker-end="url(#am23arrow)" />

  <rect x="26" y="168" width="200" height="58" rx="8" fill="#1e293b" stroke="#22c55e" />
  <text x="62" y="202" fill="#22c55e" font-family="system-ui" font-size="12" font-weight="600">Journal rows</text>
  <rect x="246" y="168" width="200" height="58" rx="8" fill="#1e293b" stroke="#38bdf8" />
  <text x="268" y="202" fill="#38bdf8" font-family="system-ui" font-size="12" font-weight="600">Export workspace</text>
  <rect x="466" y="168" width="208" height="58" rx="8" fill="#1e293b" stroke="#f97316" />
  <text x="492" y="202" fill="#f97316" font-family="system-ui" font-size="12" font-weight="600">simulate / verify</text>

  <path d="M590 134 V148 H126 V168" stroke="#64748b" stroke-width="2" fill="none" marker-end="url(#am23arrow)" />
  <path d="M226 197 H246" stroke="#64748b" stroke-width="2" marker-end="url(#am23arrow)" />
  <path d="M446 197 H466" stroke="#64748b" stroke-width="2" marker-end="url(#am23arrow)" />

  <defs>
    <marker id="am23arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L6,3 L0,6 Z" fill="#64748b" />
    </marker>
  </defs>

  <rect x="26" y="250" width="648" height="70" rx="8" fill="#1e293b" stroke="#3b4a60" />
  <text x="42" y="278" fill="#f1f5f9" font-family="system-ui" font-size="12" font-weight="600">Isolate on: a throwaway copy. Off: use Studio's mock and put it back the way it was.</text>
  <text x="42" y="300" fill="#a8b8cc" font-family="system-ui" font-size="11">Mock Server rewrites scenario URLs to that listener for the duration of the run.</text>

  <rect x="26" y="338" width="648" height="70" rx="8" fill="#1e293b" stroke="#22c55e" />
  <text x="42" y="358" fill="#22c55e" font-family="system-ui" font-size="12" font-weight="600">
    <tspan x="42" dy="0">${AM23_CLI_SIMULATE} is unit-level.</tspan>
    <tspan x="42" dy="16">${AM23_CLI_VERIFY} asserts the live journal.</tspan>
  </text>
  <text x="42" y="398" fill="#a8b8cc" font-family="system-ui" font-size="11">Studio authors. Simulate proves. Test Runner / Workflow run it. CLI is the CI handoff.</text>
</svg>
`;

export const apiMockAm23Lesson: DemoLesson = {
  id: 'am-23-harness-ci',
  domainId: 'api-mock',
  category: 'api-mock',
  name: 'Test Runner Fixtures & CI Handoff',
  description:
    'Open Test Runner, pick Mock Server, and bind the Store mock as a '
    + 'fixture. Leave Isolate on for a throwaway copy, run the suite, and '
    + 'watch that copy stop so the port is freed. '
    + 'Then read the journal, export workspace JSON, and copy '
    + `\`${AM23_CLI_SIMULATE}\` for unit-level CI and \`${AM23_CLI_VERIFY}\` `
    + 'for live journals.',
  estimatedMinutes: 6,
  initialTab: 'runner',
  allowedTabs: ['runner', 'api-mock-studio'],
  collapseAppSidebarOnStart: true,
  contentVersion: 7,
  concept: {
    title: 'A fixture is a mock that lives for the length of the suite.',
    body:
      'Studio is where you author the contract. **Test Runner** is where that '
      + 'contract becomes a suite fixture: the listener starts before the first '
      + 'scenario, scenarios hit the mock instead of a remote host, and the '
      + 'listener stops when the run ends — pass, fail, or cancel.\n\n'
      + '**Isolate on** (this lesson) is why parallel CI jobs are safe: each '
      + 'run gets a throwaway copy so two suites cannot clobber the Studio '
      + 'tab. **Isolate off** uses Studio\'s mock and restores its prior '
      + 'Running or Stopped state when the suite ends. **Mock Server** '
      + 'rewrites scenario hosts to that listener for the duration of the '
      + 'run, so authored URLs never hard-code a listen address.\n\n'
      + 'After teardown there is no orphan listener. The **journal** is the '
      + 'run\'s audit trail. **Workspace JSON** is the file CI consumes. '
      + `\`${AM23_CLI_SIMULATE}\` is the unit-level counterpart (no sockets). `
      + `\`${AM23_CLI_VERIFY}\` asserts the live journal. The recap is the `
      + 'same pipeline this pack has been building: Studio → Simulate → '
      + 'Workflow / Harness → CLI.',
    keyTerms: [
      {
        term: 'API Mock fixture',
        definition:
          'Test Runner starts the selected Studio mock before the suite and stops it after pass, fail, or cancel.',
      },
      {
        term: 'Isolate run ID',
        definition:
          'On: throwaway copy with a private id and port, stopped after the suite. Off: use Studio\'s mock and restore whether it was Running or Stopped.',
      },
      {
        term: 'Mock base URL',
        definition:
          'Mock Server publishes http://127.0.0.1:<port> into scenarios for the duration of the run instead of a hard-coded listen address.',
      },
      {
        term: 'Journal',
        definition:
          'The run\'s audit trail — matched calls, status, and bodies — readable in Runtime after the suite finishes.',
      },
      {
        term: 'redfireforge mock simulate',
        definition:
          'Unit-level CI: run the exported workspace as a sample suite with no live listener.',
      },
      {
        term: 'redfireforge mock verify',
        definition:
          'Live-journal CI: assert matched calls, min count, and outcome against a running (or just-run) mock.',
      },
    ],
    diagram: DIAGRAM,
  },
  steps: [
    {
      id: 'fixture-panel',
      title: 'Scenario suites need a mock that starts and stops with the run',
      description:
        'A suite that points at `store.example` is only as reliable as that '
        + 'host is on the day CI runs. Binding the mock as a **fixture** '
        + 'removes that dependency: **Test Runner** borrows a Studio contract, '
        + 'stands it up for the length of the run, and tears it down after — so '
        + 'nothing is left listening on your desk.\n\n'
        + 'Pick **Store API** from the fixture’s server list and that becomes '
        + 'the library every scenario hits. Nothing is listening *yet*, though: '
        + 'the fixture starts only when you press Run and stops when the last '
        + 'scenario finishes. The mock’s lifetime is exactly the suite’s.',
      highlight: HAR.HOST_MOCK_SERVER,
      action: runAm23FixturePanel,
      verify: HAR.HARNESS_MOCK_SERVER,
    },
    {
      id: 'isolate',
      title: 'A private port per run is what makes parallel suites safe',
      description:
        '**Isolate run** is the difference between a suite that can run in '
        + 'parallel and one that fights over a port. Left on, this run gets a '
        + '*throwaway copy* — its own server id and port — that is discarded '
        + 'when the suite ends, so the Studio tab you have open is never '
        + 'touched.\n\n'
        + 'Off would borrow Studio’s own Store and politely restore it '
        + 'afterward (Stopped if it was down, Running if it was up). This '
        + 'lesson stays **On** because that is what lets two CI jobs share one '
        + 'definition without ever sharing a listener.',
      highlight: HAR.HARNESS_MOCK_ISOLATE_ROW,
      skipHighlightScroll: true,
      preAction: ensureAm23ForIsolate,
      action: runAm23Isolate,
      verify: HAR.HARNESS_MOCK_ISOLATE,
    },
    {
      id: 'run',
      title: 'The fixture starts before the first scenario',
      description:
        'Ordering is the whole game here: the fixture has to bind *before* the '
        + 'first scenario fires, or the opening request races an unready '
        + 'listener and misses. Press **Run** and the start line is the proof '
        + 'that did not happen — the mock comes up first, then List Products '
        + 'and Get Cart go to the isolated listener instead of '
        + '`store.example`.\n\n'
        + 'The results banner is the reward, but the start line above it is the '
        + 'reassurance: the suite and its mock came up in the right order, with '
        + 'nothing for you to sequence by hand.',
      highlight: HAR.RUN_BTN,
      preAction: ensureAm23ForRun,
      action: runAm23Suite,
      verify: HAR.COMPLETION,
    },
    {
      id: 'teardown',
      title: 'No orphan listeners after the run',
      description:
        'A fixture that starts cleanly but never stops is worse than no '
        + 'fixture — it leaks ports and poisons the next run. The payoff of the '
        + 'isolated copy is right here: the moment the suite ends — pass, fail, '
        + '*or* cancel — the listener is **Stopped** and its port is freed. '
        + 'Studio’s own tab stayed down the whole time; isolation never '
        + 'borrowed it.\n\n'
        + 'That guaranteed teardown is exactly why you can re-run this suite '
        + 'immediately, or fire another job alongside it, without a '
        + 'port-conflict toast.',
      highlight: HAR.HARNESS_MOCK_STOPPED,
      preAction: ensureAm23ForTeardown,
      action: runAm23Teardown,
      verify: HAR.HARNESS_MOCK_FREED_PORT,
    },
    {
      id: 'evidence',
      title: 'The journal is the run\'s audit trail',
      description:
        'After the run, the question a reviewer asks is “what actually hit the '
        + 'mock?” — and the **journal** answers it with facts, not a '
        + 'screenshot. Open the Runtime **Transactions** dock and the smoke '
        + 'suite’s real traffic is there, starting with `GET /products`.\n\n'
        + 'Hold the distinction: Simulate *expectations* live on the samples '
        + 'and describe what *should* happen; the journal records what *did* '
        + 'arrive on the wire during the run. **Export journal** turns that '
        + 'audit trail into a file you can attach, so the evidence outlives the '
        + 'session.',
      highlight: API_MOCK.DOCK_TAB_TRANSACTIONS,
      preAction: ensureAm23ForEvidence,
      action: runAm23Evidence,
      verify: API_MOCK.JOURNAL_FIRST_ROW,
    },
    {
      id: 'artifact',
      title: 'Export the workspace as the file CI consumes',
      description:
        'Everything so far happened inside the app; CI needs a *file*. '
        + '**Workspace JSON** is that artifact — the whole mock exported so a '
        + 'pipeline can consume it without your machine in the loop. Hold the '
        + 'confirmation until the filename and both CLI lines are readable.\n\n'
        + 'Those two commands are the point:\n\n'
        + `- \`${AM23_CLI_SIMULATE}\` — unit-level suite\n`
        + `- \`${AM23_CLI_VERIFY}\` — live journal\n\n`
        + 'The confirmation is deliberately something you can copy straight '
        + 'into a pipeline — not a toast that disappears before you can use it.',
      highlight: API_MOCK.EXPORT,
      preAction: ensureAm23ForArtifact,
      action: runAm23Artifact,
      verify: API_MOCK.EXPORT_CONFIRM,
    },
    {
      id: 'cli-handoff',
      title: 'Simulate is unit-level. Verify is the live journal.',
      description:
        'The two CLI commands answer two different questions CI asks. '
        + `\`${AM23_CLI_SIMULATE}\` replays the saved samples with *no sockets `
        + 'at all* — fast, hermetic, the unit test of your mock. '
        + `\`${AM23_CLI_VERIFY}\` goes the other way, asserting matched calls, `
        + 'counts, and outcomes against a *live* (or just-run) journal.\n\n'
        + 'Together they close the loop this whole pack has been building '
        + 'toward, and the footer recap says it in one line: Studio authors, '
        + 'Simulate proves, Test Runner / Workflow run it, and the CLI is the '
        + 'handoff to CI.',
      highlight: API_MOCK.CLI_SIMULATE,
      preAction: ensureAm23ForCli,
      action: runAm23CliHandoff,
      verify: API_MOCK.ROUTES_FOOTER,
    },
  ],
  prepareBeforeNavigate: prepareAm23Workspace,
  setup: prepareAm23Workspace,
  cleanup: cleanupAm23,
};
