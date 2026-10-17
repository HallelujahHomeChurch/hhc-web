import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {beforeEach,expect,it,vi} from 'vitest';
import {VideoInteractions} from './VideoInteractions';
import type {createMemberVideoApi} from './api';
beforeEach(()=>{Object.defineProperty(window,'matchMedia',{configurable:true,value:vi.fn(()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()}))});});
function api(){return {interactions:vi.fn().mockResolvedValue({liked:false,likes:2,commentsEnabled:true}),metrics:vi.fn().mockResolvedValue({currentViewers:3,totalViews:8}),comments:vi.fn().mockResolvedValue({items:[]}),createComment:vi.fn(),setLike:vi.fn().mockResolvedValue({liked:true,likes:3,commentsEnabled:true})};}
it('retries an uncertain comment with the same identity and renders markup as plain text',async()=>{
 const client=api();client.createComment.mockRejectedValueOnce(new Error('lost')).mockResolvedValue({});
 render(<VideoInteractions api={client as unknown as ReturnType<typeof createMemberVideoApi>} id="r1" title="Meeting" locale="en" live/>);
 fireEvent.change(await screen.findByLabelText('Add a comment'),{target:{value:'<script>hello</script>'}});
 fireEvent.click(screen.getByRole('button',{name:'Comment'}));await screen.findByRole('alert');
 expect(screen.getByLabelText('Add a comment')).toBeDisabled();fireEvent.click(screen.getByRole('button',{name:'Retry'}));
 await waitFor(()=>expect(client.createComment).toHaveBeenCalledTimes(2));expect(client.createComment.mock.calls[0][1]).toEqual(client.createComment.mock.calls[1][1]);
 expect(await screen.findByText('3 watching now')).toBeInTheDocument();
});
it('uses desired-state likes, and never displays unavailable metrics as zero',async()=>{
 const client=api();client.metrics.mockRejectedValue(new Error('unavailable'));
 render(<VideoInteractions api={client as unknown as ReturnType<typeof createMemberVideoApi>} id="r1" title="Meeting" locale="en" live={false}/>);
 fireEvent.click(await screen.findByRole('button',{name:/2\s*Like/}));await waitFor(()=>expect(client.setLike).toHaveBeenCalledWith('r1',{liked:true}));expect(screen.queryByText('0 views')).toBeNull();
});
it('ignores a poll started before an acknowledged like',async()=>{
 const {act}=await import('@testing-library/react');const client=api();vi.useFakeTimers();
 try {
  render(<VideoInteractions api={client as unknown as ReturnType<typeof createMemberVideoApi>} id="r1" title="Meeting" locale="en" live/>);
  await act(async()=>{});
  let finish!:(v:unknown)=>void;client.interactions.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve}));
  await act(async()=>{await vi.advanceTimersByTimeAsync(30000)});
  fireEvent.click(screen.getByRole('button',{name:/2\s*Like/}));await act(async()=>{});
  await act(async()=>finish({liked:false,likes:2,commentsEnabled:true}));
  expect(screen.getByRole('button',{name:/3\s*Like/})).toHaveAttribute('aria-pressed','true');
  fireEvent.click(screen.getByRole('button',{name:/3\s*Like/}));await act(async()=>{});
  expect(client.setLike).toHaveBeenLastCalledWith('r1',{liked:false});
 } finally {vi.useRealTimers()}
});
it('reconciles a committed edit after its response is lost while preserving the draft',async()=>{
 const client=api();const comment={id:'c1',text:'Original',revision:1,mine:true,displayName:'Member',createdAt:'2026-10-15T10:00:00Z',replyCount:0,deleted:false};
 client.comments.mockResolvedValue({items:[comment]});const updateComment=vi.fn().mockImplementation(async()=>{client.comments.mockResolvedValue({items:[{...comment,text:'Changed',revision:2}]});throw Error('Response lost')});
 render(<VideoInteractions api={{...client,updateComment} as unknown as ReturnType<typeof createMemberVideoApi>} id="r1" title="Meeting" locale="en" live/>);
 fireEvent.click(await screen.findByLabelText('Comment actions'));fireEvent.click(screen.getByRole('button',{name:'Edit'}));fireEvent.change(screen.getByLabelText('Edit'),{target:{value:'Changed'}});fireEvent.click(screen.getByRole('button',{name:'Save'}));
 await waitFor(()=>expect(screen.queryByRole('button',{name:'Save'})).toBeNull());expect(screen.getByText('Changed')).toBeInTheDocument();expect(updateComment).toHaveBeenCalledOnce();
});

it('settles metrics independently from the comment summary without showing unavailable first',async()=>{
 const {act}=await import('@testing-library/react');const client=api();
 let stats!:(value:unknown)=>void,summary!:(value:unknown)=>void;
 client.metrics.mockImplementation(()=>new Promise(resolve=>{stats=resolve}));
 client.interactions.mockImplementation(()=>new Promise(resolve=>{summary=resolve}));
 const view=render(<VideoInteractions api={client as unknown as ReturnType<typeof createMemberVideoApi>} id="r1" title="Meeting" locale="en" live={false}/>);
 expect(screen.queryByText('Viewing statistics unavailable')).not.toBeInTheDocument();
 expect(view.container.querySelector('[data-loading-layout="video-interactions"]')).not.toBeNull();
 await act(async()=>stats({totalViews:0,currentViewers:0}));
 expect(screen.getByText('0 views')).toBeInTheDocument();
 expect(view.container.querySelector('[data-loading-layout="video-interactions"]')).not.toBeNull();
 await act(async()=>summary({liked:false,likes:0,commentCount:0,commentsEnabled:true}));
 await screen.findByLabelText('Add a comment');
 expect(view.container.querySelector('[data-loading-layout="video-interactions"]')).toBeNull();
});

it('keeps the last valid metrics when a later poll fails',async()=>{
 const {act}=await import('@testing-library/react');const client=api();vi.useFakeTimers();
 try {
  render(<VideoInteractions api={client as unknown as ReturnType<typeof createMemberVideoApi>} id="r1" title="Meeting" locale="en" live={false}/>);
  await act(async()=>{});expect(screen.getByText('8 views')).toBeInTheDocument();
  client.metrics.mockRejectedValue(new Error('offline'));
  await act(async()=>{await vi.advanceTimersByTimeAsync(30000)});
  expect(screen.getByText('8 views')).toBeInTheDocument();
 }finally{vi.useRealTimers()}
});

it('replaces first-load metrics placeholders with unavailable after a failed request',async()=>{
 const client=api();client.metrics.mockRejectedValue(new Error('unavailable'));
 const view=render(<VideoInteractions api={client as unknown as ReturnType<typeof createMemberVideoApi>} id="r1" title="Meeting" locale="en" live={false}/>);
 expect(screen.queryByText('Viewing statistics unavailable')).not.toBeInTheDocument();
 expect(await screen.findByText('Viewing statistics unavailable')).toBeInTheDocument();
 expect(view.container.querySelector('[data-loading-layout="video-interactions"]')).toBeNull();
});
