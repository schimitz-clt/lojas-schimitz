/**
 * CSP probe do Card Payment Brick (Mercado Pago SDK v2) — evidência para storefront-csp.ts.
 *
 * Serve uma página mínima com a CSP informada, carrega https://sdk.mercadopago.com/js/v2,
 * monta o cardPayment Brick (sem submit: nada é tokenizado nem cobrado), digita um número de
 * cartão de TESTE público do MP nos Secure Fields (dispara BIN/parcelas) e registra:
 * eventos securitypolicyviolation, mensagens "Refused"/CORS do console e hosts por tipo.
 *
 * Uso (do diretório apps/web, com playwright-core instalado à parte e Chrome no sistema):
 *   curl -s -D - -o /dev/null https://lojasschimitz.com.br/ | grep -i '^content-security-policy:' \
 *     | sed 's/^[^:]*: //' | tr -d '\r' > /tmp/prod-csp.txt
 *   MP_PUBLIC_KEY=APP_USR-... CSP_FILE=/tmp/prod-csp.txt node scripts/csp-probe-mp.mjs enforce
 *   # modo "none" = sem CSP (linha de base); REAL_ORIGIN=1 (+ sudo, porta 443, TLS_KEY/TLS_CERT
 *   # autoassinados) serve em https://lojasschimitz.com.br via --host-resolver-rules (origem real).
 * Resultado de 09/10/2026: docs/SECURITY-CSP-2026-10-09.md.
 */
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import { chromium } from 'playwright-core';
const csp = fs.readFileSync(process.env.CSP_FILE || 'prod-csp.txt','utf8').trim();
// Public key only (the same one shipped in the storefront bundle). Never a secret/access token.
const pk = (process.env.MP_PUBLIC_KEY || '').trim();
if (!pk) { console.error('Defina MP_PUBLIC_KEY (chave PÚBLICA do Mercado Pago).'); process.exit(2); }
const mode = process.argv[2] || 'enforce';
const page = `<!doctype html><html><head><meta charset=utf-8></head><body>
<div id="c"></div>
<script>
window.__v=[];
document.addEventListener('securitypolicyviolation',e=>window.__v.push({d:e.effectiveDirective,b:e.blockedURI,s:e.sourceFile,disp:e.disposition}));
const s=document.createElement('script');s.src='https://sdk.mercadopago.com/js/v2';
s.onload=async()=>{try{const mp=new MercadoPago(${JSON.stringify(pk)},{locale:'pt-BR'});
await mp.bricks().create('cardPayment','c',{initialization:{amount:100},callbacks:{onReady:()=>{window.__ready=true},onError:e=>{window.__err=String(e&&e.message||e)},onSubmit:async()=>{}}});}catch(e){window.__err=String(e)}};
s.onerror=()=>{window.__err='sdk load failed'};document.body.appendChild(s);
</script></body></html>`;
const handler=(req,res)=>{const h={'content-type':'text/html'}; if(mode==='enforce') h['content-security-policy']=csp; res.writeHead(200,h); res.end(page);};
const REAL=process.env.REAL_ORIGIN==='1';
const srv = REAL ? https.createServer({key:fs.readFileSync(process.env.TLS_KEY||'k.pem'),cert:fs.readFileSync(process.env.TLS_CERT||'c.pem')},handler).listen(443) : http.createServer(handler).listen(5099);
const browser = await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox',...(REAL?['--host-resolver-rules=MAP lojasschimitz.com.br 127.0.0.1','--ignore-certificate-errors']:[])]});
const ctx = await browser.newContext({locale:'pt-BR'});
const p = await ctx.newPage();
const hosts = {}; const failed=[]; const consoleRefused=[];
p.on('request', r=>{try{const u=new URL(r.url()); const k=r.resourceType()+' '+u.protocol+'//'+u.host; const fr=r.frame(); const top = fr===p.mainFrame(); hosts[(top?'TOP ':'IFRAME ')+k]=(hosts[(top?'TOP ':'IFRAME ')+k]||0)+1;}catch{}});
p.on('requestfailed', r=>failed.push(r.url().slice(0,120)+' '+(r.failure()?.errorText||'')));
p.on('console', m=>{const t=m.text(); if(/Refused|Content Security Policy|CORS|Access-Control/i.test(t)) consoleRefused.push(t.slice(0,300));});
await p.goto(REAL?'https://lojasschimitz.com.br/__csp_probe':'http://localhost:5099/');
await p.waitForTimeout(12000);
// type a public MP test card number into the card number secure field to trigger BIN/installments lookups
const fu = p.frames().map(f=>f.url().split('?')[0]);
try{ const sf = p.frames().filter(f=>/secure-fields/.test(f.url()));
 const vals=['4235647728025682','1130','123'];
 for (let i=0;i<sf.length;i++){ const inp = await sf[i].$('input'); if(inp){ await inp.type(vals[i]||'1',{delay:40}); } }
}catch(e){console.log('type err',e.message)}
await p.waitForTimeout(8000);
const v = await p.evaluate(()=>({v:window.__v,ready:!!window.__ready,err:window.__err||null}));
console.log(JSON.stringify({mode,ready:v.ready,err:v.err,violations:v.v,consoleRefused,failed:failed.slice(0,20),frameUrls:fu,frames:p.frames().map(f=>{try{return new URL(f.url()).host}catch{return f.url()}}),hosts},null,1));
await browser.close(); srv.close();
