#!/usr/bin/env bash
# Reset the lab to the state students receive, so a rehearsal that filled in
# the answers does not leak into the next one:
#   1. the nine hands-on files are copied back from starter/
#   2. local run state, including the ADK session store, is wiped (scripts/reset.py)
#   3. the result is checked against the hole registry
# Stop the server first; the session store cannot be removed under a live one.
set -euo pipefail
cd "$(dirname "$0")/.."
PORT="${PORT:-4600}"
if lsof -a -ti "tcp:$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Vibe Studio is still listening on port $PORT. Stop it (Ctrl+C in its terminal), then rerun."
  exit 1
fi
for f in stage0_prompt/agent.py stage1_fanout/agent.py stage2_direction/agent.py stage3_router/agent.py stage4_memory/agent.py stage5_rag/agent.py stage6_video/agent.py agent/graph.py agent/deliver.py; do
  cp "starter/$f" "$f"
  echo "  restored $f"
done
.venv/bin/python scripts/reset.py
.venv/bin/python checks/verify_holes.py | tail -1
echo "starter state ready: scripts/start.sh"
