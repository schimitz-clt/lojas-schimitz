# Backup & Restore — Lojas Schimitz (production)

Status: **active since 2026-09-27**. This closes audit finding **C1** (no automated backups) without Railway Pro.

## 1. Design

```
Railway cron service "db-backup"  (daily 06:15 UTC = 03:15 BRT, runs about 5 s, then exits)
  image: postgres:18-trixie (pg_dump 18 == server 18.x) + age + rclone + jq + curl   [infra/db-backup/]
  │
  ├─ pg_dump -Fc -Z6  ──►  validate (pg_restore -l, ≥ MIN_TABLES)  ──►  row counts per table (from the archive)
  ├─ age encrypt (public key only; private key is OFFLINE)  ──►  sha256
  ├─ upload to Railway Bucket "db-backups" (iad, private, encrypted at rest by Tigris)
  │     postgres/daily/<BRT-date>_<UTC-stamp>.dump.age  + .manifest.json
  │     postgres/weekly/…   (copy made on Sundays, BRT; the first run also bootstraps one)
  ├─ verify: remote size == local size, re-download sha256 == local sha256
  ├─ retention: keep newest 7 daily + 4 weekly (older dumps and their manifests are deleted)
  └─ photos: every https://…/api/v1/uploads/<file> referenced anywhere in the DB is copied to
        uploads/files/<file> (incremental, never deleted) + uploads/manifests/<date>.json
```

- **Database connection:** private network (`${{Postgres.DATABASE_URL}}` → `postgres.railway.internal`). The job is read-only (`pg_dump` only).
- **Bucket credentials:** Railway references `${{db-backups.*}}`, set only on the `db-backup` service.
- **Encryption:**
  1. Railway Buckets are encrypted at rest. They have no SSE, versioning or object lock.
  2. On top of that, each dump is encrypted client-side with **age**. The service only holds the public key (`BACKUP_AGE_RECIPIENT`), so a leak of the bucket credentials does not expose data.
  3. Photos are stored unencrypted, because they are already public on the site.
- **Photos, full snapshot:** the cron cannot mount the API's volume. So a one-time full snapshot of the whole `lojas-schimitz-uploads` volume (38 files, 44.7 MB, `SHA256SUMS` included) was taken on 2026-09-27 into `uploads/volume-snapshots/2026-09-27/`. After that, the daily job copies every *referenced* photo. Orphan files that appear on the volume after the snapshot (uploaded but not referenced by any row) are **not** backed up. Refresh the snapshot manually if needed (section 5).
- **Failure visibility:** every run ends with one JSON log line whose `message` is `BACKUP_OK …` or `BACKUP_FAILED step=<step> …`, and the exit code is non-zero on failure.
  - Railway marks the cron run as failed. Railway forces `restartPolicy=NEVER` for cron services, so **there is no automatic retry**.
  - Search Railway logs for `BACKUP_FAILED`. Alerting comes in improvement #4.
  - The photo step fails with `step=uploads_partial` (exit 3) *after* the DB dump has already been stored.

| Service variable (db-backup) | Value |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `BACKUP_S3_ENDPOINT/BUCKET/ACCESS_KEY_ID/SECRET_ACCESS_KEY/REGION` | `${{db-backups.ENDPOINT}}`, … |
| `BACKUP_AGE_RECIPIENT` | `age1lfc7gdmxx4wyr0ka6cve7av57zwcrf9qluv9ew3mgxvdxrtqnc2qyp4rck` (public key) |
| `RETAIN_DAILY` / `RETAIN_WEEKLY` | `7` / `4` |
| `MIN_TABLES` | `20` (prod has 47) |
| `UPLOADS_BACKUP` | `true` |

### The age private key (CRITICAL)

The private key (`AGE-SECRET-KEY-1…`) is the **only** way to decrypt the dumps. It is **not** in Railway or GitHub. It was generated on the ops box at `/workspace/secrets/db-backup-age.key`. **The owner must keep a copy offline** (password manager plus a printed copy). If you lose it, every encrypted backup is useless. If it leaks, generate a new pair, update `BACKUP_AGE_RECIPIENT`, and keep the old key for the old dumps.

## 2. Restore procedure

Requirements: `rclone` (or any S3 client), `age`, PostgreSQL **18** client tools (`pg_restore`), the bucket credentials (Railway → `db-backups` → Credentials), and the age private key.

```bash
# 0) S3 access via env (no config file needed)
export RCLONE_CONFIG_B_TYPE=s3 RCLONE_CONFIG_B_PROVIDER=Other RCLONE_CONFIG_B_FORCE_PATH_STYLE=false \
       RCLONE_CONFIG_B_ENDPOINT=https://t3.storageapi.dev RCLONE_CONFIG_B_REGION=iad \
       RCLONE_CONFIG_B_ACCESS_KEY_ID=… RCLONE_CONFIG_B_SECRET_ACCESS_KEY=… RCLONE_S3_NO_CHECK_BUCKET=true
B=B:db-backups-8yum22rdtlt52z

# 1) pick a backup (newest last)
rclone lsl $B/postgres/daily/ ; rclone lsl $B/postgres/weekly/
OBJ=postgres/daily/2026-09-27_20260927T180714Z

# 2) download + verify integrity against the manifest
rclone copyto $B/$OBJ.dump.age ./db.dump.age
rclone copyto $B/$OBJ.manifest.json ./manifest.json
[ "$(sha256sum db.dump.age | cut -d' ' -f1)" = "$(jq -r .encSha256 manifest.json)" ] && echo ENC_OK

# 3) decrypt + verify
age -d -i /path/to/db-backup-age.key -o db.dump db.dump.age
[ "$(sha256sum db.dump | cut -d' ' -f1)" = "$(jq -r .plainSha256 manifest.json)" ] && echo PLAIN_OK

# 4) restore into an EMPTY database (never over the live prod DB)
createdb restore_target
pg_restore --no-owner --no-acl --exit-on-error -d "postgresql://…/restore_target" db.dump

# 5) verify row counts == manifest
psql "postgresql://…/restore_target" -XtA -F$'\t' -c "select table_name,
  (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', table_name), false, true, '')))[1]::text
  from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by 1" | sort > restored.tsv
jq -r '.rowCounts|to_entries[]|"\(.key)\t\(.value)"' manifest.json | sort > expected.tsv
diff expected.tsv restored.tsv && echo "ROW COUNTS MATCH"
```

### Disaster recovery onto production (needs the owner's explicit OK)

1. Freeze writes: put the site in maintenance, or scale the API to 0 in the Railway dashboard.
2. Take a `pg_dump` of the current (broken) DB, if it is reachable, for forensics.
3. Restore into a **new, empty** Postgres (a new Railway Postgres service or a new database). Verify with steps 2–5 above.
4. Point the API `DATABASE_URL` at it, redeploy the API (migrations are already in the dump), and smoke test `/api/v1/health/ready`, home, login, and one order read.
5. Photos: copy `uploads/files/*` (and, if needed, `uploads/volume-snapshots/<date>/*`) back into the API volume at `/data/uploads`, e.g. `railway volume files upload`.
6. Run reconciliation (read-only) and compare the financial ledger with Mercado Pago.

RPO is ≤ 24 h, since backups are daily (changes since the last 03:15 BRT run are lost). RTO is minutes at the current size: a 0.64 MB dump restores in about 0.2 s locally.

## 3. Operations

- **Run a backup now:** Railway dashboard → `db-backup` → Deployments → *Run now* (cron). Alternatively, temporarily set the cron schedule a few minutes ahead and redeploy the service; set it back afterwards.
- **Change the schedule or retention:** edit the `db-backup` service settings or variables (UTC cron, min 5-min interval).
- **Deploy the job code:** `railway up infra/db-backup --path-as-root -s db-backup -e production`. It is not connected to GitHub, so a merge does **not** redeploy it. This is deliberate, so prod API/web watch patterns are unaffected.
- **Manual pre-change backups** (e.g. before migrations) can still go to `/workspace/backups/` on the ops box. Those are extra copies, not a replacement.

## 4. Restore drill log

| Date (BRT) | Backup object | Result |
|---|---|---|
| 2026-09-27 ~14:56 | `postgres/daily/2026-09-27_20260927T175315Z.dump.age` (632 059 B) | encSha256 and plainSha256 match the manifest. Restored into a local PG 18.6 in 216 ms. **47/47 tables, 5 651/5 651 rows match the manifest**. 32 migrations. Ledger net 1.00+165.30−30.40. 6/6 photos byte-identical to live. |

Repeat monthly and append a row.

## 5. Refresh the full photo snapshot (manual)

```bash
railway volume -s lojas-schimitz -e production files --volume lojas-schimitz-uploads list / --json   # names + sizes
# download each file: railway volume … files download /<name> ./snap/<name>
( cd snap && sha256sum * > SHA256SUMS )
rclone copy ./snap $B/uploads/volume-snapshots/$(date +%F)/ && rclone check ./snap $B/uploads/volume-snapshots/$(date +%F)/ --one-way
```
