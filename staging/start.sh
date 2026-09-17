#!/usr/bin/env bash
# Staging harness — isolated from production. Starts:
#   backend  (plain HTTP)  :3010  DB=tinta_lab_staging
#   https-proxy (TLS front for the backend, self-signed cert) :3012 -> :3010
#   frontend (Next dev, --experimental-https, self-signed cert) :3011
#
# Nothing here touches the production PM2 processes, the production .env,
# or the production database.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$PWD"
mkdir -p staging/logs staging/pids

echo "[staging] backend (port 3010, DB=tinta_lab_staging)..."
(
  cd backend
  set -a; source .env.staging; set +a
  exec npx nest start
) > staging/logs/backend.log 2>&1 &
echo $! > staging/pids/backend.pid

timeout 60 bash -c 'until curl -sf http://localhost:3010 >/dev/null 2>&1 || curl -s -o /dev/null -w "%{http_code}" http://localhost:3010 | grep -q "^[0-9]"; do sleep 1; done' \
  || { echo "[staging] backend failed to come up — see staging/logs/backend.log"; exit 1; }
echo "[staging] backend up."

echo "[staging] https proxy for backend (port 3012 -> 3010)..."
node staging/https-proxy.js 3012 localhost 3010 > staging/logs/https-proxy-backend.log 2>&1 &
echo $! > staging/pids/https-proxy-backend.pid
sleep 1

echo "[staging] frontend (port 3021, plain HTTP, internal only)..."
(
  cd frontend
  export NEXT_PUBLIC_API_URL=https://localhost:3012
  export NEXT_PUBLIC_APP_URL=https://localhost:3011
  exec npx next dev -p 3021
) > staging/logs/frontend.log 2>&1 &
echo $! > staging/pids/frontend.pid

timeout 60 bash -c 'until curl -sf http://localhost:3021 >/dev/null 2>&1; do sleep 1; done' \
  || { echo "[staging] frontend failed to come up — see staging/logs/frontend.log"; exit 1; }
echo "[staging] frontend up (internal)."

echo "[staging] https proxy for frontend (port 3011 -> 3021)..."
node staging/https-proxy.js 3011 localhost 3021 > staging/logs/https-proxy-frontend.log 2>&1 &
echo $! > staging/pids/https-proxy-frontend.pid
sleep 1

echo
echo "[staging] ready:"
echo "  App:     https://localhost:3011"
echo "  API:     https://localhost:3012  (proxies http://localhost:3010)"
echo "  Logs:    staging/logs/*.log"
echo "  Stop:    staging/stop.sh"
echo "  Seed:    cd backend && set -a && source .env.staging && set +a && npx ts-node -r tsconfig-paths/register scripts/staging-seed.ts"
