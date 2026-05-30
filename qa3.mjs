import puppeteer from 'puppeteer';
const b=await puppeteer.launch({args:['--no-sandbox']});
const p=await b.newPage();await p.setViewport({width:1280,height:900});
const errs=[];p.on('pageerror',e=>errs.push(String(e)));p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text());});
await p.goto('http://localhost:8768/proj.html',{waitUntil:'networkidle0'});
await p.screenshot({path:'/tmp/qa-plan3.png'});
await p.evaluate(()=>{S.view='elevation';render();});await new Promise(r=>setTimeout(r,200));
await p.screenshot({path:'/tmp/qa-elev3.png'});
await p.evaluate(()=>{S.view='plan';S.layer='foundation';render();});await new Promise(r=>setTimeout(r,200));
await p.screenshot({path:'/tmp/qa-fnd3.png'});
// click a callout: find first data-callout-key and click
const clicked=await p.evaluate(()=>{S.view='plan';S.layer='arch';render();const c=document.querySelector('[data-callout-key]');if(!c)return null;c.dispatchEvent(new MouseEvent('click',{bubbles:true}));return {view:S.view,detailFor};});
await new Promise(r=>setTimeout(r,200));
await p.screenshot({path:'/tmp/qa-clicked3.png'});
console.log('ERRORS:',JSON.stringify(errs));
console.log('CLICK:',JSON.stringify(clicked));
await b.close();
