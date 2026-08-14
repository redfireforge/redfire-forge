/**
 * AM-09 `am-09-conflicts` — Conflict Inspector: Four Overlap Kinds → Fix → Acknowledge.
 *
 * Scenario: eight rules already overlap in four path-disjoint pairs. The corpus is
 * the *problem*; Analyze, the four kind filters, a witness Simulate, Open in Studio,
 * the priority quick-fix, and acknowledge-then-stale are authored live.
 * Curriculum: `docs/plan/future/apimock/apimock-demo-curriculum-v2.md` §5 Track B.
 */
import { API_MOCK } from '@shared/selectors';
import type { DemoLesson } from '../../types';
import {
  AM09_DAILY,
  AM09_HEALTH_A,
  AM09_HEALTH_B,
  AM09_HEALTH_PATH,
  AM09_PRIORITY_RAISED,
  AM09_PRIORITY_STALE,
  cleanupAm09,
  ensureAm09Analyzed,
  ensureAm09ForAcknowledge,
  ensureAm09ForFix,
  ensureAm09ForGoto,
  ensureAm09ForWitness,
  prepareAm09Workspace,
  runAm09Acknowledge,
  runAm09Analyze,
  runAm09DefiniteVsPotential,
  runAm09Duplicate,
  runAm09FixPriority,
  runAm09GotoRule,
  runAm09Shadowed,
  runAm09Witness,
} from './api-mock-am09-helpers';

const DIAGRAM = `
<svg viewBox="0 0 700 430" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Four overlap kinds the Conflict Inspector can name">
  <rect x="0" y="0" width="700" height="430" fill="#0f172a" />

  <text x="26" y="34" fill="#f1f5f9" font-family="system-ui" font-size="16" font-weight="600">Four ways two rules can collide</text>
  <text x="26" y="54" fill="#64748b" font-family="system-ui" font-size="10">Static analysis. No listener. No traffic. The inspector names the overlap before a client ever sends it.</text>

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
    'Eight rules already overlap in four different ways. Analyze without starting a '
    + 'listener, filter Duplicate / Shadowed / Definite / Potential, simulate the '
    + 'witness that proves a collision, jump to the offending rule, raise priority '
    + 'to reclassify a definite overlap, then acknowledge what you meant and watch '
    + 'the ack go stale when a fingerprint changes.',
  estimatedMinutes: 7,
  initialTab: 'api-mock-studio',
  contentVersion: 1,
  concept: {
    title: 'The inspector names overlaps before a client ever sends them.',
    body:
      'A mock that answers the wrong rule is worse than a mock that answers nothing. '
      + 'Two copies of `GET /health`, a catch-all sitting in front of a tenant rule, '
      + 'a glob that swallows a literal, two regexes the analyzer cannot intersect — '
      + 'those are four different bugs, and they need four different names.\n\n'
      + '**Analyze** is static. No listener, no traffic, no Apply. It walks every '
      + 'enabled pair and writes a finding: **Duplicate** when method, path, and Match '
      + `are identical (${AM09_HEALTH_A} vs ${AM09_HEALTH_B}); **Shadowed** when a `
      + 'higher-priority superset means the other rule can never win; **Definite '
      + 'overlap** when the collision is provable but the rules are not copies '
      + `(\`${AM09_DAILY}\` vs a \`/reports/*\` glob); **Potential overlap** when a `
      + 'dimension is undecidable — regex against regex is the textbook case.\n\n'
      + 'Filters hide the other kinds so you can read one finding at a time. Each '
      + 'finding carries **fingerprints** of each rule record (ack goes stale when '
      + 'either hash changes), a **dimension** '
      + 'table (method / path / each predicate), and a **witness request** that '
      + 'triggers the overlap. **Simulate** on that witness is how you see '
      + '**AMBIGUOUS** without binding a port.\n\n'
      + '**Open in Studio** jumps to the left-hand rule so the Match-tab notice is '
      + 'no longer abstract. **Adjust priority** is the quick-fix: raising one side '
      + `by 10 re-runs analysis. A definite pair often becomes Shadowed — the `
      + 'Definite filter empties, the finding count stays four, because ranking is '
      + 'not the same as deleting a copy.\n\n'
      + '**Acknowledge** is for overlaps you meant. The ack is bound to both '
      + 'fingerprints. Edit a rule — even a one-step priority bump that does not '
      + `change the kind — and Re-analyze marks it **Stale**. That is the contract: `
      + 'accept what you reviewed, get told when it is no longer the thing you reviewed.',
    keyTerms: [
      { term: 'Analyze', definition: 'Static pair-wise inspection of enabled rules. No listener, no traffic — a pre-Apply safety pass.' },
      { term: 'Duplicate', definition: 'Identical method, path kind and value, and Match tree. Priority is not part of the test.' },
      { term: 'Shadowed', definition: 'A higher-priority rule whose Match is a superset of the peer, so the narrower rule can never win.' },
      { term: 'Definite overlap', definition: 'The analyzer can prove both rules match some request, but they are not copies — for example an exact path vs a capturing glob.' },
      { term: 'Potential overlap', definition: 'At least one dimension is undecidable statically, most often regex ∩ regex. The honest answer is unknown, not a guessed collision.' },
      { term: 'Witness request', definition: 'A synthetic request the finding ships that is enough to trigger the overlap in Simulate.' },
      { term: 'Fingerprint', definition: 'SHA-256 of the whole rule record (id, name, Match, response, priority). Two duplicates usually have different hashes. Acknowledgements stay valid only while both hashes stay the same.' },
      { term: 'Stale acknowledgement', definition: 'The same rule pair was acknowledged, then a later edit changed a fingerprint. Re-review, then ack again.' },
    ],
    diagram: DIAGRAM,
  },
  prepareBeforeNavigate: prepareAm09Workspace,
  cleanup: cleanupAm09,
  steps: [
    {
      id: 'analyze',
      title: 'Analysis is static. No listener, no traffic.',
      description:
        'These eight rules already overlap. You do not need to Start anything to '
        + 'find out — **Analyze all** walks every enabled pair and writes findings '
        + 'before a client ever sends a request. That is the pre-Apply safety pass.\n\n'
        + 'Four findings land in the inspector: one Duplicate, one Shadowed, one '
        + 'Definite, one Potential. Jump back to Studio and open **Health A** — the '
        + 'Match tab now carries a conflict notice naming its peer. Return to '
        + 'Conflicts and **Re-analyze** so you see the page-level button, not only '
        + 'the explorer shortcut. The summary still reads four findings.',
      highlight: API_MOCK.ANALYZE,
      preAction: ensureAm09Analyzed,
      action: runAm09Analyze,
      verify: API_MOCK.CONFLICT_LIST,
    },
    {
      id: 'duplicate',
      title: 'Duplicate means the Match is identical — not the hashes',
      description:
        `**${AM09_HEALTH_A}** and **${AM09_HEALTH_B}** are the same method, the same `
        + `path \`${AM09_HEALTH_PATH}\`, and the same empty Match. Filter to `
        + '**Duplicate** so the other three kinds get out of the way, then read the '
        + 'row: two copies, equal priority, reject-as-ambiguous.\n\n'
        + 'Open **Rule fingerprints**. The two SHA-256 values are **different** — '
        + 'these are two rule records (names, ids, and response bodies differ). '
        + 'Duplicate only compares method, path, and Match. An acknowledgement later '
        + 'in the lesson is bound to both hashes: change either copy and the ack expires.',
      highlight: API_MOCK.conflictFilter('duplicate'),
      preAction: ensureAm09Analyzed,
      action: runAm09Duplicate,
      verify: API_MOCK.CONFLICT_FINGERPRINTS_OPEN,
    },
    {
      id: 'shadowed',
      title: 'A higher-priority superset means the other rule never wins',
      description:
        '**Orders catch-all** sits at priority 20 with an empty Match. **Orders tenant** '
        + 'is the same `GET /orders` plus `x-tenant: acme`, at 10. Filter to **Shadowed**. '
        + 'The catch-all is a superset: every request the tenant rule wants, the '
        + 'catch-all can answer first.\n\n'
        + 'Hold the dimension table. Method overlaps, path overlaps, and the header '
        + 'row is the difference — the inspector still names it Shadowed because '
        + 'priority plus an empty Match is enough. The tenant rule is not dead code '
        + 'in the library; it is dead at runtime until you raise it or narrow the catch-all.',
      highlight: API_MOCK.conflictFilter('shadowed'),
      preAction: ensureAm09Analyzed,
      action: runAm09Shadowed,
      verify: API_MOCK.CONFLICT_DETAIL,
    },
    {
      id: 'definite-vs-potential',
      title: 'Always collides vs cannot be decided statically',
      description:
        `**Definite** is "we can prove it". \`${AM09_DAILY}\` is an exact path; `
        + '**Reports glob** is `/reports/*`. They are not copies, but every daily '
        + 'request matches both. Filter to **Definite** and read that pair.\n\n'
        + '**Potential** is "we cannot decide". Switch the filter. **Search prefix** '
        + 'and **Search region** share `GET /search` and two `x-client` regexes — '
        + '`^acme` vs `^acme-.*`. Regex ∩ regex is undecidable, so the header '
        + 'dimension stays **unknown**. That is the honest answer, not a guessed '
        + 'collision. A witness without that header will not even match; the kind '
        + 'exists to stop you pretending the analyzer knows more than it does.',
      highlight: API_MOCK.conflictFilter('definite_overlap'),
      preAction: ensureAm09Analyzed,
      action: runAm09DefiniteVsPotential,
      verify: API_MOCK.CONFLICT_DIM_UNKNOWN,
    },
    {
      id: 'witness',
      title: 'Every finding ships a request that triggers it',
      description:
        'Back on **Duplicate**, the witness is a plain `GET /health` — no headers, '
        + 'because both copies match on method and path alone. Read the HTTP block, '
        + 'then **Simulate**. The form is already seeded; review the path, save the '
        + 'probe, and hold on **Run simulation** before the click.\n\n'
        + '**AMBIGUOUS** is the equal-priority policy refusing to guess. Close '
        + 'Simulate so the inspector is the thing you are looking at again — the '
        + 'next step jumps from a finding into Studio, and an open modal would cover it.',
      highlight: API_MOCK.CONFLICT_WITNESS,
      preAction: ensureAm09ForWitness,
      action: async (ctx) => {
        await runAm09Witness(ctx);
      },
      verify: API_MOCK.CONFLICT_INSPECTOR,
    },
    {
      id: 'goto-rule',
      title: 'Jump from the finding to the offending rule',
      description:
        '**Open in Studio** on the left-hand copy selects that rule and switches '
        + 'the main view. The path field is still `/health`, and the Match-tab '
        + 'notice names the peer you just simulated against. That is the same overlap '
        + 'from the rule\'s point of view, not the inspector\'s.\n\n'
        + 'Return to **Conflicts** before the step ends. The next beat is a quick-fix '
        + 'that lives on the finding, and it cannot run while the editor is covering '
        + 'the inspector.',
      highlight: API_MOCK.CONFLICT_GOTO_LEFT,
      preAction: ensureAm09ForGoto,
      action: runAm09GotoRule,
      verify: API_MOCK.CONFLICT_INSPECTOR,
    },
    {
      id: 'fix-priority',
      title: 'Raising one side reclassifies. It does not delete the overlap.',
      description:
        `Filter to **Definite** — \`${AM09_DAILY}\` vs **Reports glob**, both at 10. `
        + '**Adjust priority** opens a menu that names both sides. Raise the left '
        + `copy to ${AM09_PRIORITY_RAISED}. Analysis re-runs by itself.\n\n`
        + 'The Definite filter now says **No findings in this filter.** The pair did '
        + 'not vanish — a higher-priority empty Match is a superset, so the same two '
        + 'rules are now **Shadowed**. Switch to Shadowed and read the extra row. The '
        + 'summary is still four findings. Ranking is a fix for *which* rule wins, '
        + 'not a delete.',
      highlight: API_MOCK.CONFLICT_ADJUST_PRIORITY,
      preAction: ensureAm09ForFix,
      action: runAm09FixPriority,
      verify: API_MOCK.CONFLICT_SUMMARY,
    },
    {
      id: 'acknowledge',
      title: 'Ack what you meant. Get told when it changes.',
      description:
        'The remaining **Duplicate** is the overlap you might keep on purpose — two '
        + 'health copies waiting for a later split. **Acknowledge** binds the finding '
        + 'to both fingerprints and shows the Ack banner.\n\n'
        + `Open the left copy and bump Priority to **${AM09_PRIORITY_STALE}**. That is `
        + 'not enough to change the kind (duplicates ignore priority), but it is '
        + 'enough to change the hash. Back on Conflicts, **Re-analyze**. The same '
        + 'pair is now **Stale** — review it again, then ack again. An acknowledgement '
        + 'is a snapshot, not a lifetime waiver.',
      highlight: API_MOCK.CONFLICT_ACKNOWLEDGE,
      preAction: ensureAm09ForAcknowledge,
      action: runAm09Acknowledge,
      verify: API_MOCK.CONFLICT_STALE,
    },
  ],
};
