#!/usr/bin/env bash
# usage: shot.sh <out.png> [light|dark] [extra betterbird args...]  -- runs under Xvfb, loads extension via an unpacked dir
set -u
OUT=$1; SCHEME=${2:-dark}; shift 2 || true
HERE=$(cd "$(dirname "$0")" && pwd)
PROF=${PROF:-/tmp/perch-profile-$SCHEME}
[ -n "${SKIP_MAKE:-}" ] || python3 "$HERE/make_profile.py" "$PROF" "$SCHEME" >/dev/null
[ -n "${EXTRA_PREFS:-}" ] && printf '%b\n' "$EXTRA_PREFS" >> "$PROF/user.js"
if [ -n "${XPI:-}" ]; then
  mkdir -p "$PROF/extensions"
  cp "$XPI" "$PROF/extensions/perch@kayzedd.xpi"
fi
if [ -n "${EXT:-}" ]; then
  mkdir -p "$PROF/extensions"
  # proxy file install: file contains path to unpacked extension dir
  echo -n "$EXT" > "$PROF/extensions/perch@kayzedd"
fi
export MOZ_ENABLE_WAYLAND=0 GDK_BACKEND=x11
xvfb-run -a -s "-screen 0 1500x900x24" bash -c '
  betterbird -profile "'"$PROF"'" -no-remote "$@" >/tmp/perch.log 2>&1 &
  PID=$!
  sleep '"${WAIT:-12}"'
  W=$(xdotool search --onlyvisible --class "betterbird|thunderbird" | head -1)
  [ -n "$W" ] && xdotool windowmove $W 0 0 windowsize $W 1500 900
  sleep 2
  '"${ACTIONS:-:}"'
  sleep 2
  import -window root "'"$OUT"'"
  kill $PID 2>/dev/null; sleep 1; kill -9 $PID 2>/dev/null
' _ "$@"
