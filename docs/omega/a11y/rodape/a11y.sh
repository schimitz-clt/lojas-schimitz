#!/bin/bash
# a11y.sh <url> <name> — Lighthouse mobile accessibility, target-size audit
out=/workspace/ls-final-evidence/a11y
CHROME_PATH=/usr/bin/google-chrome ./node_modules/.bin/lighthouse "$1" --quiet --only-categories=accessibility --form-factor=mobile \
  --chrome-flags="--headless=new --no-sandbox --host-resolver-rules='MAP loja.test 127.0.0.1' --ignore-certificate-errors" --output=json --output-path=$out/$2.json >/dev/null 2>&1
python3 -c "
import json;r=json.load(open('$out/$2.json'));a=r['audits']['target-size']
items=(a.get('details') or {}).get('items',[])
print('$2','a11y',round(r['categories']['accessibility']['score']*100),'target-size',a['score'],'falhas',len(items),[ (i.get('node') or {}).get('snippet','')[:40] for i in items])"
