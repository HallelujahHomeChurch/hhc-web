import {fireEvent,render,screen} from '@testing-library/react';
import {expect,it,vi} from 'vitest';
import {getMessages} from '@/i18n/messages';
import {RetainedReaderContent} from './RetainedReaderContent';

it('keeps original quotations and authored text readable without applying or discarding them',()=>{
 const m=getMessages('en').weeklyReader,position=vi.fn().mockResolvedValue(undefined);
 const entries=[{mutation:{mutationId:'original',createdAt:'2026-10-18',documentRevision:1,kind:'createNote' as const,payload:{noteId:'note',sentenceIds:['old'],text:'My offline text'}},sent:false,sourceQuote:'Original passage 😀'}];
 render(<RetainedReaderContent entries={entries} messages={m} busy={false} onPosition={position}/>);
 expect(screen.getByText('Original passage 😀')).toBeVisible();expect(screen.getByText('My offline text')).toBeVisible();
 expect(position).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:m.retainedPosition}));
 expect(position).toHaveBeenCalledWith('original');expect(entries[0].mutation.documentRevision).toBe(1);
});
