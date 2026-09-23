import { useEffect, useRef, useState } from 'react';

import {
  AGENT_THINKING_DELAYS,
  AGENT_THINKING_SENTENCES,
} from '#/components/marketing/agent-run-data';

const COLLAPSE_BEAT = 360;
const SENTENCE_COUNT = AGENT_THINKING_SENTENCES.length;
const THINK_MS = AGENT_THINKING_DELAYS.reduce((a, b) => a + b, 0);

export const useThinkingPhase = (
  instant: boolean,
  onDone?: () => void
): { done: boolean; revealed: number } => {
  const [phase, setPhase] = useState<'done' | 'thinking'>(
    instant ? 'done' : 'thinking'
  );
  const [revealed, setRevealed] = useState(instant ? SENTENCE_COUNT : 0);
  const doneNotifiedRef = useRef(false);
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const fireDone = () => {
      if (doneNotifiedRef.current) {
        return;
      }
      doneNotifiedRef.current = true;
      onDoneRef.current?.();
    };

    if (instant) {
      fireDone();
      return;
    }

    const timers: number[] = [];
    const at = (ms: number, fn: () => void) => {
      timers.push(window.setTimeout(fn, ms));
    };
    let t = 0;
    for (const [index, delay] of AGENT_THINKING_DELAYS.entries()) {
      t += delay;
      at(t, () => {
        setRevealed(index + 1);
      });
    }
    at(THINK_MS + COLLAPSE_BEAT, () => {
      setPhase('done');
      fireDone();
    });
    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, [instant]);

  return { done: phase === 'done', revealed };
};
