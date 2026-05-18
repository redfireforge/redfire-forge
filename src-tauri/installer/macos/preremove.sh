#!/bin/bash
# RedfireForge macOS Pre-Remove Script
# Removes the CLI symlink before uninstallation

SYMLINK_PATH="/usr/local/bin/redfireforge"

# Remove symlink if it exists and points to RedfireForge
if [ -L "$SYMLINK_PATH" ]; then
    TARGET=$(readlink "$SYMLINK_PATH")
    if [[ "$TARGET" == *"RedfireForge"* ]]; then
        rm "$SYMLINK_PATH"
        echo "RedfireForge CLI symlink removed."
    fi
fi

exit 0
