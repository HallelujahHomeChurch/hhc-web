export function videoStartTime(value: string | string[] | undefined): number | undefined {
  if (typeof value !== 'string' || !/^(0|[1-9]\d{0,5})$/.test(value)) return;
  const seconds=Number(value);
  return seconds<=604800?seconds:undefined;
}
export function videoShareURL(href:string,seconds?:number){
 const url=new URL(href);url.search='';url.hash='';
 if(seconds!==undefined&&Number.isFinite(seconds)&&seconds>=0&&seconds<=604800)url.searchParams.set('t',String(Math.floor(seconds)));
 return url.href;
}

export function parseShareTime(value:string,duration?:number):number|undefined{
 if(!/^\d{1,6}(?::\d{2}){0,2}$/.test(value))return;
 const parts=value.split(':').map(Number);
 if(parts.slice(1).some(part=>part>59))return;
 const seconds=parts.reduce((total,part)=>total*60+part,0);
 if(seconds>604800||duration!==undefined&&seconds>duration)return;
 return seconds;
}
