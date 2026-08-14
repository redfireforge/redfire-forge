# RedfireForge CLI

> API Performance Testing from the Command Line

Run API performance tests and workflows using YAML or JSON test files. The CLI uses the same execution engine as the RedfireForge desktop application, ensuring consistent behavior between GUI and command-line testing.

## Installation

### Option 1: npm Package (Recommended)

```bash
npm install -g redfireforge-cli
```

### Option 2: Desktop App CLI Mode

If you have the RedfireForge desktop app installed, use the `--cli` flag:

```bash
# macOS/Linux (symlink created during installation)
redfireforge --cli run tests/test.yaml

# Windows (added to PATH during installation)
redfireforge --cli run tests/test.yaml
```

### Option 3: From Source

```bash
git clone https://github.com/your-org/redfireforge.git
cd redfireforge
npm install
npx tsx cli/index.ts run tests/test.yaml
```

## Quick Start

```bash
# Validate a test file
redfireforge validate tests/api-test.yaml

# Run a simple test
redfireforge run tests/api-test.yaml

# Run with concurrency and iterations
redfireforge run tests/api-test.yaml -c 10 -i 100

# Run a workflow performance test
redfireforge workflow tests/checkout-flow.yaml -i 50 -c 5
```

## Commands

| Command | Description |
|---------|-------------|
| `run <file>` | Execute a test file |
| `workflow <file>` | Execute a workflow as a performance test |
| `validate <file>` | Validate a test file without running |
| `validate-workflow <file>` | Validate a workflow file without running |
| `mock simulate <file>` | Run saved API Mock samples (side-effect-free) |
| `mock verify <file>` | Assert live journal calls (or `--simulate` for offline corpus) |
| `mock start <file>` | Start mock listeners (companion, or in-process `--standalone`) |

### API Mock Studio (`mock`)

Headless helpers for API Mock Studio definitions (native JSON/YAML export envelopes or workspace files).

```bash
# Simulate samples against a definition (same engine as GUI)
npx tsx cli/index.ts mock simulate ./api-mock-workspace.json -o results.json --junit junit.xml

# Verify live journal (requires companion + running mock)
npx tsx cli/index.ts mock verify ./api-mock-workspace.json --expect-outcome matched --min-calls 1

# Offline corpus (same engine as GUI Simulate)
npx tsx cli/index.ts mock verify ./api-mock-workspace.json --simulate --expect-outcome matched --min-calls 1

# Start listeners. Companion on :3001 is preferred; falls back to in-process.
npx tsx cli/index.ts mock start ./api-mock-workspace.json --port 4600 --wait-ready

# Force in-process listeners (no companion) — useful in Docker/CI
npx tsx cli/index.ts mock start ./api-mock-workspace.json --standalone --wait-ready
```

| Option | Commands | Description |
|--------|----------|-------------|
| `--server <id>` | simulate, verify | Target server (default: active / first) |
| `-o, --output <path>` | simulate | Write JSON results |
| `--junit <path>` | simulate | Write JUnit XML |
| `--min-calls <n>` | verify | Require at least N matching journal calls (samples when `--simulate`) |
| `--expect-outcome <outcome>` | verify | Require matching outcome |
| `--route <id>` | verify | Restrict assertions to a route (live journal, or `--simulate` samples) |
| `--last-call-within-ms <n>` | verify | Last matching call recency (live journal only) |
| `--body-contains <text>` | verify | Matching response body substring (live journal last call, or `--simulate` samples) |
| `--simulate` | verify | Offline corpus instead of live journal |
| `--port <n>` | start | Port override for the first server; later servers increment |
| `--control-base <url>` | start, verify | Companion base (default `http://127.0.0.1:3001`) |
| `--wait-ready` | start | Stay alive until SIGINT/SIGTERM, then stop (implied for `--standalone`) |
| `--standalone` | start | In-process listeners (no companion) |

## Common Options

### Test Run Options

| Option | Description |
|--------|-------------|
| `-c, --concurrency <n>` | Number of concurrent requests (default: 1) |
| `-i, --iterations <n>` | Number of iterations |
| `-m, --mode <mode>` | Execution mode: `sequential`, `batch`, `pool`, `load-profile` |
| `--timeout <sec>` | Per-request timeout in seconds (default: 30) |
| `--retries <n>` | Retry count on failure |
| `--retry-delay <ms>` | Delay between retries |
| `--base-url <url>` | Override base URL for all tests |

### Workflow Options

| Option | Description |
|--------|-------------|
| `-i, --iterations <n>` | Total workflow iterations (default: 10) |
| `-c, --concurrency <n>` | Concurrent iterations (default: 1) |
| `--var <name=value>` | Set workflow variables (can repeat) |

### Output Options

| Option | Description |
|--------|-------------|
| `-o, --output <path>` | Write JSON report |
| `--junit <path>` | Write JUnit XML report |
| `--markdown <path>` | Write Markdown report |
| `-q, --quiet` | Suppress progress output |

### CI/CD Options

| Option | Description |
|--------|-------------|
| `--fail-on-error` | Exit code 1 if any request fails |
| `--fail-threshold <pct>` | Exit code 1 if error rate exceeds % |
| `--error-policy <policy>` | `continue`, `stop-first`, `stop-threshold` |

## Test File Format (YAML)

```yaml
name: My API Tests
baseUrl: https://api.example.com

tests:
  - name: List Users
    method: GET
    url: /users
    assertions:
      - type: status
        expected: "200"
      - type: jsonPath
        jsonPath: $.length
        operator: ">"
        value: 0

  - name: Create User
    method: POST
    url: /users
    headers:
      Content-Type: application/json
    body: |
      {"name": "{{name}}", "email": "{{email}}"}
    assertions:
      - type: status
        expected: "201"
```

## Workflow File Format (YAML)

```yaml
name: User Registration Flow
variables:
  email: test@example.com

nodes:
  - id: start
    type: start
    data:
      label: Start

  - id: create-user
    type: http
    data:
      label: Create User
      method: POST
      url: https://api.example.com/users
      headers:
        Content-Type: application/json
      body: |
        {"email": "{{email}}"}

edges:
  - id: e1
    source: start
    target: create-user
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success — all tests passed |
| 1 | Test failure — some requests failed or threshold exceeded |
| 2 | Error — invalid file, missing file, or execution error |

## CI/CD Example

```yaml
# GitHub Actions
- name: Run API Tests
  run: |
    npx redfireforge-cli run tests/api-test.yaml \
      --concurrency 10 \
      --iterations 100 \
      --junit results.xml \
      --fail-on-error \
      -q
```

## Links

- [Full Documentation](https://github.com/your-org/redfireforge/blob/main/docs/guides/cli-reference.md)
- [CI/CD Integration Guide](https://github.com/your-org/redfireforge/blob/main/docs/guides/cli-ci-cd.md)
- [Example Test Files](https://github.com/your-org/redfireforge/tree/main/examples)

## License

MIT
