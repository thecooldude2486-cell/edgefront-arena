#!/bin/bash
# Double-click this file on macOS to run the local game and online rooms.
cd "$(dirname "$0")" || exit 1
arena_node="$(command -v node)"
if [ -z "$arena_node" ] || ! "$arena_node" -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 24 ? 0 : 1)'; then
  arena_node="/Users/qi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
fi
if [ ! -x "$arena_node" ]; then
  echo "Node.js 24 or newer is needed to run the game."
  read -r -p "Press Enter to close."
  exit 1
fi
arena_children=()
stop_arena() {
  # Stop only servers started by this launcher, not any existing processes.
  for arena_pid in "${arena_children[@]}"; do kill -TERM "$arena_pid" 2>/dev/null; done
}
trap stop_arena EXIT
trap 'exit 0' INT TERM
if ! lsof -nP -iTCP:3000 -sTCP:LISTEN >/dev/null 2>&1; then
  "$arena_node" node_modules/vite/bin/vite.js --config vite.pages.config.ts --base / --host 127.0.0.1 --port 3000 --strictPort &
  arena_children+=("$!")
fi
if ! lsof -nP -iTCP:3008 -sTCP:LISTEN >/dev/null 2>&1; then
  (cd server && exec "$arena_node" dev.mjs) &
  arena_children+=("$!")
fi
echo "Open http://localhost:3000/ — keep this Terminal window open while playing."
if [ "${#arena_children[@]}" -gt 0 ]; then
  wait
else
  echo "The local servers are already running."
  read -r -p "Press Enter to close this launcher."
fi
