#!/usr/bin/env bash
# Run a single phase gate without chained regressions.
# Usage: bash scripts/run-grpc-phase-fast.sh 11h
#        npm run test:grpc:fast -- 11h
set -euo pipefail

PHASE="${1:-}"
if [[ -z "$PHASE" ]]; then
  echo "Usage: run-grpc-phase-fast.sh <phase-id>" >&2
  echo "Example: run-grpc-phase-fast.sh 11h  →  test:grpc:phase11h (no regression chain)" >&2
  exit 1
fi

# Normalize: allow 11h or phase11h
PHASE="${PHASE#phase}"

export GRPC_SKIP_REGRESSION=1
echo "=== Fast phase gate: test:grpc:phase${PHASE} (GRPC_SKIP_REGRESSION=1) ==="
echo ""

npm run "test:grpc:phase${PHASE}"
