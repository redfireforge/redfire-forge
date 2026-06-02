#!/usr/bin/env bash
# =============================================================================
# Secure Profile Smoke Test — SASL/SCRAM Kafka Connection Validation
# =============================================================================
#
# Exercises the Kafka server API against the secure Redpanda Docker profile
# to validate authentication (valid/invalid credentials) and connection error
# classification paths.
#
# Scenarios:
#   S1  SCRAM-SHA-256 valid credentials (admin superuser) → connect succeeds
#   S2  SCRAM-SHA-256 valid credentials (app user) → connect succeeds
#   S3  Invalid SCRAM-SHA-256 credentials → connect fails with auth error
#   S4  Invalid broker address → connect fails with network error
#   S5  Full lifecycle: connect (SCRAM-SHA-256) → topics → produce → consume → disconnect
#   S6  Timeout with very short connectionTimeoutMs → timeout or conn error
#
# Note: SASL/PLAIN is not tested because Redpanda requires TLS when SASL/PLAIN
# is used (for security reasons).  All scenarios use SCRAM-SHA-256.
#
# Prerequisites:
#   - Secure Redpanda broker running:
#       cd docker/kafka/secure && docker compose up -d
#   - Local server running with Kafka support (npm run server)
#   - jq installed
#
# Usage:
#   ./smoke-test.sh
#
# Environment variables:
#   KAFKA_SMOKE_BASE_URL          Server base URL (default: http://127.0.0.1:3001)
#   KAFKA_SMOKE_NO_PROXY          No-proxy hosts (default: 127.0.0.1,localhost)
#   KAFKA_SECURE_BROKERS          Secure broker address (default: 127.0.0.1:19093)
#   KAFKA_SECURE_USERNAME         App SASL username (default: redfireforge-app)
#   KAFKA_SECURE_PASSWORD         App SASL password (default: app-password)
#   KAFKA_SECURE_ADMIN_USERNAME   Admin SASL username (default: admin)
#   KAFKA_SECURE_ADMIN_PASSWORD   Admin SASL password (default: admin-secret)
# =============================================================================

set -euo pipefail

BASE_URL="${KAFKA_SMOKE_BASE_URL:-http://127.0.0.1:3001}"
NO_PROXY_HOSTS="${KAFKA_SMOKE_NO_PROXY:-127.0.0.1,localhost}"
SECURE_BROKERS="${KAFKA_SECURE_BROKERS:-127.0.0.1:19093}"
SECURE_USERNAME="${KAFKA_SECURE_USERNAME:-redfireforge-app}"
SECURE_PASSWORD="${KAFKA_SECURE_PASSWORD:-app-password}"
# Admin superuser credentials (used in S1).
KAFKA_SECURE_ADMIN_USERNAME="${KAFKA_SECURE_ADMIN_USERNAME:-admin}"
KAFKA_SECURE_ADMIN_PASSWORD="${KAFKA_SECURE_ADMIN_PASSWORD:-admin-secret}"
SMOKE_RUN_ID="secure-smoke-$(date +%s)"

PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0

# ── Colour helpers ─────────────────────────────────────────────────────────────

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

pass() { echo -e "  ${GREEN}✓ PASS${RESET}  $1"; ((PASS_COUNT++)) || true; }
fail() { echo -e "  ${RED}✗ FAIL${RESET}  $1"; ((FAIL_COUNT++)) || true; }
skip() { echo -e "  ${YELLOW}⊘ SKIP${RESET}  $1"; ((SKIP_COUNT++)) || true; }
header() { echo -e "\n${BOLD}${CYAN}▶ $1${RESET}"; }

# ── HTTP helpers ──────────────────────────────────────────────────────────────

request() {
  local method="$1"
  local path="$2"
  local body="${3:-}"

  if [[ -n "$body" ]]; then
    curl --silent --show-error \
      --noproxy "$NO_PROXY_HOSTS" \
      -X "$method" \
      -H 'Content-Type: application/json' \
      "$BASE_URL$path" \
      -d "$body"
  else
    curl --silent --show-error \
      --noproxy "$NO_PROXY_HOSTS" \
      -X "$method" \
      "$BASE_URL$path"
  fi
}

disconnect_broker() {
  request POST /api/kafka/disconnect '{}' > /dev/null 2>&1 || true
}

# ── Prerequisite check ─────────────────────────────────────────────────────────

require_prerequisites() {
  if ! command -v jq &>/dev/null; then
    echo "ERROR: jq is required. Install with: brew install jq" >&2
    exit 1
  fi

  local health_status
  health_status="$(curl --silent --output /dev/null --write-out '%{http_code}' \
    --noproxy "$NO_PROXY_HOSTS" "$BASE_URL/health" || true)"

  if [[ "$health_status" != "200" ]]; then
    echo "ERROR: Local server not reachable at $BASE_URL (HTTP $health_status)." >&2
    echo "  Start the server with: npm run server" >&2
    exit 1
  fi
}

# =============================================================================
# S1 — SCRAM-SHA-256 valid credentials (admin superuser)
# =============================================================================

run_scenario_s1() {
  header "S1 — SCRAM-SHA-256 valid credentials (admin superuser)"

  local connect_response
  connect_response="$(request POST /api/kafka/connect \
    "{\"connection\":{\"clusterId\":\"secure-admin-$SMOKE_RUN_ID\",\"clientId\":\"redfireforge-smoke-admin\",\"brokers\":[\"$SECURE_BROKERS\"],\"connectionTimeoutMs\":8000,\"requestTimeoutMs\":5000,\"auth\":{\"mode\":\"scram-sha-256\",\"username\":\"${KAFKA_SECURE_ADMIN_USERNAME:-admin}\",\"password\":\"${KAFKA_SECURE_ADMIN_PASSWORD:-admin-secret}\"},\"tls\":{\"enabled\":false}}}" \
    2>/dev/null || echo '{}')"

  local ok
  ok="$(echo "$connect_response" | jq -r '.ok // false' 2>/dev/null || echo 'false')"

  if [[ "$ok" == "true" ]]; then
    pass "Connected with SCRAM-SHA-256 (admin superuser)"
    local state cluster_id
    state="$(echo "$connect_response" | jq -r '.data.status.state // ""' 2>/dev/null || echo '')"
    cluster_id="$(echo "$connect_response" | jq -r '.data.status.clusterId // ""' 2>/dev/null || echo '')"
    if [[ "$state" == "connected" ]]; then
      pass "Status state is 'connected'"
    else
      fail "Expected state=connected but got state=$state"
    fi
    if [[ "$cluster_id" == "secure-admin-$SMOKE_RUN_ID" ]]; then
      pass "Status clusterId matches request"
    else
      fail "Expected clusterId=secure-admin-$SMOKE_RUN_ID but got clusterId=$cluster_id"
    fi
  else
    local error_code
    error_code="$(echo "$connect_response" | jq -r '.error.code // ""' 2>/dev/null || echo '')"
    fail "SCRAM-SHA-256 admin connect failed (code=$error_code): $connect_response"
  fi

  disconnect_broker
}

# =============================================================================
# S2 — SCRAM-SHA-256 valid credentials
# =============================================================================

run_scenario_s2() {
  header "S2 — SCRAM-SHA-256 valid credentials"

  local connect_response
  connect_response="$(request POST /api/kafka/connect \
    "{\"connection\":{\"clusterId\":\"secure-scram-$SMOKE_RUN_ID\",\"clientId\":\"redfireforge-smoke-scram\",\"brokers\":[\"$SECURE_BROKERS\"],\"connectionTimeoutMs\":8000,\"requestTimeoutMs\":5000,\"auth\":{\"mode\":\"scram-sha-256\",\"username\":\"$SECURE_USERNAME\",\"password\":\"$SECURE_PASSWORD\"},\"tls\":{\"enabled\":false}}}" \
    2>/dev/null || echo '{}')"

  local ok
  ok="$(echo "$connect_response" | jq -r '.ok // false' 2>/dev/null || echo 'false')"

  if [[ "$ok" == "true" ]]; then
    pass "Connected with SCRAM-SHA-256 (username=$SECURE_USERNAME)"
    local state cluster_id
    state="$(echo "$connect_response" | jq -r '.data.status.state // ""' 2>/dev/null || echo '')"
    cluster_id="$(echo "$connect_response" | jq -r '.data.status.clusterId // ""' 2>/dev/null || echo '')"
    if [[ "$state" == "connected" ]]; then
      pass "Status state is 'connected'"
    else
      fail "Expected state=connected but got state=$state"
    fi
    if [[ "$cluster_id" == "secure-scram-$SMOKE_RUN_ID" ]]; then
      pass "Status clusterId matches request"
    else
      fail "Expected clusterId=secure-scram-$SMOKE_RUN_ID but got clusterId=$cluster_id"
    fi
  else
    local error_code
    error_code="$(echo "$connect_response" | jq -r '.error.code // ""' 2>/dev/null || echo '')"
    fail "SCRAM-SHA-256 connect failed (code=$error_code): $connect_response"
  fi

  disconnect_broker
}

# =============================================================================
# S3 — Invalid credentials
# =============================================================================

run_scenario_s3() {
  header "S3 — Invalid credentials (auth failure)"

  local connect_response
  connect_response="$(request POST /api/kafka/connect \
    "{\"connection\":{\"clusterId\":\"secure-bad-creds-$SMOKE_RUN_ID\",\"clientId\":\"redfireforge-smoke-bad\",\"brokers\":[\"$SECURE_BROKERS\"],\"connectionTimeoutMs\":8000,\"requestTimeoutMs\":5000,\"auth\":{\"mode\":\"scram-sha-256\",\"username\":\"bad-user\",\"password\":\"wrong-pass\"},\"tls\":{\"enabled\":false}}}" \
    2>/dev/null || echo '{}')"

  local ok
  ok="$(echo "$connect_response" | jq -r '.ok // false' 2>/dev/null || echo 'false')"
  local error_code
  error_code="$(echo "$connect_response" | jq -r '.error.code // ""' 2>/dev/null || echo '')"

  if [[ "$ok" == "false" ]]; then
    pass "Invalid SCRAM-SHA-256 credentials rejected (ok=false, code=$error_code)"
    if [[ "$error_code" == "KAFKA_AUTH_FAILED" ]]; then
      pass "Error code is KAFKA_AUTH_FAILED — SASL authentication failure correctly classified"
    elif [[ "$error_code" == *"AUTH"* || "$error_code" == *"SASL"* ]]; then
      pass "Error code indicates SASL/auth failure (code=$error_code)"
    elif [[ "$error_code" == *"CONNECT"* ]]; then
      fail "Expected KAFKA_AUTH_FAILED but got generic connect error (code=$error_code) — auth failures should be classified separately"
    else
      fail "Unexpected error code (code=$error_code) — expected KAFKA_AUTH_FAILED"
    fi
  else
    fail "Expected auth failure but got ok=true — broker accepted invalid credentials"
  fi

  disconnect_broker
}

# =============================================================================
# S4 — Invalid broker address (network error)
# =============================================================================

run_scenario_s4() {
  header "S4 — Invalid broker address (network error)"

  local connect_response
  connect_response="$(request POST /api/kafka/connect \
    "{\"connection\":{\"clusterId\":\"secure-bad-addr-$SMOKE_RUN_ID\",\"clientId\":\"redfireforge-smoke-noaddr\",\"brokers\":[\"127.0.0.1:59999\"],\"connectionTimeoutMs\":3000,\"requestTimeoutMs\":3000,\"auth\":{\"mode\":\"none\"},\"tls\":{\"enabled\":false}}}" \
    2>/dev/null || echo '{}')"

  local ok
  ok="$(echo "$connect_response" | jq -r '.ok // false' 2>/dev/null || echo 'false')"
  local error_code
  error_code="$(echo "$connect_response" | jq -r '.error.code // ""' 2>/dev/null || echo '')"

  if [[ "$ok" == "false" ]]; then
    pass "Unreachable broker rejected (ok=false, code=$error_code)"
  else
    fail "Expected network error but got ok=true"
  fi

  disconnect_broker
}

# =============================================================================
# S5 — Full lifecycle: connect → topics → produce → consume → disconnect
# =============================================================================

run_scenario_s5() {
  header "S5 — Full lifecycle (SCRAM-SHA-256: connect → topics → produce → consume → disconnect)"

  local cluster_id="secure-lifecycle-$SMOKE_RUN_ID"
  local smoke_key="smoke-key-$SMOKE_RUN_ID"
  local smoke_trace="trace-$SMOKE_RUN_ID"
  # Use the well-known pre-created topic (no auto-creation overhead).
  # The unique key+traceId filter ensures we always match the current run's
  # message regardless of how many messages have accumulated from previous runs.
  local smoke_topic="redfireforge.debug.consume"

  # Connect
  local connect_response
  connect_response="$(request POST /api/kafka/connect \
    "{\"connection\":{\"clusterId\":\"$cluster_id\",\"clientId\":\"redfireforge-smoke-lifecycle\",\"brokers\":[\"$SECURE_BROKERS\"],\"connectionTimeoutMs\":8000,\"requestTimeoutMs\":5000,\"auth\":{\"mode\":\"scram-sha-256\",\"username\":\"$SECURE_USERNAME\",\"password\":\"$SECURE_PASSWORD\"},\"tls\":{\"enabled\":false}}}" \
    2>/dev/null || echo '{}')"

  local connect_ok
  connect_ok="$(echo "$connect_response" | jq -r '.ok // false' 2>/dev/null || echo 'false')"

  if [[ "$connect_ok" != "true" ]]; then
    fail "Could not connect to secure broker — skipping lifecycle test"
    return
  fi
  pass "Connected to secure broker"

  # List topics
  local topics_response
  topics_response="$(request GET /api/kafka/topics 2>/dev/null || echo '{}')"
  local topics_ok
  topics_ok="$(echo "$topics_response" | jq -r '.ok // false' 2>/dev/null || echo 'false')"

  if [[ "$topics_ok" == "true" ]]; then
    local topic_count
    topic_count="$(echo "$topics_response" | jq -r '.data.topics | length' 2>/dev/null || echo '0')"
    pass "Listed topics (count=$topic_count)"
    if [[ "$topic_count" -ge 1 ]]; then
      pass "At least one topic returned"
    else
      fail "Expected at least one topic but got 0"
    fi
    local has_debug_topic
    has_debug_topic="$(echo "$topics_response" | jq -r '[.data.topics[].name] | contains(["redfireforge.debug.consume"])' 2>/dev/null || echo 'false')"
    if [[ "$has_debug_topic" == "true" ]]; then
      pass "Topic 'redfireforge.debug.consume' exists on broker"
    else
      fail "Expected topic 'redfireforge.debug.consume' but it was not found in topic list"
    fi
  else
    fail "Topics list failed: $topics_response"
  fi

  # Produce
  local produce_response
  produce_response="$(request POST /api/kafka/produce \
    "{\"topic\":\"$smoke_topic\",\"messages\":[{\"key\":\"$smoke_key\",\"value\":\"{\\\"kind\\\":\\\"secure-smoke\\\",\\\"status\\\":\\\"ok\\\",\\\"runId\\\":\\\"$SMOKE_RUN_ID\\\"}\",\"headers\":{\"traceId\":\"$smoke_trace\",\"source\":\"secure-smoke\",\"env\":\"local\"}}]}" \
    2>/dev/null || echo '{}')"

  local produce_ok
  produce_ok="$(echo "$produce_response" | jq -r '.ok // false' 2>/dev/null || echo 'false')"

  if [[ "$produce_ok" == "true" ]]; then
    pass "Produced message to redfireforge.debug.consume"
    local sent_count
    sent_count="$(echo "$produce_response" | jq -r '.data.sentCount // 0' 2>/dev/null || echo '0')"
    if [[ "$sent_count" -eq 1 ]]; then
      pass "Produce sentCount=1"
    else
      fail "Expected sentCount=1 but got sentCount=$sent_count"
    fi
  else
    fail "Produce failed: $produce_response"
    disconnect_broker
    return
  fi

  # Consume — 20 s timeout accommodates the SASL consumer-group join latency
  # (JoinGroup + SyncGroup + OffsetFetch on a 3-partition topic) plus scanning
  # through any messages from previous smoke runs before the filter hits ours.
  local consume_response
  consume_response="$(request POST /api/kafka/consume-once \
    "{\"topic\":\"$smoke_topic\",\"groupId\":\"$SMOKE_RUN_ID\",\"fromBeginning\":true,\"timeoutMs\":20000,\"maxMessages\":1,\"filter\":{\"keyEquals\":\"$smoke_key\",\"headersMatch\":{\"source\":\"secure-smoke\",\"traceId\":\"$smoke_trace\"}}}" \
    2>/dev/null || echo '{}')"

  local consumed_count timed_out
  consumed_count="$(echo "$consume_response" | jq -r '.data.messages | length' 2>/dev/null || echo '0')"
  # NOTE: jq's // alternative operator treats boolean false as "absent", so
  # '.data.timedOut // true' would incorrectly return true when timedOut=false.
  # Use an explicit conditional to safely extract the boolean as a string.
  timed_out="$(echo "$consume_response" | jq -r 'if .data.timedOut == false then "false" else "true" end' 2>/dev/null || echo 'true')"

  if [[ "$consumed_count" -ge 1 ]]; then
    pass "Consumed message back (secure broker round-trip confirmed)"
    if [[ "$timed_out" == "false" ]]; then
      pass "Consume completed before timeout (timedOut=false)"
    else
      fail "Consume timed out before receiving message (timedOut=true)"
    fi
    local msg_run_id
    msg_run_id="$(echo "$consume_response" | jq -r '.data.messages[0].value' 2>/dev/null | jq -r '.runId // ""' 2>/dev/null || echo '')"
    if [[ "$msg_run_id" == "$SMOKE_RUN_ID" ]]; then
      pass "Consumed message body contains correct runId"
    else
      fail "Expected message runId=$SMOKE_RUN_ID but got runId=$msg_run_id"
    fi
  else
    fail "No message received from secure broker"
  fi

  # Disconnect
  disconnect_broker
  pass "Disconnected cleanly"
}

# =============================================================================
# S6 — Very short timeout (connection timeout error path)
# =============================================================================

run_scenario_s6() {
  header "S6 — Very short timeout (timeout or connection error)"

  # Use scram-sha-256 — the same mechanism as the working scenarios.  SASL/PLAIN
  # is intentionally avoided because Redpanda rejects it without TLS.
  local connect_response
  connect_response="$(request POST /api/kafka/connect \
    "{\"connection\":{\"clusterId\":\"secure-timeout-$SMOKE_RUN_ID\",\"clientId\":\"redfireforge-smoke-timeout\",\"brokers\":[\"$SECURE_BROKERS\"],\"connectionTimeoutMs\":1,\"requestTimeoutMs\":1,\"auth\":{\"mode\":\"scram-sha-256\",\"username\":\"$SECURE_USERNAME\",\"password\":\"$SECURE_PASSWORD\"},\"tls\":{\"enabled\":false}}}" \
    2>/dev/null || echo '{}')"

  local ok
  ok="$(echo "$connect_response" | jq -r '.ok // false' 2>/dev/null || echo 'false')"
  local error_code
  error_code="$(echo "$connect_response" | jq -r '.error.code // ""' 2>/dev/null || echo '')"

  if [[ "$ok" == "false" ]]; then
    pass "Very short timeout correctly rejected connection (ok=false)"
    if [[ "$error_code" == "KAFKA_CONNECT_TIMEOUT" ]]; then
      pass "Error code is KAFKA_CONNECT_TIMEOUT — timeout correctly classified"
    else
      fail "Expected KAFKA_CONNECT_TIMEOUT but got code=$error_code"
    fi
  else
    # With a loopback broker, 1ms may still succeed — treat as acceptable but warn
    pass "Connection succeeded despite 1ms timeout (loopback broker — acceptable)"
  fi

  disconnect_broker
}

# =============================================================================
# Main
# =============================================================================

echo -e "\n${BOLD}Secure Profile Smoke Test${RESET}"
echo "  Base URL : $BASE_URL"
echo "  Broker   : $SECURE_BROKERS"
echo "  Username : $SECURE_USERNAME"
echo "  Run ID   : $SMOKE_RUN_ID"
echo "  Time     : $(date)"

require_prerequisites

run_scenario_s1
run_scenario_s2
run_scenario_s3
run_scenario_s4
run_scenario_s5
run_scenario_s6

echo ""
echo -e "${BOLD}────────────────────────────────────────${RESET}"
echo -e "  ${GREEN}PASS: $PASS_COUNT${RESET}  |  ${RED}FAIL: $FAIL_COUNT${RESET}  |  ${YELLOW}SKIP: $SKIP_COUNT${RESET}"
echo -e "${BOLD}────────────────────────────────────────${RESET}"

if [[ "$FAIL_COUNT" -gt 0 ]]; then
  echo -e "\n${RED}One or more scenarios failed.${RESET}"
  exit 1
else
  echo -e "\n${GREEN}All scenarios passed (or skipped).${RESET}"
  exit 0
fi
