#!/bin/bash
# lh.sh <url> <outname>
url=$1; out=/workspace/ls-final-evidence/carousel/lighthouse; mkdir -p $out
CHROME_PATH=/usr/bin/google-chrome ./node_modules/.bin/lighthouse "$url" --quiet --only-categories=performance --form-factor=mobile --throttling-method=simulate \
  --chrome-flags="--headless=new --no-sandbox --host-resolver-rules='MAP loja.test 127.0.0.1' --ignore-certificate-errors" \
  --output=json --output-path=$out/$2.json >/dev/null 2>&1
python3 -c "
import json;r=json.load(open('$out/$2.json'));a=r['audits']
print('$2', 'perf',round(r['categories']['performance']['score']*100),'TBT',round(a['total-blocking-time']['numericValue']),'CLS',round(a['cumulative-layout-shift']['numericValue'],3),'LCP',round(a['largest-contentful-paint']['numericValue']),'FCP',round(a['first-contentful-paint']['numericValue']),'SI',round(a['speed-index']['numericValue']))"
