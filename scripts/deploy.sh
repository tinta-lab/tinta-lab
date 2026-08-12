#!/bin/bash
# Deploys tinta-lab: builds backend+frontend+landing, copies into a new
# ~/releases/tinta-lab/<timestamp>-<slug> dir, verifies the copy is
# structurally complete, switches the `current` symlink, reloads pm2,
# health-checks the result, auto-rolls-back if it's broken, and only then
# prunes old releases.
#
# Why all this exists — two separate incidents on 2026-08-12:
# 1. `rsync -a` silently under-copied node_modules while disk space was
#    tight (exit code 0, no errors) — landing crash-looped on a missing
#    caniuse-lite/data dir. Byte-size comparisons looked like noise (~1.5%);
#    exact file counts didn't. Fixed by verifying file counts and patching
#    gaps with a --checksum pass before going live.
# 2. A full deploy left backend/dist, frontend/.next and landing/.next
#    entirely missing from the new release (root cause unconfirmed — not
#    disk space, which was healthy at the time) and the symlink got
#    switched onto it anyway, taking the whole backend down. The v1 script
#    only verified node_modules, not the build output, and had no
#    post-switch health check. Fixed by verifying full project file counts
#    (not just node_modules) and by health-checking + auto-rolling-back
#    after the switch instead of trusting it blindly.
#
# Usage: scripts/deploy.sh <slug>
#   e.g. scripts/deploy.sh fix-support-hub-url

set -euo pipefail

SLUG="${1:?Usage: deploy.sh <slug>}"
SRC="/home/tinta/tinta-lab"
RELEASES="/home/tinta/releases/tinta-lab"
CURRENT_LINK="/home/tinta/current/tinta-lab"
KEEP=2  # current release + this many rollback points

RELEASE="$RELEASES/$(date +%Y-%m-%d-%H%M)-$SLUG"
PREVIOUS_RELEASE="$(readlink -f "$CURRENT_LINK" 2>/dev/null || true)"

echo "==> Disk space check"
avail_kb=$(df --output=avail / | tail -1 | tr -d ' ')
if [ "$avail_kb" -lt 4000000 ]; then  # < ~4GB free
  echo "Only $((avail_kb / 1024))MB free — pruning old releases before building"
  ls -1dt "$RELEASES"/*/ 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -rf
fi

echo "==> Building backend"
(cd "$SRC/backend" && npm run build)
echo "==> Building frontend"
(cd "$SRC/frontend" && npm run build)
echo "==> Building landing"
(cd "$SRC/landing" && npm run build)

echo "==> Copying to $RELEASE"
mkdir -p "$RELEASE"
rsync -a --delete --exclude='.env' --exclude='.env.local' --exclude='data/' "$SRC/" "$RELEASE/"

echo "==> Verifying copy is structurally complete"
incomplete=0
for d in backend frontend landing; do
  src_n=$(find "$SRC/$d" -type f 2>/dev/null | wc -l)
  dst_n=$(find "$RELEASE/$d" -type f 2>/dev/null | wc -l)
  if [ "$src_n" != "$dst_n" ]; then
    echo "  $d mismatch ($src_n vs $dst_n files total) — patching with a checksum pass"
    rsync -a --checksum "$SRC/$d/" "$RELEASE/$d/"
    dst_n2=$(find "$RELEASE/$d" -type f 2>/dev/null | wc -l)
    if [ "$src_n" != "$dst_n2" ]; then
      echo "  FATAL: $d still incomplete after checksum pass ($src_n vs $dst_n2)"
      incomplete=1
    fi
  fi
done
# Belt and suspenders after the caught-it-live 2026-08-12 incident: even if
# the counts matched, refuse to go anywhere near a release missing its
# actual entrypoints.
for f in "$RELEASE/backend/dist/main.js" "$RELEASE/frontend/.next/BUILD_ID" "$RELEASE/landing/.next/BUILD_ID"; do
  if [ ! -f "$f" ]; then
    echo "  FATAL: expected build output missing: $f"
    incomplete=1
  fi
done
if [ "$incomplete" != "0" ]; then
  echo "Refusing to deploy an incomplete release. Not switching the symlink."
  echo "Broken release left at $RELEASE for inspection — clean it up manually once diagnosed."
  exit 1
fi
echo "  OK — backend, frontend, landing all present and complete"

echo "==> Linking env files"
ln -sf /home/tinta/shared/backend.env "$RELEASE/backend/.env"
ln -sf /home/tinta/shared/frontend.env.local "$RELEASE/frontend/.env.local"

echo "==> Switching symlink + pm2 reload"
ln -sfn "$RELEASE" "$CURRENT_LINK"
pm2 reload /home/tinta/ecosystem.config.js

echo "==> Health-checking the new release"
healthy=0
for i in 1 2 3 4 5 6 7 8 9 10; do
  sleep 2
  backend_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://localhost:3000/ || echo "000")
  frontend_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://localhost:3001/ || echo "000")
  landing_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://localhost:3002/ || echo "000")
  # 000 = connection refused/timeout — anything else means something is listening and responding
  if [ "$backend_code" != "000" ] && [ "$frontend_code" != "000" ] && [ "$landing_code" != "000" ]; then
    healthy=1
    break
  fi
  echo "  attempt $i: backend=$backend_code frontend=$frontend_code landing=$landing_code — retrying"
done

if [ "$healthy" != "1" ]; then
  echo "==> HEALTH CHECK FAILED — rolling back"
  if [ -n "$PREVIOUS_RELEASE" ] && [ -d "$PREVIOUS_RELEASE" ]; then
    ln -sfn "$PREVIOUS_RELEASE" "$CURRENT_LINK"
    pm2 reload /home/tinta/ecosystem.config.js
    echo "Rolled back to $PREVIOUS_RELEASE. Broken release left at $RELEASE for inspection."
  else
    echo "No previous release to roll back to — manual intervention required NOW."
  fi
  exit 1
fi
echo "  OK — backend=$backend_code frontend=$frontend_code landing=$landing_code"

echo "==> Pruning old releases (keeping current + $((KEEP - 1)) rollback point(s))"
ls -1dt "$RELEASES"/*/ | tail -n +$((KEEP + 1)) | xargs -r rm -rf

echo "==> Done: $RELEASE"
df -h /
