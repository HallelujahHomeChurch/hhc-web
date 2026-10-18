import {render,screen} from '@testing-library/react';
import {it,expect} from 'vitest';
import {OrganizationRootsSkeleton,OrganizationDirectorySkeleton,OrganizationMemberSkeleton,OrganizationHistorySkeleton,OrganizationRowsSkeleton} from './OrganizationLoading';
it.each([OrganizationRootsSkeleton,OrganizationDirectorySkeleton,OrganizationMemberSkeleton,OrganizationHistorySkeleton])('does not invent private names or actionable controls',Surface=>{
 const {container}=render(<Surface label="Loading groups"/>);
 expect(screen.getAllByRole('status')).toHaveLength(1);
 expect(screen.getByRole('status')).toHaveTextContent('Loading groups');
 expect(container.querySelector('a,button,input')).toBeNull();
});
it.each([3,4,5])('fits pending table rows to %s authorized columns',columns=>{
 const {container}=render(<table><tbody><OrganizationRowsSkeleton columns={columns}/></tbody></table>);
 expect(container.querySelectorAll('tr[aria-hidden="true"]')).toHaveLength(5);
 for(const cell of container.querySelectorAll('td'))expect(cell).toHaveAttribute('colspan',String(columns));
 expect(screen.queryByRole('cell')).not.toBeInTheDocument();
});
