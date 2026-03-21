#!/usr/bin/env bash
set -euo pipefail

PID_FILE=".dev.pid"

start() {
  local target="${1:-}"
  case "$target" in
    ur5e)
      start_one "ur5e" "dev:ur5e" ".dev.ur5e.pid"
      ;;
    ur5e-teleop)
      start_one "ur5e-teleop" "dev:ur5e-teleop" ".dev.ur5e-teleop.pid"
      ;;
    all)
      start_one "ur5e"        "dev:ur5e"        ".dev.ur5e.pid"
      start_one "ur5e-teleop" "dev:ur5e-teleop" ".dev.ur5e-teleop.pid"
      ;;
    *)
      echo "Usage: $0 start {ur5e|ur5e-teleop|all}"
      exit 1
      ;;
  esac
}

start_one() {
  local name="$1" script="$2" pid_file="$3"
  if [[ -f "$pid_file" ]] && kill -0 "$(cat "$pid_file")" 2>/dev/null; then
    echo "$name already running (PID $(cat "$pid_file"))"
    return
  fi
  npm run "$script" &
  echo $! > "$pid_file"
  echo "$name started (PID $!)"
}

stop() {
  local target="${1:-}"
  case "$target" in
    ur5e)
      stop_one "ur5e"        ".dev.ur5e.pid"
      ;;
    ur5e-teleop)
      stop_one "ur5e-teleop" ".dev.ur5e-teleop.pid"
      ;;
    all)
      stop_one "ur5e"        ".dev.ur5e.pid"
      stop_one "ur5e-teleop" ".dev.ur5e-teleop.pid"
      ;;
    *)
      echo "Usage: $0 stop {ur5e|ur5e-teleop|all}"
      exit 1
      ;;
  esac
}

stop_one() {
  local name="$1" pid_file="$2"
  if [[ ! -f "$pid_file" ]]; then
    echo "$name not running"
    return
  fi
  kill "$(cat "$pid_file")" 2>/dev/null && rm "$pid_file"
  echo "$name stopped"
}

case "${1:-}" in
  start) start "${2:-}" ;;
  stop)  stop  "${2:-}" ;;
  *)     echo "Usage: $0 {start|stop} {ur5e|ur5e-teleop|all}" ; exit 1 ;;
esac
