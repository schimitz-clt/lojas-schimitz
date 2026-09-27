#!/usr/bin/env bash
# Lojas Schimitz — tiny self-hosted uptime monitor (H4). OPTIONAL Railway service "uptime-monitor".
# Checks the site, the API readiness and the payments health every MONITOR_INTERVAL_SECONDS and
# e-mails ALERT_EMAIL_TO through Resend (the account the API already uses) when a target is DOWN
# for MONITOR_FAIL_THRESHOLD consecutive checks, reminds every MONITOR_REMIND_MINUTES, and e-mails
# again when it RECOVERS. Without RESEND_API_KEY/MAIL_FROM/ALERT_EMAIL_TO it only logs (dry run).
#
# Limitation (honest): it runs inside Railway, so a Railway-wide outage also takes the monitor down.
# Pair it with an external free monitor (UptimeRobot / Better Stack) — see docs/OBSERVABILITY.md.
#
# Log lines are JSON: event=MONITOR_START | MONITOR_DOWN | MONITOR_UP | MONITOR_HEARTBEAT | MONITOR_MAIL_FAILED
set -uo pipefail

TARGETS="${MONITOR_TARGETS:-site=https://lojasschimitz.com.br/|api=https://lojasschimitz.com.br/api/v1/health/ready|payments=https://lojasschimitz.com.br/api/v1/health/payments}"
INTERVAL="${MONITOR_INTERVAL_SECONDS:-60}"
FAIL_THRESHOLD="${MONITOR_FAIL_THRESHOLD:-3}"
REMIND_MINUTES="${MONITOR_REMIND_MINUTES:-60}"
TIMEOUT="${MONITOR_TIMEOUT_SECONDS:-15}"
HEARTBEAT_MINUTES="${MONITOR_HEARTBEAT_MINUTES:-60}"
MAX_LOOPS="${MONITOR_MAX_LOOPS:-0}"   # 0 = forever (tests set a number)
RESEND_API_URL="${RESEND_API_URL:-https://api.resend.com/emails}"
ALERT_EMAIL_TO="${ALERT_EMAIL_TO:-}"
MAIL_FROM="${MAIL_FROM:-}"
RESEND_API_KEY="${RESEND_API_KEY:-}"

log() { # level event [jq args...]
  local level="$1" event="$2"; shift 2
  jq -cn --arg level "$level" --arg event "$event" --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$@" \
    '{level:$level, msg:$event, event:$event, ts:$ts} + ($ARGS.named | del(.level, .event, .ts))'
}

brt_now() { TZ=America/Sao_Paulo date '+%d/%m/%Y %H:%M' 2>/dev/null || date -u -d '-3 hours' '+%d/%m/%Y %H:%M'; }

mail_enabled() { [[ -n "$RESEND_API_KEY" && -n "$MAIL_FROM" && -n "$ALERT_EMAIL_TO" ]]; }

send_mail() { # subject text
  local subject="$1" text="$2"
  if ! mail_enabled; then return 0; fi
  local to_json payload code
  to_json=$(printf '%s' "$ALERT_EMAIL_TO" | tr ',; ' '\n\n\n' | sed '/^$/d' | head -5 | jq -R . | jq -cs .)
  payload=$(jq -cn --arg from "$MAIL_FROM" --argjson to "$to_json" --arg subject "$subject" --arg text "$text" \
    '{from:$from, to:$to, subject:$subject, text:$text}')
  code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 -X POST "$RESEND_API_URL" \
    -H "Authorization: Bearer ${RESEND_API_KEY}" -H 'Content-Type: application/json' --data "$payload" 2>/dev/null || echo 000)
  if [[ "$code" != 2* ]]; then
    log error MONITOR_MAIL_FAILED --arg httpStatus "$code"
  fi
}

declare -A FAILS=() STATE=() SINCE=() LAST_ALERT=() LAST_CODE=()
IFS='|' read -r -a PAIRS <<<"$TARGETS"
for pair in "${PAIRS[@]}"; do
  name="${pair%%=*}"; FAILS[$name]=0; STATE[$name]=up; SINCE[$name]=$(date +%s); LAST_ALERT[$name]=0
done

log info MONITOR_START --arg targets "$(printf '%s' "$TARGETS" | sed 's/[?].*//')" --arg interval "$INTERVAL" \
  --arg failThreshold "$FAIL_THRESHOLD" --arg mailEnabled "$(mail_enabled && echo true || echo false)"

loops=0
last_heartbeat=$(date +%s)
while :; do
  for pair in "${PAIRS[@]}"; do
    name="${pair%%=*}"; url="${pair#*=}"
    code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time "$TIMEOUT" -A 'lojas-schimitz-uptime-monitor/1' "$url" 2>/dev/null || true)
    [[ -z "$code" ]] && code=000
    LAST_CODE[$name]=$code
    now=$(date +%s)
    if [[ "$code" == 2* ]]; then
      if [[ "${STATE[$name]}" == down ]]; then
        mins=$(( (now - SINCE[$name]) / 60 ))
        log info MONITOR_UP --arg target "$name" --arg httpStatus "$code" --arg downMinutes "$mins"
        send_mail "[OK Lojas Schimitz] ${name} voltou" \
          "${name} voltou a responder (HTTP ${code}) às $(brt_now) (BRT), depois de ~${mins} min fora.
Endereço verificado: ${url}"
        SINCE[$name]=$now
      fi
      STATE[$name]=up; FAILS[$name]=0
    else
      FAILS[$name]=$(( FAILS[$name] + 1 ))
      if [[ "${STATE[$name]}" == up && ${FAILS[$name]} -ge $FAIL_THRESHOLD ]]; then
        STATE[$name]=down; SINCE[$name]=$now; LAST_ALERT[$name]=$now
        log error MONITOR_DOWN --arg target "$name" --arg httpStatus "$code" --arg consecutiveFails "${FAILS[$name]}"
        send_mail "[ALERTA Lojas Schimitz] ${name} FORA DO AR" \
          "${name} não responde corretamente (HTTP ${code}; 000 = sem resposta/timeout) há ${FAILS[$name]} verificações seguidas.
Horário: $(brt_now) (BRT)
Endereço verificado: ${url}

O que fazer:
- Abra o site no celular para confirmar.
- Railway > projeto > serviço (lojas-schimitz = API, lojas-schimitz-web = site) > Deployments/Logs.
- Pagamentos: https://status.mercadopago.com e /api/v1/health/payments (campo reasons).
Você receberá outro e-mail quando voltar."
      elif [[ "${STATE[$name]}" == down && $(( now - LAST_ALERT[$name] )) -ge $(( REMIND_MINUTES * 60 )) ]]; then
        LAST_ALERT[$name]=$now
        mins=$(( (now - SINCE[$name]) / 60 ))
        log error MONITOR_DOWN --arg target "$name" --arg httpStatus "$code" --arg reminder true --arg downMinutes "$mins"
        send_mail "[ALERTA Lojas Schimitz] ${name} continua fora (${mins} min)" \
          "${name} continua sem responder (HTTP ${code}) — fora há ~${mins} min. Horário: $(brt_now) (BRT).
Endereço: ${url}"
      fi
    fi
  done
  now=$(date +%s)
  if (( now - last_heartbeat >= HEARTBEAT_MINUTES * 60 )); then
    last_heartbeat=$now
    summary=""
    for pair in "${PAIRS[@]}"; do n="${pair%%=*}"; summary+="${n}=${STATE[$n]}(${LAST_CODE[$n]:-?}) "; done
    log info MONITOR_HEARTBEAT --arg status "${summary% }"
  fi
  loops=$((loops + 1))
  if (( MAX_LOOPS > 0 && loops >= MAX_LOOPS )); then exit 0; fi
  sleep "$INTERVAL"
done
