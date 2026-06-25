#!/usr/bin/env bash
# Phase 8 — sequential Playwright sweep for all GQL demo lesson specs.
# Usage: ./scripts/phase8-gql-e2e-sweep.sh
# Requires: docker/graphql on 4010; optional tls stacks for gql5; npm run server for gql13.

set -euo pipefail
cd "$(dirname "$0")/.."

TIMEOUT="${PHASE8_E2E_TIMEOUT:-120000}"
FAILED=()
PASSED=()

run_lesson() {
  local n="$1"
  local label="gql${n}"
  echo ""
  echo "========== GQL-${n} =========="
  if npm run "test:e2e:demo:${label}" -- --timeout="${TIMEOUT}" --reporter=list; then
    PASSED+=("GQL-${n}")
  else
    FAILED+=("GQL-${n}")
  fi
}

echo "Phase 8 GQL E2E sweep — timeout ${TIMEOUT}ms per project"
echo "Ensure: npm run dev will start via Playwright webServer (port 5173 free)"

for n in $(seq 1 19); do
  run_lesson "$n"
done

echo ""
echo "========== gql110 (workspace isolation) =========="
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
