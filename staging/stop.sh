#!/usr/bin/env bash
# Stops the staging harness by exact PID, read from the pidfiles start.sh
# wrote under staging/pids/ — never by port and never by process name/pattern
# (see the exact-PID lifecycle rule: a throwaway/staging process is stopped
# by a PID captured at spawn time, not by matching against a port or a
# command-line substring, both of which can collide with something else —
# including, in one real incident, the production PM2 process).
#
# Before killing, each PID is verified to belong to *this* repo by resolving
# /proc/$PID/cwd and checking it's under $ROOT. Production's real backend
# runs from a symlinked release directory (/home/tinta/current/tinta-lab ->
# /home/tinta/releases/tinta-lab/<...>), never from this working copy, so
# this check alone is enough to refuse killing it even if something were
# badly misconfigured. The port check below is kept only as an extra sanity
# signal printed to the log, not as the mechanism used to find the PID.
set -uo pipefail
cd "$(dirname "$0")/.."
ROOT="$PWD"

stop_one() {
  local name="$1" port="$2"
  local pidfile="staging/pids/${name}.pid"

  if [ ! -f "$pidfile" ]; then
    return 0
  fi

  local pid
  pid=$(cat "$pidfile")

  if ! kill -0 "$pid" 2>/dev/null; then
    echo "[staging] $name: pid $pid (from $pidfile) is not running — removing stale pidfile"
    rm -f "$pidfile"
    return 0
  fi

  local cwd
  cwd=$(readlink -f "/proc/$pid/cwd" 2>/dev/null || true)
  case "$cwd" in
    "$ROOT"|"$ROOT"/*) ;;
    *)
      echo "[staging] $name: pid $pid does not belong to this repo (cwd=${cwd:-unknown}) — refusing to kill it, removing stale pidfile"
      rm -f "$pidfile"
      return 0
      ;;
  esac

  # nest/next dev servers wrap the actual listener several levels deep (npm
  # -> sh -> nest/next CLI -> sh -c -> node) — killing only the tracked pid
  # leaves that tree orphaned and still holding its port (verified by hand).
  # Since start.sh is run non-interactively (no job-control monitor mode),
  # every job it backgrounds — all four services, not just this one — stays
  # in the single process group of that one start.sh invocation, rather than
  # getting its own group the way an interactive shell would give each `&`
  # job. So killing the group of *any* tracked pid here takes down the whole
  # staging harness in one signal (confirmed: freed the port with zero
  # survivors), not just the one named service — which is fine, since this
  # script always stops every service anyway and every kill below stays
  # within that one start.sh invocation's group (confirmed against a live
  # production process and an unrelated pre-existing process on another
  # staging port: neither was affected). It does mean the four stop_one
  # calls below are not independent of each other in practice — treat this
  # as one atomic stop, not four.
  local pgid
  pgid=$(ps -o pgid= -p "$pid" 2>/dev/null | tr -d ' ')

  local port_pid
  port_pid=$(lsof -ti:"$port" -sTCP:LISTEN 2>/dev/null || true)
  if [ -n "$port_pid" ] && [ "$port_pid" != "$pid" ]; then
    echo "[staging] $name: note — port $port is held by pid $port_pid, a few levels below tracked pid $pid (expected for npm/npx-wrapped dev servers); the group kill below covers it"
  fi

  echo "[staging] stopping $name (pid $pid, pgid ${pgid:-$pid}, port $port)"
  if [ -n "$pgid" ]; then
    kill -TERM -- "-$pgid" 2>/dev/null || true
  else
    kill "$pid" 2>/dev/null || true
  fi
  for _ in $(seq 1 10); do
    kill -0 "$pid" 2>/dev/null || break
    sleep 0.2
  done
  if kill -0 "$pid" 2>/dev/null; then
    echo "[staging] $name: pid $pid still alive after SIGTERM — sending SIGKILL to the group"
    if [ -n "$pgid" ]; then
      kill -9 -- "-$pgid" 2>/dev/null || true
    else
      kill -9 "$pid" 2>/dev/null || true
    fi
  fi
  rm -f "$pidfile"
}

stop_one backend 3010
stop_one https-proxy-backend 3012
stop_one frontend 3021
stop_one https-proxy-frontend 3011

echo "[staging] stopped."
