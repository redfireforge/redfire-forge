#!/bin/bash
# RedfireForge Linux Post-Install Script
# Creates a symlink in /usr/local/bin for CLI access
#
# After installation, users can run:
#   redfireforge --cli run tests/test.yaml

set -e

# Detect installation path (varies by package manager)
APP_PATHS=(
    "/usr/bin/redfireforge"
    "/opt/RedfireForge/redfireforge"
    "/opt/redfireforge/redfireforge"
)

SYMLINK_PATH="/usr/local/bin/redfireforge"
BINARY_PATH=""

# Find the installed binary
for path in "${APP_PATHS[@]}"; do
    if [ -f "$path" ]; then
        BINARY_PATH="$path"
        break
    fi
done

if [ -z "$BINARY_PATH" ]; then
    echo "RedfireForge binary not found. CLI symlink not created."
    exit 0
fi

# Skip if already accessible as 'redfireforge'
if command -v redfireforge &> /dev/null; then
    echo "RedfireForge is already accessible in PATH."
    exit 0
fi

# Create /usr/local/bin if it doesn't exist
if [ ! -d "/usr/local/bin" ]; then
    mkdir -p /usr/local/bin
fi

# Remove existing symlink if present
if [ -L "$SYMLINK_PATH" ]; then
    rm "$SYMLINK_PATH"
fi

# Create new symlink
ln -s "$BINARY_PATH" "$SYMLINK_PATH"
echo "RedfireForge CLI symlink created at $SYMLINK_PATH"
echo ""
echo "You can now run CLI commands with:"
echo "  redfireforge --cli run tests/test.yaml"
echo "  redfireforge --cli workflow tests/workflow.yaml"
echo ""

exit 0
