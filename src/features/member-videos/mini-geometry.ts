export type MediaRect = {left:number;top:number;width:number;height:number};
export type MiniArea = {left:number;top:number;right:number;bottom:number};
export type SafeInsets = {top:number;right:number;bottom:number;left:number};

export function availableMiniRect(viewport:MediaRect,safe:SafeInsets,nav:MediaRect|null):MiniArea {
 const left=viewport.left+Math.max(16,safe.left),top=viewport.top+Math.max(16,safe.top);
 const right=Math.max(left,viewport.left+viewport.width-Math.max(16,safe.right));
 let bottom=viewport.top+viewport.height-Math.max(16,safe.bottom);
 if(nav&&nav.width>0&&nav.height>0&&nav.left<right&&nav.left+nav.width>left&&nav.top<viewport.top+viewport.height&&nav.top+nav.height>top)bottom=Math.min(bottom,nav.top-16);
 return {left,top,right,bottom:Math.max(top,bottom)};
}

export function miniRect(area:MiniArea,preferredWidth:number,captionHeight:number,left:boolean,top:boolean):MediaRect {
 const caption=Math.min(captionHeight,area.bottom-area.top);
 const width=Math.max(0,Math.min(preferredWidth,area.right-area.left,(area.bottom-area.top-caption)*16/9));
 const height=width*9/16+caption;
 return {left:left?area.left:area.right-width,top:top?area.top:area.bottom-height,width,height};
}

export function pullRect(start:MediaRect,end:MediaRect,dy:number,dyLock:number):MediaRect {
 const progress=Math.min(1,Math.max(0,(dy-dyLock)/Math.max(120,Math.abs(end.top-start.top))));
 return {left:start.left+(end.left-start.left)*progress,top:start.top+(end.top-start.top)*progress,width:start.width+(end.width-start.width)*progress,height:start.height+(end.height-start.height)*progress};
}

export function readMiniArea():MiniArea {
 const viewport=window.visualViewport;
 const probe=document.createElement('span');
 probe.style.cssText='position:fixed;visibility:hidden;pointer-events:none;width:0;height:0;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
 document.documentElement.append(probe);
 const style=getComputedStyle(probe);
 const safe={top:parseFloat(style.paddingTop)||0,right:parseFloat(style.paddingRight)||0,bottom:parseFloat(style.paddingBottom)||0,left:parseFloat(style.paddingLeft)||0};
 probe.remove();
 const nav=document.querySelector<HTMLElement>('.site-mobile-tab-bar');
 const navStyle=nav?getComputedStyle(nav):null;
 const navRect=nav&&navStyle?.display!=='none'&&navStyle?.visibility!=='hidden'?nav.getBoundingClientRect():null;
 return availableMiniRect({left:viewport?.offsetLeft??0,top:viewport?.offsetTop??0,width:viewport?.width??window.innerWidth,height:viewport?.height??window.innerHeight},safe,navRect);
}
