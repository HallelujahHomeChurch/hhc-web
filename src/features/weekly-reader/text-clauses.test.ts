import {expect, it} from 'vitest';
import {fragmentClauses, textClauses, toggleClauseRanges} from './text-clauses';
import {rangeQuote} from './text-range';
const sentences=[{id:'s',componentId:'c',text:'甲😀，乙。丙。'},{id:'t',componentId:'c',text:'下一句。'}];
const clauses=sentences.flatMap(textClauses);
it('splits only Chinese comma/period with closing quotes and Unicode scalar offsets',()=>{
 const sentence={id:'s',componentId:'c',text:'「甲😀，」乙3.14,000。「丙。」  '};
 const ranges=textClauses(sentence);
 expect(ranges.map(range=>rangeQuote([range],[sentence]))).toEqual(['「甲😀，」','乙3.14,000。','「丙。」  ']);
 expect(ranges.map(({start,end})=>[start,end])).toEqual([[0,5],[5,15],[15,21]]);
 expect(textClauses({...sentence,text:' \n\t'})).toEqual([]);
});
it('extends adjacent clauses, merges within a sentence, and clears any selected unit',()=>{
 let ranges=toggleClauseRanges([],clauses[1],clauses,sentences);
 ranges=toggleClauseRanges(ranges,clauses[0],clauses,sentences);
 expect(ranges).toEqual([{sentenceId:'s',start:0,end:5}]);
 ranges=toggleClauseRanges(ranges,clauses[2],clauses,sentences);
 ranges=toggleClauseRanges(ranges,clauses[3],clauses,sentences);
 expect(rangeQuote(ranges,sentences)).toBe('甲😀，乙。丙。下一句。');
 expect(toggleClauseRanges(ranges,clauses[1],clauses,sentences)).toEqual([]);
});
it('resets distant units and invalid historical selections without filling unselected text',()=>{
 expect(toggleClauseRanges([clauses[0]],clauses[2],clauses,sentences)).toEqual([clauses[2]]);
 expect(toggleClauseRanges([clauses[0],clauses[2]],clauses[1],clauses,sentences)).toEqual([clauses[1]]);
 expect(toggleClauseRanges([clauses[0]],{sentenceId:'foreign',start:0,end:1},clauses,sentences)).toEqual([clauses[0]]);
});
it('binds a later page fragment to its exact canonical scalar range and rejects untrusted markup',()=>{
 const el=document.createElement('span');el.dataset.sentenceId='s';el.dataset.fragmentStart='3';el.dataset.fragmentEnd='7';el.textContent='乙。丙。';
 expect(fragmentClauses(el,sentences,clauses)).toEqual(clauses.slice(1,3));
 el.textContent='甲。丙。';expect(fragmentClauses(el,sentences,clauses)).toEqual([]);
 el.textContent='乙。丙。';el.dataset.fragmentEnd='8';expect(fragmentClauses(el,sentences,clauses)).toEqual([]);
 el.dataset.fragmentEnd='7';el.setAttribute('inert','');expect(fragmentClauses(el,sentences,clauses)).toEqual([]);
});

it('keeps the previous passage when extending would exceed the 500-range contract',()=>{
 const sentences=Array.from({length:501},(_,i)=>({id:String(i),componentId:'c',text:'甲。'}));
 const clauses=sentences.flatMap(textClauses),selected=clauses.slice(0,500);
 expect(toggleClauseRanges(selected,clauses[500],clauses,sentences)).toEqual(selected);
});
