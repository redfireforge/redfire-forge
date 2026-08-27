/**
 * AM-21 `am-21-simulation-suite` — Simulation as a Test Suite: Examples,
 * Assertions, Trace.
 *
 * Scenario: eight saved samples with expectations are already in the workspace.
 * Simulate is the unit-test runner — scratch pad, decision trace, assertions
 * you can edit, FAIL, run-all with sequential state, two identical weighted
 * runs, an export bundle, then Examples that outlive the session. Curriculum:
 * API Mock demo curriculum v2 §5 Track E.
 */
import { API_MOCK } from '@shared/selectors';
import type { DemoLesson } from '../../types';
import {
  AM21_ADHOC_PATH,
  AM21_DICE_NAME,
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
  domainId: 'api-mock',
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
  contentVersion: 11,
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
        'The most useful thing about **Simulate** is what it *isn’t*: no '
        + 'listener, no live state to mutate, no client to wire up. It is a '
        + 'unit-test runner for your mock. The **Saved samples** on the left '
        + 'are the suite that already ships in this workspace; the **Scratch '
        + 'pad** at the top is for the throwaway question — “what would *this* '
        + 'call do?”\n\n'
        + `Here that question is a quick \`GET ${AM21_ADHOC_PATH}\`. Save it as `
        + 'a sample and run it, and the verdict comes back with none of the '
        + 'usual ceremony. You asked the mock a question and got an answer, in '
        + 'place.',
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
        'A verdict you cannot explain is a verdict you cannot trust, so '
        + 'Simulate shows its work in three views. The **decision trace** is '
        + 'the seven-step pipeline the engine actually walked to reach its '
        + 'choice. **Normalized** is the request as the *matchers* saw it — '
        + 'method, path, headers — not the raw URL you typed. **Rendered** is '
        + 'the exact bytes that would have gone on the wire.\n\n'
        + 'Read together they answer three different questions: *why* this rule '
        + 'won (trace), *what* it matched against (normalized), and *what* the '
        + 'client would have received (rendered).',
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
        'A run that always “passes” proves nothing — it is a demo, not a '
        + 'test. What turns a saved sample into a test is an **expectation**. '
        + 'On the **Assertions** tab, only two Expected cells are inputs: '
        + '**Status** and **Body contains**. Those are the contract you can '
        + 'rewrite here. Outcome, Rule, Response, Body exact, Fault, and '
        + 'Virtual delay are recorded from the sample or observed from this '
        + 'run — they are not fields you type.\n\n'
        + `Now break it on purpose — edit expected status to \`${AM21_WRONG_STATUS}\`. `
        + 'Nothing fails *yet*; you have simply written a contract the mock is '
        + 'about to violate. The next step is where the suite has to notice.',
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
        `**What you'll do:** click **Run simulation** on \`GET /health\` — `
        + `the sample whose expected status you just set to \`${AM21_WRONG_STATUS}\`.\n\n`
        + '**What you\'ll see:** the sample’s sidebar badge turns red **FAIL**. '
        + `On **Assertions**, Status is expected \`${AM21_WRONG_STATUS}\`, actual `
        + '`200`, result **fail**. The **Decision trace** can still say '
        + '**MATCHED** — the health rule still won; the *test* failed.\n\n'
        + '**Why it matters:** matching a rule is not the same as passing the '
        + 'contract. A red **FAIL** is the suite doing its job. If a wrong '
        + 'expectation stayed green, regressions would slip through silently.',
      highlight: API_MOCK.SIMULATE_SECTION_SAVED,
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
        'One sample at a time answers “does this case work?” **Run all '
        + 'samples** answers the bigger question — “does the suite still hold '
        + 'together?” — and it does so *sequentially*, on purpose. This is not '
        + 'eight independent clicks: state machines, sequence cursors, and '
        + 'match counts advance across the run the way real traffic would move '
        + 'them (watch the cart sample’s **state** chip walk opened → done).\n\n'
        + 'The footer tally — passed versus conflicts — is the suite result. '
        + 'And the one FAIL you planted still counts: a suite with a known '
        + 'failure is a failed run, which is exactly correct.',
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
        `**What you'll do:** select \`${AM21_DICE_NAME}\` and click `
        + '**Run simulation** twice — same sample, back to back. You do not '
        + 'type a seed.\n\n'
        + '**What you\'ll see:** **Rendered response** shows the same dice '
        + 'face both times. The roll is pinned for this Simulate session, so '
        + 'the second run is a replay, not a new coin flip.\n\n'
        + '**Why it matters:** a weighted or jittered mock is the classic '
        + 'flaky test — green on your machine, red in CI, and nobody can '
        + 'reproduce it. A pinned seed is what lets that mock live in a '
        + 'regression suite: a case you can replay is a case you can debug.',
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
        'A green suite on your screen convinces *you*; a colleague needs '
        + 'evidence. **Export trace** packages exactly that — server id, seed, '
        + 'draft generation, and every per-sample result — into one JSON '
        + 'bundle you can attach to a PR or a bug report.\n\n'
        + 'Because it captures the pinned seed and generation, someone else '
        + 'can see precisely what ran without ever starting a listener. It is '
        + 'the audit trail for a test run that has no live server. Next the '
        + 'cases move somewhere permanent — onto the rule itself.',
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
        'Everything so far lived inside the Simulate modal and vanishes when '
        + 'it closes. **Examples** are how a good case survives: the tab lists '
        + 'every sample the rule can see — including that unassociated `GET` '
        + 'with no `routeId` yet. **Attach to this rule** adopts it, and the '
        + '“unassociated” chip disappears.\n\n'
        + 'From there the case has two homes: **Try in Requests** hands the '
        + 'same call to a real client tab, and the explorer footer copies '
        + '`redfireforge mock simulate workspace.json` for the CLI equivalent. '
        + 'Close Simulate and the attached example is still there — a '
        + 'regression case that now belongs to the rule, not the session.',
      highlight: API_MOCK.BTAB_EXAMPLES,
      preAction: ensureAm21ForExamples,
      action: async (ctx) => {
        await runAm21Examples(ctx);
      },
      verify: API_MOCK.EXAMPLES_GRID,
    },
  ],
};
