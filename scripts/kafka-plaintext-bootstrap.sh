#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker/kafka/plaintext/docker-compose.yml"
HEALTHCHECK_SCRIPT="$ROOT_DIR/docker/kafka/plaintext/healthcheck.sh"
CREATE_TOPICS_SCRIPT="$ROOT_DIR/docker/kafka/topics/create-topics.sh"
SEED_SCRIPT="$ROOT_DIR/docker/kafka/topics/seed-messages.sh"
SMOKE_SCRIPT="$ROOT_DIR/docker/kafka/plaintext/smoke-test.sh"
SERVER_HOST="${KAFKA_BOOTSTRAP_SERVER_HOST:-127.0.0.1}"
SERVER_PORT="${KAFKA_BOOTSTRAP_SERVER_PORT:-3301}"
SERVER_LOG_FILE="${KAFKA_BOOTSTRAP_SERVER_LOG:-$ROOT_DIR/.tmp/kafka-bootstrap-server.log}"
SERVER_PID=""

mkdir -p "$(dirname "$SERVER_LOG_FILE")"

probe_url() {
  local url="$1"
  curl --silent --output /dev/null --write-out '%{http_code}' --noproxy "${KAFKA_SMOKE_NO_PROXY:-127.0.0.1,localhost}" "$url" || true
}

wait_for_url() {
  local url="$1"
  local expected_status="$2"
  local label="$3"
  local attempts="${4:-40}"
  local sleep_seconds="${5:-1}"
  local status=""
  local attempt=0

  while (( attempt < attempts )); do
    status="$(probe_url "$url")"
    if [[ "$status" == "$expected_status" ]]; then
      return 0
    fi
    attempt=$((attempt + 1))
    sleep "$sleep_seconds"
  done

  echo "$label did not become ready at $url (last status: $status)." >&2
  return 1
}

ensure_kafka_server() {
  local base_url="${KAFKA_SMOKE_BASE_URL:-http://$SERVER_HOST:$SERVER_PORT}"
  local kafka_status="$(probe_url "$base_url/api/kafka/status")"

  if [[ "$kafka_status" == "200" ]]; then
    export KAFKA_SMOKE_BASE_URL="$base_url"
    echo "Using existing Kafka-enabled server at $KAFKA_SMOKE_BASE_URL"
    return 0
  fi

  echo "Starting local Kafka-enabled server on http://$SERVER_HOST:$SERVER_PORT"
  PORT="$SERVER_PORT" HOST="$SERVER_HOST" npm run server >"$SERVER_LOG_FILE" 2>&1 &
  SERVER_PID="$!"

  wait_for_url "http://$SERVER_HOST:$SERVER_PORT/health" "200" "Local server healthcheck"
  wait_for_url "http://$SERVER_HOST:$SERVER_PORT/api/kafka/status" "200" "Kafka route readiness"

  export KAFKA_SMOKE_BASE_URL="http://$SERVER_HOST:$SERVER_PORT"
  echo "Kafka-enabled server ready at $KAFKA_SMOKE_BASE_URL"
}

cleanup() {
  echo "Stopping plaintext Kafka profile..."
  docker compose -f "$COMPOSE_FILE" down --remove-orphans || true
  if [[ -n "$SERVER_PID" ]]; then
    echo "Stopping local Kafka-enabled server..."
    kill "$SERVER_PID" >/dev/null 2>&1 || true
    wait "$SERVER_PID" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT

echo "Starting plaintext Kafka profile..."
docker compose -f "$COMPOSE_FILE" up -d

"$HEALTHCHECK_SCRIPT"
"$CREATE_TOPICS_SCRIPT"
"$SEED_SCRIPT"
ensure_kafka_server
"$SMOKE_SCRIPT"

echo "Plaintext bootstrap and smoke complete."
