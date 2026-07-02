#!/usr/bin/env bash
# Run demo vitest + coverage only for what you changed — not the full demo suite.
#
#   bash scripts/run-demo-coverage-scope.sh packages/demo-hub/src/lessons/protocols/grpc-first-call.ts
#   bash scripts/run-demo-coverage-scope.sh packages/demo-hub/src/lessons/protocols/graphql-lesson-helpers/
#
# PR / CI full demo gate:
#   bash scripts/run-demo-coverage-full.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck source=scripts/demo-coverage-lib.sh
source "$ROOT/scripts/demo-coverage-lib.sh"

SCOPE="${1:?Usage: $0 <demo-hub source file or directory> [extra vitest args...]}"
SCOPE="$(demo_coverage_normalize_path "$SCOPE")"
shift || true

TEST_PATHS=()
while IFS= read -r line; do
  [[ -n "$line" ]] && TEST_PATHS+=("$line")
done < <(demo_coverage_scope_to_tests "$SCOPE")

if [[ ${#TEST_PATHS[@]} -eq 0 ]]; then
  echo "No tests found for scope: $SCOPE" >&2
  exit 1
fi

mkdir -p coverage/.tmp

echo "▶ demo coverage scope: $SCOPE"
echo "   tests: ${TEST_PATHS[*]}"
echo ""

set +e
npx vitest run --project demo --coverage \
  --maxWorkers=1 --no-file-parallelism \
  --coverage.clean=false \
  --coverage.reportOnFailure=true \
  --coverage.reportsDirectory=coverage \
  "${TEST_PATHS[@]}" "$@"
TEST_EXIT=$?
set -e

if [[ "$TEST_EXIT" -ne 0 ]]; then
  echo "WARN demo scope had test failures — exit $TEST_EXIT"
fi

FILTER="$(basename "$SCOPE")"
FILTER="${FILTER%.ts}"
FILTER="${FILTER%.tsx}"
npx tsx scripts/list-top-demo-coverage-gaps.ts --limit=10 --filter="$FILTER" || true

echo ""
echo "Scope run complete. For uncovered lines:"
echo "   npx tsx scripts/coverage-gap-lines.ts --demo $FILTER"
echo "E2E for this lesson:"
echo "   bash scripts/run-demo-e2e.sh $SCOPE"
echo "Full demo gate — PR/CI only: bash scripts/run-demo-coverage-full.sh"

exit "$TEST_EXIT"
