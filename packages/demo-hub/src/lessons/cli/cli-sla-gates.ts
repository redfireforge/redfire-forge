/**
 * CLI-7 — SLA Targets as Quality Gates
 *
 * Terminal-surface lesson (DemoTerminal), continuing the same pane from CLI-1 through CLI-6.
 * All captured output below was actually run against the repo (`examples/sla-jsonplaceholder-test.yaml`
 * + `examples/sla-jsonplaceholder-targets.json` against the real JSONPlaceholder API, plus a
 * temp SLA config at /tmp/sla-targets-demo.json built to demonstrate pass/warn/fail together
 * — never committed), not invented — see docs/future/cli/cli-demo-plan.md. `Create Post TPS`'s
 * `value: 100` is deliberately unreachable over a real network, so it fails deterministically
 * on every run — not flaky, by design (see the fixture's own header comment).
 */
import type { DemoLesson } from '../../types';

export const cliSlaGatesLesson: DemoLesson = {
  id: 'cli-sla-gates',
  domainId: 'cli',
  category: 'reliability',
  name: 'SLA Targets as Quality Gates',
  description:
    'Encode performance SLAs as a JSON file and fail CI when they\'re violated — ' +
    'independent of pass/fail assertions.',
  estimatedMinutes: 5,
  desktopOnly: false,

  concept: {
    title: 'SLA Targets as Quality Gates',
    body:
      'Pass/fail assertions check correctness — did the response look right. SLA ' +
      'targets check performance — was it fast enough, reliable enough. They\'re ' +
      'evaluated independently, after the run, against the same summary metrics the ' +
      'console already prints. A test suite can be 100% functionally correct and still ' +
      'fail its SLA gate — that\'s the point.',
    keyTerms: [
      { term: 'SlaTarget', definition: 'One JSON object per gate: a metric, an operator, a threshold, optionally scoped to a feature group or a single scenario.' },
      { term: 'warnAt', definition: 'An optional stricter threshold that produces a warn (⚠) status short of an outright fail (✗).' },
    ],
    diagram: `<svg viewBox="0 0 440 220" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <marker id="cli7-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="var(--primary)"/>
    </marker>
  </defs>
  <!-- Test Run -->
  <rect x="145" y="14" width="150" height="36" rx="6" fill="var(--text-muted)" opacity="0.12" stroke="var(--text-muted)" stroke-width="1.5"/>
  <text x="220" y="37" text-anchor="middle" fill="var(--text)" font-size="11" font-family="system-ui" font-weight="600">Test Run</text>
  <!-- diverging arrows -->
  <line x1="185" y1="50" x2="110" y2="68" stroke="var(--accent)" stroke-width="1.5" marker-end="url(#cli7-arrow)"/>
  <line x1="255" y1="50" x2="330" y2="68" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#cli7-arrow)"/>
  <!-- Assertions -->
  <rect x="15" y="70" width="190" height="52" rx="6" fill="var(--accent)" opacity="0.15" stroke="var(--accent)" stroke-width="1.5"/>
  <text x="110" y="91" text-anchor="middle" fill="var(--text)" font-size="11" font-family="system-ui" font-weight="600">Assertions</text>
  <text x="110" y="106" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-family="system-ui">correctness — pass / fail</text>
  <!-- SLA Targets -->
  <rect x="235" y="70" width="190" height="52" rx="6" fill="var(--primary)" opacity="0.15" stroke="var(--primary)" stroke-width="1.5"/>
  <text x="330" y="91" text-anchor="middle" fill="var(--text)" font-size="11" font-family="system-ui" font-weight="600">SLA Targets</text>
  <text x="330" y="106" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-family="system-ui">performance — pass / warn / fail</text>
  <!-- converging arrows -->
  <line x1="110" y1="122" x2="180" y2="148" stroke="var(--accent)" stroke-width="1.5" marker-end="url(#cli7-arrow)"/>
  <line x1="330" y1="122" x2="260" y2="148" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#cli7-arrow)"/>
  <!-- exit code priority -->
  <rect x="55" y="150" width="330" height="60" rx="6" fill="var(--error,#f38ba8)" opacity="0.12" stroke="var(--error,#f38ba8)" stroke-width="1.5"/>
  <text x="220" y="168" text-anchor="middle" fill="var(--text)" font-size="10" font-family="system-ui" font-weight="600">exit code priority (highest wins)</text>
  <text x="220" y="184" text-anchor="middle" fill="var(--error,#f38ba8)" font-size="10" font-family="system-ui" font-weight="600">4 SLA fail  &gt;  3 both  &gt;  2 regression  &gt;  1 test fail</text>
  <text x="220" y="200" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-family="system-ui">0 = clean run</text>
</svg>`,
  },

  steps: [
    // ── Step 1: The SlaTarget[] Shape ────────────────────────────────────
    {
      id: 'cli7-sla-shape',
      title: 'The SlaTarget[] Shape',
      description:
        'The SLA config is a JSON array of target objects, each independently scoped. Two scoping options:\n\n' +
        '- `featureGroupName` — applies to the whole suite\'s aggregate metrics\n' +
        '- `scenarioName` — applies only to one named test (matches the test\'s `name:` field)\n\n' +
        'Available metrics: `p95`, `tps`, `errorRate`, `avg` — whatever the summary already computes.\n\n' +
        '`create-post-tps` has `"value": 100` — 100 req/s is deliberately unreachable over a real network, so this target reliably fails every run without being flaky.\n\n' +
        '**Command used:**\n' +
        '- `cat examples/sla-jsonplaceholder-targets.json` — read the SLA config file to understand its shape before running',
      terminalCommand: 'cat examples/sla-jsonplaceholder-targets.json',
      terminalOutput:
        '[\n' +
        '  { "id": "sla-fg-p95", "metric": "p95", "operator": "lte", "value": 2000, "label": "Feature Group P95 SLA", "featureGroupName": "SLA Test Suite" },\n' +
        '  { "id": "create-post-p95", "metric": "p95", "operator": "lte", "value": 1000, "label": "Create Post P95", "scenarioName": "Create Post" },\n' +
        '  { "id": "create-post-tps", "metric": "tps", "operator": "gte", "value": 100, "label": "Create Post TPS", "scenarioName": "Create Post" },\n' +
        '  { "id": "create-post-error-rate", "metric": "errorRate", "operator": "lte", "value": 2, "label": "Create Post Error Rate", "scenarioName": "Create Post" },\n' +
        '  { "id": "get-posts-p95", "metric": "p95", "operator": "lte", "value": 1500, "label": "Posts P95", "scenarioName": "Get Posts" },\n' +
        '  { "id": "get-users-p95", "metric": "p95", "operator": "lte", "value": 500, "label": "Users P95", "scenarioName": "Get Users" },\n' +
        '  { "id": "get-users-error-rate", "metric": "errorRate", "operator": "lte", "value": 1, "label": "Users Error Rate", "scenarioName": "Get Users" },\n' +
        '  { "id": "update-post-avg", "metric": "avg", "operator": "lte", "value": 600, "label": "Update Post Avg Latency", "scenarioName": "Update Post" }\n' +
        ']',
      // 2 beats: featureGroupName scoping vs scenarioName scoping, then the deliberately-unreachable TPS target.
      terminalHighlightLines: [[2, 2], [4, 4]],
      pauseAfter: true,
    },

    // ── Step 2: --sla-config ─────────────────────────────────────────────
    {
      id: 'cli7-run-with-sla',
      title: '--sla-config',
      description:
        'The SLA report prints as its own block after the console summary — one line per target: metric, actual value, and the threshold it was checked against.\n\n' +
        '`Create Post TPS` shows `✗ 4.0req/s (target: >= 100req/s)` — reproducibly failing every run over a real network, by design.\n\n' +
        '**Flags used:**\n' +
        '- `--sla-config <file>` — path to the JSON file of SLA targets to evaluate\n' +
        '- `-m sequential` — one request at a time (makes TPS deterministic for demo purposes)\n' +
        '- `--timeout 30` — abort each request after 30 seconds\n' +
        '- `-o results.json` — also write the full JSON report',
      terminalCommand: 'redfireforge run examples/sla-jsonplaceholder-test.yaml --sla-config examples/sla-jsonplaceholder-targets.json -m sequential --timeout 30 -o results.json',
      terminalOutput:
        '  SLA Evaluation:\n' +
        '  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n' +
        '  \u2713 Feature Group P95 SLA [FG: SLA Test Suite]      247.8ms  (target: <= 2000ms)\n' +
        '  \u2713 Create Post P95 [Create Post]                    247.8ms  (target: <= 1000ms)\n' +
        '  \u2717 Create Post TPS [Create Post]                  4.0req/s  (target: >= 100req/s)\n' +
        '  \u2713 Create Post Error Rate [Create Post]               0.0%  (target: <= 2%)\n' +
        '  \u2713 Posts P95 [Get Posts]                            38.3ms  (target: <= 1500ms)\n' +
        '  \u2713 Users P95 [Get Users]                            35.4ms  (target: <= 500ms)\n' +
        '  \u2713 Users Error Rate [Get Users]                       0.0%  (target: <= 1%)\n' +
        '  \u2713 Update Post Avg Latency [Update Post]            98.9ms  (target: <= 600ms)\n' +
        '  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n' +
        '  \u2717 SLA: 1 violation, 7 passing',
      // 2 beats: the reproducibly-failing TPS target, then the overall SLA verdict line.
      terminalHighlightLines: [[5, 5], [12, 12]],
      pauseAfter: true,
    },

    // ── Step 3: Trigger a Warning, Deterministically ─────────────────────
    {
      id: 'cli7-tighten-sla',
      title: 'Trigger a Warning, Deterministically',
      description:
        'Add `"warnAt"` to a target to get a yellow ⚠ warning instead of a red ✗ fail when you\'re close to the limit but not over it. In this temp config:\n\n' +
        '- Posts P95 gets `"warnAt": 5` — real P95 is ~142ms, well above 5ms, so it warns\n' +
        '- Users P95\'s `value` is tightened to `5` — guarantees a hard fail\n\n' +
        'Result: pass ✓, warn ⚠, and fail ✗ all appear in one run.\n\n' +
        '**Flags used:**\n' +
        '- `--sla-config /tmp/sla-targets-demo.json` — the temp config with `warnAt` added\n' +
        '- `-m sequential` — one request at a time\n' +
        '- `--timeout 30` — abort each request after 30 seconds',
      terminalCommand: 'redfireforge run examples/sla-jsonplaceholder-test.yaml --sla-config /tmp/sla-targets-demo.json -m sequential --timeout 30',
      terminalOutput:
        '  SLA Evaluation:\n' +
        '  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n' +
        '  \u2713 Feature Group P95 SLA [FG: SLA Test Suite]      142.0ms  (target: <= 2000ms)\n' +
        '  \u2713 Create Post P95 [Create Post]                    63.5ms  (target: <= 1000ms)\n' +
        '  \u2717 Create Post TPS [Create Post]                 15.7req/s  (target: >= 100req/s)\n' +
        '  \u2713 Create Post Error Rate [Create Post]               0.0%  (target: <= 2%)\n' +
        '  \u26a0 Posts P95 [Get Posts]                           142.0ms  (target: <= 1500ms (warn <= 5ms))\n' +
        '  \u2717 Users P95 [Get Users]                            35.2ms  (target: <= 5ms)\n' +
        '  \u2713 Users Error Rate [Get Users]                       0.0%  (target: <= 1%)\n' +
        '  \u2713 Update Post Avg Latency [Update Post]            66.5ms  (target: <= 600ms)\n' +
        '  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n' +
        '  \u2717 SLA: 2 violations, 1 warning, 5 passing',
      // 2 beats: the ⚠ warn state, then the ✗ hard-fail state.
      terminalHighlightLines: [[7, 7], [8, 8]],
      pauseAfter: true,
    },

    // ── Step 4: --fail-on-sla ──────────────────────────────────────────────
    {
      id: 'cli7-fail-on-sla',
      title: '--fail-on-sla',
      description:
        'Without `--fail-on-sla`, the SLA report is display-only — the ✗ prints but the process still exits 0. Add the flag and a violation becomes exit code `4`, which a CI pipeline can gate on.\n\n' +
        'Notice: `Result: PASSED ✅` (the tests themselves passed) but exit `4` (the SLA gate tripped). The two evaluations are independent.\n\n' +
        '**Flags used:**\n' +
        '- `--sla-config <file>` — SLA targets to evaluate\n' +
        '- `--fail-on-sla` — exit `4` if any SLA target is violated (without this, ✗ is display-only)\n' +
        '- `-m sequential` — one request at a time\n' +
        '- `--timeout 30` — abort each request after 30 seconds\n' +
        '- `-q` — quiet summary only\n' +
        '- `; echo "exit: $?"` — print the exit code so you can see the `4`',
      terminalCommand: 'redfireforge run examples/sla-jsonplaceholder-test.yaml --sla-config examples/sla-jsonplaceholder-targets.json -m sequential --timeout 30 --fail-on-sla -q; echo "exit: $?"',
      terminalOutput:
        '  Result:       PASSED \u2705\n' +
        '\n' +
        '  SLA Evaluation:\n' +
        '  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n' +
        '  \u2713 Feature Group P95 SLA [FG: SLA Test Suite]      206.8ms  (target: <= 2000ms)\n' +
        '  \u2713 Create Post P95 [Create Post]                    53.5ms  (target: <= 1000ms)\n' +
        '  \u2717 Create Post TPS [Create Post]                 18.7req/s  (target: >= 100req/s)\n' +
        '  \u2713 Create Post Error Rate [Create Post]               0.0%  (target: <= 2%)\n' +
        '  \u2713 Posts P95 [Get Posts]                            32.4ms  (target: <= 1500ms)\n' +
        '  \u2713 Users P95 [Get Users]                            33.1ms  (target: <= 500ms)\n' +
        '  \u2713 Users Error Rate [Get Users]                       0.0%  (target: <= 1%)\n' +
        '  \u2713 Update Post Avg Latency [Update Post]            58.2ms  (target: <= 600ms)\n' +
        '  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n' +
        '  \u2717 SLA: 1 violation, 7 passing\n' +
        '\n' +
        'exit: 4',
      // 2 beats: PASSED (functional correctness) vs. the SLA violation that still exits non-zero.
      terminalHighlightLines: [[1, 1], [14, 16]],
      pauseAfter: true,
    },

    // ── Step 5: Exit Code Priority (recap, no execution) ──────────────────
    {
      id: 'cli7-priority',
      title: 'Exit Code Priority',
      description:
        'When multiple gate flags fire on the same run, the **highest** exit code wins:\n\n' +
        '- `4` — SLA failure (`--fail-on-sla`)\n' +
        '- `3` — regression + test failure together\n' +
        '- `2` — regression alone (`--fail-on-regression`)\n' +
        '- `1` — plain test failure (`--fail-on-error`)\n' +
        '- `0` — clean run\n\n' +
        'The design intent: a performance regression or SLA breach is a systemic problem (the whole API got slower), which is treated as more serious than a single assertion failing.',
      terminalOutput:
        '# exit code priority (highest wins) — confirmed in cli/index.ts:\n' +
        '# 4 = SLA failure\n' +
        '# 3 = regression + test failure together\n' +
        '# 2 = regression alone\n' +
        '# 1 = plain test failure\n' +
        '# 0 = clean run',
      terminalHighlightLines: [[2, 2]],
      pauseAfter: true,
    },
  ],
};
