import {useRef} from 'react';
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {useReaderSelection, type ReaderSelection} from './useReaderSelection';
const sentences=[{id:'s',componentId:'c',text:'abcdefgh'},{id:'t',componentId:'c',text:'next'}];
function Harness({mode='text',locked=false,initial={ids:[]}}: {mode?:'text'|'sentence';locked?:boolean;initial?:ReaderSelection}) {
  const root=useRef<HTMLDivElement>(null),{selection,selecting}=useReaderSelection(root,sentences,initial,locked,mode);
  return <><div ref={root} tabIndex={0}><span data-sentence-id="s" data-fragment-start="0" data-fragment-end="8">abcdefgh</span><span data-sentence-id="t" data-fragment-start="0" data-fragment-end="4">next</span><div>Margin</div></div><div>Distant</div><output>{JSON.stringify(selection)}</output>{selection.ids.length&&!selecting?<button className="reader-selection-tools">Annotate</button>:null}</>;
}
function select(end:number) {
  const text=screen.getByText('abcdefgh'),range=document.createRange();range.setStart(text.firstChild!,0);range.setEnd(text.firstChild!,end);
  window.getSelection()!.removeAllRanges();window.getSelection()!.addRange(range);fireEvent(document,new Event('selectionchange'));return text;
}
afterEach(()=>{cleanup();vi.useRealTimers();window.getSelection()?.removeAllRanges();});
it('toggles sentences in document order, dismisses far away and selects again',()=>{
  render(<Harness mode="sentence"/>);fireEvent.click(screen.getByText('next'));fireEvent.click(screen.getByText('abcdefgh'));
  expect(screen.getByRole('status')).toHaveTextContent('{"ids":["s","t"]}');expect(window.getSelection()?.toString()).toBe('');
  fireEvent.click(screen.getByText('abcdefgh'));expect(screen.getByRole('status')).toHaveTextContent('{"ids":["t"]}');
  fireEvent.click(screen.getByText('Distant'));expect(screen.queryByText('Annotate')).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('abcdefgh'));expect(screen.getByText('Annotate')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Margin'));expect(screen.queryByText('Annotate')).not.toBeInTheDocument();
});
it('ignores mobile scroll gestures and native selection changes',()=>{
  render(<Harness mode="sentence"/>);const text=screen.getByText('abcdefgh');
  fireEvent(text,new MouseEvent('pointerdown',{bubbles:true,clientX:10,clientY:10}));fireEvent(text,new MouseEvent('pointermove',{bubbles:true,clientX:10,clientY:90}));
  fireEvent(text,new MouseEvent('pointerup',{bubbles:true,clientX:10,clientY:90}));fireEvent.click(text);expect(screen.queryByText('Annotate')).not.toBeInTheDocument();
  select(3);expect(screen.queryByText('Annotate')).not.toBeInTheDocument();
});
it('preserves selection on annotation controls and locks editing',()=>{
  const {rerender}=render(<Harness mode="sentence"/>);fireEvent.click(screen.getByText('abcdefgh'));fireEvent.click(screen.getByText('Annotate'));
  expect(screen.getByRole('status')).toHaveTextContent('{"ids":["s"]}');rerender(<Harness mode="sentence" locked/>);fireEvent.click(screen.getByText('next'));
  expect(screen.getByRole('status')).toHaveTextContent('{"ids":["s"]}');
});
it('clears captured partial ranges on device mode change',()=>{
  vi.useFakeTimers();const {rerender}=render(<Harness/>);select(3);act(()=>vi.advanceTimersByTime(200));expect(screen.getByText('Annotate')).toBeInTheDocument();
  rerender(<Harness mode="sentence"/>);expect(screen.queryByText('Annotate')).not.toBeInTheDocument();expect(window.getSelection()?.toString()).toBe('');
});
it('preserves draft-owned exact anchors across breakpoint changes until the editor unlocks',()=>{
  const initial={ids:['s'],ranges:[{sentenceId:'s',start:1,end:3}]};
  const {rerender}=render(<Harness mode="text" locked initial={initial}/>);
  rerender(<Harness mode="sentence" locked initial={initial}/>);
  expect(screen.getByRole('status')).toHaveTextContent(JSON.stringify(initial));
  rerender(<Harness mode="sentence" initial={initial}/>);
  expect(screen.getByRole('status')).toHaveTextContent('{"ids":[]}');
});
it('waits for keyboard selection to finish and hides while extending',()=>{
  vi.useFakeTimers();render(<Harness/>);const text=screen.getByText('abcdefgh');fireEvent.keyDown(text,{key:'ArrowRight',shiftKey:true});select(3);act(()=>vi.advanceTimersByTime(500));
  expect(screen.queryByText('Annotate')).not.toBeInTheDocument();fireEvent.keyUp(text,{key:'ArrowRight',shiftKey:true});expect(screen.getByText('Annotate')).toBeInTheDocument();
  fireEvent.keyDown(text,{key:'ArrowRight',shiftKey:true});select(4);expect(screen.queryByText('Annotate')).not.toBeInTheDocument();fireEvent.keyUp(text,{key:'Shift'});
  expect(screen.getByRole('status')).toHaveTextContent('"start":0,"end":4');
});
it('settles tablet native handle changes without pointer events',()=>{
  vi.useFakeTimers();render(<Harness/>);select(2);act(()=>vi.advanceTimersByTime(100));select(4);act(()=>vi.advanceTimersByTime(100));
  expect(screen.queryByText('Annotate')).not.toBeInTheDocument();act(()=>vi.advanceTimersByTime(100));expect(screen.getByText('Annotate')).toBeInTheDocument();
});
it('retains desktop ranges on controls and supports repeated drag selection',()=>{
  vi.useFakeTimers();render(<Harness/>);const text=screen.getByText('abcdefgh');
  for(let i=0;i<2;i++) {fireEvent(text,new MouseEvent('pointerdown',{bubbles:true,clientX:10,clientY:10}));select(3);fireEvent(text,new MouseEvent('pointerup',{bubbles:true,clientX:50,clientY:10}));fireEvent.click(text,{clientX:50,clientY:10});act(()=>vi.advanceTimersByTime(200));expect(screen.getByText('Annotate')).toBeInTheDocument();}
  fireEvent.pointerDown(screen.getByText('Annotate'));window.getSelection()?.removeAllRanges();fireEvent(document,new Event('selectionchange'));
  expect(screen.getByRole('status')).toHaveTextContent('"start":0,"end":3');fireEvent.pointerDown(screen.getByText('Distant'));expect(screen.queryByText('Annotate')).not.toBeInTheDocument();
});
