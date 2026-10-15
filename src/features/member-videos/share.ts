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
