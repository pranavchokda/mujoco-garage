#!/usr/bin/env bash
set -euo pipefail

PID_FILE=".dev.pid"

start() {
  if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    echo "Already running (PID $(cat "$PID_FILE"))"
    exit 1
  fi
  npm run dev:ur5e &
  echo $! > "$PID_FILE"
  echo "Started (PID $!)"
}

stop() {
  if [[ ! -f "$PID_FILE" ]]; then
    echo "Not running"
    exit 1
  fi
  kill "$(cat "$PID_FILE")" && rm "$PID_FILE"
  echo "Stopped"
}

case "${1:-}" in
  start) start ;;
  stop)  stop  ;;
  *)     echo "Usage: $0 {start|stop}" ; exit 1 ;;
esac
