#!/usr/bin/env bash
# Shared helpers for gRPC phase gate scripts.
#
# Dev fast loop (current phase only — skip chained regressions):
#   GRPC_SKIP_REGRESSION=1 npm run test:grpc:phase11h
#
# Skip TypeScript when already green for current HEAD (within a gate chain):
#   automatic via stamp file; force rerun with GRPC_FORCE_TSC=1
#
# Skip TypeScript entirely (after you ran tsc manually):
#   GRPC_SKIP_TSC=1 npm run test:grpc:phase11h
#
# shellcheck disable=SC2034
GRPC_GATE_LIB_VERSION=1

_grpc_gate_stamp_file() {
  echo "${TMPDIR:-/tmp}/redfire-grpc-gate-tsc.stamp"
}

_grpc_gate_git_head() {
  local root="${1:-.}"
  git -C "$root" rev-parse HEAD 2>/dev/null || echo unknown
}

# Run TypeScript once per HEAD unless GRPC_SKIP_TSC=1 or stamp matches.
# Usage: grpc_gate_run_tsc          → tsc -b --noEmit (project references)
#        grpc_gate_run_tsc plain    → tsc --noEmit
grpc_gate_run_tsc() {
  local mode="${1:-project}"
  local root="${ROOT:-.}"

  if [[ "${GRPC_SKIP_TSC:-}" == "1" ]]; then
    echo "⊘ Skipping TypeScript (GRPC_SKIP_TSC=1)"
    return 0
  fi

  local stamp head
  stamp="$(_grpc_gate_stamp_file)"
  head="$(_grpc_gate_git_head "$root")"

  if [[ "${GRPC_FORCE_TSC:-}" != "1" && -f "$stamp" ]]; then
    local stamped
    stamped="$(cat "$stamp" 2>/dev/null || true)"
    if [[ "$stamped" == "$head" ]]; then
      echo "⊘ Skipping TypeScript (already passed for HEAD ${head:0:12}… — GRPC_FORCE_TSC=1 to rerun)"
      return 0
    fi
  fi

  if [[ "$mode" == "plain" ]]; then
    npx tsc --noEmit
  else
    npx tsc -b --noEmit
  fi

  echo "$head" > "$stamp"
  echo "✓ TypeScript: 0 errors"
}

grpc_gate_should_skip_regression() {
  [[ "${GRPC_SKIP_REGRESSION:-}" == "1" ]]
}

# Run one or more npm regression scripts unless GRPC_SKIP_REGRESSION=1.
# Usage: grpc_gate_run_regression "Phase 11G" test:grpc:phase11f
#        grpc_gate_run_regression "Phase 8C" test:grpc:phase8b test:grpc:phase8a
grpc_gate_run_regression() {
  local label="$1"
  shift

  if grpc_gate_should_skip_regression; then
    local skip_label="$label"
    if [[ "$skip_label" == Phase\ phase* && $# -gt 0 ]]; then
      skip_label="Phase ${1#test:grpc:phase}"
    fi
    echo "⊘ Skipping regression: ${skip_label} (GRPC_SKIP_REGRESSION=1)"
    return 0
  fi

  local script
  for script in "$@"; do
    local display_label="$label"
    if [[ "$display_label" == Phase\ phase* ]]; then
      display_label="Phase ${script#test:grpc:phase}"
    fi
    echo "== Regression (${display_label}): npm run ${script} =="
    npm run "$script"
  done
}

# Run a list of phase gate suffixes (e.g. phase4a phase4bc) for consolidated gates.
# Usage: grpc_gate_run_regression_gates "Phase 4I" phase4a phase4bc phase4d
grpc_gate_run_regression_gates() {
  local label="$1"
  shift

  if grpc_gate_should_skip_regression; then
    echo "⊘ Skipping regression gates: ${label} (GRPC_SKIP_REGRESSION=1)"
    return 0
  fi

  local gate
  for gate in "$@"; do
    echo "== Regression (${label}): test:grpc:${gate} =="
    npm run "test:grpc:${gate}"
  done
}
