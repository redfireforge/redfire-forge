#!/bin/bash
# RedfireForge macOS Post-Install Script
# Creates a symlink in /usr/local/bin for CLI access
#
# After installation, users can run:
#   redfireforge --cli run tests/test.yaml

set -e

APP_PATH="/Applications/RedfireForge.app"
SYMLINK_PATH="/usr/local/bin/redfireforge"
BINARY_PATH="$APP_PATH/Contents/MacOS/RedfireForge"

# Create /usr/local/bin if it doesn't exist
if [ ! -d "/usr/local/bin" ]; then
    mkdir -p /usr/local/bin
fi

# Remove existing symlink if present
if [ -L "$SYMLINK_PATH" ]; then
    rm "$SYMLINK_PATH"
fi

# Create new symlink
if [ -f "$BINARY_PATH" ]; then
    ln -s "$BINARY_PATH" "$SYMLINK_PATH"
    echo "RedfireForge CLI symlink created at $SYMLINK_PATH"
    echo ""
    echo "You can now run CLI commands with:"
    echo "  redfireforge --cli run tests/test.yaml"
    echo "  redfireforge --cli workflow tests/workflow.yaml"
    echo ""
else
    echo "Warning: RedfireForge binary not found at $BINARY_PATH"
    echo "CLI symlink was not created."
fi

exit 0
