/**
 * AM-19 `am-19-runtime-ops` — Runtime Ops: CORS, Limits, Redaction,
 * Diagnostics & Console.
 *
 * Scenario: a storefront mock is already answering `/products`. Runtime
 * Settings turns on CORS so browser preflights stay off the journal, caps
 * inbound size and drain, redacts Authorization and `$.password`, persists
 * the log, then Diagnostics and Console show the cost. Outbound transforms
 * inject `X-Mocked-By` and a callback is allowlisted. Curriculum:
 * `docs/plan/future/apimock/apimock-demo-curriculum-v2.md` §5 Track D.
 */
import { API_MOCK } from '@shared/selectors';
import type { DemoLesson } from '../../types';
import {
  AM19_CALLBACK_URL,
  AM19_CART_PATH,
  AM19_CORS_ORIGIN,
  AM19_PRODUCTS,
  AM19_TRANSFORM_HEADER,
  cleanupAm19,
  ensureAm19ForConsole,
  ensureAm19ForLimits,
  ensureAm19ForPersist,
  ensureAm19ForProveRedaction,
  ensureAm19ForProveTransform,
  ensureAm19ForRedactionConfig,
  ensureAm19ForTransforms,
  prepareAm19Workspace,
  runAm19Console,
  runAm19Cors,
  runAm19Limits,
  runAm19PersistAndDiagnostics,
  runAm19ProveRedaction,
  runAm19ProveTransform,
  runAm19RedactionConfig,
  runAm19TransformsAndCallbacks,
} from './api-mock-am19-helpers';

const DIAGRAM = `
<svg viewBox="0 0 700 430" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Runtime ops: CORS, limits, redaction, diagnostics, transforms">
  <rect x="0" y="0" width="700" height="430" fill="#0f172a" />

  <text x="26" y="34" fill="#f1f5f9" font-family="system-ui" font-size="16" font-weight="600">Operate the running mock, not just the rules</text>
  <text x="26" y="54" fill="#64748b" font-family="system-ui" font-size="10">CORS · limits · redaction · persist · diagnostics · console · outbound</text>

  <rect x="26" y="72" width="210" height="150" rx="8" fill="#1e293b" stroke="#38bdf8" />
  <text x="42" y="96" fill="#38bdf8" font-family="system-ui" font-size="12" font-weight="600">CORS + limits</text>
  <text x="42" y="118" fill="#f1f5f9" font-family="ui-monospace" font-size="11">OPTIONS → 204</text>
  <text x="42" y="138" fill="#a8b8cc" font-family="system-ui" font-size="11">Journal count unchanged</text>
  <text x="42" y="158" fill="#a8b8cc" font-family="system-ui" font-size="11">Inbound · connections · drain</text>
  <text x="42" y="202" fill="#64748b" font-family="system-ui" font-size="10">Preflights stay off the log</text>

  <rect x="252" y="72" width="210" height="150" rx="8" fill="#1e293b" stroke="#f59e0b" />
  <text x="268" y="96" fill="#f59e0b" font-family="system-ui" font-size="12" font-weight="600">Redaction</text>
  <text x="268" y="118" fill="#f1f5f9" font-family="ui-monospace" font-size="11">authorization</text>
  <text x="268" y="138" fill="#f1f5f9" font-family="ui-monospace" font-size="11">$.password</text>
  <text x="268" y="158" fill="#a8b8cc" font-family="system-ui" font-size="11">Bearer [REDACTED]</text>
  <text x="268" y="202" fill="#22c55e" font-family="system-ui" font-size="10">Secrets never land in export</text>

  <rect x="478" y="72" width="196" height="150" rx="8" fill="#1e293b" stroke="#a78bfa" />
  <text x="494" y="96" fill="#a78bfa" font-family="system-ui" font-size="12" font-weight="600">Observe</text>
  <text x="494" y="118" fill="#f1f5f9" font-family="system-ui" font-size="11">Persist journal to disk</text>
  <text x="494" y="138" fill="#a8b8cc" font-family="system-ui" font-size="11">Match p95 · outcomes</text>
  <text x="494" y="158" fill="#a8b8cc" font-family="system-ui" font-size="11">Console: start / commit</text>
  <text x="494" y="202" fill="#22c55e" font-family="system-ui" font-size="10">Counters, never payloads</text>

  <rect x="26" y="240" width="648" height="70" rx="8" fill="#1e293b" stroke="#3b4a60" />
  <text x="42" y="268" fill="#f1f5f9" font-family="system-ui" font-size="12" font-weight="600">Transforms rewrite after render. Callbacks fire after delivery — and only to an allowlisted URL.</text>
  <text x="42" y="290" fill="#a8b8cc" font-family="system-ui" font-size="11">setHeader ${AM19_TRANSFORM_HEADER}: RedfireForge lands on the real response. Retries and the allowlist live next to the webhook.</text>

  <rect x="26" y="328" width="648" height="78" rx="8" fill="#1e293b" stroke="#22c55e" />
  <text x="42" y="356" fill="#22c55e" font-family="system-ui" font-size="12" font-weight="600">CORS → limits → redact → prove → persist + p95 → console → transform + callback → Apply</text>
  <text x="42" y="378" fill="#a8b8cc" font-family="system-ui" font-size="11">Runtime Settings is the ops desk. Outbound is how the mock talks back to the rest of the stack.</text>
</svg>
`;

export const apiMockAm19Lesson: DemoLesson = {
  id: 'am-19-runtime-ops',
  domainId: 'protocols',
  category: 'api-mock',
  name: 'Runtime Ops: CORS, Limits, Redaction, Diagnostics & Console',
  description:
    'Open Runtime Settings on a running store library. Enable CORS so an '
    + 'OPTIONS preflight answers 204 without writing a journal row. Cap '
    + 'inbound size, connections, and drain. Redact `authorization` and '
    + '`$.password`, then POST a real secret and watch `[REDACTED]`. Persist '
    + 'the journal, read match p95 and outcome counters, then the console '
    + 'lifecycle lines. Add a setHeader transform and an allowlisted callback, '
    + 'Apply, and hold the injected header on a live response.',
  estimatedMinutes: 8,
  initialTab: 'api-mock-studio',
  contentVersion: 1,
  concept: {
    title: 'Rules answer traffic. Runtime Settings keeps that traffic safe to operate.',
    body:
      'A library that matches perfectly can still leak secrets, melt the '
      + 'companion, or refuse a browser client. **Runtime Settings** is the '
      + 'ops desk for a running mock: CORS so preflights stay off the journal, '
      + 'limits so a huge body or hung drain cannot take the process down, and '
      + 'redaction so `Authorization` and JSONPath secrets never land in a log '
      + 'you will export.\n\n'
      + '**Persist to disk** keeps a capped, redacted snapshot across companion '
      + 'restarts. **Diagnostics** is counters only — match p95, outcome chips — '
      + 'never payloads. The **console** is lifecycle truth: start, commit, '
      + 'stop, errors.\n\n'
      + 'Outbound is the other half. **Transforms** rewrite the rendered '
      + 'response (set a header, status, or body) before delivery. **Callbacks** '
      + 'POST after the client already has the reply, and only to URLs on the '
      + 'allowlist, with a retry budget. Apply puts that snapshot on the wire.',
    keyTerms: [
      { term: 'CORS preflight', definition: 'An OPTIONS request the browser sends before the real call. When CORS is on, the mock answers 204 and does not journal it.' },
      { term: 'Limits', definition: 'Caps on inbound body bytes, concurrent connections, and graceful drain so the companion stays bounded.' },
      { term: 'Redaction', definition: 'Header names and JSONPaths stripped to [REDACTED] in the journal so exports never carry secrets.' },
      { term: 'Journal persist', definition: 'A capped, redacted snapshot under the OS temp directory that survives companion restart.' },
      { term: 'Diagnostics', definition: 'Local counters only — generation, match p95, outcome tallies — never URLs, headers, or bodies.' },
      { term: 'Transform', definition: 'A post-render rewrite of the mock response (setHeader, setStatus, replaceBody) before it is delivered.' },
      { term: 'Callback allowlist', definition: 'Exact absolute URLs the mock may POST to after delivery. Empty means every callback is blocked.' },
    ],
    diagram: DIAGRAM,
  },
  prepareBeforeNavigate: prepareAm19Workspace,
  cleanup: cleanupAm19,
  steps: [
    {
      id: 'cors',
      title: 'Browser clients need CORS, and preflights stay off the journal',
      description:
        'Click **Settings** on the live strip — that is Runtime Settings, not '
        + 'the server modal. Toggle **CORS** on, fill Allow origins with '
        + `\`${AM19_CORS_ORIGIN}\`, then **Save settings**. If the listener is `
        + 'dirty, **Apply** so the running snapshot picks it up.\n\n'
        + `Fetch \`OPTIONS ${AM19_PRODUCTS}\`. The preflight answers **204** and `
        + 'the transaction count does **not** move. Preflights are invisible '
        + 'on purpose — the journal is for the calls you care about.',
      highlight: API_MOCK.LIVE_SETTINGS,
      action: runAm19Cors,
      verify: API_MOCK.LIVE_TRANSACTIONS,
    },
    {
      id: 'limits',
      title: 'Cap payloads, connections, and the drain window',
      description:
        'A mock without limits is a process that will accept anything. Fill '
        + '**Inbound body** (bytes), then **Connections**, then **Drain '
        + 'timeout** (milliseconds). Hold each field so the numbers are '
        + 'readable.\n\n'
        + 'These caps protect the companion from an oversized POST or a hung '
        + 'Stop. Save so the next Apply carries them. You are not trying to '
        + 'trip the cap today — you are putting a fence up before the long run.',
      highlight: API_MOCK.RUNTIME_SETTINGS_INBOUND,
      preAction: ensureAm19ForLimits,
      action: runAm19Limits,
      verify: API_MOCK.RUNTIME_SETTINGS_DRAIN,
    },
    {
      id: 'redaction-config',
      title: 'Secrets must not land in a journal you will export',
      description:
        'The journal is useful because you will copy it, export it, and paste '
        + 'it into a ticket. Fill **Redact headers** with `authorization` and '
        + '**Redact paths** with `$.password`, then **Save settings**.\n\n'
        + 'Default header names already include Authorization. Narrowing the '
        + 'list and adding a JSONPath is how you decide what this workspace is '
        + 'allowed to remember. Apply so the running listener scrubs the next '
        + 'request.',
      highlight: API_MOCK.RUNTIME_SETTINGS_REDACT_HEADERS,
      preAction: ensureAm19ForRedactionConfig,
      action: runAm19RedactionConfig,
      verify: API_MOCK.RUNTIME_SETTINGS_REDACT_PATHS,
    },
    {
      id: 'prove-redaction',
      title: 'Send a real secret and watch it disappear',
      description:
        `Watch the listen address, then POST \`${AM19_CART_PATH}\` with `
        + '`Authorization: Bearer s3cret-token` and a JSON body that includes '
        + '`password`. Open the new journal row.\n\n'
        + 'The request preview shows `Bearer [REDACTED]` — the scheme stays, '
        + 'the token does not. Then `password` is `[REDACTED]` in the body. '
        + 'That is the proof: the mock still matched, and the log is safe to '
        + 'share.',
      highlight: API_MOCK.ADDRESS,
      preAction: ensureAm19ForProveRedaction,
      action: runAm19ProveRedaction,
      verify: API_MOCK.TX_REQUEST,
    },
    {
      id: 'persistence-and-diagnostics',
      title: 'Long runs need a durable journal and a latency budget',
      description:
        'Toggle **Persist to disk** so a capped, redacted snapshot lands under '
        + 'the OS temp directory and survives a companion restart. Save, then '
        + 'open the **Diagnostics** dock tab.\n\n'
        + 'Hold **Match p95** — it should be sub-millisecond for this library — '
        + 'then the outcome counters. Diagnostics never shows URLs, headers, '
        + 'or bodies. It is how you know the mock is cheap without reading '
        + 'payloads.',
      highlight: API_MOCK.RUNTIME_SETTINGS_PERSIST,
      preAction: ensureAm19ForPersist,
      action: runAm19PersistAndDiagnostics,
      verify: API_MOCK.DIAG_MATCH_P95,
    },
    {
      id: 'console',
      title: 'Lifecycle truth: start, commit, stop, errors',
      description:
        'Click the **Console** dock tab. These lines are what the companion '
        + 'actually did — listener start, generation commit after Apply, stop, '
        + 'and errors — not a pretty reconstruction.\n\n'
        + 'When a Start looks green in the chrome but the mock is silent, this '
        + 'is the first place to look. Hold the start and commit lines. The '
        + 'journal is traffic; the console is the process.',
      highlight: API_MOCK.DOCK_TAB_CONSOLE,
      preAction: ensureAm19ForConsole,
      action: runAm19Console,
      verify: API_MOCK.CONSOLE,
    },
    {
      id: 'transforms-and-callbacks',
      title: 'Rewrite after render; fire webhooks after delivery',
      description:
        'Back on **List Products**, open Response → **Outbound**. Click **+ Add** '
        + 'under Transforms — the default is **Set header** '
        + `\`${AM19_TRANSFORM_HEADER}: RedfireForge\`. Hold the row; the op `
        + 'menu also has set status and replace body.\n\n'
        + 'Then **+ Add** a callback. Fill the URL and body, then the retries '
        + `field. Open Settings → Proxy and put \`${AM19_CALLBACK_URL}\` on the `
        + 'allowlist. Callbacks never change the mock reply; they only fire if '
        + 'the URL is listed.',
      highlight: API_MOCK.TRANSFORM_ADD,
      preAction: ensureAm19ForTransforms,
      action: runAm19TransformsAndCallbacks,
      verify: API_MOCK.CALLBACK_URL_FIRST,
    },
    {
      id: 'prove-transform',
      title: 'The transform lands on a real response',
      description:
        'Click **Apply** so the running snapshot includes the new transform. '
        + `Fetch \`GET ${AM19_PRODUCTS}\`. Open the journal row and hold the `
        + `response headers — \`${AM19_TRANSFORM_HEADER}: RedfireForge\` is on `
        + 'the wire, not only in the editor.\n\n'
        + 'That is the contract: Outbound rewrites after templates render, '
        + 'before the client reads the body. A header you can grep in a log '
        + 'is how you prove the mock — not the origin — answered.',
      highlight: API_MOCK.APPLY,
      preAction: ensureAm19ForProveTransform,
      action: runAm19ProveTransform,
      verify: API_MOCK.TX_RESPONSE,
    },
  ],
};
