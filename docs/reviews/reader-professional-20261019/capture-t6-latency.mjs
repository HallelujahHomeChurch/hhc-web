// Native input to first committed animation frame; desktop synthetic proxy, not device paint/FPS.
const fs=await import('node:fs/promises'), assert=(await import('node:assert/strict')).default;
const p=(await taskSpace(362)).page('p2'),dir='/Users/rayselfs/Projects/hhc/website/.worktrees/reader-professional-experience-impl-20261019/docs/reviews/reader-professional-20261019';
await p.cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
await p.goto('http://127.0.0.1:7152/?scenario=word&t6=latency');
await p.waitForFunction(()=>!document.querySelector('button[aria-label="我的筆記"]').disabled);
const records=[],frameTimes=[];
await p.cdp('Page.startScreencast',{format:'jpeg',quality:20,maxWidth:390,maxHeight:844,everyNthFrame:1});
let done=false;const deadline=Date.now()+120000;
const pump=(async()=>{while(!done&&Date.now()<deadline){for(const event of await p.events())if(event.method==='Page.screencastFrame'){frameTimes.push(event.params.metadata.timestamp);await p.cdp('Page.screencastFrameAck',{sessionId:event.params.sessionId});}await new Promise(r=>setTimeout(r,8));}})();
const baseline=await p.evaluate(async()=>{const times=[];for(let i=0;i<6;i++)await new Promise(r=>requestAnimationFrame(time=>{times.push(time);r();}));return {visibility:document.visibilityState,focused:document.hasFocus(),intervals:times.slice(1).map((v,i)=>v-times[i])};});
try {
 for(const rate of [1,4]) {
  await p.cdp('Emulation.setCPUThrottlingRate',{rate});
  for(let i=-2;i<20;i++) {
   await p.evaluate(()=>{
    window.frameLatency=null;
    const start=event=>{
     if(!event.target.closest('button[aria-label="我的筆記"]')) return;
     document.removeEventListener('pointerup',start,true);
     const time=performance.now();
     const check=()=>{if(document.querySelector('.hhc-modal .reader-notes-browser')) window.frameLatency=performance.now()-time;else requestAnimationFrame(check);};
     requestAnimationFrame(check);
    };
    document.addEventListener('pointerup',start,true);
   });
   await p.click('loc=role:button[name="我的筆記"]');
   await p.waitForFunction(()=>window.frameLatency!==null);
   const ms=await p.evaluate(()=>window.frameLatency);
   if(i>=0) records.push({rate,index:i,ms});
   await p.keyboard.press('Escape');
   await p.waitForFunction(()=>!document.querySelector('.hhc-modal-overlay'));
  }
 }
} finally {await p.cdp('Emulation.setCPUThrottlingRate',{rate:1});done=true;await pump;await p.cdp('Page.stopScreencast');}
const summary=[1,4].map(rate=>{const sorted=records.filter(r=>r.rate===rate).map(r=>r.ms).sort((a,b)=>a-b);return {rate,samples:sorted.length,p95:sorted[Math.ceil(sorted.length*.95)-1],max:sorted.at(-1)};});
await fs.writeFile(`${dir}/T6-latency.json`,JSON.stringify({synthetic:true,method:'native pointerup capture -> first rAF with mounted panel; two warmups per rate; desktop Chromium with active screencast to prevent its idle 1Hz frame pacing; not physical input-to-paint or FPS',baseline,screencastFrameTimes:frameTimes,records,summary},null,2));console.log(summary);
assert(summary.every(s=>s.samples===20));
assert(summary[0].p95<=100, 'normal synthetic first-frame response p95 must be <=100ms');
