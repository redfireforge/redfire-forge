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
    'Open the journal and send two matching storefront requests so the table '
    + 'has real rows. Filter it, then fetch a typo — unmatched — and read the '
    + 'candidates and near-misses. Switch unmatched fallback to closest-match '
    + 'so the 404 body explains the miss. Promote that row into a seeded rule '
    + 'and a saved example, hand it to Requests, then copy / export / clear. '
    + 'Simulate the example and hold the passing result.',
  estimatedMinutes: 8,
  initialTab: 'api-mock-studio',
  contentVersion: 1,
  concept: {
    title: 'A miss is only useful if you can see why.',
    body:
      'A running mock without a journal is a black box: the client got a 404, '
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
      { term: 'Closest-match debug', definition: 'Unmatched traffic returns a JSON body naming the nearest rule instead of a bare 404.' },
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
        'Click **Live transactions** to open the Runtime journal. The store '
        + 'library is already running — fetch `GET /products` and '
        + '`GET /products/42` so two **matched** rows land.\n\n'
        + 'Hold the table, then the outcome chip. Five chips exist '
        + '(matched / unmatched / ambiguous / fault / proxied); today you '
        + 'are looking at **matched**. This table is the audit log for '
        + 'everything the listener saw.',
      highlight: API_MOCK.LIVE_TRANSACTIONS,
      action: runAm18JournalTour,
      verify: API_MOCK.JOURNAL_FIRST_ROW,
    },
    {
      id: 'filter',
      title: 'Find the call you care about, and get an honest empty state',
      description:
        'The filter box searches path, status, and rule name. Type `products` '
        + 'and hold the narrowed table — both catalog rows stay, cart noise '
        + 'would drop.\n\n'
        + 'Then type nonsense. **No transactions match this filter** is '
        + 'honest emptiness, not a hang. Clear the box and the table comes '
        + 'back. You will use this when a long run has hundreds of rows.',
      highlight: API_MOCK.JOURNAL_FILTER,
      preAction: ensureAm18ForFilter,
      action: runAm18Filter,
      verify: API_MOCK.JOURNAL_FIRST_ROW,
    },
    {
      id: 'the-miss',
      title: 'Why didn\'t my request match?',
      description:
        `Watch the listen address, then fetch \`${AM18_MISS_PATH}\` — one `
        + 'character off `/products/42`. The new row is **unmatched**.\n\n'
        + 'Open it. **Candidates** are every rule the engine scored. '
        + '**Near misses** name the catalog template that almost won, and '
        + 'the predicate that failed (path). That list is why this journal '
        + 'exists: a 404 without a near-miss is a guess.',
      highlight: API_MOCK.ADDRESS,
      preAction: ensureAm18ForMiss,
      action: async (ctx) => { await runAm18TheMiss(ctx); },
      verify: API_MOCK.TX_NEAR_MISSES,
    },
    {
      id: 'closest-match',
      title: 'Put that explanation in the 404 body itself',
      description:
        'Open Runtime **Settings**. Set **Unmatched fallback** to **Closest '
        + 'match debug**, then **Save settings**. If the listener is dirty, '
        + '**Apply** so the running snapshot picks it up.\n\n'
        + `Fetch \`${AM18_MISS_PATH}\` again. The response body is no longer `
        + 'a bare 404 — it names the nearest rule. A client log or a bug '
        + 'report can now see *why* without opening Studio.',
      highlight: API_MOCK.RUNTIME_SETTINGS_FALLBACK,
      preAction: ensureAm18ForClosestMatch,
      action: runAm18ClosestMatch,
      verify: API_MOCK.TX_RESPONSE,
    },
    {
      id: 'create-route',
      title: 'Promote an unmatched request into a real rule',
      description:
        'Click **Create route**. The journal writes a **disabled** draft from '
        + 'this transaction — method, path, headers — so the mock never starts '
        + 'answering a path you have not reviewed.\n\n'
        + 'Click **Open in Studio**. The editor is already seeded with '
        + `\`${AM18_MISS_PATH}\`. That is the promotion: a miss becomes a `
        + 'rule you can enable after you spell the path correctly.',
      highlight: API_MOCK.TX_CREATE_ROUTE,
      preAction: ensureAm18ForCreateRoute,
      action: runAm18CreateRoute,
      verify: API_MOCK.ROUTE_EDITOR,
    },
    {
      id: 'save-example',
      title: 'Freeze a transaction as a regression case',
      description:
        'Back on the unmatched row, click **Save as example**. The captured '
        + 'request becomes a simulation sample — expected outcome included — '
        + 'so you can re-run the miss after you change the library.\n\n'
        + 'Then **Open in Requests**: the same call lands in the HTTP client '
        + 'as a real request you can send again. Come back to Studio → '
        + '**Examples** and hold the new row.',
      highlight: API_MOCK.TX_SAVE_EXAMPLE,
      preAction: ensureAm18ForSaveExample,
      action: runAm18SaveExample,
      verify: API_MOCK.EXAMPLES_GRID,
    },
    {
      id: 'share-and-reset',
      title: 'Copy for a bug report, export for the record, clear between runs',
      description:
        'Click **Copy** on the selected row — the button flashes **Copied**. '
        + 'Paste that into a ticket and a reviewer sees method, path, headers, '
        + 'and the outcome without a screenshot.\n\n'
        + '**Export** downloads the (filtered) journal as JSON. **Clear** '
        + 'empties the table so the next run starts honest. The listener stays '
        + 'up; only the log is gone.',
      highlight: API_MOCK.TX_COPY,
      preAction: ensureAm18ForShare,
      action: runAm18ShareAndReset,
      verify: API_MOCK.RUNTIME_GUIDE,
    },
    {
      id: 'prove-example',
      title: 'The saved example runs green',
      description:
        'Open the seeded rule\'s **Examples** tab. The saved row is the typo '
        + 'you captured — expected **unmatched**, because the draft is still '
        + 'disabled and `/products/:id` does not spell `produts`.\n\n'
        + 'Click **Simulate**. Hold the passing result. A green unmatched '
        + 'example is a regression: the miss stays a miss until you enable '
        + 'and correct the new rule.',
      highlight: API_MOCK.EXAMPLE_SIMULATE,
      preAction: ensureAm18ForProve,
      action: runAm18ProveExample,
      verify: API_MOCK.SIMULATE_OUTCOME,
    },
  ],
};
