/**
 * AM-01 `am-01-studio-tour` — Studio Tour & Your First Mock.
 *
 * Scenario: the checkout frontend needs `GET /health` before the real service exists.
 * Everything is authored live — no Gallery import.
 * Curriculum: `docs/plan/future/apimock/apimock-demo-curriculum-v2.md` §5 Track A.
 */
import { API_MOCK } from '@shared/selectors';
import type { DemoLesson } from '../../types';
import {
  cleanupAm01,
  ensureAm01JournalOpen,
  ensureAm01Response,
  ensureAm01Rule,
  ensureAm01Running,
  ensureAm01Server,
  ensureAm01Stoppable,
  prepareAm01Workspace,
  runAm01AuthorMatch,
  runAm01AuthorResponse,
  runAm01CreateServer,
  runAm01Inspect,
  runAm01SendTraffic,
  runAm01Start,
  runAm01Stop,
  runAm01WorkspaceTour,
} from './api-mock-am01-helpers';

const DIAGRAM = `
<svg viewBox="0 0 700 430" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Mock server anatomy: definition, listener, journal">
  <defs>
    <marker id="am01-arrow" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
      <path d="M0,0 L10,4 L0,8 Z" fill="#94a3b8" />
    </marker>
  </defs>
  <rect x="0" y="0" width="700" height="430" fill="#0f172a" />

  <text x="26" y="34" fill="#f1f5f9" font-family="system-ui" font-size="16" font-weight="600">One mock server = definition + listener + journal</text>

  <rect x="26" y="58" width="200" height="150" rx="8" fill="#1e293b" stroke="#3b4a60" />
  <text x="42" y="82" fill="#a8b8cc" font-family="system-ui" font-size="11" letter-spacing="1">DEFINITION (draft)</text>
  <text x="42" y="108" fill="#f1f5f9" font-family="ui-monospace" font-size="12">GET /health</text>
  <text x="42" y="130" fill="#a8b8cc" font-family="system-ui" font-size="11">match: path Exact</text>
  <text x="42" y="150" fill="#a8b8cc" font-family="system-ui" font-size="11">response: 200 JSON</text>
  <text x="42" y="178" fill="#64748b" font-family="system-ui" font-size="11">edited in Studio,</text>
  <text x="42" y="194" fill="#64748b" font-family="system-ui" font-size="11">saved with the workspace</text>

  <line x1="226" y1="133" x2="286" y2="133" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#am01-arrow)" />
  <text x="234" y="124" fill="#3b82f6" font-family="system-ui" font-size="10">Start</text>

  <rect x="286" y="58" width="200" height="150" rx="8" fill="#1e293b" stroke="#3b82f6" />
  <text x="302" y="82" fill="#a8b8cc" font-family="system-ui" font-size="11" letter-spacing="1">LISTENER (running)</text>
  <text x="302" y="108" fill="#f1f5f9" font-family="ui-monospace" font-size="12">127.0.0.1:4600</text>
  <text x="302" y="130" fill="#22c55e" font-family="system-ui" font-size="11">● Running · generation 1</text>
  <text x="302" y="158" fill="#64748b" font-family="system-ui" font-size="11">a real HTTP port your</text>
  <text x="302" y="174" fill="#64748b" font-family="system-ui" font-size="11">app, curl, or CI can call</text>

  <line x1="486" y1="133" x2="546" y2="133" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#am01-arrow)" />

  <rect x="546" y="58" width="128" height="150" rx="8" fill="#1e293b" stroke="#3b4a60" />
  <text x="562" y="82" fill="#a8b8cc" font-family="system-ui" font-size="11" letter-spacing="1">JOURNAL</text>
  <text x="562" y="108" fill="#22c55e" font-family="ui-monospace" font-size="11">200 matched</text>
  <text x="562" y="128" fill="#a8b8cc" font-family="ui-monospace" font-size="11">GET /health</text>
  <text x="562" y="148" fill="#a8b8cc" font-family="ui-monospace" font-size="11">1.8 ms</text>
  <text x="562" y="176" fill="#64748b" font-family="system-ui" font-size="10">every request,</text>
  <text x="562" y="190" fill="#64748b" font-family="system-ui" font-size="10">matched or not</text>

  <text x="26" y="252" fill="#f1f5f9" font-family="system-ui" font-size="14" font-weight="600">Three workspace views</text>
  <rect x="26" y="268" width="205" height="86" rx="8" fill="#1e293b" stroke="#3b82f6" />
  <text x="42" y="292" fill="#f1f5f9" font-family="system-ui" font-size="12" font-weight="600">Studio</text>
  <text x="42" y="314" fill="#a8b8cc" font-family="system-ui" font-size="11">author rules:</text>
  <text x="42" y="332" fill="#a8b8cc" font-family="system-ui" font-size="11">match + response</text>

  <rect x="247" y="268" width="205" height="86" rx="8" fill="#1e293b" stroke="#3b4a60" />
  <text x="263" y="292" fill="#f1f5f9" font-family="system-ui" font-size="12" font-weight="600">Runtime</text>
  <text x="263" y="314" fill="#a8b8cc" font-family="system-ui" font-size="11">journal, state, settings,</text>
  <text x="263" y="332" fill="#a8b8cc" font-family="system-ui" font-size="11">diagnostics, console</text>

  <rect x="468" y="268" width="206" height="86" rx="8" fill="#1e293b" stroke="#3b4a60" />
  <text x="484" y="292" fill="#f1f5f9" font-family="system-ui" font-size="12" font-weight="600">Conflicts</text>
  <text x="484" y="314" fill="#a8b8cc" font-family="system-ui" font-size="11">which rules overlap</text>
  <text x="484" y="332" fill="#a8b8cc" font-family="system-ui" font-size="11">and which one wins</text>

  <text x="26" y="392" fill="#a8b8cc" font-family="system-ui" font-size="12">Draft edits stay local until you Start (or Apply) — the listener always serves a committed generation.</text>
  <text x="26" y="412" fill="#64748b" font-family="system-ui" font-size="11">Stop drains connections and frees the port; the draft definition survives in your workspace.</text>
</svg>
`;

export const apiMockAm01Lesson: DemoLesson = {
  id: 'am-01-studio-tour',
  domainId: 'protocols',
  category: 'api-mock',
  name: 'Studio Tour & Your First Mock',
  description:
    'Build a real HTTP mock from an empty workspace: create a server, author GET /health, '
    + 'start the listener, send live traffic from the app, and read the journal.',
  estimatedMinutes: 5,
  initialTab: 'api-mock-studio',
  contentVersion: 1,
  concept: {
    title: 'What an API mock server actually is',
    body:
      'A mock server is not a fixture file — it is a **real HTTP listener** on a real port on your machine. '
      + 'That difference is the whole point: your frontend, your test harness, curl, and CI all talk to it '
      + 'exactly the way they talk to the service it stands in for, so you can build and test against an API '
      + 'that does not exist yet, is unstable, or costs money to call.\n\n'
      + 'Every mock server in the Studio has three parts. The **definition** is your draft: a list of rules, '
      + 'each pairing a *match* (which requests do I answer?) with a *response* (what do I send back?). '
      + 'The **listener** is the running process bound to a port — it serves a committed snapshot of the '
      + 'definition called a *generation*, which is why edits you make while it runs stay drafts until you '
      + 'Start or Apply. The **journal** records every request that arrives, matched or not, with the rule '
      + 'that won and how long it took.\n\n'
      + 'The Studio splits that into three views. **Studio** is where you author rules. **Runtime** is where '
      + 'you watch traffic and tune server settings. **Conflicts** tells you when two rules could answer the '
      + 'same request — the failure mode that wastes the most debugging time in mocking.\n\n'
      + 'This lesson builds all of it live on an empty workspace — nothing is imported. Eight steps walk the '
      + 'full loop: create → author → start → call → inspect → stop. Every later lesson in this track goes '
      + 'deeper on one of those beats.',
    keyTerms: [
      { term: 'Rule', definition: 'A match + response pair. The match decides which requests it claims; the response is what gets sent. Rules are the unit you author, import, export, and version.' },
      { term: 'Definition vs generation', definition: 'The definition is your editable draft. Starting or applying commits it as a numbered generation — the exact snapshot the listener is serving right now.' },
      { term: 'Auto-port', definition: 'New servers claim the next free port in 4600–4699, so several mocks coexist without you hand-picking ports or colliding with dev servers.' },
      { term: 'Journal', definition: 'The per-server transaction log: method, path, status, matched rule, duration, and near-miss detail for requests that matched nothing.' },
      { term: 'Match kind', definition: 'How a path is interpreted — Exact, Param (`/users/:id`), Glob (`/static/*`), or Regex. Inferred from what you type; the **Path Matching** lesson covers the precedence rules.' },
      { term: 'Response preview', definition: 'The right-hand pane rendering the exact status line, headers, and body bytes a client will receive — before you start anything.' },
    ],
    diagram: DIAGRAM,
  },
  prepareBeforeNavigate: async () => {
    await prepareAm01Workspace();
  },
  cleanup: async () => {
    await cleanupAm01();
  },
  steps: [
    {
      id: 'workspace-tour',
      title: 'Three views, one workspace',
      description:
        'Before building anything, learn the geography. The spotlight walks the header nav: **Runtime** '
        + '(live traffic, settings, diagnostics), **Conflicts** (rules that fight over the same request), '
        + 'and back to **Studio**, where rules are authored. Both side views are empty — there is no server '
        + 'yet, which is exactly where every mock starts.',
      highlight: API_MOCK.WORKSPACE_NAV,
      preAction: async () => {
        await prepareAm01Workspace();
      },
      action: runAm01WorkspaceTour,
      verify: API_MOCK.EMPTY,
    },
    {
      id: 'create-server',
      title: 'Create a server and grab its address',
      description:
        'An empty workspace offers one button. **Create mock server** adds a definition and claims the next '
        + 'free **auto-port** in 4600–4699, so you never hand-pick ports. Then the spotlight moves along the '
        + 'server bar: the **listen address** your frontend `.env` needs, **Copy address** (watch the icon '
        + 'flip to a tick), and the **status**, which reads Stopped — the definition exists, but nothing is '
        + 'listening yet.',
      highlight: API_MOCK.CREATE_FIRST,
      preAction: async () => {
        await prepareAm01Workspace();
      },
      action: runAm01CreateServer,
      verify: API_MOCK.SERVER_BAR,
    },
    {
      id: 'author-match',
      title: 'Author the match: GET /health',
      description:
        'Rules are the unit of mocking — each is a **match + response** pair. **+ Add rule** opens the '
        + 'editor on the **Match** tab. The method stays **GET**, then we type the path: the Studio infers '
        + 'the **match kind** from what you type, and with no `:param`, `*`, or regex delimiters this is '
        + '**Exact** — it claims `/health` and nothing else. The **priority** field beside it breaks ties '
        + 'when several rules could answer the same request — the **Path Matching** and **Selection Policy** '
        + 'lessons go deep there.',
      highlight: API_MOCK.ADD_ROUTE,
      preAction: ensureAm01Server,
      action: runAm01AuthorMatch,
      verify: API_MOCK.PATH_KIND,
    },
    {
      id: 'author-response',
      title: 'Author the response: 200 + JSON, then read the preview',
      description:
        'The **Response** tab holds everything a client receives. Instead of typing a status code, click the '
        + '**200** quick chip — the same chips give you 201, 400, 404, 500 for failure testing later. Next '
        + 'a small health payload goes into the body editor; watch the **byte counter** update, which is how '
        + 'you catch an empty response before a client does. Finally the spotlight lands on the right-hand '
        + '**preview**: the real status line, header tally, and formatted body, rendered before anything is '
        + 'running. Reading that pane is the cheapest bug-catch in the Studio.',
      highlight: API_MOCK.BTAB_RESPONSE,
      preAction: ensureAm01Rule,
      action: runAm01AuthorResponse,
      verify: API_MOCK.RESPONSE_PREVIEW,
    },
    {
      id: 'start',
      title: 'Start the listener',
      description:
        '**Start** is the moment the draft becomes a server: the Studio commits your definition as '
        + '**generation 1** and binds the port. Watch the status flip to **Running**, the generation badge '
        + 'appear, and the button swap to **Stop**. From here that address is a real endpoint — anything on '
        + 'your machine can call it, and every later edit stays a draft until you Apply.',
      highlight: API_MOCK.START,
      preAction: ensureAm01Response,
      action: runAm01Start,
      verify: API_MOCK.STOP,
    },
    {
      id: 'send-traffic',
      title: 'Send real traffic and watch it land',
      description:
        'No terminal needed: the demo issues a genuine `GET /health` from the app to the mock and reads the '
        + 'real response — the same request your frontend would make. Watch the **Live strip** transaction '
        + 'counter tick up, then the spotlight clicks it to deep-link into the Runtime journal, where the '
        + 'request appears with method, path, status, and the rule that answered it.',
      highlight: API_MOCK.ADDRESS,
      preAction: ensureAm01Running,
      action: async (ctx) => {
        await runAm01SendTraffic(ctx);
      },
      verify: API_MOCK.JOURNAL_FIRST_ROW,
    },
    {
      id: 'inspect',
      title: 'Read the transaction, copy the cURL',
      description:
        'Click the row to expand it: the detail pane shows the request as received, the response sent, the '
        + '**matched rule**, and the duration. When a request goes to the wrong rule — or to no rule — this '
        + 'pane tells you why, and the **Journal Forensics** lesson turns those misses into rules with one '
        + 'click. The Runtime page also '
        + 'hands you a ready-made **cURL** for this server, so the same call works from a shell or CI.',
      highlight: API_MOCK.JOURNAL_FIRST_ROW,
      preAction: ensureAm01JournalOpen,
      action: runAm01Inspect,
      verify: API_MOCK.TX_DETAIL,
    },
    {
      id: 'stop',
      title: 'Stop and free the port',
      description:
        'Back on Studio, **Stop** drains in-flight connections and releases the port — which matters when '
        + 'you run several mocks or hand the port back to a real service. Your definition is untouched: the '
        + 'rule stays in the workspace, saved across reloads, ready to Start again. That is the whole loop — '
        + 'create, author, start, call, inspect, stop — and every later lesson deepens one beat of it.',
      highlight: API_MOCK.STOP,
      preAction: ensureAm01Stoppable,
      action: runAm01Stop,
      verify: API_MOCK.START,
    },
  ],
};
