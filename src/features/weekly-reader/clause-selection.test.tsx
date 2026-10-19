import {useRef} from 'react';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {useReaderSelection} from './useReaderSelection';
const sentence={id:'s',componentId:'c',text:'甲😀，乙。丙。'};
const original=Object.getOwnPropertyDescriptor(Range.prototype,'getClientRects');
function Harness({fragment=false}:{fragment?:boolean}){
 const root=useRef<HTMLDivElement>(null),{selection}=useReaderSelection(root,[sentence],{ids:[]},false,'clause');
 return <><div ref={root}><span role="button" tabIndex={0} data-sentence-id="s" data-fragment-start={fragment?3:0} data-fragment-end="7">{fragment?'乙。丙。':sentence.text}</span></div><output>{JSON.stringify(selection)}</output></>;
}
beforeEach(()=>Object.defineProperty(Range.prototype,'getClientRects',{configurable:true,value:function(this:Range){return [new DOMRect(this.toString().startsWith('甲')?0:this.toString().startsWith('乙')?30:50,20,this.toString().startsWith('甲')?30:20,12)];}}));
afterEach(()=>{cleanup();vi.unstubAllGlobals();if(original)Object.defineProperty(Range.prototype,'getClientRects',original);else Reflect.deleteProperty(Range.prototype,'getClientRects');});
function pointer(type:string,x:number,y=25,id=1){const e=new MouseEvent(type,{bubbles:true,clientX:x,clientY:y});Object.defineProperty(e,'pointerId',{value:id});fireEvent(screen.getByRole('button'),e);}
function tap(x:number){pointer('pointerdown',x);pointer('pointerup',x);fireEvent.click(screen.getByRole('button'),{clientX:x,clientY:25,detail:1});}
function selection(){return JSON.parse(screen.getByRole('status').textContent!);}
it('hit-tests exact glyph ranges and extends/reset/clears without whole-sentence selection',()=>{
 render(<Harness/>);tap(35);expect(selection().ranges).toEqual([{sentenceId:'s',start:3,end:5}]);
 tap(15);expect(selection().ranges).toEqual([{sentenceId:'s',start:0,end:5}]);
 tap(35);expect(selection()).toEqual({ids:[]});
 tap(15);tap(55);expect(selection().ranges).toEqual([{sentenceId:'s',start:5,end:7}]);
});
it('keeps page-two fragment offsets and refuses taps outside its actual text rectangles',()=>{
 render(<Harness fragment/>);tap(35);expect(selection().ranges).toEqual([{sentenceId:'s',start:3,end:5}]);
 tap(120);expect(selection().ranges).toEqual([{sentenceId:'s',start:3,end:5}]);
});
it('does not treat scrolling, cancelled pointers or a two-finger gesture as a selection',()=>{
 render(<Harness/>);pointer('pointerdown',15);pointer('pointermove',40);pointer('pointerup',40);fireEvent.click(screen.getByRole('button'),{clientX:40,clientY:25,detail:1});expect(selection()).toEqual({ids:[]});
 pointer('pointerdown',15);pointer('pointercancel',15);fireEvent.click(screen.getByRole('button'),{clientX:15,clientY:25,detail:1});expect(selection()).toEqual({ids:[]});
 pointer('pointerdown',15,25,1);pointer('pointerdown',35,25,2);pointer('pointerup',15,25,1);pointer('pointerup',35,25,2);fireEvent.click(screen.getByRole('button'),{clientX:35,clientY:25,detail:1});expect(selection()).toEqual({ids:[]});
});
it('provides clause keyboard navigation and stable Enter/Space toggling',()=>{
 render(<Harness/>);const text=screen.getByRole('button');
 fireEvent.keyDown(text,{key:'ArrowRight'});fireEvent.keyDown(text,{key:'ArrowRight'});expect(selection().ranges).toEqual([{sentenceId:'s',start:3,end:5}]);
 fireEvent.keyDown(text,{key:'Enter'});expect(selection()).toEqual({ids:[]});
 fireEvent.keyDown(text,{key:' '});expect(selection().ranges).toEqual([{sentenceId:'s',start:3,end:5}]);
 fireEvent.keyDown(text,{key:'End'});expect(selection().ranges).toEqual([{sentenceId:'s',start:5,end:7}]);
});
it('uses measured scaled glyph coordinates and refuses native pinch-zoom taps',()=>{
 Object.defineProperty(Range.prototype,'getClientRects',{configurable:true,value:function(this:Range){return [new DOMRect(this.toString().startsWith('甲')?0:this.toString().startsWith('乙')?90:150,60,60,36)];}});
 render(<Harness/>);pointer('pointerdown',105,75);pointer('pointerup',105,75);fireEvent.click(screen.getByRole('button'),{clientX:105,clientY:75,detail:1});
 expect(selection().ranges).toEqual([{sentenceId:'s',start:3,end:5}]);
 vi.stubGlobal('visualViewport',{scale:2});pointer('pointerdown',15,75);pointer('pointerup',15,75);fireEvent.click(screen.getByRole('button'),{clientX:15,clientY:75,detail:1});
 expect(selection().ranges).toEqual([{sentenceId:'s',start:3,end:5}]);
});

it('extends adjacent keyboard clauses with Shift+arrows and preserves clear and distant reset',()=>{
 render(<Harness/>);const text=screen.getByRole('button');
 fireEvent.keyDown(text,{key:'Home'});fireEvent.keyDown(text,{key:'ArrowRight',shiftKey:true});
 expect(selection().ranges).toEqual([{sentenceId:'s',start:0,end:5}]);
 fireEvent.keyDown(text,{key:'ArrowRight',shiftKey:true});expect(selection().ranges).toEqual([{sentenceId:'s',start:0,end:7}]);
 fireEvent.keyDown(text,{key:'ArrowRight',shiftKey:true});expect(selection().ranges).toEqual([{sentenceId:'s',start:0,end:7}]);
 fireEvent.keyDown(text,{key:' '});expect(selection()).toEqual({ids:[]});
 fireEvent.keyDown(text,{key:'Home'});fireEvent.keyDown(text,{key:'End'});expect(selection().ranges).toEqual([{sentenceId:'s',start:5,end:7}]);
 fireEvent.keyDown(text,{key:'ArrowLeft',shiftKey:true});expect(selection().ranges).toEqual([{sentenceId:'s',start:3,end:7}]);
});
