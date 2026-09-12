#!/usr/bin/env bash
# MEGA Phase 5 smoke — read-only curls (no charges, no DB writes, no secrets).
set -euo pipefail
APEX="${APEX:-https://lojasschimitz.com.br}"
WWW="${WWW:-https://www.lojasschimitz.com.br}"
fail=0
pass() { echo "PASS  $*"; }
fail_() { echo "FAIL  $*"; fail=1; }

echo "=== MEGA Phase 5 smoke @ $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="

# 1) health
code=$(curl -sS -o /tmp/p5-health.json -w '%{http_code}' "$APEX/api/v1/health")
if [[ "$code" == "200" ]] && grep -q '"ok":true' /tmp/p5-health.json; then
  pass "health HTTP $code"
else
  fail_ "health HTTP $code body=$(head -c 200 /tmp/p5-health.json)"
fi

# 2) products
code=$(curl -sS -o /tmp/p5-products.json -w '%{http_code}' "$APEX/api/v1/products?pageSize=1")
if [[ "$code" == "200" ]] && grep -q '"ok":true' /tmp/p5-products.json; then
  pass "products HTTP $code"
else
  fail_ "products HTTP $code"
fi

# 3) www 301 → apex
headers=$(curl -sSI "$WWW/")
loc=$(printf '%s' "$headers" | tr -d '\r' | awk -F': ' 'tolower($1)=="location"{print $2; exit}')
status=$(printf '%s' "$headers" | tr -d '\r' | awk 'NR==1{print $2}')
if [[ "$status" == "301" && "$loc" == "$APEX/" ]]; then
  pass "www 301 → $loc"
else
  fail_ "www expected 301→$APEX/ got status=$status loc=$loc"
fi

# 4) assetlinks
code=$(curl -sS -o /tmp/p5-assetlinks.json -w '%{http_code}' "$APEX/.well-known/assetlinks.json")
if [[ "$code" == "200" ]] && grep -q 'com.lojasschimitz.app' /tmp/p5-assetlinks.json; then
  pass "assetlinks HTTP $code (package present)"
else
  fail_ "assetlinks HTTP $code"
fi

# 5) refresh 401 + cookie clear (empty body/cookie → clearRefreshCookie before 401)
curl -sS -D /tmp/p5-refresh.hdr -o /tmp/p5-refresh.json -X POST "$APEX/api/v1/auth/refresh" \
  -H 'Content-Type: application/json' -d '{}' >/dev/null
status=$(tr -d '\r' </tmp/p5-refresh.hdr | awk 'NR==1{print $2}')
setc=$(tr -d '\r' </tmp/p5-refresh.hdr | awk -F': ' 'tolower($1)=="set-cookie"{print $2; exit}')
if [[ "$status" == "401" ]] && printf '%s' "$setc" | grep -qi 'sch_refresh=' && printf '%s' "$setc" | grep -qi 'Max-Age=0'; then
  pass "refresh 401 + sch_refresh cleared (Max-Age=0)"
else
  fail_ "refresh status=$status set-cookie=$setc body=$(head -c 160 /tmp/p5-refresh.json)"
fi

# 6) webhook 401
code=$(curl -sS -o /tmp/p5-webhook.json -w '%{http_code}' -X POST \
  "$APEX/api/v1/webhooks/mercadopago" -H 'Content-Type: application/json' -d '{}')
if [[ "$code" == "401" ]] && grep -q 'WEBHOOK_SIGNATURE_INVALID' /tmp/p5-webhook.json; then
  pass "webhook 401 WEBHOOK_SIGNATURE_INVALID"
else
  fail_ "webhook HTTP $code body=$(head -c 200 /tmp/p5-webhook.json)"
fi

# 7) robots / sitemap sanity (apex hosts)
robots=$(curl -sS "$APEX/robots.txt")
if printf '%s' "$robots" | grep -q 'Sitemap: https://lojasschimitz.com.br/sitemap.xml'; then
  pass "robots sitemap apex"
else
  fail_ "robots missing apex sitemap"
fi

echo "=== done fail=$fail ==="
exit "$fail"
