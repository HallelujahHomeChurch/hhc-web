import {fireEvent,render,screen} from '@testing-library/react';
import {createRef} from 'react';
import {expect,it,vi} from 'vitest';
import {HlsPlayer} from './HlsPlayer';
const router=vi.hoisted(()=>({push:vi.fn()}));
vi.mock('next/navigation',()=>({useRouter:()=>router}));
vi.mock('@hallelujahhomechurch/ui/player',()=>({HlsPlayer:({onNavigate,watermark}:{onNavigate:(href:string)=>void;watermark:string})=><button onClick={()=>onNavigate('/zh-Hant/member-videos/next')}>{watermark}</button>}));
it('keeps member watermark and Next navigation at the shared player boundary',()=>{
 render(<HlsPlayer playbackUrl="https://media.alive.org.tw/videos/r/master.m3u8" availableQualities={['480p']} watermark="MEMBER-TRACE" title="Sunday" videoRef={createRef<HTMLVideoElement>()} labels={{} as never} onError={()=>{}}/>);
 fireEvent.click(screen.getByRole('button',{name:'MEMBER-TRACE'}));
 expect(router.push).toHaveBeenCalledWith('/zh-Hant/member-videos/next');
});
