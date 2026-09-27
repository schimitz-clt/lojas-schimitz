# Daily off-DB backup job (Railway cron service "db-backup").
# pg_dump client MUST match the server major (Postgres 18.x) — the official image pins it.
FROM postgres:18-trixie
RUN apt-get update \
  && apt-get install -y --no-install-recommends age rclone jq curl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /job
COPY backup.sh /job/backup.sh
RUN chmod 0755 /job/backup.sh && useradd -r -u 10001 -m dbbackup
USER dbbackup
ENTRYPOINT ["/job/backup.sh"]
