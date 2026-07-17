#!/usr/bin/env bash
# Phase 8 — sequential Playwright sweep for all GQL demo lesson specs.
# Usage: ./scripts/phase8-gql-e2e-sweep.sh
# Requires: docker/graphql on 4010; optional tls stacks for gql5; npm run server for gql13.
#
# Hardening: kills :5173 between lessons (fresh Vite + browser context), disables HMR,
# and sets PHASE8_E2E_SWEEP so specs can clear localStorage on launch.

set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=scripts/demo-live-guard-lib.sh
source "$(dirname "$0")/demo-live-guard-lib.sh"

TIMEOUT="${PHASE8_E2E_TIMEOUT:-120000}"
FAILED=()
PASSED=()

export PHASE8_E2E_SWEEP=1
E2E_VITE_PORT="${E2E_VITE_PORT:-5173}"

reset_dev_server() {
  if demo_live_guard_blocks_dev_server_reset; then
    return 0
  fi
  lsof -ti :"${E2E_VITE_PORT}" | xargs kill -9 2>/dev/null || true
  sleep 1
}

run_lesson() {
  local n="$1"
  local label="gql${n}"
  echo ""
  echo "========== GQL-${n} =========="
  reset_dev_server
  if npm run "test:e2e:demo:${label}" -- --timeout="${TIMEOUT}" --reporter=list; then
    PASSED+=("GQL-${n}")
  else
    FAILED+=("GQL-${n}")
  fi
}

echo "Phase 8 GQL E2E sweep — timeout ${TIMEOUT}ms per project (PHASE8_E2E_SWEEP=1, HMR off)"
echo "Ensure: port ${E2E_VITE_PORT} free before start; Playwright webServer starts fresh per lesson"
echo "Live demo guard: skips :${E2E_VITE_PORT} reset while a manual demo is active — see .cursor/demo-live-guard.json"

for n in $(seq 1 19); do
  run_lesson "$n"
done

echo ""
echo "========== gql110 (workspace isolation) =========="
reset_dev_server
if npm run test:e2e:demo:gql110 -- --timeout="${TIMEOUT}" --reporter=list; then
  PASSED+=("gql110")
else
  FAILED+=("gql110")
fi

echo ""
echo "========== SUMMARY =========="
echo "Passed (${#PASSED[@]}): ${PASSED[*]:-none}"
echo "Failed (${#FAILED[@]}): ${FAILED[*]:-none}"

if ((${#FAILED[@]} > 0)); then
  exit 1
fi
