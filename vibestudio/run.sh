#!/usr/bin/env bash
# Run the app locally: build the page once, start the server on 4700.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ ! -f vibestudio/web/dist/index.html ] || [ "${REBUILD:-0}" = "1" ]; then
  (cd vibestudio/web && ([ -d node_modules ] || npm install) && npm run build)
fi
exec .venv/bin/python -m vibestudio
