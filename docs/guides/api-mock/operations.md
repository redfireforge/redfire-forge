# Operations

## 1. Day-2 checklist

| Task | Command / UI |
|---|---|
| Start companion (web) | `npm run server:dev` → `:3001` |
| Start app | `npm run dev` or `npm run tauri:dev` |
| Verify control plane | Companion reachable; Studio no longer shows companion unavailable |
| Start mocks | Server bar **Start** (≤ 8 tabs) |
| Watch health | **Runtime → Transactions / Diagnostics / Console** |
| Stop cleanly | **Stop** per server; SIGINT on CLI `--wait-ready` |

## 2. Ports

| Port | Role |
|---|---|
| `3001` | Companion control plane (default) |
| `4600–4699` | Auto mock listen range (`AUTO_PORT_RANGE`) |
| Vite `5173` | Web UI (dev) |

Port ownership conflicts surface as `MOCK_PORT_IN_USE` / `MOCK_PORT_OWNED` with recovery guidance.

## 3. Capacity

Respect hard ceilings (see [architecture.md](./architecture.md)):

- 8 open server tabs
- Up to 2,000 routes per server (perf budgets in Phase 12A)
- Journal ring buffer (default/max 500 entries)
- Body / connection limits in Runtime Settings

Perf budgets are coded in `src/shared/api-mock/perfBudgets.ts` (`API_MOCK_PERF_BUDGETS`).

## 4. CLI / Docker ops

See [cli-and-ci.md](./cli-and-ci.md):

- Prefer `--standalone --wait-ready` in containers
- Use `--control-base` when the companion is not on localhost
- Drain on SIGINT/SIGTERM

## 5. Logging

- **Runtime → Console** streams companion logs (EventSource when available).
- Diagnostics tab exposes counters only — safe for screenshots.

## 6. Backup

- Periodic **Export → Workspace JSON/YAML**
- Treat exports as source of truth for CI corpora
- Do not rely on OS temp journal persist-to-disk (`{tmpdir}/redfireforge-api-mock-journals/`) as backup

## 7. Studio ergonomics worth knowing

| Feature | Behavior |
|---|---|
| Tab rename / duplicate / reorder | F2 or double-click; duplicate strips secrets and takes next port; drag reorder; max 8 tabs |
| Route-delete undo | Confirm → 5s toast → Restore or Cmd/Ctrl+Z |
| Recorded proxy drafts | Polled every ~1.5s while Running; merged inactive; auto-acked |
| Apply vs Restart | Apply hot-commits rules; **Restart** required after port/TLS bind changes |
