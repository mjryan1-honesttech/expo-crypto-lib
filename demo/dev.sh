#!/usr/bin/env bash
#
# Start or stop the demo's Expo dev server.
#
#   ./dev.sh start            QR code in the terminal; Ctrl-C to stop
#   ./dev.sh start --tunnel   route through ngrok, for when the phone and the
#                             laptop cannot reach each other on the LAN
#   ./dev.sh start --clear    start with an empty Metro cache
#   ./dev.sh stop             kill a server left holding the port
#
# Scan with Expo Go's own scanner, not the system camera. Expo Go ships one
# version per SDK and this app targets SDK 54, so the client's major must match.

set -euo pipefail

cd "$(dirname "$0")"

PORT="${PORT:-8081}"

case "${1:-start}" in
  start)
    if [ ! -d node_modules ]; then
      echo "Installing dependencies first..."
      npm install
    fi
    exec npx expo start --port "$PORT" "${@:2}"
    ;;

  stop)
    pids="$(lsof -ti "tcp:$PORT" 2>/dev/null || true)"
    if [ -z "$pids" ]; then
      echo "Nothing listening on port $PORT."
    else
      echo "$pids" | xargs kill
      echo "Stopped the server on port $PORT."
    fi
    ;;

  *)
    echo "usage: ./dev.sh [start [expo flags...] | stop]" >&2
    exit 2
    ;;
esac
