# OPTIONAL Railway service "uptime-monitor" (H4). Tiny always-on loop (bash+curl+jq, ~5 MB RAM).
FROM alpine:3.20
RUN apk add --no-cache bash curl jq tzdata ca-certificates \
  && adduser -D -u 10001 monitor
WORKDIR /app
COPY monitor.sh /app/monitor.sh
RUN chmod 0755 /app/monitor.sh
USER monitor
ENTRYPOINT ["/app/monitor.sh"]
