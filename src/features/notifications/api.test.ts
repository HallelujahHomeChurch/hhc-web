import {expect,it} from 'vitest';
import type {InboxItem} from '@hallelujahhomechurch/account-client';
import {notificationItem} from './api';
const id='11111111-1111-4111-8111-111111111111', unitId='22222222-2222-4222-8222-222222222222';
const copy={generic:'Notification',published:'Published',open:'Open'};
const base:InboxItem={id,type:'recording.published',resource:{type:'recording',id:'video_1'},occurredAt:'2026-10-19T00:00:00Z',projection:{titleKey:'notification.recording',messageKey:'notification.published',parameters:{title:'<script>safe text</script>'},action:{type:'recording',resource:{type:'recording',id:'video_1'}}}};
it('uses the actual recording route and treats server titles only as plain data',()=>{expect(notificationItem(base,'en',copy)).toMatchObject({id,title:'<script>safe text</script>',message:'Published',link:{href:'/en/member-videos/video_1'}});});
it('uses exact canonical issue number/series/authorized locale, never resource UUID',()=>{
 const item:InboxItem={...base,resource:{type:'bulletin',id,series:'children'},projection:{...base.projection,titleKey:'notification.bulletin',parameters:{title:'Edition',issueNumber:'1742'},action:{type:'bulletin',resource:{type:'bulletin',id,series:'children'},locale:'zh-Hant'}}};
 expect(notificationItem(item,'ja',copy).link?.href).toBe('/ja/literature-ministry?series=children&issueNumber=1742&contentLocale=zh-Hant');
 for(const issueNumber of ['01742','2147483648',id,''])expect(notificationItem({...item,projection:{...item.projection,parameters:{issueNumber}}},'en',copy).link).toBeUndefined();
});
it('maps only closed group destinations with generic pending presentation until Task4 authority exists',()=>{
 for(const type of ['join_request_review','join_request_result'] as const){const resource={type:'org_join_request' as const,id,unitId};const item={...base,resource,projection:{titleKey:'unknown.code',messageKey:'unknown.message',parameters:{title:'Do not expose unknown'},action:{type,resource}}};
 expect(notificationItem(item,'ko',copy)).toMatchObject({title:'Notification',message:'',link:{href:type==='join_request_review'?`/ko/organizations/${unitId}?joinRequest=${id}#join-requests`:`/ko/organizations/requests/${id}`}});}
});
it('omits unknown actions and never builds arbitrary unsafe links',()=>{expect(notificationItem({...base,projection:{...base.projection,action:undefined}},'en',copy).link).toBeUndefined();});
