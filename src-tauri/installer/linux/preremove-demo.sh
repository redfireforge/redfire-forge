#!/bin/bash
# Learning Hub Debian/RPM pre-remove: CLI symlinks + leftover Docker app data.
# Image removal (`docker compose down --rmi all`) is done in-app via
# Settings → Docker → Prepare to Uninstall. This script is the safety net
# when the user uninstalls without that step. Docker may not be running.

set -u

SYMLINK_PATH="/usr/local/bin/redfireforge"
RFF_SYMLINK_PATH="/usr/local/bin/rff"
for path in "$SYMLINK_PATH" "$RFF_SYMLINK_PATH"; do
  if [ -L "$path" ]; then
    TARGET=$(readlink "$path")
    if [[ "$TARGET" == *"redfireforge"* ]] || [[ "$TARGET" == *"RedfireForge"* ]]; then
      rm "$path" || true
    fi
  fi
done

APP_ID="${RFF_DOCKER_APP_ID:-com.redfireforge.desktop.demo}"
if [ -n "${XDG_DATA_HOME:-}" ]; then
  DOCKER_DIR="${XDG_DATA_HOME}/${APP_ID}/docker"
else
  DOCKER_DIR="${HOME}/.local/share/${APP_ID}/docker"
fi

if [ -d "$DOCKER_DIR" ] && command -v docker >/dev/null 2>&1; then
  # Best-effort compose teardown. Every -f in one invocation — looping
  # files would tear sibling TLS/mTLS services down independently.
  find "$DOCKER_DIR" -type d -print 2>/dev/null | while read -r dir; do
    set --
    for f in "$dir"/docker-compose*.yml "$dir"/docker-compose*.yaml; do
      [ -f "$f" ] || continue
      set -- "$@" -f "$(basename "$f")"
    done
    [ "$#" -gt 0 ] || continue
    (cd "$dir" && docker compose --profile spring "$@" down --rmi all --remove-orphans) >/dev/null 2>&1 || true
    (cd "$dir" && docker compose "$@" down --rmi all --remove-orphans) >/dev/null 2>&1 || true
  done
fi

rm -rf "$DOCKER_DIR"
exit 0
