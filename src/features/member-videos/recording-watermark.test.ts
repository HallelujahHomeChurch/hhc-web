import {describe, expect, it} from 'vitest';
import {containedVideoRect, displayWatermarkCode} from './recording-watermark';

describe('recording watermark geometry', () => {
  it('anchors inside landscape, letterbox, and pillarbox video content', () => {
    expect(containedVideoRect(1600, 900, 1920, 1080)).toEqual({left:0, top:0, width:1600, height:900});
    expect(containedVideoRect(1000, 1000, 1920, 1080)).toEqual({left:0, top:218.75, width:1000, height:562.5});
    expect(containedVideoRect(1600, 900, 900, 1600)).toEqual({left:546.875, top:0, width:506.25, height:900});
    expect(containedVideoRect(0, 900, 1920, 1080)).toBeNull();
    expect(containedVideoRect(1600, 900, 0, 0)).toBeNull();
    expect(containedVideoRect(Infinity, 900, 1920, 1080)).toBeNull();
  });
  it('groups only the new exact format, leaving legacy codes unchanged', () => {
    expect(displayWatermarkCode('01234ABCDE')).toBe('01234-ABCDE');
    expect(displayWatermarkCode('DEADBEEF')).toBe('DEADBEEF');
  });
});
