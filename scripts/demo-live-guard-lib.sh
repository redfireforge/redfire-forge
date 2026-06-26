#!/usr/bin/env bash
# Shared helpers for E2E scripts — skip :5173 kill while a manual live demo is running.
#
# Usage (source from another script):
#   source "$(dirname "$0")/demo-live-guard-lib.sh"
#   if demo_live_guard_blocks_dev_server_reset; then ...; fi

demo_live_guard_blocks_dev_server_reset() {
  if [[ "${PHASE8_SKIP_SERVER_RESET:-0}" == "1" ]]; then
    echo "[demo-live-guard] PHASE8_SKIP_SERVER_RESET=1 — skip dev-server reset"
    return 0
  fi

  export DEMO_LIVE_GUARD_URL="${DEMO_LIVE_GUARD_URL:-http://localhost:${E2E_VITE_PORT:-5173}/__demo-live-guard}"

  if npx tsx scripts/check-demo-live-guard.ts; then
    return 0
  fi

  return 1
}
