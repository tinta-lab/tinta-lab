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
# 3. On 2026-08-13, the site went down (dangling `current` symlink) because
#    the disk-space prune below sorted releases by mtime and kept the
#    newest N *including* an abandoned, never-linked release dir left behind
#    by an earlier failed deploy (see "Broken release left at ... for
#    inspection" below — that message means exactly this can happen). That
#    abandoned dir was newer than the real `current` release, so it got kept
#    and the actually-live release got pruned instead — out from under a
#    running PM2 process, which then crash-looped for hours (581 restarts on
#    one service) until someone noticed. Fixed by excluding whatever
#    `current` resolves to from deletion candidates entirely, regardless of
#    mtime ordering, in both prune passes below.
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

# 4. On 2026-10-09 a deploy shipped two weeks of uncommitted work-in-progress
#    to prod, because $SRC is also the place people edit code on this box and
#    the build simply takes whatever is on disk. A release must be exactly a
#    commit, so refuse to build from a dirty tree.
if [ -n "$(git -C "$SRC" status --porcelain --untracked-files=normal)" ]; then
  echo "FATAL: $SRC has uncommitted changes — commit or stash them first:"
  git -C "$SRC" status --short
  exit 1
fi

# Never part of a release: secrets (linked from ~/shared below), the repo-root
# data/ and .git/ (anchored with a leading / — an unanchored `data/` also
# matched node_modules/caniuse-lite/data, the very dir that went missing in
# incident #1), and Next's dev-server output / build cache (~500MB per
# release, unused by `next start`). Used for both the copy and the file-count
# check so the two always agree.
EXCLUDES=(.env .env.local /data/ /.git/ .next/dev/ .next/cache/)
RSYNC_EXCLUDES=()
for e in "${EXCLUDES[@]}"; do RSYNC_EXCLUDES+=(--exclude="$e"); done

count_files() {
  find "$1" \( -path '*/.next/dev' -o -path '*/.next/cache' \) -prune \
    -o -type f ! -name .env ! -name .env.local -print 2>/dev/null | wc -l
}

# Unchanged files (in practice: almost all of node_modules) are hardlinked
# from the live release instead of copied — a release costs tens of MB of
# new disk instead of ~2GB, which is what kept filling the 28GB root volume.
LINK_DEST=()
if [ -n "$PREVIOUS_RELEASE" ] && [ -d "$PREVIOUS_RELEASE" ]; then
  LINK_DEST=(--link-dest="$PREVIOUS_RELEASE")
fi

prune_releases() {
  # Lists releases newest-first, drops whatever `current` points to from
  # consideration (re-resolved fresh on every call — this runs both before
  # and after the symlink switch below, and must never delete the live
  # release regardless of which release that currently is), keeps the next
  # $((KEEP - 1)) as rollback points, deletes the rest. See incident #3
  # above for why "current" can't just be inferred from mtime ordering.
  local live
  live="$(readlink -f "$CURRENT_LINK" 2>/dev/null || true)"
  # Newest first by NAME (<YYYY-MM-DD-HHMM>-<slug>), not mtime: rsync -a
  # copies the source dir's mtime onto each new release dir, so mtime order
  # was effectively random — on 2026-10-09 it kept a 3-week-old release as
  # the "rollback point" and pruned the previous good one.
  ls -1d "$RELEASES"/*/ 2>/dev/null \
    | sed 's:/$::' \
    | sort -r \
    | grep -vxF "${live:-__none_will_match__}" \
    | tail -n +"$KEEP" \
    | xargs -r rm -rf
}

echo "==> Disk space check"
avail_kb=$(df --output=avail / | tail -1 | tr -d ' ')
if [ "$avail_kb" -lt 4000000 ]; then  # < ~4GB free
  echo "Only $((avail_kb / 1024))MB free — pruning old releases before building"
  prune_releases
fi

echo "==> Building backend"
(cd "$SRC/backend" && npm run build)
echo "==> Building frontend"
(cd "$SRC/frontend" && npm run build)
echo "==> Building landing"
(cd "$SRC/landing" && npm run build)

echo "==> Copying to $RELEASE"
mkdir -p "$RELEASE"
rsync -a --delete "${RSYNC_EXCLUDES[@]}" "${LINK_DEST[@]}" "$SRC/" "$RELEASE/"

echo "==> Verifying copy is structurally complete"
incomplete=0
for d in backend frontend landing; do
  src_n=$(count_files "$SRC/$d")
  dst_n=$(count_files "$RELEASE/$d")
  if [ "$src_n" != "$dst_n" ]; then
    echo "  $d mismatch ($src_n vs $dst_n files total) — patching with a checksum pass"
    rsync -a --checksum "${RSYNC_EXCLUDES[@]}" "$SRC/$d/" "$RELEASE/$d/"
    dst_n2=$(count_files "$RELEASE/$d")
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
# curl already prints "000" for no connection, so this must not append its
# own fallback: the old `|| echo "000"` produced "000000", which never equals
# "000" — every service counted as healthy on attempt 1 even while down, and
# the auto-rollback below could never trigger (caught 2026-10-09, when a
# deploy logged "OK — backend=000000 frontend=000000 landing=000000").
http_code() { curl -s -o /dev/null -w "%{http_code}" --max-time 3 "$1" 2>/dev/null || true; }
# Down = no response (000) or a 5xx; any other status means the app is
# serving requests (backend answers 404 on /, frontend redirects).
is_up() { [ -n "$1" ] && [ "$1" != "000" ] && [ "${1:0:1}" != "5" ]; }
for i in $(seq 1 15); do
  sleep 2
  backend_code=$(http_code http://localhost:3000/)
  frontend_code=$(http_code http://localhost:3001/)
  landing_code=$(http_code http://localhost:3002/)
  if is_up "$backend_code" && is_up "$frontend_code" && is_up "$landing_code"; then
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
prune_releases

echo "==> Done: $RELEASE"
df -h /
