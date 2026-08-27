/**
 * AM-06 `am-06-body-matching` — Subset, Strict, JSONPath & JSON Schema.
 *
 * Scenario: one `POST /orders` rule with a forgiving `json_subset` baseline. The corpus is
 * the *starting point*; strict equality, a JSONPath matcher picked out of a sample payload,
 * the match-style toggle, and a JSON Schema contract are all authored live and proven in
 * Simulate. Curriculum: API Mock demo curriculum v2 §5 Track B.
 */
import { API_MOCK } from '@shared/selectors';
import type { DemoLesson } from '../../types';
import {
  AM06_JSONPATH,
  AM06_RULE_METHOD,
  AM06_RULE_PATH,
  AM06_SCHEMA_PRESET,
  AM06_SKU,
  AM06_SKU_FAMILY,
  cleanupAm06,
  ensureAm06JsonPathCondition,
  ensureAm06MatchStyle,
  ensureAm06Schema,
  ensureAm06SubsetBaseline,
  prepareAm06Workspace,
  runAm06JsonSchema,
  runAm06MatchStyle,
  runAm06PickFromJson,
  runAm06ProveSchema,
  runAm06StrictAndBack,
  runAm06SubsetBaseline,
} from './api-mock-am06-helpers';

const DIAGRAM = `
<svg viewBox="0 0 700 470" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="How the four JSON body matchers read the same request payload">
  <rect x="0" y="0" width="700" height="470" fill="#0f172a" />

  <text x="26" y="34" fill="#f1f5f9" font-family="system-ui" font-size="16" font-weight="600">One payload, four ways to judge it</text>

  <rect x="26" y="52" width="212" height="164" rx="8" fill="#1e293b" stroke="#3b4a60" />
  <text x="40" y="74" fill="#a8b8cc" font-family="system-ui" font-size="11">The request body</text>
  <text x="40" y="96" fill="#f1f5f9" font-family="ui-monospace" font-size="10">{</text>
  <text x="40" y="112" fill="#f1f5f9" font-family="ui-monospace" font-size="10">  "customer": {</text>
  <text x="40" y="128" fill="#f1f5f9" font-family="ui-monospace" font-size="10">    "id": "C-4421",</text>
  <text x="40" y="144" fill="#22c55e" font-family="ui-monospace" font-size="10">    "tier": "gold" },</text>
  <text x="40" y="160" fill="#f1f5f9" font-family="ui-monospace" font-size="10">  "items": [</text>
  <text x="40" y="176" fill="#3b82f6" font-family="ui-monospace" font-size="10">    { "sku": "RF-100" } ],</text>
  <text x="40" y="192" fill="#f59e0b" font-family="ui-monospace" font-size="10">  "note": "gift wrap"</text>
  <text x="40" y="208" fill="#f1f5f9" font-family="ui-monospace" font-size="10">}</text>

  <rect x="258" y="52" width="416" height="76" rx="8" fill="#1e293b" stroke="#22c55e" />
  <text x="274" y="74" fill="#22c55e" font-family="system-ui" font-size="12" font-weight="600">JSON subset — contains at least these fields</text>
  <text x="274" y="96" fill="#a8b8cc" font-family="ui-monospace" font-size="10">{ "customer": { "tier": "gold" } }  →  passes</text>
  <text x="274" y="118" fill="#64748b" font-family="system-ui" font-size="10">Unmentioned fields are ignored, at any depth. The default for mocks.</text>

  <rect x="258" y="140" width="416" height="76" rx="8" fill="#1e293b" stroke="#ef4444" />
  <text x="274" y="162" fill="#ef4444" font-family="system-ui" font-size="12" font-weight="600">JSON strict — deep equality, whole document</text>
  <text x="274" y="184" fill="#a8b8cc" font-family="ui-monospace" font-size="10">same expected JSON  →  fails (id, items, note are extra)</text>
  <text x="274" y="206" fill="#64748b" font-family="system-ui" font-size="10">Key order and formatting do not matter; every field does.</text>

  <rect x="258" y="228" width="416" height="76" rx="8" fill="#1e293b" stroke="#3b82f6" />
  <text x="274" y="250" fill="#3b82f6" font-family="system-ui" font-size="12" font-weight="600">JSONPath — read one field out of the payload</text>
  <text x="274" y="272" fill="#a8b8cc" font-family="ui-monospace" font-size="10">$.items[0].sku  exists  ·  equals RF-100  ·  contains RF-</text>
  <text x="274" y="294" fill="#64748b" font-family="system-ui" font-size="10">Empty Expected means "the field is there"; a value means "and it reads this".</text>

  <rect x="26" y="316" width="648" height="76" rx="8" fill="#1e293b" stroke="#a855f7" />
  <text x="42" y="338" fill="#a855f7" font-family="system-ui" font-size="12" font-weight="600">JSON Schema — validate the shape, not the values</text>
  <text x="42" y="360" fill="#a8b8cc" font-family="ui-monospace" font-size="10">customer.id: string  ·  tier: gold|platinum  ·  items[] { sku } minItems 1</text>
  <text x="42" y="382" fill="#64748b" font-family="system-ui" font-size="10">Types, required fields, enums, array bounds — the contract-testing matcher.</text>

  <line x1="26" y1="408" x2="674" y2="408" stroke="#3b4a60" />
  <text x="26" y="430" fill="#a8b8cc" font-family="system-ui" font-size="11">All four read the same body source with no key — the operator is the whole difference.</text>
  <text x="26" y="450" fill="#64748b" font-family="system-ui" font-size="10">A body that is not valid JSON fails every one of them; the decision trace names the operator that rejected it.</text>
  <text x="26" y="466" fill="#64748b" font-family="system-ui" font-size="10">Conditions are ANDed by default, so tightening a rule means adding matchers, not rewriting one.</text>
</svg>
`;

export const apiMockAm06Lesson: DemoLesson = {
  id: 'am-06-body-matching',
  domainId: 'api-mock',
  category: 'api-mock',
  name: 'Body Matching: Subset, Strict, JSONPath & JSON Schema',
  description:
    'Tighten one POST rule from "any payload with a gold customer" to a real contract: '
    + 'subset vs strict equality, a JSONPath matcher picked straight out of a sample body, '
    + 'exact vs substring comparison, and a JSON Schema — each proven in Simulate.',
  estimatedMinutes: 8,
  initialTab: 'api-mock-studio',
  contentVersion: 4,
  concept: {
    title: 'Matching on the payload — from "contains this" to a real contract',
    body:
      'Query strings and headers say who is calling. For anything that writes — a checkout, an '
      + 'order, a webhook — what matters is the **body**, and a mock that ignores the body will '
      + 'happily answer `201 Created` to a payload your real service would reject.\n\n'
      + 'A body condition looks like every other condition, with one difference: the **key is '
      + 'empty**. There is nothing to name, because the whole payload *is* the value. The '
      + '**operator** is where all the meaning lives, and there are four worth knowing.\n\n'
      + '**JSON subset** means "contains at least these fields". You write the fragment you care '
      + 'about — `{ "customer": { "tier": "gold" } }` — and every other field in the request is '
      + 'ignored, at any depth. Key order and pretty-vs-compact formatting are irrelevant, because '
      + 'both sides are parsed before they are compared. This is the right default for a mock: '
      + 'clients add fields over time, and a matcher that breaks when they do is a liability.\n\n'
      + '**JSON strict** is deep equality on the whole document. Same expected JSON, completely '
      + 'different question — now every field must be present and equal, and nothing extra is '
      + 'allowed. It is the honest matcher for a fixed, generated payload, and too brittle for '
      + 'almost everything else. Knowing *why* it fails is the useful part.\n\n'
      + '**JSONPath** narrows to one field instead of describing a fragment. `$.customer.tier`, '
      + `\`${AM06_JSONPATH}\`, \`$.items[*].sku\` — dot paths, array indexes, and a wildcard for `
      + '"every element". Leave **Expected** empty and the matcher becomes `jsonPath_exists`: the '
      + 'field simply has to be there. Fill it in and it becomes `jsonPath_equals`, where a small '
      + '**equals / contains** button decides how the resolved value is compared — full equality, '
      + 'or a substring for scalars and a partial object for object-valued paths.\n\n'
      + 'And you do not have to write the path by hand. The **JSON body** tab of the Pattern '
      + 'Toolbox takes a sample payload, and selecting a value in it derives the JSONPath *and* '
      + 'fills Expected with what that path resolves to. The **Resolved** box is a live read of the '
      + 'path against your sample, so a typo is visible as `(no match)` before anything is applied.\n\n'
      + '**JSON Schema** answers a different question again: not "what does this field say" but '
      + '"is this the right shape". Required fields, types, enums, array bounds — a real JSON '
      + 'Schema, validated with Ajv, so the same document you use for contract tests can be the '
      + 'matcher. The Schema tab ships presets to start from, and an XML mode for SOAP-shaped '
      + 'payloads.\n\n'
      + 'Conditions are ANDed by default, so these compose: a subset for the fields that must be '
      + 'there, a JSONPath for a value you route on, and a schema for the contract. Any body that '
      + 'is not valid JSON fails all of them — and **Simulate** tells you which one rejected it, '
      + 'because the decision trace prints the operator and the payload it read. Non-JSON payloads '
      + '— forms, multipart uploads, XML, raw binary — are their own matchers, covered in '
      + '**Forms, Multipart, XML & Binary Matching**.',
    keyTerms: [
      { term: 'Body source', definition: 'A condition that reads the whole request payload. Unlike query or header conditions it has no key — the operator carries all the meaning.' },
      { term: 'JSON subset', definition: '"Contains at least these fields." Extra fields anywhere in the payload are ignored; key order and formatting are irrelevant.' },
      { term: 'JSON strict', definition: 'Deep equality against the whole document. Every field must match and nothing extra may be present.' },
      { term: 'JSONPath', definition: 'A path into the parsed body: `$.customer.tier`, `$.items[0].sku`, `$.items[*].id` for every element of an array.' },
      { term: 'exists vs equals', definition: 'An empty Expected value applies `jsonPath_exists` (the field is present); a filled one applies `jsonPath_equals`.' },
      { term: 'Match style', definition: 'The equals / contains toggle on a JSONPath row — exact comparison, or substring for scalars and partial containment for objects.' },
      { term: 'Pick from JSON', definition: 'Selecting a value in the toolbox sample body to derive its JSONPath and expected value instead of typing either.' },
      { term: 'JSON Schema matcher', definition: 'Validates the payload shape (types, required fields, enums, array bounds) with Ajv — the contract-testing body matcher.' },
    ],
    diagram: DIAGRAM,
  },
  prepareBeforeNavigate: prepareAm06Workspace,
  cleanup: cleanupAm06,
  steps: [
    {
      id: 'subset-baseline',
      title: 'Subset means "contains at least this"',
      description:
        `This workspace has one rule — \`${AM06_RULE_METHOD} ${AM06_RULE_PATH}\` — and unlike the `
        + 'rules in the previous lessons it already reads the request **body**. Look at the '
        + 'condition row: the key box is missing entirely. There is nothing to name, because the '
        + 'whole payload is the value, and the **operator** carries the meaning.\n\n'
        + 'That operator is **JSON subset**, and the expected JSON is a compact one-liner so the '
        + 'whole fragment fits the row: `{"customer":{"tier":"gold"}}` — a gold customer tier, '
        + 'nothing else. Now send a payload a real client would send. Expand the body and read '
        + '`tier`: gold — that is the fragment the matcher asked for. The customer id, line items, '
        + 'and `note` sit next to it and do not matter. **Run simulation**. It comes back '
        + '**MATCHED**.\n\n'
        + 'That is the whole idea of subset: the fields you wrote must be present and equal, and '
        + 'everything else is ignored, at any depth. Formatting is irrelevant too — both sides are '
        + 'parsed before they are compared, so key order and whitespace never matter. For a mock '
        + 'this is usually what you want, because clients add fields over time and a matcher that '
        + 'breaks when they do is a liability.',
      highlight: API_MOCK.FIRST_CONDITION,
      preAction: ensureAm06SubsetBaseline,
      action: async (ctx) => {
        await runAm06SubsetBaseline(ctx);
      },
      verify: API_MOCK.FIRST_CONDITION,
    },
    {
      id: 'strict-and-back',
      title: 'Strict is deep equality — usually too strict for a mock',
      description:
        'Change nothing but the operator. **JSON strict** reads the *same* expected JSON and asks a '
        + 'completely different question: is the whole document deeply equal to this?\n\n'
        + 'Re-run the same payload. Expand the body and read `note`: gift wrap — an extra field '
        + 'the subset matcher ignored and strict will not allow. **Run simulation** and it now '
        + 'comes back **UNMATCHED**. The candidate '
        + 'is flagged **Conditions failed** — so the method and path were fine — and the trace row '
        + 'underneath names the operator that rejected it and shows the body it read: the customer '
        + 'id, the line items, and the `note` field are all extras, and strict allows none of them. '
        + '(It is not fussy about *formatting*, though — pretty or compact, both sides are parsed '
        + 'first. It is fussy about *content*.)\n\n'
        + 'Strict is the honest matcher for a fixed, generated payload where you own every byte. '
        + 'For anything a real client sends, switch back to **JSON subset** — which is exactly what '
        + 'happens next, leaving the baseline in place for the matchers the rest of the lesson '
        + 'stacks on top of it.',
      highlight: API_MOCK.FIRST_CONDITION,
      preAction: ensureAm06SubsetBaseline,
      action: async (ctx) => {
        await runAm06StrictAndBack(ctx);
      },
      verify: API_MOCK.FIRST_CONDITION,
    },
    {
      id: 'pick-from-json',
      title: 'Stop memorizing JSONPath — pick the field out of a payload',
      description:
        'Subset describes a *fragment*. Often you want one **field** instead: the SKU a fulfilment '
        + 'rule routes on, buried in an array. That is JSONPath, and the toolbox writes it for you.\n\n'
        + 'The wand beside the path opens the Pattern Toolbox; its **JSON body / JSONPath** tab is a '
        + 'small workbench. Paste the payload you actually receive — the badge above confirms it is '
        + `valid JSON — then select \`"${AM06_SKU}"\` inside it. The **JSONPath** box fills itself `
        + `with \`${AM06_JSONPATH}\` and **Expected** with the value that path resolves to. No `
        + 'syntax memorized, no array index counted by hand.\n\n'
        + 'The **Resolved** box below is the live read of that path against your sample, which is '
        + 'how you catch a typo before it becomes a rule: a wrong path shows `(no match)` there. '
        + `**Expected** stays \`${AM06_SKU}\` — the value the pick wrote — so **Apply** lands a `
        + '`jsonPath_equals` row beside the subset baseline, and the group\'s condition count goes '
        + 'to two.',
      highlight: API_MOCK.PATH_TOOLBOX,
      preAction: ensureAm06SubsetBaseline,
      action: runAm06PickFromJson,
      verify: API_MOCK.LAST_CONDITION,
    },
    {
      id: 'match-style',
      title: 'Equals or Contains decides how the value is compared',
      description:
        'The applied row has two boxes — the path on the left, the expected value on the right — '
        + 'and **Equals** / **Contains** radios after them. That is the match style, and it is easy '
        + 'to miss for something that changes the meaning of the whole condition.\n\n'
        + `**Equals** is exact: the resolved value must be \`${AM06_SKU}\` and nothing else. Switch `
        + `to **Contains**, then widen the value to \`${AM06_SKU_FAMILY}\` — a substring, so every `
        + 'part number in that family matches and one rule covers a whole product line instead of '
        + 'a single item.\n\n'
        + 'For object-valued paths **Contains** means *partial containment* — the resolved object '
        + 'must contain the fields you wrote, the way subset works one level down. It is the same '
        + 'trade-off as subset versus strict, made per field instead of per payload, which is why '
        + 'it lives on the row rather than in the operator list.',
      highlight: API_MOCK.LAST_CONDITION,
      preAction: ensureAm06JsonPathCondition,
      action: runAm06MatchStyle,
      verify: API_MOCK.LAST_CONDITION,
    },
    {
      id: 'json-schema',
      title: 'Validate the shape, not the values',
      description:
        'Two matchers now check what the payload *says*. A contract cares about something else: is '
        + 'this the right **shape** at all? Required fields present, types correct, values inside '
        + 'the allowed set.\n\n'
        + 'The toolbox\'s **Schema** tab is that matcher. It takes a real JSON Schema — validated '
        + 'with Ajv, so the document you already use for contract tests works unchanged — and the '
        + `presets on the left are there to start from rather than type: **${AM06_SCHEMA_PRESET}** `
        + 'lands a minimal object-with-required-field schema in the editor so you can see the '
        + 'format before replacing it.\n\n'
        + 'The real contract goes further: `customer` and `items` are required at the top level, '
        + '`customer.id` is a non-empty string, `customer.tier` must be `gold` or `platinum`, and '
        + '`items` is a non-empty array of objects that each carry a `sku`. The **JSON Schema** / '
        + '**XML names** switch above the editor is how the same tab handles SOAP-shaped payloads. '
        + '**Apply** turns it into a third condition row — same body source, no key, operator '
        + '`jsonSchema` — and because conditions are ANDed, the rule now demands all three.',
      highlight: API_MOCK.PATH_TOOLBOX,
      preAction: ensureAm06MatchStyle,
      action: runAm06JsonSchema,
      verify: API_MOCK.LAST_CONDITION,
    },
    {
      id: 'prove-schema',
      title: 'The trace names the matcher that rejected the body',
      description:
        'Three body matchers on one rule, and the point of a schema is the payload that gets past '
        + 'the other two. Send an order that is one field short — a gold customer with no `id`, and '
        + 'a line item whose SKU is right. Expand the body and read `customer`: `tier` is gold, but '
        + '`id` is missing. **Run simulation**. Subset is satisfied. The JSONPath row is satisfied. '
        + 'The rule still comes back **UNMATCHED**, flagged **Conditions failed**.\n\n'
        + 'The Decision trace names the matcher that said no: one red `jsonSchema` row among the '
        + 'ticks, with the body it read printed beside it. That is what makes a schema worth the '
        + 'extra condition — it catches the shape problems no field-level matcher was written for.\n\n'
        + 'Then the complete order. **Save as sample** as `POST /orders — complete order`. Expand '
        + 'the body again — `customer.id` is `C-4421` — and **Run simulation**: **MATCHED**, and '
        + 'the **Rendered** tab shows the `201` confirmation body '
        + 'the rule serves. The rule went from "any payload mentioning a gold tier" to a contract '
        + '— subset for the fields that must be there, a JSONPath for the value it routes on, and '
        + 'a schema for the shape — and every step of that was verified before a listener was ever '
        + 'bound.',
      highlight: API_MOCK.SIMULATE,
      preAction: ensureAm06Schema,
      action: async (ctx) => {
        await runAm06ProveSchema(ctx);
      },
      verify: API_MOCK.ROUTE_EXPLORER,
    },
  ],
};
