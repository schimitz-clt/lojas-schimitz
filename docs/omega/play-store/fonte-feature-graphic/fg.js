const { chromium } = require('playwright-core');
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const p=await b.newPage({viewport:{width:1024,height:500}});await p.goto('file:///tmp/pw/fg.html');await p.waitForTimeout(800);
await p.screenshot({path:'/workspace/omega/play-store/feature-graphic-1024x500-RASCUNHO.png'});await b.close();})();
