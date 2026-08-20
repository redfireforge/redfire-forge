/**
 * CLI-10 — API Mock Studio, Headless
 *
 * Terminal-surface lesson (DemoTerminal), continuing the same pane from CLI-1 through CLI-9.
 * All captured output below was actually run against the repo
 * (`examples/api-mock/sample-workspace.json`), not invented — see
 * docs/future/cli/cli-demo-plan.md. Step 5's companion mode was run against the real
 * `src-server` dev server (started on an alternate port in this sandbox, since 3001 was
 * occupied by an unrelated proxy) — the `--control-base` flag lets both `mock start` and
 * `mock verify` point at any companion URL. Step 6's Docker content is verified statically
 * against the real, committed Dockerfile and CI guide — no Docker daemon is available in
 * this environment (confirmed via `docker info`), matching the plan's own prior finding.
 */
import type { DemoLesson } from '../../types';

export const cliMockStudioLesson: DemoLesson = {
  id: 'cli-mock-studio',
  domainId: 'cli',
  category: 'reliability',
  name: 'API Mock Studio, Headless',
  description:
    'The mock command family — simulate, verify, and start API Mock Studio ' +
    'definitions without the GUI, including Docker.',
  estimatedMinutes: 7,
  desktopOnly: false,

  concept: {
    title: 'API Mock Studio, Headless',
    body:
      'A saved API Mock Studio workspace — servers, routes, responses, and recorded ' +
      'samples — is a portable JSON file. The `mock` command family runs it three ' +
      'ways: `simulate` replays saved samples against the definition with zero ' +
      'network I/O (pure request-matching logic, same engine as the GUI\'s Simulate ' +
      'button); `start` actually listens on a port, either through the companion dev ' +
      'server or fully in-process (`--standalone`, what Docker/CI use); `verify` ' +
      'asserts against either an offline corpus (`--simulate`) or a live request ' +
      'journal from a running mock.',
    keyTerms: [
      { term: '--standalone', definition: 'An in-process listener with no control API — good for CI containers, bad for anything that needs mock verify\'s live-journal mode.' },
      { term: 'companion', definition: 'The project\'s own dev server (npm run server:dev) — the only thing mock verify (live) can ever talk to.' },
    ],
    diagram: `<svg viewBox="0 0 440 210" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <marker id="cli10-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="var(--primary)"/>
    </marker>
  </defs>
  <!-- workspace file -->
  <rect x="145" y="14" width="150" height="36" rx="6" fill="var(--text-muted)" opacity="0.12" stroke="var(--text-muted)" stroke-width="1.5"/>
  <text x="220" y="37" text-anchor="middle" fill="var(--text)" font-size="11" font-family="system-ui" font-weight="600">workspace.json</text>
  <!-- fan-out arrows -->
  <line x1="180" y1="50" x2="90" y2="68" stroke="var(--accent)" stroke-width="1.5" marker-end="url(#cli10-arrow)"/>
  <line x1="220" y1="50" x2="220" y2="68" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#cli10-arrow)"/>
  <line x1="260" y1="50" x2="350" y2="68" stroke="var(--success)" stroke-width="1.5" marker-end="url(#cli10-arrow)"/>
  <!-- simulate -->
  <rect x="10" y="70" width="150" height="64" rx="6" fill="var(--accent)" opacity="0.15" stroke="var(--accent)" stroke-width="1.5"/>
  <text x="85" y="92" text-anchor="middle" fill="var(--text)" font-size="11" font-family="system-ui" font-weight="600">mock simulate</text>
  <text x="85" y="108" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-family="system-ui">offline replay,</text>
  <text x="85" y="122" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-family="system-ui">no network I/O</text>
  <!-- start -->
  <rect x="170" y="70" width="150" height="64" rx="6" fill="var(--primary)" opacity="0.15" stroke="var(--primary)" stroke-width="1.5"/>
  <text x="245" y="92" text-anchor="middle" fill="var(--text)" font-size="11" font-family="system-ui" font-weight="600">mock start</text>
  <text x="245" y="108" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-family="system-ui">--standalone (CI) /</text>
  <text x="245" y="122" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-family="system-ui">companion (dev server)</text>
  <!-- verify -->
  <rect x="330" y="70" width="100" height="64" rx="6" fill="var(--success)" opacity="0.15" stroke="var(--success)" stroke-width="1.5"/>
  <text x="380" y="92" text-anchor="middle" fill="var(--text)" font-size="11" font-family="system-ui" font-weight="600">mock verify</text>
  <text x="380" y="108" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-family="system-ui">--simulate /</text>
  <text x="380" y="122" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-family="system-ui">live-journal</text>
  <text x="220" y="160" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-family="system-ui">live-journal verify ONLY talks to companion —</text>
  <text x="220" y="176" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-family="system-ui">a --standalone listener has no control API to query at all</text>
</svg>`,
  },

  steps: [
    // ── Step 1: The Workspace File ───────────────────────────────────────
    {
      id: 'cli10-workspace-file',
      title: 'The Workspace File',
      description:
        'The workspace is a single portable JSON file — the same shape the GUI\'s API Mock Studio saves and loads. This minimal example has:\n\n' +
        '- One server (`srv-demo`, port 4600)\n' +
        '- One route (`GET /health`, returns `{"ok":true}`)\n' +
        '- One recorded sample with its expected outcome (`matched`, status 200, body contains `ok`)\n\n' +
        'Everything the `mock` commands below operate on lives in this one file.\n\n' +
        '**Command used:**\n' +
        '- `cat examples/api-mock/sample-workspace.json` — read the workspace file to understand its structure',
      terminalCommand: 'cat examples/api-mock/sample-workspace.json',
      terminalOutput:
        '{\n' +
        '  "servers": [\n' +
        '    {\n' +
        '      "id": "srv-demo", "name": "Demo Mock", "port": 4600,\n' +
        '      "routes": [\n' +
        '        {\n' +
        '          "id": "route-health", "method": "GET", "path": { "kind": "exact", "value": "/health" },\n' +
        '          "responses": [{ "status": 200, "body": { "content": "{\\"ok\\":true}" } }]\n' +
        '        }\n' +
        '      ],\n' +
        '      "samples": [\n' +
        '        { "id": "sample-health", "routeId": "route-health",\n' +
        '          "expected": { "outcome": "matched", "status": 200, "bodyContains": "ok" } }\n' +
        '      ]\n' +
        '    }\n' +
        '  ]\n' +
        '}',
      terminalHighlightLines: [[3, 3], [10, 12]],
      pauseAfter: true,
    },

    // ── Step 2: mock simulate ──────────────────────────────────────────────
    {
      id: 'cli10-simulate',
      title: 'mock simulate',
      description:
        'Offline replay of every saved sample against the workspace\'s routing/response logic — no listener, no network calls, completely side-effect-free.\n\n' +
        'The output is a full trace per sample: which route matched, why (priority, predicate results), which response was selected, and the exact rendered body. Same diagnostic depth as the GUI\'s Simulate panel.\n\n' +
        '**Command used:**\n' +
        '- `mock simulate <file>` — replay all saved samples offline; no listener required',
      terminalCommand: 'redfireforge mock simulate examples/api-mock/sample-workspace.json',
      terminalOutput:
        '{\n' +
        '  "serverId": "srv-demo",\n' +
        '  "total": 1,\n' +
        '  "failed": 0,\n' +
        '  "results": [\n' +
        '    {\n' +
        '      "sampleId": "sample-health",\n' +
        '      "passed": true,\n' +
        '      "outcome": "matched",\n' +
        '      "renderedResponse": { "status": 200, "body": "{\\"ok\\":true}", "contentType": "application/json" },\n' +
        '      "trace": {\n' +
        '        "candidates": [\n' +
        '          { "routeId": "route-health", "routeName": "Health", "priority": 10, "overallMatch": true }\n' +
        '        ],\n' +
        '        "policyDecision": {\n' +
        '          "policy": "highest_priority", "matchedCount": 1, "outcome": "matched",\n' +
        '          "selectedRouteId": "route-health", "selectedResponseId": "resp-health"\n' +
        '        }\n' +
        '      }\n' +
        '    }\n' +
        '  ]\n' +
        '}\n' +
        'Simulated 1 sample(s); 0 failure(s).',
      // 2 beats: the pass/outcome fields, then the final summary line everything gates on.
      terminalHighlightLines: [[8, 9], [23, 23]],
      pauseAfter: true,
    },

    // ── Step 3: mock start --standalone ──────────────────────────────────
    {
      id: 'cli10-start-standalone',
      title: 'mock start --standalone',
      description:
        '`--standalone` runs the mock entirely in-process — no companion dev server needed. This is what Docker and CI environments use.\n\n' +
        'The process blocks (keeping the listener alive) until `Ctrl+C`. A second terminal can then `curl` the route and get a real response.\n\n' +
        '**Flags used:**\n' +
        '- `mock start <file>` — start the mock server from a workspace JSON file\n' +
        '- `--standalone` — in-process listener with no control API (good for CI; not compatible with `mock verify` live-journal mode)',
      terminalCommand:
        'redfireforge mock start examples/api-mock/sample-workspace.json --standalone',
      terminalOutput:
        '{\n' +
        '  "ready": true,\n' +
        '  "results": [\n' +
        '    { "serverId": "srv-demo", "ok": true, "port": 4600, "mode": "standalone" }\n' +
        '  ]\n' +
        '}\n' +
        'In-process listeners keep this process alive. Press Ctrl+C to stop.\n' +
        '\n' +
        '$ # in a second pane:\n' +
        '$ curl http://127.0.0.1:4600/health\n' +
        '200 {"ok":true}',
      terminalHighlightLines: [[4, 4], [11, 11]],
      pauseAfter: true,
    },

    // ── Step 4: mock verify --simulate ────────────────────────────────────
    {
      id: 'cli10-verify-simulate',
      title: 'mock verify --simulate',
      description:
        'Assert against the offline sample corpus — no running mock required. Run twice with different `--min-calls` to see pass vs. fail:\n\n' +
        '- `--min-calls 1` → passes (1 sample exists)\n' +
        '- `--min-calls 5` → fails (only 1 sample, not 5) → exit `1`\n\n' +
        'Use this as a CI smoke check that a workspace\'s samples still match after a route or response edit, with zero listener startup cost.\n\n' +
        '**Flags used:**\n' +
        '- `mock verify <file> --simulate` — assert against the offline sample corpus (no listener needed)\n' +
        '- `--min-calls 1` — require at least N samples to have been simulated\n' +
        '- `--expect-outcome matched` — require all samples to produce a `matched` outcome\n' +
        '- `; echo "exit: $?"` — print the exit code',
      terminalCommand:
        'redfireforge mock verify examples/api-mock/sample-workspace.json --simulate --min-calls 1 --expect-outcome matched; echo "exit: $?"',
      terminalOutput:
        'Simulated 1 sample(s); 0 failure(s).\n' +
        'exit: 0\n' +
        '\n' +
        '$ redfireforge mock verify examples/api-mock/sample-workspace.json --simulate --min-calls 5 --expect-outcome matched; echo "exit: $?"\n' +
        'Expected at least 5 samples, got 1\n' +
        'exit: 1',
      // 2 beats: the passing case (lines 1–2), then the deliberately-wrong min-calls failure (lines 5–6).
      terminalHighlightLines: [[1, 2], [5, 6]],
      pauseAfter: true,
    },

    // ── Step 5: mock verify (Live Journal) ────────────────────────────────
    {
      id: 'cli10-verify-live',
      title: 'mock verify (Live Journal)',
      description:
        'Live-journal verify asserts against **real traffic** a running mock has received — not just saved samples. This requires a mock started through the companion (without `--standalone`).\n\n' +
        'Sequence: start companion mock → `curl` it → verify that the call happened and matched.\n\n' +
        'A `--standalone` listener has no control API to query, so `mock verify` (live) errors immediately with a clear message that names its own fix.\n\n' +
        '**Flags used:**\n' +
        '- `mock start <file>` — start in companion mode (no `--standalone`; requires the dev server)\n' +
        '- `mock verify <file>` — assert against the live journal\n' +
        '- `--min-calls 1` — at least 1 matching call must have been received\n' +
        '- `--expect-outcome matched` — the call must have matched a route\n' +
        '- `--last-call-within-ms 5000` — the last matching call must be within the last 5 seconds\n' +
        '- `--body-contains ok` — the response body must contain the string `ok`',
      terminalCommand:
        'redfireforge mock start examples/api-mock/sample-workspace.json  # companion mode (requires npm run server:dev)',
      terminalOutput:
        '{\n' +
        '  "ready": true,\n' +
        '  "results": [\n' +
        '    { "serverId": "srv-demo", "ok": true, "port": 4600, "mode": "companion" }\n' +
        '  ]\n' +
        '}\n' +
        '\n' +
        '$ curl http://127.0.0.1:4600/health\n' +
        '200 {"ok":true}\n' +
        '\n' +
        '$ redfireforge mock verify examples/api-mock/sample-workspace.json --min-calls 1 --expect-outcome matched --last-call-within-ms 5000 --body-contains ok\n' +
        '{\n' +
        '  "mode": "live-journal",\n' +
        '  "serverId": "srv-demo",\n' +
        '  "passed": true,\n' +
        '  "expected": "assertions satisfied",\n' +
        '  "actual": "count = 1",\n' +
        '  "matchingCount": 1,\n' +
        '  "matchingIds": ["tx-1787108422662-rw5ajn"],\n' +
        '  "nearMisses": []\n' +
        '}\n' +
        'Live journal: 1 matching call(s).\n' +
        '\n' +
        '# the exact same verify command against a --standalone listener instead:\n' +
        'Live journal verify failed: fetch failed — start the companion with `npm run server:dev`, or pass --simulate for offline corpus checks.',
      // 2 beats: the companion mode field (line 4), then the standalone-mode error (line 25).
      terminalHighlightLines: [[4, 4], [25, 25]],
      pauseAfter: true,
    },

    // ── Step 6: Dockerized Mock in CI ──────────────────────────────────────
    {
      id: 'cli10-docker',
      title: 'Dockerized Mock in CI',
      description:
        'The Dockerfile bakes `mock start --standalone --wait-ready` into its `CMD` — the container starts, the mock is ready, and the `HEALTHCHECK` confirms it every 10 seconds by curling `/health` from inside the container.\n\n' +
        'The CI snippet below it shows the three-step pattern: simulate offline (no container needed) → start in background → health-check retry loop before running tests against it.\n\n' +
        '**Key Dockerfile instructions:**\n' +
        '- `EXPOSE 4600` — the port the mock listens on\n' +
        '- `HEALTHCHECK` — curl `/health` every 10s; fail after 5 retries\n' +
        '- `CMD [..., "--standalone", "--wait-ready"]` — start the mock and block until it\'s ready\n\n' +
        '**Key CI flags (in the snippets):**\n' +
        '- `--standalone` — in-process listener, no dev server\n' +
        '- `--wait-ready` — block until the mock is listening before the process prints "ready"\n' +
        '- `--simulate` — offline corpus check before spinning up a live container',
      terminalCommand: 'cat examples/api-mock/Dockerfile',
      terminalOutput:
        'FROM node:22-bookworm-slim\n' +
        'WORKDIR /app\n' +
        'COPY package.json package-lock.json ./\n' +
        'RUN npm ci --ignore-scripts\n' +
        'COPY . .\n' +
        'EXPOSE 4600\n' +
        'HEALTHCHECK --interval=10s --timeout=3s --retries=5 CMD node -e "fetch(\'http://127.0.0.1:4600/health\').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"\n' +
        'CMD ["npx","tsx","cli/index.ts","mock","start","examples/api-mock/sample-workspace.json","--standalone","--wait-ready"]\n' +
        '\n' +
        '# matching CI snippet from docs/guides/api-mock/cli-and-ci.md (source-repo form shown\n' +
        '# there; swap npx tsx cli/index.ts for npx redfireforge-cli / rff for external users):\n' +
        '- name: Mock simulate\n' +
        '  run: npx tsx cli/index.ts mock verify examples/api-mock/sample-workspace.json --simulate --expect-outcome matched --min-calls 1\n' +
        '- name: Mock start (background)\n' +
        '  run: npx tsx cli/index.ts mock start examples/api-mock/sample-workspace.json --standalone --wait-ready &\n' +
        '- name: Health\n' +
        '  run: |\n' +
        '    for i in 1 2 3 4 5; do curl -sf http://127.0.0.1:4600/health && exit 0; sleep 1; done\n' +
        '    exit 1',
      // 2 beats: the Dockerfile's CMD line, then the CI guide's matching health-check retry loop.
      terminalHighlightLines: [[8, 8], [18, 19]],
      pauseAfter: true,
    },
  ],
};
