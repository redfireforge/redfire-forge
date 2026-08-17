/**
 * AM-18 `am-18-journal` — Journal Forensics: Near-Misses, Candidates & Promotion.
 *
 * Scenario: a storefront mock is already answering `/products`, but a typo
 * (`/produts/42`) misses. The journal explains why, closest-match puts that
 * explanation on the wire, and the unmatched row promotes into a draft rule
 * and a regression example. Curriculum:
 * `docs/plan/future/apimock/apimock-demo-curriculum-v2.md` §5 Track D.
 */
import { API_MOCK } from '@shared/selectors';
import type { DemoLesson } from '../../types';
import {
  AM18_MATCH_ITEM,
  AM18_MATCH_LIST,
  AM18_MISS_PATH,
  cleanupAm18,
  ensureAm18ForClosestMatch,
  ensureAm18ForCreateRoute,
  ensureAm18ForFilter,
  ensureAm18ForMiss,
  ensureAm18ForProve,
  ensureAm18ForSaveExample,
  ensureAm18ForShare,
  prepareAm18Workspace,
  runAm18ClosestMatch,
  runAm18CreateRoute,
  runAm18Filter,
  runAm18JournalTour,
  runAm18ProveExample,
  runAm18SaveExample,
  runAm18ShareAndReset,
  runAm18TheMiss,
} from './api-mock-am18-helpers';

const DIAGRAM = `
<svg viewBox="0 0 700 430" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Journal forensics: miss, near-misses, promote, simulate">
  <rect x="0" y="0" width="700" height="430" fill="#0f172a" />

  <text x="26" y="34" fill="#f1f5f9" font-family="system-ui" font-size="16" font-weight="600">Every request, every decision, one table</text>
  <text x="26" y="54" fill="#64748b" font-family="system-ui" font-size="10">Matched rows · unmatched miss · near-misses · promote</text>

  <rect x="26" y="72" width="200" height="150" rx="8" fill="#1e293b" stroke="#22c55e" />
  <text x="42" y="96" fill="#22c55e" font-family="system-ui" font-size="12" font-weight="600">Journal</text>
  <text x="42" y="118" fill="#f1f5f9" font-family="ui-monospace" font-size="11">GET ${AM18_MATCH_LIST}</text>
  <text x="42" y="138" fill="#f1f5f9" font-family="ui-monospace" font-size="11">GET ${AM18_MATCH_ITEM}</text>
  <text x="42" y="158" fill="#a8b8cc" font-family="system-ui" font-size="11">Filter · copy · export · clear</text>
  <text x="42" y="202" fill="#64748b" font-family="system-ui" font-size="10">Outcome chips tell the story</text>

  <rect x="248" y="72" width="200" height="150" rx="8" fill="#1e293b" stroke="#f59e0b" />
  <text x="264" y="96" fill="#f59e0b" font-family="system-ui" font-size="12" font-weight="600">The miss</text>
  <text x="264" y="118" fill="#f1f5f9" font-family="ui-monospace" font-size="11">GET ${AM18_MISS_PATH}</text>
  <text x="264" y="138" fill="#a8b8cc" font-family="system-ui" font-size="11">Candidates evaluated</text>
  <text x="264" y="158" fill="#a8b8cc" font-family="system-ui" font-size="11">Near-miss: /products/:id</text>
  <text x="264" y="202" fill="#22c55e" font-family="system-ui" font-size="10">Closest-match debug body</text>

  <rect x="470" y="72" width="204" height="150" rx="8" fill="#1e293b" stroke="#a78bfa" />
  <text x="486" y="96" fill="#a78bfa" font-family="system-ui" font-size="12" font-weight="600">Promote</text>
  <text x="486" y="118" fill="#f1f5f9" font-family="system-ui" font-size="11">Create route → seeded path</text>
  <text x="486" y="138" fill="#a8b8cc" font-family="system-ui" font-size="11">Save as example</text>
  <text x="486" y="158" fill="#a8b8cc" font-family="system-ui" font-size="11">Open in Requests</text>
  <text x="486" y="202" fill="#22c55e" font-family="system-ui" font-size="10">Simulate runs green</text>

  <rect x="26" y="240" width="648" height="70" rx="8" fill="#1e293b" stroke="#3b4a60" />
  <text x="42" y="268" fill="#f1f5f9" font-family="system-ui" font-size="12" font-weight="600">A 404 without a near-miss is a guess. The journal names what almost matched.</text>
  <text x="42" y="290" fill="#a8b8cc" font-family="system-ui" font-size="11">Closest-match puts that explanation in the response body so a client, a log, or a bug report can see it without opening Studio.</text>

  <rect x="26" y="328" width="648" height="78" rx="8" fill="#1e293b" stroke="#22c55e" />
  <text x="42" y="356" fill="#22c55e" font-family="system-ui" font-size="12" font-weight="600">Tour → filter → miss → closest-match → create route → example → copy/export/clear → simulate</text>
  <text x="42" y="378" fill="#a8b8cc" font-family="system-ui" font-size="11">Promotion is how a captured miss becomes a rule you can enable and a sample you can re-run.</text>
</svg>
`;

export const apiMockAm18Lesson: DemoLesson = {
  id: 'am-18-journal',
  domainId: 'protocols',
  category: 'api-mock',
  name: 'Journal Forensics: Near-Misses, Candidates & Promotion',
  description:
    'A running mock hides its reasoning — a client gets a **404 Not Found** and you are left '
    + 'guessing which rule should have fired. This lesson makes every decision '
    + 'visible: read why a typo request missed, push that explanation into the '
    + 'response body so nobody has to open Studio, then turn the captured miss '
    + 'into a real draft rule and a regression example so the same bug can '
    + 'never sneak back.',
  estimatedMinutes: 8,
  initialTab: 'api-mock-studio',
  contentVersion: 8,
  concept: {
    title: 'A miss is only useful if you can see why.',
    body:
      'A running mock without a journal is a black box: the client got a **404 Not Found**, '
      + 'and you guess which rule should have fired. The **Transactions** dock '
      + 'is the audit log — every request, matched or not, with an outcome chip '
      + '(matched, unmatched, ambiguous, fault, proxied).\n\n'
      + 'When a path is one character off (`/produts/42` instead of '
      + '`/products/:id`), **candidates** list everything that was evaluated and '
      + '**near-misses** name the rule that almost won. **Closest-match debug** '
      + 'puts that explanation in the 404 body so a log or a bug report can see '
      + 'it without opening Studio.\n\n'
      + 'Promotion closes the loop. **Create route** seeds a draft from the '
      + 'captured request. **Save as example** freezes it as a regression case. '
      + '**Open in Requests** hands the same call to the HTTP client. Copy, '
      + 'export, and clear keep the journal usable between runs.',
    keyTerms: [
      { term: 'Journal', definition: 'The transaction table: every request the listener saw, with method, path, status, duration, and matched rule.' },
      { term: 'Outcome chip', definition: 'matched, unmatched, ambiguous, fault, or proxied — the decision the mock made, not just the HTTP status.' },
      { term: 'Candidates', definition: 'Every rule evaluated for this request, with priority and match/miss, so you can see the full field.' },
      { term: 'Near-misses', definition: 'Rules that almost matched, with the predicate that failed — the difference between a typo and a missing rule.' },
      { term: 'Closest-match debug', definition: 'Unmatched traffic returns a JSON body naming the nearest rule instead of a bare 404 (Not Found).' },
      { term: 'Create route', definition: 'Promote an unmatched (or any) transaction into a disabled draft with the captured path and body.' },
      { term: 'Save as example', definition: 'Freeze the captured request as a simulation sample you can re-run from the Examples tab.' },
    ],
    diagram: DIAGRAM,
  },
  prepareBeforeNavigate: prepareAm18Workspace,
  cleanup: cleanupAm18,
  steps: [
    {
      id: 'journal-tour',
      title: 'Every request and every decision in one table',
      description:
        'A running mock will happily answer — or refuse — hundreds of calls '
        + 'without ever telling you which rule fired. That black box is what '
        + 'the **Runtime journal** exists to open up.\n\n'
        + 'As two ordinary storefront calls come in, watch them land as '
        + '**matched** rows. What matters here is the outcome chip on each '
        + 'row: it reports the *decision* the mock made — matched, unmatched, '
        + 'ambiguous, fault, or proxied — not just an HTTP number. This table '
        + 'is the single source of truth the rest of the lesson builds on.',
      highlight: API_MOCK.LIVE_TRANSACTIONS,
      action: runAm18JournalTour,
      verify: API_MOCK.JOURNAL_FIRST_ROW,
    },
    {
      id: 'filter',
      title: 'Find the call you care about, and get an honest empty state',
      description:
        'After a real load run this table holds hundreds of rows and the one '
        + 'you actually care about is buried. Filtering — by path, status, or '
        + 'rule name — is how you pull it back out.\n\n'
        + 'The quiet point of this step is trust. When the filter matches '
        + 'nothing, the journal says so plainly instead of hanging or leaving '
        + 'a stale list on screen. That honest empty state is exactly what '
        + 'lets you believe the table when it is full.',
      highlight: API_MOCK.JOURNAL_FILTER,
      preAction: ensureAm18ForFilter,
      action: runAm18Filter,
      verify: API_MOCK.JOURNAL_FIRST_ROW,
    },
    {
      id: 'the-miss',
      title: 'Why didn\'t my request match?',
      description:
        'This is the question the whole journal was built to answer. A client '
        + `fires a request that is one character off — \`${AM18_MISS_PATH}\` `
        + 'instead of `/products/42` — gets a **404 Not Found**, and normally your only '
        + 'move is to squint at the library and guess.\n\n'
        + 'Instead, the unmatched row explains itself. It names the '
        + '**candidates** the engine scored, then the **Near misses** panel '
        + 'lists the rules that almost won — watch each one light up in turn, '
        + 'down to the predicate that failed. Knowing whether no rule exists or '
        + 'a rule was a typo away is the difference between an hour of debugging '
        + 'and a five-second fix.',
      highlight: API_MOCK.ADDRESS,
      preAction: ensureAm18ForMiss,
      action: async (ctx) => { await runAm18TheMiss(ctx); },
      verify: API_MOCK.TX_NEAR_MISSES,
    },
    {
      id: 'closest-match',
      title: 'Put that explanation in the 404 body itself',
      description:
        'The near-miss diagnosis is powerful, but so far it only helps '
        + 'whoever is staring at Studio. The teammate reading a CI log, or the '
        + 'client developer who just got a **404 Not Found**, still sees nothing useful.\n\n'
        + 'This step moves the explanation onto the wire. With **closest-match** '
        + 'fallback turned on, an unmatched request stops returning a bare 404 '
        + 'and starts returning a body that names the nearest rule. Now the '
        + 'answer travels with the response — a log line or a bug report '
        + 'carries its own diagnosis, and nobody has to open the mock to '
        + 'understand the failure.',
      highlight: API_MOCK.RUNTIME_SETTINGS_FALLBACK,
      preAction: ensureAm18ForClosestMatch,
      action: runAm18ClosestMatch,
      verify: API_MOCK.TX_RESPONSE,
    },
    {
      id: 'create-route',
      title: 'Promote an unmatched request into a real rule',
      description:
        'A captured miss is evidence; the goal is to turn it into a fix. '
        + '**Create route** promotes the unmatched request into a rule that is '
        + 'already seeded with its real method, path, and headers — no retyping '
        + 'what the client actually sent.\n\n'
        + 'The safety detail that makes this trustworthy: the new rule lands '
        + '**disabled**. The mock will not suddenly start answering a path you '
        + 'have not reviewed. You get a draft to inspect and correct on your '
        + 'own terms. Watch **Open in Studio** jump straight to the route '
        + 'editor, with the captured path filled in and the **Enabled** toggle '
        + 'off — proof the draft is parked until you say otherwise. That is the '
        + 'promotion loop — a fleeting runtime miss becomes a first-class rule '
        + 'in the library.',
      highlight: API_MOCK.TX_CREATE_ROUTE,
      preAction: ensureAm18ForCreateRoute,
      action: runAm18CreateRoute,
      verify: API_MOCK.ROUTE_EDITOR,
    },
    {
      id: 'save-example',
      title: 'Freeze a transaction as a regression case',
      description:
        'Fixing a bug once is not enough if nothing stops it from returning. '
        + '**Save as example** freezes this exact request — expected outcome '
        + 'and all — as a sample you can replay after any future change to the '
        + 'library.\n\n'
        + 'The same captured call can also be handed straight to the '
        + '**Requests** client, so whoever reproduces the bug sends the '
        + 'identical request you saw, not an approximation of it. One miss '
        + 'becomes both a regression guard and a shareable repro.',
      highlight: API_MOCK.TX_SAVE_EXAMPLE,
      preAction: ensureAm18ForSaveExample,
      action: runAm18SaveExample,
      verify: API_MOCK.EXAMPLES_GRID,
    },
    {
      id: 'share-and-reset',
      title: 'Copy for a bug report, export for the record, clear between runs',
      description:
        'A journal only earns its keep if the evidence can leave the tool. '
        + '**Copy** turns the selected row into text you can paste straight '
        + 'into a ticket — method, path, headers, outcome — so a reviewer '
        + 'grasps the failure without a screenshot.\n\n'
        + '**Export** saves the whole (filtered) log as JSON for the record, '
        + 'and **Clear** wipes the table so the next run starts from an honest, '
        + 'empty slate. Note what does *not* happen: the listener keeps '
        + 'running the entire time. You are clearing the log, never the mock.',
      highlight: API_MOCK.TX_COPY,
      preAction: ensureAm18ForShare,
      action: runAm18ShareAndReset,
      verify: API_MOCK.RUNTIME_GUIDE,
    },
    {
      id: 'prove-example',
      title: 'The saved example runs green',
      description:
        'A regression case you never run is just a hope. This final step '
        + 'proves the guard you saved actually fires.\n\n'
        + 'When the example is simulated it passes as **unmatched** — which is '
        + 'exactly right, because the draft rule is still disabled and '
        + '`/products/:id` does not spell `produts`. A green result here means '
        + 'the guard is live: this miss stays caught until someone '
        + 'deliberately enables and corrects the new rule. That is the loop '
        + 'closed — from an invisible **404 Not Found** to a rule and a test that watch '
        + 'your back.',
      highlight: API_MOCK.EXAMPLE_SIMULATE,
      preAction: ensureAm18ForProve,
      action: runAm18ProveExample,
      verify: API_MOCK.SIMULATE_OUTCOME,
    },
  ],
};
