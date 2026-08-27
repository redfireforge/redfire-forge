/**
 * AM-12 `am-12-variants-sequence` — Response Variants: Rules & Sequence Modes.
 *
 * Scenario: one cart rule already answers `POST /cart` with a single 200. A 404
 * sibling, its JSONPath condition, Default, and sequence mode are authored live.
 * The listener is started quietly so Apply is a hot-swap, not a first Start.
 * Curriculum: API Mock demo curriculum v2 §5 Track C.
 */
import { API_MOCK } from '@shared/selectors';
import type { DemoLesson } from '../../types';
import {
  AM12_JSONPATH,
  AM12_PATH,
  AM12_SKU_MISSING,
  AM12_VARIANT_NAME,
  cleanupAm12,
  ensureAm12Conditions,
  ensureAm12Default,
  ensureAm12ForApply,
  ensureAm12NotFoundVariant,
  ensureAm12StateLive,
  ensureAm12Workspace,
  prepareAm12Workspace,
  runAm12AddVariant,
  runAm12Conditions,
  runAm12Default,
  runAm12ModeBar,
  runAm12ProveRules,
  runAm12Sequence,
  runAm12StateTab,
  runAm12ThreeCalls,
} from './api-mock-am12-helpers';

const DIAGRAM = `
<svg viewBox="0 0 700 430" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="One rule, two variants, two selection modes">
  <rect x="0" y="0" width="700" height="430" fill="#0f172a" />

  <text x="26" y="34" fill="#f1f5f9" font-family="system-ui" font-size="16" font-weight="600">One rule, a set of answers</text>
  <text x="26" y="54" fill="#64748b" font-family="system-ui" font-size="10">Rules pick by condition. Sequence walks the list. The live cursor is on the State tab.</text>

  <rect x="26" y="72" width="318" height="118" rx="8" fill="#1e293b" stroke="#3b82f6" />
  <text x="42" y="96" fill="#3b82f6" font-family="system-ui" font-size="12" font-weight="600">Rules mode</text>
  <text x="42" y="118" fill="#f1f5f9" font-family="ui-monospace" font-size="11">$.sku = MISSING  →  404</text>
  <text x="42" y="138" fill="#f1f5f9" font-family="ui-monospace" font-size="11">anything else     →  200 Default</text>
  <text x="42" y="162" fill="#64748b" font-family="system-ui" font-size="10">Exactly one Default is the fallback.</text>

  <rect x="356" y="72" width="318" height="118" rx="8" fill="#1e293b" stroke="#a78bfa" />
  <text x="372" y="96" fill="#a78bfa" font-family="system-ui" font-size="12" font-weight="600">Sequence mode</text>
  <text x="372" y="118" fill="#f1f5f9" font-family="ui-monospace" font-size="11">call 1  →  200</text>
  <text x="372" y="138" fill="#f1f5f9" font-family="ui-monospace" font-size="11">call 2  →  404   call 3  →  200</text>
  <text x="372" y="162" fill="#64748b" font-family="system-ui" font-size="10">Order is the variant list. Exhaustion cycles.</text>

  <rect x="26" y="204" width="318" height="118" rx="8" fill="#1e293b" stroke="#22c55e" />
  <text x="42" y="228" fill="#22c55e" font-family="system-ui" font-size="12" font-weight="600">Author live</text>
  <text x="42" y="250" fill="#f1f5f9" font-family="system-ui" font-size="11">+ Variant · name · 404 chip</text>
  <text x="42" y="270" fill="#a8b8cc" font-family="system-ui" font-size="11">JSONPath on Selection · Make default</text>
  <text x="42" y="294" fill="#64748b" font-family="system-ui" font-size="10">The corpus ships one 200. Everything else is a click.</text>

  <rect x="356" y="204" width="318" height="118" rx="8" fill="#1e293b" stroke="#f59e0b" />
  <text x="372" y="228" fill="#f59e0b" font-family="system-ui" font-size="12" font-weight="600">Prove both ways</text>
  <text x="372" y="250" fill="#f1f5f9" font-family="system-ui" font-size="11">Simulate the missing SKU, then the happy path.</text>
  <text x="372" y="270" fill="#a8b8cc" font-family="system-ui" font-size="11">Apply, fetch three times, read the State cursor.</text>
  <text x="372" y="294" fill="#64748b" font-family="system-ui" font-size="10">Same POST /cart. Three journal rows. One wrap-around.</text>

  <rect x="26" y="336" width="648" height="70" rx="8" fill="#1e293b" stroke="#22c55e" />
  <text x="42" y="364" fill="#22c55e" font-family="system-ui" font-size="12" font-weight="600">Rules decide by payload · Sequence decides by order</text>
  <text x="42" y="386" fill="#a8b8cc" font-family="system-ui" font-size="11">The 404 chip is the power-user beat. The State tab is how you see the cursor without guessing.</text>
</svg>
`;

export const apiMockAm12Lesson: DemoLesson = {
  id: 'am-12-variants-sequence',
  domainId: 'api-mock',
  category: 'api-mock',
  name: 'Response Variants: Rules & Sequence Modes',
  description:
    'Start from a cart rule that answers POST /cart with a single 200. Add a 404 '
    + 'sibling, name it, and set a JSONPath condition so a missing SKU wins that '
    + 'variant. Mark the 200 as the one Default fallback, prove both answers in '
    + 'Simulate, switch to Sequence, Apply, and fetch the same request three times '
    + 'so the journal wraps around. The State tab shows the live cursor.',
  estimatedMinutes: 7,
  initialTab: 'api-mock-studio',
  contentVersion: 8,
  concept: {
    title: 'A rule holds a set of responses. The mode decides which one fires.',
    body:
      'A mock that always returns 200 cannot represent not-found, retry, or '
      + 'backoff. **Variants** are sibling answers on one rule. **Rules** mode '
      + `picks the first variant whose conditions match — \`${AM12_JSONPATH} = `
      + `${AM12_SKU_MISSING}\` is a 404 — and falls through to the one **Default**. `
      + 'Exactly one enabled Default is required; Make default moves the badge.\n\n'
      + '**Sequence** mode ignores those conditions. Order is the variant list, '
      + 'top to bottom. Exhaustion **cycles**. The same `POST /cart` then answers '
      + '200, 404, 200. Each card’s **Step N of 2** is that playlist slot — it '
      + 'does not move. **Next: Step N of 2** on Selection is one shared cursor '
      + 'for the upcoming call; it flips 1 ↔ 2 after each hit. The **State** tab '
      + 'shows the same number.\n\n'
      + `This lesson starts from \`${AM12_PATH}\` with one 200. **+ Variant**, `
      + `the **404** chip, and naming \`${AM12_VARIANT_NAME}\` are authored live. `
      + 'Simulate proves the payload split before a client asks. Apply hot-swaps '
      + 'the running listener; three fetches write the journal.',
    keyTerms: [
      { term: 'Variant', definition: 'One eligible response owned by a rule. Status, body, and conditions are per variant.' },
      { term: 'Rules mode', definition: 'The first enabled variant whose conditions match wins. If none match, the Default fires.' },
      { term: 'Default', definition: 'The fallback variant in rules mode. Exactly one enabled variant must be Default.' },
      { term: 'Variant condition', definition: 'A predicate group on a non-default variant. JSONPath $.sku = MISSING is how not-found wins.' },
      { term: 'Sequence mode', definition: 'Round-robin over enabled variants in list order. Conditions are cleared. Exhaustion cycles.' },
      { term: 'Sequence position', definition: 'The live “Next: Step N of M” cursor — which variant fires on the next matching call. Not the Step N label on a card. Same number on every variant and on the State tab.' },
      { term: 'Hot Apply', definition: 'Commit the dirty draft to a listener that is already running. Generation bumps; fetches then prove the new mode.' },
    ],
    diagram: DIAGRAM,
  },
  prepareBeforeNavigate: prepareAm12Workspace,
  cleanup: cleanupAm12,
  steps: [
    {
      id: 'one-rule-many-answers',
      title: 'A rule holds a set of responses, chosen by a mode',
      description:
        'The corpus still has **one** variant — that is the problem, not the lesson. '
        + 'Hold the **variant list**. A cart that is empty and a cart that is missing '
        + 'the SKU are two answers, not two rules.\n\n'
        + 'The **mode bar** is how the rule chooses: Rules, Sequence, Weighted, State. '
        + 'Hold **Rules** — it is the default. Everything we author next is a sibling '
        + 'of that one 200, not a second path.',
      highlight: API_MOCK.RESPONSE_MODE_RULES,
      preAction: ensureAm12Workspace,
      action: runAm12ModeBar,
      verify: API_MOCK.RESPONSE_MODE_RULES,
    },
    {
      id: 'add-variant',
      title: 'A 404 sibling for the not-found case',
      description:
        '**+ Variant** adds a card. Name it **Not found** so the list reads like the '
        + 'contract, not Variant 2.\n\n'
        + 'The **404** chip is the power-user beat — it sets the status and the reason '
        + 'phrase together. Hold the new card. Two answers, still one rule.',
      highlight: API_MOCK.ADD_VARIANT,
      preAction: ensureAm12Workspace,
      action: runAm12AddVariant,
      verify: API_MOCK.VARIANT_CARD_LAST,
    },
    {
      id: 'variant-conditions',
      title: 'In rules mode a variant wins on its own conditions',
      description:
        'Open **Selection**. A non-default variant is eligible only when its '
        + 'conditions match. Click **Pick from sample** — that is the power-user '
        + `beat. Select \`${AM12_SKU_MISSING}\` in the cart body so the tool writes `
        + `\`${AM12_JSONPATH}\`, then **Apply JSONPath**.\n\n`
        + 'Hold the **condition chip**. That chip is the sentence the engine evaluates: '
        + 'this 404 fires when the body says the SKU is missing, not when the path '
        + 'happens to be `/cart`.',
      highlight: API_MOCK.SELECTION_CONDITION_TOOLBOX,
      preAction: ensureAm12NotFoundVariant,
      action: runAm12Conditions,
      verify: API_MOCK.SELECTION_CONDITION,
    },
    {
      id: 'default-variant',
      title: 'Exactly one enabled default is the fallback',
      description:
        'Select the original 200 and click **Make default**. The **Default** badge '
        + 'moves with it. Hold the badge, then the note: exactly one enabled variant '
        + 'is the fallback.\n\n'
        + 'If the SKU is anything other than MISSING, this is the answer. Two '
        + 'defaults would be a validation error; zero would leave a matching rule '
        + 'with nothing to return.',
      highlight: API_MOCK.SELECTION_DEFAULT,
      preAction: ensureAm12Conditions,
      action: runAm12Default,
      verify: API_MOCK.VARIANT_DEFAULT_BADGE,
    },
    {
      id: 'prove-rules',
      title: 'Same path, two answers, decided by payload',
      description:
        `**Simulate** a \`POST ${AM12_PATH}\` whose body is `
        + `\`{"sku":"${AM12_SKU_MISSING}"}\`. Open **Rendered response** and hold `
        + 'the **404**. That is variant B.\n\n'
        + 'Run again with a SKU the condition does not claim. **Rendered response** '
        + 'again: **200** and `{"ok":true,"items":[]}`. Same path, two answers, '
        + 'decided by payload — not by a second rule.',
      highlight: API_MOCK.SIMULATE,
      preAction: ensureAm12Default,
      action: runAm12ProveRules,
      verify: API_MOCK.RESPONSE_EDITOR,
    },
    {
      id: 'switch-sequence',
      title: 'Round-robin: the retry and backoff test mode',
      description:
        'Click **Sequence**. Conditions are cleared — order is the variant list, top '
        + 'to bottom.\n\n'
        + '- **Step 1 of 2 / Step 2 of 2** on the cards — playlist slots. In cart is always step 1; Not found is always step 2. Those labels do not move.\n'
        + '- **Next: Step 1 of 2** on Selection — one shared cursor for the *upcoming* call. Open the 404 card: the badge stays **Next: Step 1 of 2**. It is not “this card is step 2.”\n'
        + '- **After a hit** — the cursor becomes **Next: Step 2 of 2**. After another, it wraps to 1. Exhaustion **cycles**.\n\n'
        + 'Two numbers, two jobs: the card is the playlist; **Next** is what fires now.',
      highlight: API_MOCK.RESPONSE_MODE_SEQUENCE,
      preAction: ensureAm12Default,
      action: runAm12Sequence,
      verify: API_MOCK.SEQUENCE_POSITION,
    },
    {
      id: 'three-calls',
      title: 'Same request three times — then it wraps',
      description:
        'The listener has been running since the first step, still on the original '
        + 'single 200. **Apply** hot-swaps sequence without a rebind. Hold '
        + '**Generation**.\n\n'
        +         `A real \`POST ${AM12_PATH}\` hits the bound listener. Open the journal: `
        + '200, then 404, then 200 again. Three rows. After the first hit, '
        + '**Next** flips to **Step 2 of 2**; after the third it is **Step 1** '
        + 'again. That wrap-around is the definition of cycle.',
      highlight: API_MOCK.APPLY,
      preAction: ensureAm12ForApply,
      action: runAm12ThreeCalls,
      verify: API_MOCK.TX_DETAIL,
    },
    {
      id: 'state-tab',
      title: 'The live cursor is visible, not guesswork',
      description:
        'Open the **State** tab on the dock. After three sequence hits the cursor '
        + 'has advanced. Hold the **sequence row** — that is the same **Next: Step N of 2** '
        + 'number Selection showed, not a card’s playlist slot.\n\n'
        + 'You do not reconstruct order from journal statuses. Reset the cursor '
        + 'from this tab when a later lesson needs a clean start.',
      highlight: API_MOCK.DOCK_TAB_STATE,
      preAction: ensureAm12StateLive,
      action: runAm12StateTab,
      verify: API_MOCK.DOCK_SEQ_ROW,
    },
  ],
};
