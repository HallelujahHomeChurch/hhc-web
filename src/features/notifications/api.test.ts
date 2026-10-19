import {afterEach,expect,it,vi} from 'vitest';
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

afterEach(()=>vi.restoreAllMocks());
it.each([['2026-10-19T12:00:00Z','now'],['2026-10-19T11:59:30Z','30 seconds ago'],['2026-10-19T11:55:00Z','5 minutes ago'],['2026-10-19T10:00:00Z','2 hours ago'],['2026-10-18T12:00:00Z','yesterday'],['2026-10-20T12:00:00Z','now']])('renders relative notification time for %s while retaining the exact timestamp', (occurredAt,timeLabel)=>{
 vi.spyOn(Date,'now').mockReturnValue(Date.parse('2026-10-19T12:00:00Z'));expect(notificationItem({...base,occurredAt},'en',copy)).toMatchObject({timeLabel,dateTime:occurredAt});
});
it.each(['zh-Hant','zh-Hans','en','ja','ko'] as const)('localizes relative notification time in %s',locale=>{
 vi.spyOn(Date,'now').mockReturnValue(Date.parse('2026-10-19T02:00:00Z'));expect(notificationItem(base,locale,copy).timeLabel).toBe(new Intl.RelativeTimeFormat(locale,{numeric:'auto'}).format(-2,'hour'));
});

it.each(['pending','approved','rejected','cancelled'] as const)('renders current group %s copy for owner and reviewer in every locale',status=>{
 for(const locale of ['zh-Hant','zh-Hans','en','ja','ko'] as const)for(const reviewer of [false,true]){
  const resource={type:'org_join_request' as const,id,unitId};
  const item:InboxItem={...base,resource,projection:{titleKey:'notification.orgJoin',messageKey:`notification.orgJoin.${reviewer?'review.':''}${status}`,parameters:{title:'Current unit',applicant:'Current applicant'},action:{type:reviewer?'join_request_review':'join_request_result',resource}}};
  const result=notificationItem(item,locale,copy);
  expect(result.title).not.toBe(copy.generic);expect(result.message).toContain('Current unit');if(reviewer)expect(result.message).toContain('Current applicant');
  if(status!=='pending')expect(result.message).not.toContain('pending');
 }
});
it('keeps unknown group keys generic and never exposes their parameters',()=>{
 const result=notificationItem({...base,projection:{titleKey:'notification.orgJoin',messageKey:'notification.orgJoin.future',parameters:{title:'Hidden future title'}}},'en',copy);
 expect(result.title).toBe(copy.generic);expect(result.message).toBe('');
});
