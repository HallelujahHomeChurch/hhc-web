import {render,screen,fireEvent} from '@testing-library/react';
import {it,expect} from 'vitest';
import {VideoInformation} from './VideoInformation';
it('shows a description preview, safe links and an expandable exact date',()=>{
 render(<VideoInformation description={'Notes https://example.com/path\n<script>no</script>'} date="2026-10-17T00:00:00Z" dateKind="uploaded" metrics={null} locale="en"/>);
 expect(screen.getByText(/Notes/)).toBeInTheDocument();expect(screen.getByRole('link').getAttribute('href')).toBe('https://example.com/path');
 fireEvent.click(screen.getByRole('button',{name:'Show more'}));expect(screen.getByRole('button',{name:'Show less'})).toHaveAttribute('aria-expanded','true');expect(document.querySelector('script')).toBeNull();expect(screen.queryByText('0 views')).toBeNull();
});
