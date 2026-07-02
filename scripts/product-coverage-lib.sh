#!/usr/bin/env bash
# Shared helpers for product coverage dev scripts (sourced, not executed directly).
product_coverage_root() {
  cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd
}

# Map a product source path to its vitest coverage batch name.
product_coverage_batch_for_path() {
  local path="$1"
  path="${path#./}"
  case "$path" in
    src/shared/*) echo shared ;;
    src/features/*) echo features ;;
    src/app/*|src/data/*|src/engine/*|src/config/*) echo app ;;
    src-server/*|cli/*) echo server ;;
    *)
      echo "Cannot infer coverage batch for: $path" >&2
      echo "Expected prefix: src/shared, src/features, src/app, src/data," >&2
      echo "src/engine, src/config, src-server, or cli" >&2
      return 1
      ;;
  esac
}

# Default vitest paths for a batch.
product_coverage_batch_default_paths() {
  local batch="$1"
  case "$batch" in
    shared) echo "src/shared" ;;
    features) echo "src/features" ;;
    app) echo "src/app src/data src/engine src/config" ;;
    server) echo "src-server cli" ;;
    *)
      echo "Unknown batch: $batch — use shared, features, app, or server" >&2
      return 1
      ;;
  esac
}

product_coverage_product_report_exists() {
  [[ -f coverage/coverage-final.product.json ]]
}

product_coverage_warn_stale_batches() {
  local batch="$1"
  local missing=0
  for other in shared features app server; do
    [[ "$other" == "$batch" ]] && continue
    if [[ ! -f "coverage/batches/$other/coverage-final.json" ]]; then
      echo "WARN missing batch coverage: coverage/batches/$other/ — merge omits this batch"
      missing=1
    fi
  done
  if [[ "$missing" -eq 1 ]]; then
    echo "Run all batches once on PR/CI: bash scripts/run-product-coverage-fast.sh"
  fi
}
