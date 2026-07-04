#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker/grpc/docker-compose.yml"
SERVER_HOST="127.0.0.1"
SERVER_PORT="${GRPC_PHASE13_SERVER_PORT:-3001}"
BASE_URL="${GRPC_PHASE13_BASE_URL:-http://${SERVER_HOST}:${SERVER_PORT}}"
PROBE_TARGET="${GRPC_PHASE13_PROBE_TARGET:-127.0.0.1:50051}"
SAMPLES="${GRPC_PHASE13_SAMPLES:-15}"
PROBE_SAMPLES="${GRPC_PHASE13_PROBE_SAMPLES:-3}"
TIMEOUT_MS="${GRPC_PHASE13_TIMEOUT_MS:-3500}"
OUT_PATH="${GRPC_PHASE13_OUT_PATH:-artifacts/grpc-phase13b-baseline.ci.json}"
PARITY_OUT_PATH="${GRPC_TRANSPORT_PARITY_OUT_PATH:-artifacts/grpc-transport-parity-matrix.ci.json}"
MAX_P95_MS="${GRPC_PHASE13_MAX_P95_MS:-450}"
MAX_AVG_MS="${GRPC_PHASE13_MAX_AVG_MS:-250}"
MAX_ERROR_RATE="${GRPC_PHASE13_MAX_ERROR_RATE:-0.05}"
SERVER_LOG="${GRPC_PHASE13_SERVER_LOG:-/tmp/redfire-grpc-server.log}"

server_pid=""

curl_local() {
  curl --noproxy '*' -sSf "$1"
}

cleanup() {
  local exit_code="${1:-0}"
  set +e

  if [[ "$exit_code" -ne 0 ]]; then
    echo "[grpc-phase13b-ci] Gate failed; dumping diagnostics"
    echo "===== API server log ====="
    cat "$SERVER_LOG" || true
    echo "===== gRPC fixture logs ====="
    docker compose -f "$COMPOSE_FILE" logs || true
  fi

  if [[ -n "$server_pid" ]] && kill -0 "$server_pid" 2>/dev/null; then
    kill "$server_pid" || true
    wait "$server_pid" 2>/dev/null || true
  fi

  docker compose -f "$COMPOSE_FILE" down -v --remove-orphans || true
}

trap 'exit_code=$?; cleanup "$exit_code"; exit "$exit_code"' EXIT

cd "$ROOT_DIR"

echo "[grpc-phase13b-ci] Starting gRPC fixture"
docker compose -f "$COMPOSE_FILE" up -d --build

echo "[grpc-phase13b-ci] Waiting for fixture health endpoint"
for i in {1..60}; do
  if curl_local "http://127.0.0.1:50052/health" >/dev/null; then
    echo "[grpc-phase13b-ci] Fixture is healthy"
    break
  fi
  if [[ "$i" -eq 60 ]]; then
    echo "[grpc-phase13b-ci] Fixture failed health check"
    exit 1
  fi
  sleep 1
done

echo "[grpc-phase13b-ci] Starting API server on port $SERVER_PORT"
PORT="$SERVER_PORT" npm run server >"$SERVER_LOG" 2>&1 &
server_pid="$!"

echo "[grpc-phase13b-ci] Waiting for API readiness"
for i in {1..40}; do
  if curl_local "$BASE_URL/api/grpc/describe/usage" >/dev/null; then
    echo "[grpc-phase13b-ci] API is ready"
    break
  fi
  if [[ "$i" -eq 40 ]]; then
    echo "[grpc-phase13b-ci] API server failed readiness check"
    exit 1
  fi
  sleep 1
done

echo "[grpc-phase13b-ci] Running fixture-backed Phase 13B gate"
node scripts/grpc-phase13-baseline.mjs \
  --base-url="$BASE_URL" \
  --samples="$SAMPLES" \
  --timeout-ms="$TIMEOUT_MS" \
  --probe-grpc-target="$PROBE_TARGET" \
  --probe-samples="$PROBE_SAMPLES" \
  --max-p95-ms="$MAX_P95_MS" \
  --max-avg-ms="$MAX_AVG_MS" \
  --max-error-rate="$MAX_ERROR_RATE" \
  --out="$OUT_PATH" \
  --require-live \
  --require-data-plane

echo "[grpc-phase13b-ci] Gate passed. Artifact: $OUT_PATH"

echo "[grpc-phase13b-ci] Running transport parity matrix automation"
npm run grpc:transport:parity -- --out="$PARITY_OUT_PATH"

echo "[grpc-phase13b-ci] Transport parity artifact: $PARITY_OUT_PATH"
