'use client';

import {useLayoutEffect, useRef} from 'react';

type BannerSubtitleProps = {className: string; children: string};

export function BannerSubtitle({className, children}: BannerSubtitleProps) {
  const ref = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    let active = true;
    const fit = () => {
      if (!active) return;
      element.style.fontSize = '';
      element.style.whiteSpace = '';
      if (!window.matchMedia?.('(max-width: 620px)').matches) return;
      element.style.whiteSpace = 'nowrap';
      const available = element.clientWidth;
      const required = element.scrollWidth;
      if (available > 0 && required > available) {
        const size = parseFloat(getComputedStyle(element).fontSize);
        element.style.fontSize = `${Math.floor(size * (available - 1) / required * 100) / 100}px`;
      }
    };
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit);
    if (element.parentElement) observer?.observe(element.parentElement);
    window.addEventListener('resize', fit);
    document.fonts?.addEventListener('loadingdone', fit);
    void document.fonts?.ready.then(fit);
    fit();
    return () => {
      active = false;
      observer?.disconnect();
      window.removeEventListener('resize', fit);
      document.fonts?.removeEventListener('loadingdone', fit);
    };
  }, [children, className]);

  return <p ref={ref} className={className}>{children}</p>;
}
