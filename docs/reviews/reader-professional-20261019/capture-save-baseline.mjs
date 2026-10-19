// Reproduce the old first-save race with synthetic API and explicit focus.
const fs=await import('node:fs/promises'),t=await taskSpace(362),p=t.page('p2');
const dir='/Users/rayselfs/Projects/hhc/website/.worktrees/reader-professional-experience-impl-20261019/docs/reviews/reader-professional-20261019';
await p.goto('http://127.0.0.1:7152/?baseline-save=1');
await p.waitForFunction(()=>document.querySelector('button[aria-label="我的筆記"]:not(:disabled)')&&!document.querySelector('.reader-loading'));
await p.evaluate(()=>{window.fixtureDelay=2000;const original=window.fixtureApi.mutate;window.fixtureMutations=[];window.fixtureApi.mutate=(...args)=>{window.fixtureMutations.push(args[2].map(m=>({id:m.mutationId,kind:m.kind})));return original(...args);};});
await fs.mkdir(dir+'/baseline-frames',{recursive:true});
await p.cdp('Page.startScreencast',{format:'jpeg',quality:75,everyNthFrame:1});
const started=Date.now(),frames=[],actions=[];let stage=0;
while(Date.now()-started<5400){
 const ms=Date.now()-started;
 const schedule=[{at:100,selector:'button[aria-label="我的筆記"]'},{at:900,text:'編輯'},{at:1700,selector:'.reader-note-editor button[type=submit]'},{at:1850,focus:true}];
 if(stage<schedule.length&&ms>=schedule[stage].at){const action=schedule[stage++];await p.evaluate(a=>{if(a.focus)window.dispatchEvent(new Event('focus'));else if(a.text)[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===a.text)?.click();else document.querySelector(a.selector)?.click();},action);actions.push({at:Date.now()-started,...action});}
 for(const e of await p.events())if(e.method==='Page.screencastFrame'){
  const name=`frame-${String(frames.length).padStart(4,'0')}.jpg`;await fs.writeFile(dir+'/baseline-frames/'+name,Buffer.from(e.params.data,'base64'));frames.push({name,t:e.params.metadata.timestamp});await p.cdp('Page.screencastFrameAck',{sessionId:e.params.sessionId});
 }
 await new Promise(r=>setTimeout(r,20));
}
await p.cdp('Page.stopScreencast');
const result=await p.evaluate(()=>({editorVisible:!!document.querySelector('.reader-note-editor textarea'),listVisible:!!document.querySelector('.reader-notes-browser'),notes:window.fixtureState().notes.map(n=>({id:n.id,version:n.version})),mutations:window.fixtureMutations}));
await fs.writeFile(dir+'/baseline-save-repro.json',JSON.stringify({synthetic:true,programmaticEvents:true,actions,frames:frames.length,result},null,2));
await fs.writeFile(dir+'/baseline.ffconcat','ffconcat version 1.0\n'+frames.map((f,i)=>`file 'baseline-frames/${f.name}'\nduration ${Math.max(.02,Math.min(1,(frames[i+1]?.t??f.t+.2)-f.t))}\n`).join(''));
console.log({result,frames:frames.length});
