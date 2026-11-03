import {expect,it} from 'vitest';
import {legalReturnURL} from './legal-return-url';
import {replaceLocale} from '@/i18n/navigation';
import {externalBrowserHref} from './line-browser-handoff';

it('keeps the short URL and legal time through language, legal and external-browser continuations',()=>{
 const path='/video/FA0AoBO02uU?t=42';
 expect(replaceLocale(path,'ja')).toBe(path);
 expect(legalReturnURL('https://www.alive.org.tw'+path)).toBe('https://www.alive.org.tw'+path);
 const external=new URL(externalBrowserHref('https://www.alive.org.tw'+path+'#handoff'));
 expect(external.pathname).toBe('/video/FA0AoBO02uU');
 expect(external.searchParams.get('t')).toBe('42');expect(external.hash).toBe('#handoff');
 for(const suffix of ['?t=604801','?t=1&t=2','?token=secret','?t=1&token=secret','#secret'])expect(legalReturnURL('https://www.alive.org.tw/video/FA0AoBO02uU'+suffix)).toBeUndefined();
});
