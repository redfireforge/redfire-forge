#!/usr/bin/env bash
# Fast isolated demo coverage check for one demo-hub source file.
#
#   bash scripts/run-demo-coverage-file.sh packages/demo-hub/src/lessons/protocols/grpc-first-call.ts
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck source=scripts/demo-coverage-lib.sh
source "$ROOT/scripts/demo-coverage-lib.sh"

FILE="${1:?Usage: $0 <packages/demo-hub/src/.../File.ts>}"
FILE="$(demo_coverage_normalize_path "$FILE")"

if ! demo_coverage_is_demo_hub_source "$FILE"; then
  echo "Expected a demo-hub source file under packages/demo-hub/src/: $FILE" >&2
  exit 1
fi

TESTS=()
while IFS= read -r line; do
  [[ -n "$line" ]] && TESTS+=("$line")
done < <(demo_coverage_find_tests_for_file "$FILE")

if [[ ${#TESTS[@]} -eq 0 ]]; then
  echo "No co-located tests found for $FILE" >&2
  exit 1
fi

echo "▶ isolated demo coverage: $FILE"
echo "   tests: ${TESTS[*]}"
echo ""

mkdir -p coverage/.tmp/demo-isolated

set +e
npx vitest run --project demo --coverage \
  --coverage.clean=false \
  --coverage.reportsDirectory=coverage/.tmp/demo-isolated \
  --coverage.include="$FILE" \
  --coverage.reporter=text \
  "${TESTS[@]}"
TEST_EXIT=$?
set -e

echo ""
if demo_coverage_report_exists; then
  echo "Merged demo snapshot for this file:"
  npx tsx scripts/coverage-gap-lines.ts --demo "$FILE" || true
else
  echo "No merged demo report yet. After tests pass, run:"
fi
echo "   bash scripts/run-demo-coverage-scope.sh $FILE"

exit "$TEST_EXIT"
