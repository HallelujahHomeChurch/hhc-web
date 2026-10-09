import {afterEach,expect,it} from 'vitest';
import {parseVideoQuery,videoSearchHref,rememberVideoPosition,readVideoPosition,forgetVideoPosition} from './search';
afterEach(forgetVideoPosition);
it('normalizes Unicode query words and keeps exact video-route URLs',()=>{
 expect(parseVideoQuery(' Faith\t主日　 Hope ')).toEqual({query:'faith 主日 hope',invalid:false});
 expect(parseVideoQuery('😀'.repeat(100)).invalid).toBe(false);
 expect(parseVideoQuery('😀'.repeat(101)).invalid).toBe(true);
 expect(parseVideoQuery(['faith','hope']).invalid).toBe(true);
 expect(videoSearchHref('en','% _ ?')).toBe('/en/member-videos?q=%25+_+%3F');
 expect(videoSearchHref('zh-Hant','faith','r1')).toBe('/zh-Hant/member-videos/r1?q=faith');
 expect(videoSearchHref('en','')).toBe('/en/member-videos');
});
it('keeps only short-lived account/locale/query position metadata',()=>{
 const position={batches:3,anchor:'r1',offset:50,scrollY:500};
 rememberVideoPosition('one','en','faith',position);
 expect(readVideoPosition('one','en','faith')).toMatchObject(position);
 expect(readVideoPosition('two','en','faith')).toBeNull();
 expect(readVideoPosition('one','en','faith')).toBeNull();
 rememberVideoPosition('one','en','faith',position);
 expect(readVideoPosition('one','en','hope')).toBeNull();
});
it('clears saved position without an account identity',()=>{
 rememberVideoPosition('one','en','faith',{batches:1,anchor:'r1',offset:0,scrollY:0});
 expect(readVideoPosition(null,'en','faith')).toBeNull();
 rememberVideoPosition(null,'en','faith',{batches:1,anchor:'r1',offset:0,scrollY:0});
 expect(readVideoPosition('one','en','faith')).toBeNull();
 expect(parseVideoQuery('Faith\u0085Hope')).toEqual({query:'faith hope',invalid:false});
});
