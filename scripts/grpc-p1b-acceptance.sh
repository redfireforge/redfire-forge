#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "[p1b] docker compose config"
cd "$ROOT_DIR/docker/grpc"
docker compose config >/dev/null

echo "[p1b] docker compose --profile mock-servicer up -d --build"
docker compose --profile mock-servicer up -d --build

echo "[p1b] ./probe-fixtures.sh --with-go-mock"
./probe-fixtures.sh --with-go-mock

echo "[p1b] playwright smoke (mock listener lifecycle + go mock servicer predicates)"
cd "$ROOT_DIR"
npx playwright test \
  e2e/grpc-studio-mock-listener.spec.ts \
  e2e/grpc-studio-go-mock-servicer.spec.ts \
  --reporter=list \
  --workers=40 \
  --timeout=15000

echo "[p1b] acceptance sequence passed"
