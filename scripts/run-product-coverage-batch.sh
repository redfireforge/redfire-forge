#!/usr/bin/env bash
# Run ONE product coverage batch, merge with existing batch reports, refresh gap list.
#
# Day-to-day dev loop (minutes, not ~20 min full suite):
#   bash scripts/run-product-coverage-batch.sh features
#   bash scripts/run-product-coverage-batch.sh features src/features/grpc/data/
#
# PR / CI full gate (all four batches):
#   bash scripts/run-product-coverage-fast.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck source=scripts/product-coverage-lib.sh
source "$ROOT/scripts/product-coverage-lib.sh"

BATCH="${1:?Usage: $0 <shared|features|app|server> [vitest paths...]}"
shift

case "$BATCH" in
  shared|features|app|server) ;;
  *)
    echo "❌ Unknown batch: $BATCH (use shared, features, app, or server)" >&2
    exit 1
    ;;
esac

mkdir -p coverage/.tmp "coverage/batches/$BATCH/.tmp"
product_coverage_warn_stale_batches "$BATCH"

if [[ "$#" -gt 0 ]]; then
  TEST_PATHS=("$@")
else
  read -r -a TEST_PATHS <<< "$(product_coverage_batch_default_paths "$BATCH")"
fi

echo "▶ coverage batch: $BATCH (${TEST_PATHS[*]})"
set +e
npx vitest run --project product --coverage \
  --maxWorkers=1 --no-file-parallelism \
  --coverage.clean=false \
  --coverage.reportOnFailure=true \
  --coverage.reportsDirectory="coverage/batches/$BATCH" \
  "${TEST_PATHS[@]}"
BATCH_EXIT=$?
set -e
if [[ "$BATCH_EXIT" -ne 0 ]]; then
  echo "⚠ batch $BATCH had test failures (exit $BATCH_EXIT) — keeping partial coverage"
fi

npx tsx scripts/merge-product-coverage-batches.ts
npx tsx scripts/product-coverage-filter.ts

LIMIT="${PRODUCT_COVERAGE_GAP_LIMIT:-10}"
npx tsx scripts/list-top-coverage-gaps.ts --limit="$LIMIT"

echo ""
echo "✅ Batch merge complete. For one-file details:"
echo "   npx tsx scripts/coverage-gap-lines.ts <file-substring>"
  echo "ℹ  Full 4-batch gate — PR/CI only: bash scripts/run-product-coverage-fast.sh"

exit "$BATCH_EXIT"
