#!/bin/sh
set -e
cd /app/apps/api
npx prisma migrate deploy --schema=/app/prisma/schema.prisma
exec node dist/main.js
