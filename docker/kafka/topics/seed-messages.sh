#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/plaintext/docker-compose.yml"

seed() {
  local topic="$1"
  local key="$2"
  local payload="$3"
  local headers="$4"
  local header_args=()
  local header_entry=""

  IFS=',' read -ra header_entries <<< "$headers"
  for header_entry in "${header_entries[@]}"; do
    header_entry="${header_entry//[[:space:]]/}"
    if [[ -z "$header_entry" ]]; then
      continue
    fi
    header_args+=("-H" "${header_entry/=/:}")
  done

  docker compose -f "$COMPOSE_FILE" exec -T redpanda \
    rpk topic produce "$topic" \
    --key "$key" \
    "${header_args[@]}" <<EOF
$payload
EOF
}

seed "orders.created" "customer-123" '{"orderId":"ord-1001","customerId":"customer-123","status":"created","amount":129.5}' "traceId=t-1001,source=seed,env=local"
seed "orders.updated" "customer-123" '{"orderId":"ord-1001","customerId":"customer-123","status":"updated","change":"address"}' "traceId=t-1002,source=seed,env=local"
seed "orders.failed" "customer-456" '{"orderId":"ord-2001","customerId":"customer-456","status":"failed","reason":"payment_declined"}' "traceId=t-2001,source=seed,env=local"
seed "payments.authorized" "customer-123" '{"paymentId":"pay-5001","orderId":"ord-1001","authorized":true,"method":"card"}' "traceId=t-5001,source=seed,env=local"
seed "inventory.adjusted" "sku-100" '{"sku":"sku-100","delta":-1,"reason":"order_allocated"}' "traceId=t-6001,source=seed,env=local"
seed "notifications.email" "customer-123" '{"notificationId":"n-100","type":"email","to":"c123@example.com"}' "traceId=t-7001,source=seed,env=local"
seed "redfireforge.workflow.input" "wf-001" '{"workflowId":"wf-001","event":"start","payload":{"orderId":"ord-1001"}}' "traceId=t-8001,source=seed,env=local"
seed "redfireforge.workflow.output" "wf-001" '{"workflowId":"wf-001","event":"complete","result":"pass"}' "traceId=t-8002,source=seed,env=local"
seed "redfireforge.results.summary" "run-001" '{"runId":"run-001","passed":7,"failed":1,"durationMs":1240}' "traceId=t-9001,source=seed,env=local"
seed "redfireforge.debug.consume" "customer-999" '{"debug":true,"kind":"negative","details":"non-matching payload"}' "traceId=t-9999,source=seed,env=local"

echo "Seed messages complete."
