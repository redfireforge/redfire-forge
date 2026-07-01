#!/usr/bin/env bash
# Faster product coverage: directory batches merged into one gate report.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

mkdir -p coverage/.tmp coverage/batches

run_batch() {
  local name="$1"
  shift
  echo "▶ coverage batch: $name"
  npx vitest run --project product --coverage \
    --maxWorkers=1 --no-file-parallelism \
    --coverage.clean=false \
    --coverage.reportOnFailure=true \
    --coverage.reportsDirectory="coverage/batches/$name" \
    "$@" || echo "⚠ batch $name had test failures — keeping partial coverage"
}

run_batch shared src/shared
run_batch features src/features
run_batch app src/app src/data src/engine src/config
run_batch server src-server cli

npx tsx scripts/merge-product-coverage-batches.ts
npx tsx scripts/product-coverage-filter.ts
npx tsx scripts/list-top-coverage-gaps.ts --limit=10
