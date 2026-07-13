import {describe, expect, it} from 'vitest';
import type {HhcWebClient} from '@hhc/hhc-web-client';
import {getVideos} from './api';

describe('getVideos', () => {
  it('maps deterministic published video projections', async () => {
    const client = {listPublicContent: async () => [
      {id: 'one', title: 'One', youtubeVideoId: 'K3ckFWeSQ-k'},
      {id: 'two', title: 'Two', youtubeVideoId: 'g2sP4m4T2Y0'},
      {id: 'three', title: 'Three', youtubeVideoId: '6nZ8ZwZeM1c'}
    ]} as unknown as HhcWebClient;
    const videos = await getVideos('zh-Hant', client);

    expect(videos).toHaveLength(3);
    expect(videos.map((video) => video.href)).toEqual(['https://www.youtube.com/watch?v=K3ckFWeSQ-k', 'https://www.youtube.com/watch?v=g2sP4m4T2Y0', 'https://www.youtube.com/watch?v=6nZ8ZwZeM1c']);
    expect(videos.every((video) => video.imageSrc.endsWith('/maxresdefault.jpg'))).toBe(true);
  });
});
