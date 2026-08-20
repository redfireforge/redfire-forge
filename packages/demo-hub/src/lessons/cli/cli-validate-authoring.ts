/**
 * CLI-2 — Validate Before You Run
 *
 * Terminal-surface lesson (DemoTerminal), continuing the same pane from CLI-1.
 * All captured output below was actually run against the repo (`examples/cli-basic-test.yaml`,
 * `examples/workflow-cli-sample.yaml`, plus two deliberately-broken temp fixtures under /tmp
 * used only to demo validation failures — never committed), not invented — see
 * docs/future/cli/cli-demo-plan.md.
 */
import type { DemoLesson } from '../../types';

export const cliValidateAuthoringLesson: DemoLesson = {
  id: 'cli-validate-authoring',
  domainId: 'cli',
  category: 'getting-started',
  name: 'Validate Before You Run',
  description:
    'Read a test file\'s shape, validate it instantly with no network calls, and learn ' +
    'to recognize the two different ways a file can be invalid.',
  estimatedMinutes: 5,
  desktopOnly: false,

  concept: {
    title: 'Validate Before You Run',
    body:
      '`validate` and `validate-workflow` do everything `run`/`workflow` do except ' +
      'actually make requests — parse the file, build scenarios, print a summary. ' +
      'They\'re instant (no network calls), which makes them the right first check in ' +
      'an editor save-hook or a CI pre-flight step, before burning time on a real load ' +
      'test against a broken file.',
    keyTerms: [
      { term: 'tests[]', definition: 'The array every test file needs at least one entry in — validate rejects an empty array even though `tests: []` is syntactically valid YAML.' },
      { term: 'exit code 2', definition: 'Reserved specifically for "the file itself is the problem" — a YAML syntax error or a schema violation — distinct from exit 1 (the file was fine, a test/assertion failed).' },
    ],
    diagram: `<svg viewBox="0 0 440 210" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <marker id="cli2-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="var(--primary)"/>
    </marker>
  </defs>
  <!-- File box -->
  <rect x="10" y="79" width="110" height="42" rx="6" fill="var(--text-muted)" opacity="0.12" stroke="var(--text-muted)" stroke-width="1.5"/>
  <text x="65" y="97" text-anchor="middle" fill="var(--text)" font-size="10" font-family="system-ui" font-weight="600">test / workflow</text>
  <text x="65" y="111" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-family="system-ui">file (.yaml)</text>
  <!-- Arrow to validate -->
  <line x1="120" y1="100" x2="146" y2="100" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#cli2-arrow)"/>
  <!-- Validate box -->
  <rect x="150" y="64" width="150" height="72" rx="6" fill="var(--primary)" opacity="0.15" stroke="var(--primary)" stroke-width="1.5"/>
  <text x="225" y="86" text-anchor="middle" fill="var(--text)" font-size="10" font-family="system-ui" font-weight="600">validate /</text>
  <text x="225" y="100" text-anchor="middle" fill="var(--text)" font-size="10" font-family="system-ui" font-weight="600">validate-workflow</text>
  <text x="225" y="116" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-family="system-ui">parse only —</text>
  <text x="225" y="128" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-family="system-ui">no network calls</text>
  <!-- Arrow to exit 0 -->
  <line x1="300" y1="82" x2="326" y2="42" stroke="var(--success)" stroke-width="1.5" marker-end="url(#cli2-arrow)"/>
  <!-- Exit 0 box -->
  <rect x="330" y="14" width="100" height="42" rx="6" fill="var(--success)" opacity="0.15" stroke="var(--success)" stroke-width="1.5"/>
  <text x="380" y="32" text-anchor="middle" fill="var(--success)" font-size="10" font-family="system-ui" font-weight="600">exit 0</text>
  <text x="380" y="46" text-anchor="middle" fill="var(--success)" font-size="9" font-family="system-ui">✅ safe to run</text>
  <!-- Arrow to exit 2 -->
  <line x1="300" y1="118" x2="326" y2="164" stroke="var(--error,#f38ba8)" stroke-width="1.5" marker-end="url(#cli2-arrow)"/>
  <!-- Exit 2 box -->
  <rect x="330" y="144" width="100" height="42" rx="6" fill="var(--error,#f38ba8)" opacity="0.15" stroke="var(--error,#f38ba8)" stroke-width="1.5"/>
  <text x="380" y="162" text-anchor="middle" fill="var(--error,#f38ba8)" font-size="10" font-family="system-ui" font-weight="600">exit 2</text>
  <text x="380" y="176" text-anchor="middle" fill="var(--error,#f38ba8)" font-size="9" font-family="system-ui">❌ fix &amp; re-check</text>
  <!-- Loop-back: fix and re-validate -->
  <path d="M330,175 C 220,205 90,190 55,121" fill="none" stroke="var(--error,#f38ba8)" stroke-width="1.5" stroke-dasharray="3,3" marker-end="url(#cli2-arrow)"/>
  <text x="185" y="201" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-family="system-ui">fix &amp; re-validate</text>
</svg>`,
  },

  steps: [
    // ── Step 1: Test File Anatomy ─────────────────────────────────────
    {
      id: 'cli2-anatomy',
      title: 'Test File Anatomy',
      description:
        'Before validating, read the file. Every test file has four top-level fields:\n\n' +
        '- `name` — suite label, printed in run headers\n' +
        '- `env` — metadata only, doesn\'t change behavior\n' +
        '- `baseUrl` — prepended to every test\'s relative `url`\n' +
        '- `tests[]` — the only required array; each entry needs at minimum `method` and `url`\n\n' +
        '`tags` and `assertions` are optional — a test without assertions still runs and checks the HTTP status.\n\n' +
        '**Command used:**\n' +
        '- `cat <file>` — read the raw YAML before running anything',
      terminalCommand: 'cat examples/cli-basic-test.yaml',
      terminalOutput:
        'name: CLI Basic Test\n' +
        'env: demo\n' +
        'baseUrl: https://jsonplaceholder.typicode.com\n' +
        '\n' +
        'tests:\n' +
        '  - name: List Users\n' +
        '    method: GET\n' +
        '    url: /users\n' +
        '    tags: [smoke, regression]\n' +
        '    headers:\n' +
        '      Accept: application/json\n' +
        '    assertions:\n' +
        '      - type: status\n' +
        '        expected: "200"\n' +
        '      - type: numeric\n' +
        '        jsonPath: $.length\n' +
        '        operator: ">"\n' +
        '        value: 0\n' +
        '\n' +
        '  - name: Get Single User\n' +
        '    method: GET\n' +
        '    url: /users/1\n' +
        '    tags: [smoke, critical]\n' +
        '    ...',
      // 2 beats: top-level name/env/baseUrl, then the tests: array + one test's shape.
      terminalHighlightLines: [[1, 3], [5, 18]],
      pauseAfter: true,
    },

    // ── Step 2: Validate a Good File ──────────────────────────────────
    {
      id: 'cli2-validate-good',
      title: 'Validate a Good File',
      description:
        'No network calls — `validate` only parses the YAML and builds the scenario list in memory. Each line in the output shows the resolved method, full URL (`baseUrl` + `url` joined), name, and tags.\n\n' +
        'This is the fastest way to answer "is this the file I think it is?" before committing to an actual load run.\n\n' +
        '**Command used:**\n' +
        '- `validate <file>` — parse and validate a test file without making any requests (exit 0 = safe to run, exit 2 = fix the file first)',
      terminalCommand: 'redfireforge validate examples/cli-basic-test.yaml',
      terminalOutput:
        '  ✅ Valid test file: cli-basic-test.yaml\n' +
        '  Tests: 3\n' +
        '    - GET https://jsonplaceholder.typicode.com/users  (List Users)  [tags: smoke, regression]\n' +
        '    - GET https://jsonplaceholder.typicode.com/users/1  (Get Single User)  [tags: smoke, critical]\n' +
        '    - GET https://jsonplaceholder.typicode.com/posts  (List Posts)  [tags: regression]',
      terminalHighlightLines: [[1, 1]],
      pauseAfter: true,
    },

    // ── Step 3: Validate a Workflow File ──────────────────────────────
    {
      id: 'cli2-validate-workflow',
      title: 'Validate a Workflow File',
      description:
        'Workflows have a completely different shape (nodes + edges instead of a `tests` array), so they get their own validator. The output tells you:\n\n' +
        '- total node count and how many are HTTP nodes\n' +
        '- edge count\n' +
        '- which variables the workflow declares\n\n' +
        'Enough to confirm a graph is well-formed before running it at load.\n\n' +
        '**Command used:**\n' +
        '- `validate-workflow <file>` — parse and validate a workflow file without making any requests',
      terminalCommand: 'redfireforge validate-workflow examples/workflow-cli-sample.yaml',
      terminalOutput:
        '  ✅ Valid workflow: workflow-cli-sample.yaml\n' +
        '  Name: JSONPlaceholder Test Workflow\n' +
        '  Nodes: 4 total, 2 HTTP\n' +
        '  Edges: 3\n' +
        '  Variables: baseUrl',
      terminalHighlightLines: [[1, 1]],
      pauseAfter: true,
    },

    // ── Step 4: Two Ways to Break It ───────────────────────────────────
    {
      id: 'cli2-break-it',
      title: 'Two Ways to Break It',
      description:
        'There are two distinct kinds of "broken" and the CLI reports them differently — both exit `2`, but with different messages:\n\n' +
        '- **Invalid YAML** — e.g. indentation is wrong and the parser can\'t even read the file. You get a parser error with a line/column pointer.\n' +
        '- **Valid YAML, empty suite** — `tests: []` is syntactically correct YAML, but the CLI rejects it because a suite with zero tests isn\'t runnable.\n\n' +
        'Recognizing which kind you\'re looking at tells you immediately whether to fix indentation or add a test.\n\n' +
        '**Command used:**\n' +
        '- `validate <file>` — same command, two broken files to show both error types',
      terminalCommand:
        'redfireforge validate /tmp/cli-basic-test-broken.yaml',
      terminalOutput:
        '  ❌ Invalid: Nested mappings are not allowed in compact mappings at line 3, column 10:\n' +
        '\n' +
        'baseUrl: https://jsonplaceholder.typicode.com\n' +
        '         ^\n' +
        ' [BLOCK_AS_IMPLICIT_KEY]\n' +
        '\n' +
        '$ redfireforge validate /tmp/cli-basic-test-broken2.yaml\n' +
        '  ❌ Invalid: Test file must contain a non-empty "tests" array.',
      // 2 beats: the YAML-syntax error (line 1), then the empty-array error (line 8).
      terminalHighlightLines: [[1, 1], [8, 8]],
      pauseAfter: true,
    },

    // ── Step 5: Fix and Re-Validate ────────────────────────────────────
    {
      id: 'cli2-fix-and-confirm',
      title: 'Fix and Re-Validate',
      description:
        'Restore the real `tests:` array and re-run — back to green. This **validate → fix → validate** loop is what you\'d wire into a pre-commit hook or an editor save action.\n\n' +
        'It\'s instant (no network round-trip), so there\'s no reason to skip it before a real load run.\n\n' +
        '**Command used:**\n' +
        '- `validate <file>` — same command again; green output confirms it\'s safe to run',
      terminalCommand: 'redfireforge validate examples/cli-basic-test.yaml',
      terminalOutput:
        '  ✅ Valid test file: cli-basic-test.yaml\n' +
        '  Tests: 3\n' +
        '    - GET https://jsonplaceholder.typicode.com/users  (List Users)  [tags: smoke, regression]\n' +
        '    - GET https://jsonplaceholder.typicode.com/users/1  (Get Single User)  [tags: smoke, critical]\n' +
        '    - GET https://jsonplaceholder.typicode.com/posts  (List Posts)  [tags: regression]',
      terminalHighlightLines: [[1, 1]],
      pauseAfter: true,
    },
  ],
};
