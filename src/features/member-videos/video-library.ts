import type {MemberLiveRecording} from '@hallelujahhomechurch/hhc-web-client';
export function liveLibraryItems(items:MemberLiveRecording[]){
 return [...new Map(items.filter(item=>(item.liveState==='live'||item.liveState==='recovering')).map(item=>[item.id,item])).values()].sort((a,b)=>(b.startedAt??'').localeCompare(a.startedAt??'')||b.id.localeCompare(a.id));
}
