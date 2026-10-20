// Synthetic baseline only. Run through ego-browser nodejs in this task's space.
const fs=await import('node:fs/promises'),t=await taskSpace(362),p=t.page('p2');
const dir='/Users/rayselfs/Projects/hhc/website/.worktrees/reader-professional-experience-impl-20261019/docs/reviews/reader-professional-20261019';
for(const [width,height]of [[390,844],[768,1024],[1440,900]])for(const theme of ['light','dark']){
 await p.cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await p.goto('http://127.0.0.1:7152/?theme='+theme);
 await p.waitForFunction(()=>document.querySelector('button[aria-label="我的筆記"]:not(:disabled)')&&!document.querySelector('.reader-loading'));
 await p.evaluate(()=>document.querySelector('button[aria-label="我的筆記"]').click());
 await p.waitForSelector(width>=1068?'.reader-private-panel':'.reader-private-sheet',{state:'visible'});
 await p.waitForFunction(()=>!document.querySelector('[data-entering]'));
 await p.screenshot({path:`${dir}/baseline-${width}-${theme}.png`,raw:true});console.log({captured:width,theme});
}
