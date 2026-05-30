import puppeteer from 'puppeteer';
const b=await puppeteer.launch({args:['--no-sandbox']});
const p=await b.newPage();
await p.setViewport({width:1280,height:900});
const errs=[];p.on('pageerror',e=>errs.push(String(e)));p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text());});
await p.goto('http://localhost:8766/proj.html',{waitUntil:'networkidle0'});
await p.screenshot({path:'/tmp/qa-plan2.png'});
// switch to elevation
await p.evaluate(()=>{S.view='elevation';render();});
await new Promise(r=>setTimeout(r,200));
await p.screenshot({path:'/tmp/qa-elev2.png'});
// switch to foundation
await p.evaluate(()=>{S.view='plan';S.layer='foundation';render();});
await new Promise(r=>setTimeout(r,200));
await p.screenshot({path:'/tmp/qa-fnd2.png'});
console.log('ERRORS:',JSON.stringify(errs));
await b.close();
