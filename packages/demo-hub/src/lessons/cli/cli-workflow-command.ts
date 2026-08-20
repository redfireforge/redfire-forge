/**
 * CLI-9 — Workflow Performance Testing
 *
 * Terminal-surface lesson (DemoTerminal), continuing the same pane from CLI-1 through CLI-8.
 * All captured output below was actually run against the repo (`examples/workflow-cli-sample.yaml`,
 * `examples/workflow-cli-conditional.yaml`, `examples/workflow-cli-parallel.yaml` against the
 * real JSONPlaceholder API), not invented — see docs/future/cli/cli-demo-plan.md.
 *
 * Both `examples/workflow-cli-conditional.yaml` (BUG-8) and the workflow trace output
 * (BUG-9, `--trace-output` flag) were previously broken/missing and are now fixed —
 * this lesson demonstrates the genuine, working behavior.
 */
import type { DemoLesson } from '../../types';

export const cliWorkflowCommandLesson: DemoLesson = {
  id: 'cli-workflow-command',
  domainId: 'cli',
  category: 'execution',
  name: 'Workflow Performance Testing',
  description:
    'The workflow command — same graph engine as the Workflow Designer\'s Quick Test, ' +
    'run headlessly at load: HTTP nodes, --var overrides, conditional branching, and ' +
    'fork/join concurrency.',
  estimatedMinutes: 6,
  desktopOnly: false,

  concept: {
    title: 'Workflow Performance Testing',
    body:
      'A `run` test file is a flat list of independent scenarios. A workflow is a ' +
      'graph — nodes connected by edges, with branching (Switch), parallelism ' +
      '(Fork/Join), and shared variables that carry state from one HTTP call to the ' +
      'next. The `workflow` command runs that exact same graph the Workflow ' +
      'Designer\'s Quick Test runs, but headlessly and at load: N iterations, C ' +
      'concurrent, same metrics engine as `run`, just attributed per-node instead of ' +
      'per-scenario.',
    keyTerms: [
      { term: '--var name=value', definition: 'Override any workflow variable from the command line — the same mechanism CI would use to parameterize a run.' },
      { term: 'Fork/Join', definition: 'Parallel branches within a single iteration — not to be confused with -c/--concurrency\'s iteration-level parallelism.' },
    ],
    diagram: `<svg viewBox="0 0 440 210" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <marker id="cli9-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="var(--primary)"/>
    </marker>
  </defs>
  <text x="220" y="14" text-anchor="middle" fill="var(--text-muted)" font-size="10" font-family="system-ui" font-weight="600">workflow graph (same as Designer canvas)</text>
  <!-- mini node chain -->
  <circle cx="30" cy="40" r="12" fill="var(--text-muted)" opacity="0.2" stroke="var(--text-muted)" stroke-width="1.5"/>
  <text x="30" y="44" text-anchor="middle" fill="var(--text)" font-size="8" font-family="system-ui">S</text>
  <line x1="42" y1="40" x2="80" y2="40" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#cli9-arrow)"/>
  <rect x="82" y="24" width="90" height="32" rx="5" fill="var(--accent)" opacity="0.15" stroke="var(--accent)" stroke-width="1.5"/>
  <text x="127" y="44" text-anchor="middle" fill="var(--text)" font-size="9" font-family="system-ui">HTTP node</text>
  <line x1="174" y1="40" x2="210" y2="40" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#cli9-arrow)"/>
  <rect x="212" y="24" width="90" height="32" rx="5" fill="var(--accent)" opacity="0.15" stroke="var(--accent)" stroke-width="1.5"/>
  <text x="257" y="44" text-anchor="middle" fill="var(--text)" font-size="9" font-family="system-ui">HTTP node</text>
  <line x1="304" y1="40" x2="340" y2="40" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#cli9-arrow)"/>
  <circle cx="352" cy="40" r="12" fill="var(--text-muted)" opacity="0.2" stroke="var(--text-muted)" stroke-width="1.5"/>
  <text x="352" y="44" text-anchor="middle" fill="var(--text)" font-size="8" font-family="system-ui">E</text>
  <!-- arrow down -->
  <line x1="220" y1="60" x2="220" y2="80" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#cli9-arrow)"/>
  <!-- workflow command -->
  <rect x="100" y="82" width="240" height="40" rx="6" fill="var(--primary)" opacity="0.15" stroke="var(--primary)" stroke-width="1.5"/>
  <text x="220" y="106" text-anchor="middle" fill="var(--text)" font-size="11" font-family="system-ui" font-weight="600">workflow &lt;file&gt; -i N -c C</text>
  <!-- arrow down -->
  <line x1="220" y1="122" x2="220" y2="142" stroke="var(--success)" stroke-width="1.5" marker-end="url(#cli9-arrow)"/>
  <!-- per-node metrics -->
  <rect x="80" y="144" width="280" height="40" rx="6" fill="var(--success)" opacity="0.15" stroke="var(--success)" stroke-width="1.5"/>
  <text x="220" y="168" text-anchor="middle" fill="var(--text)" font-size="11" font-family="system-ui" font-weight="600">Per-Step Metrics (per node, not per scenario)</text>
  <text x="220" y="200" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-family="system-ui">Fork/Join = parallel branches inside ONE iteration, separate from -c</text>
</svg>`,
  },

  steps: [
    // ── Step 1: The Workflow File ─────────────────────────────────────────
    {
      id: 'cli9-workflow-file',
      title: 'The Workflow File',
      description:
        'Before running a workflow at load, verify it\'s structurally valid. ' +
        '`validate-workflow` checks that nodes and edges form a legal graph — it ' +
        'reports counts (4 nodes, 3 edges) and lists any declared variables.\n\n' +
        'Note: this only checks structure, not whether HTTP node configs are correct. ' +
        'A workflow can pass this check and still fail at runtime if a URL or method is wrong.\n\n' +
        '**Command used:**\n' +
        '- `validate-workflow <file>` — check graph structure and print a summary (no network calls)',
      terminalCommand: 'redfireforge validate-workflow examples/workflow-cli-sample.yaml',
      terminalOutput:
        '  \u2705 Valid workflow: workflow-cli-sample.yaml\n' +
        '  Name: JSONPlaceholder Test Workflow\n' +
        '  Nodes: 4 total, 2 HTTP\n' +
        '  Edges: 3\n' +
        '  Variables: baseUrl',
      terminalHighlightLines: [[3, 3]],
      pauseAfter: true,
    },

    // ── Step 2: workflow <file> ────────────────────────────────────────────
    {
      id: 'cli9-run-workflow',
      title: 'workflow <file>',
      description:
        'The `workflow` command runs the graph at load — same as the Designer\'s Quick Test, ' +
        'but headless and repeated N times.\n\n' +
        'The key difference from `run`: `Total Steps: 40`, not 20. That\'s because each ' +
        'iteration visits **2 HTTP nodes**, so 20 iterations × 2 nodes = 40 requests. ' +
        'Per-Step Metrics breaks results down by node, not by iteration.\n\n' +
        '**Flags used:**\n' +
        '- `workflow <file>` — run a workflow graph (vs. `run` for flat scenario files)\n' +
        '- `-i 20` — run 20 full iterations of the graph\n' +
        '- `-c 4` — run 4 iterations concurrently at a time',
      terminalCommand: 'redfireforge workflow examples/workflow-cli-sample.yaml -i 20 -c 4',
      terminalOutput:
        '  Workflow:     JSONPlaceholder Test Workflow\n' +
        '  Mode:         workflow (I:20 C:4)\n' +
        '  Duration:     0.59s\n' +
        '  Iterations/s: 34.13\n' +
        '  Avg Response: 55.48 ms\n' +
        '  P50:          36.63 ms\n' +
        '  P95:          187.41 ms\n' +
        '\n' +
        '  Total Steps:  40\n' +
        '  Passed:       40\n' +
        '  Failed:       0\n' +
        '  Error Rate:   0%\n' +
        '\n' +
        '  Per-Step Metrics:\n' +
        '    Get Users: avg=66ms p95=195.71ms (100% pass)\n' +
        '    Get Posts: avg=45ms p95=102.73ms (100% pass)\n' +
        '\n' +
        '  Result:       PASSED \u2705',
      // 2 beats: Total Steps (40, not 20 — the key difference from run), then Per-Step Metrics.
      terminalHighlightLines: [[9, 9], [14, 15]],
      pauseAfter: true,
    },

    // ── Step 3: --var name=value ────────────────────────────────────────────
    {
      id: 'cli9-vars',
      title: '--var name=value',
      description:
        'The conditional workflow has a Switch node that routes on a `country` variable: ' +
        '`germany` takes the European branch, `japan` takes the Asian branch.\n\n' +
        'Run the same file twice with different `--var` values and watch Per-Step Metrics ' +
        'show a different node each time (`European Country` vs `Asian Country`). ' +
        'The file never changes — the variable does.\n\n' +
        'This is exactly how a CI pipeline would parameterize the same workflow for ' +
        'different environments or test targets.\n\n' +
        '**Flags used:**\n' +
        '- `--var country=germany` — override the `country` workflow variable from the command line\n' +
        '- `-i 1 -c 1` — single iteration, single worker (enough to show the branch taken)',
      terminalCommand:
        'redfireforge workflow examples/workflow-cli-conditional.yaml --var country=germany -i 1 -c 1',
      terminalOutput:
        '  Variables: 1\n' +
        '    country=germany\n' +
        '  Total Steps:  2\n' +
        '  Passed:       2\n' +
        '  Per-Step Metrics:\n' +
        '    Lookup Country: avg=470ms p95=470.02ms (100% pass)\n' +
        '    European Country: avg=109ms p95=109.26ms (100% pass)\n' +
        '  Result:       PASSED \u2705\n' +
        '\n' +
        '$ redfireforge workflow examples/workflow-cli-conditional.yaml --var country=japan -i 1 -c 1\n' +
        '  Variables: 1\n' +
        '    country=japan\n' +
        '  Total Steps:  2\n' +
        '  Passed:       2\n' +
        '  Per-Step Metrics:\n' +
        '    Lookup Country: avg=234ms p95=233.84ms (100% pass)\n' +
        '    Asian Country: avg=91ms p95=90.69ms (100% pass)\n' +
        '  Result:       PASSED \u2705',
      // 2 beats: European Country branch (lines 6–7), then Asian Country branch (lines 16–17).
      terminalHighlightLines: [[6, 7], [16, 17]],
      pauseAfter: true,
    },

    // ── Step 4: Fork/Join at Load ────────────────────────────────────────
    {
      id: 'cli9-parallel',
      title: 'Fork/Join at Load',
      description:
        'This workflow fetches a user, then **Forks** into three parallel branches ' +
        '(posts, todos, albums), then **Joins** before the End node.\n\n' +
        'Watch `Total Steps: 200` — that\'s 50 iterations × 4 HTTP nodes each. The three ' +
        'forked branches fire concurrently **within each iteration**, separate from the ' +
        '`-c 5` iteration-level concurrency. Both layers of parallelism run at once.\n\n' +
        '**Flags used:**\n' +
        '- `-i 50` — 50 full iterations of the graph\n' +
        '- `-c 5` — 5 iterations running concurrently (iteration-level parallelism)\n' +
        '- `--var userId=3` — pin the userId so all branches fetch the same user\'s data',
      terminalCommand: 'redfireforge workflow examples/workflow-cli-parallel.yaml -i 50 -c 5 --var userId=3',
      terminalOutput:
        '  Workflow:     Parallel User Data Fetch\n' +
        '  Mode:         workflow (I:50 C:5)\n' +
        '  Duration:     1.27s\n' +
        '  Iterations/s: 39.37\n' +
        '\n' +
        '  Total Steps:  200\n' +
        '  Passed:       200\n' +
        '  Failed:       0\n' +
        '  Error Rate:   0%\n' +
        '\n' +
        '  Per-Step Metrics:\n' +
        '    Get User: avg=57ms p95=149.75ms (100% pass)\n' +
        '    Get Posts: avg=53ms p95=124.96ms (100% pass)\n' +
        '    Get Todos: avg=48ms p95=124.43ms (100% pass)\n' +
        '    Get Albums: avg=54ms p95=180.37ms (100% pass)\n' +
        '\n' +
        '  Result:       PASSED \u2705',
      // 2 beats: the 200-step total, then all 4 nodes broken down (1 sequential + 3 forked).
      terminalHighlightLines: [[6, 6], [11, 14]],
      pauseAfter: true,
    },

    // ── Step 5: Workflow Reports (JUnit + Markdown) ──────────────────────
    {
      id: 'cli9-workflow-reports',
      title: 'Workflow Reports (JUnit + Markdown)',
      description:
        'Workflow reports work the same as `run` reports, but the shape is **iteration-oriented**: ' +
        'JUnit testcases are named `"Iteration 1"`, `"Iteration 2"` — not per-scenario.\n\n' +
        'Both `--junit` and `--markdown` are additive — a single run can emit both at once.\n\n' +
        '**Flags used:**\n' +
        '- `--junit wf.junit.xml` — write a JUnit XML report (one testcase per iteration)\n' +
        '- `--markdown wf.md` — write a Markdown summary report\n' +
        '- `-i 5 -c 1` — 5 iterations, 1 worker\n' +
        '- `-q` — quiet summary only\n' +
        '- `&& cat wf.junit.xml` — print the JUnit file so you can see the iteration-named testcases',
      terminalCommand:
        'redfireforge workflow examples/workflow-cli-sample.yaml -i 5 -c 1 --junit wf.junit.xml --markdown wf.md -q && cat wf.junit.xml',
      terminalOutput:
        '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<testsuites name="JSONPlaceholder Test Workflow" tests="5" failures="0" time="0.736">\n' +
        '  <testsuite name="JSONPlaceholder Test Workflow" tests="5" failures="0" time="0.736">\n' +
        '    <testcase classname="JSONPlaceholder Test Workflow" name="Iteration 1" time="0.235">\n' +
        '    </testcase>\n' +
        '    <testcase classname="JSONPlaceholder Test Workflow" name="Iteration 2" time="0.119">\n' +
        '    </testcase>\n' +
        '  </testsuite>\n' +
        '</testsuites>',
      // Beat: the Iteration-named testcases — the key difference from run's per-scenario naming.
      terminalHighlightLines: [[4, 4]],
      pauseAfter: true,
    },

    // ── Step 6: --trace-level & --trace-output ───────────────────────────
    {
      id: 'cli9-trace-output',
      title: '--trace-level & --trace-output',
      description:
        'The trace output lets you inspect exactly what each node sent and received — useful for debugging a failing workflow without adding logging to your app.\n\n' +
        'Compare the two capture levels:\n' +
        '- `standard` (default) — records only `method` and `url`\n' +
        '- `full` — also populates a nested `request`/`response` object with headers and body\n\n' +
        '**Flags used:**\n' +
        '- `--trace-level full` — capture full request + response for every node (options: minimal / standard / full / debug)\n' +
        '- `--trace-output wf-trace.json` — write the execution trace as JSON\n' +
        '- `-i 2 -c 1` — 2 iterations, 1 worker\n' +
        '- `-q` — quiet summary only',
      terminalCommand:
        'redfireforge workflow examples/workflow-cli-sample.yaml -i 2 -c 1 --trace-level full --trace-output wf-trace.json -q',
      terminalOutput:
        '  Trace:       wf-trace.json\n' +
        '{\n' +
        '  "captureLevel": "full",\n' +
        '  "fullTraceCaptured": true,\n' +
        '  "totalIterations": 2\n' +
        '}\n' +
        '--- sample event (Get Posts node, iteration 1, --trace-level full) ---\n' +
        '{\n' +
        '  "nodeId": "get-posts", "nodeLabel": "Get Posts", "state": "pass", "durationMs": 38.74,\n' +
        '  "details": {\n' +
        '    "statusCode": 200, "method": "GET", "url": "https://jsonplaceholder.typicode.com/posts?userId=1",\n' +
        '    "request": { "method": "GET", "url": "https://jsonplaceholder.typicode.com/posts?userId=1", "headers": { "Accept": "application/json" } },\n' +
        '    "response": { "statusCode": 200, "statusText": "200" }\n' +
        '  }\n' +
        '}\n' +
        '--- same event at the default --trace-level (standard) ---\n' +
        '{\n' +
        '  "nodeId": "get-posts", "nodeLabel": "Get Posts", "state": "pass", "durationMs": 38.74,\n' +
        '  "details": { "statusCode": 200, "method": "GET", "url": "https://jsonplaceholder.typicode.com/posts?userId=1" }\n' +
        '  // no "request" / "response" keys at all — only full/debug populate them\n' +
        '}',
      // 2 beats: the full-level request/response fields, then standard's absence of them.
      terminalHighlightLines: [[12, 13], [19, 20]],
      pauseAfter: true,
    },
  ],
};
