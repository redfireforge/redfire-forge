#!/bin/bash
# Build RedfireForge CLI as a standalone npm package
#
# This script:
# 1. Bundles CLI TypeScript code into a single ESM file
# 2. Copies necessary files to cli/dist/
# 3. Creates a ready-to-publish package in cli/
#
# Usage: ./scripts/build-cli-package.sh
#
# After running, you can publish with:
#   cd cli && npm publish

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CLI_DIR="$PROJECT_ROOT/cli"
DIST_DIR="$CLI_DIR/dist"

echo "=== Building RedfireForge CLI Package ==="
echo ""

cd "$PROJECT_ROOT"

# 1. Clean previous build
echo "Step 1: Cleaning previous build..."
rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

# 2. Get version from main package.json
VERSION=$(node -p "require('./package.json').version")
echo "  Version: $VERSION"

# 3. Build the CLI bundle
echo ""
echo "Step 2: Building CLI bundle with esbuild..."
node scripts/build-cli.mjs

# 4. Copy the built file to cli/dist
echo ""
echo "Step 3: Copying bundle to cli/dist..."
cp dist-cli/redfireforge.mjs "$DIST_DIR/redfireforge.mjs"

# 5. Update version in cli/package.json to match main
echo ""
echo "Step 4: Syncing version to cli/package.json..."
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('cli/package.json', 'utf-8'));
pkg.version = '$VERSION';
fs.writeFileSync('cli/package.json', JSON.stringify(pkg, null, 2) + '\n');
"
echo "  Updated to version $VERSION"

# 6. Verify the build
echo ""
echo "Step 5: Verifying build..."
if [ -f "$DIST_DIR/redfireforge.mjs" ]; then
  SIZE=$(wc -c < "$DIST_DIR/redfireforge.mjs")
  echo "  ✅ Bundle created: $DIST_DIR/redfireforge.mjs ($(numfmt --to=iec $SIZE 2>/dev/null || echo "$SIZE bytes"))"
else
  echo "  ❌ Build failed: redfireforge.mjs not found"
  exit 1
fi

# 7. Test the bundle (quick syntax check)
echo ""
echo "Step 6: Testing bundle syntax..."
if node --check "$DIST_DIR/redfireforge.mjs" 2>/dev/null; then
  echo "  ✅ Bundle syntax valid"
else
  echo "  ❌ Bundle has syntax errors"
  exit 1
fi

# 8. Show package contents
echo ""
echo "=== Package Contents ==="
echo ""
echo "cli/"
echo "├── package.json"
echo "├── README.md"
echo "└── dist/"
echo "    └── redfireforge.mjs"
echo ""

# 9. Show publish instructions
echo "=== Ready to Publish ==="
echo ""
echo "To publish to npm:"
echo ""
echo "  cd cli"
echo "  npm publish"
echo ""
echo "Or for a dry run:"
echo ""
echo "  cd cli"
echo "  npm publish --dry-run"
echo ""
echo "To test locally before publishing:"
echo ""
echo "  node cli/dist/redfireforge.mjs --help"
echo ""
