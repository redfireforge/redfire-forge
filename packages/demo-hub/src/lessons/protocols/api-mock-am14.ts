/**
 * AM-14 `am-14-timing-faults` — Latency, Eligibility & Connection Faults.
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
<svg viewBox="0 0 700 430" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="A payment mock that waits, expires, and can drop the socket">
  <rect x="0" y="0" width="700" height="430" fill="#0f172a" />

  <text x="26" y="34" fill="#f1f5f9" font-family="system-ui" font-size="16" font-weight="600">Slow, flaky, or gone</text>
  <text x="26" y="54" fill="#64748b" font-family="system-ui" font-size="10">Delay is latency. Eligibility retires a variant. Faults never send a status.</text>

  <rect x="26" y="72" width="318" height="118" rx="8" fill="#1e293b" stroke="#3b82f6" />
  <text x="42" y="96" fill="#3b82f6" font-family="system-ui" font-size="12" font-weight="600">Delay ± jitter</text>
  <text x="42" y="118" fill="#f1f5f9" font-family="ui-monospace" font-size="11">800±200 ms before the body</text>
  <text x="42" y="138" fill="#a8b8cc" font-family="system-ui" font-size="11">Simulate shows virtual delay. Live traffic pays it.</text>
  <text x="42" y="162" fill="#64748b" font-family="system-ui" font-size="10">The journal duration column is the proof.</text>

  <rect x="356" y="72" width="318" height="118" rx="8" fill="#1e293b" stroke="#22c55e" />
  <text x="372" y="96" fill="#22c55e" font-family="system-ui" font-size="12" font-weight="600">Eligibility</text>
  <text x="372" y="118" fill="#f1f5f9" font-family="system-ui" font-size="11">Match limit 1. Then the sibling answers.</text>
  <text x="372" y="138" fill="#a8b8cc" font-family="system-ui" font-size="11">+1h expiry. P=0.5 is deliberate flake.</text>
  <text x="372" y="162" fill="#64748b" font-family="system-ui" font-size="10">The summary line is Limit · Expires · P.</text>

  <rect x="26" y="204" width="318" height="118" rx="8" fill="#1e293b" stroke="#a78bfa" />
  <text x="42" y="228" fill="#a78bfa" font-family="system-ui" font-size="12" font-weight="600">Connection faults</text>
  <text x="42" y="250" fill="#f1f5f9" font-family="system-ui" font-size="11">Timeout holds the socket. Reset / close / malformed drop it.</text>
  <text x="42" y="270" fill="#a8b8cc" font-family="system-ui" font-size="11">No status code. The journal outcome is fault.</text>
  <text x="42" y="294" fill="#64748b" font-family="system-ui" font-size="10">Caught fetches abort so the lesson does not wait an hour.</text>

  <rect x="356" y="204" width="318" height="118" rx="8" fill="#1e293b" stroke="#f59e0b" />
  <text x="372" y="228" fill="#f59e0b" font-family="system-ui" font-size="12" font-weight="600">Dribble + timeline</text>
  <text x="372" y="250" fill="#f1f5f9" font-family="system-ui" font-size="11">+ Chunk twice. Hold the schedule.</text>
  <text x="372" y="270" fill="#a8b8cc" font-family="system-ui" font-size="11">Simulate Trace shows every fault step.</text>
  <text x="372" y="294" fill="#64748b" font-family="system-ui" font-size="10">The timeline is the whole story, not one badge.</text>

  <rect x="26" y="336" width="648" height="70" rx="8" fill="#1e293b" stroke="#22c55e" />
  <text x="42" y="364" fill="#22c55e" font-family="system-ui" font-size="12" font-weight="600">Latency is authored · Eligibility retires a body · Faults never send HTTP</text>
  <text x="42" y="386" fill="#a8b8cc" font-family="system-ui" font-size="11">+1h, + Chunk, and Simulate's virtual delay are the power-user beats. Apply is how live traffic feels them.</text>
</svg>
`;

export const apiMockAm14Lesson: DemoLesson = {
  id: 'am-14-timing-faults',
  domainId: 'protocols',
  category: 'api-mock',
  name: 'Latency, Eligibility & Connection Faults',
  description:
    'Start from a payment rule that already answers POST /payments with a plain '
    + '200. Author delay and jitter, preview the wait in Simulate, then Apply and '
    + 'fetch so the journal duration is real. Limit the paid body to one match so '
    + 'the sibling takes over, set +1h expiry and P=0.5, tour the five fault cards, '
    + 'catch a timeout, prove reset, then dribble chunks and read the fault timeline.',
  estimatedMinutes: 7,
  initialTab: 'api-mock-studio',
  contentVersion: 1,
  concept: {
    title: 'A mock that is slow, retired, or silent is still a contract.',
    body:
      'Clients do not only fail on 500. They hang, they retry a reset socket, they '
      + 'see a first-call-only body vanish. The **Timing** tab is where that contract '
      + `lives. Delay \`${AM14_DELAY}\` with jitter \`${AM14_JITTER}\` makes `
      + `\`POST ${AM14_PATH}\` slow on purpose. **Simulate** draws a virtual-delay `
      + 'badge without waiting; **Apply** plus a live fetch writes ~1s into the '
      + 'journal duration column.\n\n'
      + `**Match limit** \`${AM14_MAX_MATCHES}\` retires **Paid** after one hit so `
      + `**${AM14_VARIANT_FALLBACK}** answers next. **+1h** and **P=${AM14_PROBABILITY}** `
      + 'are the rest of eligibility — time-boxed and deliberately flaky.\n\n'
      + '**Faults** sit below HTTP: timeout never answers, reset/close/malformed '
      + 'drop the socket, dribble emits chunks on a schedule. The journal outcome '
      + 'is **fault**, not a status. Simulate Trace is how you read the whole timeline.',
    keyTerms: [
      { term: 'Delay', definition: 'Fixed milliseconds the listener waits before sending the body. 800 ms is slow enough to see in the journal.' },
      { term: 'Jitter', definition: 'Random ± milliseconds added to delay so two identical calls are not clock-aligned. 200 ms around 800 is 600–1000.' },
      { term: 'Virtual delay', definition: 'Simulate reports the wait it would have paid without blocking the UI. Live traffic still waits.' },
      { term: 'Match limit', definition: 'After N successful matches the variant is ineligible. Limit 1 is the first-call-only flow; a sibling can take over.' },
      { term: 'Expires at', definition: 'A wall-clock timestamp after which the variant is skipped. +1h is the quick chip for a time-boxed mock.' },
      { term: 'Probability', definition: 'A 0–1 gate rolled per request. 0.5 is deliberate flake, not a bug in the matcher.' },
      { term: 'Timeout fault', definition: 'Hold the socket and never complete the response. The hardest client hang to reproduce without a mock.' },
      { term: 'Dribble', definition: 'A connection-level fault: write headers as chunked transfer, then leak the body on a schedule. An empty row is a pause with no bytes — End stream does not flush the rest of the JSON. Simulate Rendered shows the intended body; Trace shows the wire.' },
    ],
    diagram: DIAGRAM,
  },
  prepareBeforeNavigate: prepareAm14Workspace,
  cleanup: cleanupAm14,
  steps: [
    {
      id: 'delay-and-jitter',
      title: 'Resilience testing needs slow, not just 500',
      description:
        'Open **Timing**. Fill **Delay** `800` and hold the field so the number is '
        + 'readable. Fill **Jitter** `200` the same way.\n\n'
        + 'Hold the **spread note**. `800±200 ms` is the wait the client will feel — '
        + `not a status code. This is still \`POST ${AM14_PATH}\`, just slower.`,
      highlight: API_MOCK.RESPONSE_TAB_TIMING,
      preAction: ensureAm14Workspace,
      action: runAm14DelayAndJitter,
      verify: API_MOCK.TIMING_SPREAD,
    },
    {
      id: 'preview-then-prove',
      title: 'Simulate previews latency; live traffic pays it',
      description:
        'Open **Simulate**, fill `POST /payments`, and run. Hold the **virtual-delay** '
        + 'badge — Simulate does not wait a second, it just tells you the wait.\n\n'
        + 'Close Simulate. Click **Apply**, then fetch. Hold **Duration** in the '
        + 'transaction detail, then the journal **duration column**. That ~1s is the '
        + 'same 800±200, paid for real.',
      highlight: API_MOCK.SIMULATE,
      preAction: ensureAm14ForPreview,
      action: runAm14PreviewThenProve,
      verify: API_MOCK.TX_DETAIL_DURATION,
    },
    {
      id: 'max-matches',
      title: 'Retire a variant after N hits',
      description:
        `Fill **Match limit** \`${AM14_MAX_MATCHES}\` on **Paid** and hold the field. `
        + 'Apply, then fetch. Hold the **Paid** card and the 200 in the journal.\n\n'
        + `Fetch again. Hold **${AM14_VARIANT_FALLBACK}** and the 503. The first-call-only `
        + 'body is gone; the sibling took over because the limit was reached, not because '
        + 'the path changed.',
      highlight: API_MOCK.VARIANT_MAX_MATCHES,
      preAction: ensureAm14ForMaxMatches,
      action: runAm14MaxMatches,
      verify: API_MOCK.VARIANT_CARD_LAST,
    },
    {
      id: 'expires-and-probability',
      title: 'Time-boxed and deliberately flaky',
      description:
        'Click **+1h**. Hold the **resolved timestamp** so expiry is a real clock, '
        + 'not a checkbox.\n\n'
        + `Fill **Probability** \`${AM14_PROBABILITY}\`. Hold the **eligibility summary**. `
        + 'Limit, expiry, and P= now read as one sentence: this variant will not answer '
        + 'forever, and even while it is eligible it can still miss on purpose.',
      highlight: API_MOCK.EXPIRES_QUICK_1H,
      preAction: ensureAm14MaxMatches,
      action: runAm14ExpiresAndProbability,
      verify: API_MOCK.ELIGIBILITY_SUMMARY,
    },
    {
      id: 'faults-panel',
      title: 'Faults live below HTTP — no status code involved',
      description:
        'Open **Faults**. The panel is not another status chip. Hold each of the five '
        + 'cards: **Timeout**, **Connection reset**, **Empty / close**, **Malformed**, '
        + 'and **Dribble chunks**.\n\n'
        + 'A fault never sends `200` or `500`. The socket itself is the answer. Hold '
        + 'the **Faults** panel so that distinction sticks before you pick one.',
      highlight: API_MOCK.RESPONSE_TAB_FAULTS,
      preAction: ensureAm14ForFaults,
      action: runAm14FaultsPanel,
      verify: API_MOCK.FAULTS_PANEL,
    },
    {
      id: 'timeout',
      title: 'Hold the socket and never answer',
      description:
        'Click **Timeout / no response**. Apply, then fetch — the client **catches** '
        + 'the hang instead of waiting the safety cap.\n\n'
        + 'Hold outcome **fault** in the transaction detail. There is no status to '
        + 'assert. This is the hardest client bug to reproduce without a mock that '
        + 'can refuse to finish.',
      highlight: API_MOCK.FAULT_TIMEOUT,
      preAction: ensureAm14ForTimeout,
      action: runAm14Timeout,
      verify: API_MOCK.TX_OUTCOME,
    },
    {
      id: 'reset-close-malformed',
      title: 'TCP-level failures retry logic must survive',
      description:
        'Click **Connection reset**. Apply and fetch. Hold the **journal** row — the '
        + 'outcome is still fault, just faster than timeout.\n\n'
        + 'Hold **Empty / close** and **Malformed** so you know they live beside reset. '
        + 'You do not have to fire every one; you have to know where they are when a '
        + 'client retry story needs them.',
      highlight: API_MOCK.FAULT_RESET,
      preAction: ensureAm14ForReset,
      action: runAm14ResetCloseMalformed,
      verify: API_MOCK.TX_OUTCOME,
    },
    {
      id: 'dribble-and-timeline',
      title: 'Drip the body, then read the whole timeline',
      description:
        'Dribble is not a slower 200. It is a **connection-level fault**: the mock writes '
        + 'headers with chunked transfer, then leaks the body in scheduled pieces while the '
        + 'socket stays open. Clients that read until JSON is complete will hang or parse a '
        + 'truncated fragment.\n\n'
        + 'Click **Dribble chunks**. The first row is seeded from the start of the Paid body '
        + '— after 50 ms the client has only `{"ok":tr`. **+ Chunk** twice adds two more rows. '
        + 'Those rows are **empty delays**: they wait, write **zero bytes**, and keep the '
        + 'connection alive. The placeholder is not missing data that gets sent later.\n\n'
        + 'Open **Simulate** and run. **FAULT: dribble** (and the sample **FAIL**) means the '
        + 'outcome is fault, even though the status badge still says 200. **Rendered response** '
        + 'shows the *intended* Paid JSON so you can see what you authored. **Trace** and the '
        + '**fault timeline** are the contract on the wire: headers, the truncated first chunk, '
        + 'the empty gaps, then **End stream**. The rest of the JSON is **not** flushed at the '
        + 'end. Paste remaining characters into a later row only if you want them on the wire.',
      highlight: API_MOCK.FAULT_DRIBBLE,
      preAction: ensureAm14ForDribble,
      action: runAm14DribbleAndTimeline,
      verify: API_MOCK.SIMULATE_TIMELINE_FAULT,
    },
  ],
};
