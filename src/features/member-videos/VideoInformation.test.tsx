import {render,screen,fireEvent} from '@testing-library/react';
import {it,expect,vi} from 'vitest';
import {VideoInformation} from './VideoInformation';
it('shows a description preview, safe links and an expandable exact date',()=>{
 render(<VideoInformation description={'Notes https://example.com/path\n<script>no</script>'} date="2026-10-17T00:00:00Z" dateKind="uploaded" metrics={null} locale="en"/>);
 expect(screen.getByText(/Notes/)).toBeInTheDocument();expect(screen.getByRole('link').getAttribute('href')).toBe('https://example.com/path');
 fireEvent.click(screen.getByRole('button',{name:'Show more'}));expect(screen.getByRole('button',{name:'Show less'})).toHaveAttribute('aria-expanded','true');expect(document.querySelector('script')).toBeNull();expect(screen.queryByText('0 views')).toBeNull();
});
it('uses compact localized views and a relative age, expanding to exact values',()=>{
 const clock=vi.spyOn(Date,'now').mockReturnValue(Date.parse('2026-10-19T00:00:00Z'));
 try {
  render(<VideoInformation description="Notes" date="2026-10-17T00:00:00Z" metrics={{totalViews:18000,currentViewers:0,status:'available',measuredAt:'2026-10-19T00:00:00Z',trackingSince:'2026-10-17T00:00:00Z',metricVersion:'hhc-video-1'}} locale="zh-Hant"/>);
  expect(screen.getByText('觀看次數：1.8萬次')).toBeInTheDocument();expect(screen.getByText('2 天前')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'顯示更多'}));
  expect(screen.getByText('觀看次數：18,000次')).toBeInTheDocument();expect(screen.queryByText('2 天前')).toBeNull();
 }finally{clock.mockRestore();}
});
it('keeps scheduled times exact and does not replace unavailable statistics with zero',()=>{
 render(<VideoInformation date="2026-10-25T02:00:00Z" dateKind="scheduled" metrics={null} locale="en"/>);
 expect(screen.getByText('Viewing statistics unavailable')).toBeInTheDocument();expect(screen.getByText(/Scheduled ·.*10:00/)).toBeInTheDocument();
});
