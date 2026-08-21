/**
 * CLI-3 — Execution Modes & Concurrency
 *
 * Terminal-surface lesson (DemoTerminal), continuing the same pane from CLI-1/CLI-2.
 * All captured output below was actually run against the repo (`examples/cli-load-profile.yaml`
 * against the real JSONPlaceholder API, plus a deliberately non-routable IP for the timeout/retry
 * step), not invented — see docs/future/cli/cli-demo-plan.md. Output is trimmed to the handful of
 * summary fields each step's narration actually references (Mode/Duration/TPS/Total/Result, plus
 * latency fields for the timeout step) rather than the full dashed block, since several steps
 * compare two full runs side by side.
 */
import type { DemoLesson } from '../../types';

export const cliExecutionModesLesson: DemoLesson = {
  id: 'cli-execution-modes',
  domainId: 'cli',
  category: 'execution',
  name: 'Execution Modes & Concurrency',
  description:
    'Understand -c/-i, the four execution modes (sequential, batch, pool, load-profile), ' +
    'and per-request timeout/retry controls.',
  estimatedMinutes: 6,
  desktopOnly: false,

  concept: {
    title: 'Execution Modes & Concurrency',
    body:
      '`-c` (concurrency) and `-i` (iterations) control the shape of a run, but the ' +
      'execution mode decides how they interact. `examples/cli-load-profile.yaml` ships ' +
      'its own default (`concurrency: 5`, `mode: pool` under its `config:` key) — CLI ' +
      'flags always override the file\'s own config.',
    keyTerms: [
      { term: 'pool', definition: 'Default mode — a fixed pool of C workers continuously refills from a shared queue, no wave boundary.' },
      { term: 'batch', definition: 'Fixed-size waves of C requests — each wave fully completes before the next one starts.' },
      { term: 'sequential', definition: 'One request at a time, always — ignores whatever -c says. For debugging, not throughput.' },
      { term: 'load-profile', definition: 'Time-boxed instead of iteration-boxed — run for N seconds (--duration), however many requests that produces.' },
    ],
    diagram: `<svg viewBox="0 0 420 230" xmlns="http://www.w3.org/2000/svg">
  <text x="210" y="16" text-anchor="middle" fill="var(--text-muted)" font-size="10" font-family="system-ui" font-weight="600">-m &lt;mode&gt; picks one:</text>
  <!-- sequential -->
  <rect x="15" y="30" width="190" height="70" rx="6" fill="var(--text-muted)" opacity="0.12" stroke="var(--text-muted)" stroke-width="1.5"/>
  <text x="110" y="52" text-anchor="middle" fill="var(--text)" font-size="11" font-family="system-ui" font-weight="600">sequential</text>
  <text x="110" y="68" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-family="system-ui">1 at a time, ignores -c</text>
  <text x="110" y="82" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-family="system-ui">debugging</text>
  <!-- batch -->
  <rect x="215" y="30" width="190" height="70" rx="6" fill="var(--text-muted)" opacity="0.12" stroke="var(--text-muted)" stroke-width="1.5"/>
  <text x="310" y="52" text-anchor="middle" fill="var(--text)" font-size="11" font-family="system-ui" font-weight="600">batch</text>
  <text x="310" y="68" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-family="system-ui">fixed waves of C</text>
  <text x="310" y="82" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-family="system-ui">waits for full wave</text>
  <!-- pool (default) -->
  <rect x="15" y="120" width="190" height="70" rx="6" fill="var(--primary)" opacity="0.15" stroke="var(--primary)" stroke-width="1.5"/>
  <text x="110" y="142" text-anchor="middle" fill="var(--text)" font-size="11" font-family="system-ui" font-weight="600">pool (default)</text>
  <text x="110" y="158" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-family="system-ui">C workers refill queue</text>
  <text x="110" y="172" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-family="system-ui">sustained concurrency</text>
  <!-- load-profile -->
  <rect x="215" y="120" width="190" height="70" rx="6" fill="var(--accent)" opacity="0.15" stroke="var(--accent)" stroke-width="1.5"/>
  <text x="310" y="142" text-anchor="middle" fill="var(--text)" font-size="11" font-family="system-ui" font-weight="600">load-profile</text>
  <text x="310" y="158" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-family="system-ui">time-boxed, --duration</text>
  <text x="310" y="172" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-family="system-ui">iterations ignored</text>
  <text x="210" y="212" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-family="system-ui">-c / -i shape every mode except load-profile</text>
</svg>`,
  },

  steps: [
    // ── Step 1: Concurrency vs. Iterations ────────────────────────────
    {
      id: 'cli3-concurrency-iterations',
      title: 'Concurrency vs. Iterations',
      description:
        'Run the same fixture twice — baseline, then 5× the load. TPS jumps from ~19 to ~88; ' +
        'duration barely moves. That gap is what concurrency buys you.\n\n' +
        '**Flags used:**\n' +
        '- `-c` — how many requests run in parallel at once\n' +
        '- `-i` — how many iterations (passes through the test file) to run in total\n' +
        '- `-q` — quiet: print only the summary block, skip per-request lines',
      terminalCommand:
        'redfireforge run examples/cli-load-profile.yaml -c 1 -i 3 -q',
      terminalOutput:
        '  Mode:         pool (C:1 I:3)\n' +
        '  Duration:     0.48s\n' +
        '  TPS:          18.78\n' +
        '  Total:        9\n' +
        '  Result:       PASSED ✅\n' +
        '\n' +
        '$ redfireforge run examples/cli-load-profile.yaml -c 5 -i 15 -q\n' +
        '  Mode:         pool (C:5 I:15)\n' +
        '  Duration:     0.51s\n' +
        '  TPS:          88.43\n' +
        '  Total:        45\n' +
        '  Result:       PASSED ✅',
      // 2 beats: the baseline run (lines 1–5), then the 5× concurrency run (lines 8–12).
      terminalHighlightLines: [[1, 5], [8, 12]],
      pauseAfter: true,
    },

    // ── Step 2: `sequential` Mode ──────────────────────────────────────
    {
      id: 'cli3-sequential',
      title: 'Sequential Mode',
      description:
        'Sequential mode always sends **one request at a time**, no matter what `-c` says ' +
        'or what the YAML file\'s `config.concurrency` is set to.\n\n' +
        'Check the `Mode:` line in the output: `sequential (C:1 I:3)`. The `C:1` is what ' +
        'actually ran — the CLI reports the concurrency it **honored**, not the value it ignored.\n\n' +
        '**Flags used:**\n' +
        '- `-m sequential` — execution mode: one request at a time, great for debugging\n' +
        '- `-i 3` — run 3 iterations (9 total requests: 3 tests × 3 iterations)\n' +
        '- `-q` — quiet summary only',
      terminalCommand: 'redfireforge run examples/cli-load-profile.yaml -m sequential -i 3 -q',
      terminalOutput:
        '  Mode:         sequential (C:1 I:3)\n' +
        '  Duration:     0.40s\n' +
        '  TPS:          22.31\n' +
        '  Total:        9\n' +
        '  Result:       PASSED ✅',
      terminalHighlightLines: [[1, 1]],
      pauseAfter: true,
    },

    // ── Step 3: `batch` vs. `pool` ─────────────────────────────────────
    {
      id: 'cli3-batch-pool',
      title: 'Batch vs. Pool',
      description:
        'Both modes run requests concurrently, but they schedule differently:\n\n' +
        '- **batch** — fires a wave of `C` requests, then **waits** for the entire wave to finish before starting the next. One slow request blocks everything behind it.\n' +
        '- **pool** — keeps `C` workers continuously busy. As soon as one finishes, it picks up the next request immediately — no wave boundary, no waiting on stragglers.\n\n' +
        'Same `-c 3 -i 9` for both; notice pool is faster (0.56s vs 0.79s) because it never stalls.\n\n' +
        '**Flags used:**\n' +
        '- `-m batch` / `-m pool` — execution mode\n' +
        '- `-c 3` — 3 parallel workers\n' +
        '- `-i 9` — 9 iterations (27 total requests: 3 tests × 9)\n' +
        '- `-q` — quiet summary only',
      terminalCommand:
        'redfireforge run examples/cli-load-profile.yaml -m batch -c 3 -i 9 -q',
      terminalOutput:
        '  Mode:         batch (C:3 I:9)\n' +
        '  Duration:     0.79s\n' +
        '  TPS:          34.41\n' +
        '  Total:        27\n' +
        '  Result:       PASSED ✅\n' +
        '\n' +
        '$ redfireforge run examples/cli-load-profile.yaml -m pool -c 3 -i 9 -q\n' +
        '  Mode:         pool (C:3 I:9)\n' +
        '  Duration:     0.56s\n' +
        '  TPS:          48.4\n' +
        '  Total:        27\n' +
        '  Result:       PASSED ✅',
      // 2 beats: the batch run (lines 1–5), then the pool run (lines 8–12).
      terminalHighlightLines: [[1, 5], [8, 12]],
      pauseAfter: true,
    },

    // ── Step 4: `load-profile` + `--duration` ──────────────────────────
    {
      id: 'cli3-load-profile',
      title: 'load-profile + --duration',
      description:
        'Every mode so far was **iteration-boxed**: run exactly N requests, however long it takes.\n\n' +
        '`load-profile` flips that to **time-boxed**: run for exactly N seconds, however many requests that produces. The output shows 376 requests in 3.03s — you didn\'t pick 376, the clock did.\n\n' +
        'Use this when the question is "how much can this API handle in 3 seconds?" rather than "run these 500 requests".\n\n' +
        '**Flags used:**\n' +
        '- `-m load-profile` — time-boxed execution mode\n' +
        '- `--duration 3` — run for 3 seconds (replaces `-i`; iteration count is ignored)\n' +
        '- `-q` — quiet summary only',
      terminalCommand: 'redfireforge run examples/cli-load-profile.yaml -m load-profile --duration 3 -q',
      terminalOutput:
        '  Mode:         load-profile (C:5 I:3)\n' +
        '  Duration:     3.03s\n' +
        '  TPS:          124.04\n' +
        '  Total:        376\n' +
        '  Result:       PASSED ✅',
      terminalHighlightLines: [[1, 4]],
      pauseAfter: true,
    },

    // ── Step 5: Timeouts & Retries ──────────────────────────────────────
    {
      id: 'cli3-timeout-retries',
      title: 'Timeouts & Retries',
      description:
        'Point `--base-url` at a non-routable IP so every request genuinely hangs — real ' +
        'timeouts, not simulated. Two things to spot in the output:\n\n' +
        '1. **P50 ≈ 1001ms** — that\'s the timeout ceiling, not network speed. Every request hits the hard cap.\n' +
        '2. **Result: FAILED, exit: 0** — `--fail-on-error` wasn\'t passed, so a failed run still exits 0. Timeouts and retries control _how hard_ the CLI tries; a separate flag controls whether CI breaks.\n\n' +
        '**Flags used:**\n' +
        '- `--base-url` — override the base URL for this run (here: a non-routable address)\n' +
        '- `-m sequential` — one request at a time so timeouts are easy to count\n' +
        '- `-i 1` — one iteration (3 total requests: 3 tests × 1)\n' +
        '- `--timeout 1` — abort each attempt after 1 second\n' +
        '- `--retries 1` — retry each failed request once\n' +
        '- `--retry-delay 300` — wait 300ms before retrying\n' +
        '- `-q` — quiet summary only',
      terminalCommand:
        'redfireforge run examples/cli-load-profile.yaml --base-url https://10.255.255.1 ' +
        '-m sequential -i 1 --timeout 1 --retries 1 --retry-delay 300 -q; echo "exit: $?"',
      terminalOutput:
        '  Mode:         sequential (C:1 I:1)\n' +
        '  Duration:     6.91s\n' +
        '  TPS:          0.43\n' +
        '  Avg Response: 1001.5 ms\n' +
        '  P50:          1001.68 ms\n' +
        '  Total:        3\n' +
        '  Passed:       0\n' +
        '  Failed HTTP:  3\n' +
        '  Error Rate:   100%\n' +
        '  Result:       FAILED ❌\n' +
        'exit: 0',
      // 2 beats: the P50 latency (timeout ceiling), then the FAILED result + exit 0 gotcha.
      terminalHighlightLines: [[5, 5], [10, 11]],
      pauseAfter: true,
    },

    // ── Step 6: When to Use Which Mode (recap, no execution) ────────────
    {
      id: 'cli3-recap',
      title: 'When to Use Which Mode',
      description:
        'Pick the mode that matches your goal:\n\n' +
        '- `sequential` — one request at a time; use when you\'re debugging a failure and need a clear, sequential log\n' +
        '- `batch` — fixed-size waves; use when you need clean, discrete bursts (e.g. matching a downstream rate limit)\n' +
        '- `pool` *(default)* — C workers always busy; use for realistic sustained concurrency\n' +
        '- `load-profile` — time-boxed via `--duration`; use when the question is "how much traffic in N seconds?"',
      terminalOutput:
        '# sequential   → one request at a time; ignores -c; use for debugging\n' +
        '# batch        → fixed-size waves of C; next wave waits for the whole wave to finish\n' +
        '# pool         → C workers continuously refill from a queue; the default\n' +
        '# load-profile → time-boxed via --duration instead of iteration-boxed via -i',
      terminalHighlightLines: [[3, 3]],
      pauseAfter: true,
    },
  ],
};
