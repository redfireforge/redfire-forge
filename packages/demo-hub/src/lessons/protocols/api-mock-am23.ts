/**
 * AM-23 `am-23-harness-ci` — Test Runner Fixtures & CI Handoff.
 *
 * Scenario: the store library is already in the workspace and a small
 * smoke suite is seeded. The lesson opens Test Runner, binds that mock
 * as a fixture with isolate + host override, runs the suite, then
 * exports the workspace and the copyable CLI commands CI consumes.
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
  <text x="42" y="278" fill="#f1f5f9" font-family="system-ui" font-size="12" font-weight="600">Isolate publishes a private port so parallel suites never share a listener.</text>
  <text x="42" y="300" fill="#a8b8cc" font-family="system-ui" font-size="11">Override host rewrites scenario URLs to that mock base URL for the duration of the run.</text>

  <rect x="26" y="338" width="648" height="70" rx="8" fill="#1e293b" stroke="#22c55e" />
  <text x="42" y="366" fill="#22c55e" font-family="system-ui" font-size="12" font-weight="600">${AM23_CLI_SIMULATE} is unit-level. ${AM23_CLI_VERIFY} asserts the live journal.</text>
  <text x="42" y="388" fill="#a8b8cc" font-family="system-ui" font-size="11">Studio authors. Simulate proves. Test Runner / Workflow run it. CLI is the CI handoff.</text>
</svg>
`;

export const apiMockAm23Lesson: DemoLesson = {
  id: 'am-23-harness-ci',
  domainId: 'protocols',
  category: 'api-mock',
  name: 'Test Runner Fixtures & CI Handoff',
  description:
    'Open Test Runner and bind the Store mock as a fixture that starts with '
    + 'the suite. Isolate a private port, publish the mock base URL into '
    + 'scenarios, run, and watch the listener stop so the port is freed. '
    + 'Then read the journal, export workspace JSON, and copy '
    + `\`${AM23_CLI_SIMULATE}\` for unit-level CI and \`${AM23_CLI_VERIFY}\` `
    + 'for live journals.',
  estimatedMinutes: 6,
  initialTab: 'runner',
  allowedTabs: ['runner', 'api-mock-studio'],
  collapseAppSidebarOnStart: true,
  contentVersion: 1,
  concept: {
    title: 'A fixture is a mock that lives for the length of the suite.',
    body:
      'Studio is where you author the contract. **Test Runner** is where that '
      + 'contract becomes a suite fixture: the listener starts before the first '
      + 'scenario, scenarios hit the mock instead of a remote host, and the '
      + 'listener stops when the run ends — pass, fail, or cancel.\n\n'
      + '**Isolate run** is why parallel CI jobs are safe. Each run binds a '
      + 'private port so two suites cannot clobber the same Studio tab. '
      + '**Override host → mock** publishes that base URL into the scenarios '
      + 'for the duration of the run, so authored URLs never hard-code a '
      + 'listen address.\n\n'
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
          'Binds a run-scoped server id and a private port so this suite cannot collide with the Studio tab or another parallel job.',
      },
      {
        term: 'Mock base URL',
        definition:
          'The host override publishes http://127.0.0.1:<port> into scenarios for the duration of the run instead of a hard-coded listen address.',
      },
      {
        term: 'Journal',
        definition:
          'The run\'s audit trail — matched calls, status, and bodies — readable in Runtime after the suite finishes.',
      },
      {
        term: 'cli mock simulate',
        definition:
          'Unit-level CI: run the exported workspace as a sample suite with no live listener.',
      },
      {
        term: 'cli mock verify',
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
        'Open **Test Runner**. The **API Mock fixture** panel is how a suite '
        + 'borrows a Studio contract without leaving a listener running on your '
        + 'desk. Enable it, then pick **Store API** from the server list and '
        + 'hold the selection — that is the library this suite will hit.\n\n'
        + 'Nothing is listening yet. The fixture starts only when you press '
        + 'Run, and it stops when the last scenario finishes.',
      highlight: HAR.HARNESS_MOCK_FIXTURE,
      action: runAm23FixturePanel,
      verify: HAR.HARNESS_MOCK_SERVER,
    },
    {
      id: 'isolate',
      title: 'A private port per run is what makes parallel suites safe',
      description:
        '**Isolate run ID** is already on — leave it on and hold the checkbox. '
        + 'That is the difference between this suite and the Studio tab still '
        + 'open on the side: the run gets its own server id and a private port.\n\n'
        + 'Hold **Override host → mock** and the hint beneath it. Scenarios keep '
        + 'their authored URLs; the runner rewrites the host to the mock base '
        + 'URL for this run only. Two jobs can share a definition without '
        + 'sharing a listener.',
      highlight: HAR.HARNESS_MOCK_ISOLATE,
      preAction: ensureAm23ForIsolate,
      action: runAm23Isolate,
      verify: HAR.HARNESS_MOCK_VAR,
    },
    {
      id: 'run',
      title: 'The fixture starts before the first scenario',
      description:
        'Press **Run**. Watch the fixture start line — the mock binds before '
        + 'any scenario fires. Then hold the results banner. List products and '
        + 'Get cart went to the isolated listener, not `store.example`.\n\n'
        + 'That start line is the proof the suite did not race the bind. If it '
        + 'were missing, the first request would miss.',
      highlight: HAR.RUN_BTN,
      preAction: ensureAm23ForRun,
      action: runAm23Suite,
      verify: HAR.COMPLETION,
    },
    {
      id: 'teardown',
      title: 'No orphan listeners after the run',
      description:
        'Hold **Stopped** on the fixture panel, then the freed port. The '
        + 'listener is gone the moment the suite ends — pass, fail, or cancel. '
        + 'Studio itself never bound this run; isolation kept that tab Stopped.\n\n'
        + 'This is why you can run the same suite again immediately, or in '
        + 'parallel with another job, without a port conflict toast.',
      highlight: HAR.HARNESS_MOCK_STOPPED,
      preAction: ensureAm23ForTeardown,
      action: runAm23Teardown,
      verify: HAR.HARNESS_MOCK_FREED_PORT,
    },
    {
      id: 'evidence',
      title: 'The journal is the run\'s audit trail',
      description:
        'Switch to API Mock Studio and open the Runtime **Transactions** dock. '
        + 'Hold the first journal row — GET `/products` from the smoke suite. '
        + 'Then hold **Export journal** so you know the audit trail is a file, '
        + 'not a screenshot.\n\n'
        + 'Simulate expectations still live on the samples. The journal is what '
        + 'actually arrived on the wire during the run.',
      highlight: API_MOCK.DOCK_TAB_TRANSACTIONS,
      preAction: ensureAm23ForEvidence,
      action: runAm23Evidence,
      verify: API_MOCK.JOURNAL_FIRST_ROW,
    },
    {
      id: 'artifact',
      title: 'Export the workspace as the file CI consumes',
      description:
        'Open **Export** and download **Workspace JSON**. Hold the confirmation '
        + 'until the filename and both CLI lines are readable — '
        + `\`${AM23_CLI_SIMULATE}\` for the unit-level suite, `
        + `\`${AM23_CLI_VERIFY}\` for the live journal.\n\n`
        + 'That file is the artifact. The confirmation is what you would paste '
        + 'into a pipeline, not a toast that disappears.',
      highlight: API_MOCK.EXPORT,
      preAction: ensureAm23ForArtifact,
      action: runAm23Artifact,
      verify: API_MOCK.EXPORT_CONFIRM,
    },
    {
      id: 'cli-handoff',
      title: 'Simulate is unit-level. Verify is the live journal.',
      description:
        'Close the confirmation so the explorer footer is visible again. Hold '
        + `\`${AM23_CLI_SIMULATE}\`, then \`${AM23_CLI_VERIFY}\`. Simulate runs `
        + 'saved samples with no sockets. Verify asserts matched calls against '
        + 'a live (or just-run) journal.\n\n'
        + 'The recap on the footer is the pack in one line: Studio authors, '
        + 'Simulate proves, Test Runner / Workflow run it, CLI is CI.',
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
