import {afterEach, expect, it, vi} from 'vitest';
import {generateMetadata} from '@/app/line-browser/[locale]/[kind]/[id]/page';
afterEach(()=>vi.unstubAllGlobals());
it('uses the public title and approved image while preserving a short canonical URL',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({data:{title:'Scheduled synthetic event'}})));
 const result=await generateMetadata({params:Promise.resolve({locale:'en',kind:'video',id:'_Ab-012xy9Z'})});
 expect(result).toMatchObject({title:'Scheduled synthetic event',alternates:{canonical:'https://www.alive.org.tw/video/_Ab-012xy9Z'},openGraph:{images:[{url:'https://www.alive.org.tw/api/video-previews/_Ab-012xy9Z/cover'}]},robots:{index:false,follow:false,noarchive:true}});
});
it.each([['en','video','https://outside.test'],['en','unknown','_Ab-012xy9Z'],['invalid','video','_Ab-012xy9Z']])('rejects invalid handoff metadata inputs %s %s %s',async(locale,kind,id)=>{
 const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
 await expect(generateMetadata({params:Promise.resolve({locale,kind,id})})).rejects.toThrow();
 expect(fetcher).not.toHaveBeenCalled();
});
