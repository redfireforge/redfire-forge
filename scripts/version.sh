#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────────────────────
# RedfireForge version bump script
#
# Usage:
#   ./scripts/version.sh <major|minor|patch|set> [--pre <N>]
#
# Behaviour based on current git branch:
#   master         → v1.2.3           (stable release)
#   release/*      → v1.2.3-beta.N    (release candidate)
#   develop        → v1.2.3-alpha.N   (development build)
#   feature/*      → v1.2.3-dev.N     (local dev build)
#
# Examples:
#   ./scripts/version.sh patch               # 0.1.0 → 0.1.1 on master
#   ./scripts/version.sh minor --pre 1       # 0.1.0 → 0.2.0-alpha.1 on develop
#   ./scripts/version.sh patch --pre 3       # 0.1.0 → 0.1.1-beta.3 on release/0.1.1
#   ./scripts/version.sh set 0.2.0 --pre 1   # → 0.2.0-beta.1 (explicit base version)
# ──────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

PKG_JSON="$ROOT_DIR/package.json"
TAURI_CONF="$ROOT_DIR/src-tauri/tauri.conf.json"
CARGO_TOML="$ROOT_DIR/src-tauri/Cargo.toml"

# ── Parse arguments ──────────────────────────────────────────

BUMP_TYPE="${1:-}"
PRE_NUM=""
SET_VERSION=""

if [[ -z "$BUMP_TYPE" ]]; then
  echo "Usage: version.sh <major|minor|patch|set> [--pre <N>]"
  echo ""
  echo "  major|minor|patch   Which part of semver to bump"
  echo "  set <X.Y.Z>        Set an explicit base version (no bump)"
  echo "  --pre <N>           Pre-release number (required on non-master branches)"
  echo ""
  echo "Current version: $(grep '"version"' "$PKG_JSON" | head -1 | sed 's/.*: *"\(.*\)".*/\1/')"
  echo "Current branch:  $(git -C "$ROOT_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')"
  exit 1
fi

if [[ "$BUMP_TYPE" == "set" ]]; then
  SET_VERSION="${2:-}"
  if [[ -z "$SET_VERSION" ]]; then
    echo "Error: 'set' requires a version argument, e.g.: version.sh set 0.2.0 --pre 1"
    exit 1
  fi
  shift 2
else
  shift
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    --pre)
      PRE_NUM="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1"
      exit 1
      ;;
  esac
done

# ── Detect branch ────────────────────────────────────────────

BRANCH="$(git -C "$ROOT_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')"

case "$BRANCH" in
  master|main)
    PRE_TAG=""
    ;;
  release/*)
    PRE_TAG="beta"
    ;;
  develop)
    PRE_TAG="alpha"
    ;;
  *)
    PRE_TAG="dev"
    ;;
esac

# ── Read current base version ────────────────────────────────

CURRENT=$(grep '"version"' "$PKG_JSON" | head -1 | sed 's/.*: *"\([0-9]*\.[0-9]*\.[0-9]*\).*/\1/')
IFS='.' read -r CUR_MAJOR CUR_MINOR CUR_PATCH <<< "$CURRENT"

# ── Bump ─────────────────────────────────────────────────────

if [[ -n "$SET_VERSION" ]]; then
  BASE_VERSION="$SET_VERSION"
else
  case "$BUMP_TYPE" in
    major)
      NEW_MAJOR=$((CUR_MAJOR + 1))
      NEW_MINOR=0
      NEW_PATCH=0
      ;;
    minor)
      NEW_MAJOR=$CUR_MAJOR
      NEW_MINOR=$((CUR_MINOR + 1))
      NEW_PATCH=0
      ;;
    patch)
      NEW_MAJOR=$CUR_MAJOR
      NEW_MINOR=$CUR_MINOR
      NEW_PATCH=$((CUR_PATCH + 1))
      ;;
    *)
      echo "Invalid bump type: $BUMP_TYPE (use major|minor|patch|set)"
      exit 1
      ;;
  esac
  BASE_VERSION="$NEW_MAJOR.$NEW_MINOR.$NEW_PATCH"
fi

if [[ -n "$PRE_TAG" ]]; then
  if [[ -z "$PRE_NUM" ]]; then
    echo "Error: On branch '$BRANCH', you must provide --pre <N>"
    echo "Example: ./scripts/version.sh $BUMP_TYPE --pre 1"
    exit 1
  fi
  FULL_VERSION="$BASE_VERSION-$PRE_TAG.$PRE_NUM"
else
  FULL_VERSION="$BASE_VERSION"
fi

# Cargo.toml only supports semver pre-release without dots in some tooling,
# but Cargo itself handles "1.0.0-alpha.1" fine.
CARGO_VERSION="$FULL_VERSION"

echo "──────────────────────────────────────"
echo "  Branch:       $BRANCH"
echo "  Old version:  $CURRENT"
echo "  New version:  $FULL_VERSION"
echo "  Pre-release:  ${PRE_TAG:-none}"
echo "──────────────────────────────────────"

# ── Update package.json ──────────────────────────────────────

if command -v node &>/dev/null; then
  node -e "
    const fs = require('fs');
    const pkg = JSON.parse(fs.readFileSync('$PKG_JSON', 'utf8'));
    pkg.version = '$FULL_VERSION';
    fs.writeFileSync('$PKG_JSON', JSON.stringify(pkg, null, 2) + '\n');
  "
else
  sed -i.bak "s/\"version\": \".*\"/\"version\": \"$FULL_VERSION\"/" "$PKG_JSON" && rm -f "$PKG_JSON.bak"
fi

# ── Update tauri.conf.json ───────────────────────────────────

if command -v node &>/dev/null; then
  node -e "
    const fs = require('fs');
    const conf = JSON.parse(fs.readFileSync('$TAURI_CONF', 'utf8'));
    conf.version = '$FULL_VERSION';
    fs.writeFileSync('$TAURI_CONF', JSON.stringify(conf, null, 2) + '\n');
  "
else
  sed -i.bak "s/\"version\": \".*\"/\"version\": \"$FULL_VERSION\"/" "$TAURI_CONF" && rm -f "$TAURI_CONF.bak"
fi

# ── Update Cargo.toml ────────────────────────────────────────

sed -i.bak "s/^version = \".*\"/version = \"$CARGO_VERSION\"/" "$CARGO_TOML" && rm -f "$CARGO_TOML.bak"

# ── Summary ──────────────────────────────────────────────────

echo ""
echo "✅ Updated to $FULL_VERSION"
echo ""
echo "Files changed:"
echo "  • $PKG_JSON"
echo "  • $TAURI_CONF"
echo "  • $CARGO_TOML"
echo ""
echo "Next steps:"
echo "  git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml"
echo "  git commit -m \"chore: bump version to $FULL_VERSION\""
if [[ -z "$PRE_TAG" ]]; then
  echo "  git tag v$FULL_VERSION"
fi
