#!/bin/bash
# RedfireForge Linux Post-Install Script
# Creates symlinks in /usr/local/bin for CLI access
#
# After installation, users can run:
#   redfireforge --cli run tests/test.yaml
#   rff run tests/test.yaml          (short alias, always CLI mode, no --cli needed)

set -e

# Detect installation path (varies by package manager)
APP_PATHS=(
    "/usr/bin/redfireforge"
    "/opt/RedfireForge/redfireforge"
    "/opt/redfireforge/redfireforge"
)

SYMLINK_PATH="/usr/local/bin/redfireforge"
RFF_SYMLINK_PATH="/usr/local/bin/rff"
BINARY_PATH=""

# Find the installed binary
for path in "${APP_PATHS[@]}"; do
    if [ -f "$path" ]; then
        BINARY_PATH="$path"
        break
    fi
done

if [ -z "$BINARY_PATH" ]; then
    echo "RedfireForge binary not found. CLI symlinks not created."
    exit 0
fi

# Create /usr/local/bin if it doesn't exist
if [ ! -d "/usr/local/bin" ]; then
    mkdir -p /usr/local/bin
fi

# 'redfireforge' — skip if already accessible in PATH (e.g. package manager put it there directly)
if command -v redfireforge &> /dev/null; then
    echo "RedfireForge is already accessible in PATH as 'redfireforge'."
else
    if [ -L "$SYMLINK_PATH" ]; then
        rm "$SYMLINK_PATH"
    fi
    ln -s "$BINARY_PATH" "$SYMLINK_PATH"
    echo "RedfireForge CLI symlink created at $SYMLINK_PATH"
fi

# 'rff' — short alias, checked independently since it's never provided by a package manager
if command -v rff &> /dev/null; then
    echo "'rff' is already accessible in PATH — leaving it alone."
else
    if [ -L "$RFF_SYMLINK_PATH" ]; then
        rm "$RFF_SYMLINK_PATH"
    fi
    ln -s "$BINARY_PATH" "$RFF_SYMLINK_PATH"
    echo "RedfireForge CLI symlink created at $RFF_SYMLINK_PATH"
fi

echo ""
echo "You can now run CLI commands with:"
echo "  redfireforge --cli run tests/test.yaml"
echo "  redfireforge --cli workflow tests/workflow.yaml"
echo ""
echo "Or the short alias (same binary, defaults to CLI mode, no --cli needed):"
echo "  rff run tests/test.yaml"
echo "  rff workflow tests/workflow.yaml"
echo ""

exit 0
