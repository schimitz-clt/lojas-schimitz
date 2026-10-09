const { chromium } = require('playwright-core'); const fs=require('fs');
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const files=fs.readdirSync('.').filter(f=>/^banner-\d\d.*\.html$/.test(f)).sort();
for (const dsf of [1,2]) { const c=await b.newContext({viewport:{width:1200,height:400},deviceScaleFactor:dsf}); const p=await c.newPage();
 for (const f of files){ await p.goto('file://'+process.cwd()+'/'+f); await p.evaluate(()=>document.fonts.ready); await p.waitForTimeout(250);
  const out=`../${f.replace('.html','')}${dsf===2?'@2x':''}.png`; await p.screenshot({path:out}); }
 await c.close(); }
await b.close();})();
