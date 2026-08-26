/**
 * AM-25 `am-25-har-roundtrip` — HAR Round-Trip Comparison.
 *
 * Scenario: import a HAR, enable the routes, replay the same requests against
 * the mock server, then inspect the per-transaction Compare HAR modal and
 * export the bulk comparison report.
 * Curriculum: HAR-training-demo-plan.md §B-3 Demo.
 */
import { API_MOCK } from '@shared/selectors';
import type { DemoLesson } from '../../types';
import {
  AM25_PATH_PROFILE,
  AM25_PATH_SESSION,
  cleanupAm25,
  ensureAm25ForCompare,
  ensureAm25ForEnable,
  ensureAm25ForImport,
  ensureAm25ForModal,
  ensureAm25ForReplay,
  ensureAm25ForReport,
  prepareAm25Workspace,
  runAm25Compare,
  runAm25Enable,
  runAm25Import,
  runAm25Modal,
  runAm25Replay,
  runAm25Report,
} from './api-mock-am25-helpers';

const DIAGRAM = `
<svg viewBox="0 0 700 340" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="HAR import becomes mock rules; real requests replay against the mock; Journal rows open a side-by-side comparison">
  <rect x="0" y="0" width="700" height="340" fill="#0f172a" />

  <text x="26" y="34" fill="#f1f5f9" font-family="system-ui" font-size="16" font-weight="600">Import HAR → mock it → replay → compare.</text>
  <text x="26" y="54" fill="#64748b" font-family="system-ui" font-size="10">HAR import · enable routes · replay · Journal · Compare HAR modal · bulk report</text>

  <rect x="26" y="72" width="140" height="56" rx="8" fill="#1e293b" stroke="#38bdf8" />
  <text x="46" y="100" fill="#38bdf8" font-family="system-ui" font-size="11" font-weight="600">Import HAR</text>
  <text x="46" y="116" fill="#64748b" font-family="system-ui" font-size="10">preview · confirm</text>

  <rect x="186" y="72" width="140" height="56" rx="8" fill="#1e293b" stroke="#a78bfa" />
  <text x="206" y="100" fill="#a78bfa" font-family="system-ui" font-size="11" font-weight="600">Enable routes</text>
  <text x="206" y="116" fill="#64748b" font-family="system-ui" font-size="10">draft → active</text>

  <rect x="346" y="72" width="140" height="56" rx="8" fill="#1e293b" stroke="#f59e0b" />
  <text x="366" y="100" fill="#f59e0b" font-family="system-ui" font-size="11" font-weight="600">Replay requests</text>
  <text x="366" y="116" fill="#64748b" font-family="system-ui" font-size="10">${AM25_PATH_SESSION} · ${AM25_PATH_PROFILE}</text>

  <rect x="506" y="72" width="168" height="56" rx="8" fill="#1e293b" stroke="#22c55e" />
  <text x="526" y="100" fill="#22c55e" font-family="system-ui" font-size="11" font-weight="600">Journal → matched</text>
  <text x="526" y="116" fill="#64748b" font-family="system-ui" font-size="10">outcome: matched</text>

  <path d="M166 100 H186" stroke="#64748b" stroke-width="2" marker-end="url(#am25arrow)" />
  <path d="M326 100 H346" stroke="#64748b" stroke-width="2" marker-end="url(#am25arrow)" />
  <path d="M486 100 H506" stroke="#64748b" stroke-width="2" marker-end="url(#am25arrow)" />

  <rect x="100" y="172" width="220" height="78" rx="8" fill="#1e293b" stroke="#f97316" />
  <text x="120" y="196" fill="#f97316" font-family="system-ui" font-size="11" font-weight="600">Compare HAR modal</text>
  <text x="120" y="212" fill="#a8b8cc" font-family="system-ui" font-size="10">status · body diff</text>
  <text x="120" y="226" fill="#a8b8cc" font-family="system-ui" font-size="10">✓ match / ✗ mismatch</text>
  <text x="120" y="240" fill="#a8b8cc" font-family="system-ui" font-size="10">~ template</text>

  <rect x="366" y="172" width="228" height="78" rx="8" fill="#1e293b" stroke="#38bdf8" />
  <text x="386" y="196" fill="#38bdf8" font-family="system-ui" font-size="11" font-weight="600">Bulk HAR report</text>
  <text x="386" y="212" fill="#64748b" font-family="system-ui" font-size="10">matched · statusMatches</text>
  <text x="386" y="226" fill="#64748b" font-family="system-ui" font-size="10">bodyMatches · JSON export</text>

  <path d="M590 128 V152 H210 V172" stroke="#64748b" stroke-width="2" fill="none" marker-end="url(#am25arrow)" />
  <path d="M590 128 V152 H480 V172" stroke="#64748b" stroke-width="2" fill="none" marker-end="url(#am25arrow)" />

  <rect x="60" y="266" width="580" height="50" rx="8" fill="#1e293b" stroke="#3b4a60" />
  <text x="80" y="292" fill="#f1f5f9" font-family="system-ui" font-size="11" font-weight="600">The HAR report button only appears when HAR-sourced routes exist.</text>
  <text x="80" y="308" fill="#64748b" font-family="system-ui" font-size="10">Each matched transaction is tallied: statusMatch · bodyMatch · diffSummary.</text>

  <defs>
    <marker id="am25arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L6,3 L0,6 Z" fill="#64748b" />
    </marker>
  </defs>
</svg>
`.trim();

export const apiMockAm25Lesson: DemoLesson = {
  id: 'am-25-har-roundtrip',
  domainId: 'api-mock',
  category: 'api-mock',
  name: 'HAR Round-Trip: Compare Mock vs Original',
  description: 'Import a HAR, mock the routes, replay the same requests, and compare responses side-by-side.',
  estimatedMinutes: 5,
  initialTab: 'api-mock-studio',
  allowedTabs: ['api-mock-studio'],
  concept: {
    title: 'HAR Round-Trip Comparison',
    body: `A **HAR round-trip** closes the loop between recorded traffic and a mock server. You import a HAR file, enable the resulting routes, send the same requests through your mock, and then compare what the mock returned against what the real server originally returned — field by field.

The mock stores the original HAR response body and status alongside each imported rule (\`harSourceEntry\`). When a Journal transaction matches a HAR-sourced route, the **Compare HAR** button opens a side-by-side diff: status match badge, a per-field body diff with ✓ match, ✗ mismatch, and ~ template annotations, and a summary count.

For bulk analysis, the **HAR report** button in the Journal toolbar exports a JSON summary: totalTransactions, matched, unmatched, statusMatches, statusMismatches, bodyMatches, bodyMismatches, and one entry per matched transaction. The button is only visible when at least one enabled route has a HAR source entry — a purely non-HAR workspace hides it.

Round-trip is most useful when switching a client from the real API to the mock: run the same test suite against both, export the HAR report, and resolve any mismatches before the switch.`,
    keyTerms: [
      {
        term: 'harSourceEntry',
        definition: 'Metadata attached to every HAR-imported route: original status, original response body, content-type, and a SHA-256 request fingerprint used to match Journal transactions back to the right HAR entry.',
      },
      {
        term: 'requestFingerprint',
        definition: 'SHA-256 of "METHOD::path::body.slice(0,512)" stored in harSourceEntry — used to correlate an unmatched Journal transaction to its HAR origin even when the route ID is not carried in the response.',
      },
      {
        term: 'Compare HAR button',
        definition: 'Appears in the Transaction Detail actions bar when the matched route has a harSourceEntry. Opens the per-transaction comparison modal.',
      },
      {
        term: 'status match',
        definition: 'Green ✓ badge in the compare modal when the mock returned the same HTTP status code the HAR recorded; red ✗ when they differ.',
      },
      {
        term: 'body diff',
        definition: 'JSON field-by-field (or line-by-line for non-JSON) comparison of the HAR original body vs the mock response body. Template expressions ({{helper}}) are annotated ~ instead of ✗.',
      },
      {
        term: 'HAR report',
        definition: 'JSON export available via the Journal toolbar when HAR-sourced routes exist. Covers all matched transactions since the last Journal clear.',
      },
    ],
    diagram: DIAGRAM,
  },
  setup: prepareAm25Workspace,
  cleanup: cleanupAm25,
  steps: [
    {
      id: 'import',
      title: 'Import a HAR file to create draft mock rules',
      description:
        'Open Import → select the **HAR** source → paste or upload your `.har` file. '
        + 'The preview shows every accepted request as a checkbox row — method, path, status, '
        + 'and a 🔒 when sensitive headers were redacted.\n\n'
        + 'OPTIONS preflights, tracking domains, and duplicate paths are filtered automatically. '
        + 'Each accepted entry becomes a **draft route** after Confirm, holding the original '
        + 'HAR response body and status in its `harSourceEntry` for later comparison.',
      highlight: API_MOCK.IMPORT_MENU,
      preAction: ensureAm25ForImport,
      action: runAm25Import,
      verify: API_MOCK.HAR_PREVIEW_LIST,
    },
    {
      id: 'enable',
      title: 'Enable the imported routes so the mock can match traffic',
      description:
        'Click **Import as draft**. The review closes and both HAR routes land as dimmed draft rows — '
        + 'disabled by default so an untested import cannot silently hijack live traffic.\n\n'
        + 'Select each draft, toggle **Enable**, and click **Apply**. The enabled tally in the routes '
        + 'footer increments to confirm. You must enable before replaying — an unmatched request '
        + 'produces no Journal row to compare.',
      highlight: API_MOCK.IMPORT_CONFIRM,
      preAction: ensureAm25ForEnable,
      action: runAm25Enable,
      verify: API_MOCK.ROUTES_ENABLED,
    },
    {
      id: 'replay',
      title: 'Replay the same requests against the running mock server',
      description:
        'Send the same requests the HAR recorded — via your test suite, the Simulate panel, '
        + `or a direct HTTP call. This demo replays **GET ${AM25_PATH_SESSION}** and **GET ${AM25_PATH_PROFILE}** `
        + 'automatically through the demo bridge.\n\n'
        + 'Each request hits the now-enabled routes and the server logs the transaction in the **Journal**. '
        + 'Outcome appears as **matched** — meaning the route fired, a response was served, and the '
        + '`harSourceEntry` fingerprint is available for comparison.',
      highlight: API_MOCK.START,
      preAction: ensureAm25ForReplay,
      action: runAm25Replay,
      verify: API_MOCK.JOURNAL_FIRST_ROW,
    },
    {
      id: 'compare',
      title: 'Click Compare HAR to open the side-by-side diff',
      description:
        'Click a matched Journal row to open the **Transaction Detail** panel. '
        + 'When the matched route has a `harSourceEntry`, a **Compare HAR** button appears in the actions bar.\n\n'
        + 'Clicking it opens the **HAR round-trip comparison modal**: status code on the first row '
        + '(✓ Match or ✗ Mismatch), then a full body diff. For JSON responses, every field gets its '
        + 'own row. For plain-text, the diff is line by line. The Compare button only appears on '
        + 'HAR-sourced routes — non-HAR transactions show no button.',
      highlight: API_MOCK.TX_COMPARE_HAR,
      preAction: ensureAm25ForCompare,
      action: runAm25Compare,
      verify: API_MOCK.HAR_COMPARE_MODAL,
    },
    {
      id: 'modal',
      title: 'Read the status badge, body diff rows, and summary',
      description:
        'The comparison modal has three sections. **Status** shows the original HAR status code '
        + 'next to what the mock returned and a match badge. When all fields match the body diff '
        + 'is collapsed — click **Show breakdown** to expand the field-by-field table.\n\n'
        + '**Body diff** compares each JSON field: '
        + '✓ identical, ✗ differ, ~ mock uses a `{{template}}` expression (intentional, not a mismatch), '
        + '← only in original, → only in mock.\n\n'
        + 'The **summary line** at the bottom counts mismatches, template fields, and one-sided fields. '
        + 'Template expressions count as body matches in the bulk report — divergence from faker or '
        + 'other helpers is expected. Close the modal with **Close** or Escape when done.',
      highlight: API_MOCK.HAR_COMPARE_STATUS_BADGE,
      preAction: ensureAm25ForModal,
      action: runAm25Modal,
      verify: API_MOCK.JOURNAL_FIRST_ROW,
    },
    {
      id: 'report',
      title: 'Export the bulk comparison report for all matched transactions',
      description:
        'When at least one enabled route has a `harSourceEntry`, a **HAR report** button '
        + 'appears in the Journal toolbar next to the Export button. Clicking it downloads a JSON '
        + 'file covering every HAR-matched transaction since the last Journal clear.\n\n'
        + 'The report includes `totalTransactions`, `matched`, `unmatched`, `statusMatches`, '
        + '`statusMismatches`, `bodyMatches`, `bodyMismatches`, and a per-entry `entries` array with '
        + '`method`, `path`, `originalStatus`, `mockStatus`, `statusMatch`, `bodyMatch`, and an '
        + 'optional `diffSummary` string. Use it in CI to gate a client migration on full match.',
      highlight: API_MOCK.JOURNAL_COMPARE_REPORT,
      preAction: ensureAm25ForReport,
      action: runAm25Report,
    },
  ],
};
