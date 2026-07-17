#!/usr/bin/env bash
# Show product coverage gaps from the last merge — no test run.
#
#   bash scripts/product-coverage-status.sh
#   bash scripts/product-coverage-status.sh 20
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

LIMIT="${1:-15}"

if [[ ! -f coverage/coverage-final.product.json ]]; then
  echo "❌ No merged product report: coverage/coverage-final.product.json" >&2
  echo "   Run a batch:  bash scripts/run-product-coverage-batch.sh features" >&2
  echo "   Or full gate: bash scripts/run-product-coverage-fast.sh  (PR/CI)" >&2
  exit 1
fi

npx tsx scripts/list-top-coverage-gaps.ts --limit="$LIMIT"
