#!/usr/bin/env bash
# PR / CI demo-hub coverage gate — runs the full demo Vitest project with coverage.
#
# Day-to-day: fix only what you touch
#   bash scripts/run-demo-coverage-file.sh <source.ts>
#   bash scripts/run-demo-coverage-scope.sh <source.ts|directory>
#   bash scripts/demo-coverage-status.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

mkdir -p coverage/.tmp

echo "▶ demo coverage: full project (PR/CI gate)"
set +e
npx vitest run --project demo --coverage \
  --maxWorkers=1 --no-file-parallelism \
  --coverage.reportOnFailure=true \
  --coverage.reportsDirectory=coverage
TEST_EXIT=$?
set -e

npx tsx scripts/verify-demo-coverage-gaps.ts
npx tsx scripts/list-top-demo-coverage-gaps.ts --limit=10

exit "$TEST_EXIT"
