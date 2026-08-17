/**
 * AM-04 `am-04-path-matching` — Path Matching & the Pattern Toolbox.
 *
 * Scenario: one hard-coded rule captured from a real request. The corpus is the
 * *problem*; every matcher kind — parameterized, glob, regex — is authored live, tested
 * in the toolbox, and proven in Simulate.
 * Curriculum: `docs/plan/future/apimock/apimock-demo-curriculum-v2.md` §5 Track B.
 */
import { API_MOCK } from '@shared/selectors';
import type { DemoLesson } from '../../types';
import {
  AM04_ASSET_GLOB_PATH,
  AM04_ASSET_NARROW_PATTERN,
  AM04_ASSET_TEST_PATH,
  AM04_LIBRARY_ENTRY,
  AM04_LITERAL_PATH,
  AM04_ORDER_LITERAL_PATH,
  AM04_ORDER_TEMPLATE_PATH,
  AM04_ORDER_TEST_PATH,
  AM04_PARAM_PATH,
  AM04_REGEX_PATH,
  AM04_SIM_LOOSE_PATH,
  AM04_SIM_PARAM_PATH,
  cleanupAm04,
  ensureAm04LiteralPath,
  ensureAm04OrderRule,
  ensureAm04ParamPath,
  ensureAm04ProofReady,
  ensureAm04RegexReady,
  prepareAm04Workspace,
  runAm04ExactToParam,
  runAm04Generalize,
  runAm04Glob,
  runAm04ProveParam,
  runAm04ProveRegex,
  runAm04RegexLibrary,
  runAm04ToolboxTour,
} from './api-mock-am04-helpers';

const DIAGRAM = `
<svg viewBox="0 0 700 430" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Four path matcher kinds, how each is written, and what it captures">
  <rect x="0" y="0" width="700" height="430" fill="#0f172a" />

  <text x="26" y="34" fill="#f1f5f9" font-family="system-ui" font-size="16" font-weight="600">Four ways to describe a path</text>

  <rect x="26" y="52" width="648" height="60" rx="8" fill="#1e293b" stroke="#3b4a60" />
  <rect x="40" y="66" width="86" height="18" rx="9" fill="#0f172a" stroke="#3b4a60" />
  <text x="52" y="79" fill="#a8b8cc" font-family="ui-monospace" font-size="10">exact</text>
  <text x="142" y="79" fill="#f1f5f9" font-family="ui-monospace" font-size="11">/products/42</text>
  <text x="330" y="79" fill="#64748b" font-family="system-ui" font-size="11">one literal path, character for character</text>
  <text x="142" y="99" fill="#64748b" font-family="system-ui" font-size="10">captures nothing</text>

  <rect x="26" y="120" width="648" height="60" rx="8" fill="#1e293b" stroke="#3b82f6" />
  <rect x="40" y="134" width="86" height="18" rx="9" fill="#0f172a" stroke="#3b82f6" />
  <text x="46" y="147" fill="#3b82f6" font-family="ui-monospace" font-size="10">parameterized</text>
  <text x="142" y="147" fill="#f1f5f9" font-family="ui-monospace" font-size="11">/products/:id</text>
  <text x="330" y="147" fill="#64748b" font-family="system-ui" font-size="11">exact segment count, one segment per param</text>
  <text x="142" y="167" fill="#22c55e" font-family="system-ui" font-size="10">captures id = 42</text>

  <rect x="26" y="188" width="648" height="60" rx="8" fill="#1e293b" stroke="#3b4a60" />
  <rect x="40" y="202" width="86" height="18" rx="9" fill="#0f172a" stroke="#3b4a60" />
  <text x="60" y="215" fill="#a8b8cc" font-family="ui-monospace" font-size="10">glob</text>
  <text x="142" y="215" fill="#f1f5f9" font-family="ui-monospace" font-size="11">/assets/**</text>
  <text x="330" y="215" fill="#64748b" font-family="system-ui" font-size="11">* stays in one segment · ** walks the subtree</text>
  <text x="142" y="235" fill="#64748b" font-family="system-ui" font-size="10">captures nothing</text>

  <rect x="26" y="256" width="648" height="60" rx="8" fill="#1e293b" stroke="#3b4a60" />
  <rect x="40" y="270" width="86" height="18" rx="9" fill="#0f172a" stroke="#3b4a60" />
  <text x="58" y="283" fill="#a8b8cc" font-family="ui-monospace" font-size="10">regex</text>
  <text x="142" y="283" fill="#f1f5f9" font-family="ui-monospace" font-size="11">^/products/[0-9]+$</text>
  <text x="330" y="283" fill="#64748b" font-family="system-ui" font-size="11">anchored, so /products/abc is rejected</text>
  <text x="142" y="303" fill="#64748b" font-family="system-ui" font-size="10">captures nothing — precision instead</text>

  <line x1="26" y1="332" x2="674" y2="332" stroke="#3b4a60" />
  <text x="26" y="356" fill="#f1f5f9" font-family="system-ui" font-size="13" font-weight="600">The kind is inferred from what you type</text>
  <text x="26" y="378" fill="#a8b8cc" font-family="system-ui" font-size="11">:id or {id} → parameterized · * or ? → glob · everything else → exact. Regex is the one choice you make deliberately.</text>
  <text x="26" y="402" fill="#a8b8cc" font-family="system-ui" font-size="11">The Pattern Toolbox is a workbench: compose, test against a sample path, read the captures — the rule changes only on Apply.</text>
  <text x="26" y="422" fill="#64748b" font-family="system-ui" font-size="10">Specificity, not pattern length, breaks ties: exact beats parameterized beats glob beats regex at equal priority.</text>
</svg>
`;

export const apiMockAm04Lesson: DemoLesson = {
  id: 'am-04-path-matching',
  domainId: 'protocols',
  category: 'api-mock',
  name: 'Path Matching & the Pattern Toolbox',
  description:
    'Turn one hard-coded path into a matcher that scales: parameterized templates with '
    + 'captures, globs for whole subtrees, and an anchored regex from the pattern library — each '
    + 'tested in the toolbox and proven in Simulate.',
  estimatedMinutes: 8,
  initialTab: 'api-mock-studio',
  contentVersion: 3,
  concept: {
    title: 'The path is the first thing every request is judged on',
    body:
      'Every mock rule starts with a path, and the path is the first gate a request passes through — '
      + 'before methods, before headers, before bodies. Get it wrong in the strict direction and your '
      + 'mock answers exactly one URL; get it wrong in the loose direction and it swallows requests that '
      + 'belonged to another rule.\n\n'
      + 'A rule captured from real traffic always starts strict. `GET /products/42` is a perfectly good '
      + 'recording and a poor mock: product 43 gets nothing. The fix is to describe the *shape* of the '
      + 'path instead of one instance of it, and the Studio gives you four ways to do that.\n\n'
      + '**Exact** is the literal — one path, character for character. **Parameterized** replaces a '
      + 'segment with `:id` or `{id}`: the segment count still has to match, but each parameter captures '
      + 'the value that appeared there, which later becomes available to your response. **Glob** is for '
      + 'prefix trees — `*` matches inside a single segment, `**` walks the whole subtree, which is how '
      + 'you catch every asset or proxy under one route. **Regex** is for when a shape needs a *rule*, '
      + 'not a wildcard: numeric ids only, a version prefix, a code format.\n\n'
      + 'The kind is inferred as you type — `:id` or `{id}` makes it parameterized, a `*` or `?` makes it '
      + 'a glob — so the badge next to the path always tells you how the matcher will actually behave. '
      + 'Regex is the exception: no path string implies it, so you choose it deliberately.\n\n'
      + 'The **Pattern Toolbox** (the wand beside the path) is where you get this right before it goes '
      + 'live. It is a workbench, not a hint popup: pick a preset, generalize a recorded path segment by '
      + 'segment, type a test path and watch the verdict and the captured parameters update as you type, '
      + 'or take a tested expression off the regex library shelf with pass and fail samples attached. '
      + 'Nothing touches the rule until you press **Apply** — Cancel leaves the matcher exactly as it was.\n\n'
      + 'Then you prove it. **Simulate** runs an ad-hoc request through the real matcher with no listener '
      + 'and no traffic, and the decision trace names the winner or shows you which candidate failed on '
      + 'path. A matcher you have not run against a request that should *fail* is still a guess.\n\n'
      + 'One consequence worth knowing early: when two rules both match, priority decides, and at equal '
      + 'priority the more specific kind wins — exact over parameterized over glob over regex. That is '
      + 'why a broad `**` catch-all can coexist with the precise rules above it. Selection policy and '
      + 'overlaps get their own lesson in **Boolean Groups, Priority & Policy**; the conditions that '
      + 'refine a match beyond the path are covered in **Query, Header, Cookie & Security**.',
    keyTerms: [
      { term: 'Path kind', definition: 'How the path string is interpreted: exact, parameterized, glob, or regex. Shown as a badge beside the path and inferred from what you type (regex excepted).' },
      { term: 'Parameterized path', definition: '`/products/:id` or `/products/{id}`. Segment counts must match, and each named segment is captured — a match that also extracts data.' },
      { term: 'Path parameter capture', definition: 'The value a `:param` matched, e.g. `id = 7`. Visible live in the toolbox Extraction panel and available to response templating.' },
      { term: 'Glob', definition: 'Wildcard path matching. `*` matches within one segment (`/assets/*.png`), `**` crosses segments (`/assets/**`) for a whole subtree.' },
      { term: 'Anchored regex', definition: 'A path regex bounded by `^` and `$`, so it matches the entire path rather than any substring. The toolbox anchors an unanchored expression for you.' },
      { term: 'Pattern Toolbox', definition: 'The wand beside the path: presets, segment generalization, a live test path with verdict and captures, and a regex library with pass/fail samples. Applies only on Apply.' },
      { term: 'Specificity', definition: 'The tie-breaker at equal priority: exact beats parameterized beats glob beats regex, so a broad catch-all cannot steal a request from a precise rule.' },
    ],
    diagram: DIAGRAM,
  },
  prepareBeforeNavigate: prepareAm04Workspace,
  cleanup: cleanupAm04,
  steps: [
    {
      id: 'exact-to-param',
      title: 'A recorded path is a literal, and literals do not scale',
      description:
        `This workspace has one rule, and it came from one real request: \`${AM04_LITERAL_PATH}\`. The `
        + 'badge beside the path reads **exact**, which is the honest description — this rule answers that '
        + 'URL and nothing else. Product 43 gets no mock at all.\n\n'
        + `Rewriting the last segment as \`${AM04_PARAM_PATH}\` fixes it, and watch the badge as the text `
        + 'changes: nothing was configured, no dropdown was touched — the Studio infers **parameterized** '
        + 'from the `:id` syntax and the matcher switches behaviour on the spot. `{id}` works identically '
        + 'if that is the notation your specs use. The priority stays where it was; the path kind and the '
        + 'priority are independent decisions.',
      highlight: API_MOCK.PATH_INPUT,
      preAction: ensureAm04LiteralPath,
      action: runAm04ExactToParam,
      verify: API_MOCK.PATH_KIND,
    },
    {
      id: 'prove-param',
      title: 'Prove it before you trust it',
      description:
        '**Simulate** runs a request through the real matcher with no listener bound and no traffic sent — '
        + 'it is the fastest feedback loop in the Studio. After the path is filled, **Save as sample** '
        + 'stores it under **Saved samples** (name it after saving) so you can reopen that exact request. '
        + `Then \`${AM04_SIM_PARAM_PATH}\` comes back **MATCHED** `
        + 'with our rule as **Winner**, so the template does what a literal could not. The **Normalized '
        + 'request** tab shows what the matcher actually judged: the decoded path split into segments, '
        + 'which is exactly the shape a parameterized matcher compares against.\n\n'
        + `Then the verdict that matters: \`${AM04_SIM_LOOSE_PATH}\` **also matches**. \`:id\` means "any `
        + 'single segment", not "any number" — so a template is looser than it looks, and that looseness '
        + 'is the reason the next few steps exist. (A path with an extra segment, like '
        + '`/products/7/reviews`, does *not* match: segment counts have to line up.)',
      highlight: API_MOCK.SIMULATE,
      preAction: ensureAm04ParamPath,
      action: async (ctx) => {
        await runAm04ProveParam(ctx);
      },
      verify: API_MOCK.PATH_KIND,
    },
    {
      id: 'toolbox-tour',
      title: 'The wand is a pattern workbench',
      description:
        'The wand beside the path opens the **Pattern Toolbox**, and it is worth understanding as a '
        + 'workbench rather than a shortcut. **Path presets** load a complete pattern *and* a matching '
        + 'test path, so each one is immediately evaluated: `/users/:id` reports a match and names the '
        + 'captured `id`. The **nested params** preset shows the part people underuse — two parameters in '
        + 'one path, both captured, listed as chips in **Extraction**. A `**` preset flips the **Kind** '
        + 'selector to Glob, which is also the one place you can pick a kind explicitly instead of having '
        + 'it inferred.\n\n'
        + 'Note what happens on **Cancel**: the rule\'s path is untouched. Everything in here is a draft '
        + 'until **Apply**, which is what makes it safe to experiment on a rule that is already serving.',
      highlight: API_MOCK.PATH_TOOLBOX,
      preAction: ensureAm04ParamPath,
      action: runAm04ToolboxTour,
      verify: API_MOCK.PATH_INPUT,
    },
    {
      id: 'generalize',
      title: 'Generalize a recorded path, then test before applying',
      description:
        `Here is the same problem from a different source: a rule pointed at \`${AM04_ORDER_LITERAL_PATH}\` `
        + '— one order id, pasted from a capture. The toolbox\'s **Generalize** block splits that path into '
        + 'clickable segments and marks the ones that look dynamic: `A-1098` is flagged as an id shape, '
        + 'while `orders` is treated as structure. Clicking a segment parameterizes it and flips the kind, '
        + `and the **Suggested template** spells out the whole result: \`${AM04_ORDER_TEMPLATE_PATH}\`.\n\n`
        + `Now the discipline that makes this trustworthy — test with a value you did *not* record. `
        + `\`${AM04_ORDER_TEST_PATH}\` is a different order entirely, and the verdict line reports both the `
        + 'match *and* the captured `orderId`, with the same value echoed as an Extraction chip. That is '
        + 'the difference between a matcher that matches and a matcher that extracts. **Apply** writes it '
        + 'to the rule, and the badge in the editor confirms **parameterized**.',
      highlight: API_MOCK.ADD_ROUTE,
      preAction: ensureAm04ParamPath,
      action: runAm04Generalize,
      verify: API_MOCK.PATH_KIND,
    },
    {
      id: 'glob',
      title: 'Globs: one rule for a whole subtree',
      description:
        `Some rules should not enumerate anything. Static assets, a proxy prefix, a catch-all for `
        + `everything under a version — that is what globs are for, and typing \`${AM04_ASSET_GLOB_PATH}\` `
        + 'infers the **glob** kind from the star.\n\n'
        + `The distinction that trips people up is one character. \`${AM04_ASSET_TEST_PATH}\` matches `
        + `\`${AM04_ASSET_GLOB_PATH}\` because \`**\` crosses segment boundaries. Change the pattern to `
        + `\`${AM04_ASSET_NARROW_PATTERN}\` and the same path is **rejected** — a single \`*\` stays inside `
        + 'one segment, so it would only match `/assets/logo.png`. Restoring `**` brings the match back, '
        + 'and **Apply** commits it. Globs capture nothing, which is the trade: reach instead of data. And '
        + 'because specificity breaks ties at equal priority, a broad glob like this sits happily '
        + 'underneath the precise rules above it.',
      highlight: API_MOCK.ADD_ROUTE,
      preAction: ensureAm04OrderRule,
      action: runAm04Glob,
      verify: API_MOCK.PATH_KIND,
    },
    {
      id: 'regex-library',
      title: 'Take a tested pattern off the shelf',
      description:
        'Back to the products rule, and back to the problem from the second step: `:id` accepts `abc`. '
        + 'When a segment has a *shape*, the matcher should say so — and the **Regex builder** tab ships a '
        + `pattern library so you are not hand-rolling one. Searching for **${AM04_LIBRARY_ENTRY.toLowerCase()}** `
        + `surfaces **${AM04_LIBRARY_ENTRY}**, and picking it loads the expression together with live `
        + 'samples: two you expect to match, two you do not. **Matches** / **Does not match** is '
        + 'what the pattern did; the check is whether that agreed with your expectation. The '
        + '**Safety** badge confirms the expression compiles.\n\n'
        + 'The library gives you a *fragment* — an id shape, not a path. A path matcher has to describe '
        + `the whole path, anchored, so the expression becomes \`${AM04_REGEX_PATH}\` and the samples are `
        + 're-pointed at real paths to keep proving it. (Anchors matter: an unanchored expression matches '
        + 'anywhere in the path, and the toolbox will add `^` and `$` for you if you forget.) The **Ignore '
        + 'case** flag is here too — useful for values, rarely what you want for a path. **Apply**, and '
        + 'the badge finally reads **regex**.',
      highlight: API_MOCK.PATH_TOOLBOX,
      preAction: ensureAm04RegexReady,
      action: runAm04RegexLibrary,
      verify: API_MOCK.PATH_KIND,
    },
    {
      id: 'prove-regex',
      title: 'A matcher you cannot fail is a guess',
      description:
        `Same two probes as before, now against the tightened rule. \`${AM04_SIM_LOOSE_PATH}\` comes back `
        + '**UNMATCHED**, and the decision trace explains it precisely: the candidate is listed with '
        + '**Path failed**, so you know it was the path — not a header, not a body condition — that '
        + `rejected the request. Then \`${AM04_LITERAL_PATH}\` still matches, still wins, and the `
        + '**Rendered response** tab shows the body it would return, delay and all.\n\n'
        + 'That pair of runs is the habit worth keeping: prove the request you want *and* the request you '
        + 'want rejected. This library now holds three rules describing three different shapes — a '
        + 'numeric-id regex, a parameterized order lookup, and an asset subtree glob — and every one of '
        + 'them was verified before anything was ever served.',
      highlight: API_MOCK.SIMULATE,
      preAction: ensureAm04ProofReady,
      action: async (ctx) => {
        await runAm04ProveRegex(ctx);
      },
      verify: API_MOCK.ROUTE_EXPLORER,
    },
  ],
};
