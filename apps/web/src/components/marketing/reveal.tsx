'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

interface RevealProps {
  children: ReactNode;
  className?: string;
  delayMs?: number;
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const Reveal = ({ children, className, delayMs = 0 }: RevealProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(prefersReducedMotion);

  useEffect(() => {
    const node = ref.current;
    if (!node || prefersReducedMotion()) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
          }
        }
      },
      { threshold: 0.12 }
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div
      className={className}
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'none' : 'translateY(16px)',
        transition: visible
          ? `opacity 315ms cubic-bezier(0.16, 1, 0.3, 1) ${delayMs}ms, transform 700ms cubic-bezier(0.16, 1, 0.3, 1) ${delayMs}ms`
          : 'none',
      }}
    >
      {children}
    </div>
  );
};
