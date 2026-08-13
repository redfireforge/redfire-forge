# API Mock Studio — CLI / Docker / CI examples (Phase 8E)

Headless helpers for a saved workspace (native JSON/YAML export or the sample below).

## Sample definition

`sample-workspace.json` — one mock server on `:4600` (`host: 0.0.0.0` so Docker published ports work) with `GET /health`.

```bash
# Offline corpus (no companion, no listener)
npx tsx cli/index.ts mock simulate examples/api-mock/sample-workspace.json
npx tsx cli/index.ts mock verify examples/api-mock/sample-workspace.json --simulate --expect-outcome matched --min-calls 1

# In-process listener (no companion)
npx tsx cli/index.ts mock start examples/api-mock/sample-workspace.json --standalone --wait-ready
# in another shell:
curl -s http://127.0.0.1:4600/health

# Live journal assertions (companion on :3001 + a running mock)
npm run server:dev
npx tsx cli/index.ts mock start examples/api-mock/sample-workspace.json --wait-ready
npx tsx cli/index.ts mock verify examples/api-mock/sample-workspace.json --min-calls 1 --expect-outcome matched --route route-health
```

`--port` overrides the listen port without mutating the source file.

## Docker

Build from the repository root:

```bash
docker build -f examples/api-mock/Dockerfile -t redfireforge-api-mock .
docker run --rm -p 4600:4600 redfireforge-api-mock
curl -s http://127.0.0.1:4600/health
```

The image starts the listener in-process (`--standalone --wait-ready`). SIGINT/SIGTERM drains sockets.
Inside a container, loopback hosts (`127.0.0.1` / `localhost`) are rewritten to `0.0.0.0` so `docker run -p` can reach the mock.

## CI snippet

```yaml
# GitHub Actions — simulate corpus, then smoke the standalone listener
- name: Mock simulate
  run: npx tsx cli/index.ts mock verify examples/api-mock/sample-workspace.json --simulate --expect-outcome matched --min-calls 1
- name: Mock start (background)
  run: npx tsx cli/index.ts mock start examples/api-mock/sample-workspace.json --standalone --wait-ready &
- name: Health
  run: |
    for i in 1 2 3 4 5; do curl -sf http://127.0.0.1:4600/health && exit 0; sleep 1; done
    exit 1
```
