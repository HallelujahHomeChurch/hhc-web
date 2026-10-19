// Synthetic loopback UI evidence; ego-browser nodejs < this file. No production data.
const fs=await import('node:fs/promises'),assert=(await import('node:assert/strict')).default;
const p=(await taskSpace(362)).page('p2');
const dir='/Users/rayselfs/Projects/hhc/website/.worktrees/reader-professional-experience-impl-20261019/docs/reviews/reader-professional-20261019';
const evidence=[];
async function settled(){await p.evaluate(async()=>{document.getAnimations().forEach(a=>a.finish());await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});}
async function select(start,end,fragmentStart=0){
 await p.evaluate(from=>[...document.querySelectorAll('[data-sentence-id="s0"]')].find(e=>Number(e.dataset.fragmentStart)===from).scrollIntoView({block:'center',inline:'start'}),fragmentStart);await settled();
 const hit=await p.evaluate(({start,end,fragmentStart})=>{const el=[...document.querySelectorAll('[data-sentence-id="s0"]')].find(e=>Number(e.dataset.fragmentStart)===fragmentStart),n=document.createTreeWalker(el,NodeFilter.SHOW_TEXT).nextNode(),points=[...el.textContent],r=document.createRange();r.setStart(n,points.slice(0,start-fragmentStart).join('').length);r.setEnd(n,points.slice(0,end-fragmentStart).join('').length);return {quote:r.toString(),rect:[...r.getClientRects()][0].toJSON()};},{start,end,fragmentStart});
 await p.mouse.click(hit.rect.x+hit.rect.width/2,hit.rect.y+hit.rect.height/2,{label:'Select exact reading clause'});
 await p.waitForFunction(()=>!!document.querySelector('[data-reader-highlight="selection"]'));await settled();return hit;
}
for(const mode of ['easy','paper'])for(const theme of ['light','dark']){
 await p.cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
 await p.goto(`http://127.0.0.1:7152/?scenario=clauses&${mode==='paper'?'split=1&':''}theme=${theme}&t4=matrix`);
 await p.waitForSelector('loc=css:[data-sentence-id="s0"]',{state:'visible'});
 if(mode==='paper'){await p.click('loc=role:button[name="字級與行距"]');await p.waitForSelector('loc=role:dialog[name="字級與行距"]');await p.click('loc=role:button[name="紙本"]');await p.keyboard.press('Escape');await p.waitForFunction(()=>!document.querySelector('[data-panel-open]'));await settled();}
 const hit=await select(mode==='paper'?25:15,mode==='paper'?40:25,mode==='paper'?25:0);
 const state=await p.evaluate(()=>({viewport:[innerWidth,innerHeight],mode:document.querySelector('[data-reading-mode]').dataset.readingMode,quote:document.querySelector('.reader-selection-count')?.textContent,boxes:[...document.querySelectorAll('[data-reader-highlight="selection"]')].map(e=>e.getBoundingClientRect().toJSON()),tools:document.querySelector('.reader-selection-tools')?.getBoundingClientRect().toJSON(),status:[...document.querySelectorAll('[role="status"]')].map(e=>e.textContent)}));
 assert.deepEqual(state.viewport,[390,844]);assert.equal(state.mode,mode);assert(state.quote.includes(hit.quote));assert(state.boxes.length>0);assert(state.status.filter(Boolean).every(text=>text.startsWith('已選取')));assert(state.boxes.every(r=>r.height>0&&r.width>0));
 evidence.push({mode,theme,hit,...state});await p.screenshot({path:`${dir}/T4-${mode}-${theme}.png`,raw:true});
 if(theme==='light'){
  await p.evaluate(()=>{window.t4Mutations=[];const mutate=window.fixtureApi.mutate;window.fixtureApi.mutate=async(...args)=>{window.t4Mutations.push(structuredClone(args[2]));return mutate(...args);};});
  await p.click('loc=role:button[name="藍色螢光"]');
  await p.waitForFunction(()=>window.t4Mutations.some(ms=>ms.some(m=>m.kind==='setHighlight')));
  const sent=await p.evaluate(()=>window.t4Mutations.flat().find(m=>m.kind==='setHighlight'));
  assert.deepEqual(sent.payload.ranges,[{sentenceId:'s0',start:mode==='paper'?25:15,end:mode==='paper'?40:25}]);evidence.push({mode,sent});
 }
}
await p.click('loc=role:button[name="字級與行距"]');await p.waitForSelector('loc=role:dialog[name="字級與行距"]');
for(let i=0;i<8;i++)await p.click('loc=role:button[name="放大"]');
await p.keyboard.press('Escape');await p.waitForFunction(()=>!document.querySelector('[data-panel-open]'));
const zoomHit=await select(25,40,25);await p.waitForFunction(()=>!!window.fixtureState().progress);await settled();
const zoom=await p.evaluate(()=>({kind:'zoomed-paper-300',viewport:[innerWidth,innerHeight],quote:document.querySelector('.reader-selection-count')?.textContent,boxes:[...document.querySelectorAll('[data-reader-highlight="selection"]')].map(e=>e.getBoundingClientRect().toJSON()),status:[...document.querySelectorAll('[role="status"]')].map(e=>e.textContent),progress:window.fixtureState().progress,view:sessionStorage.getItem('weekly-reader-view:weekly-reader-position:local-fixture-account:'+window.fixtureValue.document.documentId+':1')}));
assert(zoom.quote.includes(zoomHit.quote));assert(zoom.status.filter(Boolean).every(text=>text.startsWith('已選取')));assert.equal(JSON.parse(zoom.view).zoom,3);
evidence.push(zoom);await p.screenshot({path:`${dir}/T4-r2-paper-zoom.png`,raw:true});
await fs.writeFile(`${dir}/T4-geometry.json`,JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));
