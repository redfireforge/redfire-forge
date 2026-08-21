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
  contentVersion: 4,
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
        'A rule can answer `/products` flawlessly and a browser will still '
        + 'refuse to read it — the preflight fails first. **CORS** is how you '
        + `let a real front-end (here \`${AM19_CORS_ORIGIN}\`) talk to the mock, `
        + 'and it lives on the **live strip’s Settings** — the ops desk for the '
        + 'running listener, not the server-definition modal.\n\n'
        + `The payoff is what you *don’t* see: the \`OPTIONS ${AM19_PRODUCTS}\` `
        + 'preflight answers **204 (No Content)** and the transaction count '
        + 'stays put. Preflights are plumbing, not traffic — keeping them off '
        + 'the journal means the log only holds the calls you actually care about.',
      highlight: API_MOCK.LIVE_SETTINGS,
      action: runAm19Cors,
      verify: API_MOCK.LIVE_TRANSACTIONS,
    },
    {
      id: 'limits',
      title: 'Cap payloads, connections, and the drain window',
      description:
        'An unbounded mock trusts every caller: it will accept a gigabyte '
        + 'POST, hold every socket a load test throws at it, and hang on Stop. '
        + '**Limits** are the fence you raise *before* the long run, not after '
        + 'something falls over — a ceiling on **inbound body** bytes, on '
        + 'concurrent **connections**, and on the graceful **drain** window at '
        + 'shutdown.\n\n'
        + 'You are not trying to trip a cap today. The point is simply that the '
        + 'companion now has a ceiling — a bounded process is one you can leave '
        + 'running overnight without wondering what a stray client might send.',
      highlight: API_MOCK.RUNTIME_SETTINGS_INBOUND,
      preAction: ensureAm19ForLimits,
      action: runAm19Limits,
      verify: API_MOCK.RUNTIME_SETTINGS_DRAIN,
    },
    {
      id: 'redaction-config',
      title: 'Secrets must not land in a journal you will export',
      description:
        'The journal is valuable precisely because you will copy it into a '
        + 'ticket, a PR, or a chat — which is also why a live token landing '
        + 'there is a real incident. **Redaction** decides, per workspace, what '
        + 'the log is allowed to remember: header names like `authorization` '
        + 'and JSONPaths like `$.password` are scrubbed to `[REDACTED]` before '
        + 'anything is written.\n\n'
        + '`Authorization` already ships in the defaults; adding `$.password` '
        + 'shows how you extend that policy to your own payload shape. You set '
        + 'it once, and every future capture is safe to share by default.',
      highlight: API_MOCK.RUNTIME_SETTINGS_REDACT_HEADERS,
      preAction: ensureAm19ForRedactionConfig,
      action: runAm19RedactionConfig,
      verify: API_MOCK.RUNTIME_SETTINGS_REDACT_PATHS,
    },
    {
      id: 'prove-redaction',
      title: 'Send a real secret and watch it disappear',
      description:
        'Configuration is a promise — this step is the proof. Against the real '
        + `running listener, a \`POST ${AM19_CART_PATH}\` carries a genuine `
        + '`Bearer` token and a body with a `password`: exactly the shape you '
        + 'never want to see in a log.\n\n'
        + 'A plain `GET /products` row is already in the journal for contrast. '
        + 'Open the **new** row and read the request: the scheme survives '
        + 'but the token is `Bearer [REDACTED]`, and `password` reads '
        + '`[REDACTED]` in the body. The mock still matched and answered '
        + 'normally — redaction changed only what was *remembered*, not what '
        + 'happened. That is a log you can hand to anyone.',
      highlight: API_MOCK.ADDRESS,
      preAction: ensureAm19ForProveRedaction,
      action: runAm19ProveRedaction,
      verify: API_MOCK.TX_REQUEST,
    },
    {
      id: 'persistence-and-diagnostics',
      title: 'Long runs need a durable journal and a latency budget',
      description:
        'A long soak needs two things a live in-memory log cannot give you: a '
        + 'record that survives a companion restart, and a way to confirm the '
        + 'mock is cheap without reopening every request. **Persist to disk** '
        + 'answers the first — a capped, redacted snapshot under the OS temp '
        + 'directory.\n\n'
        + '**Diagnostics** answers the second, and does it with counters only: '
        + '**Match p95** (sub-millisecond for a library this size) and outcome '
        + 'tallies — never a URL, header, or body. It is the health signal you '
        + 'can watch on a dashboard without ever exposing what the traffic '
        + 'contained.',
      highlight: API_MOCK.RUNTIME_SETTINGS_PERSIST,
      preAction: ensureAm19ForPersist,
      action: runAm19PersistAndDiagnostics,
      verify: API_MOCK.DIAG_MATCH_P95,
    },
    {
      id: 'console',
      title: 'Lifecycle truth: start, commit, stop, errors',
      description:
        'When **Start** looks green but nothing answers, the journal is no '
        + 'help — there is no traffic to show. The **Console** is the other '
        + 'half of the story: what the companion process actually did — '
        + 'listener start, the generation commit after each Apply, stop, and '
        + 'any errors — not a tidy reconstruction after the fact.\n\n'
        + 'These lines stream live from the running companion, so watch a '
        + '**Restart** land a fresh lifecycle entry the instant it happens.\n\n'
        + 'Hold that framing: the journal is *traffic*, the console is the '
        + '*process*. Any time the mock’s behaviour and its status badge '
        + 'disagree, these lifecycle lines are the first place you look.',
      highlight: API_MOCK.DOCK_TAB_CONSOLE,
      preAction: ensureAm19ForConsole,
      action: runAm19Console,
      verify: API_MOCK.CONSOLE,
    },
    {
      id: 'transforms-and-callbacks',
      title: 'Rewrite after render; fire webhooks after delivery',
      description:
        'Everything so far shaped what the mock *stores*. **Outbound** shapes '
        + 'what it *sends* and who it *tells*. A **transform** rewrites the '
        + 'rendered response one last time before the client reads it — here a '
        + `set-header stamping \`${AM19_TRANSFORM_HEADER}: RedfireForge\`, with `
        + 'set-status and replace-body waiting in the same op menu.\n\n'
        + 'A **callback** reaches further: after the client already has its '
        + 'reply, the mock POSTs a webhook to a downstream system — but only to '
        + `a URL on the **Proxy allowlist** (\`${AM19_CALLBACK_URL}\`), and only `
        + 'within a retry budget. Callbacks never touch the reply the client '
        + 'saw, and an empty allowlist blocks every one, so nothing fires by '
        + 'accident.',
      highlight: API_MOCK.TRANSFORM_ADD,
      preAction: ensureAm19ForTransforms,
      action: runAm19TransformsAndCallbacks,
      verify: API_MOCK.CALLBACK_URL_FIRST,
    },
    {
      id: 'prove-transform',
      title: 'The transform lands on a real response',
      description:
        'An edit in the Outbound panel means nothing until it is on the wire, '
        + 'so **Apply** publishes the snapshot and a real '
        + `\`GET ${AM19_PRODUCTS}\` goes out. Open the journal row and read the `
        + `response headers: \`${AM19_TRANSFORM_HEADER}: RedfireForge\` is `
        + 'really there — not just in the editor.\n\n'
        + 'That is the whole contract of a transform: it runs *after* templates '
        + 'render and *before* the client reads the body. And a header you can '
        + 'grep in a log is how you prove, months later, that the mock answered '
        + 'a call — not the real origin.',
      highlight: API_MOCK.APPLY,
      preAction: ensureAm19ForProveTransform,
      action: runAm19ProveTransform,
      verify: API_MOCK.TX_RESPONSE,
    },
  ],
};
