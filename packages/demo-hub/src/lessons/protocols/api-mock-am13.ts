/**
 * AM-13 `am-13-stateful` — Stateful Mocks: A Cart That Remembers.
 *
 * Helpers are imported as a namespace so Vite HMR cannot leave
 * `runAm13StateLive` / `ensureAm13FirstCall` as unbound names on this path.
 * Curriculum: API Mock demo curriculum v2 §5 Track C.
 */
import { API_MOCK } from '@shared/selectors';
import type { DemoLesson } from '../../types';
import * as am13 from './api-mock-am13-helpers';

const AM13_CHECKED_OUT = am13.AM13_CHECKED_OUT;
const AM13_COUNTER_KEY = am13.AM13_COUNTER_KEY;
const AM13_EMPTY = am13.AM13_EMPTY;
const AM13_HAS_ITEMS = am13.AM13_HAS_ITEMS;
const AM13_PATH = am13.AM13_PATH;
const AM13_VAR_KEY = am13.AM13_VAR_KEY;
const AM13_VARIANT_2_NAME = am13.AM13_VARIANT_2_NAME;

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
  domainId: 'api-mock',
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
  contentVersion: 26,
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
      + '**State** is how one mock picks which body goes out. **Required state** '
      + `is when an answer may speak — \`${AM13_EMPTY}\` for the empty cart, `
      + `\`${AM13_HAS_ITEMS}\` for the SKU. **Next state** is where memory goes `
      + `after. A **counter** named \`${AM13_COUNTER_KEY}\` ticks so the hop is `
      + 'visible without opening JSON. The **State** tab is live memory — '
      + '`HAS_ITEMS`, then `CHECKED_OUT` — not a guess from the last response.\n\n'
      + 'Still on this cart:\n\n'
      + '- **Reset state** — rewind memory for the next test. The server stays up.\n'
      + '- **Weighted** — luck among the two answers. This window repeats the pick, so “random” is still a test.\n'
      + `- **Sensitive** \`${AM13_VAR_KEY}=acme\` — templates can read it; exports never see it in the clear.`,
    keyTerms: [
      { term: 'State', definition: 'The mock picks an answer from what it already remembers — not from a second URL. Same POST /cart, different body after the first hop.' },
      { term: 'Required state', definition: 'When this answer is allowed to speak. EMPTY is the empty cart. HAS_ITEMS is the cart that already has a SKU.' },
      { term: 'Next state', definition: 'Where memory moves after this answer fires. EMPTY becomes HAS_ITEMS. HAS_ITEMS becomes CHECKED_OUT.' },
      { term: 'Counter', definition: 'A number the hop bumps. items += 1 proves the first POST landed without opening the JSON.' },
      { term: 'State tab', definition: 'Live memory on the dock: the current name and the counters. Read HAS_ITEMS, then CHECKED_OUT, here instead of guessing from the last response.' },
      { term: 'Reset state', definition: 'Clears memory and counters. The server stays running, so the next test does not need Restart.' },
      { term: 'Weighted', definition: 'Luck among the two answers — 90 empty, 10 already has a SKU. Simulate repeats the same pick for this window so “random” is still a test.' },
      { term: 'Sensitive variable', definition: 'A server value templates can read (tenant = acme). The dock masks it and exports strip it. The secret stays in the mock.' },
    ],
    diagram: DIAGRAM,
  },
  prepareBeforeNavigate: am13.prepareAm13Workspace,
  cleanup: am13.cleanupAm13,
  steps: [
    {
      id: 'why-state',
      title: 'A real cart is never the same twice',
      description:
        'These two cards are already two lives of the cart — empty, and SKU '
        + '`RF-100`. Today they are just static answers. The mock does not '
        + 'know which life the cart is in.\n\n'
        + '- **State** — the mode that gives those answers memory\n'
        + '- **Required state** — when this body is allowed to speak\n'
        + '- **Next state** — where memory goes after it does\n\n'
        + `Same \`POST ${AM13_PATH}\`. Memory decides which body goes out — not a second URL.`,
      highlight: API_MOCK.RESPONSE_MODE_STATE,
      preAction: (ctx) => am13.ensureAm13Workspace(ctx),
      action: (ctx) => am13.runAm13WhyState(ctx),
      verify: API_MOCK.VARIANT_REQUIRED_STATE,
    },
    {
      id: 'transition',
      title: 'The first POST starts the cart — and leaves a mark',
      description:
        'The empty-cart answer is only honest while the cart is empty.\n\n'
        + `- **Required state** \`${AM13_EMPTY}\` — this body may speak only then\n`
        + `- **Next state** \`${AM13_HAS_ITEMS}\` — memory after it speaks\n`
        + `- **Counter** \`${AM13_COUNTER_KEY}\` — ticks by 1 so the hop is visible without opening JSON\n\n`
        + 'The first successful POST both returns `[]` and leaves that mark.',
      highlight: API_MOCK.COUNTER_ADD,
      preAction: (ctx) => am13.ensureAm13StateMode(ctx),
      action: (ctx) => am13.runAm13Transition(ctx),
      verify: API_MOCK.COUNTER_ROW,
    },
    {
      id: 'second-variant',
      title: 'The next POST must already see the item',
      description:
        `**${AM13_VARIANT_2_NAME}** is the body checkout needs on the *second* `
        + 'call — already a SKU.\n\n'
        + `- **Required state** \`${AM13_HAS_ITEMS}\` — it may speak only after the first hop\n`
        + `- **Next state** \`${AM13_CHECKED_OUT}\` — a third named life, even though there are only two bodies\n`
        + '- **Body** — `RF-100` is what the page was waiting for\n\n'
        + 'The second POST is not a 404 and not a second mock. It is the same path after the cart has moved.',
      highlight: API_MOCK.VARIANT_CARD_LAST,
      preAction: (ctx) => am13.ensureAm13Transition(ctx),
      action: (ctx) => am13.runAm13SecondVariant(ctx),
      verify: API_MOCK.VARIANT_CARD_LAST,
    },
    {
      id: 'first-call',
      title: 'The empty cart answers first',
      description:
        'The listener is already up. **Apply** hot-swaps the new memory onto '
        + 'it — no Restart. **Generation** is the snapshot that just took effect.\n\n'
        + `- **Live \`POST ${AM13_PATH}\`** — the empty-cart body\n`
        + `- **Transactions** — one row. EMPTY spoke.\n`
        + `- **State** — memory is now \`${AM13_HAS_ITEMS}\` and \`${AM13_COUNTER_KEY}=1\`\n\n`
        + 'That is the first life of the cart, on the real port.',
      highlight: API_MOCK.APPLY,
      preAction: (ctx) => am13.ensureAm13ForApply(ctx),
      action: (ctx) => am13.runAm13FirstCall(ctx),
      verify: API_MOCK.DOCK_STATE_LIVE,
    },
    {
      id: 'has-items-hop',
      title: 'Clean slate, then two POSTs walk the cart',
      description:
        'Step 4 left memory and a journal row behind. Start over so the walk is '
        + 'unmistakable — if **Draft changed** is still lit, **Apply** first so the '
        + 'live mock owns the state machine. Then **Reset state** rewinds memory and '
        + '**Clear** empties the journal. Then the same `POST /cart` fires twice:\n\n'
        + `- **First POST** — \`${AM13_EMPTY}\` → \`${AM13_HAS_ITEMS}\` — response \`items: []\`\n`
        + `- **Second POST** — \`${AM13_HAS_ITEMS}\` → \`${AM13_CHECKED_OUT}\` — response includes \`RF-100\`\n`
        + '- **Transactions** — click the arrived-first row (`items: []`), then the arrived-second '
        + 'row (`RF-100`), with the spotlight on each body\n'
        + `- **State** — read \`${AM13_CHECKED_OUT}\` on the dock — not a guess from the last JSON\n\n`
        + 'Totally clear, then two seeds. Both journal answers, then the mark the page was '
        + 'waiting for — not a flake, and not a second URL.',
      highlight: API_MOCK.STATE_RESET,
      preAction: (ctx) => am13.ensureAm13FirstCall(ctx),
      action: (ctx) => am13.runAm13HasItemsHop(ctx),
      verify: API_MOCK.DOCK_STATE_LIVE,
    },
    {
      id: 'reset-and-batch',
      title: 'Rewind the cart without killing the server',
      description:
        'A test that just filled the cart cannot start the next case from dirty memory.\n\n'
        + '- **Reset state** — only the cart rewinds. The server stays up\n'
        + '- **Run all samples** — the same memory walks every saved request, in order\n\n'
        + 'Read the two verdicts in order — both **PASS**, and the per-sample '
        + '**state** column is why:\n\n'
        + `- **First sample** — runs against the freshly-reset cart: \`${AM13_EMPTY}\` → \`${AM13_HAS_ITEMS}\`. It only passes because Reset actually cleared memory\n`
        + `- **Second sample** — inherits that memory and moves on: \`${AM13_HAS_ITEMS}\` → \`${AM13_CHECKED_OUT}\`\n\n`
        + 'That is a suite starting clean and walking one shared memory in order — '
        + 'no Restart, because memory was cleared, not because the process died.',
      highlight: API_MOCK.STATE_RESET,
      preAction: (ctx) => am13.ensureAm13HasItemsHop(ctx),
      action: (ctx) => am13.runAm13ResetAndBatch(ctx),
      verify: API_MOCK.RESPONSE_MODE_STATE,
    },
    {
      id: 'weighted-and-seed',
      title: 'Most of the time empty. Sometimes already a SKU.',
      description:
        'Memory is one job. Chance is another — still these two answers, still no second URL.\n\n'
        + '- **Weighted** — luck among the two bodies: empty cart **90**, already a SKU **10**\n'
        + '- **Apply** — push that luck onto the live listener before you Simulate\n'
        + '- **Two Simulate runs** — after each **Run simulation**, open **Rendered response** and '
        + 'read the same empty-cart body `{"ok":true,"items":[]}`\n'
        + '- **Pinned luck** — this window repeats the draw, so “random” is still a test\n\n'
        + 'You are not flipping a coin in CI. You are pinning luck for the session.',
      highlight: API_MOCK.RESPONSE_MODE_WEIGHTED,
      preAction: (ctx) => am13.ensureAm13ForWeighted(ctx),
      action: (ctx) => am13.runAm13WeightedAndSeed(ctx),
      verify: API_MOCK.RESPONSE_MODE_WEIGHTED,
    },
    {
      id: 'variables',
      title: 'The body reads tenant — the dock keeps the secret',
      description:
        'This cart belongs to a tenant. The name lives once, not in every body.\n\n'
        + `- **\`${AM13_VAR_KEY}=acme\`** — a server variable. Sensitive, so the dock masks it\n`
        + '- **`{{variables.tenant}}`** — the empty-cart body reads that key\n'
        + '- **Preview** — resolves to `acme`. Change the variable later; every template picks it up\n'
        + '- **Exports** — strip the secret. The value never leaves in the clear\n\n'
        + 'The tenant stays on the server. The JSON only names the key.',
      highlight: API_MOCK.VAR_ADD,
      preAction: (ctx) => am13.ensureAm13Weighted(ctx),
      action: (ctx) => am13.runAm13Variables(ctx),
      verify: API_MOCK.PREVIEW_BODY,
    },
  ],
};
