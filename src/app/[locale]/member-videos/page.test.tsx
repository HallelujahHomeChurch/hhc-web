import {renderToStaticMarkup} from 'react-dom/server';
import {expect,it,vi} from 'vitest';
import type {ReactNode} from 'react';
vi.mock('next-intl/server',()=>({setRequestLocale:vi.fn()}));
vi.mock('@/components/layout/SiteHeaderServer',()=>({SiteHeaderServer:()=>null}));
vi.mock('@/components/layout/SiteFooterServer',()=>({SiteFooterServer:()=>null}));
vi.mock('@/features/site-layout/api',()=>({getSiteLayout:async()=>({bannerImageUrl:'/banner.jpg'})}));
vi.mock('@/features/member-videos/MemberVideoZone',()=>({MemberVideoZone:({hero}:{hero:ReactNode})=><main>{hero}</main>}));
import Page,{generateMetadata} from './page';
it('uses a hidden library heading without a banner while retaining metadata',async()=>{
 const props={params:Promise.resolve({locale:'en'}),searchParams:Promise.resolve({})};
 const markup=renderToStaticMarkup(await Page(props));
 expect(markup).not.toContain('/banner.jpg');
 expect(markup).toContain('class="sr-only"');
 expect(markup).toContain('<h1');
 expect((await generateMetadata(props)).title).toBeTruthy();
});
