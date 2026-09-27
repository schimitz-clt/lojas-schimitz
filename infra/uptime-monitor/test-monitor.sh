#!/usr/bin/env bash
# Local test for monitor.sh: real HTTP servers on 127.0.0.1 (a healthy target, a target that goes
# down and comes back, and a capture endpoint standing in for Resend). No internet, no real e-mail.
set -euo pipefail
cd "$(dirname "$0")"
WORK=$(mktemp -d)
trap 'kill $(jobs -p) 2>/dev/null || true; rm -rf "$WORK"' EXIT

cat >"$WORK/srv.py" <<'PY'
import http.server, json, os, sys
mode_file, cap_file, port = sys.argv[1], sys.argv[2], int(sys.argv[3])
class H(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        code = 200
        if self.path.startswith('/flaky'):
            code = int(open(mode_file).read().strip() or 200)
        self.send_response(code); self.end_headers(); self.wfile.write(b'ok')
    def do_POST(self):
        n = int(self.headers.get('content-length', 0)); body = self.rfile.read(n)
        with open(cap_file, 'a') as f:
            f.write(json.dumps({'auth': self.headers.get('authorization'), 'body': json.loads(body)}) + '\n')
        self.send_response(200); self.end_headers(); self.wfile.write(b'{"id":"local"}')
http.server.HTTPServer(('127.0.0.1', port), H).serve_forever()
PY
PORT=$(python3 -c 'import socket;s=socket.socket();s.bind(("127.0.0.1",0));print(s.getsockname()[1])')
echo 200 >"$WORK/mode"; : >"$WORK/cap"
python3 "$WORK/srv.py" "$WORK/mode" "$WORK/cap" "$PORT" & sleep 0.5
B="http://127.0.0.1:$PORT"

run() { # loops
  MONITOR_TARGETS="ok=$B/ok|flaky=$B/flaky" MONITOR_INTERVAL_SECONDS=0 MONITOR_FAIL_THRESHOLD=3 \
  MONITOR_REMIND_MINUTES=60 MONITOR_TIMEOUT_SECONDS=3 MONITOR_MAX_LOOPS="$1" \
  RESEND_API_URL="$B/emails" RESEND_API_KEY=re_test_local MAIL_FROM='Loja <a@b.c>' ALERT_EMAIL_TO='dono@x.com' \
  ./monitor.sh
}

# 1) healthy: no mail
run 3 >"$WORK/out1"; [[ ! -s "$WORK/cap" ]] || { echo "FAIL: mail while healthy"; exit 1; }

# 2) 2 failures < threshold → no alert; 3rd → exactly one DOWN mail
echo 503 >"$WORK/mode"; run 2 >"$WORK/out2"; [[ ! -s "$WORK/cap" ]] || { echo "FAIL: alerted before threshold"; exit 1; }
run 5 >"$WORK/out3"
grep -q '"MONITOR_DOWN"' "$WORK/out3" || { echo "FAIL: no MONITOR_DOWN log"; cat "$WORK/out3"; exit 1; }
[[ $(wc -l <"$WORK/cap") -eq 1 ]] || { echo "FAIL: expected 1 mail, got $(wc -l <"$WORK/cap")"; exit 1; }
jq -e '.body.subject | test("flaky FORA DO AR")' "$WORK/cap" >/dev/null
jq -e '.body.to == ["dono@x.com"] and .auth == "Bearer re_test_local"' "$WORK/cap" >/dev/null

# 3) recovery within the same run → UP mail
: >"$WORK/cap"; echo 000 >"$WORK/mode"
( sleep 0.3; echo 200 >"$WORK/mode" ) &
MONITOR_TARGETS="flaky=$B/flaky" MONITOR_INTERVAL_SECONDS=0.1 MONITOR_FAIL_THRESHOLD=1 MONITOR_MAX_LOOPS=40 \
  RESEND_API_URL="$B/emails" RESEND_API_KEY=re_test_local MAIL_FROM='a@b.c' ALERT_EMAIL_TO='dono@x.com' ./monitor.sh >"$WORK/out4" || true
grep -q '"MONITOR_UP"' "$WORK/out4" || { echo "FAIL: no MONITOR_UP"; cat "$WORK/out4"; exit 1; }
jq -se 'map(.body.subject) | any(test("voltou"))' "$WORK/cap" >/dev/null || { echo "FAIL: no recovery mail"; cat "$WORK/cap"; exit 1; }

# 4) unreachable port (000) counts as down; dry run (no key) sends nothing but logs
: >"$WORK/cap"
MONITOR_TARGETS="dead=http://127.0.0.1:1/" MONITOR_INTERVAL_SECONDS=0 MONITOR_FAIL_THRESHOLD=2 MONITOR_MAX_LOOPS=2 \
  MONITOR_TIMEOUT_SECONDS=2 RESEND_API_URL="$B/emails" ./monitor.sh >"$WORK/out5"
grep -q '"httpStatus":"000"' "$WORK/out5" && grep -q '"mailEnabled":"false"' "$WORK/out5"
[[ ! -s "$WORK/cap" ]] || { echo "FAIL: dry run sent mail"; exit 1; }

# 5) every log line is valid JSON
cat "$WORK"/out* | jq -e . >/dev/null
echo "uptime-monitor tests OK"
