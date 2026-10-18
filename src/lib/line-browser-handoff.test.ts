import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

const key = 'hhc:line-browser:video-target';
const path = '/zh-Hant/member-videos/11111111-1111-1111-1111-111111111111?t=90#player';
const home = 'http://localhost:3000/zh-Hant';
let handoff: typeof import('./line-browser-handoff');

beforeEach(async () => {
  vi.resetModules();
  sessionStorage.clear();
  window.history.replaceState({}, '', path);
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 LINE/15.0.0');
  handoff = await import('./line-browser-handoff');
});

afterEach(() => {
  handoff.clearLineVideoTarget();
  vi.restoreAllMocks();
  sessionStorage.clear();
  window.history.replaceState({}, '', '/');
});

describe('LINE video target', () => {
  it('survives a home redirect and reload with the original query and hash', async () => {
    handoff.rememberLineVideoTarget();
    expect(handoff.lineBrowserTarget(window.location.href)).toBe(window.location.href);
    window.history.replaceState({}, '', '/zh-Hant');
    vi.resetModules();
    const reloaded = await import('./line-browser-handoff');
    expect(reloaded.lineBrowserTarget(home)).toBe(`http://localhost:3000${path}`);
  });

  it('keeps the redirect usable when session storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Blocked'); });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Blocked'); });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('Blocked'); });
    handoff.rememberLineVideoTarget();
    expect(handoff.lineBrowserTarget(home)).toBe(`http://localhost:3000${path}`);
    handoff.clearLineVideoTarget();
    expect(handoff.lineBrowserTarget(home)).toBe(home);
  });

  it('does not retain a target in an ordinary browser', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 Safari/605.1.15');
    handoff.rememberLineVideoTarget();
    expect(sessionStorage.getItem(key)).toBeNull();
    expect(handoff.lineBrowserTarget(home)).toBe(home);
  });

  it.each(['/zh-Hant/news', '/invalid/member-videos', '/zh-Hant/member-videos/not-a-video'])('does not retain the unrelated path %s', pathname => {
    window.history.replaceState({}, '', pathname);
    handoff.rememberLineVideoTarget();
    expect(handoff.lineBrowserTarget(home)).toBe(home);
  });

  it.each([
    'https://attacker.example/zh-Hant/member-videos',
    'http://user:password@localhost:3000/zh-Hant/member-videos',
    'http://localhost:3000/zh-Hant/news',
    'http://localhost:3000/invalid/member-videos',
    'javascript:alert(1)',
    'not a URL'
  ])('rejects the invalid stored target %s', target => {
    sessionStorage.setItem(key, target);
    expect(handoff.lineBrowserTarget(home)).toBe(home);
    expect(sessionStorage.getItem(key)).toBeNull();
  });

  it.each(['/zh-Hant/news', '/en', '/zh-Hant/member-videos/22222222-2222-2222-2222-222222222222'])('clears the previous target after navigating to %s', pathname => {
    handoff.rememberLineVideoTarget();
    const current = `http://localhost:3000${pathname}`;
    expect(handoff.lineBrowserTarget(current)).toBe(current);
    expect(handoff.lineBrowserTarget(home)).toBe(home);
    expect(sessionStorage.getItem(key)).toBeNull();
  });

  it('replaces a previous target with the latest shared video', () => {
    handoff.rememberLineVideoTarget();
    window.history.replaceState({}, '', '/en/member-videos?t=20');
    handoff.rememberLineVideoTarget();
    expect(handoff.lineBrowserTarget('http://localhost:3000/en/')).toBe('http://localhost:3000/en/member-videos?t=20');
  });
});
