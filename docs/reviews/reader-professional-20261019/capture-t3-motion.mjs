// Capture real concurrent screencast frames and RAF geometry on the synthetic preview.
const fs = await import('node:fs/promises');
const assert = (await import('node:assert/strict')).default;
const p = (await taskSpace(362)).page('p2');
const dir = '/Users/rayselfs/Projects/hhc/website/.worktrees/reader-professional-experience-impl-20261019/docs/reviews/reader-professional-20261019';
await p.cdp('Emulation.setDeviceMetricsOverride', {width:390,height:844,deviceScaleFactor:1,mobile:false});
await p.goto('http://127.0.0.1:7152/?t3=motion');
await p.waitForSelector('loc=css:[data-sentence-id="s0"]',{state:'visible'});
await p.evaluate(() => {
  window.t3Motion = {active:true, phase:'initial', samples:[]};
  const sample = time => {
    const trace = window.t3Motion;
    if (!trace.active) return;
    const sheet = document.querySelector('.hhc-modal:has(.reader-private-sheet)');
    const tabs = document.querySelector('.reader-notes-browser .hhc-tabs__list');
    const search = document.querySelector('.reader-search-panel:not([hidden])');
    trace.samples.push({time,phase:trace.phase,sheet:sheet ? getComputedStyle(sheet).transform : null,search:search ? getComputedStyle(search).opacity : null,tabs:tabs ? getComputedStyle(tabs,'::before').transform : null});
    requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
});
await p.cdp('Page.startScreencast',{format:'jpeg',quality:70,maxWidth:390,maxHeight:844,everyNthFrame:1});
const frames=[],actions=[]; let done=false;
const started=Date.now();
const pump=(async()=>{
  while(!done && Date.now()-started<45000){
    for(const e of await p.events()) if(e.method==='Page.screencastFrame'){
      frames.push({data:e.params.data,time:e.params.metadata.timestamp});
      await p.cdp('Page.screencastFrameAck',{sessionId:e.params.sessionId});
    }
    await new Promise(r=>setTimeout(r,8));
  }
})();
async function phase(name, action){
  await p.evaluate(name=>{window.t3Motion.phase=name;},name);
  await action(); actions.push({name,time:Date.now()-started});
  await p.waitForFunction(()=>document.getAnimations().every(a=>a.playState!=='running'));
}
try {
  await phase('contents-in',()=>p.click('loc=role:button[name="目錄"]'));
  await phase('contents-out',()=>p.click('loc=css:.hhc-dialog__close'));
  await p.waitForFunction(()=>!document.querySelector('.hhc-modal-overlay'));
  await phase('settings-in',()=>p.click('loc=role:button[name="字級與行距"]'));
  await phase('settings-out',()=>p.keyboard.press('Escape'));
  await p.waitForFunction(()=>!document.querySelector('.hhc-modal-overlay'));
  await phase('notes-in',()=>p.click('loc=role:button[name="我的筆記"]'));
  await phase('tabs',()=>p.click('loc=role:tab[name="畫線"]'));
  await phase('notes-out',()=>p.keyboard.press('Escape'));
  await p.waitForFunction(()=>!document.querySelector('.hhc-modal-overlay'));
  await phase('search-in',()=>p.click('loc=role:button[name="搜尋本期週報"]'));
  assert.equal(await p.evaluate(()=>document.activeElement?.type),'search');
  const url=await p.url();
  await phase('search-back',()=>p.evaluate(()=>history.back()));
  await p.waitForFunction(()=>!document.querySelector('[data-panel-open]') && history.state?.__hhcReaderExit?.position==='guard');
  assert.equal(await p.url(),url);
} finally {
  done=true;await pump;await p.cdp('Page.stopScreencast');
}
const samples=await p.evaluate(()=>{window.t3Motion.active=false;return window.t3Motion.samples;});
const frameDir=dir+'/T3-motion-frames';await fs.mkdir(frameDir,{recursive:true});
for(let i=0;i<frames.length;i++)await fs.writeFile(`${frameDir}/frame-${String(i).padStart(4,'0')}.jpg`,Buffer.from(frames[i].data,'base64'));
await fs.writeFile(dir+'/T3-motion.ffconcat','ffconcat version 1.0\n'+frames.map((f,i)=>`file 'T3-motion-frames/frame-${String(i).padStart(4,'0')}.jpg'\nduration ${Math.max(.001,(frames[i+1]?.time??f.time+.1)-f.time)}\n`).join(''));
const normal={synthetic:true,actions,frames:frames.map(({time})=>time),samples};
assert(frames.length>=12,'need actual rendered transition frames');
assert(new Set(samples.filter(s=>s.phase==='contents-in').map(s=>s.sheet).filter(Boolean)).size>=3,'entry must contain intermediate transforms');
assert(new Set(samples.filter(s=>s.phase==='contents-out').map(s=>s.sheet).filter(Boolean)).size>=3,'exit must contain intermediate transforms');
await p.cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
await p.click('loc=role:button[name="我的筆記"]');
const reduced=await p.evaluate(()=>({animations:document.getAnimations().map(a=>a.animationName),sheetAnimation:getComputedStyle(document.querySelector('.hhc-modal')).animationName,tabsTransition:getComputedStyle(document.querySelector('.reader-notes-browser .hhc-tabs__list'),'::before').transitionDuration}));
assert.equal(reduced.sheetAnimation,'none');assert.equal(reduced.tabsTransition,'0s');
await p.keyboard.press('Escape');
await p.cdp('Emulation.setEmulatedMedia',{features:[]});
await fs.writeFile(dir+'/T3-motion.json',JSON.stringify({...normal,reduced},null,2));
console.log({frames:frames.length,actions,samples:samples.length,reduced});
