# API Mock Studio — Getting Started

## 1. Prerequisites

### Web

```bash
# Terminal A — Vite app
npm run dev

# Terminal B — companion control plane (required for Start / journal)
npm run server:dev
```

Open the app (typically `http://localhost:5173`) → Protocols → **API Mock**.

If the companion is down, Start fails with a recoverable **Companion unavailable** diagnostic. The UI points you back to `npm run server:dev`.

### Tauri desktop

```bash
npm run tauri:dev
```

Start / journal use the **native Rust listener**. TLS listeners show an **HTTP/2** badge (`h2` ALPN with HTTP/1.1 fallback; plaintext stays HTTP/1.1). You may still need the companion for TLS certificate generation helpers and other protocol studios.

## 2. Create your first mock server

1. Open **API Mock**.
2. If the workspace is empty, use **Create first mock server** (or the **+** control on the server tab bar).
3. A tab appears (for example **Mock Server 1:4600**). Ports auto-allocate in **4600–4699**.
4. Confirm the workspace nav shows **Studio** | **Runtime** | **Conflicts**.
5. While a server is selected, the Studio footer **Live** strip shows status plus deep-links into Runtime (Transactions, Variables, Settings, Console) and Conflicts.

### Tab chrome (useful early)

| Action | How |
|---|---|
| Rename | F2 or double-click the tab label |
| Duplicate | Tab context / duplicate control — new id + next free port; **secrets stripped** |
| Reorder | Drag tabs (max **8** open) |
| Close | Tab close; confirm when prompted |

## 3. Add a route

1. Stay on **Studio**.
2. In the route explorer, **Add route** (or equivalent + control).
3. On the rule editor **Match** tab:
   - Method: `GET`
   - Path: `/health` (kind **Exact** is fine)
4. On **Response**:
   - Status `200`
   - Body, for example: `{ "ok": true }`
5. Leave the server **dirty** until you are ready to run (or Apply after Start).

## 4. Start and hit the mock

1. On the server bar, click **Start**.
2. Status becomes **Running**. Copy the listen URL (for example `http://127.0.0.1:4600`).
3. Send traffic:

```bash
curl -s http://127.0.0.1:4600/health
```

Or use **Requests** Studio against that base URL.

4. Open **Runtime → Transactions**. You should see a matched journal row.

## 5. Hot-apply a change

1. Edit the response body in **Studio**.
2. Click **Apply** on the server bar (dirty indicator clears; generation increments).
3. Repeat the curl — the new body is served. In-flight requests stay on the previous generation.

**Note:** Apply commits rules/settings into the running snapshot. Changing **listen port or TLS material** requires **Restart** (commit does not rebind).

### Route delete undo

Deleting a route asks for confirmation, then shows a **~5s undo toast**. Click restore or press **Cmd/Ctrl+Z** while the toast is open to put the rule (and surviving examples) back at its prior index.

## 6. Import the sample workspace (optional)

From the repo root:

```bash
# Offline check (no listener)
npx tsx cli/index.ts mock simulate examples/api-mock/sample-workspace.json

# In-process listener
npx tsx cli/index.ts mock start examples/api-mock/sample-workspace.json --standalone --wait-ready
```

In the GUI: **Import** → **RedfireForge export** and paste / load a previously exported workspace JSON (or build from the sample file contents).

## 7. Stop

Click **Stop** on the server bar. The data-plane port releases after graceful drain.

## Next

- Full training script: [studio-walkthrough.md](./studio-walkthrough.md)
- Matching & Conflict Inspector: [matching-and-conflicts.md](./matching-and-conflicts.md)
- Platform differences: [compatibility.md](./compatibility.md)
