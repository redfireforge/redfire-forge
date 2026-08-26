/**
 * AM-15 `am-15-import` — Import Everything: cURL, OpenAPI, WireMock, HAR, Catalog.
 *
 * Scenario: a blank mock needs rules from every place they already live — a curl
 * that works, an OpenAPI spec, a WireMock mapping, a HAR capture, and the
 * in-app Catalog / Requests libraries. Imports land as drafts. Replace is
 * destructive and says so. The last beat enables one draft and proves it live.
 * Curriculum: `docs/plan/future/apimock/apimock-demo-curriculum-v2.md` §5 Track D.
 */
import { API_MOCK } from '@shared/selectors';
import type { DemoLesson } from '../../types';
import {
  AM15_CURL_PATH,
  AM15_FOLDER,
  AM15_GENERALIZED,
  AM15_PRIORITY,
  AM15_PROVE_PATH,
  cleanupAm15,
  ensureAm15ForCurl,
  ensureAm15ForDrafts,
  ensureAm15ForHar,
  ensureAm15ForHarPreview,
  ensureAm15ForHarCheckbox,
  ensureAm15ForHarSamples,
  ensureAm15ForInternal,
  ensureAm15ForOpenApi,
  ensureAm15ForProve,
  ensureAm15ForPushFromClients,
  ensureAm15ForReplace,
  ensureAm15ForWireMock,
  prepareAm15Workspace,
  runAm15Curl,
  runAm15Drafts,
  runAm15EnableAndProve,
  runAm15Har,
  runAm15HarPreview,
  runAm15HarCheckbox,
  runAm15HarSamples,
  runAm15ImportPanel,
  runAm15InternalSources,
  runAm15OpenApi,
  runAm15PushFromClients,
  runAm15ReplaceMode,
  runAm15WireMock,
} from './api-mock-am15-helpers';

const DIAGRAM = `
<svg viewBox="0 0 700 440" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Seven import sources become draft rules, then one is enabled">
  <rect x="0" y="0" width="700" height="440" fill="#0f172a" />

  <text x="26" y="34" fill="#f1f5f9" font-family="system-ui" font-size="16" font-weight="600">Import lands as a draft. Enable is a separate decision.</text>
  <text x="26" y="54" fill="#64748b" font-family="system-ui" font-size="10">cURL · OpenAPI · WireMock · HAR · Catalog · Requests · native export</text>

  <rect x="26" y="72" width="210" height="150" rx="8" fill="#1e293b" stroke="#3b82f6" />
  <text x="42" y="96" fill="#3b82f6" font-family="system-ui" font-size="12" font-weight="600">Sources</text>
  <text x="42" y="118" fill="#f1f5f9" font-family="system-ui" font-size="11">cURL is the fastest path</text>
  <text x="42" y="138" fill="#a8b8cc" font-family="system-ui" font-size="11">OpenAPI: one stub per operation</text>
  <text x="42" y="158" fill="#a8b8cc" font-family="system-ui" font-size="11">WireMock equalTo + fixed delay survive</text>
  <text x="42" y="178" fill="#64748b" font-family="system-ui" font-size="10">HAR, Catalog, and Requests promote too</text>
  <text x="42" y="202" fill="#64748b" font-family="system-ui" font-size="10">Native round-trip is the seventh card</text>

  <rect x="248" y="72" width="210" height="150" rx="8" fill="#1e293b" stroke="#22c55e" />
  <text x="264" y="96" fill="#22c55e" font-family="system-ui" font-size="12" font-weight="600">Review</text>
  <text x="264" y="118" fill="#f1f5f9" font-family="ui-monospace" font-size="11">${AM15_CURL_PATH} → ${AM15_GENERALIZED}</text>
  <text x="264" y="138" fill="#a8b8cc" font-family="system-ui" font-size="11">Generalize is the power-user beat</text>
  <text x="264" y="158" fill="#a8b8cc" font-family="system-ui" font-size="11">Folder ${AM15_FOLDER} · priority ${AM15_PRIORITY}</text>
  <text x="264" y="178" fill="#64748b" font-family="system-ui" font-size="10">Merge · Replace · Import as copy</text>
  <text x="264" y="202" fill="#f59e0b" font-family="system-ui" font-size="10">Replace warns before it swaps the set</text>

  <rect x="470" y="72" width="204" height="150" rx="8" fill="#1e293b" stroke="#a78bfa" />
  <text x="486" y="96" fill="#a78bfa" font-family="system-ui" font-size="12" font-weight="600">Drafts</text>
  <text x="486" y="118" fill="#f1f5f9" font-family="system-ui" font-size="11">Dimmed rows. Inactive.</text>
  <text x="486" y="138" fill="#a8b8cc" font-family="system-ui" font-size="11">They cannot hijack traffic</text>
  <text x="486" y="158" fill="#a8b8cc" font-family="system-ui" font-size="11">Footer tallies enabled vs draft</text>
  <text x="486" y="178" fill="#64748b" font-family="system-ui" font-size="10">Enable + Apply is the live proof</text>
  <text x="486" y="202" fill="#22c55e" font-family="system-ui" font-size="10">Journal outcome: matched</text>

  <rect x="26" y="240" width="648" height="88" rx="8" fill="#1e293b" stroke="#3b4a60" />
  <text x="42" y="264" fill="#f1f5f9" font-family="system-ui" font-size="12" font-weight="600">Supported WireMock lands as a mapped preview.</text>
  <text x="42" y="284" fill="#a8b8cc" font-family="system-ui" font-size="11">equalTo headers and query plus a fixed delay become Studio predicates.</text>
  <text x="42" y="302" fill="#a8b8cc" font-family="system-ui" font-size="11">A loss report only appears when the stub uses more than that subset.</text>

  <rect x="26" y="340" width="648" height="86" rx="8" fill="#1e293b" stroke="#22c55e" />
  <text x="42" y="364" fill="#22c55e" font-family="system-ui" font-size="12" font-weight="600">Parse → review → Import as draft → enable the one you need</text>
  <text x="42" y="384" fill="#a8b8cc" font-family="system-ui" font-size="11">Seven sources, three modes, one generalize, one mapped WireMock preview,</text>
  <text x="42" y="402" fill="#a8b8cc" font-family="system-ui" font-size="11">one live fetch. That is the whole import contract.</text>
</svg>
`;

export const apiMockAm15Lesson: DemoLesson = {
  id: 'am-15-import',
  domainId: 'api-mock',
  category: 'api-mock',
  name: 'Import Everything: cURL, OpenAPI, WireMock, HAR, Catalog',
  description:
    'Start from a blank mock. Open Import and read the seven sources and three '
    + 'modes. Paste a curl that hits `/users/42`, generalize it to `/users/:id`, '
    + 'and import it as a Draft. Then pull in an OpenAPI spec, a WireMock '
    + 'mapping that Studio can keep, a HAR capture, and Catalog plus Requests. '
    + 'Hold the Replace warning so you know it swaps the whole rule set. Enable '
    + 'the generalized draft, Apply, and prove it with a matched journal row.',
  estimatedMinutes: 8,
  initialTab: 'api-mock-studio',
  allowedTabs: ['api-mock-studio', 'requests', 'catalog'],
  contentVersion: 4,
  concept: {
    title: 'Every source becomes a draft. Enable is how it starts answering.',
    body:
      'A mock that only exists as a curl in a ticket, an OpenAPI file in Git, or '
      + 'a WireMock mapping on another team is still a contract you can own. '
      + '**Import** is the one screen that turns those artifacts into Studio '
      + `rules. Paste \`${AM15_CURL_PATH}\`, hit **Parse & review**, then `
      + `**Generalize path** so \`${AM15_CURL_PATH}\` becomes \`${AM15_GENERALIZED}\` `
      + '— that is the power-user beat, not a cleanup afterthought.\n\n'
      + 'OpenAPI lands **one stub per operation**. WireMock `equalTo` headers '
      + 'and query plus a **fixed delay** become Studio predicates — a loss '
      + 'report only appears when the stub uses more than that subset. HAR, '
      + 'Catalog, and Requests promote the same way. '
      + '**Merge** adds. **Import as copy** duplicates ids. **Replace** deletes '
      + 'every existing rule — the warning is the point of that mode.\n\n'
      + 'Imported rows stay **inactive**. The footer tally is how you see drafts '
      + 'versus live rules. Toggle **Enable**, **Apply**, and fetch: only then '
      + 'does the journal show **matched**. That split is how an import cannot '
      + 'hijack traffic you did not mean to take over.',
    keyTerms: [
      { term: 'Import review', definition: 'The screen that turns a source into previewed routes before anything is written to the server.' },
      { term: 'Merge / Replace / Copy', definition: 'Merge appends. Replace swaps the entire rule set. Import as copy duplicates with new ids. Replace warns first.' },
      { term: 'Generalize path', definition: 'Rewrites numeric segments such as /users/42 into /users/:id so one imported call covers the whole resource.' },
      { term: 'Draft', definition: 'An imported rule that is disabled. It cannot answer traffic until you enable it and Apply.' },
      { term: 'Loss report', definition: 'A list that appears only when a source uses features Studio cannot keep (for example WireMock matches or delayDistribution). This lesson’s stub is the supported subset, so the report stays empty.' },
      { term: 'Catalog / Requests', definition: 'In-app sources. Catalog operations and saved Requests promote into the same draft pipeline as a pasted spec.' },
    ],
    diagram: DIAGRAM,
  },
  prepareBeforeNavigate: prepareAm15Workspace,
  cleanup: cleanupAm15,
  steps: [
    {
      id: 'import-panel',
      title: 'Seven sources, one review, three modes',
      description:
        'Click **Import**. Hold the **source list** — cURL, OpenAPI, Catalog, '
        + 'Requests, the native RedfireForge export, WireMock, and HAR. That is '
        + 'every place a contract already lives.\n\n'
        + 'Hold **Merge**, then **Replace**, then **Import as copy**. Merge is the '
        + 'safe default. Replace is the destructive one. Copy keeps both. The '
        + 'review screen is where you choose before anything is written.',
      highlight: API_MOCK.IMPORT_MENU,
      action: runAm15ImportPanel,
      verify: API_MOCK.IMPORT_REVIEW,
    },
    {
      id: 'curl',
      title: 'The fastest path from a working curl to a mock',
      description:
        `Paste the curl that hits \`${AM15_CURL_PATH}\` and click **Parse & review**. `
        + 'Hold the preview so the method and path are readable.\n\n'
        + `Set the folder to **${AM15_FOLDER}** and priority \`${AM15_PRIORITY}\`. `
        + 'Then click **Generalize path**. Hold the rewrite: '
        + `\`${AM15_CURL_PATH}\` becomes \`${AM15_GENERALIZED}\`. One recorded call `
        + 'now covers every id. That button is the reason this import is not a slideshow.',
      highlight: API_MOCK.CURL_INPUT,
      preAction: ensureAm15ForCurl,
      action: runAm15Curl,
      verify: API_MOCK.IMPORT_PREVIEW_PATH,
    },
    {
      id: 'drafts-are-safe',
      title: 'Imports land disabled so they cannot hijack traffic',
      description:
        'Click **Import as draft**. The review closes. Hold the **Draft** row in '
        + 'the explorer — opacity is the signal that this rule is inactive.\n\n'
        + 'Hold the **footer tally**. Enabled stays at zero; drafts went up by one. '
        + 'Nothing on the listener changed. An import is a proposal until you '
        + 'enable it.',
      highlight: API_MOCK.IMPORT_CONFIRM,
      preAction: ensureAm15ForDrafts,
      action: runAm15Drafts,
      verify: API_MOCK.DRAFT_ROUTE,
    },
    {
      id: 'openapi',
      title: 'A stub per operation, with operationIds intact',
      description:
        'Switch the source to **OpenAPI / Swagger**. Paste a three-operation spec. '
        + 'Click **Pretty format** so the spec is readable — that is the power-user '
        + 'beat — then parse. Hold the **operation list** — list, create, and get each '
        + 'become their own route.\n\n'
        + 'Confirm. Hold the **three new drafts**. A spec is a catalog of stubs, '
        + 'not one blob. You enable the operations you need and leave the rest dimmed.',
      highlight: API_MOCK.importSource('openapi'),
      preAction: ensureAm15ForOpenApi,
      action: runAm15OpenApi,
      verify: API_MOCK.ROUTES_FOOTER,
    },
    {
      id: 'wiremock',
      title: 'A WireMock stub Studio can keep in full',
      description:
        'Switch to **WireMock mappings**. Paste a stub that uses `equalTo` on '
        + '`X-Tenant` and `page`, plus a **fixed delay**. Click **Pretty format** '
        + 'so the mapping is readable, then parse.\n\n'
        + 'Hold the **mapped preview** — `GET /orders/99`, the header and query, '
        + 'and the 40 ms delay all survive. A loss report would list `matches`, '
        + '`contains`, or `delayDistribution`; this sample does not use them, so '
        + 'the report stays empty.',
      highlight: API_MOCK.importSource('wiremock'),
      preAction: ensureAm15ForWireMock,
      action: runAm15WireMock,
      verify: API_MOCK.IMPORT_PREVIEW,
    },
    {
      id: 'har',
      title: 'Recorded browser traffic becomes rules',
      description:
        'Switch to **HAR capture**. Paste two recorded GETs. Click **Pretty format** '
        + 'so the capture is readable, then parse. Hold the **request list** — '
        + 'session and session/me are now candidate rules.\n\n'
        + 'Confirm. Cookies and auth are redacted on the way in. What lands is a '
        + 'draft you can enable, not a replay of someone\'s browser secrets.',
      highlight: API_MOCK.importSource('har'),
      preAction: ensureAm15ForHar,
      action: runAm15Har,
      verify: API_MOCK.ROUTES_FOOTER,
    },
    {
      id: 'har-preview',
      title: 'Per-entry preview: see every request before it becomes a rule',
      description:
        'After parsing, the HAR import shows every request as a **checkbox row** — '
        + 'method, path, status, and a 🔒 when sensitive headers were redacted.\n\n'
        + 'Below the accepted entries, expand **Automatically filtered** to see what '
        + 'the import removed silently: OPTIONS preflights, known tracking domains, '
        + 'and exact duplicates. Nothing lands as a rule without going through this list.',
      highlight: API_MOCK.HAR_PREVIEW_ENTRY_TABLE,
      preAction: ensureAm15ForHarPreview,
      action: runAm15HarPreview,
      verify: API_MOCK.HAR_PREVIEW_LIST,
    },
    {
      id: 'har-checkbox',
      title: 'Uncheck entries you don\'t want as rules',
      description:
        'Uncheck any entry before confirming — static assets, 4xx error responses, '
        + 'or internal health checks that don\'t belong in your contract mock.\n\n'
        + '**All** and **None** bulk-toggle the list. The **Import as draft** button '
        + 'stays disabled while nothing is checked. '
        + 'Only checked entries reach `batchToRoutes()` — nothing else is created.',
      highlight: API_MOCK.HAR_PREVIEW_SELECT_ALL,
      preAction: ensureAm15ForHarCheckbox,
      action: runAm15HarCheckbox,
      verify: API_MOCK.HAR_PREVIEW_LIST,
    },
    {
      id: 'har-samples',
      title: 'HAR import can also seed Simulate saved samples',
      description:
        'Re-open the HAR import and hold **Also create Simulate samples** — the checkbox '
        + 'below the entry list. Check it and confirm.\n\n'
        + 'Navigate to **Simulate**. Under **Saved samples** you will find one entry per '
        + 'imported request, pre-filled with its method, path, and the expected HTTP status '
        + 'from the real HAR response. Run them to confirm the mock answers correctly.',
      highlight: API_MOCK.HAR_IMPORT_SAMPLES_TOGGLE,
      preAction: ensureAm15ForHarSamples,
      action: runAm15HarSamples,
      verify: API_MOCK.SIMULATE_SECTION_SAVED,
    },
    {
      id: 'internal-sources',
      title: 'Catalog endpoints and saved Requests promote directly',
      description:
        'Switch to **Catalog endpoints**. Filter to the seeded demo API, **Select '
        + 'all** (two operations), generate the review, and import as draft.\n\n'
        + 'Then switch to **Requests collection**, select all, and confirm again. '
        + 'Hold the footer. In-app sources use the same draft pipeline as a pasted '
        + 'spec — you do not re-type a path you already saved.',
      highlight: API_MOCK.importSource('catalog'),
      preAction: ensureAm15ForInternal,
      action: runAm15InternalSources,
      verify: API_MOCK.ROUTES_FOOTER,
    },
    {
      id: 'push-from-clients',
      title: 'The push direction: Requests and Catalog both have Export to API Mock',
      description:
        'Everything so far pulled imports **into** API Mock Studio. The product also '
        + 'works in reverse.\n\n'
        + 'Switch to **Requests**, right-click `List inventory` in the seeded collection, '
        + 'and choose **Export to API Mock**. The modal picks your active server, lets you '
        + 'choose or create a folder, and previews the route before it writes anything. '
        + 'Confirm — the route lands as a draft.\n\n'
        + 'Switch to **Catalog**, open the `Import demo API` entry, and click **Export to '
        + 'API Mock** on the `GET /catalog/widgets` endpoint card. Same modal, same draft '
        + 'pipeline. Return to API Mock Studio and hold the footer — both routes are there.',
      highlight: API_MOCK.EXPORT_TO_MOCK_BODY,
      preAction: ensureAm15ForPushFromClients,
      action: runAm15PushFromClients,
      verify: API_MOCK.ROUTES_FOOTER,
    },
    {
      id: 'replace-mode',
      title: 'Replace swaps the entire rule set — know before you click',
      description:
        'Re-open Import. Hold **Replace**, then click it. Hold the **destructive '
        + 'warning**. Replace is not merge with a louder name — it deletes every '
        + 'existing rule on this server and puts the import in their place.\n\n'
        + 'You do not confirm. Cancel. The warning existing is the lesson. Merge '
        + 'and Import as copy are still there when you want them.',
      highlight: API_MOCK.IMPORT_MODE_REPLACE,
      preAction: ensureAm15ForReplace,
      action: runAm15ReplaceMode,
      verify: API_MOCK.IMPORT_REPLACE_WARNING,
    },
    {
      id: 'enable-and-prove',
      title: 'A draft only matters once it answers traffic',
      description:
        `Select the generalized \`${AM15_GENERALIZED}\` draft and toggle **Enable**. `
        + 'Hold the control so the amber **Draft** row turns **On**.\n\n'
        + `Click **Apply**, then fetch \`${AM15_PROVE_PATH}\`. Hold the journal `
        + '**matched** row. That is the only proof an import shipped: live traffic, '
        + 'not a preview card.',
      highlight: API_MOCK.ROUTE_ENABLED,
      preAction: ensureAm15ForProve,
      action: runAm15EnableAndProve,
      verify: API_MOCK.TX_OUTCOME,
    },
  ],
};
