#!/usr/bin/env bash
# Fast isolated coverage check for a single source file (dev loop only — not the merge gate).
#
#   bash scripts/run-product-coverage-file.sh src/features/grpc/data/grpcCollectionRepository.ts
#
# After isolated coverage looks good, refresh merged totals for that batch:
#   bash scripts/run-product-coverage-batch.sh features src/features/grpc/data/
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck source=scripts/product-coverage-lib.sh
source "$ROOT/scripts/product-coverage-lib.sh"

FILE="${1:?Usage: $0 <source-file.ts|tsx>}"
FILE="${FILE#./}"

if [[ ! -f "$FILE" ]]; then
  echo "❌ File not found: $FILE" >&2
  exit 1
fi

case "$FILE" in
  *.ts|*.tsx) ;;
  *)
    echo "❌ Expected a .ts or .tsx source file: $FILE" >&2
    exit 1
    ;;
esac

DIR="$(dirname "$FILE")"
BASE="$(basename "$FILE")"
STEM="${BASE%.tsx}"
STEM="${STEM%.ts}"

TESTS=()
for candidate in \
  "$DIR/$STEM.test.ts" \
  "$DIR/$STEM.test.tsx" \
  "$DIR/$STEM.coverage-gaps.test.ts" \
  "$DIR/$STEM.coverage-gaps.test.tsx"
do
  if [[ -f "$candidate" ]]; then
    TESTS+=("$candidate")
  fi
done

if [[ ${#TESTS[@]} -eq 0 ]]; then
  echo "❌ No co-located tests found for $FILE" >&2
  echo "   Looked for: $DIR/$STEM.{test,coverage-gaps.test}.{ts,tsx}" >&2
  exit 1
fi

BATCH="$(product_coverage_batch_for_path "$FILE")"

echo "▶ isolated coverage: $FILE"
echo "   tests: ${TESTS[*]}"
echo ""

mkdir -p coverage/.tmp/isolated/.tmp

set +e
npx vitest run --project product --coverage \
  --coverage.clean=false \
  --coverage.reportsDirectory=coverage/.tmp/isolated \
  --coverage.include="$FILE" \
  --coverage.reporter=text \
  "${TESTS[@]}"
TEST_EXIT=$?
set -e

echo ""
if product_coverage_product_report_exists; then
  echo "Merged gate snapshot (may differ from isolated run above):"
  npx tsx scripts/coverage-gap-lines.ts "$FILE" || true
else
  echo "ℹ No merged product report yet. After fixing tests, run:"
fi
echo "   bash scripts/run-product-coverage-batch.sh $BATCH ${DIR}/"

exit "$TEST_EXIT"
