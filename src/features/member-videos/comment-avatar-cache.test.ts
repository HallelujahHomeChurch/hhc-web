import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import type {RecordingComment} from '@hallelujahhomechurch/hhc-web-client';

const comment = (url: string): RecordingComment & {avatarUrl: string} => ({
  id: 'comment', text: 'Comment', displayName: 'Member', mine: false,
  createdAt: '2026-10-23T00:00:00Z', revision: 1, replyCount: 0,
  avatarUrl: url, deleted: false, hidden: false,
});
let created: Array<{onload:(()=>void)|null; onerror:(()=>void)|null; decode:ReturnType<typeof vi.fn>} >;

beforeEach(()=>{
  vi.resetModules();
  created=[];
  vi.stubGlobal('Image',class {
    onload:(()=>void)|null=null; onerror:(()=>void)|null=null;
    decode=vi.fn().mockResolvedValue(undefined);
    constructor(){created.push(this);}
    set src(value:string){if(value)queueMicrotask(()=>this.onload?.());}
  });
});
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});

it('coalesces authors sharing a public URL and reuses decoded images across visits',async()=>{
  const {prepareCommentAvatars,preparedCommentAvatar}=await import('./comment-avatar-cache');
  const item=comment('https://www.alive.org.tw/assets/avatar-v1');
  await Promise.all([prepareCommentAvatars([item,item]),prepareCommentAvatars([item])]);
  await prepareCommentAvatars([item]);
  expect(created).toHaveLength(1);
  expect(created[0].decode).toHaveBeenCalledTimes(1);
  expect(preparedCommentAvatar(item)).toBe(item.avatarUrl);
  const next=comment('https://www.alive.org.tw/assets/avatar-v2');
  await prepareCommentAvatars([next]);
  expect(created).toHaveLength(2);
});

it('bounds retained decoded images and excludes deleted, hidden and unsafe URLs',async()=>{
  const {prepareCommentAvatars,preparedCommentAvatar}=await import('./comment-avatar-cache');
  for(let i=0;i<65;i++)await prepareCommentAvatars([comment(`https://www.alive.org.tw/assets/a${i}`)]);
  expect(preparedCommentAvatar(comment('https://www.alive.org.tw/assets/a0'))).toBeUndefined();
  const count=created.length;
  await prepareCommentAvatars([{...comment('https://example.test/deleted'),deleted:true},{...comment('https://example.test/hidden'),hidden:true},comment('javascript:alert(1)'),comment('data:image/png;base64,AA')]);
  expect(created).toHaveLength(count);
});

it('bounds cold-image wait, uses fallback and retries failures after a short negative cache',async()=>{
  vi.useFakeTimers();
  const {prepareCommentAvatars,preparedCommentAvatar}=await import('./comment-avatar-cache');
  vi.stubGlobal('Image',class {
    onload=null;onerror=null;decode=vi.fn();
    constructor(){created.push(this);}
    set src(_value:string){}
  });
  const item=comment('https://www.alive.org.tw/assets/slow');
  const first=prepareCommentAvatars([item]);
  await vi.advanceTimersByTimeAsync(2000);await first;
  expect(preparedCommentAvatar(item)).toBeUndefined();
  await prepareCommentAvatars([item]);expect(created).toHaveLength(1);
  await vi.advanceTimersByTimeAsync(30_000);
  const retry=prepareCommentAvatars([item]);expect(created).toHaveLength(2);
  await vi.advanceTimersByTimeAsync(2000);await retry;
});
