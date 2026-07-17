#!/usr/bin/env bash
# Run a single phase gate with full chained regressions enabled.
# Usage: bash scripts/run-grpc-phase-full.sh 11h
#        npm run test:grpc:phase:full -- 11h
set -euo pipefail

PHASE="${1:-}"
if [[ -z "$PHASE" ]]; then
  echo "Usage: run-grpc-phase-full.sh <phase-id>" >&2
  echo "Example: run-grpc-phase-full.sh 11h  ->  test:grpc:phase11h (full chain)" >&2
  exit 1
fi

# Normalize: allow 11h or phase11h
PHASE="${PHASE#phase}"

export GRPC_FORCE_TSC=1
echo "=== Full phase gate: test:grpc:phase${PHASE} (GRPC_FORCE_TSC=1) ==="
echo ""

npm run "test:grpc:phase${PHASE}"
