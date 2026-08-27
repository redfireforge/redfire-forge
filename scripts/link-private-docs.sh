#!/usr/bin/env bash
# Link private planning/docs artifacts into the public checkout for local
# development and Vitest acceptance gates.
#
# Expects sibling directories (override with REDFIRE_PRIVATE_ROOT):
#   <workspace>/redfire-forge          (this repo)
#   <workspace>/redfireforge-private   (private plans, guides, cursor rules)
#
# What gets linked (all gitignored in the public repo):
#   docs/plan/              → <private>/docs-plan
#   docs/guides/grpc-phase* → <private>/docs-guides/grpc-phase*
#   .cursor/rules/          → <private>/.cursor/rules
#
# Usage:
#   bash scripts/link-private-docs.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PRIVATE="${REDFIRE_PRIVATE_ROOT:-$(cd "$ROOT/.." && pwd)/redfireforge-private}"

if [[ ! -d "$PRIVATE" ]]; then
  echo "Private repo not found at: $PRIVATE" >&2
  echo "Clone redfireforge-private as a sibling, or set REDFIRE_PRIVATE_ROOT." >&2
  exit 1
fi

relpath() {
  python3 -c "import os.path; print(os.path.relpath('$1', '$2'))"
}

echo "Public:  $ROOT"
echo "Private: $PRIVATE"

if [[ -d "$PRIVATE/docs-plan" ]]; then
  mkdir -p "$ROOT/docs"
  ln -sfn "$(relpath "$PRIVATE/docs-plan" "$ROOT/docs")" "$ROOT/docs/plan"
  echo "linked docs/plan"
else
  echo "WARN: missing $PRIVATE/docs-plan" >&2
fi

GUIDES_SRC="$PRIVATE/docs-guides"
if [[ -d "$GUIDES_SRC" ]]; then
  mkdir -p "$ROOT/docs/guides"
  for f in "$GUIDES_SRC"/grpc-phase*.md; do
    [[ -e "$f" ]] || continue
    base=$(basename "$f")
    ln -sfn "$(relpath "$f" "$ROOT/docs/guides")" "$ROOT/docs/guides/$base"
  done
  echo "linked docs/guides/grpc-phase*.md"
else
  echo "WARN: missing $GUIDES_SRC (gRPC acceptance docs)" >&2
fi

mkdir -p "$ROOT/.cursor"
if [[ -d "$PRIVATE/.cursor/rules" ]]; then
  if [[ -e "$ROOT/.cursor/rules" && ! -L "$ROOT/.cursor/rules" ]]; then
    echo "WARN: $ROOT/.cursor/rules exists and is not a symlink — leave as-is" >&2
  else
    ln -sfn "$(relpath "$PRIVATE/.cursor/rules" "$ROOT/.cursor")" "$ROOT/.cursor/rules"
    echo "linked .cursor/rules"
  fi
fi

echo "Done."
