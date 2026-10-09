// Simula a barra de endereço do Chrome Android recolhendo/expandindo durante a rolagem (altura da viewport muda a cada frame).
const { chromium } = require('playwright-core'); const fs=require('fs');
const base=process.argv[2]||'https://lojasschimitz.com.br', tag=process.argv[3]||'x', path=process.argv[4]||'/';
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const c=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true}); const p=await c.newPage(); const cdp=await c.newCDPSession(p);
await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
await p.goto(base+path,{waitUntil:'networkidle'}); await p.waitForTimeout(2500);
await p.evaluate(()=>{window.__vv=0; window.visualViewport.addEventListener('resize',()=>window.__vv++); window.visualViewport.addEventListener('scroll',()=>window.__vv++);});
await b.startTracing(p,{path:`vv-${tag}.json`,categories:['devtools.timeline','disabled-by-default-devtools.timeline']});
const scroll=(async()=>{for(let i=0;i<6;i++){await cdp.send('Input.synthesizeScrollGesture',{x:200,y:650,yDistance:-600,speed:1200,gestureSourceType:'touch'});await p.waitForTimeout(150);}})();
const jitter=(async()=>{for(let i=0;i<90;i++){const h=844+Math.round(56*(0.5+0.5*Math.sin(i/6)));await cdp.send('Emulation.setDeviceMetricsOverride',{width:390,height:h,deviceScaleFactor:2,mobile:true});await p.waitForTimeout(16);}})();
await Promise.all([scroll,jitter]); await p.waitForTimeout(500);
const vv=await p.evaluate(()=>window.__vv); await b.stopTracing(); await b.close();
const ev=JSON.parse(fs.readFileSync(`vv-${tag}.json`)).traceEvents; const a={};
for(const e of ev){ if(e.ph==='X'&&e.dur&&['UpdateLayoutTree','Layout','Paint','RunTask'].includes(e.name)){const x=a[e.name]||(a[e.name]={ms:0,n:0});x.ms+=e.dur/1000;x.n++;} }
for(const k in a)a[k].ms=Math.round(a[k].ms); console.log(JSON.stringify({tag,path,vvEvents:vv,...a}));
})();
