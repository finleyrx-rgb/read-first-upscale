import puppeteer from 'puppeteer';
const b=await puppeteer.launch({args:['--no-sandbox']});
const p=await b.newPage();
await p.setViewport({width:1280,height:900});
const errs=[];p.on('pageerror',e=>errs.push(String(e)));p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text());});
await p.goto('http://localhost:8765/proj.html',{waitUntil:'networkidle0'});
await p.evaluate(()=>{
  S.parts=[
    {id:99,dir:"Across width",off:5000,start:0,len:S.W,type:'Partition',door:true,doorW:810,doorOff:4000},
    {id:100,dir:"Along length",off:3000,start:1000,len:6000,type:'Structural',door:false},
    {id:101,dir:"Along length",off:5500,start:2000,len:4000,type:'Wet',door:true,doorW:760,doorOff:3000}
  ]; step=4; render();
});
await new Promise(r=>setTimeout(r,400));
await p.screenshot({path:'/tmp/qa-plan.png'});
console.log('ERRORS:',JSON.stringify(errs));
const has=await p.evaluate(()=>document.querySelector('svg#view').textContent.includes('WALL TYPES'));
console.log('LEGEND:',has);
await b.close();
