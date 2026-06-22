# GQL-5 Phase 8 — Human Validation Checklist

**Lesson:** `gql-https-tls` (12 steps) · **Estimated:** 8 min at 1×  
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
2. **Start Demo** → auto-play at **1×** through all 12 steps.
3. **Steps 9–11 (mTLS):** confirm client cert + key pasted, connect to `https://localhost:4445/graphql`, schema loads.
4. **Step 12:** endpoint restores to `http://localhost:4010/graphql`.
5. Rapid **Next** through steps 9–11 — `preAction` guards recover without manual fix.

## Tauri (desktop)

1. `npm run tauri:dev` — repeat Web checklist on desktop build.
2. Confirm TLS traffic routes through Node proxy (transport badge / metadata as described in lesson).
3. mTLS steps 9–11 succeed with same PEM fields as web.

## Automated E2E (supplement)

```bash
NO_PROXY='*' npm run test:e2e:demo:gql5
```

Full walk skips when any of TLS/mTLS/4010 health checks fail.

## Sign-off

- [ ] Web 1× auto-play — no stuck steps, mTLS introspection OK
- [ ] Tauri 1× auto-play — same
- [ ] Screenshot: `gql5-https-tls-lesson-complete` from E2E or manual
