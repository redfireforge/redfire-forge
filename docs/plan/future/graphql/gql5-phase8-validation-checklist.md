# GQL-5 Phase 8 — Human Validation Checklist

**Lesson:** `gql-https-tls` (**16 steps**) · **Estimated:** 9 min at 1×  
**Requires:** TLS stack (4443/4444) + mTLS stack (4445/4446) + plain GraphQL (4010)

## Start Docker

```bash
cd docker/graphql/tls
./generate-cert.sh && ./generate-client-cert.sh
docker compose up -d
docker compose -f docker-compose.mtls.yml up -d
cd ../../graphql && docker compose up -d
```

Verify:

```bash
curl --noproxy '*' http://127.0.0.1:4444/health
curl --noproxy '*' http://127.0.0.1:4446/health
curl --noproxy '*' http://127.0.0.1:4010/health
```

## Web (Chrome)

1. Demo Hub → **HTTPS, TLS & Certificates** → Concept → confirm **both** health probes show ready (4444 + 4446).
2. **Start Demo** → auto-play at **1×** through all **16** steps.
3. **Steps 11–14 (mTLS):** `gqlt-mtls-intro` → creds → connect → observe — client cert + key pasted, connect to `https://localhost:4445/graphql`, schema loads.
4. **Steps 15–16:** endpoint restores to `http://localhost:4010/graphql` (`gqlt-restore`, `gqlt-observe-restore`).
5. Rapid **Next** through steps 11–14 — `preAction` guards recover without manual fix.

## Tauri (desktop)

1. With Vite already on **5173** (Playwright/E2E dev server): `cd src-tauri && cargo run --no-default-features` — or stop Vite first and run `npm run tauri:dev`.
2. Repeat Web checklist on desktop build.
3. Confirm TLS traffic uses native rustls on desktop (TLS panel notice) — no Node proxy required for mTLS HTTP.
4. mTLS steps **11–14** succeed with same PEM fields as web.

**Launch note (2026-06-23):** `npm run tauri:dev` fails when port 5173 is occupied; `cargo run` against existing Vite succeeds.

## Automated E2E (supplement)

```bash
NO_PROXY='*' npm run test:e2e:demo:gql5
```

Full walk skips when any of TLS/mTLS/4010 health checks fail.

**Last run:** 2026-06-26 — **2/2 passed** (~2.2 min full auto-play + shell) as part of Phase 8 spot-check batch (16 steps; TLS + mTLS + 4010 stacks up).

**§11.0 acceptance:** 2026-06-23 — **4/4 passed** (`npm run test:e2e:demo:gql110`, ~52s).

## Sign-off

- [x] **Automated E2E** full Docker walk (Chromium auto-play) — 2026-06-26 (16 steps)
- [x] **§11.0 workspace isolation E2E** — 2026-06-23 (`gql110` 4/4)
- [ ] Web **manual** 1× auto-play — see [phase8-validation-checklist.md](./phase8-validation-checklist.md)
- [ ] Tauri 1× auto-play — **steps 11–14 mTLS focus** (native rustls)
- [x] Screenshot: `e2e/screenshots/gql5-https-tls-lesson-complete-*.png` from E2E
