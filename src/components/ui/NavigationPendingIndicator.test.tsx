import {render,screen} from '@testing-library/react';
import {expect,it,vi} from 'vitest';
import Link from 'next/link';
import {NavigationPendingIndicator} from './NavigationPendingIndicator';
const state=vi.hoisted(()=>({pending:false}));
vi.mock('next/link',async original=>({...await original<typeof import('next/link')>(),useLinkStatus:()=>state}));
it('reflects native pending and cancellation without changing the link name or controls',()=>{
 const show=()=> <Link href="/en/news">News<NavigationPendingIndicator/></Link>;
 const view=render(show());const marker=()=>view.container.querySelector('[data-navigation-pending]');
 expect(marker()).toHaveAttribute('aria-hidden','true');
 expect(marker()).not.toHaveAttribute('data-pending');
 state.pending=true;view.rerender(show());expect(marker()).toHaveAttribute('data-pending','true');
 expect(screen.getByRole('link',{name:'News'})).toHaveAttribute('href','/en/news');
 expect(screen.queryByRole('status')).not.toBeInTheDocument();
 state.pending=false;view.rerender(show());expect(marker()).not.toHaveAttribute('data-pending');
});
