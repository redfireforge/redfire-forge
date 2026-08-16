/**
 * AM-09 `am-09-conflicts` — Conflict Inspector: Four Overlap Kinds → Fix → Acknowledge.
 *
 * Scenario: eight rules already overlap in four path-disjoint pairs. The corpus is
 * the *problem*. Duplicate is one arc (name → Simulate AMBIGUOUS → Open in Studio),
 * then Shadowed → Simulate MATCHED, then Definite → two Simulate probes, then Potential → two header probes, then rank and acknowledge-then-stale.
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
  domainId: 'protocols',
  category: 'api-mock',
  name: 'Conflict Inspector: Four Overlap Kinds',
  description:
    'Two rules that can answer the same request are worse than a mock that '
    + 'answers nothing — the client gets the wrong body, or a 409, and you '
    + 'find out at runtime. The inspector names how they collide, proves it '
    + 'with a witness, and lets you rank a winner or acknowledge an overlap '
    + 'you meant — then tells you when that ack is no longer the pair you reviewed.',
  estimatedMinutes: 13,
  initialTab: 'api-mock-studio',
  contentVersion: 23,
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
      + 'record), a **dimension** table, and a **witness request**. Simulate '
      + 'a Duplicate witness and you see **AMBIGUOUS**. Simulate a Shadowed '
      + 'witness and you see **MATCHED** — the wrong body, not a 409. '
      + `Simulate Definite twice: \`${AM09_DAILY_PATH}\` collides; \`${AM09_NON_DAILY_PATH}\` does not. `
      + `Simulate Potential twice: \`${AM09_CLIENT_HEADER_HIT}\` is **409**; no header is **404**. `
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
        'If two rules can answer the same request, a caller already received '
        + 'the wrong body — or a **409 AMBIGUOUS**. **Analyze** names that '
        + 'overlap before anyone pays for it.\n\n'
        + '- **Static pass** — every enabled pair, compared on method, path, and Match. No port. No traffic.\n'
        + `- **Duplicate** — two \`${AM09_HEALTH_PATH}\` copies, same Match\n`
        + '- **Shadowed** — a catch-all that makes a tenant rule dead at runtime\n'
        + '- **Definite** — a glob that swallows a literal path\n'
        + '- **Potential** — two regexes the analyzer cannot intersect\n\n'
        + 'Four kinds, because they are four different bugs. Next we name '
        + '**Duplicate**, then **Simulate** that request so you see the decision.',
      highlight: API_MOCK.ANALYZE,
      preAction: (ctx) => am09.ensureAm09Workspace(ctx),
      action: (ctx) => am09.runAm09Analyze(ctx),
      verify: API_MOCK.CONFLICT_LIST,
    },
    {
      id: 'duplicate',
      title: 'Duplicate is the request line — not the record',
      description:
        `**${AM09_HEALTH_A}** and **${AM09_HEALTH_B}** are two library rows `
        + `with the same request line: \`GET ${AM09_HEALTH_PATH}\`, empty Match, `
        + 'priority 10.\n\n'
        + '- **Request line** — method + path + Match. Duplicate ignores id and name.\n'
        + '- **Record** — each row is its own object, with its own identity.\n'
        + '- **Rule fingerprints** — SHA-256 of the whole record (id, name, Match, response, priority).\n'
        + '- **Two hashes** — different, because these are two records, not one row copied in memory.\n'
        + '- **Acknowledge** — locked to this exact pair. Edit either side and the waiver expires.\n\n'
        + 'The next step runs this pair’s witness in **Simulate** — same overlap, as a decision.',
      highlight: API_MOCK.routeNamed(AM09_HEALTH_A),
      preAction: (ctx) => am09.ensureAm09ReadyForPair(ctx, AM09_HEALTH_A),
      action: (ctx) => am09.runAm09Duplicate(ctx),
      verify: API_MOCK.CONFLICT_FINGERPRINTS_OPEN,
    },
    {
      id: 'witness',
      title: 'Simulate this Duplicate — the mock refuses to guess',
      description:
        `You just named the pair. Now send the request they both match: `
        + `\`GET ${AM09_HEALTH_PATH}\`.\n\n`
        + '- **Witness** — the finding already ships that request. No headers. Both copies match.\n'
        + '- **Both GET /health** — Decision trace lists two matches at priority 10. Neither is a Winner.\n'
        + '- **AMBIGUOUS** — equal priority plus reject. The mock does not pick Health A or Health B.\n'
        + '- **Rendered response** — status **409** and `{"error":"ambiguous",…}`. That is what a caller would receive.\n\n'
        + 'A label without this run is only a name. This is what the conflict *does*.',
      highlight: API_MOCK.CONFLICT_WITNESS,
      preAction: (ctx) => am09.ensureAm09ForWitness(ctx),
      action: async (ctx) => { await am09.runAm09Witness(ctx); },
      verify: API_MOCK.CONFLICT_INSPECTOR,
    },
    {
      id: 'goto-rule',
      title: 'The same Duplicate, from the rule',
      description:
        'You saw **AMBIGUOUS**. **Open in Studio** is the same pair from the '
        + 'editor — where a Match would change.\n\n'
        + `- **Selected rule** — the left-hand copy, path \`${AM09_HEALTH_PATH}\`.\n`
        + '- **Match-tab notice** — names the peer that just tied in Simulate.\n'
        + '- **One object** — the finding and the rule.\n\n'
        + 'The other three kinds use the same pattern: two Studio rules, then the inspector name.',
      highlight: API_MOCK.CONFLICT_GOTO_LEFT,
      preAction: (ctx) => am09.ensureAm09ForGoto(ctx),
      action: (ctx) => am09.runAm09GotoRule(ctx),
      verify: API_MOCK.CONFLICT_INSPECTOR,
    },
    {
      id: 'shadowed',
      title: 'Shadowed is a rule that can never win',
      description:
        `**${AM09_ORDERS_CATCHALL}** is \`GET /orders\` at priority 20 with `
        + `an empty Match. **${AM09_ORDERS_TENANT}** is the same path plus `
        + '`x-tenant: acme`, at priority 10.\n\n'
        + '- **Superset** — every tenant request also matches the empty catch-all.\n'
        + '- **Priority** — 20 ranks above 10, so the catch-all always wins.\n'
        + '- **Shadowed** — the tenant rule stays in the library and is dead at runtime.\n'
        + '- **Dimensions** — method and path overlap; the header is the difference.\n'
        + '- **Unlike Duplicate** — a caller still gets an answer. The wrong rule wins; there is no 409.\n\n'
        + 'The next step runs this pair’s witness in **Simulate** — same overlap, as a decision.',
      highlight: API_MOCK.routeNamed(AM09_ORDERS_CATCHALL),
      preAction: (ctx) => am09.ensureAm09ReadyForPair(ctx, AM09_ORDERS_CATCHALL),
      action: (ctx) => am09.runAm09Shadowed(ctx),
      verify: API_MOCK.CONFLICT_DETAIL,
    },
    {
      id: 'shadowed-witness',
      title: 'Simulate this Shadowed — the catch-all still wins',
      description:
        `You just named the pair. Now send the request the tenant rule was `
        + `written for: \`GET ${AM09_ORDERS_PATH}\` with \`${AM09_TENANT_HEADER}\`.\n\n`
        + '- **Witness** — the finding already ships that request, including the tenant header. Both rules match.\n'
        + '- **Both GET /orders** — Decision trace lists two matches. The catch-all is **Winner**.\n'
        + '- **MATCHED** — ranking already picked a winner. Unlike Duplicate, there is no 409.\n'
        + '- **Rendered response** — status **200** and `{"orders":[],"scope":"all"}`. The tenant body never ships.\n\n'
        + 'A caller still gets an answer. It is the catch-all’s answer — the more specific rule never ran.',
      highlight: API_MOCK.CONFLICT_WITNESS,
      preAction: (ctx) => am09.ensureAm09ForShadowedWitness(ctx),
      action: async (ctx) => { await am09.runAm09ShadowedWitness(ctx); },
      verify: API_MOCK.CONFLICT_INSPECTOR,
    },
    {
      id: 'definite',
      title: 'Definite is a collision the analyzer can prove',
      description:
        `**${AM09_DAILY}** is the exact path \`${AM09_DAILY_PATH}\`. `
        + `**${AM09_REPORTS_GLOB}** is \`${AM09_GLOB_PATH}\`.\n\n`
        + '- **Not Duplicate** — the Match trees differ.\n'
        + '- **Provable collision** — every daily request hits both. No traffic required.\n'
        + '- **Equal priority + reject** — a real caller receives **409**, same family as the health Simulate.\n'
        + '- **No unknown dimension** — unlike Potential, the glob swallowing the literal is decided.\n\n'
        + 'The next step Simulates two paths — the collision, then a request the glob owns alone.',
      highlight: API_MOCK.routeNamed(AM09_DAILY),
      preAction: (ctx) => am09.ensureAm09ReadyForPair(ctx, AM09_DAILY),
      action: (ctx) => am09.runAm09Definite(ctx),
      verify: API_MOCK.CONFLICT_DETAIL,
    },
    {
      id: 'definite-witness',
      title: 'Simulate this Definite — one path collides, the other does not',
      description:
        `Definite is not “every request under the glob.” Two probes, same pair — `
        + 'watch what the caller actually receives.\n\n'
        + `- **\`${AM09_DAILY_PATH}\`** — **409** and \`{"error":"ambiguous",…}\`. Both rules match; equal priority plus reject. The mock refuses to pick Daily or the glob.\n`
        + `- **\`${AM09_NON_DAILY_PATH}\`** — **200** and \`{"report":"any"}\`. Daily’s exact path misses. Only \`${AM09_GLOB_PATH}\` matches, so the glob is Winner and its body ships.\n`
        + '- **Path failed** — Daily stays in the library; it simply does not apply to this URL.\n\n'
        + 'Same pair. One URL is a collision. The other is a normal 200.',
      highlight: API_MOCK.CONFLICT_WITNESS,
      preAction: (ctx) => am09.ensureAm09ForDefiniteWitness(ctx),
      action: async (ctx) => { await am09.runAm09DefiniteWitness(ctx); },
      verify: API_MOCK.CONFLICT_INSPECTOR,
    },
    {
      id: 'potential',
      title: 'Potential is the honest “we cannot decide”',
      description:
        `**${AM09_SEARCH_PREFIX}** matches \`x-client\` \`^acme\`. `
        + `**${AM09_SEARCH_REGION}** matches \`^acme-.*\`. Same path, two `
        + 'regular expressions.\n\n'
        + '- **Regex ∩ regex** — undecidable in the general case. The analyzer does not invent an intersection.\n'
        + '- **Unknown dimension** — the header row stays unknown. That row is the finding.\n'
        + '- **Potential** — “cannot decide,” not “guessed they collide.”\n'
        + '- **Unlike Duplicate** — the analyzer cannot prove a 409. A concrete header can.\n\n'
        + 'The next step Simulates two headers — one that hits both regexes, one that hits neither.',
      highlight: API_MOCK.routeNamed(AM09_SEARCH_PREFIX),
      preAction: (ctx) => am09.ensureAm09ReadyForPair(ctx, AM09_SEARCH_PREFIX),
      action: (ctx) => am09.runAm09Potential(ctx),
      verify: API_MOCK.CONFLICT_DIM_UNKNOWN,
    },
    {
      id: 'potential-witness',
      title: 'Simulate this Potential — the header decides the status',
      description:
        `Potential stays unknown until a real \`${AM09_SEARCH_PATH}\` request `
        + 'carries a header. Two probes, same pair — watch the status.\n\n'
        + `- **\`${AM09_CLIENT_HEADER_HIT}\`** — **409** and \`{"error":"ambiguous",…}\`. Both \`^acme\` and \`^acme-.*\` match this value. The collision is real for this request.\n`
        + `- **No \`x-client\`** — **404** and \`{"error":"not_found",…}\`. Neither rule matches. Same pair, no collision.\n`
        + '- **Save as sample** — each probe is kept so you can re-run either header.\n\n'
        + 'The analyzer would not invent that intersection. Simulate decides per request.',
      highlight: API_MOCK.CONFLICT_WITNESS,
      preAction: (ctx) => am09.ensureAm09ForPotentialWitness(ctx),
      action: async (ctx) => { await am09.runAm09PotentialWitness(ctx); },
      verify: API_MOCK.CONFLICT_INSPECTOR,
    },
    {
      id: 'fix-priority',
      title: 'Ranking picks a winner — it does not delete the overlap',
      description:
        `**${AM09_DAILY}** and **${AM09_REPORTS_GLOB}** are still Definite, `
        + 'both at priority 10.\n\n'
        + `- **Adjust priority** — raises the exact path to **${AM09_PRIORITY_RAISED}**. Analysis re-runs.\n`
        + '- **Kind change** — the exact path always wins, so the pair becomes **Shadowed**.\n'
        + '- **Glob still matches** — it cannot win on `/reports/daily`.\n'
        + '- **Definite empties** — the pair did not vanish.\n'
        + '- **Summary stays 4** — ranking picks a winner; it does not delete a copy.\n\n'
        + 'A caller no longer receives 409 on `/reports/daily`. The glob remains in the library.',
      highlight: API_MOCK.CONFLICT_ADJUST_PRIORITY,
      preAction: (ctx) => am09.ensureAm09ForFix(ctx),
      action: (ctx) => am09.runAm09FixPriority(ctx),
      verify: API_MOCK.CONFLICT_SUMMARY,
    },
    {
      id: 'acknowledge',
      title: 'Acknowledge is a snapshot — not a lifetime waiver',
      description:
        'Some overlaps are intentional. **Acknowledge** records that you '
        + 'reviewed this pair.\n\n'
        + '- **Bound to fingerprints** — the banner is valid only while both SHA-256 hashes stay the same.\n'
        + `- **Priority edit** — the left copy moves to **${AM09_PRIORITY_STALE}**.\n`
        + '- **Kind unchanged** — Duplicate ignores priority, so the classification stays Duplicate.\n'
        + '- **Hash changed** — the record is no longer the pair you reviewed.\n'
        + '- **Stale** — Re-analyze marks the same pair. Review again.\n\n'
        + 'A waiver that survived edits would hide a new collision.',
      highlight: API_MOCK.CONFLICT_ACKNOWLEDGE,
      preAction: (ctx) => am09.ensureAm09ForAcknowledge(ctx),
      action: (ctx) => am09.runAm09Acknowledge(ctx),
      verify: API_MOCK.CONFLICT_STALE,
    },
  ],
};
