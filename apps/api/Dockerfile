# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/api/package-lock.json* ./apps/api/
COPY prisma ./prisma
RUN npm install
WORKDIR /app/apps/api
RUN npm install

FROM node:22-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/apps/api/package.json ./apps/api/package.json
COPY prisma ./prisma
COPY apps/api ./apps/api
WORKDIR /app/apps/api
ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build?schema=public"
RUN npm run prisma:generate && npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY apps/api/docker-entrypoint.sh ./apps/api/docker-entrypoint.sh
RUN chmod +x ./apps/api/docker-entrypoint.sh
WORKDIR /app/apps/api
# Persistência: monte volume Railway em /data/uploads e defina UPLOADS_DIR=/data/uploads
RUN mkdir -p /data/uploads
ENV UPLOADS_DIR=/data/uploads
EXPOSE 3001
ENTRYPOINT ["./docker-entrypoint.sh"]
