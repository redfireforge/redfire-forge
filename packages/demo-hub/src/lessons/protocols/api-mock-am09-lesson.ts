/**
 * AM-09 `am-09-conflicts` — Conflict Inspector: Four Overlap Kinds → Fix → Acknowledge.
 *
 * Scenario: eight rules already overlap in four path-disjoint pairs. The corpus is
 * the *problem*. Duplicate is one arc (name → Simulate AMBIGUOUS → Open in Studio),
 * then Shadowed → two Simulate probes, then Definite → two Simulate probes, then Potential → two header probes, then rank and acknowledge-then-stale.
 * Curriculum: `docs/plan/future/apimock/apimock-demo-curriculum-v2.md` §5 Track B.
 */
import { API_MOCK } from '@shared/selectors';
import type { DemoLesson } from '../../types';
import * as am09 from './api-mock-am09-helpers';

const AM09_DAILY = am09.AM09_DAILY;
const AM09_HEALTH_A = am09.AM09_HEALTH_A;
const AM09_HEALTH_B = am09.AM09_HEALTH_B;
const AM09_ORDERS_CATCHALL = am09.AM09_ORDERS_CATCHALL;
const AM09_ORDERS_TENANT = am09.AM09_ORDERS_TENANT;
const AM09_HEALTH_PATH = am09.AM09_HEALTH_PATH;
const AM09_ORDERS_PATH = am09.AM09_ORDERS_PATH;
const AM09_TENANT_HEADER = am09.AM09_TENANT_HEADER;
const AM09_DAILY_PATH = am09.AM09_DAILY_PATH;
const AM09_GLOB_PATH = am09.AM09_GLOB_PATH;
const AM09_NON_DAILY_PATH = am09.AM09_NON_DAILY_PATH;
const AM09_PRIORITY_DEFAULT = am09.AM09_PRIORITY_DEFAULT;
const AM09_PRIORITY_RAISED = am09.AM09_PRIORITY_RAISED;
const AM09_PRIORITY_STALE = am09.AM09_PRIORITY_STALE;
const AM09_REPORTS_GLOB = am09.AM09_REPORTS_GLOB;
const AM09_SEARCH_PREFIX = am09.AM09_SEARCH_PREFIX;
const AM09_SEARCH_REGION = am09.AM09_SEARCH_REGION;
const AM09_SEARCH_PATH = am09.AM09_SEARCH_PATH;
const AM09_CLIENT_HEADER_HIT = am09.AM09_CLIENT_HEADER_HIT;

const DIAGRAM = `
<svg viewBox="0 0 700 430" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Four overlap kinds the Conflict Inspector can name">
  <rect x="0" y="0" width="700" height="430" fill="#0f172a" />

  <text x="26" y="34" fill="#f1f5f9" font-family="system-ui" font-size="16" font-weight="600">Four ways two rules can collide</text>
  <text x="26" y="54" fill="#64748b" font-family="system-ui" font-size="10">Static pair-wise analysis. The inspector names the overlap before a client ever pays for a 409.</text>

  <rect x="26" y="72" width="318" height="150" rx="8" fill="#1e293b" stroke="#ef4444" />
  <text x="42" y="96" fill="#ef4444" font-family="system-ui" font-size="12" font-weight="600">Duplicate</text>
  <text x="42" y="118" fill="#f1f5f9" font-family="ui-monospace" font-size="11">GET /health  ·  GET /health</text>
  <text x="42" y="140" fill="#a8b8cc" font-family="system-ui" font-size="11">Same method, same path, same Match tree.</text>
  <text x="42" y="162" fill="#64748b" font-family="system-ui" font-size="10">Fingerprints prove it — this is not a hunch.</text>
  <text x="42" y="186" fill="#f1f5f9" font-family="system-ui" font-size="10">Equal priority + reject → 409 AMBIGUOUS.</text>
  <text x="42" y="206" fill="#64748b" font-family="system-ui" font-size="10">The witness is a plain GET. Both copies match.</text>

  <rect x="356" y="72" width="318" height="150" rx="8" fill="#1e293b" stroke="#f59e0b" />
  <text x="372" y="96" fill="#f59e0b" font-family="system-ui" font-size="12" font-weight="600">Shadowed</text>
  <text x="372" y="118" fill="#f1f5f9" font-family="ui-monospace" font-size="11">GET /orders  P20  vs  P10 + tenant</text>
  <text x="372" y="140" fill="#a8b8cc" font-family="system-ui" font-size="11">A higher-priority empty Match is a superset.</text>
  <text x="372" y="162" fill="#64748b" font-family="system-ui" font-size="10">The tenant rule can never win — the catch-all always can.</text>
  <text x="372" y="186" fill="#f1f5f9" font-family="system-ui" font-size="10">Dimensions still list method / path / header.</text>
  <text x="372" y="206" fill="#64748b" font-family="system-ui" font-size="10">Raising the narrower rule is how you unshadow it.</text>

  <rect x="26" y="238" width="318" height="150" rx="8" fill="#1e293b" stroke="#3b82f6" />
  <text x="42" y="262" fill="#3b82f6" font-family="system-ui" font-size="12" font-weight="600">Definite overlap</text>
  <text x="42" y="284" fill="#f1f5f9" font-family="ui-monospace" font-size="11">/reports/daily  vs  /reports/*</text>
  <text x="42" y="306" fill="#a8b8cc" font-family="system-ui" font-size="11">Not identical, but every daily request hits both.</text>
  <text x="42" y="328" fill="#64748b" font-family="system-ui" font-size="10">The analyzer can prove the collision statically.</text>
  <text x="42" y="352" fill="#f1f5f9" font-family="system-ui" font-size="10">Adjust priority +10 reclassifies it to Shadowed.</text>
  <text x="42" y="374" fill="#64748b" font-family="system-ui" font-size="10">The Definite filter empties. Four findings remain.</text>

  <rect x="356" y="238" width="318" height="150" rx="8" fill="#1e293b" stroke="#a78bfa" />
  <text x="372" y="262" fill="#a78bfa" font-family="system-ui" font-size="12" font-weight="600">Potential overlap</text>
  <text x="372" y="284" fill="#f1f5f9" font-family="ui-monospace" font-size="11">x-client  ^acme  vs  ^acme-.*</text>
  <text x="372" y="306" fill="#a8b8cc" font-family="system-ui" font-size="11">Regex ∩ regex is undecidable at analysis time.</text>
  <text x="372" y="328" fill="#64748b" font-family="system-ui" font-size="10">The unknown dimension is the honest answer.</text>
  <text x="372" y="352" fill="#f1f5f9" font-family="system-ui" font-size="10">Acknowledge what you meant. Edit a rule → Stale.</text>
  <text x="372" y="374" fill="#64748b" font-family="system-ui" font-size="10">Fingerprints expire the ack the moment either side changes.</text>

  <text x="26" y="412" fill="#a8b8cc" font-family="system-ui" font-size="11">Every finding ships a witness request. Simulate it. Then fix, or acknowledge and get told when it goes stale.</text>
</svg>
`;

export const apiMockAm09Lesson: DemoLesson = {
  id: 'am-09-conflicts',
  domainId: 'api-mock',
  category: 'api-mock',
  name: 'Conflict Inspector: Four Overlap Kinds',
  description:
    'Two rules that can answer the same request are worse than a mock that '
    + 'answers nothing — the client gets the wrong body, or a **409 Conflict**, and you '
    + 'find out at runtime. The inspector names how they collide, proves it '
    + 'with a witness, and lets you rank a winner or acknowledge an overlap '
    + 'you meant — then tells you when that ack is no longer the pair you reviewed.',
  estimatedMinutes: 13,
  initialTab: 'api-mock-studio',
  contentVersion: 41,
  concept: {
    title: 'Name the overlap before a client ever pays for a 409.',
    body:
      'A library of mocks grows by copy-paste. Two `GET /health` rules, a '
      + 'catch-all sitting in front of a tenant rule, a glob that swallows a '
      + 'literal, two header regexes that might intersect — those are **four '
      + 'different bugs**. They need four names, because the fix is different '
      + 'for each.\n\n'
      + '**Analyze** is static pair-wise inspection. It does not start a '
      + 'server and does not send traffic. Every enabled pair is compared on '
      + 'method, path, and Match. The output is a finding, not a guess:\n\n'
      + `- **Duplicate** — same request line (${AM09_HEALTH_A} vs ${AM09_HEALTH_B}). Priority is not part of the test.\n`
      + '- **Shadowed** — a higher-priority *superset* means the other rule can never win.\n'
      + `- **Definite** — not copies, but the collision is provable (\`${AM09_DAILY_PATH}\` vs \`${AM09_GLOB_PATH}\`).\n`
      + '- **Potential** — a dimension is undecidable. Regex ∩ regex is the textbook case. The honest answer is *unknown*.\n\n'
      + 'Each finding carries **fingerprints** (SHA-256 of the whole rule '
      + 'record), a **dimension** table, and a **witness request** — the '
      + 'smallest call that triggers the overlap. Simulate that witness and '
      + 'the finding stops being a label:\n\n'
      + '- **Duplicate** → **AMBIGUOUS** — a **409 Conflict** (the server won’t choose). The mock refuses to pick either copy.\n'
      + '- **Shadowed** → **MATCHED**. The wrong body ships — not a 409.\n'
      + `- **Definite** → \`${AM09_DAILY_PATH}\` collides; \`${AM09_NON_DAILY_PATH}\` does not.\n`
      + `- **Potential** → \`${AM09_CLIENT_HEADER_HIT}\` is **409 Conflict**; no header is **404 Not Found**.\n\n`
      + '**Adjust priority** ranks a winner — the finding count stays four, '
      + 'because ranking is not deleting. **Acknowledge** is for overlaps you '
      + 'meant; edit either hash and the ack goes **Stale**.',
    keyTerms: [
      { term: 'Analyze', definition: 'Static pair-wise inspection of enabled rules. A pre-Apply safety pass — no listener, no traffic.' },
      { term: 'Duplicate', definition: 'Identical method, path, and Match tree. Two records, one request line. Priority is ignored.' },
      { term: 'Shadowed', definition: 'A higher-priority rule whose Match is a superset of the peer. The narrower rule is dead at runtime.' },
      { term: 'Definite overlap', definition: 'Both rules match some request, and the analyzer can prove it, but they are not copies — exact path vs glob is the usual case.' },
      { term: 'Potential overlap', definition: 'At least one dimension is undecidable statically, most often regex ∩ regex. Unknown, not a guessed collision.' },
      { term: 'Witness request', definition: 'A synthetic request the finding ships that is enough to trigger the overlap in Simulate.' },
      { term: 'Fingerprint', definition: 'SHA-256 of the whole rule record (id, name, Match, response, priority). Two duplicates usually have different hashes. An ack stays valid only while both hashes stay the same.' },
      { term: 'Stale acknowledgement', definition: 'You accepted this pair, then an edit changed a fingerprint. Re-review — the waiver was a snapshot, not a lifetime pass.' },
    ],
    diagram: DIAGRAM,
  },
  prepareBeforeNavigate: () => am09.prepareAm09Workspace(),
  cleanup: () => am09.cleanupAm09(),
  steps: [
    {
      id: 'analyze',
      title: 'Overlaps have names — before any client sends',
      description:
        'Two rules that can both answer the same request is a bug that only '
        + 'surfaces at runtime — a caller gets the wrong body, or '
        + 'a **409 Conflict** — the mock’s **AMBIGUOUS** verdict — and you hear '
        + 'about it from a support ticket. '
        + '**Analyze** catches it far earlier: a static pass over every enabled '
        + 'pair, with no server started and no traffic sent.\n\n'
        + 'What it hands back is not a vague "these look similar" warning — it '
        + 'is a named diagnosis. The overlaps sort into four kinds because they '
        + 'are four genuinely different bugs, each with its own fix:\n\n'
        + '- **Duplicate** — two rules with the identical request line\n'
        + '- **Shadowed** — a catch-all that makes a narrower rule dead at runtime\n'
        + '- **Definite** — a provable collision, like a glob that swallows a literal path\n'
        + '- **Potential** — an overlap the analyzer honestly cannot decide, such as two regexes\n\n'
        + 'The rest of the lesson walks all four, and each time proves the name '
        + 'with a real request.',
      highlight: API_MOCK.ANALYZE,
      preAction: (ctx) => am09.ensureAm09Workspace(ctx),
      action: (ctx) => am09.runAm09Analyze(ctx),
      verify: API_MOCK.CONFLICT_LIST,
    },
    {
      id: 'duplicate',
      title: 'Duplicate is the request line — not the record',
      description:
        'The first and bluntest kind. '
        + `**${AM09_HEALTH_A}** and **${AM09_HEALTH_B}** answer the identical `
        + `request line — \`GET ${AM09_HEALTH_PATH}\`, empty Match, priority 10. `
        + 'Different names, different IDs, but to the router they are '
        + 'indistinguishable.\n\n'
        + 'What is worth absorbing here is *how the inspector knows*. Each rule '
        + 'carries a **fingerprint** — a hash of its whole record — and this '
        + 'pair shows two different hashes over one request line, proof that it '
        + 'is two real records rather than one row counted twice. That same '
        + 'fingerprint is what will make an **Acknowledge** trustworthy later: '
        + 'the instant either rule is edited its hash changes and the waiver '
        + 'expires. Next you send the request they both claim and watch the '
        + 'mock refuse to choose.',
      highlight: API_MOCK.routeNamed(AM09_HEALTH_A),
      preAction: (ctx) => am09.ensureAm09ReadyForPair(ctx, AM09_HEALTH_A),
      action: (ctx) => am09.runAm09Duplicate(ctx),
      verify: API_MOCK.CONFLICT_FINGERPRINTS_OPEN,
    },
    {
      id: 'witness',
      title: 'Simulate this Duplicate — the mock refuses to guess',
      description:
        'A label on a finding is just a claim until you make it happen. Every '
        + 'finding ships a **witness** — the smallest request that triggers the '
        + `overlap, here a bare \`GET ${AM09_HEALTH_PATH}\` — so you never have `
        + 'to hand-craft one.\n\n'
        + 'Running it is the payoff. Both copies match at equal priority, '
        + 'neither is crowned a winner, and because the server rejects ties the '
        + 'caller receives a **409 Conflict** (the mock’s **AMBIGUOUS** verdict) '
        + '— not one of the two bodies. '
        + 'That is the entire case for the Duplicate kind in a single run: the '
        + 'mock would rather refuse than silently guess which copy you meant.',
      highlight: API_MOCK.CONFLICT_SIMULATE,
      preAction: (ctx) => am09.ensureAm09ForWitness(ctx),
      action: async (ctx) => { await am09.runAm09Witness(ctx); },
      verify: API_MOCK.CONFLICT_INSPECTOR,
    },
    {
      id: 'goto-rule',
      title: 'The same Duplicate, from the rule',
      description:
        'A finding is only useful if it leads you to the thing you can change. '
        + '**Open in Studio** closes that gap — it jumps from the inspector '
        + `straight to the offending \`${AM09_HEALTH_PATH}\` rule in the editor, `
        + 'the exact copy whose Match you would edit to break the tie.\n\n'
        + 'Notice the notice: the Match tab calls out the peer that just tied '
        + 'with it in Simulate, so the line from "the analyzer flagged this" to '
        + '"here is the rule to fix" is never left to memory. The finding and '
        + 'the rule are one object. Every one of the remaining three kinds '
        + 'follows this same rhythm — name the pair, prove it with a request, '
        + 'then land on the rule.',
      highlight: API_MOCK.CONFLICT_GOTO_LEFT,
      preAction: (ctx) => am09.ensureAm09ForGoto(ctx),
      action: (ctx) => am09.runAm09GotoRule(ctx),
      verify: API_MOCK.CONFLICT_INSPECTOR,
    },
    {
      id: 'shadowed',
      title: 'Shadowed is a rule that can never win',
      description:
        'Shadowing is subtler than duplication and, in practice, more '
        + `dangerous, because nothing errors. **${AM09_ORDERS_CATCHALL}** is a `
        + `broad \`GET ${AM09_ORDERS_PATH}\` with an empty Match at priority 20, `
        + `and **${AM09_ORDERS_TENANT}** is the same path plus \`x-tenant: acme\` `
        + 'at priority 10.\n\n'
        + 'Because the catch-all matches everything the tenant rule matches '
        + '*and more*, and outranks it, the tenant rule can never win a single '
        + 'request — it is dead code that still looks alive in the library. '
        + 'Unlike a Duplicate there is no **409 Conflict** to tip you off; the caller just '
        + 'quietly gets the wrong rule’s answer. The next step sends the exact '
        + 'request the tenant rule was written for and shows it still losing.',
      highlight: API_MOCK.routeNamed(AM09_ORDERS_CATCHALL),
      preAction: (ctx) => am09.ensureAm09ReadyForPair(ctx, AM09_ORDERS_CATCHALL),
      action: (ctx) => am09.runAm09Shadowed(ctx),
      verify: API_MOCK.CONFLICT_DETAIL,
    },
    {
      id: 'shadowed-witness',
      title: 'Simulate this Shadowed — the tenant header still loses',
      description:
        'Two runs of the same pair, and the whole lesson is in watching the '
        + 'catch-all win both:\n\n'
        + `- **No header** — a plain \`${AM09_ORDERS_PATH}\`. The tenant rule is `
        + 'out of the race for an obvious reason (its header is absent), so the '
        + 'caller gets the catch-all’s **200 OK** `scope: "all"`.\n'
        + `- **With \`${AM09_TENANT_HEADER}\`** — the request **${AM09_ORDERS_TENANT}** `
        + 'was written for. Its condition passes this time, and it *still* '
        + 'loses: priority 20 decided the winner before the header ever '
        + 'mattered, so the same wrong body ships.\n\n'
        + 'Matching is necessary to win, but ranking is what actually decides — '
        + 'which is exactly why a shadowed rule stays invisible until you look.',
      highlight: API_MOCK.CONFLICT_SIMULATE,
      preAction: (ctx) => am09.ensureAm09ForShadowedWitness(ctx),
      action: async (ctx) => { await am09.runAm09ShadowedWitness(ctx); },
      verify: API_MOCK.CONFLICT_INSPECTOR,
    },
    {
      id: 'definite',
      title: 'Definite is a collision the analyzer can prove',
      description:
        'Not every collision is a copy. '
        + `The exact-path **${AM09_DAILY}** (\`${AM09_DAILY_PATH}\`) and the `
        + `**${AM09_REPORTS_GLOB}** glob (\`${AM09_GLOB_PATH}\`) are plainly `
        + 'different rules — yet every request for the daily report hits both. '
        + 'The overlap is real, and unlike the regex case coming later the '
        + 'analyzer can *prove* it without running anything.\n\n'
        + 'That provability is what separates **Definite** from **Potential**: '
        + 'there is no undecidable dimension here, just a literal path the glob '
        + `fully contains. With equal priority and reject on, a caller to `
        + `\`${AM09_DAILY_PATH}\` gets the same **409 Conflict** family you saw with the `
        + 'health duplicates. Next you send two URLs to show this is about the '
        + 'request, not the rule pair in the abstract.',
      highlight: API_MOCK.routeNamed(AM09_DAILY),
      preAction: (ctx) => am09.ensureAm09ReadyForPair(ctx, AM09_DAILY),
      action: (ctx) => am09.runAm09Definite(ctx),
      verify: API_MOCK.CONFLICT_DETAIL,
    },
    {
      id: 'definite-witness',
      title: 'Simulate this Definite — one path collides, the other does not',
      description:
        'The trap with a Definite overlap is assuming the glob rule is broken '
        + 'everywhere. It is not — the collision exists only on the URLs both '
        + 'rules claim, and this step draws that line sharply:\n\n'
        + `- **\`${AM09_DAILY_PATH}\`** — both rules match: equal priority, `
        + 'reject, **409 Conflict**, the mock refuses to pick.\n'
        + `- **\`${AM09_NON_DAILY_PATH}\`** — the exact-path rule’s path fails, `
        + `so \`${AM09_GLOB_PATH}\` wins alone and the caller gets a clean `
        + '**200 OK**.\n\n'
        + 'Same pair of rules, two completely different outcomes, decided '
        + 'entirely by the request. A Definite finding points at *where* to '
        + 'look, never a rule to delete.',
      highlight: API_MOCK.CONFLICT_SIMULATE,
      preAction: (ctx) => am09.ensureAm09ForDefiniteWitness(ctx),
      action: async (ctx) => { await am09.runAm09DefiniteWitness(ctx); },
      verify: API_MOCK.CONFLICT_INSPECTOR,
    },
    {
      id: 'potential',
      title: 'Potential is the honest “we cannot decide”',
      description:
        'The last kind is the most honest one. On the same path, '
        + `**${AM09_SEARCH_PREFIX}** matches \`x-client\` against \`^acme\` and `
        + `**${AM09_SEARCH_REGION}** against \`^acme-.*\` — and whether two `
        + 'regular expressions can ever match the same value is, in general, '
        + 'undecidable. A lesser tool would either ignore it or invent a '
        + 'confident-sounding answer.\n\n'
        + 'The inspector does neither. It marks the header dimension '
        + '**unknown** and files the pair as **Potential** — "these might '
        + 'collide and I cannot prove it either way," not a guessed collision. '
        + 'That restraint *is* the finding. The analyzer cannot manufacture a '
        + '**409 Conflict**, but a concrete request can settle it — which is exactly what '
        + 'the next step does with two headers.',
      highlight: API_MOCK.routeNamed(AM09_SEARCH_PREFIX),
      preAction: (ctx) => am09.ensureAm09ReadyForPair(ctx, AM09_SEARCH_PREFIX),
      action: (ctx) => am09.runAm09Potential(ctx),
      verify: API_MOCK.CONFLICT_DIM_UNKNOWN,
    },
    {
      id: 'potential-witness',
      title: 'Simulate this Potential — the header decides the status',
      description:
        'What the analyzer left as "unknown" turns concrete the instant a '
        + `real \`${AM09_SEARCH_PATH}\` request carries a header, and this step `
        + 'settles it both ways:\n\n'
        + `- **\`${AM09_CLIENT_HEADER_HIT}\`** — matches both regexes at once, `
        + 'so the collision is real for that request and the caller gets a '
        + '**409 Conflict**.\n'
        + '- **No `x-client`** — neither rule matches, so the same pair '
        + 'produces a clean **404 Not Found** — no collision at all.\n\n'
        + 'Both probes are kept as samples you can replay. The takeaway is the '
        + 'division of labor: static analysis is right to stay silent when it '
        + 'cannot know, and Simulate is where an individual request gets a '
        + 'definite answer.',
      highlight: API_MOCK.CONFLICT_SIMULATE,
      preAction: (ctx) => am09.ensureAm09ForPotentialWitness(ctx),
      action: async (ctx) => { await am09.runAm09PotentialWitness(ctx); },
      verify: API_MOCK.CONFLICT_INSPECTOR,
    },
    {
      id: 'fix-priority',
      title: 'Ranking picks a winner — it does not delete the overlap',
      description:
        'There are two very different things you might mean by "fix a '
        + 'conflict." Raise the exact path’s priority to '
        + `**${AM09_PRIORITY_RAISED}** on the still-Definite `
        + `**${AM09_DAILY}** / **${AM09_REPORTS_GLOB}** pair and this step draws `
        + 'the line:\n\n'
        + '- **The symptom, cured** — analysis re-runs and the pair is now '
        + `**Shadowed**; the exact rule outranks the glob on `
        + `\`${AM09_DAILY_PATH}\`, so the caller stops getting a **409 Conflict** there.\n`
        + '- **The overlap, still on the books** — the summary still reads '
        + '**four** findings. The glob did not disappear; you ranked a winner, '
        + 'you did not remove a rule.\n\n'
        + 'Ranking cures the symptom a client feels while deliberately keeping '
        + 'the overlap visible, because pretending it is gone is how the next '
        + 'surprise gets planted.',
      highlight: API_MOCK.CONFLICT_ADJUST_PRIORITY,
      preAction: (ctx) => am09.ensureAm09ForFix(ctx),
      action: (ctx) => am09.runAm09FixPriority(ctx),
      verify: API_MOCK.CONFLICT_SUMMARY,
    },
    {
      id: 'acknowledge',
      title: 'Acknowledge this Duplicate — then break the snapshot',
      description:
        'Some overlaps are intentional — a team keeps both copies on purpose — '
        + 'so the inspector needs a way to say "yes, we know" without nagging '
        + `forever. That is **Acknowledge**, applied here to the `
        + `**${AM09_HEALTH_A}** / **${AM09_HEALTH_B}** Duplicate `
        + `(\`GET ${AM09_HEALTH_PATH}\`), not the Definite pair from the last `
        + 'step.\n\n'
        + 'The property that matters is that the waiver is pinned to *this exact '
        + 'snapshot* of both rules through their fingerprints — not a blanket, '
        + `permanent excuse. To prove it, nudge one copy’s priority `
        + `(${AM09_PRIORITY_DEFAULT} → ${AM09_PRIORITY_STALE}) and re-analyze: `
        + 'the pair is still a Duplicate, but the acknowledgement flips to '
        + '**Stale**, because a fingerprint changed and what you approved is no '
        + 'longer what is on screen. A waiver that survived edits would be worse '
        + 'than none — it would quietly hide a brand-new collision behind an '
        + 'old approval.',
      highlight: API_MOCK.CONFLICT_ACKNOWLEDGE,
      preAction: (ctx) => am09.ensureAm09ForAcknowledge(ctx),
      action: (ctx) => am09.runAm09Acknowledge(ctx),
      verify: API_MOCK.CONFLICT_STALE,
    },
  ],
};
