#!/bin/sh
set -eu

if [ -n "${GOOGLE_VERTEX_CREDENTIALS:-}" ]; then
  credentials_path=/tmp/vio-vertex-credentials.json
  case "$GOOGLE_VERTEX_CREDENTIALS" in
    \{*) printf '%s' "$GOOGLE_VERTEX_CREDENTIALS" > "$credentials_path" ;;
    *) printf '%s' "$GOOGLE_VERTEX_CREDENTIALS" | base64 -d > "$credentials_path" ;;
  esac
  chmod 600 "$credentials_path"
  export GOOGLE_APPLICATION_CREDENTIALS="$credentials_path"
  if [ -z "${GOOGLE_CLOUD_PROJECT:-}" ]; then
    export GOOGLE_CLOUD_PROJECT="$(python3 -c 'import json, os; print(json.load(open(os.environ["GOOGLE_APPLICATION_CREDENTIALS"]))["project_id"])')"
  fi
fi

export AGENT_SERVICE_URL="${AGENT_SERVICE_URL:-http://127.0.0.1:8081}"
export VIO_INTERNAL_API_URL="${VIO_INTERNAL_API_URL:-http://127.0.0.1:${PORT:-10000}}"
node /app/scripts/migrate.js
uvicorn app.main:app --app-dir /app/agent --host 127.0.0.1 --port 8081 &
agent_pid=$!

node server.js &
web_pid=$!

shutdown() {
  kill "$web_pid" "$agent_pid" 2>/dev/null || true
  wait "$web_pid" "$agent_pid" 2>/dev/null || true
}
trap shutdown INT TERM EXIT
wait "$web_pid"
