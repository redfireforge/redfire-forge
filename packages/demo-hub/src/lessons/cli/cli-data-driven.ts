/**
 * CLI-5 — Data-Driven Testing — What Actually Works
 *
 * Terminal-surface lesson (DemoTerminal), continuing the same pane from CLI-1/2/3/4.
 * All captured output below was actually run against the repo (`examples/cli-parameterized.yaml`,
 * `examples/parameterized-users.yaml` + `examples/users-data.csv`, `examples/cli-basic-test.yaml`,
 * plus a small temp fixture at /tmp/cli5-drop-test.yaml built to demonstrate the "entire row-set
 * filtered out" drop behavior — never committed), not invented — see
 * docs/future/cli/cli-demo-plan.md. Output is trimmed to summary fields consistent with CLI-3/4.
 */
import type { DemoLesson } from '../../types';

export const cliDataDrivenLesson: DemoLesson = {
  id: 'cli-data-driven',
  domainId: 'cli',
  category: 'data-and-ci',
  name: 'Data-Driven Testing — What Actually Works',
  description:
    'Parameterize a scenario with an external CSV/JSON file or the native inline ' +
    'dataSource: schema, filter by scenario/tag, and see what data-driven testing ' +
    'actually does (and doesn\'t) support.',
  estimatedMinutes: 6,
  desktopOnly: false,

  concept: {
    title: 'Data-Driven Testing — What Actually Works',
    body:
      'The CLI supports two ways to parameterize a test: an external `--data ' +
      '<csv|json>` file, or an inline data block in the test file itself — either the ' +
      'native `dataSource:` schema (columns/rows with ids, types, and per-row tags, ' +
      'same shape the GUI uses) or the more compact `data: { columns, rows }` ' +
      'shorthand. Both drive the same row-expansion engine. Filtering by ' +
      '`--scenario`/`--scenario-tags` operates at the test level and works reliably. ' +
      'Filtering rows by `--tags` now works for both `dataSource:`-based rows and ' +
      'external CSV rows.',
    keyTerms: [
      { term: 'dataSource:', definition: 'The full native inline schema — columns with id/name/type/mapping, rows with id/values/tags/enabled/note.' },
      { term: 'data:', definition: 'The compact shorthand for inline data — no per-row tags.' },
      { term: 'validate: / header: prefixes', definition: 'The only two special column-name prefixes the external CSV/JSON --data loader recognizes.' },
    ],
    diagram: `<svg viewBox="0 0 440 230" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <marker id="cli5-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="var(--primary)"/>
    </marker>
  </defs>
  <!-- dataSource: (inline) -->
  <rect x="15" y="15" width="190" height="50" rx="6" fill="var(--accent)" opacity="0.15" stroke="var(--accent)" stroke-width="1.5"/>
  <text x="110" y="36" text-anchor="middle" fill="var(--text)" font-size="11" font-family="system-ui" font-weight="600">dataSource: (inline)</text>
  <text x="110" y="52" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-family="system-ui">native, per-row tags</text>
  <!-- --data (external) -->
  <rect x="235" y="15" width="190" height="50" rx="6" fill="var(--primary)" opacity="0.15" stroke="var(--primary)" stroke-width="1.5"/>
  <text x="330" y="36" text-anchor="middle" fill="var(--text)" font-size="11" font-family="system-ui" font-weight="600">--data &lt;csv|json&gt;</text>
  <text x="330" y="52" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-family="system-ui">external, always wins</text>
  <!-- converging arrows -->
  <line x1="110" y1="65" x2="195" y2="88" stroke="var(--accent)" stroke-width="1.5" marker-end="url(#cli5-arrow)"/>
  <line x1="330" y1="65" x2="245" y2="88" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#cli5-arrow)"/>
  <!-- row-expansion engine -->
  <rect x="120" y="90" width="200" height="44" rx="6" fill="var(--text-muted)" opacity="0.12" stroke="var(--text-muted)" stroke-width="1.5"/>
  <text x="220" y="110" text-anchor="middle" fill="var(--text)" font-size="11" font-family="system-ui" font-weight="600">row-expansion engine</text>
  <text x="220" y="126" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-family="system-ui">N rows × M iterations</text>
  <!-- arrows down to filters -->
  <line x1="180" y1="134" x2="110" y2="158" stroke="var(--success)" stroke-width="1.5" marker-end="url(#cli5-arrow)"/>
  <line x1="260" y1="134" x2="330" y2="158" stroke="var(--success)" stroke-width="1.5" marker-end="url(#cli5-arrow)"/>
  <!-- test-level filter -->
  <rect x="15" y="160" width="190" height="50" rx="6" fill="var(--success)" opacity="0.15" stroke="var(--success)" stroke-width="1.5"/>
  <text x="110" y="181" text-anchor="middle" fill="var(--text)" font-size="11" font-family="system-ui" font-weight="600">--scenario(-tags)</text>
  <text x="110" y="197" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-family="system-ui">filters whole tests</text>
  <!-- row-level filter -->
  <rect x="235" y="160" width="190" height="50" rx="6" fill="var(--success)" opacity="0.15" stroke="var(--success)" stroke-width="1.5"/>
  <text x="330" y="181" text-anchor="middle" fill="var(--text)" font-size="11" font-family="system-ui" font-weight="600">--tags</text>
  <text x="330" y="197" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-family="system-ui">filters individual rows</text>
</svg>`,
  },

  steps: [
    // ── Step 1: Inline Data — Two Schemas, One Now Fixed ────────────────
    {
      id: 'cli5-inline-datasource',
      title: 'Inline Data — Two Schemas, One Now Fixed',
      description:
        '`cli-parameterized.yaml` uses the native `dataSource:` schema — the same shape the GUI exports — with 6 rows of user IDs.\n\n' +
        'Previously the CLI silently ignored this field and sent `{{id}}` literally in the URL. That\'s fixed. Spot two things:\n' +
        '- `validate` shows `[6 data rows]` — the data is recognized before you even run\n' +
        '- `Total: 36` = 6 rows × 6 iterations — every row ran, not just one\n\n' +
        '**Flags used:**\n' +
        '- `validate <file>` — check the file and show row count without running\n' +
        '- `run <file>` — execute all data rows\n' +
        '- `-q` — quiet summary only',
      terminalCommand:
        'redfireforge validate examples/cli-parameterized.yaml',
      terminalOutput:
        '  ✅ Valid test file: cli-parameterized.yaml\n' +
        '  Tests: 1\n' +
        '    - GET https://jsonplaceholder.typicode.com/users/{{id}}  (Get User by ID)  [6 data rows]\n' +
        '\n' +
        '$ redfireforge run examples/cli-parameterized.yaml -q\n' +
        '  Mode:         batch (C:1 I:6)\n' +
        '  Total:        36\n' +
        '  Passed:       36\n' +
        '  Result:       PASSED ✅\n' +
        '  Data Rows:    36 total, 36 passed, 0 failed',
      // 2 beats: the validate line showing [6 data rows] (line 3), then the run summary (lines 7–10).
      terminalHighlightLines: [[3, 3], [7, 10]],
      pauseAfter: true,
    },

    // ── Step 2: The External --data File ───────────────────────────────
    {
      id: 'cli5-external-csv',
      title: 'The External --data File',
      description:
        'An external data file always overrides any inline data in the test file. Point `--data` at a CSV or JSON file and every row becomes a request.\n\n' +
        'The CSV\'s `_tags`, `_label`, and `_note` columns are row metadata — they don\'t leak into request query params. URLs come out clean (`?userId=1&name=Alice`), not `?userId=1&_tags=smoke&name=Alice`.\n\n' +
        '**Flags used:**\n' +
        '- `--data examples/users-data.csv` — external data file; overrides any inline `dataSource:` or `data:` in the test file\n' +
        '- `-q` — quiet summary only',
      terminalCommand: 'redfireforge run examples/parameterized-users.yaml --data examples/users-data.csv -q',
      terminalOutput:
        '  Mode:         batch (C:1 I:5)\n' +
        '  Total:        25\n' +
        '  Passed:       25\n' +
        '  Result:       PASSED ✅\n' +
        '  Data Rows:    25 total, 25 passed, 0 failed',
      terminalHighlightLines: [[2, 5]],
      pauseAfter: true,
    },

    // ── Step 3: --scenario <name> ────────────────────────────────────────
    {
      id: 'cli5-scenario-filter',
      title: '--scenario <name>',
      description:
        'Narrow the whole run down to one named test before anything else happens. Data rows, tags, everything downstream only applies to the one test left standing.\n\n' +
        'Result: `Total: 1` instead of the default 9 — only `Get Single User` ran.\n\n' +
        '**Flags used:**\n' +
        '- `--scenario "Get Single User"` — run only the test whose `name:` matches exactly\n' +
        '- `-q` — quiet summary only',
      terminalCommand: 'redfireforge run examples/cli-basic-test.yaml --scenario "Get Single User" -q',
      terminalOutput:
        '  Total:        1\n' +
        '  Passed:       1\n' +
        '  Tags:         critical, smoke\n' +
        '  Result:       PASSED ✅',
      terminalHighlightLines: [[1, 1]],
      pauseAfter: true,
    },

    // ── Step 4: --tags — Now Fixed Everywhere ────────────────────────────
    {
      id: 'cli5-row-tags',
      title: '--tags — Now Fixed Everywhere',
      description:
        'Row-level `--tags` filters individual data rows, not whole tests. Two behaviors fixed:\n\n' +
        '- CSV rows now filter by real tags — previously the tags were ignored (or leaked as query params)\n' +
        '- When a test\'s entire row-set gets filtered out, the CLI **drops** that test and tells you (`Dropped: <name>`) instead of silently running it once with an unresolved placeholder\n\n' +
        '**Flags used:**\n' +
        '- `--tags smoke` — keep only data rows tagged `smoke`; rows without this tag are skipped\n' +
        '- `--data examples/users-data.csv` — external data file\n' +
        '- `-q` — quiet summary only',
      terminalCommand:
        'redfireforge run examples/parameterized-users.yaml --data examples/users-data.csv --tags smoke -q',
      terminalOutput:
        '  Mode:         batch (C:1 I:2)\n' +
        '  Total:        4\n' +
        '  Passed:       4\n' +
        '  Result:       PASSED ✅\n' +
        '  Data Rows:    4 total, 4 passed, 0 failed\n' +
        '\n' +
        '$ redfireforge run cli5-drop-test.yaml --tags smoke\n' +
        '  Tests:   2\n' +
        '  Tags:    smoke (mode: any, 1 matching rows, 1/2 scenarios retained)\n' +
        '  Dropped: No Smoke Rows (no rows matched the tag filter)\n' +
        '  Mode:    batch (C:1 I:1)\n' +
        '  Total:        1\n' +
        '  Passed:       1\n' +
        '  Result:       PASSED ✅',
      // 2 beats: the CSV tag-filter result (line 2), then the Dropped: line on the 2nd fixture (line 10).
      terminalHighlightLines: [[2, 2], [10, 10]],
      pauseAfter: true,
    },

    // ── Step 5: --scenario-tags / --scenario-tag-mode ────────────────────
    {
      id: 'cli5-scenario-tags',
      title: '--scenario-tags / --scenario-tag-mode',
      description:
        'Different from `--tags` (row-level): `--scenario-tags` filters **whole tests** by the `tags:` array declared on each test in the YAML file.\n\n' +
        'Run twice with different mode:\n' +
        '- `--scenario-tags critical` — keeps any test tagged `critical` (1 match)\n' +
        '- `--scenario-tags critical,regression --scenario-tag-mode all` — requires **all** listed tags; no test has both, so correctly reports zero matches\n\n' +
        '**Flags used:**\n' +
        '- `--scenario-tags <tags>` — filter tests by their declared tags (comma-separated)\n' +
        '- `--scenario-tag-mode all` — require all listed tags to be present (default is `any`)\n' +
        '- `-q` — quiet summary only\n' +
        '- `; echo "exit: $?"` — show exit code (`1` when no scenarios matched)',
      terminalCommand:
        'redfireforge run examples/cli-basic-test.yaml --scenario-tags critical -q',
      terminalOutput:
        '  Total:        1\n' +
        '  Passed:       1\n' +
        '  Tags:         critical, smoke\n' +
        '  Result:       PASSED ✅\n' +
        '\n' +
        '$ redfireforge run examples/cli-basic-test.yaml --scenario-tags critical,regression --scenario-tag-mode all -q; echo "exit: $?"\n' +
        '  ❌ No scenarios match the specified tags.\n' +
        'exit: 1',
      terminalHighlightLines: [[1, 1], [7, 8]],
      pauseAfter: true,
    },

    // ── Step 6: --data-rows-summary ───────────────────────────────────────
    {
      id: 'cli5-data-rows-summary',
      title: '--data-rows-summary',
      description:
        'The CI-friendly per-row JSON report — one entry per test pattern with pass/fail row counts and details on any failed rows.\n\n' +
        'This is what a CI job would parse to post a "row 3 of 6 failed" comment on a PR, without needing to dig through the full JSON report.\n\n' +
        '**Flags used:**\n' +
        '- `--data-rows-summary results.json` — write per-row pass/fail summary to a JSON file\n' +
        '- `-q` — quiet summary only\n' +
        '- `&& cat results.json` — print the file so you can see the per-row shape',
      terminalCommand: 'redfireforge run examples/cli-parameterized.yaml --data-rows-summary results.json -q && cat results.json',
      terminalOutput:
        '[\n' +
        '  {\n' +
        '    "pattern": "Get User by ID",\n' +
        '    "totalRows": 36,\n' +
        '    "passedRows": 36,\n' +
        '    "failedRows": 0,\n' +
        '    "failedRowDetails": []\n' +
        '  }\n' +
        ']',
      terminalHighlightLines: [[4, 6]],
      pauseAfter: true,
    },
  ],
};
