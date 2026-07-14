#!/usr/bin/env bash
set -euo pipefail

MAX_LINES="${MAX_LINES:-900}"

# Intended scope: production source files only.
# Excludes demo and test assets per branch policy.
EXCLUDE_PATTERN='(^|/)(packages/demo-hub/|e2e/|playwright/|test-data/|artifacts/|build-artifacts/|coverage/|coverage-|cov-|dist/|dist-cli/|dist-server/|src-tauri/target/|docker/graphql/node_modules/)|(^|/)(__tests__/|tests?/)|\.(test|spec|demo)\.(ts|tsx|js|jsx|mjs|cjs)$'

mapfile -t files < <(
  git ls-files '*.{ts,tsx,js,jsx,mjs,cjs,rs,java,kt,kts,go,py,cs}'
)

violations=()

for file in "${files[@]}"; do
  if [[ "$file" =~ $EXCLUDE_PATTERN ]]; then
    continue
  fi

  # Skip deleted/missing files in unusual git states.
  if [[ ! -f "$file" ]]; then
    continue
  fi

  line_count=$(wc -l < "$file" | tr -d ' ')
  if (( line_count > MAX_LINES )); then
    violations+=("$line_count $file")
  fi
done

if (( ${#violations[@]} > 0 )); then
  echo "Monolithic file check failed: files over ${MAX_LINES} lines (excluding demo/test)"
  printf '%s\n' "${violations[@]}" | sort -nr
  exit 1
fi

echo "Monolithic file check passed: all non-demo/non-test files are <= ${MAX_LINES} lines."
