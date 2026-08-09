import {describe, expect, it} from 'vitest';
import {mapVideoItem} from './api';

describe('getVideos', () => {
  it('maps the three deterministic homepage video projections', async () => {
    const values = [
      {id: 'one', title: 'One', youtubeVideoId: 'K3ckFWeSQ-k'},
      {id: 'two', title: 'Two', youtubeVideoId: 'g2sP4m4T2Y0'},
      {id: 'three', title: 'Three', youtubeVideoId: 'BlBhGrxS9sI'}
    ];
    const videos = values.map(mapVideoItem);

    expect(videos).toHaveLength(3);
    expect(videos.map((video) => video.href)).toEqual(['https://www.youtube.com/watch?v=K3ckFWeSQ-k', 'https://www.youtube.com/watch?v=g2sP4m4T2Y0', 'https://www.youtube.com/watch?v=BlBhGrxS9sI']);
    expect(videos.every((video) => video.imageSrc.endsWith('/hqdefault.jpg'))).toBe(true);
  });
});
