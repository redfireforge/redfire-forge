/**
 * CLI-8 — Baselines & Regression Detection
 *
 * Terminal-surface lesson (DemoTerminal), continuing the same pane from CLI-1 through CLI-7.
 * All captured output below was actually run against a temp standalone API Mock server
 * (two temp copies of examples/api-mock/sample-workspace.json's /health route, port 4650,
 * differing only in behavior.delayMs — 50ms "fast" vs 800ms "slow" — to make the regression
 * deterministic instead of depending on live third-party API timing), plus a temp
 * health-test.yaml fixture and a temp baselines dir. None of these are committed.
 *
 * NOTE: per BUG-5 (see docs/future/cli/cli-demo-plan.md), top-level `assertions:` blocks in
 * CLI test files are silently ignored by the loader today — every Passed/Failed count in
 * this and every other CLI lesson is driven by raw HTTP status, not custom assertions. Step
 * 5's combined regression+failure demo therefore uses a genuine HTTP 404, not a failing
 * assertion.
 */
import type { DemoLesson } from '../../types';

export const cliBaselineRegressionLesson: DemoLesson = {
  id: 'cli-baseline-regression',
  domainId: 'cli',
  category: 'reliability',
  name: 'Baselines & Regression Detection',
  description:
    'Save a known-good run as a baseline, then detect performance regressions ' +
    'against it in later runs — the CLI\'s answer to "did this PR make things slower?"',
  estimatedMinutes: 6,
  desktopOnly: false,

  concept: {
    title: 'Baselines & Regression Detection',
    body:
      'A baseline is just a saved snapshot of a run\'s summary metrics — response ' +
      'times, TPS, error rate — tagged with a label and timestamp. `--compare-baseline` ' +
      're-runs the same test and diffs the new summary against that snapshot, metric ' +
      'by metric, flagging anything that got meaningfully worse. This is how a CI ' +
      'pipeline answers "did this PR make the API slower?" without a human eyeballing ' +
      'dashboards.',
    keyTerms: [
      { term: '--save-baseline', definition: 'Only saves when the run itself is clean (no failures, no regressions) — a dirty run is never a reference point.' },
      { term: '--compare-baseline latest-baseline', definition: 'Auto-picks the most recent baseline saved for this exact test file path.' },
    ],
    diagram: `<svg viewBox="0 0 440 210" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <marker id="cli8-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="var(--primary)"/>
    </marker>
  </defs>
  <!-- baseline run -->
  <rect x="15" y="14" width="190" height="52" rx="6" fill="var(--accent)" opacity="0.15" stroke="var(--accent)" stroke-width="1.5"/>
  <text x="110" y="35" text-anchor="middle" fill="var(--text)" font-size="11" font-family="system-ui" font-weight="600">Run 1 (baseline)</text>
  <text x="110" y="51" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-family="system-ui">--save-baseline (clean only)</text>
  <!-- later run -->
  <rect x="235" y="14" width="190" height="52" rx="6" fill="var(--primary)" opacity="0.15" stroke="var(--primary)" stroke-width="1.5"/>
  <text x="330" y="35" text-anchor="middle" fill="var(--text)" font-size="11" font-family="system-ui" font-weight="600">Run 2 (later)</text>
  <text x="330" y="51" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-family="system-ui">--compare-baseline</text>
  <!-- converging arrows -->
  <line x1="150" y1="66" x2="200" y2="88" stroke="var(--accent)" stroke-width="1.5" marker-end="url(#cli8-arrow)"/>
  <line x1="290" y1="66" x2="240" y2="88" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#cli8-arrow)"/>
  <!-- regression report -->
  <rect x="100" y="90" width="240" height="50" rx="6" fill="var(--text-muted)" opacity="0.12" stroke="var(--text-muted)" stroke-width="1.5"/>
  <text x="220" y="111" text-anchor="middle" fill="var(--text)" font-size="11" font-family="system-ui" font-weight="600">Regression Report</text>
  <text x="220" y="127" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-family="system-ui">metric-by-metric diff</text>
  <!-- arrow down -->
  <line x1="220" y1="140" x2="220" y2="158" stroke="var(--error,#f38ba8)" stroke-width="1.5" marker-end="url(#cli8-arrow)"/>
  <!-- exit codes -->
  <rect x="30" y="160" width="380" height="40" rx="6" fill="var(--error,#f38ba8)" opacity="0.12" stroke="var(--error,#f38ba8)" stroke-width="1.5"/>
  <text x="220" y="184" text-anchor="middle" fill="var(--error,#f38ba8)" font-size="10" font-family="system-ui" font-weight="600">exit 0 clean / 1 test fail / 2 regression / 3 both</text>
</svg>`,
  },

  steps: [
    // ── Step 1: Start the "Fast" Mock ────────────────────────────────────
    {
      id: 'cli8-fast-mock',
      title: 'Start the "Fast" Mock',
      description:
        'To make the regression deterministic, we use two temp copies of an API Mock workspace differing only in `behavior.delayMs`: 50ms (fast) and 800ms (slow). No flaky external API timing.\n\n' +
        'Start the fast one first — this is what the "known-good" baseline will be measured against.\n\n' +
        '**Flags used:**\n' +
        '- `mock start <file>` — start a mock server from a workspace JSON file\n' +
        '- `--standalone` — run the mock entirely in-process (no companion dev server needed)',
      terminalCommand: 'redfireforge mock start /tmp/mock-fast.json --standalone',
      terminalOutput:
        '{\n' +
        '  "ready": true,\n' +
        '  "results": [\n' +
        '    { "serverId": "srv-demo", "ok": true, "port": 4650, "mode": "standalone" }\n' +
        '  ]\n' +
        '}\n' +
        'In-process listeners keep this process alive. Press Ctrl+C to stop.',
      terminalHighlightLines: [[2, 2]],
      pauseAfter: true,
    },

    // ── Step 2: Save a Baseline ──────────────────────────────────────────
    {
      id: 'cli8-save-baseline',
      title: 'Save a Baseline',
      description:
        'Run the test against the fast mock and save the result as a baseline. Only a **clean** run gets saved — no failures, no existing regressions. A dirty run is never worth using as a future reference point.\n\n' +
        'The output confirms: `Baseline saved (pre-change): <id>`.\n\n' +
        '**Flags used:**\n' +
        '- `--save-baseline` — save this run\'s summary metrics as a baseline snapshot (only if clean)\n' +
        '- `--baseline-label "pre-change"` — human-readable name for the baseline\n' +
        '- `--baselines-dir /tmp/cli8-baselines` — directory to store baseline files',
      terminalCommand: 'redfireforge run health-test.yaml --save-baseline --baseline-label "pre-change" --baselines-dir /tmp/cli8-baselines',
      terminalOutput:
        '  Total:        1\n' +
        '  Passed:       1\n' +
        '  Result:       PASSED \u2705\n' +
        '\n' +
        '  Baseline saved (pre-change): f1a87917-d97d-4125-84fd-1c87de597999',
      terminalHighlightLines: [[5, 5]],
      pauseAfter: true,
    },

    // ── Step 3: Restart as the "Slow" Mock ───────────────────────────────
    {
      id: 'cli8-slow-mock',
      title: 'Restart as the "Slow" Mock',
      description:
        'Stop the fast mock and start the slow one on the same port — same route, same response body, only the artificial delay changed from 50ms to 800ms.\n\n' +
        'This simulates a real regression: a PR that adds an N+1 query, a new blocking call, or any change that made the endpoint slower without breaking its correctness.\n\n' +
        '**Flags used:**\n' +
        '- `mock start <file>` — same command, different workspace file (800ms delay instead of 50ms)\n' +
        '- `--standalone` — in-process listener, same port as before',
      terminalCommand: 'redfireforge mock start /tmp/mock-slow.json --standalone',
      terminalOutput:
        '{\n' +
        '  "ready": true,\n' +
        '  "results": [\n' +
        '    { "serverId": "srv-demo", "ok": true, "port": 4650, "mode": "standalone" }\n' +
        '  ]\n' +
        '}',
      terminalHighlightLines: [[2, 2]],
      pauseAfter: true,
    },

    // ── Step 4: --compare-baseline latest-baseline ───────────────────────
    {
      id: 'cli8-compare-latest',
      title: '--compare-baseline latest-baseline',
      description:
        'Re-run the identical command against the slow mock. The regression report prints after the summary — a full metric-by-metric table: baseline value, current value, delta, percent change, and severity.\n\n' +
        'Every latency metric jumped from ~107ms to ~858ms — `🔴 CRITICAL` across the board. TPS dropped from 9.25 to 1.16. Error rate: unchanged (the endpoint still responds correctly).\n\n' +
        '**Flags used:**\n' +
        '- `--compare-baseline latest-baseline` — auto-pick the most recent baseline saved for this test file path\n' +
        '- `--baselines-dir /tmp/cli8-baselines` — directory where baselines are stored',
      terminalCommand: 'redfireforge run health-test.yaml --compare-baseline latest-baseline --baselines-dir /tmp/cli8-baselines',
      terminalOutput:
        '  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n' +
        '  Performance Regression Report\n' +
        '  Baseline : pre-change\n' +
        '  Current  : 8/18/2026, 10:46:28 PM\n' +
        '  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n' +
        '  Metric                    Baseline      Current       \u0394           Status\n' +
        '  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n' +
        '  Avg Response Time         107.45 ms     857.94 ms     +750.49 ms (+698.46%  \ud83d\udd34 CRITICAL\n' +
        '  P50 Response Time         107.45 ms     857.94 ms     +750.49 ms (+698.46%  \ud83d\udd34 CRITICAL\n' +
        '  P95 Response Time         107.45 ms     857.94 ms     +750.49 ms (+698.46%  \ud83d\udd34 CRITICAL\n' +
        '  P99 Response Time         107.45 ms     857.94 ms     +750.49 ms (+698.46%  \ud83d\udd34 CRITICAL\n' +
        '  P99.9 Response Time       107.45 ms     857.94 ms     +750.49 ms (+698.46%  \ud83d\udd34 CRITICAL\n' +
        '  Min Response Time         107.45 ms     857.94 ms     +750.49 ms (+698.46%  \ud83d\udd34 CRITICAL\n' +
        '  Max Response Time         107.45 ms     857.94 ms     +750.49 ms (+698.46%  \ud83d\udd34 CRITICAL\n' +
        '  TPS                       9.25          1.16          -8.09 (-87.46%)       \ud83d\udd34 CRITICAL\n' +
        '  Error Rate                0%            0%            0 pp (0%)             \u2014 ok\n' +
        '  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n' +
        '  \u26a0  Regressions: 8 critical',
      // 2 beats: the response-time block (every percentile moved together), then the TPS/Error Rate lines.
      terminalHighlightLines: [[8, 14], [15, 16]],
      pauseAfter: true,
    },

    // ── Step 5: --fail-on-regression ──────────────────────────────────────
    {
      id: 'cli8-fail-on-regression',
      title: '--fail-on-regression',
      description:
        'Same comparison, now gating on it. Two runs:\n\n' +
        '1. **Regression only** — `--fail-on-regression` turns a detected regression into exit `2`\n' +
        '2. **Regression + test failure** — point the URL at a non-existent route (genuine 404), add `--fail-on-error`; both triggers fire together → exit `3`\n\n' +
        'Baselines match by test file path, so the URL inside the file can change freely without invalidating the baseline.\n\n' +
        '**Flags used:**\n' +
        '- `--compare-baseline latest-baseline` — compare against the most recent saved baseline\n' +
        '- `--baselines-dir /tmp/cli8-baselines` — baseline storage directory\n' +
        '- `--fail-on-regression` — exit `2` if a regression is detected\n' +
        '- `--fail-on-error` — exit `1` if any test failed (combined with regression → exit `3`)\n' +
        '- `-q` — quiet summary only\n' +
        '- `; echo "exit: $?"` — print the exit code so you can see the difference',
      terminalCommand:
        'redfireforge run health-test.yaml --compare-baseline latest-baseline --baselines-dir /tmp/cli8-baselines --fail-on-regression -q; echo "exit: $?"',
      terminalOutput:
        'exit: 2\n' +
        '\n' +
        '$ # ...edit health-test.yaml\'s url to a nonexistent route...\n' +
        '$ redfireforge run health-test.yaml --compare-baseline latest-baseline --baselines-dir /tmp/cli8-baselines --fail-on-regression --fail-on-error -q; echo "exit: $?"\n' +
        '  Total:        1\n' +
        '  Passed:       0\n' +
        '  Failed HTTP:  1\n' +
        '  Error Rate:   100%\n' +
        '  Result:       FAILED \u274c\n' +
        'exit: 3',
      // 2 beats: the regression-only exit 2 (line 1), then the combined regression+failure exit 3 (lines 9–10).
      terminalHighlightLines: [[1, 1], [9, 10]],
      pauseAfter: true,
    },

    // ── Step 6: --comparison-report ───────────────────────────────────────
    {
      id: 'cli8-comparison-report',
      title: '--comparison-report',
      description:
        'Write the comparison as Markdown — same spirit as `--markdown` from the Reports lesson, ready to post as a PR comment.\n\n' +
        'The report has two tables:\n' +
        '- **Metric Deltas** — every metric\'s change, including improvements (don\'t assume the whole table is "the regressions")\n' +
        '- **Regressions** — only the metrics that crossed a threshold, with severity and exact delta\n\n' +
        '**Flags used:**\n' +
        '- `--compare-baseline latest-baseline` — compare against the most recent saved baseline\n' +
        '- `--baselines-dir /tmp/cli8-baselines` — baseline storage directory\n' +
        '- `--comparison-report comparison.md` — write the comparison as a Markdown file\n' +
        '- `-q` — quiet summary only\n' +
        '- `&& cat comparison.md` — print the Markdown so you can see the tables',
      terminalCommand: 'redfireforge run health-test.yaml --compare-baseline latest-baseline --baselines-dir /tmp/cli8-baselines --comparison-report comparison.md -q && cat comparison.md',
      terminalOutput:
        '# Performance Comparison Report\n' +
        '\n' +
        '| | |\n' +
        '|:---|:---|\n' +
        '| **Baseline** | pre-change |\n' +
        '\n' +
        '> \u26a0 **1 regression detected** (1 critical)\n' +
        '\n' +
        '## Metric Deltas\n' +
        '\n' +
        '| Metric | Baseline | Current | Delta | Change | Status |\n' +
        '|:---|---:|---:|---:|---:|:---|\n' +
        '| Avg Response Time | 107.45 ms | 27.88 ms | -79.57 ms | -74.05% | \u2713 Improved |\n' +
        '| TPS | 9.25 | 34.96 | +25.71 | +277.95% | \u2713 Improved |\n' +
        '| Error Rate | 0% | 100% | +100 pp | 0% | \ud83d\udd34 Critical |\n' +
        '\n' +
        '## Regressions\n' +
        '\n' +
        '| Metric | Severity | Threshold | Actual |\n' +
        '|:---|:---|---:|---:|\n' +
        '| Error Rate | \ud83d\udd34 Critical | 1 pp | +100 pp |',
      // 2 beats: the metric-deltas table (mostly improved), then the dedicated Regressions table.
      terminalHighlightLines: [[13, 15], [17, 21]],
      pauseAfter: true,
    },
  ],
};
