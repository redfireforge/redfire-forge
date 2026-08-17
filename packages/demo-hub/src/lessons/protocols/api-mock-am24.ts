/**
 * AM-24 `am-24-capstone` — Ship a Contract Mock.
 *
 * Scenario: the workspace starts empty. The lesson imports an OpenAPI spec
 * as drafts, authors matching, a templated response, variants, resilience,
 * and a conflict fix live, then proves the contract in Simulate, on the
 * wire, and as a Workflow Quick Test after exporting the artifact.
 * Curriculum: `docs/plan/future/apimock/apimock-demo-curriculum-v2.md` §5 Track E.
 */
import { API_MOCK } from '@shared/selectors';
import type { DemoLesson } from '../../types';
import {
  AM24_JSONPATH,
  AM24_SKU,
  cleanupAm24,
  ensureAm24ForConflicts,
  ensureAm24ForImport,
  ensureAm24ForLive,
  ensureAm24ForMatching,
  ensureAm24ForResilience,
  ensureAm24ForResponse,
  ensureAm24ForShip,
  ensureAm24ForSuite,
  ensureAm24ForVariants,
  prepareAm24Workspace,
  runAm24Conflicts,
  runAm24FromSpec,
  runAm24Live,
  runAm24Matching,
  runAm24Resilience,
  runAm24Response,
  runAm24Ship,
  runAm24Suite,
  runAm24Variants,
  am24PassSelector,
} from './api-mock-am24-helpers';

const DIAGRAM = `
<svg viewBox="0 0 700 430" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="OpenAPI drafts become a contract mock, proven in Simulate and on the wire, then exported and run as a Quick Test">
  <rect x="0" y="0" width="700" height="430" fill="#0f172a" />

  <text x="26" y="34" fill="#f1f5f9" font-family="system-ui" font-size="16" font-weight="600">From spec to a shippable contract mock.</text>
  <text x="26" y="54" fill="#64748b" font-family="system-ui" font-size="10">OpenAPI · JSONPath · faker · variants · Analyze · Simulate · journal · export · Quick Test</text>

  <rect x="26" y="76" width="150" height="58" rx="8" fill="#1e293b" stroke="#38bdf8" />
  <text x="48" y="110" fill="#38bdf8" font-family="system-ui" font-size="12" font-weight="600">Import drafts</text>
  <rect x="196" y="76" width="150" height="58" rx="8" fill="#1e293b" stroke="#a78bfa" />
  <text x="214" y="110" fill="#a78bfa" font-family="system-ui" font-size="12" font-weight="600">Match + body</text>
  <rect x="366" y="76" width="150" height="58" rx="8" fill="#1e293b" stroke="#f59e0b" />
  <text x="386" y="110" fill="#f59e0b" font-family="system-ui" font-size="12" font-weight="600">Variants + delay</text>
  <rect x="536" y="76" width="138" height="58" rx="8" fill="#1e293b" stroke="#22c55e" />
  <text x="558" y="110" fill="#22c55e" font-family="system-ui" font-size="12" font-weight="600">Analyze clean</text>

  <path d="M176 105 H196" stroke="#64748b" stroke-width="2" marker-end="url(#am24arrow)" />
  <path d="M346 105 H366" stroke="#64748b" stroke-width="2" marker-end="url(#am24arrow)" />
  <path d="M516 105 H536" stroke="#64748b" stroke-width="2" marker-end="url(#am24arrow)" />

  <rect x="26" y="168" width="200" height="58" rx="8" fill="#1e293b" stroke="#38bdf8" />
  <text x="62" y="202" fill="#38bdf8" font-family="system-ui" font-size="12" font-weight="600">Suite all green</text>
  <rect x="246" y="168" width="200" height="58" rx="8" fill="#1e293b" stroke="#f97316" />
  <text x="278" y="202" fill="#f97316" font-family="system-ui" font-size="12" font-weight="600">Live + near-miss</text>
  <rect x="466" y="168" width="208" height="58" rx="8" fill="#1e293b" stroke="#22c55e" />
  <text x="492" y="202" fill="#22c55e" font-family="system-ui" font-size="12" font-weight="600">Export · Quick Test</text>

  <path d="M605 134 V148 H126 V168" stroke="#64748b" stroke-width="2" fill="none" marker-end="url(#am24arrow)" />
  <path d="M226 197 H246" stroke="#64748b" stroke-width="2" marker-end="url(#am24arrow)" />
  <path d="M446 197 H466" stroke="#64748b" stroke-width="2" marker-end="url(#am24arrow)" />

  <defs>
    <marker id="am24arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L6,3 L0,6 Z" fill="#64748b" />
    </marker>
  </defs>

  <rect x="26" y="250" width="648" height="70" rx="8" fill="#1e293b" stroke="#3b4a60" />
  <text x="42" y="278" fill="#f1f5f9" font-family="system-ui" font-size="12" font-weight="600">Drafts stay off until you enable the one path the client will hit.</text>
  <text x="42" y="300" fill="#a8b8cc" font-family="system-ui" font-size="11">Simulate is the unit suite. The journal is the live audit. Workspace JSON is the CI artifact.</text>

  <rect x="26" y="338" width="648" height="70" rx="8" fill="#1e293b" stroke="#22c55e" />
  <text x="42" y="366" fill="#22c55e" font-family="system-ui" font-size="12" font-weight="600">Quick Test starts an isolated listener, posts the contract, asserts the journal, and stops.</text>
  <text x="42" y="388" fill="#a8b8cc" font-family="system-ui" font-size="11">Studio authors. Simulate proves. Workflow runs it. Export is what you hand to CI.</text>
</svg>
`;

export const apiMockAm24Lesson: DemoLesson = {
  id: 'am-24-capstone',
  domainId: 'protocols',
  category: 'api-mock',
  name: 'Ship a Contract Mock',
  description:
    'Start from an empty Studio and import an OpenAPI spec as disabled drafts. '
    + 'Generalize the paths, enable `POST /orders`, then author a JSONPath '
    + 'predicate, a faker-templated 201, a 404 sibling, delay, and a fault '
    + 'variant. Analyze the overlap you just created, raise priority, and '
    + 're-analyze clean. Prove the suite green, send live traffic (including '
    + 'a near-miss), export workspace JSON plus WireMock, and finish with a '
    + 'Workflow Quick Test that starts, posts, asserts, and stops.',
  estimatedMinutes: 8,
  initialTab: 'api-mock-studio',
  allowedTabs: ['api-mock-studio', 'workflow'],
  collapseAppSidebarOnStart: true,
  contentVersion: 7,
  concept: {
    title: 'A contract mock is a spec you can run, not a screenshot of a 200.',
    body:
      'The pack taught each surface on its own: import, matchers, templates, '
      + 'variants, faults, conflicts, Simulate, the journal, export, and '
      + 'Workflow. This lesson is the timed integration — one Orders contract '
      + 'authored live from a spec, then proven three ways.\n\n'
      + '**Drafts** are how OpenAPI lands without silently answering production '
      + 'traffic. You generalize `{id}` paths, then enable only `POST /orders`. '
      + 'A **JSONPath** predicate is the difference between "any body" and the '
      + 'SKU the client actually sends. **Faker** keeps examples human without '
      + 'hard-coding names. A **404 variant** plus delay and a fault sibling '
      + 'are the retry story the suite will hit. **Analyze** is how you notice '
      + 'the duplicate you just added; raising priority and re-analyzing is '
      + 'how you ship clean.\n\n'
      + '**Simulate** is unit-level (no sockets). **Start** plus a real POST '
      + 'writes the journal, and a typo path is the near-miss you would debug. '
      + '**Workspace JSON** and **WireMock** are the artifacts. **Quick Test** '
      + 'is the in-app proof that isolate, the mock base URL, and the journal '
      + 'assertion survive a graph run.',
    keyTerms: [
      {
        term: 'Draft route',
        definition:
          'An imported rule that stays disabled until you enable it — OpenAPI stubs do not answer traffic by accident.',
      },
      {
        term: 'JSONPath predicate',
        definition:
          'A body matcher that reads a path such as $.sku and compares the resolved value, so two POSTs to the same URL can still split.',
      },
      {
        term: 'Templated body',
        definition:
          'Response JSON with helpers (uuid, faker, jsonPath) evaluated per request so examples stay unique without hand-editing.',
      },
      {
        term: 'Conflict Analyze',
        definition:
          'Static overlap scan of enabled rules. Duplicate or shadowed findings are fixed by priority, then re-analyzed until the list is clean.',
      },
      {
        term: 'Simulation suite',
        definition:
          'Saved samples with expected status that Run all can grade without binding a port.',
      },
      {
        term: 'Quick Test',
        definition:
          'Designer run that starts an isolated mock, fires the HTTP node, asserts the journal, and stops the listener.',
      },
    ],
    diagram: DIAGRAM,
  },
  steps: [
    {
      id: 'from-spec',
      title: 'Import the spec as drafts, then enable the path you need',
      description:
        'A spec is a promise; a mock is a promise you can call. This capstone '
        + 'starts from the promise — paste the Orders **OpenAPI** spec — but '
        + 'the safety that matters is that it lands as **drafts**: every path '
        + 'imports *disabled*, so an OpenAPI import can never silently begin '
        + 'answering production traffic. Generalizing `{id}` into a real path '
        + 'parameter is the one cleanup that turns those stubs into usable '
        + 'rules.\n\n'
        + 'Then make a deliberate choice — enable only `POST /orders`, the one '
        + 'path this lesson authors. The GET item route can stay a draft: a '
        + 'contract mock serves exactly what you turned on, never what you '
        + 'merely imported.',
      highlight: API_MOCK.IMPORT_MENU,
      preAction: ensureAm24ForImport,
      action: runAm24FromSpec,
      verify: API_MOCK.ROUTE_ENABLED,
    },
    {
      id: 'matching',
      title: 'A JSONPath predicate is what makes two POSTs different',
      description:
        'Two clients can POST to the very same `/orders` URL and mean '
        + 'completely different things — the difference lives in the *body*. A '
        + `**JSONPath predicate** is what lets the rule see it: point it at `
        + `\`${AM24_JSONPATH}\` and require \`${AM24_SKU}\`, and the rule stops `
        + 'answering “any body” and starts answering *this* order.\n\n'
        + 'Then prove it before a listener even exists. **Simulate** the same '
        + 'path with that SKU and the verdict is MATCHED — unit-level '
        + 'confidence that the matcher is right, with nothing bound to a port '
        + 'yet.',
      highlight: API_MOCK.PATH_TOOLBOX,
      preAction: ensureAm24ForMatching,
      action: runAm24Matching,
      verify: API_MOCK.PATH_TOOLBOX,
    },
    {
      id: 'response',
      title: 'Template the 201 so every example looks like a person',
      description:
        'A mock that always returns the same hard-coded name is obviously '
        + 'fake, and reviewers quietly stop trusting it. Templating the **201** '
        + 'fixes that: echo the caller’s `$.sku`, mint a fresh `uuid`, and let '
        + '**faker** fill `buyer` / `email`, so every response reads like a '
        + 'real, distinct order.\n\n'
        + 'The **preview** is the whole point — it evaluates those helpers '
        + 'against a sample request, so you see an actual name and id rather '
        + 'than the `{{mustache}}`. That is the difference between a template '
        + 'you *hope* works and one you can *watch* working.',
      highlight: API_MOCK.BTAB_RESPONSE,
      preAction: ensureAm24ForResponse,
      action: runAm24Response,
      verify: API_MOCK.PREVIEW_BODY,
    },
    {
      id: 'variants',
      title: 'A 404 sibling, then sequence as the retry lab',
      description:
        'One rule, one response is a stub; a real contract has *branches*. Add '
        + 'a **404** sibling and condition it on the missing SKU, so the same '
        + 'endpoint answers 201 for a known order and 404 for an unknown one — '
        + 'the client’s real happy and sad paths in a single rule.\n\n'
        + '**Sequence** mode is worth a glance as the retry lab (round-robin '
        + 'responses for backoff tests), but switch back to **Rules**: the rest '
        + 'of this contract must stay *deterministic* — one default 201, one '
        + 'conditioned 404 — so the suite and Quick Test later are repeatable, '
        + 'not a dice roll.',
      highlight: API_MOCK.ADD_VARIANT,
      preAction: ensureAm24ForVariants,
      action: runAm24Variants,
      verify: API_MOCK.RESPONSE_MODE_RULES,
    },
    {
      id: 'resilience',
      title: 'Delay and probability on the 201; a timeout on the 404',
      description:
        'Real services are slow and occasionally broken, and a mock that '
        + 'answers instantly and perfectly hides the bugs that only surface '
        + 'under those conditions. On the 201, a 200 ms **delay** — with '
        + '**probability** 1, so it is always eligible but never instant — is '
        + 'enough to shake out clients that assume latency is zero.\n\n'
        + 'The **timeout** fault goes on the 404 sibling *on purpose*: it fires '
        + 'only when the missing-SKU branch wins, so the 201 path you are about '
        + 'to Simulate and Quick Test stays a real, clean HTTP response. You '
        + 'are adding failure exactly where the retry story needs it, and '
        + 'nowhere it would break the proof.',
      highlight: API_MOCK.RESPONSE_TAB_TIMING,
      preAction: ensureAm24ForResilience,
      action: runAm24Resilience,
      verify: API_MOCK.FAULTS_PANEL,
    },
    {
      id: 'conflicts',
      title: 'Analyze the overlap you just created, then raise priority',
      description:
        'Authoring a second rule on `POST /orders` is how duplicates actually '
        + 'creep into a library — not from a gallery of contrived overlaps, but '
        + 'from someone adding “just one more” rule on a busy path. That is why '
        + 'the step is here: create the overlap, then let **Analyze** catch '
        + 'it.\n\n'
        + 'The fix is not deletion but *precedence* — raise the authored rule’s '
        + 'priority and re-analyze until the inspector is clean. Shipping a '
        + 'contract mock means shipping it *unambiguous*, so the client’s '
        + 'request can only ever resolve one way.',
      highlight: API_MOCK.ANALYZE,
      preAction: ensureAm24ForConflicts,
      action: runAm24Conflicts,
      verify: API_MOCK.ROUTE_EXPLORER,
    },
    {
      id: 'suite',
      title: 'Save the sample with an expected 201, then Run all green',
      description:
        'MATCHED in Simulate proves the matcher; it does not prove the '
        + '*response*. Turning the WIDGET probe into a saved sample with an '
        + 'expected status of **201** turns a demo into a graded test — the run '
        + 'now checks the contract, not just that some rule won.\n\n'
        + '**Run all** green is the unit suite in miniature, and it is exactly '
        + 'what CI runs with `redfireforge mock simulate` — no listener at all. '
        + 'Prove the suite here and the CI command is just the same check on a '
        + 'build machine.',
      highlight: API_MOCK.SIMULATE,
      preAction: ensureAm24ForSuite,
      action: runAm24Suite,
      verify: API_MOCK.SIMULATE,
    },
    {
      id: 'live',
      title: 'Start, post the contract, then read a near-miss in the journal',
      description:
        'Simulate is hermetic; the wire is the truth. **Start** the listener '
        + 'and POST the WIDGET order for real — the first journal row is the '
        + 'contract answering an actual socket, not an in-memory '
        + 'evaluation.\n\n'
        + 'Then fumble on purpose: `GET /ordrs/42`, a typo, not a new contract. '
        + 'The **Near-misses** on that row are the debugging story — '
        + 'closest-match tells you the library *almost* had this path. Notice '
        + 'that the suite stayed green while the journal stayed honest about '
        + 'the miss: two different truths, both worth having.',
      highlight: API_MOCK.START,
      preAction: ensureAm24ForLive,
      action: runAm24Live,
      verify: API_MOCK.JOURNAL_FIRST_ROW,
    },
    {
      id: 'ship',
      title: 'Export the artifacts, then Quick Test the graph green',
      description:
        'A contract mock is only shippable if someone else can run it, so this '
        + 'final step produces the hand-offs. **Workspace JSON** is the file CI '
        + 'consumes; **WireMock** is the export for teams on that stack — hold '
        + 'the loss notes, because not every feature round-trips.\n\n'
        + 'Then the last proof closes the whole pack: a Designer graph that '
        + '**Starts** an isolated listener, **POSTs** `{{mockBaseUrl}}/orders`, '
        + '**Asserts** a 201 in the journal, and **Stops**. A green Assert on '
        + '**Quick Test** is the contract proving itself end to end — authored '
        + 'in Studio, proven in Simulate, run as a workflow, exported for CI.',
      highlight: API_MOCK.EXPORT,
      preAction: ensureAm24ForShip,
      action: runAm24Ship,
      verify: am24PassSelector(API_MOCK.CANVAS_ASSERT),
    },
  ],
  prepareBeforeNavigate: prepareAm24Workspace,
  cleanup: cleanupAm24,
};
