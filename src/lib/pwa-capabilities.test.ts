import {describe, expect, it} from 'vitest';
import {isIOSDevice, isIPhoneDevice, isStandaloneWebApp} from './pwa-capabilities';

const navigatorLike = (overrides: Partial<Navigator> & {standalone?: boolean} = {}) => ({
  userAgent: '',
  platform: '',
  maxTouchPoints: 0,
  ...overrides
}) as Navigator & {standalone?: boolean};

const windowLike = (standalone: boolean) => ({
  matchMedia: (query: string) => ({matches: query === '(display-mode: standalone)' && standalone})
}) as Pick<Window, 'matchMedia'>;

describe('PWA capabilities', () => {
  it('identifies iPhone without classifying iPad desktop mode as iPhone', () => {
    expect(isIPhoneDevice(navigatorLike({userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'}))).toBe(true);
    expect(isIPhoneDevice(navigatorLike({userAgent: 'Mozilla/5.0 (Macintosh)', platform: 'MacIntel', maxTouchPoints: 5}))).toBe(false);
  });

  it('keeps iPad desktop mode in the broader iOS capability', () => {
    expect(isIOSDevice(navigatorLike({userAgent: 'Mozilla/5.0 (Macintosh)', platform: 'MacIntel', maxTouchPoints: 5}))).toBe(true);
  });

  it('detects standards-based and legacy standalone modes', () => {
    expect(isStandaloneWebApp(windowLike(true), navigatorLike())).toBe(true);
    expect(isStandaloneWebApp(windowLike(false), navigatorLike({standalone: true}))).toBe(true);
    expect(isStandaloneWebApp(windowLike(false), navigatorLike())).toBe(false);
  });

  it('handles browsers without matchMedia', () => {
    expect(isStandaloneWebApp({}, navigatorLike())).toBe(false);
  });
});
