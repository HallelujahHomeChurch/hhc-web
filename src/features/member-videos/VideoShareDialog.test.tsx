import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {it,expect,vi} from 'vitest';
import {VideoShareDialog} from './VideoShareDialog';
it('shares the same validated timestamp URL without invoking native share',async()=>{
 const copy=vi.fn().mockResolvedValue(undefined),native=vi.fn();Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:copy}});Object.defineProperty(navigator,'share',{configurable:true,value:native});
 render(<VideoShareDialog open onClose={()=>{}} title="Meeting" watchUrl="https://www.example/zh/member-videos/r?secret=no#x" currentTime={61} durationSeconds={600} locale="en"/>);
 fireEvent.click(screen.getByLabelText('Start at'));fireEvent.change(screen.getByLabelText('Start time'),{target:{value:'2:03'}});
 fireEvent.click(screen.getByRole('button',{name:'Copy'}));await waitFor(()=>expect(copy).toHaveBeenCalledWith('https://www.example/zh/member-videos/r?t=123'));
 expect(screen.getByRole('link',{name:'WhatsApp'}).getAttribute('href')).toContain(encodeURIComponent('?t=123'));
 expect(native).not.toHaveBeenCalled();
 fireEvent.change(screen.getByLabelText('Start time'),{target:{value:'99:99'}});expect(screen.getByRole('button',{name:'Copy'})).toBeDisabled();
});
