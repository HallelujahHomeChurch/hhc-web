import {expect,it,vi} from 'vitest';
import {createCardProgressStore} from './card-progress';
it('overlays only an exact recording/version and fences disposed or superseded writers',()=>{
 const store=createCardProgressStore(),changed=vi.fn(),unsubscribe=store.subscribe(changed);
 const a=store.bind();a.publish({recordingId:'r1',mediaVersion:'vod:pkg:1',positionSeconds:40,completed:false});
 expect(store.get('r1','vod:pkg:1')?.positionSeconds).toBe(40);expect(store.get('r2','vod:pkg:1')).toBeNull();expect(store.get('r1','vod:pkg:2')).toBeNull();expect(store.get('r1',undefined)).toBeNull();
 const b=store.bind();expect(store.get('r1','vod:pkg:1')).toBeNull();a.publish({recordingId:'r1',mediaVersion:'vod:pkg:1',positionSeconds:99,completed:false});expect(store.get('r1','vod:pkg:1')).toBeNull();
 b.publish({recordingId:'r2',mediaVersion:'vod:other:1',positionSeconds:60,completed:true});a.dispose();expect(store.get('r2','vod:other:1')?.completed).toBe(true);
 b.publish(null);expect(store.get('r2','vod:other:1')).toBeNull();b.dispose();b.publish({recordingId:'r2',mediaVersion:'vod:other:1',positionSeconds:70,completed:false});expect(store.get('r2','vod:other:1')).toBeNull();unsubscribe();expect(changed).toHaveBeenCalled();
});
