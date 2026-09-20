import {afterEach, describe, expect, it, vi} from 'vitest';
import Image from './opengraph-image';

const captured = vi.hoisted(() => ({options: null as {fonts?: {name: string; data: ArrayBuffer; weight: number}[]} | null}));

vi.mock('next/og', () => ({
  ImageResponse: class {
    constructor(_image: unknown, options: typeof captured.options) {captured.options = options;}
  }
}));

afterEach(() => {captured.options = null;});

describe('Open Graph image', () => {
  it('embeds a Chinese-capable font for the card text', async () => {
    await Image();

    expect(captured.options?.fonts).toEqual(expect.arrayContaining([
      expect.objectContaining({name: 'HHC OG CJK', weight: 400, data: expect.any(ArrayBuffer)}),
      expect.objectContaining({name: 'HHC OG CJK', weight: 700, data: expect.any(ArrayBuffer)})
    ]));
    expect(captured.options?.fonts?.[0].data.byteLength).toBeGreaterThan(10_000);
  });
});
