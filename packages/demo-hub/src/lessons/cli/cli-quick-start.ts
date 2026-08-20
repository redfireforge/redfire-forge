/**
 * CLI-1 — Install & Your First Run
 *
 * Terminal-surface lesson (DemoTerminal): unlike every other DemoHub lesson, this
 * has no real app DOM to spotlight — steps drive `terminalCommand`/`terminalOutput`/
 * `terminalHighlightLines` instead of `highlight`/`action`/`verify`. All captured
 * output below was actually run against the repo (`examples/cli-basic-test.yaml`,
 * `examples/cli-error-handling.yaml`), not invented — see docs/future/cli/cli-demo-plan.md.
 *
 * NOTE: initialTab intentionally NOT set — there is no app tab for this lesson to
 * navigate to; the DemoTerminal surface renders independently of the app's tabs.
 */
import type { DemoLesson } from '../../types';

export const cliQuickStartLesson: DemoLesson = {
  id: 'cli-quick-start',
  domainId: 'cli',
  category: 'getting-started',
  name: 'Install & Your First Run',
  description:
    'Three (really four) ways to install the CLI, verify it, run your first test, ' +
    'read the console summary, and understand why exit codes are what CI actually reads.',
  estimatedMinutes: 5,
  desktopOnly: false,

  concept: {
    title: 'The RedfireForge CLI',
    body:
      'Everything you can do by clicking through the desktop app, you can also do from ' +
      'a terminal — same execution engine, same assertions, same reports. This is what ' +
      'makes RedfireForge CI/CD-friendly: a GitHub Actions job, a pre-commit hook, or a ' +
      'cron job can run the exact same test suite a human runs in the GUI, headlessly, ' +
      'with an exit code CI can gate on.',
    keyTerms: [
      { term: 'redfireforge-cli', definition: 'The published npm package — installs both the `redfireforge` and short `rff` commands.' },
      { term: 'rff', definition: 'Short alias for `redfireforge` — same binary, less to type, never collides with the desktop app’s own `redfireforge` command.' },
      { term: '--cli', definition: 'Desktop app passthrough flag — runs the bundled CLI instead of launching the GUI (only needed for the plain `redfireforge` command; `rff` skips it automatically).' },
    ],
    diagram: `<svg viewBox="0 0 400 190" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <marker id="cli-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="var(--primary)"/>
    </marker>
  </defs>
  <!-- Desktop App box -->
  <rect x="20" y="14" width="150" height="46" rx="6" fill="var(--accent)" opacity="0.15" stroke="var(--accent)" stroke-width="1.5"/>
  <text x="95" y="33" text-anchor="middle" fill="var(--text)" font-size="11" font-family="system-ui" font-weight="600">Desktop App</text>
  <text x="95" y="48" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-family="system-ui">click through the GUI</text>
  <!-- Terminal box -->
  <rect x="230" y="14" width="150" height="46" rx="6" fill="var(--primary)" opacity="0.15" stroke="var(--primary)" stroke-width="1.5"/>
  <text x="305" y="33" text-anchor="middle" fill="var(--text)" font-size="11" font-family="system-ui" font-weight="600">$ redfireforge / rff</text>
  <text x="305" y="48" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-family="system-ui">terminal, CI, cron</text>
  <!-- Converging arrows -->
  <line x1="95" y1="60" x2="180" y2="88" stroke="var(--accent)" stroke-width="1.5" marker-end="url(#cli-arrow)"/>
  <line x1="305" y1="60" x2="220" y2="88" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#cli-arrow)"/>
  <!-- Shared engine box -->
  <rect x="100" y="90" width="200" height="44" rx="6" fill="var(--text-muted)" opacity="0.12" stroke="var(--text-muted)" stroke-width="1.5"/>
  <text x="200" y="110" text-anchor="middle" fill="var(--text)" font-size="11" font-family="system-ui" font-weight="600">Same test engine</text>
  <text x="200" y="126" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-family="system-ui">same assertions, same reports</text>
  <!-- Arrow down to exit code -->
  <line x1="200" y1="134" x2="200" y2="152" stroke="var(--success)" stroke-width="1.5" marker-end="url(#cli-arrow)"/>
  <!-- Exit code / CI gate box -->
  <rect x="70" y="154" width="260" height="30" rx="15" fill="var(--success)" opacity="0.15" stroke="var(--success)" stroke-width="1.5"/>
  <text x="200" y="173" text-anchor="middle" fill="var(--success)" font-size="10" font-family="system-ui" font-weight="600">Exit code → CI gate (0 / 1 / 2)</text>
</svg>`,
  },

  steps: [
    // ── Step 1: Three (Really Four) Ways to Install ──────────────────
    {
      id: 'cli1-install-options',
      title: 'Three (Really Four) Ways to Install',
      description:
        'Pick the install path that fits where you\'re running the CLI:\n\n' +
        '- **npm global** — best for CI runners and teammates without the source repo\n' +
        '- **Desktop passthrough** (`--cli`) — no extra install if the desktop app is already on the machine\n' +
        '- **Source** (`npx tsx`) — no build step, useful for contributors working in the repo\n' +
        '- **Prebuilt bundle** — fastest cold start, what CI and the desktop installer actually ship\n\n' +
        'Whichever path you pick, the short `rff` alias works everywhere `redfireforge` does — same binary, less to type.',
      terminalOutput:
        '$ npm install -g redfireforge-cli\n' +
        '# → published npm package (recommended for CI runners and teammates without the source repo)\n' +
        '\n' +
        '$ redfireforge --cli run tests/api-test.yaml\n' +
        '# → desktop app passthrough — only works if RedfireForge.app is installed (symlink/PATH set up by the installer)\n' +
        '\n' +
        '$ npx tsx cli/index.ts run tests/api-test.yaml\n' +
        '# → from source — no build step, runs the TypeScript directly via tsx (useful for contributors working in the repo)\n' +
        '\n' +
        '$ node dist-cli/redfireforge.mjs run tests/api-test.yaml\n' +
        '# → prebuilt bundle — no tsx/ts-node needed, fastest cold start, what CI and the desktop installer actually ship\n' +
        '\n' +
        '# Whichever path you pick, the short "rff" alias works everywhere "redfireforge" does —\n' +
        '# same binary, less to type, and it never collides with the desktop app\'s own command name:\n' +
        '$ rff run tests/api-test.yaml',
      pauseAfter: true,
    },

    // ── Step 2: Verify the Install ───────────────────────────────────
    {
      id: 'cli2-verify',
      title: 'Verify the Install',
      description:
        'Two commands you\'ll reach for constantly. The `--help` output lists the entire CLI surface — five commands, everything else is flags on top:\n\n' +
        '- `run` — execute a test file\n' +
        '- `workflow` — execute a workflow file as a performance test\n' +
        '- `validate` / `validate-workflow` — check a file without making any network calls\n' +
        '- `mock` — API Mock Studio headless commands\n\n' +
        '**Flags used:**\n' +
        '- `--version` — print the installed CLI version and exit\n' +
        '- `--help` — list all commands and top-level options',
      terminalCommand: 'redfireforge --version && redfireforge --help',
      terminalOutput:
        '0.5.6-beta.1\n' +
        'Usage: redfireforge [options] [command]\n' +
        '\n' +
        'RedfireForge CLI — run API performance tests from YAML/JSON files\n' +
        '\n' +
        'Options:\n' +
        '  -V, --version              output the version number\n' +
        '  -h, --help                 display help for command\n' +
        '\n' +
        'Commands:\n' +
        '  run [options] <file>       Execute a test file\n' +
        '  workflow [options] <file>  Execute a workflow file as a performance test\n' +
        '  validate <file>            Validate a test file without running it\n' +
        '  validate-workflow <file>   Validate a workflow file without running it\n' +
        '  mock                       API Mock Studio headless commands\n' +
        '  help [command]             display help for command',
      terminalHighlightLines: [[10, 15]],
      pauseAfter: true,
    },

    // ── Step 3: Run Your First Test ──────────────────────────────────
    {
      id: 'cli3-first-run',
      title: 'Run Your First Test',
      description:
        'Run something real. `cli-basic-test.yaml` has 3 tests, each making one request to JSONPlaceholder.\n\n' +
        'Two things to notice before and after:\n' +
        '- The **header** (before any request fires) echoes the suite name and test count — a quick sanity check that you\'re running what you think you are\n' +
        '- **`Total: 9`** from 3 tests is not a typo — the summary counts individual requests across all iterations, not just test names\n\n' +
        '**Flags used:**\n' +
        '- `run <file>` — execute a test file (no flags = use all defaults from the file)',
      terminalCommand: 'redfireforge run examples/cli-basic-test.yaml',
      terminalOutput:
        '  Loading: cli-basic-test.yaml\n' +
        '  Tests:   3\n' +
        '  Suite:   CLI Basic Test\n' +
        '  Mode:    batch (C:1 I:3)\n' +
        '\n' +
        '──────────────────────────────────────────────────\n' +
        '  RedfireForge — Test Run Summary\n' +
        '──────────────────────────────────────────────────\n' +
        '  Mode:         batch (C:1 I:3)\n' +
        '  Duration:     0.47s\n' +
        '  TPS:          19.15\n' +
        '  Avg Response: 52.02 ms\n' +
        '  P50:          38.67 ms\n' +
        '  P95:          167.48 ms\n' +
        '  P99:          167.48 ms\n' +
        '  P99.9:        167.48 ms\n' +
        '  Min / Max:    32.35 ms / 167.48 ms\n' +
        '──────────────────────────────────────────────────\n' +
        '  Timing Breakdown (avg)\n' +
        '  DNS Lookup:   0 ms\n' +
        '  TCP Connect:  0 ms\n' +
        '  TLS Handshake:0 ms\n' +
        '  TTFB:         45.97 ms\n' +
        '  Download:     0.87 ms\n' +
        '──────────────────────────────────────────────────\n' +
        '  Total:        9\n' +
        '  Passed:       9\n' +
        '  Failed HTTP:  0\n' +
        '  Failed Valid: 0\n' +
        '  Error Rate:   0%\n' +
        '  Tags:         critical, regression, smoke\n' +
        '──────────────────────────────────────────────────\n' +
        '  Result:       PASSED ✅\n' +
        '──────────────────────────────────────────────────',
      pauseAfter: true,
    },

    // ── Step 4: Reading the Console Summary ──────────────────────────
    {
      id: 'cli4-read-summary',
      title: 'Reading the Console Summary',
      description:
        'Same output as the previous step — now let\'s read the three sections:\n\n' +
        '- **P50 / P95 / P99 / P99.9** — percentile latencies, not just an average. Averages hide tail latency; P95 tells you what the slowest 5% of users actually experience.\n' +
        '- **Timing Breakdown** — DNS / TCP / TLS / TTFB / Download. Tells you _where_ time was spent, not just how much total.\n' +
        '- **Tags** — every tag seen across the run. This is a preview of the `--scenario-tags` filtering covered in the Data-Driven lesson.',
      terminalOutput:
        '  Loading: cli-basic-test.yaml\n' +
        '  Tests:   3\n' +
        '  Suite:   CLI Basic Test\n' +
        '  Mode:    batch (C:1 I:3)\n' +
        '\n' +
        '──────────────────────────────────────────────────\n' +
        '  RedfireForge — Test Run Summary\n' +
        '──────────────────────────────────────────────────\n' +
        '  Mode:         batch (C:1 I:3)\n' +
        '  Duration:     0.47s\n' +
        '  TPS:          19.15\n' +
        '  Avg Response: 52.02 ms\n' +
        '  P50:          38.67 ms\n' +
        '  P95:          167.48 ms\n' +
        '  P99:          167.48 ms\n' +
        '  P99.9:        167.48 ms\n' +
        '  Min / Max:    32.35 ms / 167.48 ms\n' +
        '──────────────────────────────────────────────────\n' +
        '  Timing Breakdown (avg)\n' +
        '  DNS Lookup:   0 ms\n' +
        '  TCP Connect:  0 ms\n' +
        '  TLS Handshake:0 ms\n' +
        '  TTFB:         45.97 ms\n' +
        '  Download:     0.87 ms\n' +
        '──────────────────────────────────────────────────\n' +
        '  Total:        9\n' +
        '  Passed:       9\n' +
        '  Failed HTTP:  0\n' +
        '  Failed Valid: 0\n' +
        '  Error Rate:   0%\n' +
        '  Tags:         critical, regression, smoke\n' +
        '──────────────────────────────────────────────────\n' +
        '  Result:       PASSED ✅\n' +
        '──────────────────────────────────────────────────',
      // 3 sequential beats: the latency percentiles, then the timing breakdown, then tags.
      terminalHighlightLines: [[13, 16], [19, 24], [31, 31]],
      pauseAfter: true,
    },

    // ── Step 5: Exit Codes Matter ─────────────────────────────────────
    {
      id: 'cli5-exit-codes',
      title: 'Exit Codes Matter',
      description:
        'The console summary is for humans. CI reads the **exit code**.\n\n' +
        'Run the same fixture twice: once clean (exit 0), once with a deliberate failure and `--fail-on-error` (exit 1). The three exit codes you\'ll see across all CLI lessons:\n\n' +
        '- `0` — clean run\n' +
        '- `1` — test or threshold failure\n' +
        '- `2` — the file itself is invalid (covered in the next lesson)\n\n' +
        'Everything downstream — a red PR check, a Slack alert, a blocked deploy — starts with this number.\n\n' +
        '**Flags used:**\n' +
        '- `>/dev/null` — suppress the console output (we only care about the exit code here)\n' +
        '- `--fail-on-error` — exit with code `1` if any test failed\n' +
        '- `-q` — quiet: print only the summary block\n' +
        '- `; echo "exit: $?"` — print the process exit code so you can see it directly',
      terminalCommand:
        'redfireforge run examples/cli-basic-test.yaml >/dev/null; echo "exit: $?"',
      terminalOutput:
        'exit: 0\n' +
        '\n' +
        '$ redfireforge run examples/cli-error-handling.yaml --fail-on-error -q; echo "exit: $?"\n' +
        '──────────────────────────────────────────────────\n' +
        '  RedfireForge — Test Run Summary\n' +
        '──────────────────────────────────────────────────\n' +
        '  Mode:         batch (C:1 I:5)\n' +
        '  Duration:     0.96s\n' +
        '  TPS:          26.03\n' +
        '  Avg Response: 38.34 ms\n' +
        '  P50:          34.58 ms\n' +
        '  P95:          41.65 ms\n' +
        '  P99:          140.17 ms\n' +
        '  P99.9:        140.17 ms\n' +
        '  Min / Max:    27.12 ms / 140.17 ms\n' +
        '──────────────────────────────────────────────────\n' +
        '  Timing Breakdown (avg)\n' +
        '  DNS Lookup:   0 ms\n' +
        '  TCP Connect:  0 ms\n' +
        '  TLS Handshake:0 ms\n' +
        '  TTFB:         36.75 ms\n' +
        '  Download:     0.46 ms\n' +
        '──────────────────────────────────────────────────\n' +
        '  Total:        25\n' +
        '  Passed:       20\n' +
        '  Failed HTTP:  5\n' +
        '  Failed Valid: 5\n' +
        '  Error Rate:   20%\n' +
        '──────────────────────────────────────────────────\n' +
        '  Result:       FAILED ❌\n' +
        '──────────────────────────────────────────────────\n' +
        'exit: 1',
      // 3 beats: exit 0 (first run clean), FAILED banner, then exit 1 (gate tripped).
      terminalHighlightLines: [[1, 1], [30, 30], [32, 32]],
      pauseAfter: true,
    },
  ],
};
