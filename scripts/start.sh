#!/usr/bin/env bash
# Production-style start for the lab: build the frontend once, then serve
# everything (frontend, API, SSE, the mounted ADK dev UI) from one port.
# In Cloud Shell: Web Preview -> port 4600.
#
# Ctrl+C stops the server AND every process it started (the ADK agent reload
# watcher, any driver subprocess still running). A stale server already
# holding the port from an earlier session is stopped first, so there is
# never more than one instance answering.
set -euo pipefail
cd "$(dirname "$0")/.."
PORT="${PORT:-4600}"

stop_port() {            # stop whatever from THIS repo is listening on a port
  # lsof ORs its selectors unless -a is given: without it, this would list
  # every listening socket on the machine, not just the one on our port.
  local pids ours=""
  pids=$(lsof -a -ti "tcp:$1" -sTCP:LISTEN 2>/dev/null || true)
  for pid in $pids; do
    if ps -o command= -p "$pid" | grep -q "vibe-studio-lab\|server.main\|adk web\|vite"; then
      echo "stopping stale process $pid on port $1"
      parent=$(ps -o ppid= -p "$pid" | tr -d ' ')
      if [ -n "$parent" ] && ps -o command= -p "$parent" | grep -q "scripts/\(start\|dev\)\.sh"; then
        kill "$parent" 2>/dev/null || true      # its exit trap only touches its own children
      fi
      kill "$pid" 2>/dev/null || true
      ours="$ours $pid"
    fi
  done
  sleep 0.5
  for pid in $ours; do kill -9 "$pid" 2>/dev/null || true; done
}

stop_tree() {           # a process and its children (drivers under uvicorn), TERM then KILL
  local pid=$1
  [ -z "$pid" ] && return 0
  pkill -TERM -P "$pid" 2>/dev/null || true
  kill -TERM "$pid" 2>/dev/null || true
  for _ in 1 2 3 4 5 6; do kill -0 "$pid" 2>/dev/null || return 0; sleep 0.5; done
  pkill -KILL -P "$pid" 2>/dev/null || true
  kill -KILL "$pid" 2>/dev/null || true
}

cleanup() {
  trap - EXIT INT TERM
  echo
  echo "stopping Vibe Studio and every process it started..."
  stop_tree "${SERVER_PID:-}"
  echo "stopped."
}
trap cleanup EXIT INT TERM

[ -d .venv ] || uv sync
if [ ! -f web/dist/index.html ] || [ "${REBUILD:-0}" = "1" ]; then
  (cd web && ([ -d node_modules ] || npm install) && npm run build)
fi

stop_port "$PORT"
.venv/bin/uvicorn server.main:app --host 0.0.0.0 --port "$PORT" &
SERVER_PID=$!
echo "Vibe Studio on http://localhost:$PORT  (Ctrl+C stops everything)"
wait "$SERVER_PID"
