#!/usr/bin/env bash
# PR / CI product coverage gate — runs shards in PARALLEL (~5 min).
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

SHARDS=${COVERAGE_SHARDS:-4}
START_TIME=$(date +%s)

mkdir -p coverage/.tmp coverage/batches
product_coverage_ensure_batch_dirs

# Run shards in parallel using Vitest's --shard flag
echo "▶ Starting $SHARDS coverage shards in parallel..."
SHARD_DIR="coverage/.tmp/shards"
rm -rf "$SHARD_DIR" && mkdir -p "$SHARD_DIR"

PIDS=()
for i in $(seq 1 "$SHARDS"); do
  SHARD_OUT="$SHARD_DIR/s$i"
  mkdir -p "$SHARD_OUT"
  npx vitest run --project product --coverage \
    --maxWorkers=1 --no-file-parallelism \
    --shard="$i/$SHARDS" \
    --coverage.reportsDirectory="$SHARD_OUT" \
    --coverage.reportOnFailure \
    > "$SHARD_OUT/vitest.log" 2>&1 &
  PIDS+=($!)
  echo "  Shard $i/$SHARDS started (PID $!)"
done

echo "  Waiting for all shards..."
FAILURES=0
for pid in "${PIDS[@]}"; do
  if ! wait "$pid" 2>/dev/null; then
    ((FAILURES++)) || true
  fi
done

BATCH_END=$(date +%s)
echo "  All shards done in $((BATCH_END - START_TIME))s ($FAILURES non-zero exits)"

# Check shard outputs
SHARD_COUNT=0
for i in $(seq 1 "$SHARDS"); do
  if [[ -f "$SHARD_DIR/s$i/coverage-final.json" ]]; then
    SIZE=$(stat -f '%z' "$SHARD_DIR/s$i/coverage-final.json" 2>/dev/null || stat --printf='%s' "$SHARD_DIR/s$i/coverage-final.json" 2>/dev/null || echo "0")
    echo "  ✓ shard $i: $(( SIZE / 1048576 ))MB"
    ((SHARD_COUNT++)) || true
  else
    echo "  ✗ shard $i: coverage-final.json MISSING (check $SHARD_DIR/s$i/vitest.log)"
  fi
done

if [[ "$SHARD_COUNT" -lt 1 ]]; then
  echo "❌ No shards produced coverage output"
  exit 1
fi

# Merge shards using istanbul-lib-coverage
echo "▶ Merging $SHARD_COUNT shard(s)..."
node -e "
const fs = require('fs');
const path = require('path');
const shardDir = '$SHARD_DIR';
const numShards = $SHARDS;
const libCoverage = require('istanbul-lib-coverage');
const map = libCoverage.createCoverageMap({});
let merged = 0;
for (let i = 1; i <= numShards; i++) {
  const covPath = path.join(shardDir, 's' + i, 'coverage-final.json');
  if (!fs.existsSync(covPath)) continue;
  const raw = JSON.parse(fs.readFileSync(covPath, 'utf8'));
  map.merge(libCoverage.createCoverageMap(raw));
  merged++;
}
const outPath = 'coverage/coverage-final.json';
fs.mkdirSync('coverage', { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(map.toJSON(), null, 0));
const size = fs.statSync(outPath).size;
console.log('  Merged ' + merged + ' shard(s) -> ' + outPath + ' (' + map.files().length + ' files, ' + (size / 1e6).toFixed(1) + 'MB)');
"

npx tsx scripts/product-coverage-filter.ts
npx tsx scripts/list-top-coverage-gaps.ts --limit=10

echo ""
echo "▶ product coverage verify (incl. workflow, shared, engine)"
npx tsx scripts/verify-product-coverage-gaps.ts

echo ""
echo "▶ monolith check"
product_coverage_check_monolithic

END_TIME=$(date +%s)
TOTAL=$((END_TIME - START_TIME))
echo ""
echo "✅ Total: ${TOTAL}s ($(( TOTAL / 60 ))m $(( TOTAL % 60 ))s) — batches: $((BATCH_END - START_TIME))s, merge+verify: $((END_TIME - BATCH_END))s"
