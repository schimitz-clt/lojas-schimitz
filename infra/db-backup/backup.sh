#!/usr/bin/env bash
# Lojas Schimitz — daily off-DB backup (Railway cron service "db-backup").
#
#  1. pg_dump -Fc of the production Postgres (client 18 == server 18)
#  2. validate the archive (pg_restore -l) + per-table row counts taken FROM the archive
#  3. encrypt client-side with age (public key only here; private key held offline by the owner)
#  4. upload to the Railway Bucket (encrypted at rest by the provider too), verify by re-download + sha256
#  5. weekly copy on Sundays (BRT) — retention: RETAIN_DAILY daily + RETAIN_WEEKLY weekly
#  6. product photos: every /api/v1/uploads/<file> referenced anywhere in the DB is copied (incremental, never deleted)
#
# Every run ends with exactly one JSON line: event=BACKUP_OK or event=BACKUP_FAILED (non-zero exit).
# Read-only against the database. Never prints secrets.
set -Eeuo pipefail

: "${DATABASE_URL:?DATABASE_URL required}"
: "${BACKUP_S3_ENDPOINT:?}" "${BACKUP_S3_BUCKET:?}" "${BACKUP_S3_ACCESS_KEY_ID:?}" "${BACKUP_S3_SECRET_ACCESS_KEY:?}"
: "${BACKUP_AGE_RECIPIENT:?BACKUP_AGE_RECIPIENT (age public key) required}"
RETAIN_DAILY="${RETAIN_DAILY:-7}"
RETAIN_WEEKLY="${RETAIN_WEEKLY:-4}"
MIN_TABLES="${MIN_TABLES:-20}"
UPLOADS_BACKUP="${UPLOADS_BACKUP:-true}"
UPLOADS_URL_RE="${UPLOADS_URL_RE:-https://[A-Za-z0-9.-]+/api/v1/uploads/[A-Za-z0-9._-]+}"
VERIFY_MAX_BYTES="${VERIFY_MAX_BYTES:-524288000}"
P="${BACKUP_PREFIX:-}"   # object key prefix (tests use e.g. _selftest/)

export RCLONE_CONFIG_B_TYPE=s3
export RCLONE_CONFIG_B_PROVIDER=Other
export RCLONE_CONFIG_B_ENDPOINT="$BACKUP_S3_ENDPOINT"
export RCLONE_CONFIG_B_ACCESS_KEY_ID="$BACKUP_S3_ACCESS_KEY_ID"
export RCLONE_CONFIG_B_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET_ACCESS_KEY"
export RCLONE_CONFIG_B_REGION="${BACKUP_S3_REGION:-auto}"
export RCLONE_CONFIG_B_FORCE_PATH_STYLE="${BACKUP_S3_FORCE_PATH_STYLE:-false}"
export RCLONE_S3_NO_CHECK_BUCKET=true
R="B:${BACKUP_S3_BUCKET}"
RC=(rclone --retries 5 --low-level-retries 10 --stats 0 -q)

STEP=init
STARTED=$(date +%s)
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
DAY=$(TZ=America/Sao_Paulo date +%F)
DOW=$(TZ=America/Sao_Paulo date +%u)   # 7 = Sunday
W=$(mktemp -d /tmp/backup.XXXXXX)
trap 'rm -rf "$W"' EXIT
: > "$W/rclone.conf"; export RCLONE_CONFIG="$W/rclone.conf"   # env-only config, silences 'config not found'

log() { # level event [--arg k v ...]  -> one JSON line; Railway shows "message", keeps the rest as attributes
  local level=$1 event=$2; shift 2
  jq -cn --arg ts "$(date -u +%FT%TZ)" --arg level "$level" --arg event "$event" --arg job db-backup "$@" \
    '($ARGS.named | del(.ts,.level,.event,.job)) as $f
     | {message: ([$event] + ($f | to_entries | map("\(.key)=\(.value)")) | join(" ")),
        level:$level, ts:$ts, job:$job, event:$event} + $f'
}
on_err() {
  local code=$? line=$1
  # ERR fires in command-substitution subshells too (set -E); only the main shell logs.
  if [ "$BASHPID" != "$$" ]; then exit "$code"; fi
  log error BACKUP_FAILED --arg step "$STEP" --arg line "$line" --arg exit "$code" \
    --arg elapsedSec "$(( $(date +%s) - STARTED ))" >&2
  exit "$code"
}
trap 'on_err $LINENO' ERR

STEP=preflight
SERVER_VERSION=$(psql "$DATABASE_URL" -XtAc 'show server_version' | awk '{print $1}')
CLIENT_VERSION=$(pg_dump --version | awk '{print $3}')
if [ "${SERVER_VERSION%%.*}" != "${CLIENT_VERSION%%.*}" ]; then
  log error VERSION_MISMATCH --arg server "$SERVER_VERSION" --arg client "$CLIENT_VERSION" >&2
  false
fi
log info BACKUP_START --arg day "$DAY" --arg server "$SERVER_VERSION" --arg client "$CLIENT_VERSION"

STEP=pg_dump
pg_dump -d "$DATABASE_URL" -Fc -Z 6 --no-password -f "$W/db.dump"

STEP=validate
TOC_TABLES=$(pg_restore -l "$W/db.dump" | grep -c ' TABLE DATA ' || true)
if [ "${TOC_TABLES:-0}" -lt "$MIN_TABLES" ]; then
  log error DUMP_TOO_SMALL --arg tables "$TOC_TABLES" --arg min "$MIN_TABLES" >&2
  false
fi
# Row counts from the archive itself (same snapshot as the dump) -> manifest; used by restore drills.
pg_restore -a -f - "$W/db.dump" | awk '
  /^COPY public\./ { t=$2; gsub(/^public\.|"/, "", t); n=0; next }
  /^\\\.$/        { if (t != "") print t "\t" n; t=""; next }
  t != ""          { n++ }' | sort > "$W/counts.tsv"
# Photo references (/api/v1/uploads/<file>) anywhere in the data, from the same archive.
pg_restore -a -f - "$W/db.dump" | grep -oE "$UPLOADS_URL_RE" | sort -u > "$W/upload-urls.txt" || true
PLAIN_SHA=$(sha256sum "$W/db.dump" | awk '{print $1}')
PLAIN_BYTES=$(stat -c %s "$W/db.dump")

STEP=encrypt
age -r "$BACKUP_AGE_RECIPIENT" -o "$W/db.dump.age" "$W/db.dump"
rm -f "$W/db.dump"
ENC_SHA=$(sha256sum "$W/db.dump.age" | awk '{print $1}')
ENC_BYTES=$(stat -c %s "$W/db.dump.age")

BASE="${P}postgres/daily/${DAY}_${STAMP}"
jq -n --arg object "${BASE}.dump.age" --arg createdAt "$(date -u +%FT%TZ)" --arg dayBRT "$DAY" \
  --arg server "$SERVER_VERSION" --arg client "$CLIENT_VERSION" \
  --arg plainSha256 "$PLAIN_SHA" --argjson plainBytes "$PLAIN_BYTES" \
  --arg encSha256 "$ENC_SHA" --argjson encBytes "$ENC_BYTES" --argjson tocTables "$TOC_TABLES" \
  --arg ageRecipient "$BACKUP_AGE_RECIPIENT" --rawfile counts "$W/counts.tsv" \
  '{object:$object,createdAt:$createdAt,dayBRT:$dayBRT,format:"pg_dump -Fc -Z6 | age",
    postgres:{server:$server,pgDumpClient:$client},plainSha256:$plainSha256,plainBytes:$plainBytes,
    encSha256:$encSha256,encBytes:$encBytes,tocTableData:$tocTables,ageRecipient:$ageRecipient,
    rowCounts:($counts|split("\n")|map(select(length>0)|split("\t")|{key:.[0],value:(.[1]|tonumber)})|from_entries)}' \
  > "$W/manifest.json"

STEP=upload
"${RC[@]}" copyto "$W/db.dump.age" "$R/${BASE}.dump.age"
"${RC[@]}" copyto "$W/manifest.json" "$R/${BASE}.manifest.json"

STEP=verify_upload
REMOTE_BYTES=$(rclone lsjson --stat "$R/${BASE}.dump.age" | jq -r '.Size')
[ "$REMOTE_BYTES" = "$ENC_BYTES" ] || { log error SIZE_MISMATCH --arg local "$ENC_BYTES" --arg remote "$REMOTE_BYTES" >&2; false; }
if [ "$ENC_BYTES" -le "$VERIFY_MAX_BYTES" ]; then
  RT_SHA=$(rclone cat "$R/${BASE}.dump.age" | sha256sum | awk '{print $1}')
  [ "$RT_SHA" = "$ENC_SHA" ] || { log error CHECKSUM_MISMATCH >&2; false; }
fi

STEP=weekly
WEEKLY_COPIED=false
HAS_WEEKLY=$(rclone lsf "$R/${P}postgres/weekly/" --include '*.dump.age' 2>/dev/null | head -1 || true)
HAS_TODAY=$(rclone lsf "$R/${P}postgres/weekly/" --include "${DAY}_*.dump.age" 2>/dev/null | head -1 || true)
# One weekly per Sunday (BRT) — re-runs on the same Sunday do not add more; bootstrap if none exists yet.
if { [ "$DOW" = "7" ] && [ -z "$HAS_TODAY" ]; } || [ -z "$HAS_WEEKLY" ]; then
  WB="${P}postgres/weekly/${DAY}_${STAMP}"
  "${RC[@]}" copyto "$R/${BASE}.dump.age" "$R/${WB}.dump.age"
  "${RC[@]}" copyto "$R/${BASE}.manifest.json" "$R/${WB}.manifest.json"
  WEEKLY_COPIED=true
fi

STEP=retention
prune() { # prefix keep
  local prefix=$1 keep=$2 f
  mapfile -t objs < <(rclone lsf "$R/$prefix" --include '*.dump.age' | sort -r)
  local n=0 deleted=0
  for f in "${objs[@]}"; do
    n=$((n+1))
    if [ "$n" -gt "$keep" ]; then
      "${RC[@]}" deletefile "$R/$prefix$f"
      "${RC[@]}" deletefile "$R/$prefix${f%.dump.age}.manifest.json" || true
      deleted=$((deleted+1))
    fi
  done
  echo "$deleted"
}
PRUNED_DAILY=$(prune "${P}postgres/daily/" "$RETAIN_DAILY")
PRUNED_WEEKLY=$(prune "${P}postgres/weekly/" "$RETAIN_WEEKLY")

STEP=uploads
UP_REF=0; UP_NEW=0; UP_FAIL=0
if [ "$UPLOADS_BACKUP" = "true" ]; then
  "${RC[@]}" lsf "$R/${P}uploads/files/" > "$W/have.txt" 2>/dev/null || : > "$W/have.txt"
  while IFS= read -r url; do
    [ -n "$url" ] || continue
    UP_REF=$((UP_REF+1))
    name=${url##*/}
    grep -qxF "$name" "$W/have.txt" && continue
    if curl -fsS --retry 3 --max-time 60 -o "$W/u.bin" "$url" && [ -s "$W/u.bin" ]; then
      "${RC[@]}" copyto "$W/u.bin" "$R/${P}uploads/files/$name"
      UP_NEW=$((UP_NEW+1))
    else
      UP_FAIL=$((UP_FAIL+1))
      log warn UPLOAD_FETCH_FAILED --arg file "$name" >&2
    fi
    rm -f "$W/u.bin"
  done < "$W/upload-urls.txt"
  sed 's#.*/##' "$W/upload-urls.txt" | jq -R . | jq -s --arg day "$DAY" '{dayBRT:$day,referenced:.}' > "$W/uploads-manifest.json"
  "${RC[@]}" copyto "$W/uploads-manifest.json" "$R/${P}uploads/manifests/${DAY}_${STAMP}.json"
  if [ "$UP_FAIL" -gt 0 ]; then
    STEP=uploads_partial
    log error BACKUP_FAILED --arg step "$STEP" --arg reason "photo fetch failed (DB backup itself OK: ${BASE}.dump.age)" \
      --arg uploadsFailed "$UP_FAIL" >&2
    exit 3
  fi
fi

STEP=done
log info BACKUP_OK --arg object "${BASE}.dump.age" --arg encBytes "$ENC_BYTES" --arg encSha256 "$ENC_SHA" \
  --arg plainBytes "$PLAIN_BYTES" --arg plainSha256 "$PLAIN_SHA" --arg tables "$TOC_TABLES" \
  --arg weeklyCopied "$WEEKLY_COPIED" --arg prunedDaily "$PRUNED_DAILY" --arg prunedWeekly "$PRUNED_WEEKLY" \
  --arg uploadsReferenced "$UP_REF" --arg uploadsNew "$UP_NEW" --arg elapsedSec "$(( $(date +%s) - STARTED ))"
