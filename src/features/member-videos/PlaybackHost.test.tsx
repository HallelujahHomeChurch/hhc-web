import {render, screen, fireEvent, waitFor} from '@testing-library/react';
import {expect, it, vi} from 'vitest';
import {PlaybackHost} from './PlaybackHost';

it('keeps the same media nodes when the watch slot disappears and returns', () => {
  const slot = document.createElement('div');
  const renderHost = (watchSlot: HTMLElement | null) => (
    <PlaybackHost watchSlot={watchSlot}>
      <video data-testid="video"/>
      <audio data-testid="audio"/>
    </PlaybackHost>
  );
  const view = render(renderHost(slot));
  const video = screen.getByTestId('video');
  const audio = screen.getByTestId('audio');
  const parent = video.parentElement;
  view.rerender(renderHost(null));
  expect(screen.getByTestId('video')).toBe(video);
  expect(screen.getByTestId('audio')).toBe(audio);
  expect(video.parentElement).toBe(parent);
  expect(parent).toHaveAttribute('data-presentation', 'mini');
  view.rerender(renderHost(slot));
  expect(screen.getByTestId('video')).toBe(video);
  expect(screen.getByTestId('audio')).toBe(audio);
  expect(parent).toHaveAttribute('data-presentation', 'watch');
});

it('drags the surface with the pointer and suppresses the release click', () => {
  const clicked = vi.fn();
  const view = render(<PlaybackHost watchSlot={null} moveLabel="Move" resizeLabel="Resize"><button data-player-surface onClick={clicked}>Surface</button></PlaybackHost>);
  const host = screen.getByRole('group', {name: 'Move'});
  host.setPointerCapture = vi.fn();
  vi.spyOn(host, 'getBoundingClientRect').mockReturnValue({left: 500, top: 300, width: 360, height: 203, right: 860, bottom: 503} as DOMRect);
  function pointer(type: string, x: number, y: number) {
    const event = new MouseEvent(type, {bubbles: true, clientX: x, clientY: y, button: 0});
    Object.defineProperties(event, {pointerId: {value: 1}, isPrimary: {value: true}});
    fireEvent(screen.getByRole('button', {name: 'Surface'}), event);
  }
  pointer('pointerdown', 600, 350);pointer('pointermove', 550, 320);
  expect(host.style.transform).toContain('-50px');
  pointer('pointerup', 550, 320);fireEvent.click(screen.getByRole('button', {name: 'Surface'}));
  expect(clicked).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', {name: 'Move'})).toBeNull();
  view.unmount();
});

it('keeps media mounted during watch drag feedback and ignores control drags', () => {
  const slot=document.createElement('div');
  const view=render(<PlaybackHost watchSlot={slot} minimizeOffset={40}><video data-testid="drag-video"/></PlaybackHost>);
  const video=screen.getByTestId('drag-video'),host=video.parentElement!;
  expect(host.style.transform).toBe('');
  view.rerender(<PlaybackHost watchSlot={slot} minimizeOffset={0}><video data-testid="drag-video"/></PlaybackHost>);
  expect(screen.getByTestId('drag-video')).toBe(video);
  expect(host.style.transform).toBe('');
});

it('lets fullscreen consume Escape before closing the mini player', () => {
  const close=vi.fn();const view=render(<PlaybackHost watchSlot={null} onClose={close}><div data-fullscreen="viewport"><video/></div></PlaybackHost>);
  fireEvent.keyDown(window,{key:'Escape'});expect(close).not.toHaveBeenCalled();
  view.rerender(<PlaybackHost watchSlot={null} onClose={close}><div data-fullscreen="inline"><video/></div></PlaybackHost>);
  fireEvent.keyDown(window,{key:'Escape'});expect(close).toHaveBeenCalledOnce();
});

it('ignores capture transfer from a child and never drags a fullscreen surface', () => {
  const view=render(<PlaybackHost watchSlot={null} moveLabel="Move"><div data-fullscreen="inline"><button data-player-surface>Surface</button></div></PlaybackHost>);
  const host=screen.getByRole('group',{name:'Move'});host.setPointerCapture=vi.fn();
  vi.spyOn(host,'getBoundingClientRect').mockReturnValue({left:500,top:300,width:360,height:203,right:860,bottom:503} as DOMRect);
  const surface=screen.getByRole('button',{name:'Surface'});
  function pointer(type:string,x:number) {const event=new MouseEvent(type,{bubbles:true,clientX:x,clientY:350,button:0});Object.defineProperties(event,{pointerId:{value:1},isPrimary:{value:true}});fireEvent(surface,event);}
  pointer('pointerdown',600);pointer('pointermove',550);pointer('lostpointercapture',550);
  expect(host.style.transform).toContain('-50px');pointer('pointermove',530);expect(host.style.transform).toContain('-70px');pointer('pointerup',530);
  view.rerender(<PlaybackHost watchSlot={null} moveLabel="Move"><div data-fullscreen="viewport"><button data-player-surface>Surface</button></div></PlaybackHost>);
  pointer('pointerdown',600);pointer('pointermove',550);expect(host.style.transform).toBe('');
});

it('animates the same media surface from the watch bounds into mini bounds', () => {
  const slot=document.createElement('div');
  vi.spyOn(slot,'getBoundingClientRect').mockReturnValue({left:100,top:80,width:800,height:450} as DOMRect);
  const view=render(<PlaybackHost watchSlot={slot}><video data-testid="transition-video"/></PlaybackHost>);
  const video=screen.getByTestId('transition-video'),host=video.parentElement!;
  const cancel=vi.fn(),animate=vi.fn(()=>({cancel}) as unknown as Animation);host.animate=animate;
  vi.spyOn(host,'getBoundingClientRect').mockImplementation(()=>({left:parseFloat(host.style.left),top:parseFloat(host.style.top),width:parseFloat(host.style.width),height:parseFloat(host.style.height)} as DOMRect));
  view.rerender(<PlaybackHost watchSlot={slot} minimizeOffset={40}><video data-testid="transition-video"/></PlaybackHost>);
  view.rerender(<PlaybackHost watchSlot={null}><video data-testid="transition-video"/></PlaybackHost>);
  expect(animate).toHaveBeenCalledWith([{left:'100px',top:'80px',width:'800px',height:'450px'}, {left:host.style.left,top:host.style.top,width:host.style.width,height:host.style.height}],expect.objectContaining({duration:220}));
  expect(screen.getByTestId('transition-video')).toBe(video);
});

it('keeps the close controls inside a short viewport when resizing', () => {
  const original=window.innerHeight;
  Object.defineProperty(window,'innerHeight',{value:400,configurable:true});
  try {
    render(<PlaybackHost watchSlot={null} moveLabel="Move" resizeLabel="Resize"><video/></PlaybackHost>);
    for(let i=0;i<30;i++)fireEvent.keyDown(screen.getByRole('button',{name:'Resize'}),{key:'ArrowRight'});
    const width=parseFloat(screen.getByRole('group',{name:'Move'}).style.width);
    expect(width*9/16+76+32).toBeLessThanOrEqual(400);
  } finally { Object.defineProperty(window,'innerHeight',{value:original,configurable:true}); }
});

it.each([0,320])('starts keyboard resizing from the displayed mini width (%s) without replacing media', width => {
  const view=render(<PlaybackHost watchSlot={null} moveLabel="Move" resizeLabel="Resize"><video data-testid="sized-video"/></PlaybackHost>);
  const video=screen.getByTestId('sized-video');
  vi.spyOn(screen.getByRole('group',{name:'Move'}),'getBoundingClientRect').mockReturnValue({width} as DOMRect);
  fireEvent.keyDown(screen.getByRole('button',{name:'Resize'}),{key:'ArrowRight'});
  expect(screen.getByRole('group',{name:'Move'}).style.width).toContain(`${(width||400)+16}px`);
  expect(screen.getByTestId('sized-video')).toBe(video);
  view.unmount();
});

it('locks at the watch rect then follows the same diagonal mini path',()=>{
 const oldWidth=window.innerWidth,oldHeight=window.innerHeight;
 Object.defineProperties(window,{innerWidth:{configurable:true,value:390},innerHeight:{configurable:true,value:844}});
 try{
  const slot=document.createElement('div');vi.spyOn(slot,'getBoundingClientRect').mockReturnValue({left:0,top:80,width:390,height:219.375} as DOMRect);
  const show=(dy:number,tracking?:boolean)=><PlaybackHost watchSlot={slot} minimizeOffset={dy} tracking={tracking}><video data-testid="diagonal"/></PlaybackHost>;
  const view=render(show(0)),video=screen.getByTestId('diagonal'),host=video.parentElement!;
  view.rerender(show(16));expect(host.style.left).toBe('0px');expect(host.style.top).toBe('80px');expect(host.style.width).toBe('390px');expect(host.style.height).toBe('219.375px');
  view.rerender(show(322.5));expect(host.style.left).toBe('67px');expect(host.style.top).toBe('386.5px');expect(host.style.width).toBe('315px');expect(host.style.height).toBe('177.1875px');
  view.rerender(show(0,true));expect(host.style.left).toBe('0px');expect(host.style.top).toBe('80px');
  view.rerender(show(322.5,true));expect(host.style.left).toBe('67px');expect(host.style.top).toBe('386.5px');
  expect(host.style.transform).toBe('');expect(screen.getByTestId('diagonal')).toBe(video);
 }finally{Object.defineProperties(window,{innerWidth:{configurable:true,value:oldWidth},innerHeight:{configurable:true,value:oldHeight}});}
});

it('cancels before commit on viewport changes but keeps committed mini intent',async()=>{
 const cancel=vi.fn(),slot=document.createElement('div');vi.spyOn(slot,'getBoundingClientRect').mockReturnValue({left:0,top:80,width:390,height:219.375} as DOMRect);
 const view=render(<PlaybackHost watchSlot={slot} minimizeOffset={16} onPullCancel={cancel}><video data-testid="rotate"/></PlaybackHost>);
 const video=screen.getByTestId('rotate'),host=video.parentElement!;
 const height=window.innerHeight;Object.defineProperty(window,'innerHeight',{configurable:true,value:height-24});
 fireEvent(window,new Event('resize'));await waitFor(()=>expect(cancel).toHaveBeenCalledOnce());
 view.rerender(<PlaybackHost watchSlot={null} minimizeOffset={16} onPullCancel={cancel}><video data-testid="rotate"/></PlaybackHost>);
 fireEvent(window,new Event('resize'));await waitFor(()=>expect(cancel).toHaveBeenCalledOnce());expect(host).toHaveAttribute('data-presentation','mini');expect(screen.getByTestId('rotate')).toBe(video);
 Object.defineProperty(window,'innerHeight',{configurable:true,value:height});
});

it('hands the visible pull rect to settling once and fences old rotation callbacks',async()=>{
 const slot=document.createElement('div');vi.spyOn(slot,'getBoundingClientRect').mockReturnValue({left:0,top:80,width:390,height:219.375} as DOMRect);
 const settled=vi.fn(),show=(watch:HTMLElement|null,dy:number)=><PlaybackHost watchSlot={watch} minimizeOffset={dy} onSettled={settled}><video data-testid="handoff"/></PlaybackHost>;
 const view=render(show(slot,16)),video=screen.getByTestId('handoff'),host=video.parentElement!;
 const animations:Array<{cancel:ReturnType<typeof vi.fn>;onfinish:((event:AnimationPlaybackEvent)=>void)|null}>=[];
 host.animate=vi.fn(()=>{const result={cancel:vi.fn(),onfinish:null};animations.push(result);return result as unknown as Animation;});
 const bounds=()=>({left:parseFloat(host.style.left),top:parseFloat(host.style.top),width:parseFloat(host.style.width),height:parseFloat(host.style.height)} as DOMRect);
 const measure=vi.spyOn(host,'getBoundingClientRect').mockImplementation(bounds);
 view.rerender(show(slot,120));const released={left:host.style.left,top:host.style.top,width:host.style.width,height:host.style.height};
 view.rerender(show(null,120));expect(host.animate).toHaveBeenCalledOnce();expect(host.animate).toHaveBeenNthCalledWith(1,[released,expect.anything()],expect.anything());
 view.rerender(show(null,0));expect(host.animate).toHaveBeenCalledOnce();
 const visible={left:200,top:300,width:280,height:157.5};measure.mockReturnValueOnce(visible as DOMRect);
 const original=window.innerHeight;Object.defineProperty(window,'innerHeight',{configurable:true,value:original-100});
 try{
  fireEvent(window,new Event('resize'));await waitFor(()=>expect(animations).toHaveLength(2));
  expect(animations[0].cancel).toHaveBeenCalledOnce();expect(host.animate).toHaveBeenNthCalledWith(2,[{left:'200px',top:'300px',width:'280px',height:'157.5px'},expect.anything()],expect.anything());
  animations[0].onfinish?.({} as AnimationPlaybackEvent);expect(settled).not.toHaveBeenCalled();
  animations[1].onfinish?.({} as AnimationPlaybackEvent);expect(settled).toHaveBeenCalledOnce();expect(screen.getByTestId('handoff')).toBe(video);
 }finally{Object.defineProperty(window,'innerHeight',{configurable:true,value:original});}
});

it('rebounds an uncommitted pull from its current rect to watch without replacing media',()=>{
 const slot=document.createElement('div');vi.spyOn(slot,'getBoundingClientRect').mockReturnValue({left:0,top:80,width:390,height:219.375} as DOMRect);
 const show=(dy:number)=><PlaybackHost watchSlot={slot} minimizeOffset={dy}><video data-testid="rebound"/></PlaybackHost>;
 const view=render(show(16)),video=screen.getByTestId('rebound'),host=video.parentElement!;
 vi.spyOn(host,'getBoundingClientRect').mockImplementation(()=>({left:parseFloat(host.style.left),top:parseFloat(host.style.top),width:parseFloat(host.style.width),height:parseFloat(host.style.height)} as DOMRect));
 host.animate=vi.fn(()=>({cancel:vi.fn()}) as unknown as Animation);
 view.rerender(show(120));const released={left:host.style.left,top:host.style.top,width:host.style.width,height:host.style.height};
 view.rerender(show(0));expect(host.animate).toHaveBeenCalledWith([released,{left:'0px',top:'80px',width:'390px',height:'219.375px'}],expect.objectContaining({duration:220}));expect(screen.getByTestId('rebound')).toBe(video);expect(host).toHaveAttribute('data-presentation','watch');
});

it('commits a pull to right-bottom after the old mini was moved to left-top',()=>{
 const slot=document.createElement('div');vi.spyOn(slot,'getBoundingClientRect').mockReturnValue({left:0,top:80,width:390,height:219.375} as DOMRect);
 const show=(watch:HTMLElement|null,dy:number,tracking:boolean)=><PlaybackHost watchSlot={watch} minimizeOffset={dy} tracking={tracking} moveLabel="Move"><video data-testid="corner-pull"/></PlaybackHost>;
 const view=render(show(null,0,false)),host=screen.getByRole('group',{name:'Move'});
 fireEvent.keyDown(host,{key:'ArrowLeft'});fireEvent.keyDown(host,{key:'ArrowUp'});expect(host).toHaveAttribute('data-left','true');expect(host).toHaveAttribute('data-top','true');
 view.rerender(show(slot,0,false));view.rerender(show(slot,16,true));view.rerender(show(slot,120,true));view.rerender(show(null,120,false));
 expect(host).toHaveAttribute('data-left','false');expect(host).toHaveAttribute('data-top','false');expect(parseFloat(host.style.left)+parseFloat(host.style.width)).toBe(window.innerWidth-16);expect(parseFloat(host.style.top)+parseFloat(host.style.height)).toBe(window.innerHeight-16);
});
