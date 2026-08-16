/**
 * AM-13 `am-13-stateful` — Stateful Mocks: A Cart That Remembers.
 *
 * Scenario: a cart rule already answers `POST /cart` with two bodies and no
 * state wiring. State mode, EMPTY → HAS_ITEMS → CHECKED_OUT, a counter, a live
 * fetch pair, Reset + Run all, Weighted 90/10 (two identical Simulate runs), and a
 * sensitive variable are authored live. The listener is started quietly so
 * Apply is a hot-swap, not a first Start.
 * Curriculum: `docs/plan/future/apimock/apimock-demo-curriculum-v2.md` §5 Track C.
 */
import { API_MOCK } from '@shared/selectors';
import type { DemoLesson } from '../../types';
import {
  AM13_CHECKED_OUT,
  AM13_COUNTER_KEY,
  AM13_EMPTY,
  AM13_HAS_ITEMS,
  AM13_PATH,
  AM13_VAR_KEY,
  AM13_VARIANT_2_NAME,
  cleanupAm13,
  ensureAm13ForApply,
  ensureAm13ForWeighted,
  ensureAm13StateLive,
  ensureAm13StateMode,
  ensureAm13Transition,
  ensureAm13Weighted,
  ensureAm13Workspace,
  prepareAm13Workspace,
  runAm13FirstCall,
  runAm13ResetAndBatch,
  runAm13SecondVariant,
  runAm13StateLive,
  runAm13Transition,
  runAm13Variables,
  runAm13WeightedAndSeed,
  runAm13WhyState,
} from './api-mock-am13-helpers';

const DIAGRAM = `
<svg viewBox="0 0 700 430" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Checkout calls POST /cart twice. First empty, then a SKU, because the mock remembers">
  <rect x="0" y="0" width="700" height="430" fill="#0f172a" />

  <text x="26" y="34" fill="#f1f5f9" font-family="system-ui" font-size="16" font-weight="600">Imagine checkout. Same URL. Two lives of the cart.</text>
  <text x="26" y="54" fill="#64748b" font-family="system-ui" font-size="10">A static mock always returns the same JSON. The page never leaves empty. Memory is the point of this lesson.</text>

  <rect x="26" y="72" width="318" height="118" rx="8" fill="#1e293b" stroke="#3b82f6" />
  <text x="42" y="96" fill="#3b82f6" font-family="system-ui" font-size="12" font-weight="600">1 · First POST /cart</text>
  <text x="42" y="118" fill="#f1f5f9" font-family="ui-monospace" font-size="11">{"ok":true,"items":[]}</text>
  <text x="42" y="138" fill="#a8b8cc" font-family="system-ui" font-size="11">Allowed only while EMPTY · then HAS_ITEMS</text>
  <text x="42" y="162" fill="#64748b" font-family="system-ui" font-size="10">items ticks to 1 — the hop you can see without JSON.</text>

  <rect x="356" y="72" width="318" height="118" rx="8" fill="#1e293b" stroke="#22c55e" />
  <text x="372" y="96" fill="#22c55e" font-family="system-ui" font-size="12" font-weight="600">2 · Same POST /cart again</text>
  <text x="372" y="118" fill="#f1f5f9" font-family="ui-monospace" font-size="11">{"items":[{"sku":"RF-100"}]}</text>
  <text x="372" y="138" fill="#a8b8cc" font-family="system-ui" font-size="11">Allowed only while HAS_ITEMS · State tab proves it</text>
  <text x="372" y="162" fill="#64748b" font-family="system-ui" font-size="10">Not a flake. Not a second URL. The cart moved.</text>

  <rect x="26" y="204" width="318" height="118" rx="8" fill="#1e293b" stroke="#a78bfa" />
  <text x="42" y="228" fill="#a78bfa" font-family="system-ui" font-size="12" font-weight="600">3 · Rewind for the next test</text>
  <text x="42" y="250" fill="#f1f5f9" font-family="system-ui" font-size="11">Reset state empties memory. The server stays up.</text>
  <text x="42" y="270" fill="#a8b8cc" font-family="system-ui" font-size="11">Run all samples walks that same cart in order.</text>
  <text x="42" y="294" fill="#64748b" font-family="system-ui" font-size="10">The next case starts clean. No Restart.</text>

  <rect x="356" y="204" width="318" height="118" rx="8" fill="#1e293b" stroke="#f59e0b" />
  <text x="372" y="228" fill="#f59e0b" font-family="system-ui" font-size="12" font-weight="600">4 · Chance, then a tenant secret</text>
  <text x="372" y="250" fill="#f1f5f9" font-family="system-ui" font-size="11">Weighted 90 / 10 — luck among the two answers.</text>
  <text x="372" y="270" fill="#a8b8cc" font-family="system-ui" font-size="11">Run twice. Same pick. tenant=acme stays masked.</text>
  <text x="372" y="294" fill="#64748b" font-family="system-ui" font-size="10">Exports never see the secret in the clear.</text>

  <rect x="26" y="336" width="648" height="70" rx="8" fill="#1e293b" stroke="#22c55e" />
  <text x="42" y="364" fill="#22c55e" font-family="system-ui" font-size="12" font-weight="600">Remember · Watch it move · Rewind · Then roll the dice</text>
  <text x="42" y="386" fill="#a8b8cc" font-family="system-ui" font-size="11">One mock. Two answers. The second POST is different only because the first one happened.</text>
</svg>
`;

export const apiMockAm13Lesson: DemoLesson = {
  id: 'am-13-stateful',
  domainId: 'protocols',
  category: 'api-mock',
  name: 'Stateful Mocks: A Cart That Remembers',
  description:
    'Imagine a checkout page. It calls POST /cart twice — first the cart is '
    + 'empty, then the same URL must already show a SKU. A normal mock cannot '
    + 'do that: it always returns the same JSON, so the page never leaves '
    + 'empty. This lesson gives the mock that memory, lets you rewind it for '
    + 'the next test, then shows chance among the two answers and a tenant '
    + 'secret that never leaves the server.',
  estimatedMinutes: 7,
  initialTab: 'api-mock-studio',
  contentVersion: 8,
  concept: {
    title: 'Same POST /cart. Empty the first time. Full the second.',
    body:
      'Picture a checkout page you are building. It does not have two URLs. '
      + `It hits **\`POST ${AM13_PATH}\` twice** and expects two different lives `
      + 'of the same cart:\n\n'
      + '1. First call — empty: `{"ok":true,"items":[]}`\n'
      + '2. Second call — already a SKU: `{"ok":true,"items":[{"sku":"RF-100"}]}`\n\n'
      + 'A mock that always returns the same JSON is fine for `/health`. It is '
      + 'useless here. If both answers are hard-coded, the page never leaves '
      + 'empty. **The mock has to remember that the first call happened.** '
      + 'That memory is what this lesson is for.\n\n'
      + 'You will put those two answers on **one** mock. Click **State**. '
      + '**Required state** is “when may this answer speak” — '
      + `\`${AM13_EMPTY}\` for the empty cart, \`${AM13_HAS_ITEMS}\` for the `
      + 'SKU. **Next state** is “where memory goes after.” A **counter** named '
      + `\`${AM13_COUNTER_KEY}\` ticks so you can see the hop without opening `
      + 'JSON. Save with **Apply**, then send two real POSTs. The **State** '
      + 'tab shows `HAS_ITEMS` and `items=1` — you do not guess from the last '
      + 'response.\n\n'
      + 'Checkout also needs three more things, still on this cart:\n\n'
      + '- **Reset state** — rewind memory for the next test. The server stays up.\n'
      + '- **Weighted** — luck among the two answers (90 / 10). Run twice; the pick repeats, so it is a test, not a coin flip.\n'
      + `- **Sensitive** \`${AM13_VAR_KEY}=acme\` — templates can read it; exports never see it in the clear.`,
    keyTerms: [
      { term: 'State', definition: 'The mock picks an answer from what it already remembers — not from a second URL. Same POST /cart, different body after the first hop.' },
      { term: 'Required state', definition: 'When this answer is allowed to speak. EMPTY is the empty cart. HAS_ITEMS is the cart that already has a SKU.' },
      { term: 'Next state', definition: 'Where memory moves after this answer fires. EMPTY becomes HAS_ITEMS. HAS_ITEMS becomes CHECKED_OUT.' },
      { term: 'Counter', definition: 'A number the hop bumps. items += 1 proves the first POST landed without opening the JSON.' },
      { term: 'State tab', definition: 'Live memory on the dock: the current name and the counters. Read HAS_ITEMS here instead of guessing from the last response.' },
      { term: 'Reset state', definition: 'Clears memory and counters. The server stays running, so the next test does not need Restart.' },
      { term: 'Weighted', definition: 'Luck among the two answers — 90 empty, 10 already has a SKU. Simulate repeats the same pick for this window so “random” is still a test.' },
      { term: 'Sensitive variable', definition: 'A server value templates can read (tenant = acme). The dock masks it and exports strip it. The secret stays in the mock.' },
    ],
    diagram: DIAGRAM,
  },
  prepareBeforeNavigate: prepareAm13Workspace,
  cleanup: cleanupAm13,
  steps: [
    {
      id: 'why-state',
      title: 'A real cart is never the same twice',
      description:
        'This is the problem, not the solution yet.\n\n'
        + '- Look at the **two cards** on the left\n'
        + '- One body is an empty cart. The other already has SKU `RF-100`\n'
        + '- Today they are just two static answers — the mock does not know which life the cart is in\n'
        + '- Click **State** on the mode bar\n'
        + '- **Required state** and **Next state** appear. Hold those fields\n\n'
        + `From here the mock remembers. Same \`POST ${AM13_PATH}\`. Memory decides which body goes out — not a second URL.`,
      highlight: API_MOCK.RESPONSE_MODE_STATE,
      preAction: ensureAm13Workspace,
      action: runAm13WhyState,
      verify: API_MOCK.VARIANT_REQUIRED_STATE,
    },
    {
      id: 'transition',
      title: 'The first POST starts the cart — and leaves a mark',
      description:
        'Wire the empty-cart answer so the first call can start the story.\n\n'
        + `- **Required state** = \`${AM13_EMPTY}\` — this body may speak only while the cart is empty\n`
        + `- **Next state** = \`${AM13_HAS_ITEMS}\` — after it speaks, memory moves\n`
        + '- Hold each field so the hop is readable\n'
        + `- Click **+ Counter**, name it \`${AM13_COUNTER_KEY}\`, delta 1\n`
        + '- Hold the **counter row**\n\n'
        + 'The first successful POST both returns `[]` and ticks items to 1. That tick is how you see the hop without opening JSON.',
      highlight: API_MOCK.COUNTER_ADD,
      preAction: ensureAm13StateMode,
      action: runAm13Transition,
      verify: API_MOCK.COUNTER_ROW,
    },
    {
      id: 'second-variant',
      title: 'The next POST must already see the item',
      description:
        'Now the body the checkout page needs on the *second* call.\n\n'
        + `- Select **${AM13_VARIANT_2_NAME}**\n`
        + `- **Required state** = \`${AM13_HAS_ITEMS}\` — it may speak only after the first hop\n`
        + `- **Next state** = \`${AM13_CHECKED_OUT}\` — a third named life, even though there are only two bodies\n`
        + '- Hold the **body** — that is the SKU the page was waiting for\n\n'
        + 'The second POST is not a 404 and not a second mock. It is the same path after the cart has moved.',
      highlight: API_MOCK.VARIANT_CARD_LAST,
      preAction: ensureAm13Transition,
      action: runAm13SecondVariant,
      verify: API_MOCK.VARIANT_CARD_LAST,
    },
    {
      id: 'first-call',
      title: 'Send it once — the empty cart answers',
      description:
        'The mock server is already running. We only need to save the memory onto it.\n\n'
        + '- Click **Apply** — no Restart\n'
        + '- Hold **Generation** so you see the new snapshot take effect\n'
        + `- A real \`POST ${AM13_PATH}\` hits the port\n`
        + '- Open the traffic list and hold the **empty-cart** response\n\n'
        + 'That is EMPTY speaking, then stepping to HAS_ITEMS.',
      highlight: API_MOCK.APPLY,
      preAction: ensureAm13ForApply,
      action: runAm13FirstCall,
      verify: API_MOCK.TX_DETAIL,
    },
    {
      id: 'state-live',
      title: 'Send it again — now there is a line item',
      description:
        'Do not reconstruct the hop from the last JSON. Read memory itself.\n\n'
        + '- Open the **State** tab on the dock\n'
        + '- Hold **live state**: `HAS_ITEMS` and `items=1`\n'
        + `- Send \`POST ${AM13_PATH}\` again\n`
        + '- Hold the **different** answer — the Has items body\n\n'
        + 'The second call is not a flake. The cart moved. That is what the checkout page was waiting for.',
      highlight: API_MOCK.DOCK_TAB_STATE,
      preAction: ensureAm13StateLive,
      action: runAm13StateLive,
      verify: API_MOCK.DOCK_STATE_LIVE,
    },
    {
      id: 'reset-and-batch',
      title: 'Rewind the cart without killing the server',
      description:
        'A test that just filled the cart cannot start the next case from dirty memory.\n\n'
        + '- Click **Reset state**\n'
        + '- Hold the **cleared** panel — only the cart rewound; the server stays up\n'
        + '- Open **Simulate**, then **Run all samples**\n'
        + '- Hold the **per-sample state** column — the same memory walks every saved request in order\n'
        + '- **Close** so the next step is not typed behind the window\n\n'
        + 'That is how a suite starts clean without Restart.',
      highlight: API_MOCK.STATE_RESET,
      preAction: ensureAm13StateLive,
      action: runAm13ResetAndBatch,
      verify: API_MOCK.RESPONSE_MODE_STATE,
    },
    {
      id: 'weighted-and-seed',
      title: 'Most of the time empty. Sometimes already a SKU.',
      description:
        'Memory is one job. Chance is another — still on these two answers, still no second URL.\n\n'
        + '- Click **Weighted**\n'
        + '- Empty cart **90**, Has items **10**. Hold each field\n'
        + '- **Run simulation** twice\n'
        + '- Hold the **identical** results — this window repeats the pick, so “random” is still a test\n'
        + '- **Close** Simulate before the last step\n\n'
        + 'You are not flipping a coin in CI. You are pinning luck for the session.',
      highlight: API_MOCK.RESPONSE_MODE_WEIGHTED,
      preAction: ensureAm13ForWeighted,
      action: runAm13WeightedAndSeed,
      verify: API_MOCK.RESPONSE_MODE_WEIGHTED,
    },
    {
      id: 'variables',
      title: 'The tenant stays in the mock — never in the export',
      description:
        'This cart belongs to a tenant. The name should live once, not in every body.\n\n'
        + `- Click **+ Variable**\n`
        + `- Name it \`${AM13_VAR_KEY}\`, value \`acme\`. Hold the filled row\n`
        + '- Toggle **Sensitive**\n'
        + '- Hold the **masked** value\n\n'
        + 'Templates can still read it. The dock hides it. Exports strip it. The secret stays on the server.',
      highlight: API_MOCK.VAR_ADD,
      preAction: ensureAm13Weighted,
      action: runAm13Variables,
      verify: API_MOCK.VAR_VALUE_LAST,
    },
  ],
};
