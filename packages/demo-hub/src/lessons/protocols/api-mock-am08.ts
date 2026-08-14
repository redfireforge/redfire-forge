/**
 * AM-08 `am-08-selection-policy` — Boolean Groups, Priority & Selection Policy.
 *
 * Scenario: two GET /catalog rules at equal priority. Regional already requires a
 * version header; Default matches everything. Nested OR tenants, a None-of debug
 * guard, a raised priority, and the two multiple-match policies are authored live
 * and proven in Simulate. Curriculum:
 * `docs/plan/future/apimock/apimock-demo-curriculum-v2.md` §5 Track B.
 */
import { API_MOCK } from '@shared/selectors';
import type { DemoLesson } from '../../types';
import {
  AM08_AMBIGUITY_BODY,
  AM08_DEBUG_KEY,
  AM08_DEFAULT_NAME,
  AM08_PATH,
  AM08_PRIORITY_RAISED,
  AM08_REGIONAL_NAME,
  AM08_TENANT_EU,
  AM08_TENANT_KEY,
  AM08_TENANT_US,
  AM08_VERSION_KEY,
  AM08_VERSION_VALUE,
  cleanupAm08,
  ensureAm08ForSpecificity,
  ensureAm08FullLogic,
  ensureAm08NestedAnyEmpty,
  ensureAm08PriorityRaised,
  ensureAm08Tenants,
  ensureAm08VersionOnly,
  prepareAm08Workspace,
  runAm08AllVsAny,
  runAm08HighestPriority,
  runAm08NestedGroup,
  runAm08NotGroup,
  runAm08Priority,
  runAm08ProveLogic,
  runAm08RejectMultiple,
  runAm08Specificity,
} from './api-mock-am08-helpers';

const DIAGRAM = `
<svg viewBox="0 0 700 430" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="How a mock picks one rule when two match">
  <rect x="0" y="0" width="700" height="430" fill="#0f172a" />

  <text x="26" y="34" fill="#f1f5f9" font-family="system-ui" font-size="16" font-weight="600">Boolean groups decide *whether*. Policy decides *which*.</text>
  <text x="26" y="54" fill="#64748b" font-family="system-ui" font-size="10">A request that satisfies more than one rule is not a bug in the matcher — it is a question for selection policy.</text>

  <rect x="26" y="72" width="310" height="150" rx="8" fill="#1e293b" stroke="#3b82f6" />
  <text x="42" y="96" fill="#3b82f6" font-family="system-ui" font-size="12" font-weight="600">Regional catalog — All of</text>
  <text x="42" y="118" fill="#a8b8cc" font-family="ui-monospace" font-size="10">X-Api-Version = 2024-11</text>
  <text x="42" y="138" fill="#22c55e" font-family="system-ui" font-size="10">AND  Any of: tenant acme-eu  OR  acme-us</text>
  <text x="42" y="158" fill="#f59e0b" font-family="system-ui" font-size="10">AND  None of: X-Debug present</text>
  <text x="42" y="186" fill="#64748b" font-family="system-ui" font-size="10">None of fails closed — a child it cannot evaluate never inverts into a match.</text>
  <text x="42" y="206" fill="#a8b8cc" font-family="system-ui" font-size="10">The combinator is per group. Nesting is how you write A AND (B OR C).</text>

  <rect x="352" y="72" width="322" height="150" rx="8" fill="#1e293b" stroke="#64748b" />
  <text x="368" y="96" fill="#a8b8cc" font-family="system-ui" font-size="12" font-weight="600">Default catalog — empty Match</text>
  <text x="368" y="118" fill="#a8b8cc" font-family="ui-monospace" font-size="10">GET /catalog  ·  no conditions</text>
  <text x="368" y="146" fill="#f1f5f9" font-family="system-ui" font-size="10">Matches every GET /catalog, including the ones Regional wants.</text>
  <text x="368" y="174" fill="#64748b" font-family="system-ui" font-size="10">That overlap is the whole point of the rest of the lesson.</text>
  <text x="368" y="198" fill="#64748b" font-family="system-ui" font-size="10">Both start at priority 10.</text>

  <rect x="26" y="238" width="310" height="150" rx="8" fill="#1e293b" stroke="#22c55e" />
  <text x="42" y="262" fill="#22c55e" font-family="system-ui" font-size="12" font-weight="600">Choose highest priority</text>
  <text x="42" y="284" fill="#f1f5f9" font-family="system-ui" font-size="10">Raise Regional to 20. The quiet policy picks a winner and moves on.</text>
  <text x="42" y="308" fill="#a8b8cc" font-family="system-ui" font-size="10">Tied at the top? Two answers:</text>
  <text x="42" y="328" fill="#f1f5f9" font-family="system-ui" font-size="10">Reject as ambiguous — 409, you shape the body.</text>
  <text x="42" y="348" fill="#f1f5f9" font-family="system-ui" font-size="10">Specificity, then stable ID — score the matchers.</text>
  <text x="42" y="370" fill="#64748b" font-family="system-ui" font-size="10">A header exact outranks an empty Match group.</text>

  <rect x="352" y="238" width="322" height="150" rx="8" fill="#1e293b" stroke="#ef4444" />
  <text x="368" y="262" fill="#ef4444" font-family="system-ui" font-size="12" font-weight="600">Reject all multiple matches</text>
  <text x="368" y="284" fill="#f1f5f9" font-family="system-ui" font-size="10">Fires *before* priority. Two matches → 409, even if one is 20.</text>
  <text x="368" y="308" fill="#a8b8cc" font-family="ui-monospace" font-size="10">{"error":"catalog_ambiguous",…}</text>
  <text x="368" y="332" fill="#f1f5f9" font-family="system-ui" font-size="10">Use this when guessing would hide a contract hole.</text>
  <text x="368" y="356" fill="#64748b" font-family="system-ui" font-size="10">{{requestId}} and {{competingRuleCount}} are filled at run time.</text>
  <text x="368" y="376" fill="#64748b" font-family="system-ui" font-size="10">Simulate shows the decision without binding a port.</text>

  <text x="26" y="412" fill="#a8b8cc" font-family="system-ui" font-size="11">The decision trace names every child that ticked or missed — groups are not a black box.</text>
</svg>
`;

export const apiMockAm08Lesson: DemoLesson = {
  id: 'am-08-selection-policy',
  domainId: 'protocols',
  category: 'api-mock',
  name: 'Boolean Groups, Priority & Selection Policy',
  description:
    'Two rules already overlap on GET /catalog. Nest an Any-of tenant group under All of, '
    + 'add a None-of debug guard that fails closed, then decide the tie: raise priority, '
    + 'reject every multiple match as 409, or break equal priority by specificity.',
  estimatedMinutes: 9,
  initialTab: 'api-mock-studio',
  contentVersion: 1,
  concept: {
    title: 'Groups say whether a rule matches. Policy says which matching rule wins.',
    body:
      'A condition row is a yes/no. Real contracts need more than a flat list of yeses: '
      + '`version AND (eu OR us)`, plus a guard that says "never this". That is what **All of**, '
      + '**Any of**, and **None of** are for — one combinator per group, and groups nest, so '
      + `the shape you write is the shape the evaluator reads.\n\n`
      + `This workspace already has the overlap that makes the rest of the lesson necessary. `
      + `**${AM08_REGIONAL_NAME}** requires \`${AM08_VERSION_KEY}: ${AM08_VERSION_VALUE}\`. `
      + `**${AM08_DEFAULT_NAME}** matches every \`${AM08_PATH}\`. Send the version header and `
      + '*both* rules match, and the default equal-priority policy refuses to guess — that is '
      + 'a 409, not a coin flip.\n\n'
      + '**All of / Any of.** The root group stays **All of**, because the version header is '
      + 'the AND. The UI cannot wrap existing rows into a nested group, so **[ ] Group** adds '
      + 'a child group underneath. Switch *that* group to **Any of** and put the two tenant '
      + `headers inside it — \`${AM08_TENANT_EU}\` or \`${AM08_TENANT_US}\`. The tree now reads `
      + '`version AND (eu OR us)`, which is the shape almost every real predicate actually is.\n\n'
      + '**None of.** A nested **None of** is a fail-closed guard: "reject when this is true". '
      + `Here it holds \`${AM08_DEBUG_KEY}\` **present**. Fail-closed matters: a child the `
      + 'evaluator cannot invert (a stub, an unknown operator) makes the whole group *miss*, '
      + 'so a stub can never invert into a match. That is the difference between a guard and a '
      + 'clever NOT you thought you wrote.\n\n'
      + '**Priority.** When more than one rule matches, **Choose highest priority** picks the '
      + `larger number and moves on. Raising Regional to ${AM08_PRIORITY_RAISED} is enough — `
      + 'Default still matches, it just loses. The Winner badge in Simulate is that decision '
      + 'made visible.\n\n'
      + '**Reject all multiple matches.** This policy fires *before* priority. Two matches is '
      + 'always 409, even if one rule is sitting at 20. Use it when guessing would hide a hole '
      + 'in the contract. The **Ambiguous response** body is yours: the default already carries '
      + `\`{{requestId}}\` and \`{{competingRuleCount}}\`, and a live edit to `
      + `\`${AM08_AMBIGUITY_BODY}\` is what Simulate renders.\n\n`
      + '**Specificity, then stable ID.** For a remaining tie at the highest priority, score '
      + 'the matchers: an exact path outranks a glob, a header exact outranks an empty Match '
      + 'group, and a stable rule id breaks a true dead heat. The breakdown in Simulate is the '
      + 'score, not a vibe — you can read why Regional won without opening the source.\n\n'
      + 'All of this is verified in **Simulate** with no listener bound. The decision trace '
      + 'prints every child that ticked or missed, including the Any-of tenant that did not '
      + 'fire, so a group is never a black box.',
    keyTerms: [
      { term: 'All of', definition: 'Every child of the group must pass. The default combinator, and the AND in `A AND (B OR C)`.' },
      { term: 'Any of', definition: 'One passing child is enough. Nested under All of, this is how a rule accepts either of two tenants without duplicating the rest of the tree.' },
      { term: 'None of', definition: 'The group passes only when every child fails. The product\'s fail-closed guard — used to reject debug callers, not to invert a matcher you cannot evaluate.' },
      { term: 'Fail closed', definition: 'A None-of child that cannot be evaluated makes the whole group miss, so a stub operator can never invert into a match.' },
      { term: 'Priority', definition: 'An integer on the rule. Under Choose highest priority, the larger number wins among the rules that matched.' },
      { term: 'Choose highest priority', definition: 'The quiet multiple-match policy: pick a winner and move on. Equal numbers at the top fall through to the equal-priority policy.' },
      { term: 'Reject all multiple matches', definition: 'The loud policy. Two or more matches become 409 *before* priority is consulted, so a raised number cannot save you.' },
      { term: 'Specificity, then stable ID', definition: 'The equal-priority tie-break that scores method, path kind, and passing matchers, then falls back to a stable rule id.' },
    ],
    diagram: DIAGRAM,
  },
  prepareBeforeNavigate: prepareAm08Workspace,
  cleanup: cleanupAm08,
  steps: [
    {
      id: 'all-vs-any',
      title: 'All of is the AND. Any of lives in a nested group.',
      description:
        `Two rules, same path: **${AM08_REGIONAL_NAME}** already requires `
        + `\`${AM08_VERSION_KEY}: ${AM08_VERSION_VALUE}\`, and **${AM08_DEFAULT_NAME}** matches `
        + `every \`${AM08_PATH}\`. Send that header and both fire — that overlap is the problem `
        + 'the rest of the lesson will decide. First, the boolean shape.\n\n'
        + 'The root combinator is **All of**. That is the AND, and it stays that way: the '
        + 'version header is not optional. The UI cannot wrap an existing row into a nested '
        + 'group, so **[ ] Group** adds a *child* group underneath. A new group starts as All '
        + 'of too — switch *that* one to **Any of**. The empty nested group does not affect '
        + 'matching yet; it is the OR waiting for tenants.',
      highlight: API_MOCK.ROUTE_EXPLORER,
      preAction: ensureAm08VersionOnly,
      action: runAm08AllVsAny,
      verify: API_MOCK.NESTED_GROUPS,
    },
    {
      id: 'nested-group',
      title: 'Real predicates are A AND (B OR C)',
      description:
        'The nested **Any of** is the OR. Two header conditions go inside it, not at the '
        + `root: \`${AM08_TENANT_KEY}\` exact \`${AM08_TENANT_EU}\`, then the same key exact `
        + `\`${AM08_TENANT_US}\`. New rows default to Header / exact, so the work is naming `
        + 'the header and filling the tenant.\n\n'
        + `The tree now reads: version **and** (eu **or** us). A caller from \`acme-eu\` `
        + 'satisfies the nested group even though the `acme-us` row misses — that is the '
        + 'whole point of Any of. Flattening both tenants into the root All of would have '
        + 'required *both* headers on every request, which no client sends.',
      highlight: API_MOCK.ADD_GROUP,
      preAction: ensureAm08NestedAnyEmpty,
      action: runAm08NestedGroup,
      verify: API_MOCK.NESTED_GROUPS,
    },
    {
      id: 'not-group',
      title: 'None of is a guard, and it fails closed',
      description:
        'A second **[ ] Group** under the root is the guard. Switch it to **None of** and '
        + 'read the fail-closed note: a child the evaluator cannot invert makes the whole '
        + 'group miss, so a stub can never turn into a match. That is why None of is safe as '
        + 'a reject-when-true, and unsafe as "NOT this matcher I have not implemented yet".\n\n'
        + `The child is \`${AM08_DEBUG_KEY}\` **present** — no value, because presence is the `
        + 'whole question. The rule now reads: version AND (eu OR us) AND NOT debug. A '
        + 'debug caller with a perfectly good tenant still misses Regional, which is the '
        + 'contract.',
      highlight: API_MOCK.ADD_GROUP,
      preAction: ensureAm08Tenants,
      action: runAm08NotGroup,
      verify: API_MOCK.NESTED_GROUPS,
    },
    {
      id: 'prove-logic',
      title: 'The same request still matches two rules',
      description:
        `Simulate \`${AM08_PATH}\` with \`${AM08_VERSION_KEY}: ${AM08_VERSION_VALUE}\` and `
        + `\`${AM08_TENANT_KEY}: ${AM08_TENANT_EU}\` — no debug header. Regional's tree `
        + 'passes: the version row ticks, the eu tenant ticks, the us tenant misses (Any of '
        + 'does not care), and the debug present misses (None of *wants* that).\n\n'
        + 'Default still matches on method and path alone. Two overall ticks, equal priority, '
        + 'and the default equal-priority policy **Reject as ambiguous**. The outcome is '
        + '**AMBIGUOUS**, not a silent pick. That is the honest answer until you choose a '
        + 'policy — and it is why the next three steps exist.',
      highlight: API_MOCK.SIMULATE,
      preAction: ensureAm08FullLogic,
      action: async (ctx) => {
        await runAm08ProveLogic(ctx);
      },
      verify: API_MOCK.ROUTE_EXPLORER,
    },
    {
      id: 'priority',
      title: 'Priority breaks ties. Higher wins.',
      description:
        `The Priority field is an integer on the rule, not a setting. Fill `
        + `**${AM08_PRIORITY_RAISED}** on Regional — Default stays at 10. Under **Choose `
        + 'highest priority**, that is enough: the larger number wins among the rules that '
        + 'matched.\n\n'
        + 'Open **Settings → Selection**. Two dropdowns, two questions. **Multiple matches** '
        + 'is the loud/quiet choice (highest priority vs reject every multiple match). '
        + '**Equal priority** is what happens when the quiet policy still has a tie '
        + '(reject as 409, or score the matchers). Leave them as they are for now — the '
        + 'defaults are already the quiet policy — and save so the Studio is clear for the '
        + 'proof.',
      highlight: API_MOCK.PRIORITY_INPUT,
      preAction: ensureAm08FullLogic,
      action: runAm08Priority,
      verify: API_MOCK.PRIORITY_INPUT,
    },
    {
      id: 'highest-priority',
      title: 'The quiet policy: pick the winner and move on',
      description:
        'Same request, same two matching rules — but Regional is 20. **Choose highest '
        + 'priority** picks it and moves on. The **Winner** badge sits on Regional; Default '
        + 'still shows as a matching candidate, just not the one that answers. That is the '
        + 'honest picture: overlap is still there, the mock just has a ranking.\n\n'
        + 'This is the policy you want when the overlap is *intentional* — a specific rule '
        + 'in front of a catch-all. It is also the policy that will silently hide a duplicate '
        + 'you did not mean, which is why the loud alternative exists.',
      highlight: API_MOCK.SIMULATE,
      preAction: ensureAm08PriorityRaised,
      action: async (ctx) => {
        await runAm08HighestPriority(ctx);
      },
      verify: API_MOCK.PRIORITY_INPUT,
    },
    {
      id: 'reject-multiple',
      title: 'The loud policy: 409 instead of guessing',
      description:
        '**Reject all multiple matches** fires *before* priority. Two matches is always '
        + `409, even with Regional sitting at ${AM08_PRIORITY_RAISED}. Switch Multiple `
        + 'matches to that policy, then shape the **Ambiguous response** body — the status '
        + 'stays 409, and the placeholders `{{requestId}}` and `{{competingRuleCount}}` are '
        + 'filled when the mock actually answers.\n\n'
        + 'Re-run the same request. **AMBIGUOUS**, and **Rendered** shows the body you just '
        + 'wrote, not a silent Regional 200. Use this when a guessed winner would hide a hole '
        + 'in the contract — a client should see the collision, not a coin flip.',
      highlight: API_MOCK.SETTINGS,
      preAction: ensureAm08PriorityRaised,
      action: async (ctx) => {
        await runAm08RejectMultiple(ctx);
      },
      verify: API_MOCK.ROUTE_EXPLORER,
    },
    {
      id: 'specificity',
      title: 'Equal priority: score the matchers',
      description:
        'Put both rules back at 10 and leave Multiple matches on **Choose highest priority**. '
        + 'The remaining question is the *equal*-priority policy. Switch it to **Specificity, '
        + 'then stable ID**: score method, path kind, and every passing matcher, then break a '
        + 'true dead heat with a stable rule id.\n\n'
        + 'Same request again. Regional wins — not because of a number you typed, but because '
        + 'a version header plus two tenant exacts plus a None-of guard outranks an empty '
        + 'Match group. The **Specificity** list is that score, and timeline step 3 names it. '
        + 'That is the tie-break you want when the overlap is real and you still do not want '
        + 'to guess by insertion order.',
      highlight: API_MOCK.SETTINGS,
      preAction: ensureAm08ForSpecificity,
      action: async (ctx) => {
        await runAm08Specificity(ctx);
      },
      verify: API_MOCK.ROUTE_EXPLORER,
    },
  ],
};
