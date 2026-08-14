/**
 * AM-17 `am-17-proxy-record` — Proxy Passthrough & Record-to-Drafts.
 *
 * Scenario: the frontend needs `/widgets/42` before that route exists in the
 * mock. Arm unmatched proxy at a Docker echo, record the hop as a draft, then
 * enable the draft so the mock owns the path. Curriculum:
 * `docs/plan/future/apimock/apimock-demo-curriculum-v2.md` §5 Track D.
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
<svg viewBox="0 0 700 430" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Unmatched traffic proxies to an echo, records a draft, then the mock takes over">
  <rect x="0" y="0" width="700" height="430" fill="#0f172a" />

  <text x="26" y="34" fill="#f1f5f9" font-family="system-ui" font-size="16" font-weight="600">Unmatched → proxy → draft → the mock owns the path</text>
  <text x="26" y="54" fill="#64748b" font-family="system-ui" font-size="10">Allowlist · private-net fence · record · closest-match</text>

  <rect x="26" y="72" width="200" height="150" rx="8" fill="#1e293b" stroke="#3b82f6" />
  <text x="42" y="96" fill="#3b82f6" font-family="system-ui" font-size="12" font-weight="600">Blank mock</text>
  <text x="42" y="118" fill="#f1f5f9" font-family="system-ui" font-size="11">No rule for ${AM17_ECHO_PATH}</text>
  <text x="42" y="138" fill="#a8b8cc" font-family="system-ui" font-size="11">Fallback = Proxy</text>
  <text x="42" y="158" fill="#a8b8cc" font-family="system-ui" font-size="11">Allowlist ${AM17_ECHO_ORIGIN}</text>
  <text x="42" y="202" fill="#64748b" font-family="system-ui" font-size="10">Default-deny until listed</text>

  <rect x="248" y="72" width="200" height="150" rx="8" fill="#1e293b" stroke="#f59e0b" />
  <text x="264" y="96" fill="#f59e0b" font-family="system-ui" font-size="12" font-weight="600">Echo upstream</text>
  <text x="264" y="118" fill="#f1f5f9" font-family="ui-monospace" font-size="11">GET ${AM17_ECHO_PATH}</text>
  <text x="264" y="138" fill="#a8b8cc" font-family="system-ui" font-size="11">200 JSON echo body</text>
  <text x="264" y="158" fill="#a8b8cc" font-family="system-ui" font-size="11">Journal outcome: proxied</text>
  <text x="264" y="202" fill="#22c55e" font-family="system-ui" font-size="10">Private fence off for localhost</text>

  <rect x="470" y="72" width="204" height="150" rx="8" fill="#1e293b" stroke="#a78bfa" />
  <text x="486" y="96" fill="#a78bfa" font-family="system-ui" font-size="12" font-weight="600">Draft → live rule</text>
  <text x="486" y="118" fill="#f1f5f9" font-family="system-ui" font-size="11">Disabled draft appears</text>
  <text x="486" y="138" fill="#a8b8cc" font-family="system-ui" font-size="11">Enable + Apply</text>
  <text x="486" y="158" fill="#a8b8cc" font-family="system-ui" font-size="11">Second fetch: matched</text>
  <text x="486" y="202" fill="#22c55e" font-family="system-ui" font-size="10">No second upstream hop</text>

  <rect x="26" y="240" width="648" height="70" rx="8" fill="#1e293b" stroke="#3b4a60" />
  <text x="42" y="268" fill="#f1f5f9" font-family="system-ui" font-size="12" font-weight="600">A proxy inside a mock is an SSRF surface.</text>
  <text x="42" y="290" fill="#a8b8cc" font-family="system-ui" font-size="11">Private nets blocked by default. Auth headers stay off until you opt in. A hop that comes back here is 508 — mocks refuse to proxy themselves.</text>

  <rect x="26" y="328" width="648" height="78" rx="8" fill="#1e293b" stroke="#22c55e" />
  <text x="42" y="356" fill="#22c55e" font-family="system-ui" font-size="12" font-weight="600">Allowlist → Start → proxied call → enable the draft → matched</text>
  <text x="42" y="378" fill="#a8b8cc" font-family="system-ui" font-size="11">Closest-match is the debugging fallback when you would rather explain a miss than forward it.</text>
</svg>
`;

export const apiMockAm17Lesson: DemoLesson = {
  id: 'am-17-proxy-record',
  domainId: 'protocols',
  category: 'api-mock',
  name: 'Proxy Passthrough & Record-to-Drafts',
  description:
    'Open Settings → Proxy and turn unmatched forwarding on. Hold the '
    + 'default-deny note, then allowlist the echo origin. Lower the private-'
    + 'network fence so localhost can answer, opt in to forwarding auth, and '
    + 'set unmatched traffic to Proxy with record-as-drafts. Start, fetch '
    + `\`${AM17_ECHO_PATH}\`, and hold the journal **proxied** row. Enable the `
    + 'new draft, Apply, fetch again — **matched**, no upstream hop. The 508 '
    + 'loop guard and closest-match fallback are the last beat.',
  estimatedMinutes: 8,
  initialTab: 'api-mock-studio',
  contentVersion: 1,
  tag: '🐳 Docker',
  dockerEndpoint: AM17_ECHO_HEALTH,
  dockerCommand: AM17_DOCKER_COMMAND,
  concept: {
    title: 'The fastest mock is a recording of the real thing.',
    body:
      'A blank mock 404s every path you have not authored. That is honest, and '
      + 'it is slow when the frontend already talks to a real service you can '
      + 'reach. **Unmatched proxy** forwards those misses to an allowlisted '
      + 'origin and, with **record drafts**, writes the exchange back as a '
      + 'disabled rule you can edit.\n\n'
      + 'The fence is the point. Proxy is **default-deny** until an origin is '
      + 'listed. **Block private nets** rejects loopback and RFC1918 so a mock '
      + 'cannot become an SSRF trampoline — this lesson turns that fence off '
      + 'only because the echo is local Docker. **Forward auth** stays off '
      + 'until you opt in. A hop that returns here with '
      + '`X-RedfireForge-Mock` is **508**: mocks refuse to proxy themselves.\n\n'
      + 'After the first proxied call, enable the draft and **Apply**. The '
      + 'second fetch is **matched** — the mock owns the path. **Closest-match** '
      + 'is the debugging fallback when you would rather explain a miss than '
      + 'forward it.',
    keyTerms: [
      { term: 'Unmatched proxy', definition: 'When no rule fires, forward the request to an allowlisted upstream instead of returning the static 404.' },
      { term: 'Allowlist', definition: 'Exact origins (scheme + host + optional port). Empty means nothing is forwarded — default-deny.' },
      { term: 'Private-network fence', definition: 'On by default. Rejects loopback, RFC1918, and link-local so the mock cannot probe the LAN.' },
      { term: 'Record drafts', definition: 'A successful proxy becomes a disabled rule with the recorded path and body, ready to enable.' },
      { term: 'Forward auth', definition: 'Off by default. Opt in before Authorization, Cookie, or API keys leave the mock toward upstream.' },
      { term: '508 loop guard', definition: 'If a proxied hop comes back to this mock (header X-RedfireForge-Mock), the listener refuses with 508.' },
      { term: 'Closest-match fallback', definition: 'Unmatched traffic returns a debug body naming the nearest rule instead of proxying or a bare 404.' },
    ],
    diagram: DIAGRAM,
  },
  prepareBeforeNavigate: prepareAm17Workspace,
  cleanup: cleanupAm17,
  steps: [
    {
      id: 'proxy-on',
      title: 'The fastest mock is a recording of the real thing',
      description:
        'Click **Settings**, then the **Proxy** tab. Toggle **Enabled** — unmatched '
        + 'traffic is still not forwarded. Hold the **default-deny** note until it '
        + 'is obvious: an empty allowlist is a closed door.\n\n'
        + `Fill the allowlist with \`${AM17_ECHO_ORIGIN}\` (hostname, not `
        + '`127.0.0.1`). That origin is the Docker echo this lesson records from.',
      highlight: API_MOCK.SETTINGS,
      action: runAm17ProxyOn,
      verify: API_MOCK.SETTINGS_PROXY_ALLOWLIST,
    },
    {
      id: 'proxy-safety',
      title: 'A proxy inside a mock is an SSRF surface',
      description:
        'Hold **Block private nets**. It is on for a reason: loopback and RFC1918 '
        + 'are the classic SSRF targets. This lesson\'s upstream *is* local Docker, '
        + 'so toggle the fence **off** after you have read it.\n\n'
        + 'Then toggle **Forward auth**. Credential headers stay stripped until '
        + 'you opt in — Authorization, Cookie, and API keys do not leak upstream '
        + 'by accident.',
      highlight: API_MOCK.SETTINGS_PROXY_PRIVATE,
      preAction: ensureAm17ForSafety,
      action: runAm17ProxySafety,
      verify: API_MOCK.SETTINGS_PROXY_FORWARD_AUTH,
    },
    {
      id: 'record-and-fallback',
      title: 'Record the hop, and send misses upstream',
      description:
        'Hold **Record drafts**. Successful proxies become **disabled** rules — '
        + 'the mock never starts answering a path you have not reviewed.\n\n'
        + 'Switch to **Selection**. Set **Unmatched mode** to **Proxy to '
        + 'allowlisted upstream**, then **Save settings**. Without this, Enabled '
        + 'on the Proxy tab is armed but idle.',
      highlight: API_MOCK.SETTINGS_PROXY_RECORD,
      preAction: ensureAm17ForRecord,
      action: runAm17RecordAndFallback,
      verify: API_MOCK.START,
    },
    {
      id: 'start',
      title: 'Start with the proxy armed',
      description:
        'Click **Start**. Hold **Running**, then the listen **address**. The '
        + 'listener now owns unmatched traffic: anything without a rule goes to '
        + 'the echo, not a 404.\n\n'
        + 'Generation 1 is the committed snapshot. Later, enabling a draft will '
        + 'need **Apply** to hot-swap that snapshot.',
      highlight: API_MOCK.START,
      preAction: ensureAm17ForStart,
      action: runAm17Start,
      verify: API_MOCK.STATUS_LABEL,
    },
    {
      id: 'proxied-call',
      title: 'A path you never mocked still answers',
      description:
        `Watch the listen address, then fetch \`${AM17_ECHO_PATH}\` — a path this `
        + 'blank server has no rule for. Hold the Live strip as the count ticks.\n\n'
        + 'Open the journal row. The outcome chip is **proxied**, and the response '
        + 'status is the echo\'s 200. That body is what the draft will remember.',
      highlight: API_MOCK.ADDRESS,
      preAction: ensureAm17ForProxiedCall,
      action: async (ctx) => { await runAm17ProxiedCall(ctx); },
      verify: API_MOCK.TX_OUTCOME,
    },
    {
      id: 'draft-appears',
      title: 'The real response becomes a draft rule',
      description:
        'Back on Studio, hold the new **disabled** row. Record-as-drafts wrote '
        + 'the echo exchange into the library without enabling it.\n\n'
        + 'Select the draft and hold the recorded body. That JSON is the echo — '
        + 'method, path, headers — frozen so you can edit before the mock owns it.',
      highlight: API_MOCK.DRAFT_ROUTE,
      preAction: ensureAm17ForDraft,
      action: runAm17DraftAppears,
      verify: API_MOCK.VARIANT_BODY,
    },
    {
      id: 'take-over',
      title: 'Enable the draft and the mock owns the endpoint',
      description:
        'Toggle the draft **enabled**. **Apply** hot-swaps the running snapshot. '
        + `Fetch \`${AM17_ECHO_PATH}\` again.\n\n`
        + 'Hold the new journal row. Outcome is **matched** — no upstream hop. '
        + 'The mock now answers the path it recorded, and the echo is idle.',
      highlight: API_MOCK.ROUTE_ENABLED,
      preAction: ensureAm17ForTakeOver,
      action: runAm17TakeOver,
      verify: API_MOCK.TX_OUTCOME,
    },
    {
      id: 'guards',
      title: 'Mocks refuse to proxy themselves',
      description:
        'Re-open **Settings** → **Proxy**. Hold the **508** loop-guard note. A '
        + 'proxied hop that comes back here with `X-RedfireForge-Mock` is '
        + 'rejected — the mock will not call itself.\n\n'
        + 'Switch to **Selection** and set unmatched mode to **Closest-match '
        + 'debug JSON**. That is the debugging fallback: explain the miss instead '
        + 'of forwarding it.',
      highlight: API_MOCK.SETTINGS,
      preAction: ensureAm17ForGuards,
      action: runAm17Guards,
      verify: API_MOCK.SETTINGS_FALLBACK_MODE,
    },
  ],
};
