/**
 * CLI-4 — Error Policies & CI Gating
 *
 * Terminal-surface lesson (DemoTerminal), continuing the same pane from CLI-1/2/3.
 * All captured output below was actually run against the repo (`examples/cli-error-handling.yaml`
 * against the real JSONPlaceholder API, one test always 404s), not invented — see
 * docs/future/cli/cli-demo-plan.md. Output is trimmed to the summary fields each step's
 * narration actually references, consistent with CLI-3's approach.
 */
import type { DemoLesson } from '../../types';

export const cliErrorPoliciesLesson: DemoLesson = {
  id: 'cli-error-policies',
  domainId: 'cli',
  category: 'execution',
  name: 'Error Policies & CI Gating',
  description:
    'Circuit-breaker error policies (continue/stop-first/stop-threshold) plus the ' +
    'flags that turn test failures into CI pipeline failures.',
  estimatedMinutes: 5,
  desktopOnly: false,

  concept: {
    title: 'Error Policies & CI Gating',
    body:
      'Two separate concerns get confused a lot: whether the run keeps going after a ' +
      'failure (error policy), and whether the process exits non-zero when it\'s done ' +
      '(CI gating). `examples/cli-error-handling.yaml` has one test that always 404s ' +
      '(`/users/99999`) — everything in this lesson runs against that one deliberate failure.',
    keyTerms: [
      { term: 'continue', definition: 'Default policy — run everything regardless of failures.' },
      { term: 'stop-first / stop-threshold', definition: 'Circuit breaker policies — halt the run itself, either on the first failure or once an error rate/count is crossed.' },
      { term: '--fail-on-error / --fail-threshold', definition: 'Don\'t change what runs — only change the exit code afterward, turning a failed summary into a failed CI check.' },
    ],
    diagram: `<svg viewBox="0 0 440 210" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <marker id="cli4-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="var(--primary)"/>
    </marker>
  </defs>
  <text x="220" y="14" text-anchor="middle" fill="var(--text-muted)" font-size="10" font-family="system-ui" font-weight="600">error policy — controls WHAT RUNS</text>
  <!-- continue -->
  <rect x="10" y="24" width="130" height="56" rx="6" fill="var(--text-muted)" opacity="0.12" stroke="var(--text-muted)" stroke-width="1.5"/>
  <text x="75" y="48" text-anchor="middle" fill="var(--text)" font-size="11" font-family="system-ui" font-weight="600">continue</text>
  <text x="75" y="64" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-family="system-ui">default, runs all</text>
  <!-- stop-first -->
  <rect x="155" y="24" width="130" height="56" rx="6" fill="var(--primary)" opacity="0.15" stroke="var(--primary)" stroke-width="1.5"/>
  <text x="220" y="48" text-anchor="middle" fill="var(--text)" font-size="11" font-family="system-ui" font-weight="600">stop-first</text>
  <text x="220" y="64" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-family="system-ui">halts on 1st fail</text>
  <!-- stop-threshold -->
  <rect x="300" y="24" width="130" height="56" rx="6" fill="var(--primary)" opacity="0.15" stroke="var(--primary)" stroke-width="1.5"/>
  <text x="365" y="48" text-anchor="middle" fill="var(--text)" font-size="11" font-family="system-ui" font-weight="600">stop-threshold</text>
  <text x="365" y="64" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-family="system-ui">halts past a rate</text>
  <!-- divider -->
  <line x1="10" y1="98" x2="430" y2="98" stroke="var(--text-muted)" stroke-width="1" stroke-dasharray="2,3" opacity="0.5"/>
  <text x="220" y="114" text-anchor="middle" fill="var(--text-muted)" font-size="10" font-family="system-ui" font-weight="600">CI gating — a separate axis, controls the EXIT CODE</text>
  <!-- fail flags -->
  <rect x="40" y="124" width="360" height="40" rx="6" fill="var(--accent)" opacity="0.15" stroke="var(--accent)" stroke-width="1.5"/>
  <text x="220" y="148" text-anchor="middle" fill="var(--text)" font-size="11" font-family="system-ui" font-weight="600">--fail-on-error / --fail-threshold</text>
  <!-- arrow down -->
  <line x1="220" y1="164" x2="220" y2="182" stroke="var(--accent)" stroke-width="1.5" marker-end="url(#cli4-arrow)"/>
  <!-- exit code -->
  <rect x="155" y="184" width="130" height="24" rx="12" fill="var(--error,#f38ba8)" opacity="0.15" stroke="var(--error,#f38ba8)" stroke-width="1.5"/>
  <text x="220" y="200" text-anchor="middle" fill="var(--error,#f38ba8)" font-size="10" font-family="system-ui" font-weight="600">exit 0 or 1</text>
</svg>`,
  },

  steps: [
    // ── Step 1: continue (default) ────────────────────────────────────
    {
      id: 'cli4-continue',
      title: 'continue (default)',
      description:
        'No `--error-policy` flag means `continue` — run everything, even after failures. ' +
        'All 25 requests complete (5 tests × 5 iterations) even though one test always 404s.\n\n' +
        'This is the right default for CI: one bad test shouldn\'t hide the other four.\n\n' +
        '**Flags used:**\n' +
        '- *(no `--error-policy`)* — defaults to `continue`\n' +
        '- `-q` — quiet summary only',
      terminalCommand: 'redfireforge run examples/cli-error-handling.yaml -q',
      terminalOutput:
        '  Mode:         batch (C:1 I:5)\n' +
        '  Duration:     1.15s\n' +
        '  Total:        25\n' +
        '  Passed:       20\n' +
        '  Failed HTTP:  5\n' +
        '  Failed Valid: 5\n' +
        '  Error Rate:   20%\n' +
        '  Result:       FAILED ❌',
      terminalHighlightLines: [[3, 3]],
      pauseAfter: true,
    },

    // ── Step 2: stop-first ─────────────────────────────────────────────
    {
      id: 'cli4-stop-first',
      title: 'stop-first',
      description:
        'The opposite of `continue`: stop the moment anything fails. Compare the `Total:` ' +
        'lines — 12 requests ran here vs. 25 with `continue`. The run halted as soon as ' +
        'the bad test hit.\n\n' +
        'Use this locally when you just want to find and fix the first failure without ' +
        'waiting for the rest to finish.\n\n' +
        '**Flags used:**\n' +
        '- `--error-policy stop-first` — halt the run on the very first failure\n' +
        '- `-q` — quiet summary only',
      terminalCommand: 'redfireforge run examples/cli-error-handling.yaml --error-policy stop-first -q',
      terminalOutput:
        '  Mode:         batch (C:1 I:5)\n' +
        '  Duration:     0.53s\n' +
        '  Total:        12\n' +
        '  Passed:       11\n' +
        '  Failed HTTP:  1\n' +
        '  Failed Valid: 1\n' +
        '  Error Rate:   8.33%\n' +
        '  Result:       FAILED ❌',
      terminalHighlightLines: [[2, 3]],
      pauseAfter: true,
    },

    // ── Step 3: stop-threshold ─────────────────────────────────────────
    {
      id: 'cli4-stop-threshold',
      title: 'stop-threshold',
      description:
        'The middle ground: keep going past the first failure, but stop once the error ' +
        'rate crosses a threshold. Here the run stopped at 10 requests (Error Rate: 10%), ' +
        'not 25 like `continue` and not 12 like `stop-first`.\n\n' +
        'Good for CI pipelines where a few known-flaky tests are acceptable, but a ' +
        'cascade of failures should abort the run early.\n\n' +
        '**Flags used:**\n' +
        '- `--error-policy stop-threshold` — halt once the error rate exceeds the limit\n' +
        '- `--max-error-rate 10` — the threshold: stop once more than 10% of requests have failed\n' +
        '- `-q` — quiet summary only',
      terminalCommand: 'redfireforge run examples/cli-error-handling.yaml --error-policy stop-threshold --max-error-rate 10 -q',
      terminalOutput:
        '  Mode:         batch (C:1 I:5)\n' +
        '  Duration:     0.45s\n' +
        '  Total:        10\n' +
        '  Passed:       9\n' +
        '  Failed HTTP:  1\n' +
        '  Failed Valid: 1\n' +
        '  Error Rate:   10%\n' +
        '  Result:       FAILED ❌',
      // 2 beats: the stopped total, then the error rate that triggered it.
      terminalHighlightLines: [[3, 3], [7, 7]],
      pauseAfter: true,
    },

    // ── Step 4: --fail-on-error ─────────────────────────────────────────
    {
      id: 'cli4-fail-on-error',
      title: '--fail-on-error',
      description:
        'Error policies control what **runs**. This flag controls what happens **after** — ' +
        'whether a failed run also fails the process.\n\n' +
        'Same test, run twice:\n' +
        '- without `--fail-on-error` → `Result: FAILED ❌`, exit `0` (CI passes)\n' +
        '- with `--fail-on-error` → `Result: FAILED ❌`, exit `1` (CI fails)\n\n' +
        'This is the flag that turns a red summary into a red CI check.\n\n' +
        '**Flags used:**\n' +
        '- `--fail-on-error` — exit with code `1` if any test failed (omit to always exit `0`)\n' +
        '- `-q` — quiet summary only\n' +
        '- `; echo "exit: $?"` — prints the process exit code so you can see the difference',
      terminalCommand:
        'redfireforge run examples/cli-error-handling.yaml -q; echo "exit: $?"',
      terminalOutput:
        '  Result:       FAILED ❌\n' +
        'exit: 0\n' +
        '\n' +
        '$ redfireforge run examples/cli-error-handling.yaml --fail-on-error -q; echo "exit: $?"\n' +
        '  Result:       FAILED ❌\n' +
        'exit: 1',
      // 2 beats: the un-gated exit 0 (line 2), then the gated exit 1 (line 6).
      terminalHighlightLines: [[2, 2], [6, 6]],
      pauseAfter: true,
    },

    // ── Step 5: --fail-threshold <pct> ──────────────────────────────────
    {
      id: 'cli4-fail-threshold',
      title: '--fail-threshold <pct>',
      description:
        '`--fail-on-error` is all-or-nothing — any failure fails the process. ' +
        '`--fail-threshold` is more forgiving: only fail CI if the **error rate** exceeds ' +
        'a percentage.\n\n' +
        'This run has a 20% error rate. With `--fail-threshold 5`, anything over 5% trips ' +
        'the gate, so exit `1`. The explanation line (`Error rate 20% exceeds threshold 5%`) ' +
        'prints even with `-q` — you don\'t need to drop quiet mode to see why CI failed.\n\n' +
        '**Flags used:**\n' +
        '- `--fail-threshold 5` — fail the process only if the error rate exceeds 5%\n' +
        '- `--fail-on-error` — required alongside `--fail-threshold` to actually set exit code `1`\n' +
        '- `-q` — quiet summary only\n' +
        '- `; echo "exit: $?"` — prints the process exit code',
      terminalCommand: 'redfireforge run examples/cli-error-handling.yaml --fail-threshold 5 --fail-on-error -q; echo "exit: $?"',
      terminalOutput:
        '  Result:       FAILED ❌\n' +
        '\n' +
        '  Error rate 20% exceeds threshold 5%\n' +
        'exit: 1',
      terminalHighlightLines: [[3, 4]],
      pauseAfter: true,
    },
  ],
};
