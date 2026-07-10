#!/usr/bin/env bash
# PR / CI product coverage gate — runs all four batches (~15–20 min).
#
# Day-to-day (identify gaps + fix one area):
#   bash scripts/product-coverage-status.sh
#   npx tsx scripts/coverage-gap-lines.ts <file-substring>
#   bash scripts/run-product-coverage-file.sh <source-file.ts>
#   bash scripts/run-product-coverage-batch.sh <shared|features|app|server> [paths...]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck source=scripts/product-coverage-lib.sh
source "$ROOT/scripts/product-coverage-lib.sh"

mkdir -p coverage/.tmp coverage/batches
product_coverage_ensure_batch_dirs

run_batch() {
  local name="$1"
  shift
  echo "▶ coverage batch: $name"
  set +e
  product_coverage_run_vitest_batch "$name" 0 "$@"
  local batch_exit=$?
  set -e
  if [[ "$batch_exit" -ne 0 ]]; then
    echo "⚠ batch ${name} had test failures — keeping partial coverage"
  fi
  return 0
}

run_batch shared src/shared
run_batch features src/features
run_batch app src/app src/data src/engine src/config src/test-utils src/suppressResizeObserverError.test.ts
run_batch server src-server cli

npx tsx scripts/merge-product-coverage-batches.ts
npx tsx scripts/product-coverage-filter.ts
npx tsx scripts/list-top-coverage-gaps.ts --limit=10

echo ""
echo "▶ product coverage verify (incl. workflow, shared, engine)"
npx tsx scripts/verify-product-coverage-gaps.ts

echo ""
echo "▶ monolith check"
product_coverage_check_monolithic
