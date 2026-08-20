/**
 * CLI-11 — Desktop App CLI Mode
 *
 * Terminal-surface lesson (DemoTerminal), continuing the same pane from CLI-1 through CLI-10.
 * Unlike every other CLI lesson, this one is desktopOnly: true — everything here was
 * captured against the real COMPILED Tauri binary (`src-tauri/target/debug/redfireforge`,
 * built via `cargo build`), not the npm-package CLI, since this lesson is specifically
 * about the desktop app's bundled --cli / rff behavior. Not invented — see
 * docs/future/cli/cli-demo-plan.md.
 */
import type { DemoLesson } from '../../types';

export const cliDesktopParityLesson: DemoLesson = {
  id: 'cli-desktop-parity',
  domainId: 'cli',
  category: 'getting-started',
  name: 'Desktop App CLI Mode',
  description:
    'When and how to use the bundled --cli mode instead of the npm package — and its ' +
    'one real, unfixed limitation.',
  estimatedMinutes: 4,
  desktopOnly: true,

  concept: {
    title: 'Desktop App CLI Mode',
    body:
      'The installed desktop app isn\'t just a GUI — `redfireforge --cli <command>` ' +
      'runs the exact same engine headlessly, no separate npm install required. It\'s ' +
      'the same underlying Node CLI bundle the npm package ships, just invoked ' +
      'through a small Rust wrapper that the installer puts on your PATH ' +
      'automatically. Useful when a machine already has the desktop app installed ' +
      '(e.g. a build agent that also needs a GUI for debugging) and shouldn\'t need a ' +
      'second install path for CI.',
    keyTerms: [
      { term: '--cli', definition: 'The flag that switches the app from launching its GUI to running as a CLI — must come before the subcommand.' },
      { term: 'parity', definition: 'run/workflow/validate/validate-workflow now have full flag parity with the npm package; mock has none.' },
      { term: 'rff', definition: 'Short alias installed alongside redfireforge by both the npm package and the desktop installer — always means "run the CLI", no --cli needed, never collides with the GUI.' },
    ],
    diagram: `<svg viewBox="0 0 440 200" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <marker id="cli11-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="var(--primary)"/>
    </marker>
  </defs>
  <!-- redfireforge --cli -->
  <rect x="15" y="14" width="190" height="46" rx="6" fill="var(--accent)" opacity="0.15" stroke="var(--accent)" stroke-width="1.5"/>
  <text x="110" y="33" text-anchor="middle" fill="var(--text)" font-size="11" font-family="system-ui" font-weight="600">redfireforge --cli &lt;cmd&gt;</text>
  <text x="110" y="49" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-family="system-ui">explicit flag needed</text>
  <!-- rff -->
  <rect x="235" y="14" width="190" height="46" rx="6" fill="var(--primary)" opacity="0.15" stroke="var(--primary)" stroke-width="1.5"/>
  <text x="330" y="33" text-anchor="middle" fill="var(--text)" font-size="11" font-family="system-ui" font-weight="600">rff &lt;cmd&gt;</text>
  <text x="330" y="49" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-family="system-ui">no flag, never collides</text>
  <!-- converge -->
  <line x1="150" y1="60" x2="200" y2="82" stroke="var(--accent)" stroke-width="1.5" marker-end="url(#cli11-arrow)"/>
  <line x1="290" y1="60" x2="240" y2="82" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#cli11-arrow)"/>
  <rect x="100" y="84" width="240" height="44" rx="6" fill="var(--text-muted)" opacity="0.12" stroke="var(--text-muted)" stroke-width="1.5"/>
  <text x="220" y="104" text-anchor="middle" fill="var(--text)" font-size="11" font-family="system-ui" font-weight="600">same Node CLI bundle</text>
  <text x="220" y="120" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-family="system-ui">dist-cli/redfireforge.mjs</text>
  <!-- outcomes -->
  <line x1="220" y1="128" x2="220" y2="146" stroke="var(--success)" stroke-width="1.5" marker-end="url(#cli11-arrow)"/>
  <rect x="20" y="148" width="400" height="26" rx="5" fill="var(--success)" opacity="0.15" stroke="var(--success)" stroke-width="1.5"/>
  <text x="220" y="165" text-anchor="middle" fill="var(--success)" font-size="10" font-family="system-ui" font-weight="600">run / workflow / validate / validate-workflow — full parity \u2705</text>
  <rect x="20" y="178" width="400" height="20" rx="5" fill="var(--error,#f38ba8)" opacity="0.15" stroke="var(--error,#f38ba8)" stroke-width="1.5"/>
  <text x="220" y="192" text-anchor="middle" fill="var(--error,#f38ba8)" font-size="9" font-family="system-ui" font-weight="600">mock — not supported, no Rust subcommand</text>
</svg>`,
  },

  steps: [
    // ── Step 1: The --cli Flag ────────────────────────────────────────────
    {
      id: 'cli11-cli-flag',
      title: 'The --cli Flag',
      description:
        'The desktop app\'s Rust binary passes `--cli` straight through to the same bundled Node CLI (`dist-cli/redfireforge.mjs`) the npm package ships. Same engine, same reporters, same exit codes.\n\n' +
        'The `rff` alias the installer creates skips the `--cli` flag entirely — `rff run <file>` is the shortest form.\n\n' +
        '**Flags used:**\n' +
        '- `--cli` — switch the desktop app from launching its GUI to running as a CLI (must come before the subcommand)\n' +
        '- `run <file>` — execute a test file\n' +
        '- `-q` — quiet summary only',
      terminalCommand: 'redfireforge --cli run examples/cli-basic-test.yaml -q  # via the compiled desktop binary',
      terminalOutput:
        '  Total:        9\n' +
        '  Passed:       9\n' +
        '  Failed HTTP:  0\n' +
        '  Failed Valid: 0\n' +
        '  Error Rate:   0%\n' +
        '  Tags:         critical, regression, smoke\n' +
        '  Result:       PASSED \u2705',
      terminalHighlightLines: [[1, 1], [7, 7]],
      pauseAfter: true,
    },

    // ── Step 2: Installer-Created Symlink/PATH Entry ──────────────────────
    {
      id: 'cli11-install-symlink',
      title: 'Installer-Created Symlink/PATH Entry',
      description:
        'No separate npm install needed — the desktop app\'s installer wires up both commands on your PATH automatically.\n\n' +
        '- **macOS/Linux** — `postinstall.sh` symlinks `/usr/local/bin/redfireforge` and `/usr/local/bin/rff` to the app binary\n' +
        '- **Windows** — the WiX installer adds the install directory to PATH and places a `rff.cmd` shim alongside the exe\n\n' +
        'The rule: `redfireforge` (bare) always opens the GUI; `--cli` switches it to CLI mode. `rff` always means CLI — no flag needed, no collision.\n\n' +
        '**Command used:**\n' +
        '- `cat postinstall.sh` — read the installer script to see what gets symlinked where',
      terminalCommand: 'cat src-tauri/installer/macos/postinstall.sh',
      terminalOutput:
        '# Usage after install:\n' +
        '#   redfireforge --cli run tests/test.yaml\n' +
        '#   rff run tests/test.yaml          (short alias, always CLI mode, no --cli needed)\n' +
        '\n' +
        'SYMLINK_PATH="/usr/local/bin/redfireforge"\n' +
        'RFF_SYMLINK_PATH="/usr/local/bin/rff"\n' +
        '\n' +
        'echo "  redfireforge --cli run tests/test.yaml"\n' +
        'echo "  redfireforge --cli workflow tests/workflow.yaml"\n' +
        '\n' +
        'echo "  rff run tests/test.yaml"\n' +
        'echo "  rff workflow tests/workflow.yaml"',
      terminalHighlightLines: [[5, 6]],
      pauseAfter: true,
    },

    // ── Step 3: Full Option Parity (Run/Workflow/Validate) ────────────────
    {
      id: 'cli11-full-parity',
      title: 'Full Option Parity (Run/Workflow/Validate)',
      description:
        'Every flag the npm CLI\'s `run`/`workflow`/`validate`/`validate-workflow` commands accept, `--cli` accepts too — `--sla-config`, `--fail-on-sla`, `--save-baseline`, `--trace-level`, everything. Not a subset; all genuinely wired through the Rust wrapper.\n\n' +
        'The SLA gate here trips on `Create Post TPS` (deliberately unreachable at 100 req/s over a real network), so exit code is `4`.\n\n' +
        '**Flags used:**\n' +
        '- `--cli run` — desktop app passthrough to run a test file\n' +
        '- `--sla-config <file>` — JSON file of SLA targets to evaluate after the run\n' +
        '- `--fail-on-sla` — exit with code `4` if any SLA target is violated\n' +
        '- `-q` — quiet summary only\n' +
        '- `; echo "exit: $?"` — print the process exit code',
      terminalCommand: 'redfireforge --cli run examples/sla-jsonplaceholder-test.yaml --sla-config examples/sla-jsonplaceholder-targets.json --fail-on-sla -q; echo "exit: $?"',
      terminalOutput:
        '  Total:        8\n' +
        '  Passed:       8\n' +
        '  Result:       PASSED \u2705\n' +
        '\n' +
        '  SLA Evaluation:\n' +
        '  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n' +
        '  \u2717 Create Post TPS [Create Post]                 18.1req/s  (target: >= 100req/s)\n' +
        '  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n' +
        '  \u2717 SLA: 1 violation, 7 passing\n' +
        '\n' +
        'exit: 4',
      // 2 beats: the functionally-clean PASSED result, then the SLA gate exit code that overrides it.
      terminalHighlightLines: [[3, 3], [9, 11]],
      pauseAfter: true,
    },

    // ── Step 4: The mock Gap ───────────────────────────────────────────────
    {
      id: 'cli11-mock-gap',
      title: 'The mock Gap',
      description:
        'One command family has no `--cli` equivalent: `mock`. The Rust wrapper only defines Run / Workflow / Validate / ValidateWorkflow — there\'s no Mock variant, so `clap` rejects it immediately as an unrecognized subcommand.\n\n' +
        'It fails loudly (exit 2, clear error message) rather than silently doing the wrong thing. Until it\'s built out, use the npm package or a source checkout for the `mock` commands (covered in the API Mock Studio, Headless lesson).\n\n' +
        '**Command used:**\n' +
        '- `--cli mock start ...` — intentionally broken; shows what happens when a subcommand isn\'t implemented in the Rust wrapper',
      terminalCommand: 'redfireforge --cli mock start examples/api-mock/sample-workspace.json --standalone; echo "exit: $?"',
      terminalOutput:
        'error: unrecognized subcommand \'mock\'\n' +
        '\n' +
        'Usage: redfireforge [OPTIONS] [COMMAND]\n' +
        '\n' +
        'For more information, try \'--help\'.\n' +
        'exit: 2',
      terminalHighlightLines: [[1, 1], [6, 6]],
      pauseAfter: true,
    },
  ],
};
