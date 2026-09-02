#!/usr/bin/env bash
# =============================================================================
# CI gate: fail the build when any bundled demo TLS cert expires within
# FAIL_DAYS days (default 730 = 2 years).
#
# Usage:
#   bash scripts/check-cert-expiry.sh
#
# Exit codes:
#   0 — all certs have > FAIL_DAYS remaining
#   1 — one or more certs are expired or expiring within FAIL_DAYS
#
# GitHub Actions annotations:
#   ::error::  — on hard-fail (< FAIL_DAYS remaining)
# =============================================================================
set -euo pipefail

FAIL_DAYS="${FAIL_DAYS:-730}"

CERTS=(
  "docker/graphql/tls/certs/ca.crt"
  "docker/graphql/tls/certs/server.crt"
  "docker/graphql/tls/certs/client.crt"
  "docker/kafka/tls/certs/ca.crt"
  "docker/kafka/tls/certs/broker.crt"
  "docker/websocket/certs/ca.crt"
  "docker/websocket/certs/server.crt"
  "docker/websocket/certs/client.crt"
  "docker/grpc/certs/ca.crt"
  "docker/grpc/certs/server.crt"
  "docker/grpc/certs/client.crt"
)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

NOW=$(date +%s)
FAIL_SECS=$(( FAIL_DAYS * 86400 ))

any_failed=0

for rel_cert in "${CERTS[@]}"; do
  cert="$REPO_ROOT/$rel_cert"
  if [[ ! -f "$cert" ]]; then
    # gRPC CA not always present — skip missing files
    continue
  fi

  end_date=$(openssl x509 -noout -enddate -in "$cert" 2>/dev/null | cut -d= -f2)
  if [[ -z "$end_date" ]]; then
    echo "::error::Cannot read cert: $rel_cert"
    any_failed=1
    continue
  fi

  expiry_ts=$(date -j -f "%b %d %T %Y %Z" "$end_date" +%s 2>/dev/null \
    || date --date="$end_date" +%s 2>/dev/null)
  remaining_days=$(( (expiry_ts - NOW) / 86400 ))

  if (( remaining_days < FAIL_DAYS )); then
    echo "::error::Cert expiring in ${remaining_days}d (< ${FAIL_DAYS}d threshold): $rel_cert — expires $end_date"
    any_failed=1
  else
    echo "OK  ${remaining_days}d remaining — $rel_cert"
  fi
done

if (( any_failed == 1 )); then
  echo ""
  echo "FAIL: One or more demo TLS certs expire within ${FAIL_DAYS} days."
  echo "Run: bash docker/<stack>/generate-cert.sh FORCE=1 DAYS=3650"
  echo "Then update packages/demo-hub/src/lessons/protocols/ws-tls-demo-certs.ts"
  exit 1
fi

echo ""
echo "All demo TLS certs have > ${FAIL_DAYS} days remaining."
