// Run with: ego-browser nodejs < docs/reviews/reader-professional-20261019/capture-t0.mjs
const fs=await import('node:fs/promises');
const t=await taskSpace(362),p=t.page('p2');
const dir='/Users/rayselfs/Projects/hhc/website/.worktrees/reader-professional-experience-impl-20261019/docs/reviews/reader-professional-20261019';
await p.cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
await p.goto('http://127.0.0.1:7152/?prototype&capture=2');
await p.waitForSelector('.prototype-header',{state:'visible'});
const geometry=[];
for(const label of ['我的筆記','目錄','字級與行距','搜尋本期週報']){
 await p.click(`text="${label}"`);await p.waitForSelector('[role=dialog]',{state:'visible'});await p.waitForFunction(()=>!document.querySelector('[data-entering]'));await p.waitForFunction(()=>document.getAnimations().every(a=>a.playState!=='running'));
 geometry.push(await p.evaluate(label=>{const d=document.querySelector('.hhc-modal'),h=d.querySelector('.prototype-search')?d.querySelector('.reader-search-header'):d.querySelector('.hhc-dialog__header');return {label,viewport:[innerWidth,innerHeight],panel:d.getBoundingClientRect().toJSON(),header:h.getBoundingClientRect().toJSON(),active:document.activeElement?.getAttribute('type')};},label));
 await p.screenshot({path:`${dir}/proposal-${label}.png`,raw:true});
 await p.click('[role=dialog] button[aria-label="關閉"]');await p.waitForSelector('[role=dialog]',{state:'hidden'});
}
await fs.writeFile(dir+'/prototype-geometry.json',JSON.stringify(geometry,null,2));
await fs.mkdir(dir+'/frames',{recursive:true});
await p.cdp('Page.startScreencast',{format:'jpeg',quality:75,everyNthFrame:1});
const started=Date.now(),frames=[],actions=[];let stage=0;
while(Date.now()-started<4200){
 const ms=Date.now()-started;
 const schedule=[{at:100,selector:'text="我的筆記"'},{at:800,selector:'[role=tab]:nth-child(2)'},{at:1400,selector:'[role=dialog] button[aria-label="關閉"]'},{at:2200,selector:'text="搜尋本期週報"'},{at:3400,selector:'[role=dialog] button[aria-label="關閉"]'}];
 if(stage<schedule.length&&ms>=schedule[stage].at){const action=schedule[stage++];await p.click(action.selector);actions.push({at:Date.now()-started,selector:action.selector});}
 for(const e of await p.events())if(e.method==='Page.screencastFrame'){
  const name=`frame-${String(frames.length).padStart(4,'0')}.jpg`;await fs.writeFile(dir+'/frames/'+name,Buffer.from(e.params.data,'base64'));frames.push({name,t:e.params.metadata.timestamp});await p.cdp('Page.screencastFrameAck',{sessionId:e.params.sessionId});
 }
 await new Promise(r=>setTimeout(r,20));
}
await p.cdp('Page.stopScreencast');
await fs.writeFile(dir+'/motion-timeline.json',JSON.stringify({synthetic:true,frames:frames.length,actions},null,2));
await fs.writeFile(dir+'/frames.ffconcat',`ffconcat version 1.0\n`+frames.map((f,i)=>`file 'frames/${f.name}'\nduration ${Math.max(.02,Math.min(1,(frames[i+1]?.t??f.t+.2)-f.t))}\n`).join(''));
console.log({geometry,frames:frames.length,actions});
