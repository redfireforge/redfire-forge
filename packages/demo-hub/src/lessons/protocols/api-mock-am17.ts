/**
 * AM-17 `am-17-proxy-record` — Proxy Passthrough & Record-to-Drafts.
 *
 * Scenario: the frontend needs `/widgets/42` before that route exists in the
 * mock. Arm unmatched proxy at a Docker echo, record the hop as a draft, then
 * enable the draft so the mock owns the path. Curriculum:
 * API Mock demo curriculum v2 §5 Track D.
 */
import { API_MOCK } from '@shared/selectors';
import type { DemoLesson } from '../../types';
import {
  AM17_DOCKER_COMMAND,
  AM17_ECHO_HEALTH,
  AM17_ECHO_ORIGIN,
  AM17_ECHO_PATH,
  cleanupAm17,
  ensureAm17ForDraft,
  ensureAm17ForGuards,
  ensureAm17ForProxiedCall,
  ensureAm17ForRecord,
  ensureAm17ForSafety,
  ensureAm17ForStart,
  ensureAm17ForTakeOver,
  prepareAm17Workspace,
  runAm17DraftAppears,
  runAm17Guards,
  runAm17ProxiedCall,
  runAm17ProxyOn,
  runAm17ProxySafety,
  runAm17RecordAndFallback,
  runAm17Start,
  runAm17TakeOver,
} from './api-mock-am17-helpers';

const DIAGRAM = `
<svg viewBox="0 0 720 470" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Architecture flow: the first request is forwarded to the real server and recorded as a draft; after the draft is enabled the mock answers later requests itself">
  <rect x="0" y="0" width="720" height="470" fill="#0f172a" />
  <defs>
    <marker id="am17arrow" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto">
      <path d="M0,0 L7,3 L0,6 Z" fill="#94a3b8" />
    </marker>
    <marker id="am17arrowMuted" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto">
      <path d="M0,0 L7,3 L0,6 Z" fill="#475569" />
    </marker>
  </defs>

  <text x="24" y="30" fill="#f1f5f9" font-family="system-ui" font-size="16" font-weight="600">How a missing URL gets answered</text>
  <text x="24" y="50" fill="#64748b" font-family="system-ui" font-size="10">First call borrows from the real server and records it — later calls are answered by the mock itself</text>

  <!-- Phase 1 -->
  <text x="24" y="80" fill="#93c5fd" font-family="system-ui" font-size="11" font-weight="600">1 · First call — the mock has no rule, so it borrows the answer</text>

  <rect x="24" y="92" width="120" height="60" rx="8" fill="#1e293b" stroke="#3b82f6" />
  <text x="84" y="118" fill="#3b82f6" font-family="system-ui" font-size="11" font-weight="600" text-anchor="middle">Your app</text>
  <text x="84" y="136" fill="#a8b8cc" font-family="system-ui" font-size="9" text-anchor="middle">makes a request</text>

  <rect x="286" y="92" width="180" height="60" rx="8" fill="#1e293b" stroke="#a78bfa" />
  <text x="376" y="116" fill="#a78bfa" font-family="system-ui" font-size="11" font-weight="600" text-anchor="middle">Mock server</text>
  <text x="376" y="136" fill="#a8b8cc" font-family="ui-monospace" font-size="9" text-anchor="middle">no rule for ${AM17_ECHO_PATH}</text>

  <rect x="576" y="92" width="120" height="60" rx="8" fill="#1e293b" stroke="#f59e0b" />
  <text x="636" y="116" fill="#f59e0b" font-family="system-ui" font-size="11" font-weight="600" text-anchor="middle">Real server</text>
  <text x="636" y="136" fill="#a8b8cc" font-family="ui-monospace" font-size="9" text-anchor="middle">localhost:4017</text>

  <line x1="146" y1="122" x2="282" y2="122" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#am17arrow)" />
  <text x="214" y="114" fill="#cbd5e1" font-family="ui-monospace" font-size="9" text-anchor="middle">GET ${AM17_ECHO_PATH}</text>

  <line x1="468" y1="114" x2="572" y2="114" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#am17arrow)" />
  <text x="520" y="106" fill="#cbd5e1" font-family="system-ui" font-size="9" text-anchor="middle">forwards</text>
  <line x1="572" y1="134" x2="468" y2="134" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#am17arrow)" />
  <text x="520" y="148" fill="#22c55e" font-family="system-ui" font-size="9" text-anchor="middle">200 real answer</text>

  <!-- record branch -->
  <line x1="376" y1="152" x2="376" y2="184" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#am17arrow)" />
  <text x="386" y="172" fill="#cbd5e1" font-family="system-ui" font-size="9">records a copy</text>
  <rect x="286" y="184" width="180" height="40" rx="8" fill="#1e293b" stroke="#22c55e" />
  <text x="376" y="209" fill="#22c55e" font-family="system-ui" font-size="10" font-weight="600" text-anchor="middle">Draft saved (turned off)</text>

  <text x="24" y="212" fill="#64748b" font-family="system-ui" font-size="9">The app still</text>
  <text x="24" y="226" fill="#64748b" font-family="system-ui" font-size="9">gets the real 200.</text>

  <!-- Phase 2 -->
  <text x="24" y="272" fill="#86efac" font-family="system-ui" font-size="11" font-weight="600">2 · After you turn the draft on — the mock answers by itself</text>

  <rect x="24" y="284" width="120" height="60" rx="8" fill="#1e293b" stroke="#3b82f6" />
  <text x="84" y="310" fill="#3b82f6" font-family="system-ui" font-size="11" font-weight="600" text-anchor="middle">Your app</text>
  <text x="84" y="328" fill="#a8b8cc" font-family="system-ui" font-size="9" text-anchor="middle">same request</text>

  <rect x="286" y="284" width="180" height="60" rx="8" fill="#1e293b" stroke="#22c55e" />
  <text x="376" y="308" fill="#22c55e" font-family="system-ui" font-size="11" font-weight="600" text-anchor="middle">Mock server</text>
  <text x="376" y="328" fill="#a8b8cc" font-family="system-ui" font-size="9" text-anchor="middle">rule now exists — matched</text>

  <rect x="576" y="284" width="120" height="60" rx="8" fill="#0f172a" stroke="#334155" stroke-dasharray="4 3" />
  <text x="636" y="310" fill="#475569" font-family="system-ui" font-size="11" font-weight="600" text-anchor="middle">Real server</text>
  <text x="636" y="328" fill="#475569" font-family="system-ui" font-size="9" text-anchor="middle">idle — not called</text>

  <line x1="146" y1="306" x2="282" y2="306" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#am17arrow)" />
  <text x="214" y="298" fill="#cbd5e1" font-family="ui-monospace" font-size="9" text-anchor="middle">GET ${AM17_ECHO_PATH}</text>
  <line x1="282" y1="326" x2="148" y2="326" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#am17arrow)" />
  <text x="214" y="340" fill="#22c55e" font-family="system-ui" font-size="9" text-anchor="middle">answers directly</text>

  <line x1="468" y1="314" x2="572" y2="314" stroke="#475569" stroke-width="1.5" stroke-dasharray="4 3" marker-end="url(#am17arrowMuted)" />
  <text x="520" y="306" fill="#64748b" font-family="system-ui" font-size="9" text-anchor="middle">no trip</text>

  <!-- Guardrails footer -->
  <rect x="24" y="372" width="672" height="72" rx="8" fill="#1e293b" stroke="#3b4a60" />
  <text x="40" y="398" fill="#f1f5f9" font-family="system-ui" font-size="12" font-weight="600">Guardrails that keep forwarding safe</text>
  <text x="40" y="420" fill="#a8b8cc" font-family="system-ui" font-size="11">Only servers on your Allowlist are called · local &amp; private addresses are blocked by default</text>
  <text x="40" y="436" fill="#a8b8cc" font-family="system-ui" font-size="11">Login headers stay off until you opt in · a request that loops back to the mock is refused (508 Loop Detected)</text>
</svg>
`;

export const apiMockAm17Lesson: DemoLesson = {
  id: 'am-17-proxy-record',
  domainId: 'api-mock',
  category: 'api-mock',
  name: 'Proxy Passthrough & Record-to-Drafts',
  description:
    'Open **Settings → Proxy** and turn forwarding on. See why nothing '
    + 'forwards yet, then add the practice server to the **Allowlist**. Turn '
    + 'off the local-address block (our server is on localhost), opt in to '
    + '**Forward auth**, keep **Record drafts** on, and set unmatched requests '
    + `to **Proxy**. Start the server and fetch \`${AM17_ECHO_PATH}\` — a URL `
    + 'you never built. The journal shows **proxied**, and the borrowed answer '
    + 'is saved as a draft. Turn the draft on, **Apply**, and fetch again — now '
    + "it's **matched**, with no trip to the real server. Finish with the two "
    + "safety guards: the mock won't call itself, and **Closest-match** "
    + 'explains a miss instead of forwarding it.',
  estimatedMinutes: 8,
  initialTab: 'api-mock-studio',
  contentVersion: 6,
  tag: '🐳 Docker',
  dockerEndpoint: AM17_ECHO_HEALTH,
  dockerCommand: AM17_DOCKER_COMMAND,
  concept: {
    title: 'Let the mock borrow answers from the real server — then keep them.',
    body:
      'A brand-new mock has no rules yet, so every URL your app asks for comes '
      + 'back as **404 Not Found**. That is honest, but it blocks you while you '
      + 'build. **Proxy** fixes this: when the mock has no rule for a URL, it '
      + 'quietly forwards the request to a real server you trust, hands the real '
      + 'answer back to your app, and — with **Record drafts** — saves a copy '
      + 'as a turned-off rule you can review later.\n\n'
      + 'Forwarding requests is powerful, so it stays locked down by default. '
      + 'The mock only forwards to servers on your **Allowlist** — an empty list '
      + 'forwards nothing. **Block private nets** stops the mock from reaching '
      + 'your own machine or internal network; we switch it off in this lesson '
      + 'only because our practice server runs right here on localhost. '
      + '**Forward auth** keeps login headers (tokens, cookies, API keys) from '
      + 'leaking to the real server unless you opt in.\n\n'
      + 'After that first borrowed answer, you review the saved draft, switch '
      + 'it **on**, and click **Apply**. Now the mock has its own rule, so the '
      + 'same request is answered instantly by the mock — it never contacts the '
      + 'real server again.\n\n'
      + 'Two safety nets round things out. **The mock never calls itself:** if a '
      + 'forwarded request somehow points back at this same mock, it would '
      + 'forward forever — so the mock stops it with a **508 Loop Detected** '
      + 'error (the HTTP status that means "a request looped back on itself") instead. '
      + 'And if you would rather *not* forward a miss at all, switch to '
      + '**Closest-match** mode: instead of a blank "Not Found", the mock replies '
      + 'with a short note saying which rule your request *almost* matched, so a '
      + 'typo in the path is easy to spot.',
    keyTerms: [
      { term: 'Proxy (forward on miss)', definition: 'When the mock has no rule for a URL, it forwards the request to a real server instead of returning 404.' },
      { term: 'Allowlist', definition: 'The ordered list of real servers the mock may forward to. It tries them top to bottom, moving to the next line only if a server is unreachable or replies 5xx / 404. An empty list forwards nothing.' },
      { term: 'Block private nets', definition: 'A safety switch, on by default, that stops the mock reaching your own computer or internal network. We turn it off only because the practice server is on localhost.' },
      { term: 'Record drafts', definition: 'Every forwarded answer is saved as a turned-off rule with the real path and body — ready for you to review and enable.' },
      { term: 'Forward auth', definition: 'Off by default. Only when you opt in are login headers (Authorization, Cookie, API keys) passed to the real server.' },
      { term: "No self-calls (508 Loop Detected)", definition: 'If a forwarded request loops back to this same mock, it is rejected with HTTP 508 — the "Loop Detected" status that means a request came back on itself. The mock will not call itself.' },
      { term: 'Closest-match', definition: 'Instead of forwarding a miss, return a debug message naming the rule the request most likely meant.' },
    ],
    diagram: DIAGRAM,
  },
  prepareBeforeNavigate: prepareAm17Workspace,
  cleanup: cleanupAm17,
  steps: [
    {
      id: 'proxy-on',
      title: 'A new mock says "Not Found" to everything',
      description:
        'Open **Settings**, then the **Proxy** tab. Flip **Enabled** on — but '
        + 'notice the app reminds you that nothing is forwarded yet. That is on '
        + 'purpose: forwarding stays off until you name a server to forward to.\n\n'
        + `In the **Allowlist** box, add \`${AM17_ECHO_ORIGIN}\` — the practice `
        + 'server this lesson borrows answers from. Use the name `localhost`, not '
        + '`127.0.0.1`. If you ever list several servers, the mock tries them '
        + 'top to bottom until one answers.',
      highlight: API_MOCK.SETTINGS,
      action: runAm17ProxyOn,
      verify: API_MOCK.SETTINGS_PROXY_ALLOWLIST,
    },
    {
      id: 'proxy-safety',
      title: 'Two safety switches before you forward anything',
      description:
        'Look at **Block private nets**. It is on by default so a mock can never '
        + 'be tricked into reaching your own computer or internal network. Our '
        + 'practice server *is* on this machine, so — just for this lesson — '
        + 'switch it **off**.\n\n'
        + 'Now flip **Forward auth** on. Normally the mock strips login headers '
        + '(tokens, cookies, API keys) so they never leak to the real server. '
        + 'Turn it on only when the real server actually needs them.',
      highlight: API_MOCK.SETTINGS_PROXY_PRIVATE,
      preAction: ensureAm17ForSafety,
      action: runAm17ProxySafety,
      verify: API_MOCK.SETTINGS_PROXY_FORWARD_AUTH,
    },
    {
      id: 'record-and-fallback',
      title: 'Save every borrowed answer as a draft',
      description:
        'Check **Record drafts**. Each answer the mock borrows is saved as a '
        + '**turned-off** rule — so the mock never starts answering a URL you '
        + 'have not looked at yet.\n\n'
        + 'Switch to the **Selection** tab and set **Unmatched mode** to '
        + '**Proxy to allowlisted upstream**, then **Save**. This is the switch '
        + 'that actually sends unmatched requests to the real server.',
      highlight: API_MOCK.SETTINGS_PROXY_RECORD,
      preAction: ensureAm17ForRecord,
      action: runAm17RecordAndFallback,
      verify: API_MOCK.START,
    },
    {
      id: 'start',
      title: 'Start the mock server',
      description:
        'Click **Start** and watch the status flip to **Running**, then read the '
        + 'listen **address** below it. From now on, any URL without a rule is '
        + 'forwarded to the practice server instead of returning Not Found.\n\n'
        + 'Later, when you turn a draft on, you will press **Apply** to push that '
        + 'change into the running server.',
      highlight: API_MOCK.START,
      preAction: ensureAm17ForStart,
      action: runAm17Start,
      verify: API_MOCK.STATUS_LABEL,
    },
    {
      id: 'proxied-call',
      title: 'A URL you never built still answers',
      description:
        `The app now fetches \`${AM17_ECHO_PATH}\` — a URL this blank mock has no `
        + 'rule for. Watch the **Live** strip as the request count ticks up.\n\n'
        + 'Open the newest row in the journal. The outcome says **proxied** and '
        + "the status is the real server's **200**. That real answer is exactly "
        + 'what the draft will remember.',
      highlight: API_MOCK.ADDRESS,
      preAction: ensureAm17ForProxiedCall,
      action: async (ctx) => { await runAm17ProxiedCall(ctx); },
      verify: API_MOCK.TX_OUTCOME,
    },
    {
      id: 'draft-appears',
      title: 'The real answer is now a draft rule',
      description:
        'Back in the Studio list, a new **turned-off** rule has appeared — the '
        + 'mock recorded the borrowed answer without switching it on.\n\n'
        + 'Select the draft and look at its saved **body**. That JSON is the real '
        + "server's answer — method, path, and all — frozen so you can edit it "
        + 'before the mock takes over.',
      highlight: API_MOCK.DRAFT_ROUTE,
      preAction: ensureAm17ForDraft,
      action: runAm17DraftAppears,
      verify: API_MOCK.VARIANT_BODY,
    },
    {
      id: 'take-over',
      title: 'Turn the draft on and the mock takes over',
      description:
        'Flip the draft **on**, then press **Apply** to push it into the running '
        + `server. The app fetches \`${AM17_ECHO_PATH}\` again.\n\n`
        + 'Open the new journal row: the outcome now says **matched** — the mock '
        + 'answered it directly and never touched the real server.',
      highlight: API_MOCK.ROUTE_ENABLED,
      preAction: ensureAm17ForTakeOver,
      action: runAm17TakeOver,
      verify: API_MOCK.TX_OUTCOME,
    },
    {
      id: 'guards',
      title: 'Two safety nets when a request has no rule',
      description:
        'Re-open **Settings → Proxy** and read the note at the bottom. It '
        + 'answers a "what if?": what if the mock forwarded a request to an '
        + 'address that pointed right back at the mock? It would forward forever. '
        + 'To stop that, the mock tags every request it sends — and if that tag '
        + 'ever comes back, it refuses with a **508 Loop Detected** error — the '
        + 'HTTP status that literally means "this request looped back on itself." '
        + 'In short: **the mock never calls itself.**\n\n'
        + 'Now switch to the **Selection** tab and change **Unmatched mode** to '
        + '**Closest-match debug JSON**. This changes what happens when no rule '
        + 'matches: instead of forwarding to the real server, the mock replies '
        + 'with a short note naming the rule your request *came closest* to — '
        + `perfect for catching a typo like \`/widget/42\` instead of `
        + `\`${AM17_ECHO_PATH}\`, right inside the app.`,
      highlight: API_MOCK.SETTINGS,
      preAction: ensureAm17ForGuards,
      action: runAm17Guards,
      verify: API_MOCK.SETTINGS_FALLBACK_MODE,
    },
  ],
};
