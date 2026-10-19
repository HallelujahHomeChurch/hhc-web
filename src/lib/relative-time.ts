export function relativeTime(value:string,locale:string){
 const seconds=Math.min(0,Math.floor((Date.parse(value)-Date.now())/1000));
 const [amount,unit]:[number,Intl.RelativeTimeFormatUnit]=Math.abs(seconds)<60?[seconds,'second']:Math.abs(seconds)<3600?[Math.floor(seconds/60),'minute']:Math.abs(seconds)<86400?[Math.floor(seconds/3600),'hour']:[Math.floor(seconds/86400),'day'];
 return new Intl.RelativeTimeFormat(locale,{numeric:'auto'}).format(amount,unit);
}
