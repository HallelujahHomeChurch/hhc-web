import {act, render, screen, fireEvent} from '@testing-library/react';
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
  expect(host.style.transform).toContain('40px');
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
  const view=render(<PlaybackHost watchSlot={slot}><video data-testid="transition-video"/></PlaybackHost>);
  const video=screen.getByTestId('transition-video'),host=video.parentElement!;
  const cancel=vi.fn(),animate=vi.fn(()=>({cancel}) as unknown as Animation);host.animate=animate;
  vi.spyOn(host,'getBoundingClientRect').mockImplementation(()=>host.dataset.presentation==='watch'?({left:100,top:80,width:800,height:450} as DOMRect):({left:600,top:400,width:360,height:203} as DOMRect));
  view.rerender(<PlaybackHost watchSlot={slot} minimizeOffset={40}><video data-testid="transition-video"/></PlaybackHost>);
  view.rerender(<PlaybackHost watchSlot={null}><video data-testid="transition-video"/></PlaybackHost>);
  expect(animate).toHaveBeenCalledWith([expect.objectContaining({transform:expect.stringContaining('translate(-500px, -320px)')}),expect.objectContaining({transform:'none'})],expect.objectContaining({duration:220}));
  expect(screen.getByTestId('transition-video')).toBe(video);
});

it('keeps the close controls inside a short viewport when resizing', () => {
  const original=window.innerHeight;
  Object.defineProperty(window,'innerHeight',{value:400,configurable:true});
  try {
    render(<PlaybackHost watchSlot={null} moveLabel="Move" resizeLabel="Resize"><video/></PlaybackHost>);
    for(let i=0;i<30;i++)fireEvent.keyDown(screen.getByRole('button',{name:'Resize'}),{key:'ArrowRight'});
    const width=Number(screen.getByRole('group',{name:'Move'}).style.width.match(/min\(([\d.]+)px/)?.[1]);
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

it('reveals mini actions for keyboard focus but clears pointer focus residue',()=>{
 render(<PlaybackHost watchSlot={null} moveLabel="Move"><button>Action</button></PlaybackHost>);
 const host=screen.getByRole('group',{name:'Move'}),button=screen.getByRole('button',{name:'Action'});
 act(()=>button.focus());expect(host).toHaveAttribute('data-keyboard-focus','false');
 act(()=>button.blur());fireEvent.keyDown(document,{key:'Tab'});act(()=>button.focus());
 expect(host).toHaveAttribute('data-keyboard-focus','true');
 fireEvent.pointerDown(document.body);
 expect(document.activeElement).toBe(button);expect(host).toHaveAttribute('data-keyboard-focus','false');
});
