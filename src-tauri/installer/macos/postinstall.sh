#!/bin/bash
# RedfireForge macOS Post-Install Script
# Creates symlinks in /usr/local/bin for CLI access
#
# After installation, users can run:
#   redfireforge --cli run tests/test.yaml
#   rff run tests/test.yaml          (short alias, always CLI mode, no --cli needed)

set -e

APP_PATH="/Applications/RedfireForge.app"
SYMLINK_PATH="/usr/local/bin/redfireforge"
RFF_SYMLINK_PATH="/usr/local/bin/rff"
BINARY_PATH="$APP_PATH/Contents/MacOS/RedfireForge"

# Create /usr/local/bin if it doesn't exist
if [ ! -d "/usr/local/bin" ]; then
    mkdir -p /usr/local/bin
fi

# Remove existing symlinks if present
if [ -L "$SYMLINK_PATH" ]; then
    rm "$SYMLINK_PATH"
fi
if [ -L "$RFF_SYMLINK_PATH" ]; then
    rm "$RFF_SYMLINK_PATH"
fi

# Create new symlinks
if [ -f "$BINARY_PATH" ]; then
    ln -s "$BINARY_PATH" "$SYMLINK_PATH"
    ln -s "$BINARY_PATH" "$RFF_SYMLINK_PATH"
    echo "RedfireForge CLI symlinks created at $SYMLINK_PATH and $RFF_SYMLINK_PATH"
    echo ""
    echo "You can now run CLI commands with:"
    echo "  redfireforge --cli run tests/test.yaml"
    echo "  redfireforge --cli workflow tests/workflow.yaml"
    echo ""
    echo "Or the short alias (same binary, defaults to CLI mode, no --cli needed):"
    echo "  rff run tests/test.yaml"
    echo "  rff workflow tests/workflow.yaml"
    echo ""
else
    echo "Warning: RedfireForge binary not found at $BINARY_PATH"
    echo "CLI symlinks were not created."
fi


exit 0
