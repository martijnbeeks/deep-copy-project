#!/bin/bash
#
# Development start script
# Starts the Next.js dev server, detects its port, then starts the webhook watcher.
#
# Usage: ./scripts/dev.sh

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$SCRIPT_DIR/../app"
LOGFILE=$(mktemp)

echo "Starting Next.js dev server..."

# Start Next.js in the background, tee output so we can parse the port
cd "$APP_DIR"
npx next dev 2>&1 | tee "$LOGFILE" &
NEXT_PID=$!

# Wait for Next.js to print the "Local:" line with the port
PORT=""
TIMEOUT=30
ELAPSED=0

while [ -z "$PORT" ] && [ "$ELAPSED" -lt "$TIMEOUT" ]; do
  sleep 1
  ELAPSED=$((ELAPSED + 1))
  # Parse "- Local: http://localhost:XXXX" from Next.js output
  PORT=$(grep 'Local:' "$LOGFILE" 2>/dev/null | grep -o 'localhost:[0-9]*' | grep -o '[0-9]*' | head -1)
done

rm -f "$LOGFILE"

if [ -z "$PORT" ]; then
  echo ""
  echo "Could not detect port after ${TIMEOUT}s, defaulting to 3000"
  PORT=3000
fi

echo ""
echo "=================================="
echo "  Next.js running on port $PORT"
echo "  Starting webhook watcher..."
echo "=================================="
echo ""

# Start webhook watcher with detected port
"$SCRIPT_DIR/webhook-watcher.sh" "$PORT" &
WATCHER_PID=$!

# Cleanup on exit
cleanup() {
  echo ""
  echo "Shutting down..."
  kill "$WATCHER_PID" 2>/dev/null
  kill "$NEXT_PID" 2>/dev/null
  wait 2>/dev/null
}
trap cleanup EXIT INT TERM

# Wait for Next.js (foreground process)
wait "$NEXT_PID"
