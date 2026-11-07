import {expect, it} from 'vitest';
import config from '../../next.config';
import {HTML_LIMITED_BOT_UA_RE} from 'next/dist/shared/lib/router/utils/html-bots';
it('blocks metadata streaming for LINE handoff without replacing existing crawler rules',()=>{
 expect(config.htmlLimitedBots?.test('Mozilla/5.0 (iPhone) LINE/15.0.0')).toBe(true);
 for(const ua of ['facebookexternalhit/1.1','Twitterbot','Googlebot','Slackbot','Yeti']) {
  expect(config.htmlLimitedBots?.test(ua)).toBe(HTML_LIMITED_BOT_UA_RE.test(ua));
 }
 expect(config.htmlLimitedBots?.test('Mozilla/5.0 Chrome/140.0 Safari/537.36')).toBe(false);
});
