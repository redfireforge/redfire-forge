#!/usr/bin/env bash
# =============================================================================
# UI Test Seed — Create Topics & Seed Messages for Manual Test Scenarios
# =============================================================================
#
# Seeds the Redpanda broker with all topics and messages required by the
# test-scenario MD files:
#   - kafka-message-studio-test-scenarios.md
#   - kafka-topic-explorer-test-scenarios.md
#   - kafka-settings-test-scenarios.md
#
# This script uses `rpk` inside the running Docker container, so no local
# Kafka CLI tools are needed.
#
# Prerequisites:
#   - Plaintext Redpanda broker running:
#       cd docker/kafka/plaintext && docker compose up -d
#       (Wait for healthcheck to pass)
#
# Usage:
#   ./ui-test-seed.sh                    # seed plaintext broker (default)
#   ./ui-test-seed.sh --profile secure   # seed secure broker (SASL topics)
#
# Environment variables:
#   UI_SEED_COMPOSE_FILE    Override docker-compose.yml path
#   UI_SEED_CONTAINER       Override container name
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KAFKA_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# ── Colour helpers ───────────────────────────────────────────────────────────

GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
YELLOW='\033[0;33m'
BOLD='\033[1m'
RESET='\033[0m'

info()  { echo -e "  ${CYAN}▸${RESET} $1"; }
ok()    { echo -e "  ${GREEN}✓${RESET} $1"; }
warn()  { echo -e "  ${YELLOW}⚠${RESET} $1"; }
fail()  { echo -e "  ${RED}✗${RESET} $1" >&2; }

# ── Profile selection ────────────────────────────────────────────────────────

PROFILE="plaintext"
if [[ "${1:-}" == "--profile" && -n "${2:-}" ]]; then
  PROFILE="$2"
fi

case "$PROFILE" in
  plaintext)
    COMPOSE_FILE="${UI_SEED_COMPOSE_FILE:-$KAFKA_DIR/plaintext/docker-compose.yml}"
    CONTAINER="${UI_SEED_CONTAINER:-redfireforge-redpanda}"
    RPK_PREFIX=""
    ;;
  secure)
    COMPOSE_FILE="${UI_SEED_COMPOSE_FILE:-$KAFKA_DIR/secure/docker-compose.yml}"
    CONTAINER="${UI_SEED_CONTAINER:-redfireforge-redpanda-secure}"
    RPK_PREFIX="-X user=admin -X pass=admin-secret -X sasl.mechanism=SCRAM-SHA-256"
    ;;
  *)
    fail "Unknown profile: $PROFILE (expected: plaintext or secure)"
    exit 1
    ;;
esac

echo -e "\n${BOLD}UI Test Seed — Profile: ${PROFILE}${RESET}"
echo "  Compose file : $COMPOSE_FILE"
echo "  Container    : $CONTAINER"

# ── Verify container is running ──────────────────────────────────────────────

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  fail "Container '${CONTAINER}' is not running."
  echo "  Start it with:"
  echo "    cd docker/kafka/${PROFILE} && docker compose up -d"
  exit 1
fi

ok "Container '${CONTAINER}' is running"

# ── Helper functions ─────────────────────────────────────────────────────────

rpk_cmd() {
  if [[ -n "$RPK_PREFIX" ]]; then
    # shellcheck disable=SC2086
    docker exec "$CONTAINER" rpk $RPK_PREFIX "$@"
  else
    docker exec "$CONTAINER" rpk "$@"
  fi
}

create_topic() {
  local topic="$1"
  local partitions="${2:-1}"
  if rpk_cmd topic create "$topic" --partitions "$partitions" 2>/dev/null; then
    ok "Created topic: $topic (partitions=$partitions)"
  else
    warn "Topic '$topic' may already exist (skipped)"
  fi
}

SEED_COUNT=0

produce_message() {
  local topic="$1"
  local key="$2"
  local value="$3"
  local headers="${4:-}"
  local header_args=()

  if [[ -n "$headers" ]]; then
    IFS=',' read -ra header_entries <<< "$headers"
    for entry in "${header_entries[@]}"; do
      entry="${entry//[[:space:]]/}"
      [[ -z "$entry" ]] && continue
      header_args+=("-H" "${entry/=/:}")
    done
  fi

  if echo "$value" | rpk_cmd topic produce "$topic" --key "$key" "${header_args[@]}" 2>/dev/null; then
    ((SEED_COUNT++)) || true
  else
    fail "Failed to produce to $topic (key=$key)"
  fi
}

# =============================================================================
# Step 1: Create Topics
# =============================================================================

echo -e "\n${BOLD}${CYAN}Step 1: Creating topics${RESET}"

# Core domain topics (used by Message Studio + Topic Explorer)
create_topic "orders.created" 3
create_topic "orders.updated" 3
create_topic "orders.failed" 1
create_topic "payments.authorized" 1
create_topic "inventory.adjusted" 3
create_topic "notifications.email" 1

# RedfireForge internal topics
create_topic "redfireforge.workflow.input" 1
create_topic "redfireforge.workflow.output" 1
create_topic "redfireforge.results.summary" 3
create_topic "redfireforge.debug.consume" 3

# Extra topics for Topic Explorer filter tests (TE-06 domain chip, TE-09 search)
create_topic "payments.refunded" 1
create_topic "shipping.dispatched" 1
create_topic "shipping.delivered" 1
create_topic "audit.login" 1
create_topic "audit.permission-change" 1

# Topic for Message Studio template tests (MS-09)
create_topic "test.templates" 1

# =============================================================================
# Step 2: Seed Messages
# =============================================================================

echo -e "\n${BOLD}${CYAN}Step 2: Seeding messages${RESET}"

# ── orders.created (3 messages for Topic Explorer TE-14, TE-17) ──────────────
produce_message "orders.created" "customer-123" \
  '{"orderId":"ord-1001","customerId":"customer-123","status":"created","amount":129.50,"currency":"USD"}' \
  "traceId=t-1001,source=seed,env=local,region=us-east"

produce_message "orders.created" "customer-456" \
  '{"orderId":"ord-1002","customerId":"customer-456","status":"created","amount":89.99,"currency":"EUR"}' \
  "traceId=t-1002,source=seed,env=local,region=eu-west"

produce_message "orders.created" "customer-789" \
  '{"orderId":"ord-1003","customerId":"customer-789","status":"created","amount":250.00,"currency":"USD"}' \
  "traceId=t-1003,source=seed,env=local,region=us-east"

# ── orders.updated ───────────────────────────────────────────────────────────
produce_message "orders.updated" "customer-123" \
  '{"orderId":"ord-1001","customerId":"customer-123","status":"updated","change":"address"}' \
  "traceId=t-1004,source=seed,env=local"

# ── orders.failed ────────────────────────────────────────────────────────────
produce_message "orders.failed" "customer-456" \
  '{"orderId":"ord-2001","customerId":"customer-456","status":"failed","reason":"payment_declined"}' \
  "traceId=t-2001,source=seed,env=local"

# ── payments.authorized (MS-01 consume test) ─────────────────────────────────
produce_message "payments.authorized" "customer-123" \
  '{"paymentId":"pay-5001","orderId":"ord-1001","authorized":true,"method":"card","amount":129.50}' \
  "traceId=t-5001,source=seed,env=local"

# ── payments.refunded ────────────────────────────────────────────────────────
produce_message "payments.refunded" "customer-456" \
  '{"paymentId":"pay-5002","orderId":"ord-2001","refunded":true,"amount":89.99,"reason":"customer_request"}' \
  "traceId=t-5002,source=seed,env=local"

# ── inventory.adjusted ───────────────────────────────────────────────────────
produce_message "inventory.adjusted" "sku-100" \
  '{"sku":"sku-100","delta":-1,"reason":"order_allocated","warehouse":"WH-01"}' \
  "traceId=t-6001,source=seed,env=local"

produce_message "inventory.adjusted" "sku-200" \
  '{"sku":"sku-200","delta":5,"reason":"restock","warehouse":"WH-02"}' \
  "traceId=t-6002,source=seed,env=local"

# ── notifications.email ──────────────────────────────────────────────────────
produce_message "notifications.email" "customer-123" \
  '{"notificationId":"n-100","type":"email","to":"c123@example.com","subject":"Order Confirmed"}' \
  "traceId=t-7001,source=seed,env=local"

# ── shipping.dispatched ──────────────────────────────────────────────────────
produce_message "shipping.dispatched" "order-1001" \
  '{"orderId":"ord-1001","carrier":"FedEx","trackingId":"FX-123456","eta":"2026-06-10"}' \
  "traceId=t-7501,source=seed,env=local"

# ── redfireforge.workflow.input (workflow node tests) ────────────────────────
produce_message "redfireforge.workflow.input" "wf-001" \
  '{"workflowId":"wf-001","event":"start","payload":{"orderId":"ord-1001"}}' \
  "traceId=t-8001,source=seed,env=local"

# ── redfireforge.workflow.output ─────────────────────────────────────────────
produce_message "redfireforge.workflow.output" "wf-001" \
  '{"workflowId":"wf-001","event":"complete","result":"pass","durationMs":450}' \
  "traceId=t-8002,source=seed,env=local"

# ── redfireforge.results.summary ─────────────────────────────────────────────
produce_message "redfireforge.results.summary" "run-001" \
  '{"runId":"run-001","passed":7,"failed":1,"durationMs":1240,"env":"local"}' \
  "traceId=t-9001,source=seed,env=local"

# ── redfireforge.debug.consume (smoke test topic, filter tests) ──────────────
produce_message "redfireforge.debug.consume" "customer-999" \
  '{"debug":true,"kind":"negative","details":"non-matching payload"}' \
  "traceId=t-9999,source=seed,env=local"

produce_message "redfireforge.debug.consume" "customer-100" \
  '{"debug":true,"kind":"positive","details":"matching payload for filter test"}' \
  "traceId=t-10000,source=seed,env=local,filterTag=match"

# ── Multiple messages for Topic Explorer message browsing (TE-14, TE-15) ─────
for i in $(seq 1 5); do
  produce_message "orders.created" "bulk-customer-$i" \
    "{\"orderId\":\"ord-bulk-$i\",\"customerId\":\"bulk-customer-$i\",\"status\":\"created\",\"amount\":$((i * 25)).00}" \
    "traceId=t-bulk-$i,source=bulk-seed,env=local,batch=ui-test"
done

# =============================================================================
# Summary
# =============================================================================

echo ""
echo -e "${BOLD}────────────────────────────────────────${RESET}"
echo -e "  ${GREEN}Topics created: 16${RESET}"
echo -e "  ${GREEN}Messages seeded: ${SEED_COUNT}${RESET}"
echo -e "${BOLD}────────────────────────────────────────${RESET}"
echo ""
echo -e "Next steps:"
echo "  1. Start the RedfireForge server:  ${CYAN}npm run server${RESET}"
echo "  2. Start the web UI:               ${CYAN}npm run dev${RESET}"
echo "  3. Open http://localhost:5173"
echo "  4. Navigate to Protocols → Kafka → configure cluster (broker: 127.0.0.1:19092)"
echo "  5. Follow the test-scenario MD files in docs/plan/future/kafka/test-scenarios/"
echo ""
echo -e "${GREEN}UI test seed complete.${RESET}"
