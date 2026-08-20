#!/bin/bash
# RedfireForge Linux Pre-Remove Script
# Removes the CLI symlinks before uninstallation

SYMLINK_PATH="/usr/local/bin/redfireforge"
RFF_SYMLINK_PATH="/usr/local/bin/rff"

# Remove symlinks if they exist and point to RedfireForge
for path in "$SYMLINK_PATH" "$RFF_SYMLINK_PATH"; do
    if [ -L "$path" ]; then
        TARGET=$(readlink "$path")
        if [[ "$TARGET" == *"redfireforge"* ]] || [[ "$TARGET" == *"RedfireForge"* ]]; then
            rm "$path"
            echo "RedfireForge CLI symlink removed: $path"
        fi
    fi
done

exit 0
