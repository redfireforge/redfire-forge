#!/usr/bin/env bash
# Shared helpers for demo-hub coverage dev scripts (sourced, not executed directly).

demo_coverage_root() {
  cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd
}

demo_coverage_normalize_path() {
  local path="$1"
  path="${path#./}"
  echo "$path"
}

demo_coverage_is_demo_hub_source() {
  local path
  path="$(demo_coverage_normalize_path "$1")"
  [[ "$path" == packages/demo-hub/src/* ]] && [[ "$path" != *".test."* ]]
}

demo_coverage_report_exists() {
  [[ -f coverage/coverage-final.json ]]
}

# Collect co-located test files for a demo-hub source file.
demo_coverage_find_tests_for_file() {
  local file
  file="$(demo_coverage_normalize_path "$1")"
  local dir stem
  dir="$(dirname "$file")"
  local base
  base="$(basename "$file")"
  stem="${base%.tsx}"
  stem="${stem%.ts}"

  local -a tests=()
  local candidate
  for candidate in \
    "$dir/$stem.test.ts" \
    "$dir/$stem.test.tsx" \
    "$dir/$stem.coverage-gaps.test.ts" \
    "$dir/$stem.coverage-gaps.test.tsx"
  do
    if [[ ! -f "$candidate" ]]; then
      continue
    fi
    tests+=("$candidate")
  done

  if [[ ${#tests[@]} -eq 0 ]]; then
    return 1
  fi
  printf '%s\n' "${tests[@]}"
}

demo_coverage_scope_to_tests() {
  local scope
  scope="$(demo_coverage_normalize_path "$1")"

  if [[ -d "$scope" ]]; then
    printf '%s\n' "$scope"
    return 0
  fi

  if [[ -f "$scope" ]]; then
    if [[ "$scope" == *".test.ts" ]] || [[ "$scope" == *".test.tsx" ]]; then
      printf '%s\n' "$scope"
      return 0
    fi
    demo_coverage_find_tests_for_file "$scope"
    return $?
  fi

  echo "Scope not found: $scope" >&2
  return 1
}
