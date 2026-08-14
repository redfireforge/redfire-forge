/**
 * AM-05 `am-05-request-predicates` — Query, Header, Cookie & Security conditions.
 *
 * Scenario: one rule that answers every caller identically. The corpus is the *problem*;
 * every condition — query, header, security facet, absence guard, cookie regex, and a
 * bulk-composed request shape — is authored live and proven in Simulate.
 * Curriculum: `docs/plan/future/apimock/apimock-demo-curriculum-v2.md` §5 Track B.
 */
import { API_MOCK } from '@shared/selectors';
import type { DemoLesson } from '../../types';
import {
  AM05_COOKIE_KEY,
  AM05_COOKIE_REGEX,
  AM05_FORMAT_KEY,
  AM05_FORMAT_VALUE,
  AM05_GUARD_KEY,
  AM05_HEADER_KEY,
  AM05_HEADER_PREFIX,
  AM05_HEADER_VALUE,
  AM05_QUERY_KEY,
  AM05_QUERY_VALUE,
  AM05_RULE_PATH,
  AM05_SECURITY_VALUE,
  AM05_SIM_QUERY_MATCH,
  AM05_SIM_QUERY_MISS,
  AM05_VERSION_KEY,
  AM05_VERSION_VALUE,
  cleanupAm05,
  ensureAm05CookieCondition,
  ensureAm05FullShape,
  ensureAm05GuardGroup,
  ensureAm05HeaderCondition,
  ensureAm05QueryCondition,
  ensureAm05SecurityCondition,
  ensureAm05Unconditioned,
  prepareAm05Workspace,
  runAm05ConstraintsBulk,
  runAm05CookieRegex,
  runAm05FirstCondition,
  runAm05GuardGroup,
  runAm05HeaderOperators,
  runAm05ProveAll,
  runAm05ProveQuery,
  runAm05SecuritySource,
} from './api-mock-am05-helpers';

const DIAGRAM = `
<svg viewBox="0 0 700 450" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="What a match condition reads from a request, and how groups combine the results">
  <rect x="0" y="0" width="700" height="450" fill="#0f172a" />

  <text x="26" y="34" fill="#f1f5f9" font-family="system-ui" font-size="16" font-weight="600">A condition is source + key + operator + value</text>

  <rect x="26" y="52" width="648" height="128" rx="8" fill="#1e293b" stroke="#3b4a60" />
  <text x="42" y="76" fill="#a8b8cc" font-family="system-ui" font-size="11">The request, normalized before anything is judged</text>
  <text x="42" y="100" fill="#f1f5f9" font-family="ui-monospace" font-size="11">GET /reports?page=2&amp;format=json</text>
  <text x="42" y="122" fill="#f1f5f9" font-family="ui-monospace" font-size="11">AUTHORIZATION: Bearer eyJhbGciOi…</text>
  <text x="42" y="142" fill="#f1f5f9" font-family="ui-monospace" font-size="11">X-Tenant: acme-eu · Cookie: sid=s-2048</text>
  <text x="42" y="166" fill="#64748b" font-family="system-ui" font-size="10">Header names are lower-cased · query keys keep repeats · cookies are split from the Cookie header</text>

  <rect x="26" y="196" width="200" height="112" rx="8" fill="#1e293b" stroke="#3b82f6" />
  <text x="40" y="218" fill="#3b82f6" font-family="system-ui" font-size="12" font-weight="600">Source</text>
  <text x="40" y="240" fill="#a8b8cc" font-family="ui-monospace" font-size="10">query · header · cookie</text>
  <text x="40" y="258" fill="#a8b8cc" font-family="ui-monospace" font-size="10">security · body</text>
  <text x="40" y="276" fill="#a8b8cc" font-family="ui-monospace" font-size="10">pathParam · transport</text>
  <text x="40" y="298" fill="#64748b" font-family="system-ui" font-size="10">where the value comes from</text>

  <rect x="242" y="196" width="200" height="112" rx="8" fill="#1e293b" stroke="#3b4a60" />
  <text x="256" y="218" fill="#f1f5f9" font-family="system-ui" font-size="12" font-weight="600">Operator</text>
  <text x="256" y="240" fill="#a8b8cc" font-family="ui-monospace" font-size="10">exact · contains</text>
  <text x="256" y="258" fill="#a8b8cc" font-family="ui-monospace" font-size="10">prefix · suffix · regex · glob</text>
  <text x="256" y="276" fill="#22c55e" font-family="ui-monospace" font-size="10">present · absent (no value)</text>
  <text x="256" y="298" fill="#64748b" font-family="system-ui" font-size="10">how it is compared</text>

  <rect x="458" y="196" width="216" height="112" rx="8" fill="#1e293b" stroke="#3b4a60" />
  <text x="472" y="218" fill="#f1f5f9" font-family="system-ui" font-size="12" font-weight="600">Group</text>
  <text x="472" y="240" fill="#a8b8cc" font-family="ui-monospace" font-size="10">All of  → every child passes</text>
  <text x="472" y="258" fill="#a8b8cc" font-family="ui-monospace" font-size="10">Any of  → one child passes</text>
  <text x="472" y="276" fill="#f59e0b" font-family="ui-monospace" font-size="10">None of → no child passes</text>
  <text x="472" y="298" fill="#64748b" font-family="system-ui" font-size="10">how results combine</text>

  <line x1="26" y1="330" x2="674" y2="330" stroke="#3b4a60" />
  <text x="26" y="354" fill="#f1f5f9" font-family="system-ui" font-size="13" font-weight="600">Reading the decision trace</text>
  <text x="26" y="376" fill="#a8b8cc" font-family="system-ui" font-size="11">One row per leaf, in tree order. A failing row names the key it read: header "x-debug" was absent.</text>
  <text x="26" y="398" fill="#a8b8cc" font-family="system-ui" font-size="11">Rows show leaf results — inside None of, a red row is the pass. The candidate badge is the rule's verdict.</text>
  <text x="26" y="422" fill="#64748b" font-family="system-ui" font-size="10">Path and method gate first; conditions are only evaluated when both already matched.</text>
  <text x="26" y="440" fill="#64748b" font-family="system-ui" font-size="10">Values are case-sensitive unless you say otherwise; header and query *names* are normalized for you.</text>
</svg>
`;

export const apiMockAm05Lesson: DemoLesson = {
  id: 'am-05-request-predicates',
  domainId: 'protocols',
  category: 'api-mock',
  name: 'Query, Header, Cookie & Security Conditions',
  description:
    'Teach one rule to tell callers apart: query and header conditions, the operator '
    + 'vocabulary, a Security facet instead of hand-parsed auth, a None-of guard, a '
    + 'case-insensitive cookie regex, and a whole request shape composed in one pass.',
  estimatedMinutes: 9,
  initialTab: 'api-mock-studio',
  contentVersion: 1,
  concept: {
    title: 'Same path, different callers — conditions are how a mock tells them apart',
    body:
      'A path gets a request to the right rule. It cannot tell you *who* asked, what they asked '
      + 'for, or whether they were allowed to. That is what **match conditions** are for: the second '
      + 'gate, evaluated only after method and path already matched.\n\n'
      + 'Every condition is four choices. The **source** says where to read from — `query`, `header`, '
      + '`cookie`, `security`, `body`, `pathParam`, `transport`. The **key** names what to read '
      + '(`page`, `authorization`, `sid`). The **operator** says how to compare: `exact`, `contains`, '
      + '`prefix`, `suffix`, `regex`, `glob`, and the two that take no value at all — `present` and '
      + '`absent`. The **value** is what you compare against.\n\n'
      + 'The request is normalized before any of this runs, and the normalization is worth knowing. '
      + 'Header names are lower-cased, so `AUTHORIZATION` and `authorization` are the same key — but '
      + 'header *values* are compared as sent. Query keys keep their repeats, so a key that appeared '
      + 'twice is a list and one matching entry is enough. Cookies are split out of the `Cookie` '
      + 'header into their own map, so a cookie condition never has to parse a string. And the '
      + '`security` source is a shortcut for the auth questions people hand-roll: it reads the '
      + 'Authorization *scheme*, a bearer token *claim*, an API-key header name or location, or the '
      + 'client certificate *subject* from a mutual-TLS handshake.\n\n'
      + 'Conditions live in a **group**, and the group\'s combinator decides how results combine: '
      + '**All of** (every child passes), **Any of** (one is enough), or **None of** — the guard. '
      + '`None of` is how you say "reject when this is true": drop a nested group, set it to None of, '
      + 'and put the thing you want to exclude inside it. Paired with `present` / `absent`, that '
      + 'covers most real routing rules: authenticated *and* not a debug probe.\n\n'
      + 'Two shortcuts save typing. Any `regex` or `glob` condition grows a **wand** that opens the '
      + 'Pattern Toolbox on the same expression, with live samples and an **Ignore case** flag — the '
      + 'same workbench the path uses in **Path Matching & the Pattern Toolbox**. And the toolbox\'s '
      + '**Query & headers** tab composes several constraints at once and applies them as conditions '
      + 'in a single step, which is how you describe a whole request shape without adding rows one at '
      + 'a time.\n\n'
      + 'Then you prove it in **Simulate** — no listener, no traffic. The decision trace prints one '
      + 'row per condition, in tree order, with a tick or a cross, and a failing row names the key it '
      + 'read: `query "page" exact failed — got "3"`. That is the difference between "my mock did not '
      + 'answer" and "the tenant header was wrong". One caveat when reading it: the rows are *leaf* '
      + 'results, so inside a `None of` group a red row is exactly what you want — the rule\'s own '
      + 'verdict is the badge on the candidate, not the ticks beneath it.\n\n'
      + 'Body conditions get their own lesson in **Body Matching**, and what happens when two rules '
      + 'both match is **Boolean Groups, Priority & Policy**.',
    keyTerms: [
      { term: 'Match condition', definition: 'A source + key + operator + value test on the incoming request, evaluated after method and path already matched.' },
      { term: 'Predicate source', definition: 'Where the value is read from: query, header, cookie, security, body, pathParam, or transport.' },
      { term: 'Security source', definition: 'Reads auth facets directly — Authorization scheme, bearer token claim, API-key name or location, or the mTLS client certificate subject.' },
      { term: 'Present / Absent', definition: 'The two value-less operators. Present means the key arrived with a non-empty value; Absent means it did not arrive at all.' },
      { term: 'Combinator', definition: 'How a group folds its children: All of (and), Any of (or), None of (reject when any child passes).' },
      { term: 'Guard group', definition: 'A nested None-of group holding what must not be true — the product\'s way to negate a matcher.' },
      { term: 'Ignore case', definition: 'A regex/glob flag set from the wand. Values are case-sensitive by default; header and query *names* are normalized regardless.' },
      { term: 'Decision trace', definition: 'Simulate\'s per-candidate tick list — one row per condition leaf, with the reason a failing row rejected the request.' },
    ],
    diagram: DIAGRAM,
  },
  prepareBeforeNavigate: prepareAm05Workspace,
  cleanup: cleanupAm05,
  steps: [
    {
      id: 'first-condition',
      title: 'Same path, different behaviour by request shape',
      description:
        `This workspace has one rule — \`GET ${AM05_RULE_PATH}\` — and the Match tab says exactly `
        + 'what that means today: **no conditions**, so it matches on method and path alone. Every '
        + 'caller gets the same page of reports, which is fine until two callers want different '
        + 'answers.\n\n'
        + '**+ Condition** adds a row, and the row is the whole grammar in one line: **source**, '
        + 'key, **operator**, value. A new row starts on `Header` / `Exact` — opening the source '
        + 'picker shows all seven places a condition can read from, including `Cookie`, `Security`, '
        + `and \`Body\`. Pick **Query**, name the key \`${AM05_QUERY_KEY}\`, and set the value to `
        + `\`${AM05_QUERY_VALUE}\`. The rule now answers one page instead of all of them, and the `
        + 'group header keeps a running count of the conditions it holds.',
      highlight: API_MOCK.ADD_CONDITION,
      preAction: ensureAm05Unconditioned,
      action: runAm05FirstCondition,
      verify: API_MOCK.FIRST_CONDITION,
    },
    {
      id: 'prove-query',
      title: 'Matched and unmatched, both on purpose',
      description:
        '**Simulate** evaluates a request against the real matcher with no listener bound, and for '
        + 'conditions it is the fastest way to find out what you actually wrote. Query parameters go '
        + `in the path field, so \`${AM05_SIM_QUERY_MATCH}\` is the whole request — it comes back `
        + '**MATCHED**, and the trace lists the query condition with a tick beside it.\n\n'
        + `Now the run that teaches more: \`${AM05_SIM_QUERY_MISS}\` comes back **UNMATCHED**, the `
        + 'candidate is flagged **Conditions failed** — so you know the path was fine — and the row '
        + `underneath names the culprit: \`query "${AM05_QUERY_KEY}" exact failed — got "3"\`. That `
        + 'sentence is the difference between guessing and knowing, and it is why a condition is '
        + 'worth proving in both directions before anything is served.',
      highlight: API_MOCK.SIMULATE,
      preAction: ensureAm05QueryCondition,
      action: async (ctx) => {
        await runAm05ProveQuery(ctx);
      },
      verify: API_MOCK.FIRST_CONDITION,
    },
    {
      id: 'header-operators',
      title: 'Operators are the vocabulary',
      description:
        `A second condition, this time on a header. \`${AM05_HEADER_KEY}\` is the sort of key `
        + 'multi-tenant systems route on, and `Header` is already the default source — no picker '
        + 'needed.\n\n'
        + 'The **operator** list is where the expressiveness lives: `Exact` and `Contains` for '
        + 'values, `Prefix` and `Suffix` for anchored fragments, `Regex` and `Glob` for shapes, '
        + `\`Present\` and \`Absent\` for existence. Start with **Prefix** \`${AM05_HEADER_PREFIX}\` — `
        + 'every tenant in the account matches, because prefix means "starts with" rather than '
        + `"contains anywhere". Then pin it: **Exact** \`${AM05_HEADER_VALUE}\`, one region only.\n\n`
        + 'Worth knowing while you are here: the header *name* is case-insensitive — the request is '
        + 'normalized before matching, so `X-Tenant` and `x-tenant` are the same key — but the '
        + '*value* is compared exactly as sent. The closing step sends the name in a different case '
        + 'on purpose to prove it.',
      highlight: API_MOCK.ADD_CONDITION,
      preAction: ensureAm05QueryCondition,
      action: runAm05HeaderOperators,
      verify: API_MOCK.LAST_CONDITION,
    },
    {
      id: 'security-source',
      title: 'Auth without hand-parsing a header',
      description:
        'You could match `authorization` with `Prefix Bearer` and be roughly right. The **Security** '
        + 'source is the honest version: it parses the credential for you and lets you assert on one '
        + 'facet of it.\n\n'
        + 'Switch the source to Security and watch the key field change shape — a free-text name is '
        + 'replaced by a dropdown of six facets. **Certificate subject** reads the client identity '
        + 'from a mutual-TLS handshake (note the placeholder turns into `CN=client-name`), '
        + '**Token claim** reads the bearer token itself, **API key name** and **location** answer '
        + '"how did this caller authenticate", and **Scheme** — the one this rule uses — is the word '
        + `before the space. \`Exact ${AM05_SECURITY_VALUE}\` now means "bearer credentials only", and `
        + 'it stays correct no matter what the token looks like.',
      highlight: API_MOCK.ADD_CONDITION,
      preAction: ensureAm05HeaderCondition,
      action: runAm05SecuritySource,
      verify: API_MOCK.LAST_CONDITION,
    },
    {
      id: 'guard-group',
      title: 'Turn a matcher into a guard',
      description:
        'Everything so far describes what a request must *have*. Real routing also needs the '
        + 'opposite — "not this" — and the Studio spells that with a group rather than a per-row '
        + 'negation.\n\n'
        + '**[ ] Group** drops a nested group inside the current one. On its own it is inert (the '
        + 'hint says so: an empty group does not affect matching), but its combinator is the '
        + 'interesting part. **All of** and **Any of** are and/or; **None of** inverts — the group '
        + `passes only when *no* child does. Put one condition inside it, \`${AM05_GUARD_KEY}\` with `
        + 'the **Present** operator, and notice the value box goes disabled: presence needs nothing '
        + 'to compare against. (`Absent` is its mirror, for keys that must not be sent at all.)\n\n'
        + `Read the result aloud: none of — \`${AM05_GUARD_KEY}\` present. The rule now serves normal `
        + 'traffic and steps aside for debug probes, which some other rule can answer instead.',
      highlight: API_MOCK.ADD_GROUP,
      preAction: ensureAm05SecurityCondition,
      action: runAm05GuardGroup,
      verify: API_MOCK.NESTED_GROUPS,
    },
    {
      id: 'cookie-regex',
      title: 'Session-flavoured mocks, and the case flag that matters',
      description:
        `Cookies get their own source — the \`Cookie\` header is already split into a map, so \``
        + `${AM05_COOKIE_KEY}\` is just a key. What makes this one interesting is the operator: the `
        + 'session id has a *shape*, not a value, so **Regex** is the right test.\n\n'
        + 'Choosing Regex grows a **wand** on the row, and it opens the Pattern Toolbox on the same '
        + `expression you are editing. \`${AM05_COOKIE_REGEX}\` is the shape; the sample rows below `
        + 'prove it against real values, and each row carries its own expectation (should match / '
        + 'should fail) so a wrong pattern shows up as a cross immediately. One sample is lower-case '
        + 'on purpose and fails — then **Ignore case** flips it green. That flag rides along with '
        + '**Apply** onto the condition, which is the point: values are compared case-sensitively '
        + 'unless you deliberately say otherwise.',
      highlight: API_MOCK.ADD_CONDITION,
      preAction: ensureAm05GuardGroup,
      action: runAm05CookieRegex,
      verify: API_MOCK.LAST_CONDITION,
    },
    {
      id: 'constraints-bulk',
      title: 'Compose a whole request shape at once',
      description:
        'Adding conditions one row at a time is fine for one or two. When a contract says "this '
        + 'version header, that format parameter, this tenant cookie", the toolbox has a faster '
        + 'path.\n\n'
        + 'The wand beside the **path** opens the same Pattern Toolbox, and its **Query & headers** '
        + 'tab is a small composer: a source, a key, an operator, a value per line, with '
        + '**+ Constraint** for the next one. Nothing is applied while you type — the notice at the '
        + `top says these land as Match conditions. Compose \`${AM05_VERSION_KEY}\` `
        + `\`${AM05_VERSION_VALUE}\` as a header and \`${AM05_FORMAT_KEY}\` \`${AM05_FORMAT_VALUE}\` `
        + 'as a query parameter, then press **Add conditions** — both arrive as ordinary rows, '
        + 'editable like any other, and the group\'s condition count jumps by two. Rows left without '
        + 'a key are simply ignored, so a blank line costs nothing.',
      highlight: API_MOCK.PATH_TOOLBOX,
      preAction: ensureAm05CookieCondition,
      action: runAm05ConstraintsBulk,
      verify: API_MOCK.LAST_CONDITION,
    },
    {
      id: 'prove-all',
      title: 'The trace ticks every predicate, so you know which one failed',
      description:
        'One request, fully shaped: the page and format in the query string, the tenant and version '
        + 'headers, an `Authorization` header for the Security condition, and the session cookie on '
        + 'a `Cookie:` line. It comes back **MATCHED**, and the trace walks the whole rule — method, '
        + 'path, then one row per condition in tree order. The header name is sent in upper case on '
        + 'purpose, and it still matches: names are normalized, values are not.\n\n'
        + `Look closely at the \`${AM05_GUARD_KEY}\` row: it is red, and the rule matched anyway. `
        + 'That is the trace being literal — it prints *leaf* results, and inside a **None of** '
        + 'group a failing leaf is exactly what makes the group pass. The rule\'s own verdict is the '
        + 'badge on the candidate.\n\n'
        + `Then the proof the guard works: send the same request plus \`${AM05_GUARD_KEY}\`, and the `
        + 'rule goes **UNMATCHED** with **Conditions failed** — the debug row now ticks, and that '
        + 'tick is the one you did not want. Seven conditions across five sources, every one of them '
        + 'verified before a single byte was served.',
      highlight: API_MOCK.SIMULATE,
      preAction: ensureAm05FullShape,
      action: async (ctx) => {
        await runAm05ProveAll(ctx);
      },
      verify: API_MOCK.ROUTE_EXPLORER,
    },
  ],
};
