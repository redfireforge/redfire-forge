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
  contentVersion: 5,
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
        'Open **Import**, pick **OpenAPI**, and paste the Orders spec. Click '
        + '**Pretty format** so the spec is readable, then parse. The review '
        + 'lists `POST /orders` and `GET /orders/{id}` as stubs. Toggle '
        + '**Generalize paths** when it is offered so `{id}` becomes a '
        + 'parameter, then confirm. Drafts stay grey — they will not answer '
        + 'a client yet.\n\n'
        + 'Select `POST /orders` and **Enable** it. That is the contract this '
        + 'lesson authors. The GET item route can wait; one enabled path is '
        + 'enough to start matching on.',
      highlight: API_MOCK.IMPORT_MENU,
      action: runAm24FromSpec,
      verify: API_MOCK.ROUTE_ENABLED,
    },
    {
      id: 'matching',
      title: 'A JSONPath predicate is what makes two POSTs different',
      description:
        'Open the Pattern Toolbox and the **JSON body** tab. Paste a create '
        + `payload, point the expression at \`${AM24_JSONPATH}\`, and set `
        + `equals \`${AM24_SKU}\`. **Apply** lands the row on Match — the `
        + 'rule no longer answers every body.\n\n'
        + 'Prove it in **Simulate**: same path, that SKU, **Run simulation**. '
        + 'MATCHED is the unit-level proof before a listener exists. Close '
        + 'Simulate so the editor is visible again.',
      highlight: API_MOCK.PATH_TOOLBOX,
      preAction: ensureAm24ForMatching,
      action: runAm24Matching,
      verify: API_MOCK.PATH_TOOLBOX,
    },
    {
      id: 'response',
      title: 'Template the 201 so every example looks like a person',
      description:
        'Switch to **Response**. Replace the static stub with a templated '
        + 'body: echo `$.sku`, mint a `uuid`, and fill `buyer` / `email` from '
        + '**faker**. Hold the editor so the helpers are readable.\n\n'
        + 'Click **Format** — that is the power-user tidy for minified JSON — '
        + 'then hold the **preview**. The preview evaluates helpers against a '
        + 'sample request, so you see a name, not the mustache.',
      highlight: API_MOCK.BTAB_RESPONSE,
      preAction: ensureAm24ForResponse,
      action: runAm24Response,
      verify: API_MOCK.PREVIEW_BODY,
    },
    {
      id: 'variants',
      title: 'A 404 sibling, then sequence as the retry lab',
      description:
        '**Add variant**, name it **Not found**, and click **404**. On '
        + '**Selection**, condition that sibling on the missing SKU so rules '
        + 'mode can pick it from the payload.\n\n'
        + 'Switch to **Sequence** and hold the order note — that is the retry '
        + 'lab, round-robin for backoff tests. Then switch back to **Rules**. '
        + 'The rest of the contract must stay deterministic: one default 201, '
        + 'one conditioned 404.',
      highlight: API_MOCK.ADD_VARIANT,
      preAction: ensureAm24ForVariants,
      action: runAm24Variants,
      verify: API_MOCK.RESPONSE_MODE_RULES,
    },
    {
      id: 'resilience',
      title: 'Delay and probability on the 201; a timeout on the 404',
      description:
        'On the default variant open **Timing**. Set **Delay** to 200 ms and '
        + '**Probability** to 1 so the happy path is always eligible but never '
        + 'instant. Clients that ignore latency will notice; the suite will not '
        + 'flake.\n\n'
        + 'Select the 404 sibling, open **Faults**, and pick **Timeout**. That '
        + 'fault only fires when the missing-SKU condition wins, so the 201 '
        + 'path you will Simulate and Quick Test stays a real HTTP response.',
      highlight: API_MOCK.RESPONSE_TAB_TIMING,
      preAction: ensureAm24ForResilience,
      action: runAm24Resilience,
      verify: API_MOCK.FAULTS_PANEL,
    },
    {
      id: 'conflicts',
      title: 'Analyze the overlap you just created, then raise priority',
      description:
        '**Add route** and point it at the same `POST /orders`. Two enabled '
        + 'rules on one path is how duplicates happen in a real library — '
        + 'not a gallery of overlaps.\n\n'
        + 'Click **Analyze**, hold the first finding, then **Adjust priority** '
        + '(or type 20 on the authored rule) and re-analyze. Clean means the '
        + 'inspector is empty or the pair is no longer a duplicate. Return to '
        + 'Studio before the next step.',
      highlight: API_MOCK.ANALYZE,
      preAction: ensureAm24ForConflicts,
      action: runAm24Conflicts,
      verify: API_MOCK.ROUTE_EXPLORER,
    },
    {
      id: 'suite',
      title: 'Save the sample with an expected 201, then Run all green',
      description:
        'Open **Simulate**. If the WIDGET probe is not already a saved sample, '
        + 'run it from the scratch pad and **Save as sample**. Open '
        + '**Assertions** and set expected status to **201** — that is the '
        + 'grade, not a screenshot of MATCHED.\n\n'
        + '**Run all**. Hold the summary until every saved sample is green. '
        + 'This is the unit suite CI will run with `redfireforge mock simulate`. Close '
        + 'Simulate before live traffic.',
      highlight: API_MOCK.SIMULATE,
      preAction: ensureAm24ForSuite,
      action: runAm24Suite,
      verify: API_MOCK.SIMULATE,
    },
    {
      id: 'live',
      title: 'Start, post the contract, then read a near-miss in the journal',
      description:
        '**Apply** if the badge is dirty, then **Start**. Hold **Running** — '
        + 'the listener is the difference between Simulate and the wire. POST '
        + '`/orders` with the WIDGET body; the first journal row is the match.\n\n'
        + 'Then GET `/ordrs/42` — a typo, not a second contract. Open that '
        + 'row and hold **Near-misses**. Closest-match is how you debug a path '
        + 'the library almost had. The suite stayed green; the journal is '
        + 'honest about the miss.',
      highlight: API_MOCK.START,
      preAction: ensureAm24ForLive,
      action: runAm24Live,
      verify: API_MOCK.JOURNAL_FIRST_ROW,
    },
    {
      id: 'ship',
      title: 'Export the artifacts, then Quick Test the graph green',
      description:
        '**Export → Workspace JSON**, hold the confirmation (that file is what '
        + 'CI consumes), close it, then **WireMock** and hold any loss notes. '
        + 'Close the confirmation so the next surface is not covered.\n\n'
        +         'Switch to the Designer. Drop **Start Mock Server** (isolate, Import '
        + 'sandbox), connect it to the Start trigger, and **Fit View**. Drop '
        + '**HTTP** `{{mockBaseUrl}}/orders`, **Assert** journal 201, and '
        + '**Stop**, connecting each as it lands. Then **Quick Test**. Green '
        + 'on Assert is the in-app proof the contract ships.',
      highlight: API_MOCK.EXPORT,
      preAction: ensureAm24ForShip,
      action: runAm24Ship,
      verify: am24PassSelector(API_MOCK.CANVAS_ASSERT),
    },
  ],
  prepareBeforeNavigate: prepareAm24Workspace,
  setup: prepareAm24Workspace,
  cleanup: cleanupAm24,
};
