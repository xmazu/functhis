'use client';

import { useRef, useState } from 'react';

import {
  AGENT_THINKING_DELAYS,
  AGENT_THINKING_SENTENCES,
} from '#/components/marketing/agent-run-data';

import { useThinkingPhase } from './use-thinking-phase';

import styles from './thinking-reasoning.module.css';

const SENT_H = 40;
const GAP = 4;
const MAX_H = 180;
const FADE = 16;
const SENTENCE_COUNT = AGENT_THINKING_SENTENCES.length;

const THINK_MS = AGENT_THINKING_DELAYS.reduce((a, b) => a + b, 0);
const ELAPSED_S = Math.max(1, Math.round(THINK_MS / 1000));

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const startsInstant = (skipAnimation: boolean): boolean =>
  skipAnimation || prefersReducedMotion();

const streamTranslate = (
  scrollable: boolean,
  capped: boolean,
  contentH: number
): number => {
  if (scrollable) {
    return 0;
  }
  if (capped) {
    return MAX_H - FADE - contentH;
  }
  return 0;
};

const viewportMask = (
  capped: boolean,
  showTop: boolean,
  showBottom: boolean
): string => {
  if (!capped) {
    return 'none';
  }
  return `linear-gradient(to bottom, transparent 0, #000 ${showTop ? FADE : 0}px, #000 calc(100% - ${showBottom ? FADE : 0}px), transparent 100%)`;
};

export interface ThinkingReasoningProps {
  onDone?: () => void;
  skipAnimation?: boolean;
}

export const ThinkingReasoning = ({
  onDone,
  skipAnimation = false,
}: ThinkingReasoningProps) => {
  const instant = startsInstant(skipAnimation);
  const { done, revealed } = useThinkingPhase(instant, onDone);
  const [open, setOpen] = useState(false);
  const [fade, setFade] = useState({ bottom: true, top: false });
  const viewportRef = useRef<HTMLDivElement>(null);

  const expanded = done ? open : true;
  const count = done ? SENTENCE_COUNT : revealed;
  const contentH = count > 0 ? count * SENT_H + (count - 1) * GAP : 0;
  const scrollable = done && open;
  const viewH = expanded ? MAX_H : 0;
  const capped = contentH > MAX_H;
  const translate = streamTranslate(scrollable, capped, contentH);
  const showTop = scrollable ? fade.top : capped;
  const showBottom = scrollable ? fade.bottom : capped;
  const mask = viewportMask(capped, showTop, showBottom);
  const folded = done && !open;

  const onScroll = () => {
    const el = viewportRef.current;
    if (!el) {
      return;
    }
    setFade({
      bottom: el.scrollTop + el.clientHeight < el.scrollHeight - 1,
      top: el.scrollTop > 1,
    });
  };

  const toggle = () => {
    const next = !open;
    if (next) {
      setFade({ bottom: true, top: false });
      if (viewportRef.current) {
        viewportRef.current.scrollTop = 0;
      }
    }
    setOpen(next);
  };

  return (
    <div className={`${styles.tr}${folded ? ` ${styles.isFolded}` : ''}`}>
      <button
        aria-expanded={expanded}
        aria-label="Toggle thought"
        className={`${styles.trHeader}${done ? ` ${styles.isClickable}` : ''}`}
        onClick={done ? toggle : undefined}
        type="button"
      >
        {done ? (
          <span className={styles.trLabel}>
            <span className={styles.trVerb}>Thought</span> for {ELAPSED_S}s
          </span>
        ) : (
          <span className={`${styles.trLabel} ${styles.trShimmer}`}>
            Thinking…
          </span>
        )}
        {done ? (
          <svg
            aria-hidden="true"
            className={styles.trChevron}
            height="12"
            viewBox="0 0 24 24"
            width="12"
          >
            <path
              d="m4.5 15.75 7.5-7.5 7.5 7.5"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.8"
            />
          </svg>
        ) : null}
      </button>

      <div
        className={`${styles.trCollapsible}${expanded ? '' : ` ${styles.isCollapsed}`}`}
      >
        <div className={styles.trInner}>
          <div
            className={`${styles.trViewport}${scrollable ? ` ${styles.isScroll}` : ''}`}
            onScroll={scrollable ? onScroll : undefined}
            ref={viewportRef}
            style={{
              WebkitMaskImage: mask,
              height: viewH > 0 ? `${viewH}px` : undefined,
              maskImage: mask,
            }}
          >
            <div
              className={styles.trStream}
              style={{ transform: `translateY(${translate}px)` }}
            >
              {AGENT_THINKING_SENTENCES.slice(0, count).map((line) => (
                <p className={styles.trSentence} key={line}>
                  {line}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
