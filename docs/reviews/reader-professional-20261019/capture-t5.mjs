// Actual product export with synthetic loopback notes; ego-browser nodejs < this file.
const fs=await import('node:fs/promises'),assert=(await import('node:assert/strict')).default;
const p=(await taskSpace(362)).page('p2'),dir='/Users/rayselfs/Projects/hhc/website/.worktrees/reader-professional-experience-impl-20261019/docs/reviews/reader-professional-20261019';
await p.cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
await p.goto('http://127.0.0.1:7152/?scenario=word&t5=final');
await p.waitForFunction(()=>!document.querySelector('button[aria-label="我的筆記"]').disabled);
await p.click('loc=role:button[name="我的筆記"]');await p.waitForSelector('loc=role:dialog[name="我的筆記"]');
await p.click('loc=role:button[name="匯出筆記"]');await p.waitForSelector('loc=role:dialog[name="匯出筆記"]');
await p.click('loc=role:button[name="準備檔案"]');await p.waitForSelector('loc=role:button[name="下載"]',{state:'visible',timeout:15000});
await p.evaluate(async()=>{document.getAnimations().forEach(a=>a.finish());await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
await p.screenshot({path:dir+'/T5-export-ready.png',raw:true});
const downloading=p.waitForEvent('download',{timeout:30000});await p.click('loc=role:button[name="下載"]');const download=await downloading;
await download.saveAs(dir+'/T5-product-notes.docx');
const info={filename:download.suggestedFilename(),failure:await download.failure(),ui:await p.evaluate(()=>({viewport:[innerWidth,innerHeight],exportText:document.querySelector('.reader-note-export')?.textContent,notes:window.fixtureState().notes.map(({id,quote,text})=>({id,quote,text}))}))};
assert.equal(info.filename,'hhc-notes-1739.docx');assert.equal(info.failure,null);assert.equal(info.ui.notes.length,4);assert.deepEqual(info.ui.viewport,[390,844]);
await fs.writeFile(dir+'/T5-download.json',JSON.stringify(info,null,2));console.log({filename:info.filename,failure:info.failure,notes:info.ui.notes.length});

await p.goto('http://127.0.0.1:7152/?scenario=word&theme=dark&t5=final');await p.waitForFunction(()=>!document.querySelector('button[aria-label="我的筆記"]').disabled);
await p.click('loc=role:button[name="我的筆記"]');await p.waitForSelector('loc=role:dialog[name="我的筆記"]');await p.click('loc=role:button[name="匯出筆記"]');await p.waitForSelector('loc=role:dialog[name="匯出筆記"]');await p.click('loc=role:button[name="準備檔案"]');await p.waitForSelector('loc=role:button[name="下載"]',{state:'visible',timeout:15000});
await p.evaluate(async()=>{document.getAnimations().forEach(a=>a.finish());await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});await p.screenshot({path:dir+'/T5-export-ready-dark.png',raw:true});
