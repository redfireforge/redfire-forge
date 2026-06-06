#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${KAFKA_SMOKE_BASE_URL:-http://127.0.0.1:3001}"
NO_PROXY_HOSTS="${KAFKA_SMOKE_NO_PROXY:-127.0.0.1,localhost}"
SMOKE_RUN_ID="${KAFKA_SMOKE_RUN_ID:-smoke-$(date +%s)}"
SMOKE_KEY="smoke-customer-$SMOKE_RUN_ID"
SMOKE_TRACE_ID="trace-$SMOKE_RUN_ID"

require_kafka_server() {
  local health_status=""
  local kafka_status=""

  health_status="$(curl --silent --output /dev/null --write-out '%{http_code}' --noproxy "$NO_PROXY_HOSTS" "$BASE_URL/health" || true)"
  kafka_status="$(curl --silent --output /dev/null --write-out '%{http_code}' --noproxy "$NO_PROXY_HOSTS" "$BASE_URL/api/kafka/status" || true)"

  if [[ "$health_status" != "200" ]]; then
    echo "Kafka smoke requires the local server at $BASE_URL, but /health returned '$health_status'." >&2
    exit 1
  fi

  if [[ "$kafka_status" != "200" ]]; then
    echo "Kafka smoke requires a Kafka-enabled server at $BASE_URL, but /api/kafka/status returned '$kafka_status'." >&2
    exit 1
  fi
}

request() {
  local method="$1"
  local path="$2"
  local body="${3:-}"

  if [[ -n "$body" ]]; then
    curl --silent --show-error --fail \
      --noproxy "$NO_PROXY_HOSTS" \
      -X "$method" \
      -H 'Content-Type: application/json' \
      "$BASE_URL$path" \
      -d "$body"
  else
    curl --silent --show-error --fail \
      --noproxy "$NO_PROXY_HOSTS" \
      -X "$method" \
      "$BASE_URL$path"
  fi
}

require_kafka_server

echo "Kafka smoke step: connect"
request POST /api/kafka/connect '{"connection":{"clusterId":"local-plaintext","clientId":"redfireforge-local","brokers":["127.0.0.1:19092"],"connectionTimeoutMs":5000,"requestTimeoutMs":5000,"auth":{"mode":"none"},"tls":{"enabled":false}}}' | cat

echo "Kafka smoke step: topics"
request GET /api/kafka/topics | cat

echo "Kafka smoke step: produce"
request POST /api/kafka/produce "{\"topic\":\"redfireforge.debug.consume\",\"messages\":[{\"key\":\"$SMOKE_KEY\",\"value\":\"{\\\"kind\\\":\\\"smoke\\\",\\\"status\\\":\\\"ok\\\",\\\"runId\\\":\\\"$SMOKE_RUN_ID\\\"}\",\"headers\":{\"traceId\":\"$SMOKE_TRACE_ID\",\"source\":\"smoke\",\"env\":\"local\"}}]}" | cat

echo "Kafka smoke step: consume-once"
request POST /api/kafka/consume-once "{\"topic\":\"redfireforge.debug.consume\",\"groupId\":\"redfireforge-smoke-group-$SMOKE_RUN_ID\",\"fromBeginning\":true,\"timeoutMs\":8000,\"maxMessages\":1,\"filter\":{\"keyEquals\":\"$SMOKE_KEY\",\"headersMatch\":{\"source\":\"smoke\",\"traceId\":\"$SMOKE_TRACE_ID\"},\"jsonPath\":\"$.runId\",\"jsonEquals\":\"$SMOKE_RUN_ID\"}}" | cat

echo "Kafka smoke step: disconnect"
request POST /api/kafka/disconnect '{}' | cat

echo "Smoke test complete."
