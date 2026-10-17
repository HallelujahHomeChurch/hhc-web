import {render,screen} from '@testing-library/react';
import {it,expect} from 'vitest';
import {WeeklyLandingSkeleton,HomeWeeklySkeleton,WeeklyLatestSkeleton,WeeklyArchiveSkeleton} from './WeeklyLoading';
it.each([WeeklyLandingSkeleton,HomeWeeklySkeleton,WeeklyLatestSkeleton,WeeklyArchiveSkeleton])('has one status and no pretend reading or download controls',Surface=>{
 const {container}=render(<Surface label="Loading bulletins"/>);
 expect(screen.getAllByRole('status')).toHaveLength(1);
 expect(screen.getByRole('status')).toHaveTextContent('Loading bulletins');
 expect(container.querySelector('a,button,input')).toBeNull();
});
