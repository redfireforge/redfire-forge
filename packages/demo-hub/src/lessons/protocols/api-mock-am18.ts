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
  <text x="42" y="284" fill="#a8b8cc" font-family="system-ui" font-size="11">Closest-match puts that explanation in the response body so a client, a log,</text>
  <text x="42" y="298" fill="#a8b8cc" font-family="system-ui" font-size="11">or a bug report can see it without opening Studio.</text>

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
    'Read the Runtime journal to see why a typo request missed, turn on '
    + 'closest-match so the **404 Not Found** body names the nearest rule, then '
    + 'promote the captured miss into a draft rule and a regression example — '
    + 'and prove the guard runs green.',
  estimatedMinutes: 8,
  initialTab: 'api-mock-studio',
  contentVersion: 13,
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
        '**What you\'ll do:** open the **Transactions** dock and let two '
        + 'ordinary storefront calls (`GET /products`, `GET /products/42`) hit '
        + 'the running mock.\n\n'
        + '**What you\'ll see:** both land as rows carrying a green **matched** '
        + 'outcome **chip**, alongside method, path, status, duration, and the '
        + 'rule that fired.\n\n'
        + '**Why it matters:** the chip records the *decision* the mock made — '
        + '**matched, unmatched, ambiguous, fault, or proxied** — not just an '
        + 'HTTP number. This audit log is the source of truth every later step '
        + 'reads from.',
      highlight: API_MOCK.LIVE_TRANSACTIONS,
      action: runAm18JournalTour,
      verify: API_MOCK.JOURNAL_FIRST_ROW,
    },
    {
      id: 'filter',
      title: 'Find the call you care about, and get an honest empty state',
      description:
        '**What you\'ll do:** type into the journal **Filter** to narrow the '
        + 'table by path, status, or rule name — then type something that '
        + 'matches nothing.\n\n'
        + '**What you\'ll see:** the list collapses to just the matching rows; '
        + 'a nonsense query drops it to a plain **no matching transactions** '
        + 'empty state, not a stale or frozen list.\n\n'
        + '**Why it matters:** after a real load run this table holds hundreds '
        + 'of rows. A filter that fails *honestly* is what lets you trust the '
        + 'table when it is full.',
      highlight: API_MOCK.JOURNAL_FILTER,
      preAction: ensureAm18ForFilter,
      action: runAm18Filter,
      verify: API_MOCK.JOURNAL_FIRST_ROW,
    },
    {
      id: 'the-miss',
      title: 'Why didn\'t my request match?',
      description:
        `**What you'll do:** fire \`${AM18_MISS_PATH}\` — a typo of `
        + '`/products/42` — at the running store mock.\n\n'
        + '**What you\'ll see:** it lands as an **unmatched 404 Not Found** '
        + 'row. Open it: **Candidates** lists every rule the engine scored, and '
        + '**Near misses** ranks what came closest and names the failed '
        + 'predicate — `produts` ≠ `products`.\n\n'
        + '**Why it matters:** a bare 404 tells you nothing. Candidates plus '
        + 'near-misses answer *why didn\'t it match?* — a missing rule versus a '
        + 'one-character typo — turning an hour of guessing into a five-second '
        + 'fix.',
      highlight: API_MOCK.ADDRESS,
      preAction: ensureAm18ForMiss,
      action: async (ctx) => { await runAm18TheMiss(ctx); },
      verify: API_MOCK.TX_NEAR_MISSES,
    },
    {
      id: 'closest-match',
      title: 'Put that explanation in the 404 body itself',
      description:
        '**What you\'ll do:** in **Runtime Settings**, switch the unmatched '
        + '**fallback** to **closest-match**, Save, and fire the same typo '
        + 'request again.\n\n'
        + '**What you\'ll see:** the **404 Not Found** stops being empty — its '
        + '**response body** now names the nearest rule (`GET /products/:id`) '
        + 'and why it missed, right in the reply.\n\n'
        + '**Why it matters:** the near-miss diagnosis was only visible to '
        + 'whoever had Studio open. On the wire, a CI log or a bug report '
        + 'carries the explanation with it — nobody has to reopen the mock.',
      highlight: API_MOCK.RUNTIME_SETTINGS_FALLBACK,
      skipHighlightScroll: true,
      preAction: ensureAm18ForClosestMatch,
      action: runAm18ClosestMatch,
      verify: API_MOCK.TX_RESPONSE,
    },
    {
      id: 'create-route',
      title: 'Promote an unmatched request into a real rule',
      description:
        '**What you\'ll do:** on the unmatched row, click **Create route** to '
        + 'promote the captured request into a rule.\n\n'
        + '**What you\'ll see:** **Open in Studio** jumps to the route editor '
        + `with the real method, path (\`${AM18_MISS_PATH}\`), and headers `
        + 'already filled in — and the **Enabled** toggle **off**.\n\n'
        + '**Why it matters:** you never retype what the client sent, and the '
        + 'draft lands **disabled** so the mock can\'t start answering a path '
        + 'you haven\'t reviewed. A fleeting runtime miss becomes a first-class '
        + 'draft in the library.',
      highlight: API_MOCK.TX_CREATE_ROUTE,
      preAction: ensureAm18ForCreateRoute,
      action: runAm18CreateRoute,
      verify: API_MOCK.ROUTE_EDITOR,
    },
    {
      id: 'save-example',
      title: 'Freeze a transaction as a regression case',
      description:
        '**What you\'ll do:** back on the transaction, click **Save as '
        + 'example**, then **Open in Requests**.\n\n'
        + '**What you\'ll see:** the captured call appears as a row in the '
        + '**Examples** grid (expected outcome and all), and the same request '
        + 'opens in the **Requests** client, ready to send.\n\n'
        + '**Why it matters:** the example is a replayable regression case; the '
        + 'Requests handoff is a shareable repro. One captured miss becomes '
        + 'both a guard you can re-run and an exact reproduction a teammate can '
        + 'send.',
      highlight: API_MOCK.TX_SAVE_EXAMPLE,
      preAction: ensureAm18ForSaveExample,
      action: runAm18SaveExample,
      verify: API_MOCK.EXAMPLES_GRID,
    },
    {
      id: 'share-and-reset',
      title: 'Copy for a bug report, clear the journal, export the record',
      description:
        '**What you\'ll do:** **Copy** the selected row, **Clear** the '
        + 'journal, then **Export** the record.\n\n'
        + '**What you\'ll see:** Copy yields paste-ready text (method, path, '
        + 'headers, outcome); Clear empties the table to a fresh slate while the '
        + '**Running** badge stays lit; Export then writes the captured log as JSON.\n\n'
        + '**Why it matters:** evidence has to be able to leave the tool — into '
        + 'a ticket, into the record — and each run should start clean. You are '
        + 'clearing the *log*, never the mock.',
      highlight: API_MOCK.TX_COPY,
      preAction: ensureAm18ForShare,
      action: runAm18ShareAndReset,
      verify: API_MOCK.RUNTIME_GUIDE,
    },
    {
      id: 'prove-example',
      title: 'The saved example runs green',
      description:
        '**What you\'ll do:** open the **Examples** tab and **Simulate** the '
        + 'example you saved earlier.\n\n'
        + '**What you\'ll see:** it passes as **unmatched** — a green result — '
        + 'because the promoted draft is still **disabled** and `/products/:id` '
        + 'still doesn\'t spell `produts`.\n\n'
        + '**Why it matters:** a regression case you never run is just a hope. '
        + 'This proves the guard fires: the miss stays caught until someone '
        + 'deliberately enables and fixes the new rule — the loop from an '
        + 'invisible 404 to a rule and a test that watch your back.',
      highlight: API_MOCK.EXAMPLE_SIMULATE,
      preAction: ensureAm18ForProve,
      action: runAm18ProveExample,
      verify: API_MOCK.SIMULATE_OUTCOME,
    },
  ],
};
