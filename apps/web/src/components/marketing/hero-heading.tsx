'use client';

import { useEffect, useState } from 'react';

const HERO_THINGS = ['tool', 'function', 'MCP', 'workflow'] as const;
const ROTATE_MS = 2400;

export const HeroHeading = () => {
  const [index, setIndex] = useState(0);
  const thing = HERO_THINGS[index] ?? 'tool';

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (media.matches) {
      return;
    }

    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % HERO_THINGS.length);
    }, ROTATE_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  return (
    <h1
      className="text-4xl leading-tight font-semibold tracking-tight sm:text-5xl"
      id="hero-heading"
    >
      <span className="block">
        Instant hosting
        <span className="sm:hidden"> for</span>
      </span>
      <span className="block">
        <span className="hidden sm:inline">for </span>
        every{' '}
        <span
          className="ft-hero-highlight inline-block rounded-lg bg-zinc-800 px-2"
          key={thing}
        >
          <span className="ft-hero-thing inline-block">{thing}</span>
        </span>
      </span>
      <span className="block">
        you make with
        <span className="hidden sm:inline"> your agent</span>
      </span>
      <span className="block sm:hidden">your agent</span>
    </h1>
  );
};
