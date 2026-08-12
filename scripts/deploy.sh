#!/bin/bash
# Deploys tinta-lab: builds backend+frontend+landing, copies into a new
# ~/releases/tinta-lab/<timestamp>-<slug> dir, verifies the copy is
# structurally complete, switches the `current` symlink, reloads pm2, and
# prunes old releases.
#
# Why the verification step exists: on 2026-08-12, `rsync -a` silently
# under-copied node_modules twice in a row (exit code 0, no errors) while
# disk space was down to ~1-3GB free — landing crash-looped on a missing
# caniuse-lite/data dir that "successfully" didn't get copied. Root cause
# was accumulated old release dirs (each ~1.8G) eating disk, not rsync or
# the filesystem being flaky. Byte-size comparisons didn't catch it
# (percentages looked like noise); exact file counts did.
#
# Usage: scripts/deploy.sh <slug>
#   e.g. scripts/deploy.sh fix-support-hub-url

set -euo pipefail

SLUG="${1:?Usage: deploy.sh <slug>}"
SRC="/home/tinta/tinta-lab"
RELEASES="/home/tinta/releases/tinta-lab"
KEEP=2  # current release + this many rollback points

RELEASE="$RELEASES/$(date +%Y-%m-%d-%H%M)-$SLUG"

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
  src_n=$(find "$SRC/$d/node_modules" -type f 2>/dev/null | wc -l)
  dst_n=$(find "$RELEASE/$d/node_modules" -type f 2>/dev/null | wc -l)
  if [ "$src_n" != "$dst_n" ]; then
    echo "  $d/node_modules mismatch ($src_n vs $dst_n files) — patching with a checksum pass"
    rsync -a --checksum "$SRC/$d/" "$RELEASE/$d/"
    dst_n2=$(find "$RELEASE/$d/node_modules" -type f 2>/dev/null | wc -l)
    if [ "$src_n" != "$dst_n2" ]; then
      echo "  FATAL: $d/node_modules still incomplete after checksum pass ($src_n vs $dst_n2)"
      incomplete=1
    fi
  fi
done
if [ "$incomplete" != "0" ]; then
  echo "Refusing to deploy an incomplete release. Not switching the symlink."
  echo "Check disk space (df -h /) and investigate $RELEASE manually."
  exit 1
fi
echo "  OK — file counts match for backend, frontend, landing"

echo "==> Linking env files"
ln -sf /home/tinta/shared/backend.env "$RELEASE/backend/.env"
ln -sf /home/tinta/shared/frontend.env.local "$RELEASE/frontend/.env.local"

echo "==> Switching symlink + pm2 reload"
ln -sfn "$RELEASE" /home/tinta/current/tinta-lab
pm2 reload /home/tinta/ecosystem.config.js

echo "==> Pruning old releases (keeping current + $((KEEP - 1)) rollback point(s))"
ls -1dt "$RELEASES"/*/ | tail -n +$((KEEP + 1)) | xargs -r rm -rf

echo "==> Done: $RELEASE"
df -h /
