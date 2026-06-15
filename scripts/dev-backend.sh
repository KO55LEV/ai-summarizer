#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

API_PID=""
WORKER_PID=""

cleanup() {
  local exit_code=$?

  trap - INT TERM EXIT

  if [[ -n "$API_PID" || -n "$WORKER_PID" ]]; then
    echo
    echo "Stopping backend processes..."
  fi

  if [[ -n "$API_PID" ]] && kill -0 "$API_PID" 2>/dev/null; then
    kill "$API_PID" 2>/dev/null || true
  fi

  if [[ -n "$WORKER_PID" ]] && kill -0 "$WORKER_PID" 2>/dev/null; then
    kill "$WORKER_PID" 2>/dev/null || true
  fi

  wait "$API_PID" "$WORKER_PID" 2>/dev/null || true
  exit "$exit_code"
}

prefix_output() {
  local prefix="$1"
  while IFS= read -r line; do
    printf '[%s] %s\n' "$prefix" "$line"
  done
}

trap cleanup INT TERM EXIT

dotnet run --project "$ROOT/src/AiSummarizer.Api/AiSummarizer.Api.csproj" > >(prefix_output "api") 2>&1 &
API_PID=$!

dotnet run --project "$ROOT/src/AiSummarizer.Worker/AiSummarizer.Worker.csproj" > >(prefix_output "worker") 2>&1 &
WORKER_PID=$!

echo "Started backend:"
echo "  API PID:    $API_PID"
echo "  Worker PID: $WORKER_PID"
echo "Press Ctrl+C to stop both."

while true; do
  if ! kill -0 "$API_PID" 2>/dev/null; then
    echo "API process exited; stopping backend."
    exit 1
  fi

  if ! kill -0 "$WORKER_PID" 2>/dev/null; then
    echo "Worker process exited; stopping backend."
    exit 1
  fi

  sleep 1
done
