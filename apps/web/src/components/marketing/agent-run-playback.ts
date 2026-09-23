import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

import {
  BEAT_MS,
  PAUSE_BEAT,
  beatForStep,
  stepForBeat,
} from '#/components/marketing/agent-run-data';
import type { StepId } from '#/components/marketing/agent-run-data';

export type Outcome = 'none' | 'sent' | 'skipped';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const thinkingStateForBeat = (
  nextBeat: number
): { ready: boolean; skipAnimation: boolean } => {
  const skipAnimation = nextBeat > 0 || prefersReducedMotion();
  return { ready: skipAnimation, skipAnimation };
};

export const useAgentRunPlayback = (
  sectionRef: RefObject<HTMLElement | null>
) => {
  const transcriptRef = useRef<HTMLDivElement>(null);
  const latestRef = useRef<HTMLDivElement>(null);
  const [beat, setBeat] = useState(() =>
    prefersReducedMotion() ? PAUSE_BEAT : 0
  );
  const [playing, setPlaying] = useState(false);
  const [animateLatest, setAnimateLatest] = useState(
    () => !prefersReducedMotion()
  );
  const [outcome, setOutcome] = useState<Outcome>('none');
  const [previewSlug, setPreviewSlug] = useState<string | null>(null);
  const [openLog, setOpenLog] = useState<string | null>(null);
  const [thinkingKey, setThinkingKey] = useState(0);
  const [thinkingReady, setThinkingReady] = useState(() =>
    prefersReducedMotion()
  );
  const [thinkingSkipAnimation, setThinkingSkipAnimation] = useState(() =>
    prefersReducedMotion()
  );

  useEffect(() => {
    const node = sectionRef.current;
    if (!node) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue;
          }
          if (prefersReducedMotion()) {
            setBeat(PAUSE_BEAT);
            setAnimateLatest(false);
            setThinkingReady(true);
            setThinkingSkipAnimation(true);
          } else {
            setPlaying(true);
          }
          observer.disconnect();
        }
      },
      { threshold: 0 }
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [sectionRef]);

  useEffect(() => {
    if (!playing || prefersReducedMotion()) {
      return;
    }
    if (beat === 0 && !thinkingReady) {
      return;
    }
    if (beat >= PAUSE_BEAT) {
      return;
    }

    const timer = window.setTimeout(() => {
      setAnimateLatest(true);
      setBeat((current) => current + 1);
    }, BEAT_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [beat, playing, thinkingReady]);

  useEffect(() => {
    const scroller = transcriptRef.current;
    const latest = latestRef.current;
    if (!scroller || !latest) {
      return;
    }

    if (outcome === 'none' && beat === 0) {
      scroller.scrollTo({ behavior: 'auto', top: 0 });
      return;
    }

    const scrollerBox = scroller.getBoundingClientRect();
    const latestBox = latest.getBoundingClientRect();
    const overflow = latestBox.bottom - scrollerBox.bottom + 16;
    if (overflow <= 0) {
      return;
    }

    scroller.scrollTo({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      top: scroller.scrollTop + overflow,
    });
  }, [beat, outcome]);

  const jumpToStep = (step: StepId): void => {
    setPlaying(false);
    setAnimateLatest(false);
    setOutcome('none');
    setOpenLog(null);
    const nextBeat = beatForStep(step);
    const thinking = thinkingStateForBeat(nextBeat);
    setThinkingSkipAnimation(thinking.skipAnimation);
    setThinkingReady(thinking.ready);
    setThinkingKey((current) => current + 1);
    setBeat(nextBeat);
  };

  const openPreview = (slug: string): void => {
    setPreviewSlug((current) => (current === slug ? null : slug));
  };

  const handleApprove = (): void => {
    setPlaying(false);
    setAnimateLatest(!prefersReducedMotion());
    setOutcome('sent');
  };

  const handleSkip = (): void => {
    setPlaying(false);
    setAnimateLatest(false);
    setOutcome('skipped');
  };

  const handleReplay = (): void => {
    setOutcome('none');
    setOpenLog(null);
    setAnimateLatest(!prefersReducedMotion());
    if (prefersReducedMotion()) {
      setBeat(PAUSE_BEAT);
      setPlaying(false);
      setThinkingReady(true);
      setThinkingSkipAnimation(true);
      return;
    }
    setThinkingKey((current) => current + 1);
    setThinkingReady(false);
    setThinkingSkipAnimation(false);
    setBeat(0);
    setPlaying(true);
  };

  const currentStep = stepForBeat(beat);
  const showApproval = beat >= PAUSE_BEAT && outcome === 'none';
  const showSent = outcome === 'sent';
  const showSkipped = outcome === 'skipped';
  const latestAt = (index: number): boolean =>
    animateLatest && beat === index && outcome === 'none';

  return {
    animateLatest,
    beat,
    currentStep,
    handleApprove,
    handleReplay,
    handleSkip,
    jumpToStep,
    latestAt,
    latestRef,
    openLog,
    openPreview,
    outcome,
    previewSlug,
    setOpenLog,
    setThinkingReady,
    showApproval,
    showSent,
    showSkipped,
    thinkingKey,
    thinkingReady,
    thinkingSkipAnimation,
    transcriptRef,
  };
};
