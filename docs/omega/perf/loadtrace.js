const { chromium } = require('playwright-core'); const fs=require('fs');
const base=process.argv[2]||'https://lojasschimitz.com.br', tag=process.argv[3]||'x', path=process.argv[4]||'/';
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const c=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true}); const p=await c.newPage(); const cdp=await c.newCDPSession(p);
await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
await b.startTracing(p,{path:`load-${tag}.json`,categories:['devtools.timeline','disabled-by-default-devtools.timeline','v8.execute','blink.user_timing']});
await p.goto(base+path,{waitUntil:'networkidle'}); await p.waitForTimeout(2000); await b.stopTracing(); await b.close();
const ev=JSON.parse(fs.readFileSync(`load-${tag}.json`)).traceEvents;
const agg={}; for(const e of ev){ if(e.ph==='X'&&e.dur&&['UpdateLayoutTree','Layout','Paint','EvaluateScript','FunctionCall','v8.compile','HitTest','ParseHTML','FireIdleCallback','TimerFire','RunTask'].includes(e.name)){const a=agg[e.name]||(agg[e.name]={ms:0,n:0,max:0});a.ms+=e.dur/1000;a.n++;a.max=Math.max(a.max,e.dur/1000);} }
for(const k in agg){agg[k].ms=Math.round(agg[k].ms);agg[k].max=Math.round(agg[k].max);} console.log(JSON.stringify(agg));
const big=ev.filter(e=>e.ph==='X'&&['UpdateLayoutTree','Layout'].includes(e.name)&&e.dur>20000).map(e=>({n:e.name,ms:Math.round(e.dur/1000),elems:e.args&&e.args.elementCount||e.args&&e.args.beginData&&e.args.beginData.totalObjects,t:Math.round(e.ts/1000)%100000}));
console.log('layouts>20ms',JSON.stringify(big.slice(0,12)));
const fc={}; for(const e of ev){ if(e.name==='FunctionCall'&&e.ph==='X'&&e.dur>15000){const k=((e.args.data.url||'').split('/').pop())+':'+(e.args.data.functionName||'?');fc[k]=(fc[k]||0)+Math.round(e.dur/1000);} } console.log('func>15ms',JSON.stringify(fc));
const es=ev.filter(e=>e.name==='EvaluateScript'&&e.ph==='X'&&e.dur>20000).map(e=>({u:(e.args.data.url||'').split('/').pop(),ms:Math.round(e.dur/1000)})); console.log('evalscript>20ms',JSON.stringify(es));
})();
