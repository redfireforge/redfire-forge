#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
# shellcheck source=scripts/demo-live-guard-lib.sh
source "$ROOT_DIR/scripts/demo-live-guard-lib.sh"

PORT="${E2E_VITE_PORT:-5173}"
REPORTER="${E2E_REPORTER:-html,list}"

SPECS=(
  "e2e/graphql-subscriptions.spec.ts"
  "e2e/graphql-schema-explorer.spec.ts"
  "e2e/graphql-query-builder.spec.ts"
  "e2e/graphql-collections.spec.ts"
  "e2e/graphql-code-gen.spec.ts"
)

echo "[graphql-e2e-clean] Checking for stale dev server on port ${PORT}..."
if demo_live_guard_blocks_dev_server_reset && [[ "${PORT}" == "5173" ]]; then
  echo "[graphql-e2e-clean] Live demo guard active — leaving port ${PORT} running"
else
  PIDS="$(lsof -ti tcp:"${PORT}" || true)"
  if [[ -n "$PIDS" ]]; then
    echo "[graphql-e2e-clean] Killing stale process(es): $PIDS"
    kill -9 $PIDS || true
  fi
fi

echo "[graphql-e2e-clean] Running GraphQL E2E subset with reporter=${REPORTER}"
set -x
npx playwright test "${SPECS[@]}" --reporter="${REPORTER}" "$@"