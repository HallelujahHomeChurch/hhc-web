import {describe, expect, it} from 'vitest';
import {getNews} from './api';

describe('getNews', () => {
  it('returns typed local fixtures for the requested locale', () => {
    const [item] = getNews('zh-Hant');

    expect(item).toMatchObject({
      id: expect.any(String),
      title: expect.any(String),
      date: expect.any(String),
      href: expect.any(String)
    });
    expect(item).not.toHaveProperty('imageSrc');
  });
});
