'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { cn } from '#/lib/utils';

const DISCOVERED = [
  { path: 'functions/images/resize.ts', slug: 'resize' },
  { path: 'functions/slides/render.ts', slug: 'render' },
  { path: 'functions/slides/export.ts', slug: 'export' },
] as const;

const HANDLE = 'xmazu';
const PACKAGE_SLUG = 'openenvx-tools';
const WEB_ORIGIN = 'https://functhis.now';
const PROJECT_DIR = '~/projects/openenvx-tools';
const COMMAND = 'npx functhis publish';

const TYPE_START_MS = 480;
const TYPE_MIN_MS = 25;
const TYPE_SPAN_MS = 35;
const AFTER_COMMAND_MS = 250;
const TRAILING_MS = 400;
const DEFAULT_LINE_DELAY_MS = 100;

const packageUrl = `${WEB_ORIGIN}/@${HANDLE}/${PACKAGE_SLUG}`;
const [, primaryFunction] = DISCOVERED;
const functionUrl = `${WEB_ORIGIN}/@${HANDLE}/${PACKAGE_SLUG}/${primaryFunction.slug}`;
const mcpId = `@${HANDLE}/${PACKAGE_SLUG}/${primaryFunction.slug}`;

interface OutputLine {
  className?: string;
  delay: number;
  key: string;
  render: () => ReactNode;
}

const OUTPUT_LINES: OutputLine[] = [
  {
    delay: 380,
    key: 'found',
    render: () => (
      <span className="text-[#a1a1aa]">
        Found {DISCOVERED.length} functions
      </span>
    ),
  },
  ...DISCOVERED.map((fn, index) => ({
    delay: index === 0 ? 120 : 100,
    key: fn.path,
    render: () => (
      <>
        <span className="text-zinc-600"> {fn.path.padEnd(34)}</span>
        <span className="text-[#a1a1aa]">→ {fn.slug}</span>
      </>
    ),
  })),
  {
    delay: 320,
    key: 'deployed',
    render: () => (
      <span className="text-[#fafafa]">
        Deployed @{HANDLE}/{PACKAGE_SLUG}
      </span>
    ),
  },
  {
    className: 'text-zinc-500',
    delay: 140,
    key: 'package-url',
    render: () => (
      <>
        {'  '}
        {packageUrl}
      </>
    ),
  },
  {
    className: 'text-zinc-500',
    delay: 120,
    key: 'function-url',
    render: () => (
      <>
        {'  '}
        {functionUrl}
      </>
    ),
  },
  {
    className: 'text-zinc-500',
    delay: 120,
    key: 'mcp',
    render: () => (
      <>
        {'  MCP: '}
        <span className="text-[#a1a1aa]">{mcpId}</span>
      </>
    ),
  },
  {
    className: 'text-zinc-600',
    delay: 240,
    key: 'try',
    render: () => (
      <>
        Try{'  '}
        <span className="text-[#a1a1aa]">
          npx functhis run --slug {primaryFunction.slug}
        </span>
      </>
    ),
  },
];

const LINE_COUNT = OUTPUT_LINES.length;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const TermCaret = () => (
  <span
    aria-hidden="true"
    className="ft-term-caret ml-0.5 inline-block h-3.5 w-2 translate-y-0.5 bg-[#f4f4f5]"
  />
);

const lineVisibilityClass = (animate: boolean, visible: boolean): string => {
  if (!visible) {
    return 'opacity-0';
  }
  if (animate) {
    return 'ft-term-line-in';
  }
  return 'opacity-100';
};

const TermLine = ({
  animate,
  children,
  className,
  visible,
}: {
  animate: boolean;
  children: ReactNode;
  className?: string;
  visible: boolean;
}) => (
  <div
    aria-hidden={!visible}
    className={cn(
      'whitespace-pre',
      lineVisibilityClass(animate, visible),
      className
    )}
  >
    {children}
  </div>
);

const WindowDots = () => (
  <>
    <span className="size-2.5 rounded-full border border-zinc-600 bg-zinc-700" />
    <span className="size-2.5 rounded-full border border-zinc-600 bg-zinc-700" />
    <span className="size-2.5 rounded-full border border-zinc-600 bg-zinc-700" />
  </>
);

const TrailingPrompt = ({
  animate,
  visible,
}: {
  animate: boolean;
  visible: boolean;
}) => (
  <div
    aria-hidden={!visible}
    className={cn(
      'mt-1 flex items-center gap-2 leading-relaxed',
      lineVisibilityClass(animate && visible, visible)
    )}
    data-slot="terminal-animation-trailing-prompt"
  >
    <span className="font-mono text-sm text-zinc-500 select-none">$</span>
    <span
      aria-hidden="true"
      className={cn(
        'ml-0.5 inline-block h-[18px] w-[7px] translate-y-[3px] bg-zinc-500',
        animate && visible ? 'ft-term-caret' : undefined
      )}
      data-slot="terminal-animation-blinking-cursor"
    />
  </div>
);

export const DeployConsole = () => {
  const rootRef = useRef<HTMLDivElement>(null);
  const reduceMotion = prefersReducedMotion();
  const [playing, setPlaying] = useState(false);
  const [commandTyped, setCommandTyped] = useState(() =>
    prefersReducedMotion() ? COMMAND : ''
  );
  const [isTyping, setIsTyping] = useState(() => !prefersReducedMotion());
  const [visibleLines, setVisibleLines] = useState(() =>
    prefersReducedMotion() ? LINE_COUNT : 0
  );
  const [showTrailing, setShowTrailing] = useState(() =>
    prefersReducedMotion()
  );
  const animateLines = !reduceMotion;

  useEffect(() => {
    const node = rootRef.current;
    if (!node || prefersReducedMotion()) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue;
          }
          setPlaying(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!playing || prefersReducedMotion()) {
      return;
    }

    const timeouts: number[] = [];
    const schedule = (tick: () => void, ms: number): void => {
      timeouts.push(window.setTimeout(tick, ms));
    };

    let charIndex = 0;

    const reveal = (lineIndex: number): void => {
      setVisibleLines(lineIndex);
      if (lineIndex < LINE_COUNT) {
        const delay = OUTPUT_LINES[lineIndex]?.delay ?? DEFAULT_LINE_DELAY_MS;
        schedule(() => {
          reveal(lineIndex + 1);
        }, delay);
        return;
      }

      schedule(() => {
        setShowTrailing(true);
      }, TRAILING_MS);
    };

    const typeCommand = (): void => {
      if (charIndex <= COMMAND.length) {
        setCommandTyped(COMMAND.slice(0, charIndex));
        charIndex += 1;
        schedule(typeCommand, TYPE_MIN_MS + Math.random() * TYPE_SPAN_MS);
        return;
      }

      schedule(() => {
        setIsTyping(false);
        reveal(0);
      }, AFTER_COMMAND_MS);
    };

    schedule(typeCommand, TYPE_START_MS);

    return () => {
      for (const id of timeouts) {
        window.clearTimeout(id);
      }
    };
  }, [playing]);

  const discoveredEnd = 1 + DISCOVERED.length;
  const hintIndex = LINE_COUNT - 1;

  return (
    <div
      aria-label="Example of npx functhis publish"
      className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 text-left shadow-[0_8px_24px_rgba(0,0,0,0.28)]"
      ref={rootRef}
    >
      <div className="flex items-center gap-1.5 border-b border-zinc-800 px-4 py-3">
        <WindowDots />
        <span className="ml-4 font-mono text-[11px] text-zinc-500">
          {PROJECT_DIR}
        </span>
      </div>

      <div className="h-[23rem] overflow-x-auto overflow-y-auto p-5 font-mono text-xs leading-6 sm:h-[23.5rem] sm:p-6 sm:text-[13px]">
        <div className="whitespace-pre text-[#f4f4f5]">
          <span className="text-[#a1a1aa]">❯ </span>
          {commandTyped}
          {isTyping ? <TermCaret /> : null}
        </div>

        <div className="h-4" />

        {OUTPUT_LINES.slice(0, discoveredEnd).map((line, index) => (
          <TermLine
            animate={animateLines}
            className={line.className}
            key={line.key}
            visible={visibleLines > index}
          >
            {line.render()}
          </TermLine>
        ))}

        <div className="h-4" />

        {OUTPUT_LINES.slice(discoveredEnd, hintIndex).map((line, index) => (
          <TermLine
            animate={animateLines}
            className={line.className}
            key={line.key}
            visible={visibleLines > discoveredEnd + index}
          >
            {line.render()}
          </TermLine>
        ))}

        <div className="h-4" />

        {OUTPUT_LINES.slice(hintIndex).map((line) => (
          <TermLine
            animate={animateLines}
            className={line.className}
            key={line.key}
            visible={visibleLines > hintIndex}
          >
            {line.render()}
          </TermLine>
        ))}

        <TrailingPrompt animate={animateLines} visible={showTrailing} />
      </div>
    </div>
  );
};
