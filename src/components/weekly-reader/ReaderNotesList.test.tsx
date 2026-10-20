import {fireEvent, render, screen} from '@testing-library/react';
import {expect, it, vi} from 'vitest';
import {ReaderNotesList} from './ReaderNotesList';
import {readerFixture} from '@/features/weekly-reader/test-fixture';
import {getMessages} from '@/i18n/messages';
import {readerSentences} from '@/features/weekly-reader/selection';
const m=getMessages('en').weeklyReader;
function props() {
 const doc=readerFixture().document;
 const onChange=vi.fn().mockResolvedValue(undefined),onClearFilter=vi.fn();
 const note={id:'n1',text:'ＡＢＣ 😀',quote:'quote',sentenceIds:['s0'],ranges:[],inactiveAnchors:[],reanchorRequired:false,createdAt:'',version:1,deleted:false,updatedAt:''};
 return {messages:m,filter:['n1'],onClearFilter,
 notes:{messages:m,notes:[note,{...note,id:'n2',text:'other'}],onJump:vi.fn(),onEdit:vi.fn(),onDelete:vi.fn(),onReanchor:vi.fn()},
 highlights:{messages:m,highlights:[{sentenceId:'s1',quote:'內容1。',active:true,color:'yellow' as const,version:1,updatedAt:''}],sentences:readerSentences(doc),busy:false,onChange}};
}
it('filters the current passage and normalized text without writes, and exposes the clear exit',()=>{
 const p=props();render(<ReaderNotesList {...p}/>);
 expect(screen.getByText(m.currentPassage)).toBeInTheDocument();
 fireEvent.change(screen.getByRole('searchbox'),{target:{value:'abc'}});
 expect(screen.getByText('ＡＢＣ 😀')).toBeInTheDocument();
 fireEvent.change(screen.getByRole('searchbox'),{target:{value:'missing'}});
 expect(screen.getByRole('status')).toHaveTextContent('0 notes');
 fireEvent.click(screen.getByRole('button',{name:m.showAllNotes}));expect(p.onClearFilter).toHaveBeenCalledOnce();
 fireEvent.click(screen.getByRole('tab',{name:m.highlightsTab}));expect(p.onClearFilter).toHaveBeenCalledTimes(2);
 fireEvent.change(screen.getByRole('searchbox'),{target:{value:'missing'}});expect(screen.getByText(m.highlightsEmpty)).toBeInTheDocument();
 expect(screen.queryByRole('group',{name:m.highlightColors})).not.toBeInTheDocument();
 expect(p.highlights.onChange).not.toHaveBeenCalled();
});
it('removes the legacy tab and exposes a labelled clear icon without recolor controls',()=>{
 const p=props();render(<ReaderNotesList {...p} filter={null}/>);
 expect(screen.queryByRole('tab',{name:m.historyTab})).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('tab',{name:m.highlightsTab}));
 expect(screen.getByRole('button',{name:m.clearHighlight})).toBeInTheDocument();
 for(const color of ['yellow','red','blue'] as const) expect(screen.queryByRole('button',{name:m[`${color}Highlight`]})).not.toBeInTheDocument();
});

it('exports the currently visible IDs without modifying filters or note drafts',()=>{
 const p=props(),onExport=vi.fn();render(<ReaderNotesList {...p} onExport={onExport}/>);
 fireEvent.change(screen.getByRole('searchbox'),{target:{value:'abc'}});
 fireEvent.click(screen.getByRole('button',{name:m.exportNotes}));expect(onExport).toHaveBeenCalledWith(['n1']);
 expect(p.notes.onEdit).not.toHaveBeenCalled();expect(p.notes.onDelete).not.toHaveBeenCalled();expect(p.onClearFilter).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('tab',{name:m.highlightsTab}));expect(screen.queryByRole('button',{name:m.exportNotes})).not.toBeInTheDocument();
});
