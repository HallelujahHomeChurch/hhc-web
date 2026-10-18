import {act, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {BannerSubtitle} from './BannerSubtitle';

describe('BannerSubtitle', () => {
  let mobile: boolean;
  let available: number;
  let resize: () => void;
  const disconnect = vi.fn();

  beforeEach(() => {
    mobile = true;
    available = 280;
    vi.stubGlobal('matchMedia', vi.fn(() => ({matches: mobile}) as MediaQueryList));
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({fontSize: '24px'} as CSSStyleDeclaration);
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: () => void) {resize = callback;}
      observe() {}
      disconnect = disconnect;
    });
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => available);
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function(this: HTMLElement) {
      return Math.round(400 * parseFloat(this.style.fontSize || '24') / 24);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('fits the complete mobile subtitle on one line without truncating it', () => {
    const text = '陪人走一生的路，乃人生最高的成就';
    render(<BannerSubtitle className="banner">{text}</BannerSubtitle>);
    const subtitle = screen.getByText(text);
    expect(subtitle.style.whiteSpace).toBe('nowrap');
    expect(parseFloat(subtitle.style.fontSize)).toBeGreaterThan(0);
    expect(subtitle.scrollWidth).toBeLessThanOrEqual(available);
    expect(subtitle.textContent).toBe(text);
  });

  it('restores the original font size when the container grows', () => {
    render(<BannerSubtitle className="banner">Subtitle</BannerSubtitle>);
    available = 500;
    act(() => resize());
    expect(screen.getByText('Subtitle').style.fontSize).toBe('');
  });

  it('restores desktop wrapping and typography after resizing', () => {
    render(<BannerSubtitle className="banner">Subtitle</BannerSubtitle>);
    mobile = false;
    act(() => window.dispatchEvent(new Event('resize')));
    const subtitle = screen.getByText('Subtitle');
    expect(subtitle.style.fontSize).toBe('');
    expect(subtitle.style.whiteSpace).toBe('');
  });

  it('disconnects the observer when unmounted', () => {
    const {unmount} = render(<BannerSubtitle className="banner">Subtitle</BannerSubtitle>);
    unmount();
    expect(disconnect).toHaveBeenCalled();
  });
});
