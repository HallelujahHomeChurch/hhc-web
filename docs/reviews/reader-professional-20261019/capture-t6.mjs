// Synthetic loopback matrix using the actual product; ego-browser nodejs < this file.
const fs=await import('node:fs/promises'), assert=(await import('node:assert/strict')).default;
const p=(await taskSpace(362)).page('p2');
const dir='/Users/rayselfs/Projects/hhc/website/.worktrees/reader-professional-experience-impl-20261019/docs/reviews/reader-professional-20261019';
const records=[];
for(const [locale,width,height,theme] of [['zh-Hant',375,568,'light'],['zh-Hans',375,568,'dark'],['en',375,568,'light'],['ja',375,568,'dark'],['ko',375,568,'light'],['en',844,390,'dark']]) {
 const m=JSON.parse(await fs.readFile(`${dir}/../../../src/i18n/locales/${locale}.json`,'utf8')).weeklyReader;
 await p.cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
 await p.goto(`http://127.0.0.1:7152/?scenario=word&locale=${locale}&theme=${theme}&t6=matrix`);
 await p.waitForFunction(label=>{const b=document.querySelector(`button[aria-label="${label}"]`);return b&&!b.disabled;},m.myNotes);
 await p.click(`loc=role:button[name="${m.myNotes}"]`);
 await p.waitForSelector('loc=css:.reader-notes-browser',{state:'visible'});
 await p.evaluate(async()=>{document.getAnimations().forEach(a=>a.finish());await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
 const record=await p.evaluate(()=>{
  const frame=document.querySelector('.hhc-modal')??document.querySelector('.reader-private-panel:not([hidden])');
  const header=frame.querySelector('header');
  return {viewport:[innerWidth,innerHeight],frame:frame.getBoundingClientRect().toJSON(),header:header.getBoundingClientRect().toJSON(),tabs:[...frame.querySelectorAll('[role=tab]')].map(t=>({text:t.textContent,rect:t.getBoundingClientRect().toJSON(),scrollWidth:t.scrollWidth,clientWidth:t.clientWidth})),bodyOverflow:document.documentElement.scrollWidth>innerWidth};
 });
 assert.deepEqual(record.viewport,[width,height]); assert.equal(record.tabs.length,3); assert.equal(record.bodyOverflow,false);
 for(const tab of record.tabs){assert(tab.rect.height>=44);assert(tab.rect.x>=0&&tab.rect.right<=width);assert(tab.scrollWidth<=tab.clientWidth+1,'tab labels fit');}
 const shot=`T6-notes-${locale}-${width}x${height}-${theme}.png`;
 await p.screenshot({path:`${dir}/${shot}`,raw:true});
 await p.evaluate(()=>{const panel=document.querySelector('[role=tabpanel]');panel.scrollTop=panel.scrollHeight;});
 record.scrolledHeader=await p.evaluate(()=>{const f=document.querySelector('.hhc-modal')??document.querySelector('.reader-private-panel:not([hidden])');return f.querySelector('header').getBoundingClientRect().toJSON();});
 assert.equal(record.header.y,record.scrolledHeader.y); records.push({locale,theme,shot,...record});
 await p.keyboard.press('Escape');
}
await fs.writeFile(`${dir}/T6-matrix.json`,JSON.stringify({synthetic:true,physicalDevice:false,records},null,2));console.log({matrix:records.length});
