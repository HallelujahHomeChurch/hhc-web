import type {PlayerBookmark} from './live-player';

export function countdownSeconds(scheduledAt:string|null,serverNow:string,elapsed:number) {
  if(!scheduledAt)return 0;
  const seconds=(Date.parse(scheduledAt)-Date.parse(serverNow))/1000-elapsed;
  return Number.isFinite(seconds)?Math.max(0,Math.ceil(seconds)):0;
}
export function broadcastPollDelay(view:string,hidden:boolean,failures:number) {
  if(hidden)return 60000;
  const base=view==='live'?5000:15000;
  return Math.min(60000,base*2**Math.min(failures,3));
}
export function mapBroadcastBookmark(bookmark:PlayerBookmark|undefined,origin:number|null,duration:number|null) {
  if(!bookmark)return undefined;
  const nextOrigin=origin??bookmark.mediaOriginSeconds??0;
  const time=bookmark.time+(bookmark.mediaOriginSeconds??0)-nextOrigin;
  return {...bookmark,time:Math.max(0,Math.min(duration??Infinity,time)),mediaOriginSeconds:nextOrigin};
}
export const broadcastLabels={
 'zh-Hant':{upcoming:'即將直播',all:'所有預約直播',waiting:'等待直播開始',startsIn:'距離開始還有 {time}',processing:'直播已結束，錄影處理中',cancelled:'這場直播已取消',unavailable:'這場直播暫時無法觀看',empty:'目前沒有預約直播'},
 'zh-Hans':{upcoming:'即将直播',all:'所有预约直播',waiting:'等待直播开始',startsIn:'距离开始还有 {time}',processing:'直播已结束，录像处理中',cancelled:'这场直播已取消',unavailable:'这场直播暂时无法观看',empty:'目前没有预约直播'},
 en:{upcoming:'Upcoming',all:'All upcoming livestreams',waiting:'Waiting for the livestream',startsIn:'Starts in {time}',processing:'Live ended. The recording is being prepared',cancelled:'This livestream was cancelled',unavailable:'This livestream is unavailable',empty:'No upcoming livestreams'},
 ja:{upcoming:'配信予定',all:'すべての配信予定',waiting:'ライブ配信の開始を待っています',startsIn:'開始まで {time}',processing:'ライブ配信は終了しました。録画を準備しています',cancelled:'このライブ配信は中止されました',unavailable:'このライブ配信は視聴できません',empty:'配信予定はありません'},
 ko:{upcoming:'예정된 라이브',all:'모든 예정된 라이브',waiting:'라이브 시작을 기다리는 중',startsIn:'시작까지 {time}',processing:'라이브가 종료되었습니다. 녹화 영상을 준비 중입니다',cancelled:'이 라이브가 취소되었습니다',unavailable:'이 라이브를 시청할 수 없습니다',empty:'예정된 라이브가 없습니다'},
} as const;
