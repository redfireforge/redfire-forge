#!/usr/bin/env bash
# =============================================================================
# Schema Registry Smoke Test — Live Round-Trip Encode/Decode Validation
# =============================================================================
#
# Exercises the Kafka Schema Registry integration (Phase 10) against real
# Confluent Schema Registry + Redpanda Docker containers.
#
# Scenarios:
#   SR01  List subjects on fresh registry → empty list
#   SR02  Register Avro schema via Registry REST API → schema ID returned
#   SR03  List subjects → registered subject appears
#   SR04  List versions for subject → [1]
#   SR05  Server API: list subjects (POST /api/kafka/schema-subjects)
#   SR06  Server API: list versions (POST /api/kafka/schema-versions)
#   SR07  Server API: fetch schema  (POST /api/kafka/schema-fetch)
#   SR08  Kafka connect
#   SR09  Schema-aware produce (Avro) → partition + offset returned
#   SR10  Schema-aware consume-once → round-trip decoded value matches original
#   SR11  Produce a batch of 3 messages → all 3 decoded on consume
#   SR12  Unreachable registry → REGISTRY_UNREACHABLE error code
#   SR13  Invalid request: missing registryUrl → KAFKA_INVALID_REQUEST
#   SR14  Kafka disconnect
#
# Prerequisites:
#   - Schema Registry profile running:
#       cd docker/kafka/schema-registry && docker compose up -d
#       (Wait for redpanda-sr-init to exit cleanly before running this script)
#   - Local server running with Kafka support:
#       npm run server
#   - jq installed
#
# Usage:
#   ./smoke-test.sh
#
# Environment variables:
#   KAFKA_SMOKE_BASE_URL        Server base URL              (default: http://127.0.0.1:3001)
#   KAFKA_SMOKE_NO_PROXY        No-proxy hosts               (default: 127.0.0.1,localhost)
#   SR_KAFKA_BROKERS            Kafka broker address         (default: 127.0.0.1:19094)
#   SR_REGISTRY_URL             Schema Registry URL          (default: http://localhost:8085)
#   SR_CLUSTER_ID               Cluster ID for smoke tests   (default: sr-smoke-cluster)
# =============================================================================

set -euo pipefail

BASE_URL="${KAFKA_SMOKE_BASE_URL:-http://127.0.0.1:3001}"
NO_PROXY_HOSTS="${KAFKA_SMOKE_NO_PROXY:-127.0.0.1,localhost}"
SR_BROKERS="${SR_KAFKA_BROKERS:-127.0.0.1:19094}"
SR_REGISTRY_URL="${SR_REGISTRY_URL:-http://localhost:8085}"
SR_CLUSTER_ID="${SR_CLUSTER_ID:-sr-smoke-cluster}"
SMOKE_RUN_ID="sr-smoke-$(date +%s)"
SMOKE_TOPIC="sr.smoke.avro"
SMOKE_SUBJECT="${SMOKE_TOPIC}-value"
BATCH_TOPIC="sr.smoke.batch"
BATCH_SUBJECT="${BATCH_TOPIC}-value"

PASS_COUNT=0
FAIL_COUNT=0

# ── Colour helpers ─────────────────────────────────────────────────────────────

GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

pass() { echo -e "  ${GREEN}✓ PASS${RESET}  $1"; ((PASS_COUNT++)) || true; }
fail() { echo -e "  ${RED}✗ FAIL${RESET}  $1"; ((FAIL_COUNT++)) || true; }
header() { echo -e "\n${BOLD}${CYAN}▶ $1${RESET}"; }

# ── HTTP helpers ──────────────────────────────────────────────────────────────

# POST/PUT to the local RedfireForge server API.
server_post() {
  local path="$1"
  local body="$2"
  curl --silent --show-error \
    --noproxy "$NO_PROXY_HOSTS" \
    -X POST \
    -H "Content-Type: application/json" \
    -d "$body" \
    "${BASE_URL}${path}"
}

# POST/PUT directly to the Confluent Schema Registry REST API.
registry_post() {
  local path="$1"
  local body="$2"
  curl --silent --show-error \
    --noproxy "$NO_PROXY_HOSTS" \
    -X POST \
    -H "Content-Type: application/vnd.schemaregistry.v1+json" \
    -d "$body" \
    "${SR_REGISTRY_URL}${path}"
}

# GET directly from the Schema Registry REST API.
registry_get() {
  local path="$1"
  curl --silent --show-error \
    --noproxy "$NO_PROXY_HOSTS" \
    "${SR_REGISTRY_URL}${path}"
}

# ── Schema config JSON (reused across tests) ──────────────────────────────────

schema_config() {
  local subject="${1:-$SMOKE_SUBJECT}"
  printf '{"registryUrl":"%s","subject":"%s"}' "$SR_REGISTRY_URL" "$subject"
}

# ── Avro schemas ──────────────────────────────────────────────────────────────

SMOKE_AVRO_SCHEMA='{"type":"record","name":"SmokeEvent","namespace":"io.redfireforge.smoke","fields":[{"name":"run_id","type":"string"},{"name":"seq","type":"int"},{"name":"payload","type":"string"}]}'

BATCH_AVRO_SCHEMA='{"type":"record","name":"BatchEvent","namespace":"io.redfireforge.smoke","fields":[{"name":"run_id","type":"string"},{"name":"index","type":"int"}]}'

# =============================================================================
# Dependency check
# =============================================================================

if ! command -v jq &>/dev/null; then
  echo -e "${RED}ERROR: jq is required but not found. Install with: brew install jq${RESET}" >&2
  exit 1
fi

echo -e "\n${BOLD}Schema Registry Smoke Test${RESET}"
echo "Run ID  : ${SMOKE_RUN_ID}"
echo "Server  : ${BASE_URL}"
echo "Registry: ${SR_REGISTRY_URL}"
echo "Brokers : ${SR_BROKERS}"
echo "Cluster : ${SR_CLUSTER_ID}"

# =============================================================================
# SR01 — List subjects on fresh registry
# =============================================================================

header "SR01  List subjects (fresh registry)"

resp="$(registry_get '/subjects')"
if echo "$resp" | jq -e 'type == "array"' >/dev/null 2>&1; then
  pass "GET /subjects returned an array ($(echo "$resp" | jq 'length') subjects)"
else
  fail "GET /subjects did not return an array — response: $resp"
fi

# =============================================================================
# SR02 — Register Avro schema for smoke topic
# =============================================================================

header "SR02  Register Avro schema for '${SMOKE_SUBJECT}'"

reg_body="$(printf '{"schema":"%s"}' "$(echo "$SMOKE_AVRO_SCHEMA" | sed 's/"/\\"/g')")"
resp="$(registry_post "/subjects/${SMOKE_SUBJECT}/versions" "$reg_body")"
SMOKE_SCHEMA_ID="$(echo "$resp" | jq -r '.id // empty')"

if [[ -n "$SMOKE_SCHEMA_ID" && "$SMOKE_SCHEMA_ID" =~ ^[0-9]+$ ]]; then
  pass "Schema registered — id=${SMOKE_SCHEMA_ID}"
else
  fail "Schema registration failed — response: $resp"
  SMOKE_SCHEMA_ID=1
fi

# Register batch schema too
reg_body2="$(printf '{"schema":"%s"}' "$(echo "$BATCH_AVRO_SCHEMA" | sed 's/"/\\"/g')")"
resp2="$(registry_post "/subjects/${BATCH_SUBJECT}/versions" "$reg_body2")"
BATCH_SCHEMA_ID="$(echo "$resp2" | jq -r '.id // empty')"
if [[ -n "$BATCH_SCHEMA_ID" && "$BATCH_SCHEMA_ID" =~ ^[0-9]+$ ]]; then
  pass "Batch schema registered — id=${BATCH_SCHEMA_ID}"
else
  fail "Batch schema registration failed — response: $resp2"
fi

# =============================================================================
# SR03 — List subjects → smoke subject appears
# =============================================================================

header "SR03  List subjects → '${SMOKE_SUBJECT}' appears"

resp="$(registry_get '/subjects')"
if echo "$resp" | jq -e --arg s "$SMOKE_SUBJECT" 'index($s) != null' >/dev/null 2>&1; then
  pass "'${SMOKE_SUBJECT}' present in subjects list"
else
  fail "'${SMOKE_SUBJECT}' not found — subjects: $resp"
fi

# =============================================================================
# SR04 — List versions for subject → [1]
# =============================================================================

header "SR04  List versions for '${SMOKE_SUBJECT}'"

resp="$(registry_get "/subjects/${SMOKE_SUBJECT}/versions")"
if echo "$resp" | jq -e 'type == "array" and length >= 1 and .[0] == 1' >/dev/null 2>&1; then
  pass "Versions array contains 1 — versions: $resp"
else
  fail "Unexpected versions response: $resp"
fi

# =============================================================================
# SR05 — Server API: list subjects
# =============================================================================

header "SR05  Server API: POST /api/kafka/schema-subjects"

body="$(printf '{"schemaConfig":{"registryUrl":"%s"}}' "$SR_REGISTRY_URL")"
resp="$(server_post '/api/kafka/schema-subjects' "$body")"
ok="$(echo "$resp" | jq -r '.ok // false')"
subjects_count="$(echo "$resp" | jq '.data.subjects | length' 2>/dev/null || echo 0)"

if [[ "$ok" == "true" && "$subjects_count" -ge 1 ]]; then
  pass "Server returned ok=true, subjects count=${subjects_count}"
else
  fail "Server schema-subjects failed — response: $resp"
fi

# =============================================================================
# SR06 — Server API: list versions
# =============================================================================

header "SR06  Server API: POST /api/kafka/schema-versions"

body="$(printf '{"schemaConfig":{"registryUrl":"%s"},"subject":"%s"}' "$SR_REGISTRY_URL" "$SMOKE_SUBJECT")"
resp="$(server_post '/api/kafka/schema-versions' "$body")"
ok="$(echo "$resp" | jq -r '.ok // false')"
versions_count="$(echo "$resp" | jq '.data.versions | length' 2>/dev/null || echo 0)"

if [[ "$ok" == "true" && "$versions_count" -ge 1 ]]; then
  pass "Server returned ok=true, versions=[$(echo "$resp" | jq -c '.data.versions // []')]"
else
  fail "Server schema-versions failed — response: $resp"
fi

# =============================================================================
# SR07 — Server API: fetch schema
# =============================================================================

header "SR07  Server API: POST /api/kafka/schema-fetch"

body="$(printf '{"schemaConfig":{"registryUrl":"%s"},"subject":"%s","version":1}' "$SR_REGISTRY_URL" "$SMOKE_SUBJECT")"
resp="$(server_post '/api/kafka/schema-fetch' "$body")"
ok="$(echo "$resp" | jq -r '.ok // false')"
fetched_id="$(echo "$resp" | jq -r '.data.id // empty')"
fetched_version="$(echo "$resp" | jq -r '.data.version // empty')"

if [[ "$ok" == "true" && -n "$fetched_id" && -n "$fetched_version" ]]; then
  pass "Server returned ok=true, id=${fetched_id}, version=${fetched_version}"
else
  fail "Server schema-fetch failed — response: $resp"
fi

# =============================================================================
# SR08 — Kafka connect
# =============================================================================

header "SR08  Kafka connect"

connect_body="$(cat <<JSON
{
  "connection": {
    "clusterId": "${SR_CLUSTER_ID}",
    "name": "Schema Registry Smoke",
    "brokers": "${SR_BROKERS}",
    "authMode": "none"
  }
}
JSON
)"
resp="$(server_post '/api/kafka/connect' "$connect_body")"
ok="$(echo "$resp" | jq -r '.ok // false')"

if [[ "$ok" == "true" ]]; then
  pass "Kafka connected to ${SR_BROKERS}"
else
  fail "Kafka connect failed — response: $resp"
  echo -e "${RED}Cannot continue without a connected Kafka cluster.${RESET}" >&2
  # Print final summary and exit
  echo -e "\n${BOLD}Results: ${GREEN}${PASS_COUNT} passed${RESET} / ${RED}${FAIL_COUNT} failed${RESET}"
  exit 1
fi

# =============================================================================
# SR09 — Schema-aware produce (single Avro message)
# =============================================================================

header "SR09  Schema-aware produce (Avro)"

# Build the message value as a proper JSON string.
# kafka-service.ts expects messages[].value to be a string and calls JSON.parse()
# on it before encoding. Embedding MSG_VALUE as a bare object would make the
# server receive value as an object type, causing JSON.parse(msg.value) to throw.
MSG_VALUE_RAW="$(printf '{"run_id":"%s","seq":1,"payload":"avro-round-trip"}' "$SMOKE_RUN_ID")"
MSG_VALUE="$(printf '%s' "$MSG_VALUE_RAW" | jq -Rs '.')"

produce_body="$(cat <<JSON
{
  "clusterId": "${SR_CLUSTER_ID}",
  "topic": "${SMOKE_TOPIC}",
  "messages": [{"value": ${MSG_VALUE}}],
  "schemaConfig": {
    "registryUrl": "${SR_REGISTRY_URL}",
    "subject": "${SMOKE_SUBJECT}"
  }
}
JSON
)"
resp="$(server_post '/api/kafka/produce' "$produce_body")"
ok="$(echo "$resp" | jq -r '.ok // false')"
produce_offset="$(echo "$resp" | jq -r '.data.records[0].offset // empty')"
value_encoding="$(echo "$resp" | jq -r '.data.valueEncoding // empty')"

if [[ "$ok" == "true" && -n "$produce_offset" && "$value_encoding" == "avro" ]]; then
  pass "Produce ok — offset=${produce_offset}, valueEncoding=${value_encoding}"
else
  fail "Schema-aware produce failed — response: $resp"
fi

# =============================================================================
# SR10 — Schema-aware consume-once (round-trip decode)
# =============================================================================

header "SR10  Schema-aware consume-once (round-trip decode)"

consume_body="$(cat <<JSON
{
  "clusterId": "${SR_CLUSTER_ID}",
  "topic": "${SMOKE_TOPIC}",
  "maxMessages": 100,
  "timeoutMs": 8000,
  "fromBeginning": true,
  "schemaConfig": {
    "registryUrl": "${SR_REGISTRY_URL}",
    "subject": "${SMOKE_SUBJECT}"
  }
}
JSON
)"
resp="$(server_post '/api/kafka/consume-once' "$consume_body")"
ok="$(echo "$resp" | jq -r '.ok // false')"
msg_count="$(echo "$resp" | jq '.data.messages | length' 2>/dev/null || echo 0)"

if [[ "$ok" == "true" && "$msg_count" -ge 1 ]]; then
  pass "Consume ok — received ${msg_count} message(s)"

  # Find a message whose value contains the smoke run ID (proves our produced message round-tripped)
  found_msg="$(echo "$resp" | jq --arg rid "$SMOKE_RUN_ID" '[.data.messages[] | select(.value != null)] | map(select(.value | contains($rid))) | first // empty')"
  if [[ -n "$found_msg" && "$found_msg" != "null" ]]; then
    decoded_run_id="$(echo "$found_msg" | jq -r '.value | fromjson | .run_id')"
    decoded_payload="$(echo "$found_msg" | jq -r '.value | fromjson | .payload')"
    if [[ "$decoded_run_id" == "$SMOKE_RUN_ID" && "$decoded_payload" == "avro-round-trip" ]]; then
      pass "Round-trip decode: run_id=${decoded_run_id}, payload=${decoded_payload}"
    else
      fail "Decoded fields mismatch — run_id=${decoded_run_id}, payload=${decoded_payload}"
    fi
    # Verify rawValue is NOT present in client-facing response (regression for Phase 10B Bug 1)
    if echo "$found_msg" | jq -e 'has("rawValue")' >/dev/null 2>&1; then
      fail "rawValue field leaked into client response (regression: Phase 10B Bug 1)"
    else
      pass "rawValue correctly stripped from client response"
    fi
  else
    fail "No message with run_id=${SMOKE_RUN_ID} found in consumed messages"
    echo "  Consumed values: $(echo "$resp" | jq '[.data.messages[].value] | @json')"
  fi
else
  fail "Schema-aware consume-once failed — response: $(echo "$resp" | jq -c '{ok, error: .error}') msgs=${msg_count}"
fi

# =============================================================================
# SR11 — Batch produce 3 messages, consume and verify all 3 decoded
# =============================================================================

header "SR11  Batch produce + decode (3 messages)"

batch_msgs="$(for i in 1 2 3; do
  printf '{"value":"{\"run_id\":\"%s\",\"index\":%d}"}' "${SMOKE_RUN_ID}-batch" "$i"
  [[ $i -lt 3 ]] && printf ','
done)"

batch_produce_body="$(cat <<JSON
{
  "clusterId": "${SR_CLUSTER_ID}",
  "topic": "${BATCH_TOPIC}",
  "messages": [${batch_msgs}],
  "schemaConfig": {
    "registryUrl": "${SR_REGISTRY_URL}",
    "subject": "${BATCH_SUBJECT}"
  }
}
JSON
)"
resp="$(server_post '/api/kafka/produce' "$batch_produce_body")"
ok="$(echo "$resp" | jq -r '.ok // false')"

if [[ "$ok" == "true" ]]; then
  result_count="$(echo "$resp" | jq '.data.records | length')"
  pass "Batch produce ok — ${result_count} result(s)"

  # Consume and check all 3 are decodable
  batch_consume_body="$(cat <<JSON
{
  "clusterId": "${SR_CLUSTER_ID}",
  "topic": "${BATCH_TOPIC}",
  "maxMessages": 100,
  "timeoutMs": 8000,
  "fromBeginning": true,
  "schemaConfig": {
    "registryUrl": "${SR_REGISTRY_URL}",
    "subject": "${BATCH_SUBJECT}"
  }
}
JSON
)"
  cresp="$(server_post '/api/kafka/consume-once' "$batch_consume_body")"
  cok="$(echo "$cresp" | jq -r '.ok // false')"
  cmsg_count="$(echo "$cresp" | jq '.data.messages | length' 2>/dev/null || echo 0)"
  matching="$(echo "$cresp" | jq --arg rid "${SMOKE_RUN_ID}-batch" '[.data.messages[] | select(.value != null) | select(.value | contains($rid))] | length' 2>/dev/null || echo 0)"

  if [[ "$cok" == "true" && "$matching" -ge 3 ]]; then
    pass "All 3 batch messages decoded — found ${matching} with run_id=${SMOKE_RUN_ID}-batch"
  else
    fail "Expected 3 decodable batch messages, got ${matching} (total consumed: ${cmsg_count})"
  fi
else
  fail "Batch produce failed — response: $resp"
fi

# =============================================================================
# SR12 — Unreachable registry → REGISTRY_UNREACHABLE
# =============================================================================

header "SR12  Unreachable registry → REGISTRY_UNREACHABLE"

unreachable_body="$(cat <<JSON
{
  "clusterId": "${SR_CLUSTER_ID}",
  "topic": "${SMOKE_TOPIC}",
  "messages": [{"value": "{\"run_id\":\"err-test\",\"seq\":0,\"payload\":\"x\"}"}],
  "schemaConfig": {
    "registryUrl": "http://127.0.0.1:19999",
    "subject": "${SMOKE_SUBJECT}"
  }
}
JSON
)"
resp="$(server_post '/api/kafka/produce' "$unreachable_body")"
ok="$(echo "$resp" | jq -r '.ok // false')"
err_code="$(echo "$resp" | jq -r '.error.code // empty')"

if [[ "$ok" == "false" && "$err_code" == "REGISTRY_UNREACHABLE" ]]; then
  pass "Got REGISTRY_UNREACHABLE as expected"
else
  fail "Expected ok=false + REGISTRY_UNREACHABLE, got ok=${ok}, code=${err_code}"
fi

# =============================================================================
# SR13 — Invalid request: missing registryUrl → KAFKA_INVALID_REQUEST
# =============================================================================

header "SR13  Missing registryUrl → KAFKA_INVALID_REQUEST"

invalid_body='{"schemaConfig":{}}'
resp="$(server_post '/api/kafka/schema-subjects' "$invalid_body")"
ok="$(echo "$resp" | jq -r '.ok // false')"
err_code="$(echo "$resp" | jq -r '.error.code // empty')"

if [[ "$ok" == "false" && "$err_code" == "KAFKA_INVALID_REQUEST" ]]; then
  pass "Got KAFKA_INVALID_REQUEST as expected"
else
  fail "Expected ok=false + KAFKA_INVALID_REQUEST, got ok=${ok}, code=${err_code}"
fi

# =============================================================================
# SR14 — Kafka disconnect
# =============================================================================

header "SR14  Kafka disconnect"

disconnect_body="$(printf '{"clusterId":"%s"}' "$SR_CLUSTER_ID")"
resp="$(server_post '/api/kafka/disconnect' "$disconnect_body")"
ok="$(echo "$resp" | jq -r '.ok // false')"

if [[ "$ok" == "true" ]]; then
  pass "Kafka disconnected"
else
  fail "Disconnect failed — response: $resp"
fi

# =============================================================================
# Summary
# =============================================================================

echo ""
echo "────────────────────────────────────────────────────────────"
TOTAL=$((PASS_COUNT + FAIL_COUNT))
if [[ "$FAIL_COUNT" -eq 0 ]]; then
  echo -e "${GREEN}${BOLD}ALL ${TOTAL} SCENARIOS PASSED${RESET}"
else
  echo -e "${BOLD}Results: ${GREEN}${PASS_COUNT} passed${RESET} / ${RED}${FAIL_COUNT} failed${RESET} (${TOTAL} total)"
fi
echo "────────────────────────────────────────────────────────────"

[[ "$FAIL_COUNT" -eq 0 ]]
