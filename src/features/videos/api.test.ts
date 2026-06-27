import {describe, expect, it} from 'vitest';
import {getVideos} from './api';

describe('getVideos', () => {
  it('returns fixed YouTube songs with public thumbnails', () => {
    const videos = getVideos('zh-Hant');

    expect(videos).toHaveLength(3);
    expect(videos.map((video) => video.href)).toEqual([
      'https://youtu.be/K3ckFWeSQ-k?si=RRGK8h5JROAFqbCf',
      'https://youtu.be/g2sP4m4T2Y0?si=ecveDiwuuR8Q6nYD',
      'https://youtu.be/6nZ8ZwZeM1c?si=LVsr5fg-HWSuK_K3'
    ]);
    expect(videos.every((video) => video.imageSrc.endsWith('/maxresdefault.jpg'))).toBe(true);
  });
});
