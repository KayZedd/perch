#!/usr/bin/env bash
# End-to-end snooze round trip inside a real Betterbird (throwaway profile, Xvfb, ~45s).
# Not a gate test: slow and needs the Betterbird binary. Run before shipping changes to background.js.
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
OUT=$(mktemp -d)/selftest.png
WAIT=40 EXT="$HERE/../extension" PROF=/tmp/perch-selftest \
  EXTRA_PREFS='user_pref("extensions.perch.devmode", "selftest");' ACTIONS='sleep 2' \
  "$HERE/shot.sh" "$OUT" dark || true
grep -a "PERCH SELFTEST\|PERCH startup failed" /tmp/perch.log || true
grep -aq "PERCH SELFTEST OK" /tmp/perch.log && echo PASS || { echo FAIL; exit 1; }
