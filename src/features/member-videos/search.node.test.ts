import {expect,it} from 'vitest';
import {parseVideoQuery,videoSearchHref} from './search';
it('normalizes Unicode query words and keeps exact video-route URLs',()=>{
 expect(parseVideoQuery('Faith\u0085Hope')).toEqual({query:'faith hope',invalid:false});
 expect(parseVideoQuery(' Faith\t主日　 Hope ')).toEqual({query:'faith 主日 hope',invalid:false});
 expect(parseVideoQuery('😀'.repeat(100)).invalid).toBe(false);
 expect(parseVideoQuery('😀'.repeat(101)).invalid).toBe(true);
 expect(parseVideoQuery(['faith','hope']).invalid).toBe(true);
 expect(videoSearchHref('en','% _ ?')).toBe('/en/member-videos?q=%25+_+%3F');
 expect(videoSearchHref('en','')).toBe('/en/member-videos');
});
