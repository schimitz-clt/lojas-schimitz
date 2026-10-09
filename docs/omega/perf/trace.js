const { chromium } = require('playwright-core'); const fs=require('fs');
const base=process.argv[2]||'https://lojasschimitz.com.br', tag=process.argv[3]||'x', path=process.argv[4]||'/';
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--enable-gpu-rasterization']});
const c=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true}); const p=await c.newPage(); const cdp=await c.newCDPSession(p);
await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
await p.goto(base+path,{waitUntil:'networkidle'}); await p.waitForTimeout(2500);
await b.startTracing(p,{path:`trace-${tag}.json`,categories:['devtools.timeline','cc','disabled-by-default-devtools.timeline','benchmark','loading','latencyInfo']});
const total=await p.evaluate(()=>document.documentElement.scrollHeight);
for(let i=0;i<4;i++){ await cdp.send('Input.synthesizeScrollGesture',{x:200,y:650,yDistance:-Math.min(900,total/4),speed:1200,gestureSourceType:'touch'}); await p.waitForTimeout(250);}
for(let i=0;i<4;i++){ await cdp.send('Input.synthesizeScrollGesture',{x:200,y:300,yDistance:Math.min(900,total/4),speed:1200,gestureSourceType:'touch'}); await p.waitForTimeout(250);}
await p.waitForTimeout(600); await b.stopTracing(); await b.close();
const ev=JSON.parse(fs.readFileSync(`trace-${tag}.json`)).traceEvents;
const sum={},cnt={};
for(const e of ev){ if(e.ph==='X'&&e.dur&&['UpdateLayoutTree','Layout','Paint','PrePaint','Layerize','Commit','RasterTask','ImageDecodeTask','EvaluateScript','FunctionCall','FireAnimationFrame','HitTest','ScrollLayer','CompositeLayers','UpdateLayer','IntersectionObserverController::computeIntersections','TimerFire','EventDispatch','RunTask','ParseHTML','GPUTask','DecodeImage','Decode Image','ResourceReceivedData'].includes(e.name)){sum[e.name]=(sum[e.name]||0)+e.dur/1000;cnt[e.name]=(cnt[e.name]||0)+1;} }
const tasks=ev.filter(e=>e.ph==='X'&&e.name==='RunTask'&&e.dur>16000&&e.cat.includes('toplevel')||false);
const rt=ev.filter(e=>e.ph==='X'&&e.name==='RunTask'&&e.dur>50000).map(e=>Math.round(e.dur/1000)).sort((a,b)=>b-a).slice(0,10);
console.log(JSON.stringify({tag,path,ms:Object.fromEntries(Object.entries(sum).map(([k,v])=>[k,Math.round(v)])),count:cnt,runTasksOver50ms:rt}));
const fr=ev.filter(e=>e.name==='PipelineReporter'&&e.ph==='b'); 
const states={}; for(const e of ev){ if(e.name==='PipelineReporter'&&e.ph==='e'&&e.args&&e.args.data){const s=e.args.data.state||'?'; states[s]=(states[s]||0)+1;} }
console.log('frames',JSON.stringify(states));
})();
