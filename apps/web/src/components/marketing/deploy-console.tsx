'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

const DISCOVERED = [
  { path: 'functions/images/resize.ts', slug: 'resize' },
  { path: 'functions/slides/render.ts', slug: 'render' },
  { path: 'functions/slides/export.ts', slug: 'export' },
] as const;

const HANDLE = 'xmazu';
const PACKAGE_SLUG = 'openenvx-tools';
const WEB_ORIGIN = 'https://functhis.now';
const PROJECT_DIR = '~/projects/openenvx-tools';

const packageUrl = `${WEB_ORIGIN}/@${HANDLE}/${PACKAGE_SLUG}`;
const [, primaryFunction] = DISCOVERED;
const functionUrl = `${WEB_ORIGIN}/@${HANDLE}/${PACKAGE_SLUG}/${primaryFunction.slug}`;
const mcpId = `@${HANDLE}/${PACKAGE_SLUG}/${primaryFunction.slug}`;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const TermLine = ({
  children,
  className = '',
  visible,
}: {
  children: ReactNode;
  className?: string;
  visible: boolean;
}) => (
  <div
    className={`whitespace-pre transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'} ${className}`}
  >
    {children}
  </div>
);

export const DeployConsole = () => {
  const [shown, setShown] = useState(() => prefersReducedMotion());

  useEffect(() => {
    if (prefersReducedMotion()) {
      return;
    }

    const timer = window.setTimeout(() => {
      setShown(true);
    }, 1600);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <div
      aria-label="Example of npx functhis deploy"
      className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 text-left shadow-[0_8px_24px_rgba(0,0,0,0.28)]"
    >
      <div className="flex items-center gap-1.5 border-b border-zinc-800 px-4 py-3">
        <span className="size-2.5 rounded-full border border-zinc-600 bg-zinc-700" />
        <span className="size-2.5 rounded-full border border-zinc-600 bg-zinc-700" />
        <span className="size-2.5 rounded-full border border-zinc-600 bg-zinc-700" />
        <span className="ml-4 font-mono text-[11px] text-zinc-500">
          {PROJECT_DIR}
        </span>
      </div>

      <div className="overflow-x-auto p-5 font-mono text-xs leading-6 sm:p-6 sm:text-[13px]">
        <div className="whitespace-pre text-[#f4f4f5]">
          <span className="text-[#a1a1aa]">❯ </span>
          npx functhis deploy
          {shown ? null : (
            <span
              aria-hidden="true"
              className="ml-0.5 inline-block h-3.5 w-2 translate-y-0.5 [animation:term-blink_1s_step-end_infinite] bg-[#f4f4f5]"
            />
          )}
        </div>

        <div className="h-4" />

        <TermLine visible={shown}>
          <span className="text-[#a1a1aa]">
            Found {DISCOVERED.length} functions
          </span>
        </TermLine>
        {DISCOVERED.map((fn) => (
          <TermLine key={fn.path} visible={shown}>
            <span className="text-zinc-600"> {fn.path.padEnd(34)}</span>
            <span className="text-[#a1a1aa]">→ {fn.slug}</span>
          </TermLine>
        ))}

        <div className="h-4" />

        <TermLine visible={shown}>
          <span className="text-[#fafafa]">
            Deployed @{HANDLE}/{PACKAGE_SLUG}
          </span>
        </TermLine>
        <TermLine className="text-zinc-500" visible={shown}>
          {'  '}
          {packageUrl}
        </TermLine>
        <TermLine className="text-zinc-500" visible={shown}>
          {'  '}
          {functionUrl}
        </TermLine>
        <TermLine className="text-zinc-500" visible={shown}>
          {'  MCP: '}
          <span className="text-[#a1a1aa]">{mcpId}</span>
        </TermLine>

        <div className="h-4" />

        <TermLine className="text-zinc-600" visible={shown}>
          Try{'  '}
          <span className="text-[#a1a1aa]">
            npx functhis run --slug {primaryFunction.slug}
          </span>
        </TermLine>
      </div>
    </div>
  );
};
