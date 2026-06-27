'use client';

import {useEffect, useRef, useState} from 'react';

type RevealProps = {
  children: React.ReactNode;
  className?: string;
  delay?: number;
};

export function Reveal({children, className = '', delay = 0}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;

    if (!node || !('IntersectionObserver' in window)) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      {rootMargin: '0px 0px -12% 0px', threshold: 0.12}
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-visible={isVisible}
      className={`transition duration-700 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:translate-y-0 motion-reduce:opacity-100 ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
      } ${className}`}
      style={{transitionDelay: isVisible ? `${delay}ms` : '0ms'}}
    >
      {children}
    </div>
  );
}
