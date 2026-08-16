/**
 * AM-21 `am-21-simulation-suite` — Simulation as a Test Suite: Examples,
 * Assertions, Trace.
 *
 * Scenario: eight saved samples with expectations are already in the workspace.
 * Simulate is the unit-test runner — scratch pad, decision trace, assertions
 * you can edit, FAIL, run-all with sequential state, two identical weighted
 * runs, an export bundle, then Examples that outlive the session. Curriculum:
 * `docs/plan/future/apimock/apimock-demo-curriculum-v2.md` §5 Track E.
 */
import { API_MOCK } from '@shared/selectors';
import type { DemoLesson } from '../../types';
import {
  AM21_ADHOC_PATH,
  AM21_HEALTH_ID,
  AM21_ORPHAN_ID,
  AM21_WRONG_STATUS,
  cleanupAm21,
  ensureAm21ForExamples,
  ensureAm21ForExpectations,
  ensureAm21ForExport,
  ensureAm21ForFailLoudly,
  ensureAm21ForRunAll,
  ensureAm21ForSeed,
  ensureAm21ForThreeViews,
  prepareAm21Workspace,
  runAm21Examples,
  runAm21Expectations,
  runAm21ExportTrace,
  runAm21FailLoudly,
  runAm21RunAll,
  runAm21Seed,
  runAm21SuiteAndScratchpad,
  runAm21ThreeViews,
} from './api-mock-am21-helpers';

const DIAGRAM = `
<svg viewBox="0 0 700 430" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Simulation as a test suite with examples, assertions, and a trace export">
  <rect x="0" y="0" width="700" height="430" fill="#0f172a" />

  <text x="26" y="34" fill="#f1f5f9" font-family="system-ui" font-size="16" font-weight="600">Simulate is a unit-test runner. Examples keep the cases.</text>
  <text x="26" y="54" fill="#64748b" font-family="system-ui" font-size="10">saved samples · scratch pad · assertions · export trace</text>

  <rect x="26" y="72" width="210" height="150" rx="8" fill="#1e293b" stroke="#38bdf8" />
  <text x="42" y="96" fill="#38bdf8" font-family="system-ui" font-size="12" font-weight="600">Suite + scratch pad</text>
  <text x="42" y="118" fill="#f1f5f9" font-family="ui-monospace" font-size="11">Saved samples</text>
  <text x="42" y="138" fill="#a8b8cc" font-family="system-ui" font-size="11">Ad-hoc GET ${AM21_ADHOC_PATH}</text>
  <text x="42" y="158" fill="#a8b8cc" font-family="system-ui" font-size="11">Trace / Normalized / Rendered</text>
  <text x="42" y="202" fill="#22c55e" font-family="system-ui" font-size="10">A sample without expected is a demo</text>

  <rect x="252" y="72" width="210" height="150" rx="8" fill="#1e293b" stroke="#f59e0b" />
  <text x="268" y="96" fill="#f59e0b" font-family="system-ui" font-size="12" font-weight="600">Assertions</text>
  <text x="268" y="118" fill="#f1f5f9" font-family="ui-monospace" font-size="11">outcome · status · body</text>
  <text x="268" y="138" fill="#f1f5f9" font-family="ui-monospace" font-size="11">edit status → ${AM21_WRONG_STATUS}</text>
  <text x="268" y="158" fill="#a8b8cc" font-family="system-ui" font-size="11">FAIL is the point</text>
  <text x="268" y="202" fill="#ef4444" font-family="system-ui" font-size="10">Wrong expected must fail loudly</text>

  <rect x="478" y="72" width="196" height="150" rx="8" fill="#1e293b" stroke="#a78bfa" />
  <text x="494" y="96" fill="#a78bfa" font-family="system-ui" font-size="12" font-weight="600">Run all + replay</text>
  <text x="494" y="118" fill="#f1f5f9" font-family="ui-monospace" font-size="11">sequential batch</text>
  <text x="494" y="138" fill="#f1f5f9" font-family="ui-monospace" font-size="11">run the dice twice</text>
  <text x="494" y="158" fill="#a8b8cc" font-family="system-ui" font-size="11">identical weighted runs</text>
  <text x="494" y="202" fill="#22c55e" font-family="system-ui" font-size="10">Export the evidence bundle</text>

  <rect x="26" y="240" width="648" height="70" rx="8" fill="#1e293b" stroke="#3b4a60" />
  <text x="42" y="268" fill="#f1f5f9" font-family="system-ui" font-size="12" font-weight="600">Examples attach an unassociated sample to a rule and Try in Requests hands the case to a client tab.</text>
  <text x="42" y="290" fill="#a8b8cc" font-family="system-ui" font-size="11">redfireforge mock simulate workspace.json is the copyable unit-level command on the explorer footer.</text>

  <rect x="26" y="328" width="648" height="78" rx="8" fill="#1e293b" stroke="#22c55e" />
  <text x="42" y="356" fill="#22c55e" font-family="system-ui" font-size="12" font-weight="600">Scratch pad → three views → edit expected → FAIL → run-all → seed twice → export → attach + try</text>
  <text x="42" y="378" fill="#a8b8cc" font-family="system-ui" font-size="11">No listener. The suite is the proof. Examples outlive the Simulate session.</text>
</svg>
`;

export const apiMockAm21Lesson: DemoLesson = {
  id: 'am-21-simulation-suite',
  domainId: 'protocols',
  category: 'api-mock',
  name: 'Simulation as a Test Suite: Examples, Assertions, Trace',
  description:
    'Open Simulate on a workspace that already has eight saved samples with '
    + 'expectations. Use the scratch pad for an ad-hoc GET, then read the '
    + 'decision trace, the normalized request, and the rendered bytes. Edit '
    + `one expected status to ${AM21_WRONG_STATUS} so the next run fails `
    + 'loudly. Run all samples so sequential state advances, run the dice '
    + 'sample twice so the weighted face matches, export the trace '
    + 'bundle, then attach an unassociated example and Try in Requests.',
  estimatedMinutes: 8,
  initialTab: 'api-mock-studio',
  contentVersion: 4,
  concept: {
    title: 'A sample without an expectation is a demo, not a test.',
    body:
      '**Simulate** evaluates requests against the mock without opening a '
      + 'listener or mutating live state. Saved samples on the left are the '
      + 'suite; the **scratch pad** is for a throwaway probe. After a run, '
      + 'three views explain the verdict: the **decision trace** is the '
      + 'seven-step pipeline, **Normalized** is what matchers actually saw, '
      + 'and **Rendered** is the bytes that would have gone on the wire.\n\n'
      + '**Assertions** turn that verdict into a test. Outcome, status, and '
      + 'body-contains are the contract. A wrong expected value must **FAIL** '
      + 'in the sidebar — silence is how regressions hide. **Run all** walks '
      + 'the suite sequentially so state and sequence advance like production. '
      + 'Two runs in the same Simulate session repeat weighted, jitter, and '
      + 'probability choices. **Export trace** is the evidence you attach to a PR.\n\n'
      + '**Examples** on the rule keep those cases after Simulate closes. '
      + 'Attach an unassociated sample to the rule you meant, then **Try in '
      + 'Requests** hands the same call to a client tab. The explorer footer '
      + 'copies `redfireforge mock simulate workspace.json` for the unit-level counterpart.',
    keyTerms: [
      { term: 'Saved sample', definition: 'A named request plus optional expectations stored on the mock. Simulate treats the list as a regression suite.' },
      { term: 'Scratch pad', definition: 'The ad-hoc request at the top of Simulate. Editable method, path, headers, and body that are not a saved sample until you click Save as sample.' },
      { term: 'Expectation', definition: 'The contract on a sample: expected outcome, status, body substring, and optionally which rule should win. Missing expectations make the run a demo.' },
      { term: 'Reproducible run', definition: 'Simulate pins weighted variants, template helpers, and delay jitter for the session, so two runs match without typing a seed.' },
      { term: 'Sequential batch', definition: 'Run all samples in order so state machines, sequence cursors, and match counts advance across the suite the way production traffic would.' },
      { term: 'Trace export', definition: 'A JSON bundle of seed, generation, and per-sample results you can attach to a PR or bug report without starting a listener.' },
    ],
    diagram: DIAGRAM,
  },
  prepareBeforeNavigate: prepareAm21Workspace,
  cleanup: cleanupAm21,
  steps: [
    {
      id: 'suite-and-scratchpad',
      title: 'Simulate is a unit-test runner, plus a scratch pad',
      description:
        'Click **Simulate**. Hold **Saved samples** — that list is the suite '
        + 'already in this workspace — then hold the **Scratch pad**. Fill '
        + `the path with \`${AM21_ADHOC_PATH}\`. **Save as sample**, name it, hold the saved `
        + 'request so you can read it, then hold **Run simulation** before the click. The outcome is the '
        + 'scratch-pad verdict: you did not start a listener, and you did not '
        + 'have to pick a saved sample to ask “what would this call do?”',
      highlight: API_MOCK.SIMULATE,
      action: async (ctx) => {
        await runAm21SuiteAndScratchpad(ctx);
      },
      verify: API_MOCK.SIMULATE_OUTCOME,
    },
    {
      id: 'three-views',
      title: 'Decision trace, normalized request, rendered response',
      description:
        'Hold the first timeline step — that is the seven-step pipeline the '
        + 'engine walked. Open the **Request** tab and hold the normalized '
        + 'JSON: method, path, and headers the way matchers actually see them, '
        + 'not the raw URL bar.\n\n'
        + 'Then open **Rendered** and hold the shipped bytes. Trace explains '
        + 'the choice; Normalized is the input; Rendered is what the client '
        + 'would have received.',
      highlight: API_MOCK.SIMULATE_TIMELINE_FIRST,
      preAction: ensureAm21ForThreeViews,
      action: async (ctx) => {
        await runAm21ThreeViews(ctx);
      },
      verify: API_MOCK.SIMULATE_RENDERED,
    },
    {
      id: 'expectations',
      title: 'A sample without an expectation is a demo, not a test',
      description:
        'Open the **Assertions** tab. Hold the outcome row, then status, then '
        + 'body-contains — those are the contract columns, expected versus '
        + 'actual. A saved sample already ships a 200; that is why the status '
        + 'row is green.\n\n'
        + `Edit expected status to \`${AM21_WRONG_STATUS}\`. Hold the field. `
        + 'The table is now a test you can fail on purpose. The next step '
        + 'proves the suite notices.',
      highlight: API_MOCK.SIMULATE_TAB_ASSERTIONS,
      preAction: ensureAm21ForExpectations,
      action: async (ctx) => {
        await runAm21Expectations(ctx);
      },
      verify: API_MOCK.SIMULATE_ASSERT_STATUS,
    },
    {
      id: 'fail-loudly',
      title: 'A wrong expectation must fail visibly',
      description:
        'Select the health sample and hold **Run simulation** before the '
        + 'click. The sidebar badge turns **FAIL** — not a quiet mismatch in '
        + 'a log. Hold that badge, then hold the Fail reason on the status '
        + 'row.\n\n'
        + 'If a suite cannot fail, it cannot catch a regression. The red '
        + 'badge is the product doing its job.',
      highlight: API_MOCK.simSample(AM21_HEALTH_ID),
      preAction: ensureAm21ForFailLoudly,
      action: async (ctx) => {
        await runAm21FailLoudly(ctx);
      },
      verify: API_MOCK.SIMULATE_FAIL_BADGE,
    },
    {
      id: 'run-all',
      title: 'The whole suite, sequentially, so state advances like production',
      description:
        'Click **Run all samples**. Hold the footer tally — passed versus '
        + 'conflicts — then hold the per-sample **state** chip on the cart '
        + 'row. Run-all is not eight independent clicks: sequential batch '
        + 'lets the state machine walk opened → done the way live traffic '
        + 'would.\n\n'
        + 'The tally is the suite result. One FAIL in the list is still a '
        + 'failed run, and that is correct.',
      highlight: API_MOCK.SIMULATE_RUN_ALL,
      preAction: ensureAm21ForRunAll,
      action: async (ctx) => {
        await runAm21RunAll(ctx);
      },
      verify: API_MOCK.SIMULATE_SUMMARY,
    },
    {
      id: 'seed',
      title: 'Weighted, jitter, and probability become reproducible',
      description:
        'Hold **Run simulation** on the dice sample, then hold the rendered '
        + 'face. Run again and hold the identical outcome.\n\n'
        + 'Simulate pins the roll for this session — you do not type a seed. '
        + 'The point of a suite is that a flaky weighted mock is a test you '
        + 'can replay, not a coin flip in CI.',
      highlight: API_MOCK.SIMULATE_RUN,
      preAction: ensureAm21ForSeed,
      action: async (ctx) => {
        await runAm21Seed(ctx);
      },
      verify: API_MOCK.SIMULATE_OUTCOME,
    },
    {
      id: 'export-trace',
      title: 'Hand the evidence to a PR or bug report',
      description:
        'Click **Export trace**. Hold the confirmation — filename and a '
        + 'preview of the bundle: server id, seed, draft generation, and how '
        + 'many sample results travelled with it.\n\n'
        + 'That JSON is the audit trail without starting a listener. The next '
        + 'step closes Simulate and lives on the rule — Examples outlive this '
        + 'modal.',
      highlight: API_MOCK.SIMULATE_EXPORT,
      preAction: ensureAm21ForExport,
      action: async (ctx) => {
        await runAm21ExportTrace(ctx);
      },
      verify: API_MOCK.SIMULATE_EXPORT_CONFIRM,
    },
    {
      id: 'examples',
      title: 'Per-rule regression cases that outlive the session',
      description:
        'Open the **Examples** tab. The grid is every sample this rule can '
        + 'see — including the unassociated GET that has no `routeId` yet. '
        + 'Click **Attach to this rule** and hold the card so the unassociated '
        + 'chip is gone.\n\n'
        + 'Click **Try in Requests** and hold the URL that opened in the '
        + 'client tab. Come back to Studio and hold `redfireforge mock simulate '
        + 'workspace.json` on the explorer footer — that is the unit-level '
        + 'handoff. The attached row stays on the rule after Simulate is gone.',
      highlight: API_MOCK.BTAB_EXAMPLES,
      preAction: ensureAm21ForExamples,
      action: async (ctx) => {
        await runAm21Examples(ctx);
      },
      verify: API_MOCK.exampleRow(AM21_ORPHAN_ID),
    },
  ],
};
