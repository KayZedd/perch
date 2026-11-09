#!/usr/bin/env bash
# Install the Perch xpi into a Betterbird profile directory.
# usage: tools/install.sh <profile-dir>
# Close Betterbird first. Re-run after updating; it replaces the previous copy.
set -euo pipefail
PROFILE=${1:?usage: install.sh <profile-dir>}
cd "$(dirname "$0")/.."
ID=perch@kayzedd

[ -d "$PROFILE" ] || { echo "no such profile dir: $PROFILE" >&2; exit 1; }
if [ -L "$PROFILE/lock" ]; then
  PIDLOCK=$(readlink "$PROFILE/lock" || true)           # e.g. 127.0.1.1:+92425
  PID=${PIDLOCK##*+}
  if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
    echo "Betterbird (pid $PID) is running on this profile. Close it first." >&2
    exit 1
  fi
fi

XPI=$(node tools/package.mjs)
mkdir -p "$PROFILE/extensions"
# Earlier development builds shipped under another add-on id; remove them so only one copy runs.
rm -f "$PROFILE/extensions/reskin@better-looker.xpi"
cp "$XPI" "$PROFILE/extensions/$ID.xpi"

# Sideloaded add-ons in the profile scope (1) are auto-disabled until approved when
# autoDisableScopes includes bit 1. 14 = every scope except the profile one.
if ! grep -q 'extensions.autoDisableScopes' "$PROFILE/user.js" 2>/dev/null; then
  echo 'user_pref("extensions.autoDisableScopes", 14);' >> "$PROFILE/user.js"
fi
echo "Installed $XPI -> $PROFILE/extensions/$ID.xpi"
echo "Start Betterbird. Remove with: rm '$PROFILE/extensions/$ID.xpi'"
