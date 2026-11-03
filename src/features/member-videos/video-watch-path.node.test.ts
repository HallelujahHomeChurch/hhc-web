import {describe,it,expect} from 'vitest';
import {videoWatchPath} from './share';
describe('canonical watch links',()=>{
 it.each(['aB_012-xyzQ','Ab_012-xyzQ'])('preserves a valid case-sensitive ID %s',publicId=>{expect(videoWatchPath('ja','uuid',publicId)).toBe(`/video/${publicId}`);});
 it.each([undefined,'short','123456789012','abcdefghij/','abcdefghij%'])('keeps the rollout UUID fallback for %s',publicId=>{expect(videoWatchPath('ko','uuid',publicId)).toBe('/ko/member-videos/uuid');});
});
