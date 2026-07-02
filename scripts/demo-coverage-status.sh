#!/usr/bin/env bash
# Show demo-hub coverage gaps from the last run — no tests.
#
#   bash scripts/demo-coverage-status.sh
#   bash scripts/demo-coverage-status.sh 10 grpc-first-call
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

LIMIT="${1:-15}"
FILTER="${2:-}"

if [[ ! -f coverage/coverage-final.json ]]; then
  echo "No demo coverage report: coverage/coverage-final.json" >&2
  echo "Run scope: bash scripts/run-demo-coverage-scope.sh packages/demo-hub/src/lessons/protocols/<lesson>.ts" >&2
  echo "Or PR/CI: bash scripts/run-demo-coverage-full.sh" >&2
  exit 1
fi

ARGS=(--limit="$LIMIT")
if [[ -n "$FILTER" ]]; then
  ARGS+=(--filter="$FILTER")
fi

npx tsx scripts/list-top-demo-coverage-gaps.ts "${ARGS[@]}"
