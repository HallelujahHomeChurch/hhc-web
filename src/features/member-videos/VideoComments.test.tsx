import {beforeEach,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,waitFor,act,within} from '@testing-library/react';
import {VideoComments} from './VideoComments';
import type {createMemberVideoApi} from './api';
let mobile=false;let resize:()=>void;
beforeEach(()=>{
 mobile=false;resize=()=>{};
 Object.defineProperty(window,'matchMedia',{configurable:true,value:()=>({get matches(){return mobile;},addEventListener:(_name:string,fn:()=>void)=>{resize=fn;},removeEventListener:vi.fn()})});
 HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
});
const root={id:'root',displayName:'Alice',text:'Root',createdAt:'2026-10-17T00:00:00Z',replyCount:1,revision:1,deleted:false,mine:false};
const reply={...root,id:'reply',parentId:'root',displayName:'Bob',text:'Reply text',replyCount:0};
function fixture(){return {comments:vi.fn().mockImplementation(async(_id,options)=>({items:options.parentId?[reply]:[root]})),createComment:vi.fn().mockResolvedValue({}),setCommentReaction:vi.fn().mockResolvedValue({likes:1,reaction:'like'})};}
it('replies to a reply within the root thread and never fetches a nested thread',async()=>{
 const api=fixture();render(<VideoComments api={api as unknown as ReturnType<typeof createMemberVideoApi>} id="r" locale="en" count={2} enabled onChanged={()=>{}}/>);
 fireEvent.click(await screen.findByRole('button',{name:'1 Replies'}));await screen.findByText('Reply text');
 const item=screen.getByText('Reply text').closest('article')!;fireEvent.click(within(item).getByRole('button',{name:'Reply'}));
 fireEvent.change(screen.getByPlaceholderText('Reply'),{target:{value:'Answer'}});fireEvent.click(within(item).getByRole('button',{name:'Comment'}));
 await waitFor(()=>expect(api.createComment).toHaveBeenCalledWith('r',expect.objectContaining({parentId:'root',replyToId:'reply',text:'Answer'})));
 expect(api.comments.mock.calls.some(([,options])=>options.parentId==='reply')).toBe(false);
});
it('preserves a draft across mobile close, reopen and desktop resize',async()=>{
 mobile=true;const api=fixture();render(<VideoComments api={api as unknown as ReturnType<typeof createMemberVideoApi>} id="r" locale="en" count={2} enabled onChanged={()=>{}}/>);
 fireEvent.click(screen.getByRole('button',{name:/2 Comments/}));const input=screen.getByPlaceholderText('Add a comment');fireEvent.change(input,{target:{value:'Keep draft'}});
 fireEvent.click(screen.getByRole('button',{name:'Close'}));fireEvent.click(screen.getByRole('button',{name:/2 Comments/}));expect(screen.getByPlaceholderText('Add a comment')).toHaveValue('Keep draft');
 await act(async()=>{mobile=false;resize();});expect(screen.getByPlaceholderText('Add a comment')).toHaveValue('Keep draft');
});
it('offers a fresh traversal after an expired top cursor rather than retrying it forever',async()=>{
 const api=fixture();api.comments.mockResolvedValueOnce({items:[root],nextCursor:'expired'}).mockRejectedValueOnce({code:'recording_comment_cursor_expired'}).mockResolvedValue({items:[root]});
 render(<VideoComments api={api as unknown as ReturnType<typeof createMemberVideoApi>} id="r" locale="en" count={1} enabled onChanged={()=>{}}/>);
 fireEvent.click(await screen.findByRole('button',{name:'Load more'}));await screen.findByRole('status');fireEvent.click(screen.getByRole('button',{name:'Retry'}));
 await waitFor(()=>expect(api.comments).toHaveBeenLastCalledWith('r',expect.objectContaining({cursor:undefined,refresh:true})));
});

it('refreshes reaction counts and toggles from the latest server reaction',async()=>{
 const api=fixture();api.comments.mockResolvedValueOnce({items:[{...root,likes:1,reaction:null}]}).mockResolvedValue({items:[{...root,likes:4,reaction:'like'}]});
 render(<VideoComments api={api as unknown as ReturnType<typeof createMemberVideoApi>} id="r" locale="en" count={1} enabled onChanged={()=>{}}/>);
 await screen.findByRole('button',{name:'Like'});fireEvent.click(screen.getByRole('button',{name:'Refresh comments'}));
 await waitFor(()=>expect(screen.getByRole('button',{name:'Like'})).toHaveAttribute('aria-pressed','true'));
 expect(screen.getByRole('button',{name:'Like'})).toHaveTextContent('4');
 fireEvent.click(screen.getByRole('button',{name:'Like'}));
 await waitFor(()=>expect(api.setCommentReaction).toHaveBeenCalledWith('r','root',{reaction:null}));
});

it('reconciles a local reaction when a refresh returns the original server values',async()=>{
 const api=fixture();api.comments.mockImplementation(async()=>({items:[{...root,likes:0,reaction:null}]}));
 render(<VideoComments api={api as unknown as ReturnType<typeof createMemberVideoApi>} id="r" locale="en" count={1} enabled onChanged={()=>{}}/>);
 fireEvent.click(await screen.findByRole('button',{name:'Like'}));
 await waitFor(()=>expect(screen.getByRole('button',{name:'Like'})).toHaveAttribute('aria-pressed','true'));
 fireEvent.click(screen.getByRole('button',{name:'Refresh comments'}));
 await waitFor(()=>expect(screen.getByRole('button',{name:'Like'})).toHaveAttribute('aria-pressed','false'));
});
