/**
 * AM-14 `am-14-timing-faults` — When Payments Hang: Latency, Eligibility & Connection Faults.
 *
 * Scenario: a payment rule already answers `POST /payments` with a plain 200.
 * Delay + jitter, Simulate's virtual-delay preview vs a live ~1s journal
 * duration, a match-limit fall-through, +1h expiry and P=0.5, the five fault
 * cards, a caught timeout, reset/close/malformed, then dribble chunks and the
 * fault timeline are authored live. The listener is started quietly so Apply
 * is a hot-swap, not a first Start.
 * Curriculum: `docs/plan/future/apimock/apimock-demo-curriculum-v2.md` §5 Track C.
 */
import { API_MOCK } from '@shared/selectors';
import type { DemoLesson } from '../../types';
import {
  AM14_DELAY,
  AM14_JITTER,
  AM14_MAX_MATCHES,
  AM14_PATH,
  AM14_PROBABILITY,
  AM14_VARIANT_FALLBACK,
  cleanupAm14,
  ensureAm14ForDribble,
  ensureAm14ForFaults,
  ensureAm14ForMaxMatches,
  ensureAm14ForPreview,
  ensureAm14ForReset,
  ensureAm14ForTimeout,
  ensureAm14MaxMatches,
  ensureAm14Workspace,
  prepareAm14Workspace,
  runAm14DelayAndJitter,
  runAm14DribbleAndTimeline,
  runAm14ExpiresAndProbability,
  runAm14FaultsPanel,
  runAm14MaxMatches,
  runAm14PreviewThenProve,
  runAm14ResetCloseMalformed,
  runAm14Timeout,
} from './api-mock-am14-helpers';

const DIAGRAM = `
<svg viewBox="0 0 700 430" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="A payment that is slow, used up, expired, or never answers">
  <rect x="0" y="0" width="700" height="430" fill="#0f172a" />

  <text x="26" y="34" fill="#f1f5f9" font-family="system-ui" font-size="16" font-weight="600">Checkout called POST /payments. The bank is not always 200.</text>
  <text x="26" y="54" fill="#64748b" font-family="system-ui" font-size="10">Clients fail on hang, retry, and first-call-only — not only on a 500 body.</text>

  <rect x="26" y="72" width="318" height="118" rx="8" fill="#1e293b" stroke="#3b82f6" />
  <text x="42" y="96" fill="#3b82f6" font-family="system-ui" font-size="12" font-weight="600">1 · The bank is slow</text>
  <text x="42" y="118" fill="#f1f5f9" font-family="system-ui" font-size="11">Same 200. The client waits ~800 ms.</text>
  <text x="42" y="138" fill="#a8b8cc" font-family="system-ui" font-size="11">A little wobble so two calls are not clock-aligned.</text>
  <text x="42" y="162" fill="#64748b" font-family="system-ui" font-size="10">Preview the wait. Live traffic still pays it.</text>

  <rect x="356" y="72" width="318" height="118" rx="8" fill="#1e293b" stroke="#22c55e" />
  <text x="372" y="96" fill="#22c55e" font-family="system-ui" font-size="12" font-weight="600">2 · The offer is used up</text>
  <text x="372" y="118" fill="#f1f5f9" font-family="system-ui" font-size="11">Paid answers once. Then Fallback says retired.</text>
  <text x="372" y="138" fill="#a8b8cc" font-family="system-ui" font-size="11">Not forever. Not every time. A real clock + flake.</text>
  <text x="372" y="162" fill="#64748b" font-family="system-ui" font-size="10">Same URL. The offer changed — the path did not.</text>

  <rect x="26" y="204" width="318" height="118" rx="8" fill="#1e293b" stroke="#a78bfa" />
  <text x="42" y="228" fill="#a78bfa" font-family="system-ui" font-size="12" font-weight="600">3 · The payment never comes back</text>
  <text x="42" y="250" fill="#f1f5f9" font-family="system-ui" font-size="11">Hang. Reset. Close. Garbage framing.</text>
  <text x="42" y="270" fill="#a8b8cc" font-family="system-ui" font-size="11">No status to assert. The socket is the answer.</text>
  <text x="42" y="294" fill="#64748b" font-family="system-ui" font-size="10">This is why retry logic exists.</text>

  <rect x="356" y="204" width="318" height="118" rx="8" fill="#1e293b" stroke="#f59e0b" />
  <text x="372" y="228" fill="#f59e0b" font-family="system-ui" font-size="12" font-weight="600">4 · The body arrives in pieces</text>
  <text x="372" y="250" fill="#f1f5f9" font-family="system-ui" font-size="11">Headers first. Then a fragment. Then silence.</text>
  <text x="372" y="270" fill="#a8b8cc" font-family="system-ui" font-size="11">Clients waiting for complete JSON hang.</text>
  <text x="372" y="294" fill="#64748b" font-family="system-ui" font-size="10">The timeline is the contract — not one badge.</text>

  <rect x="26" y="336" width="648" height="70" rx="8" fill="#1e293b" stroke="#22c55e" />
  <text x="42" y="364" fill="#22c55e" font-family="system-ui" font-size="12" font-weight="600">Slow · Used up · Expired · Silent</text>
  <text x="42" y="386" fill="#a8b8cc" font-family="system-ui" font-size="11">A mock that only returns 200 cannot train a payment client. This lesson is the rest of the bank.</text>
</svg>
`;

export const apiMockAm14Lesson: DemoLesson = {
  id: 'am-14-timing-faults',
  domainId: 'protocols',
  category: 'api-mock',
  name: 'When Payments Hang: Latency, Eligibility & Connection Faults',
  description:
    'Imagine checkout calling POST /payments. A tidy 200 in 2 ms never trains '
    + 'the client: real banks are slow, a capture can be used once, an offer '
    + 'expires, and sometimes nothing comes back at all. This lesson is that '
    + 'other bank — hang, retry, first-call-only — not another status chip.',
  estimatedMinutes: 7,
  initialTab: 'api-mock-studio',
  contentVersion: 6,
  concept: {
    title: 'A payment client fails on hang, retry, and “used up” — not only on 500.',
    body:
      `Picture checkout. It calls **\`POST ${AM14_PATH}\`**. The happy path is a `
      + 'plain 200 and `pay-1001`. That mock is useless for the bugs that '
      + 'actually ship:\n\n'
      + '- The spinner sits there because the bank is **slow**\n'
      + '- The second tap is **rejected** because the capture was one-shot\n'
      + '- The offer is **gone** after an hour, or flakes half the time\n'
      + '- Worse: **no HTTP at all** — hang, reset, garbage on the wire\n\n'
      + 'This lesson is that other bank. **Latency** is still a 200 — the '
      + 'client just waits. **Eligibility** is when Paid is allowed to speak '
      + `(once, until a clock, or only half the time). **Faults** never send `
      + 'a status. The journal says **fault**. There is nothing to assert '
      + 'except “the socket died.”\n\n'
      + 'You will watch the wait without sitting through it, then feel it on '
      + 'a live call. You will see Paid used up so Fallback answers '
      + `**${AM14_VARIANT_FALLBACK}**. You will see a hang that never finishes. `
      + 'Last, a body that arrives in pieces and then stops — the timeline '
      + 'is the contract, not one badge.',
    keyTerms: [
      { term: 'Latency', definition: 'The same 200, later. Delay is the center of the wait. Jitter is a little wobble so two calls are not clock-aligned.' },
      { term: 'Virtual delay', definition: 'A preview of the wait without blocking the UI. Live traffic still pays the real milliseconds.' },
      { term: 'Match limit', definition: 'How many times this answer may succeed. Limit 1 is first-call-only — a coupon, a capture, reserved inventory.' },
      { term: 'Expires at', definition: 'A real clock after which this answer is skipped. The offer is gone; the URL is not.' },
      { term: 'Probability', definition: 'A coin flip while still eligible. 0.5 is deliberate flake — not a matcher bug.' },
      { term: 'Connection fault', definition: 'The socket is the answer. No 200, no 500. Hang, reset, close, or garbage framing.' },
      { term: 'Timeout', definition: 'Hold the connection and never finish. The hardest client hang to reproduce without a mock that can refuse.' },
      { term: 'Dribble', definition: 'Headers first, then fragments on a schedule, then silence. Clients waiting for complete JSON hang or parse a piece. Empty gaps write zero bytes — they are pauses, not “the rest later.”' },
    ],
    diagram: DIAGRAM,
  },
  prepareBeforeNavigate: prepareAm14Workspace,
  cleanup: cleanupAm14,
  steps: [
    {
      id: 'delay-and-jitter',
      title: 'Clients hang on slow — not only on 500',
      description:
        `A payment that returns 200 in 2 ms never exercises timeout or retry. `
        + `Real banks are slow. This step makes \`POST ${AM14_PATH}\` wait on `
        + 'purpose — still the same 200, just later.\n\n'
        + `**Delay** \`${AM14_DELAY}\` is the center of that wait. **Jitter** `
        + `\`${AM14_JITTER}\` is a little wobble so two identical calls are not `
        + 'clock-aligned. Watch **Spread**: that range is what the client will '
        + 'feel. There is no new status code. The bank is just late.',
      highlight: API_MOCK.RESPONSE_TAB_TIMING,
      preAction: ensureAm14Workspace,
      action: runAm14DelayAndJitter,
      verify: API_MOCK.TIMING_SPREAD,
    },
    {
      id: 'preview-then-prove',
      title: 'Preview the wait — then feel it for real',
      description:
        'You should not sit through a second every time you edit. **Simulate** '
        + 'reports the wait without blocking — a preview, not a pause. Live '
        + 'traffic still pays it.\n\n'
        + 'After the mock is saved, one real `POST /payments` writes a '
        + '**duration**. `800` is the center, not a fixed clock. `±200` means '
        + 'each call lands in **600–1000 ms**. **761 ms** (or 640, or 980) is '
        + 'a valid draw — the next call will differ. That number is the same '
        + 'spread, paid for real.',
      highlight: API_MOCK.SIMULATE,
      preAction: ensureAm14ForPreview,
      action: runAm14PreviewThenProve,
      verify: API_MOCK.TX_DETAIL_DURATION,
    },
    {
      id: 'max-matches',
      title: 'The paid answer is allowed once',
      description:
        'Some payments are first-call-only: a capture, a coupon, reserved '
        + `inventory. **Match limit** \`${AM14_MAX_MATCHES}\` retires **Paid** after it succeeds. `
        + 'The next `POST /payments` is the same URL — '
        + `**${AM14_VARIANT_FALLBACK}** answers 503 \`retired\`.\n\n`
        + 'The path did not change. The offer was used up. Watch Paid speak '
        + 'once, then the sibling take over. That is the intention — not a '
        + 'second route.',
      highlight: API_MOCK.VARIANT_MAX_MATCHES,
      preAction: ensureAm14ForMaxMatches,
      action: runAm14MaxMatches,
      verify: API_MOCK.VARIANT_CARD_LAST,
    },
    {
      id: 'expires-and-probability',
      title: 'Not forever, and not every time',
      description:
        'A mock that answers forever is a lie about a flash sale or a flaky '
        + 'processor. **+1h** is a real clock, not a checkbox — after that '
        + `instant, Paid is skipped. **Probability** \`${AM14_PROBABILITY}\` means even while `
        + 'eligible, half the calls miss on purpose.\n\n'
        + 'Watch the **eligibility summary**. Limit, expiry, and P= are one '
        + 'sentence: this answer will not last, and even while it lasts it '
        + 'can still refuse. That flake is the contract, not a matcher bug.',
      highlight: API_MOCK.EXPIRES_QUICK_1H,
      preAction: ensureAm14MaxMatches,
      action: runAm14ExpiresAndProbability,
      verify: API_MOCK.ELIGIBILITY_SUMMARY,
    },
    {
      id: 'faults-panel',
      title: 'Some failures never send HTTP',
      description:
        'A 500 is still a response. Your client can parse it, retry on it, '
        + 'assert it. A hung socket, a reset, a truncated drip — those never '
        + 'give you a status.\n\n'
        + '**Faults** live below HTTP. Five ways the wire can die: **Timeout**, '
        + '**Connection reset**, **Empty / close**, **Malformed**, **Dribble '
        + 'chunks**. The socket itself is the answer. This step is only the '
        + 'map — so the next hang is not mistaken for another status chip.',
      highlight: API_MOCK.RESPONSE_TAB_FAULTS,
      preAction: ensureAm14ForFaults,
      action: runAm14FaultsPanel,
      verify: API_MOCK.FAULTS_PANEL,
    },
    {
      id: 'timeout',
      title: 'The payment never comes back',
      description:
        'The hardest client bug: the request left, the spinner never stops, '
        + 'there is no status. **Timeout** holds the socket and refuses to '
        + 'finish. That is a hang, not a 504.\n\n'
        + 'Watch the journal land on **fault**. There is nothing to assert '
        + 'except “it never completed.” The demo cuts the wait short so you '
        + 'are not sitting through the safety cap — the intention is the hang, '
        + 'not the hour.',
      highlight: API_MOCK.FAULT_TIMEOUT,
      preAction: ensureAm14ForTimeout,
      action: runAm14Timeout,
      verify: API_MOCK.TX_OUTCOME,
    },
    {
      id: 'reset-close-malformed',
      title: 'The wire breaks — retry must survive',
      description:
        'Timeout is a hang. The other three are faster: the socket dies or '
        + 'the framing is garbage. **Connection reset**, **Empty / close**, '
        + 'and **Malformed** are why retry logic exists — not a tidy 500.\n\n'
        + 'Watch reset fire. The journal is still **fault**, just quicker. '
        + 'The other two cards sit beside it so you know where they live when '
        + 'a client story needs them. You do not have to fire every one to '
        + 'understand the family.',
      highlight: API_MOCK.FAULT_RESET,
      preAction: ensureAm14ForReset,
      action: runAm14ResetCloseMalformed,
      verify: API_MOCK.TX_OUTCOME,
    },
    {
      id: 'dribble-and-timeline',
      title: 'The body arrives in pieces — then stops',
      description:
        'Dribble is not a slower 200. Headers go out as chunked transfer, '
        + 'then the body leaks while the socket stays open. Clients that wait '
        + 'for complete JSON hang, or parse a fragment.\n\n'
        + 'The first piece is only `{"ok":tr`. The extra rows are **pauses** — '
        + 'they wait and write **zero bytes**. They are not “the rest of the '
        + 'JSON later.” End stream does not flush what you left untyped.\n\n'
        + '**Rendered** is what you intended. **Trace** is what hit the wire: '
        + 'headers, the truncated chunk, the empty gaps, then stop. That '
        + 'timeline is the contract. A 200 badge on the intended body is not.',
      highlight: API_MOCK.FAULT_DRIBBLE,
      preAction: ensureAm14ForDribble,
      action: runAm14DribbleAndTimeline,
      verify: API_MOCK.SIMULATE_TIMELINE_FAULT,
    },
  ],
};
