import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {VideoListSkeleton, VideoWatchSkeleton} from './VideoLoading';

describe('video loading surfaces',()=>{
 it.each([VideoListSkeleton,VideoWatchSkeleton])('announces once without fake video controls',Surface=>{
  const {container}=render(<Surface label="Loading videos"/>);
  expect(screen.getAllByRole('status')).toHaveLength(1);
  expect(screen.getByRole('status')).toHaveTextContent('Loading videos');
  expect(container.querySelector('a,button,video')).toBeNull();
  expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
 });
});
