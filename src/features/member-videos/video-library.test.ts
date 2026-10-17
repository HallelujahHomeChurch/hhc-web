import {it,expect} from 'vitest';
import {liveLibraryItems} from './video-library';
import type {MemberLiveRecording} from '@hallelujahhomechurch/hhc-web-client';
it('orders only genuinely live captures by actual start and deduplicates recording IDs',()=>{
 const rows=[{id:'old',captureId:'1',liveState:'live',startedAt:'2026-10-17T01:00:00Z',createdAt:'2026-10-17T04:00:00Z'},{id:'new',captureId:'2',liveState:'live',startedAt:'2026-10-17T02:00:00Z',createdAt:'2026-10-17T00:00:00Z'},{id:'ended',captureId:'3',liveState:'processing'}, {id:'new',captureId:'2',liveState:'live',startedAt:'2026-10-17T02:00:00Z'}] as MemberLiveRecording[];
 expect(liveLibraryItems(rows).map(row=>row.id)).toEqual(['new','old']);expect(liveLibraryItems([])).toEqual([]);
});
