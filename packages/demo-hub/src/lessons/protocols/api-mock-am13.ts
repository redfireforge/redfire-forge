/**
 * AM-13 `am-13-stateful` — Stateful Mocks: State Machine, Counters & Weighted Chaos.
 *
 * Scenario: a cart rule already answers `POST /cart` with two bodies and no
 * state wiring. State mode, EMPTY → HAS_ITEMS → CHECKED_OUT, a counter, a live
 * fetch pair, Reset + Run all, Weighted 90/10 with a replay seed, and a
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
  AM13_SEED,
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
<svg viewBox="0 0 700 430" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="A cart mock that remembers EMPTY, HAS_ITEMS, and CHECKED_OUT">
  <rect x="0" y="0" width="700" height="430" fill="#0f172a" />

  <text x="26" y="34" fill="#f1f5f9" font-family="system-ui" font-size="16" font-weight="600">The mock remembers</text>
  <text x="26" y="54" fill="#64748b" font-family="system-ui" font-size="10">State mode picks the variant. A counter ticks. Weighted chaos is seeded so it repeats.</text>

  <rect x="26" y="72" width="318" height="118" rx="8" fill="#1e293b" stroke="#3b82f6" />
  <text x="42" y="96" fill="#3b82f6" font-family="system-ui" font-size="12" font-weight="600">State machine</text>
  <text x="42" y="118" fill="#f1f5f9" font-family="ui-monospace" font-size="11">EMPTY  →  HAS_ITEMS  →  CHECKED_OUT</text>
  <text x="42" y="138" fill="#f1f5f9" font-family="ui-monospace" font-size="11">items += 1 on the first hop</text>
  <text x="42" y="162" fill="#64748b" font-family="system-ui" font-size="10">Same POST /cart. Two bodies. The required state decides.</text>

  <rect x="356" y="72" width="318" height="118" rx="8" fill="#1e293b" stroke="#22c55e" />
  <text x="372" y="96" fill="#22c55e" font-family="system-ui" font-size="12" font-weight="600">Live + State tab</text>
  <text x="372" y="118" fill="#f1f5f9" font-family="system-ui" font-size="11">Apply, fetch the empty cart, read the journal.</text>
  <text x="372" y="138" fill="#a8b8cc" font-family="system-ui" font-size="11">HAS_ITEMS and items=1 are on the dock.</text>
  <text x="372" y="162" fill="#64748b" font-family="system-ui" font-size="10">The second fetch is a different answer. Reset rewinds.</text>

  <rect x="26" y="204" width="318" height="118" rx="8" fill="#1e293b" stroke="#a78bfa" />
  <text x="42" y="228" fill="#a78bfa" font-family="system-ui" font-size="12" font-weight="600">Run all samples</text>
  <text x="42" y="250" fill="#f1f5f9" font-family="system-ui" font-size="11">Sequential batch walks the machine virtually.</text>
  <text x="42" y="270" fill="#a8b8cc" font-family="system-ui" font-size="11">Each sample row shows empty → HAS_ITEMS.</text>
  <text x="42" y="294" fill="#64748b" font-family="system-ui" font-size="10">No listener mutation. Close Simulate before Weighted.</text>

  <rect x="356" y="204" width="318" height="118" rx="8" fill="#1e293b" stroke="#f59e0b" />
  <text x="372" y="228" fill="#f59e0b" font-family="system-ui" font-size="12" font-weight="600">Weighted + seed</text>
  <text x="372" y="250" fill="#f1f5f9" font-family="system-ui" font-size="11">90 / 10 on the two cards. Replay seed 4242.</text>
  <text x="372" y="270" fill="#a8b8cc" font-family="system-ui" font-size="11">Run twice. Identical results. Then a secret var.</text>
  <text x="372" y="294" fill="#64748b" font-family="system-ui" font-size="10">Sensitive values mask. Exports never see them.</text>

  <rect x="26" y="336" width="648" height="70" rx="8" fill="#1e293b" stroke="#22c55e" />
  <text x="42" y="364" fill="#22c55e" font-family="system-ui" font-size="12" font-weight="600">State decides the body · Weight decides the dice · Seed makes the dice fair</text>
  <text x="42" y="386" fill="#a8b8cc" font-family="system-ui" font-size="11">+ Counter, Run all samples, and Replay seed are the power-user beats. Reset is how tests start clean.</text>
</svg>
`;

export const apiMockAm13Lesson: DemoLesson = {
  id: 'am-13-stateful',
  domainId: 'protocols',
  category: 'api-mock',
  name: 'Stateful Mocks: State Machine, Counters & Weighted Chaos',
  description:
    'Start from a cart rule that already has two bodies for POST /cart. Switch to '
    + 'State, require EMPTY then HAS_ITEMS, add an items counter, wire the second '
    + 'variant, Apply, and fetch so the journal and the State tab agree. Reset, '
    + 'Run all samples, then switch to Weighted 90/10 with a replay seed so two '
    + 'runs match. Finish by adding a sensitive tenant variable.',
  estimatedMinutes: 7,
  initialTab: 'api-mock-studio',
  contentVersion: 4,
  concept: {
    title: 'A mock that remembers is a state machine, not a second rule.',
    body:
      'A cart that is empty and a cart that has items are the same `POST /cart`, '
      + 'not two paths. **State** mode picks the variant whose **required state** '
      + `matches the live machine. The first hop is \`${AM13_EMPTY}\` → `
      + `\`${AM13_HAS_ITEMS}\` with \`${AM13_COUNTER_KEY} += 1\`. The sibling named `
      + `\`${AM13_VARIANT_2_NAME}\` requires \`${AM13_HAS_ITEMS}\` and advances to `
      + `\`${AM13_CHECKED_OUT}\`.\n\n`
      + 'The **State** tab is how you see `HAS_ITEMS` and `items=1` without '
      + 'guessing. **Reset state** rewinds between tests. **Run all samples** walks '
      + 'the same machine virtually, in order, so each sample row shows the hop.\n\n'
      + '**Weighted** mode is controlled chaos: 90/10 on the two cards, a **replay '
      + `seed** of \`${AM13_SEED}\`, two identical runs. Server variables feed `
      + `templates; mark \`${AM13_VAR_KEY}\` **sensitive** so exports never see it.`,
    keyTerms: [
      { term: 'State mode', definition: 'The enabled variant whose required state matches the live machine wins. The unnamed start is empty until the first hop.' },
      { term: 'Required state', definition: 'The named state a variant is eligible in. EMPTY is how the empty cart answers the first POST /cart.' },
      { term: 'Next state', definition: 'Where the machine moves after that variant fires. HAS_ITEMS then CHECKED_OUT are the rest of the cart life-cycle.' },
      { term: 'Counter', definition: 'A named integer the transition bumps. items += 1 is how you prove the first hop happened without reading the body.' },
      { term: 'Reset state', definition: 'Clears live states and counters without stopping the listener. Tests start clean; the port stays bound.' },
      { term: 'Weighted mode', definition: 'Relative chance among eligible variants. 90/10 is chaos you can still describe in a contract.' },
      { term: 'Replay seed', definition: 'The number Simulation uses instead of a wall-clock seed. The same seed produces the same weighted pick twice.' },
      { term: 'Sensitive variable', definition: 'A server variable whose value is masked in the dock and stripped from exports. tenant = acme is the example.' },
    ],
    diagram: DIAGRAM,
  },
  prepareBeforeNavigate: prepareAm13Workspace,
  cleanup: cleanupAm13,
  steps: [
    {
      id: 'why-state',
      title: 'Real APIs remember: empty cart, then items, then checked out',
      description:
        'Hold the **two variant cards**. An empty cart and a cart that already has '
        + 'a SKU are two answers on one rule — not two paths.\n\n'
        + 'Click **State**. Required state and Next state appear on Selection. Hold '
        + 'those fields. From here the machine, not a JSONPath, decides which body '
        + `fires for \`POST ${AM13_PATH}\`.`,
      highlight: API_MOCK.RESPONSE_MODE_STATE,
      preAction: ensureAm13Workspace,
      action: runAm13WhyState,
      verify: API_MOCK.VARIANT_REQUIRED_STATE,
    },
    {
      id: 'transition',
      title: 'A variant requires a state and moves to the next one',
      description:
        `Fill **Required state** \`${AM13_EMPTY}\` and **Next state** `
        + `\`${AM13_HAS_ITEMS}\`. Hold each field so the hop is readable.\n\n`
        + `**+ Counter** is the power-user beat. Name it \`${AM13_COUNTER_KEY}\` `
        + 'with delta 1. Hold the **counter row**. The first successful POST both '
        + 'answers the empty cart and ticks items.',
      highlight: API_MOCK.COUNTER_ADD,
      preAction: ensureAm13StateMode,
      action: runAm13Transition,
      verify: API_MOCK.COUNTER_ROW,
    },
    {
      id: 'second-variant',
      title: 'The HAS_ITEMS variant answers differently',
      description:
        `Select **${AM13_VARIANT_2_NAME}**. Fill required state \`${AM13_HAS_ITEMS}\` `
        + `and next state \`${AM13_CHECKED_OUT}\` so the machine has a third named `
        + 'state even though only two bodies exist.\n\n'
        + 'Hold the **body**. The second POST is not a 404 and not a second rule — '
        + 'it is the same path after the machine has moved.',
      highlight: API_MOCK.VARIANT_CARD_LAST,
      preAction: ensureAm13Transition,
      action: runAm13SecondVariant,
      verify: API_MOCK.VARIANT_CARD_LAST,
    },
    {
      id: 'first-call',
      title: 'The machine starts in its initial state',
      description:
        'The listener has been running since the first step, still on two unguarded '
        + 'bodies. **Apply** hot-swaps the state machine without a rebind. Hold '
        + '**Generation**.\n\n'
        + `A real \`POST ${AM13_PATH}\` hits the bound listener. Open the journal `
        + 'and hold the **empty-cart** response. That is EMPTY answering, then '
        + 'moving to HAS_ITEMS.',
      highlight: API_MOCK.APPLY,
      preAction: ensureAm13ForApply,
      action: runAm13FirstCall,
      verify: API_MOCK.TX_DETAIL,
    },
    {
      id: 'state-live',
      title: 'The current state and counters are observable',
      description:
        'Open the **State** tab. Hold **live state**: `HAS_ITEMS` and `items=1`. '
        + 'You do not reconstruct the hop from the journal body.\n\n'
        + `Fetch \`POST ${AM13_PATH}\` again. Hold the **different** answer — the `
        + 'Has items body. The machine advanced. The second call is not a flake; '
        + 'it is the next state.',
      highlight: API_MOCK.DOCK_TAB_STATE,
      preAction: ensureAm13StateLive,
      action: runAm13StateLive,
      verify: API_MOCK.DOCK_STATE_LIVE,
    },
    {
      id: 'reset-and-batch',
      title: 'Rewind between tests without restarting',
      description:
        'Click **Reset state**. Hold the **cleared** live panel. The listener stays '
        + 'bound; only the machine rewound.\n\n'
        + '**Run all samples** is the other power-user beat. Sequential batch walks '
        + 'the machine virtually. Hold the **per-sample state** column, then close '
        + 'Simulate so Weighted is not typed behind a modal.',
      highlight: API_MOCK.STATE_RESET,
      preAction: ensureAm13StateLive,
      action: runAm13ResetAndBatch,
      verify: API_MOCK.RESPONSE_MODE_STATE,
    },
    {
      id: 'weighted-and-seed',
      title: 'Controlled chaos, reproducibly',
      description:
        'Click **Weighted**. Fill **Weight** 90 on the empty cart and 10 on Has '
        + 'items. Hold each field. Chaos you can still put in a contract.\n\n'
        + `Fill **Replay seed** \`${AM13_SEED}\` and run twice. Hold the **identical** `
        + 'results. The seed, not the wall clock, picked the variant. Close '
        + 'Simulate before the last step.',
      highlight: API_MOCK.RESPONSE_MODE_WEIGHTED,
      preAction: ensureAm13ForWeighted,
      action: runAm13WeightedAndSeed,
      verify: API_MOCK.RESPONSE_MODE_WEIGHTED,
    },
    {
      id: 'variables',
      title: 'Sensitive variables never reach an export',
      description:
        `**+ Variable** adds a row. Name it \`${AM13_VAR_KEY}\` and set the value `
        + 'to `acme`. Hold the filled row.\n\n'
        + 'Toggle **Sensitive**. Hold the **masked** value. Templates can still '
        + 'resolve it; exports and the dock must not show it in the clear.',
      highlight: API_MOCK.VAR_ADD,
      preAction: ensureAm13Weighted,
      action: runAm13Variables,
      verify: API_MOCK.VAR_VALUE_LAST,
    },
  ],
};
