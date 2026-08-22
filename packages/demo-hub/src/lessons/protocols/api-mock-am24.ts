/**
 * AM-24 `am-24-capstone` — Ship a Contract Mock.
 *
 * Scenario: the workspace starts empty. The lesson imports an OpenAPI spec
 * as drafts, authors matching, a templated response, variants, resilience,
 * then proves the contract in Simulate, analyzes a duplicate health-check,
 * and ships it on the wire and as a Workflow Quick Test after exporting.
 * Curriculum: `docs/plan/future/apimock/apimock-demo-curriculum-v2.md` §5 Track E.
 */
import { API_MOCK } from '@shared/selectors';
import type { DemoLesson } from '../../types';
import {
  AM24_JSONPATH,
  AM24_SAMPLE_NAME,
  AM24_SAMPLE_NAME_FLAKY,
  AM24_SAMPLE_NAME_MISSING,
  AM24_SHIP_ACTION_TIMEOUT_MS,
  AM24_SUITE_ACTION_TIMEOUT_MS,
  AM24_SKU,
  AM24_SKU_MISSING,
  cleanupAm24,
  ensureAm24ForConflicts,
  ensureAm24ForExport,
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
  runAm24Export,
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
  <rect x="536" y="76" width="138" height="58" rx="8" fill="#1e293b" stroke="#38bdf8" />
  <text x="558" y="110" fill="#38bdf8" font-family="system-ui" font-size="12" font-weight="600">Suite all green</text>

  <path d="M176 105 H196" stroke="#64748b" stroke-width="2" marker-end="url(#am24arrow)" />
  <path d="M346 105 H366" stroke="#64748b" stroke-width="2" marker-end="url(#am24arrow)" />
  <path d="M516 105 H536" stroke="#64748b" stroke-width="2" marker-end="url(#am24arrow)" />

  <rect x="26" y="168" width="200" height="58" rx="8" fill="#1e293b" stroke="#22c55e" />
  <text x="58" y="202" fill="#22c55e" font-family="system-ui" font-size="12" font-weight="600">Analyze /health</text>
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
  <text x="42" y="278" fill="#f1f5f9" font-family="system-ui" font-size="12" font-weight="600">Drafts stay off until you enable the paths the client will hit.</text>
  <text x="42" y="300" fill="#a8b8cc" font-family="system-ui" font-size="11">Simulate is the unit suite. The journal is the live audit. Workspace JSON is the CI artifact.</text>

  <rect x="26" y="338" width="648" height="70" rx="8" fill="#1e293b" stroke="#22c55e" />
  <text x="42" y="366" fill="#22c55e" font-family="system-ui" font-size="12" font-weight="600">Quick Test starts an isolated listener, posts the contract, asserts the journal, and stops.</text>
  <text x="42" y="388" fill="#a8b8cc" font-family="system-ui" font-size="11">Studio authors. Simulate proves. Workflow runs it. Export is what you hand to CI.</text>
</svg>
`;

export const apiMockAm24Lesson: DemoLesson = {
  id: 'am-24-capstone',
  domainId: 'api-mock',
  category: 'api-mock',
  name: 'Ship a Contract Mock',
  description:
    'Start from an empty Studio and import an OpenAPI spec as disabled drafts. '
    + 'Generalize the paths, enable `POST /orders` and `GET /orders/{id}`, then author a JSONPath '
    + 'predicate, a faker-templated 201, and a 404 sibling — then delay the '
    + 'happy path and isolate a probability-gated timeout on a separate degraded '
    + 'branch. Prove the suite green, then author a duplicate `GET /health`, '
    + 'Analyze the overlap, raise priority, and re-analyze clean. Send live '
    + 'traffic (including a near-miss), export workspace JSON plus WireMock, '
    + 'and finish with a Workflow Quick Test that starts, posts, asserts, and stops.',
  estimatedMinutes: 9,
  initialTab: 'api-mock-studio',
  allowedTabs: ['api-mock-studio', 'workflow'],
  collapseAppSidebarOnStart: true,
  contentVersion: 20,
  concept: {
    title: 'A contract mock is a spec you can run, not a screenshot of a 200.',
    body:
      'The pack taught each surface on its own: import, matchers, templates, '
      + 'variants, faults, Simulate, conflicts, the journal, export, and '
      + 'Workflow. This lesson is the timed integration — one Orders contract '
      + 'authored live from a spec, then proven three ways.\n\n'
      + '**Drafts** are how OpenAPI lands without silently answering production '
      + 'traffic. You generalize `{id}` paths, then enable `POST /orders` and '
      + '`GET /orders/{id}` from the rule list. '
      + 'A **JSONPath** predicate is the difference between "any body" and the '
      + 'SKU the client actually sends. **Faker** keeps examples human without '
      + 'hard-coding names. A **404 variant** is the contract\'s sad path; a '
      + '**delay** on the 201 and a **probability-gated timeout** on a separate '
      + 'degraded branch are the resilience story — a 404 and a timeout are '
      + 'different failures, so they live on different variants. **Simulate** '
      + 'grades that contract (the suite still proves the clean 201) before '
      + 'anything else is added to the library. **Analyze** is how you notice '
      + 'a duplicate `GET /health` you then author on purpose; raising '
      + 'priority and re-analyzing is how you ship the library unambiguous.\n\n'
      + '**Simulate** is unit-level (no sockets). **Start** plus a real POST '
      + 'and a matched `GET /orders/42` write the journal; a typo path is the '
      + 'near-miss you would debug. '
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
      title: 'Import the spec as drafts, then enable the paths you will hit',
      description:
        'Paste the Orders **OpenAPI** spec and parse it. Every path lands as a '
        + '**draft** — disabled by default — so importing a spec can never '
        + 'silently start answering real traffic. Checking **Generalize** '
        + 'turns the spec\'s `/orders/{id}` into a real path parameter '
        + '(`/orders/:id`) instead of leaving `{id}` as literal text.\n\n'
        + 'Then enable `POST /orders` and `GET /orders/{id}` from the rule '
        + 'list **Draft** chip — the two paths live traffic will hit. Drafts '
        + 'do not match; that chip is what turns a template into a live rule.',
      highlight: API_MOCK.IMPORT_MENU,
      preAction: ensureAm24ForImport,
      action: runAm24FromSpec,
      actionTimeoutMs: AM24_SUITE_ACTION_TIMEOUT_MS,
      verify: API_MOCK.ROUTE_ENABLED,
    },
    {
      id: 'matching',
      title: 'A JSONPath predicate is what makes two POSTs different',
      description:
        'Two POSTs to the same `/orders` URL can carry completely different '
        + 'orders — the only way to tell them apart is the request *body*. '
        + `Point a **JSONPath** predicate at \`${AM24_JSONPATH}\`, require `
        + `\`${AM24_SKU}\`, and apply it: the rule now matches on that field `
        + 'instead of matching every POST to the path.\n\n'
        + 'Then prove it before any listener exists. **Simulate** a POST with '
        + `\`{"sku":"${AM24_SKU}",...}\` and the verdict comes back MATCHED — `
        + 'confidence the predicate is right, with nothing bound to a port '
        + 'yet.',
      highlight: API_MOCK.PATH_TOOLBOX,
      preAction: ensureAm24ForMatching,
      action: runAm24Matching,
      actionTimeoutMs: AM24_SUITE_ACTION_TIMEOUT_MS,
      verify: API_MOCK.PATH_TOOLBOX,
    },
    {
      id: 'response',
      title: 'Template the 201 so every example looks like a person',
      description:
        'A response that always returns the same hard-coded name is obviously '
        + 'fake. Template the **201** instead, so every response reads like '
        + 'a distinct, real order:\n\n'
        + '- `$.sku` — echoed straight from the caller’s request body\n'
        + '- `{{uuid}}` — a fresh id minted on every response\n'
        + '- `buyer` / `email` — filled in by **faker** helpers, never '
        + 'hard-coded\n\n'
        + 'The **preview** pane evaluates those helpers against a sample '
        + 'request right now, so you see an actual generated name and id — '
        + 'not the raw `{{mustache}}` syntax. That is the difference between '
        + 'a template you *hope* works and one you can *watch* working.',
      highlight: API_MOCK.BTAB_RESPONSE,
      preAction: ensureAm24ForResponse,
      action: runAm24Response,
      verify: API_MOCK.PREVIEW_BODY,
    },
    {
      id: 'variants',
      title: 'Add a 404 sibling, then a quick look at Sequence mode',
      description:
        'One rule with one response is just a stub. Add a **404** variant '
        + `next to the 201 and condition it on \`${AM24_JSONPATH} = ${AM24_SKU_MISSING}\`. `
        + 'The route-level body predicate from step 2 is also removed here: '
        + 'from this point the route accepts **any** `POST /orders` body, '
        + 'and variant conditions alone decide the response:\n\n'
        + '- 201 — default, catches every SKU that no sibling claims\n'
        + `- 404 — \`${AM24_JSONPATH} = ${AM24_SKU_MISSING}\`, fires only for the missing SKU\n\n`
        + 'Switching to **Sequence** mode is worth a quick look:\n\n'
        + '- Clears every condition — variants no longer depend on the '
        + 'request body\n'
        + '- Round-robins through the list in request order instead — useful '
        + 'for retry/backoff tests where you want the Nth call to fail '
        + 'predictably, not condition-based tests like this one\n\n'
        + 'Switching back to **Rules** restores the 404’s '
        + `\`${AM24_JSONPATH} = ${AM24_SKU_MISSING}\` condition — that `
        + 'predicate, not response order, is what the suite and Quick Test '
        + 'use to pick 404 only for the missing SKU.',
      highlight: API_MOCK.ADD_VARIANT,
      preAction: ensureAm24ForVariants,
      action: runAm24Variants,
      verify: API_MOCK.SELECTION_CONDITION,
    },
    {
      id: 'resilience',
      title: 'Latency on the 201, a real 404, and a 503 degraded branch',
      description:
        'Real services are slow, and occasionally a dependency degrades or '
        + 'hangs. A mock that answers instantly and perfectly hides the bugs '
        + 'that only surface under those conditions, so give `POST /orders` '
        + 'three distinct behaviors:\n\n'
        + '- **201** (known SKU) — a 200 ms **delay** at **probability 1**: '
        + 'always slightly slow, to catch clients that assume latency is zero\n'
        + '- **404** (missing SKU) — a real **404 Not Found**, left untouched: '
        + 'a clean contract error, *not* a transport failure\n'
        + '- **Degraded** (a flaky SKU) — a **503 Service Unavailable** with '
        + 'a **timeout** fault at **probability 0**\n\n'
        + '**Two cases depending on probability:**\n'
        + '- **Probability 0** (current) — the fault never fires; the client '
        + 'always receives the 503 body. Use this to test retry logic that '
        + 'inspects the status code.\n'
        + '- **Probability > 0** (e.g. 0.5) — the fault fires on that fraction '
        + 'of requests; the connection hangs and *no* HTTP response is sent. '
        + 'Use this to test client timeout handling.\n\n'
        + 'Keeping the timeout on its own branch is the whole point: a **404** '
        + 'and a **timeout** are different failures — a 404 *is* a response, a '
        + 'timeout is *no* response — so they must never share one variant.',
      highlight: API_MOCK.RESPONSE_TAB_TIMING,
      preAction: ensureAm24ForResilience,
      action: runAm24Resilience,
      verify: API_MOCK.FAULTS_PANEL,
    },
    {
      id: 'suite',
      title: 'Add a 201 assertion, then Run all samples green',
      description:
        `Simulate now has three saved samples — \`${AM24_SAMPLE_NAME}\`, `
        + `\`${AM24_SAMPLE_NAME_MISSING}\`, and \`${AM24_SAMPLE_NAME_FLAKY}\` — `
        + 'so you can re-run each SKU without typing the body again. The '
        + 'WIDGET row already proved MATCHED when the predicate was authored; '
        + 'this step turns the 201 / 404 / 503 contract into a gradable suite:\n\n'
        + '- **Assertions** tab — expected status **201** on WIDGET\n'
        + '- **Run all samples** — grades WIDGET (201), MISSING (404), and '
        + 'FLAKY (503) at once, the same way CI runs `redfireforge mock simulate`\n'
        + '- **Rendered** response — open **FLAKY** afterward and confirm '
        + 'the **503** body, not the unmatched library 404',
      highlight: API_MOCK.SIMULATE,
      preAction: ensureAm24ForSuite,
      action: runAm24Suite,
      actionTimeoutMs: AM24_SUITE_ACTION_TIMEOUT_MS,
      verify: API_MOCK.SIMULATE,
    },
    {
      id: 'conflicts',
      title: 'Author a duplicate GET /health, then Re-analyze until Left wins',
      description:
        'The Orders contract is proven. Now a different problem: add two '
        + '`GET /health` routes — this is exactly how duplicate routes creep '
        + 'into a real mock library: two feature branches both register the '
        + 'same health-check endpoint without noticing each other. The fix '
        + 'follows a repeatable loop:\n\n'
        + '- Author both overlapping rules at the same priority\n'
        + '- **Analyze** — the finding badge shows **Duplicate** ❌ (error). '
        + 'Equal priority triggers the reject-on-tie policy; the detail reads “returns **409**”\n'
        + '- Raise one rule’s priority so it wins — do not delete either rule\n'
        + '- **Re-analyze** — the badge changes from **Duplicate** to **Shadowed** ⚠ (warning). '
        + 'The detail now reads “Outcome: **Left wins**” and Apply is no longer blocked.\n\n'
        + 'Shipping a contract mock means shipping the *library* unambiguous: '
        + 'the client’s request can only ever resolve one way.',
      highlight: API_MOCK.ANALYZE,
      preAction: ensureAm24ForConflicts,
      action: runAm24Conflicts,
      verify: API_MOCK.ROUTE_EXPLORER,
    },
    {
      id: 'live',
      title: 'Start, prove a match, then read a near-miss in the journal',
      description:
        'This step moves from a unit check to real network traffic. '
        + '**Start** binds the listener, then the app fires three real '
        + 'requests at it:\n\n'
        + '- `POST /orders` with the same WIDGET body as before — the first '
        + 'journal row is proof the rule answered an actual socket, not '
        + 'Simulate running in memory\n'
        + '- `GET /orders/42` — `{id}` fills with `42`, so this row **matches** '
        + '`GET /orders/{id}`\n'
        + '- `GET /ordrs/42` — the path is misspelled on purpose, so nothing '
        + 'should match\n\n'
        + 'Open that newest journal row and read **Near-misses**: it shows '
        + 'the closest route the library almost matched. The suite can stay '
        + 'all-green while the live journal records this miss — those are '
        + 'two different kinds of proof.',
      highlight: API_MOCK.LIVE_TRANSACTIONS,
      preAction: ensureAm24ForLive,
      action: runAm24Live,
      verify: API_MOCK.JOURNAL_FIRST_ROW,
    },
    {
      id: 'export',
      title: 'Export as Workspace JSON, then as WireMock',
      description:
        'A contract mock is only useful if another team can run it without '
        + 'this Studio. Two exports, two audiences:\n\n'
        + '- **Workspace JSON** — the CI artifact; import it into any Studio '
        + 'instance and the mock is ready to go\n'
        + '- **WireMock** — an interoperable format any WireMock-compatible '
        + 'runner can load outside Studio entirely\n\n'
        + 'The loss note on the WireMock export names exactly what cannot '
        + 'round-trip into that format, so a downstream team gets no '
        + 'surprises when they import the file.',
      highlight: API_MOCK.EXPORT,
      preAction: ensureAm24ForExport,
      action: runAm24Export,
      verify: API_MOCK.EXPORT_CONFIRM,
    },
    {
      id: 'ship',
      title: 'Prove the listener in Workflow with a Quick Test',
      description:
        'Simulate proved the rule in memory. This step proves the exported '
        + 'contract still works over a real socket, outside Studio. In '
        + '**Workflow**, build a small graph:\n\n'
        + '- **Start** — an *isolated* copy of the mock, its own listener, '
        + 'not the one Studio was running\n'
        + '- **HTTP** — `POST {{mockBaseUrl}}/orders`\n'
        + '- **Assert** — a 201 in that instance’s journal\n'
        + '- **Stop** — the isolated listener\n\n'
        + '**Quick Test** runs that graph end to end. The passing Assert '
        + 'node is the strongest proof the contract can give: it answered a '
        + 'real HTTP call on a fresh listener, and the journal recorded it.',
      highlight: API_MOCK.CANVAS_START,
      preAction: ensureAm24ForShip,
      action: runAm24Ship,
      actionTimeoutMs: AM24_SHIP_ACTION_TIMEOUT_MS,
      verify: am24PassSelector(API_MOCK.CANVAS_ASSERT),
    },
  ],
  prepareBeforeNavigate: prepareAm24Workspace,
  cleanup: cleanupAm24,
};
