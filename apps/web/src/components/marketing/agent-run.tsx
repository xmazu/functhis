'use client';

import { useId, useRef } from 'react';
import type { ReactNode, Ref } from 'react';

import {
  DEMO_FUNCTIONS,
  FIND_OVERDUE,
  INVOICES,
  LIVE_FOR_BEAT,
  OUTCOME_BEAT,
  PAUSE_BEAT,
  SEND_REMINDER,
  STEPS,
  TOKEN_CLASS,
  USER_PROMPT,
  VERSION,
} from '#/components/marketing/agent-run-data';
import type {
  DemoFunction,
  Token,
} from '#/components/marketing/agent-run-data';
import { useAgentRunPlayback } from '#/components/marketing/agent-run-playback';
import type { Outcome } from '#/components/marketing/agent-run-playback';
import { ThinkingReasoning } from '#/components/marketing/thinking-reasoning/thinking-reasoning';
import { cn } from '#/lib/utils';

const WindowDots = () => (
  <div className="flex items-center gap-1.5">
    <span className="size-2.5 rounded-full border border-zinc-600 bg-zinc-700" />
    <span className="size-2.5 rounded-full border border-zinc-600 bg-zinc-700" />
    <span className="size-2.5 rounded-full border border-zinc-600 bg-zinc-700" />
  </div>
);

const SendIcon = () => (
  <svg
    aria-hidden="true"
    className="size-3.5"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.5"
    viewBox="0 0 16 16"
  >
    <path d="M8 12.5V3.5" />
    <path d="m4 7.5 4-4 4 4" />
  </svg>
);

const Beat = ({
  children,
  isLatest,
  latestRef,
  visible,
}: {
  children: ReactNode;
  isLatest: boolean;
  latestRef?: Ref<HTMLDivElement>;
  visible: boolean;
}) => {
  if (!visible) {
    return null;
  }

  return (
    <div className={isLatest ? 'ft-agent-beat' : undefined} ref={latestRef}>
      {children}
    </div>
  );
};

const CodePreview = ({ fn }: { fn: DemoFunction }) => (
  <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
    <div className="border-b border-zinc-800 px-4 py-2 font-mono text-[11px] text-zinc-500">
      {fn.file}
    </div>
    <pre className="max-h-64 overflow-auto p-4 font-mono text-[12px] leading-6">
      <code>
        {fn.lines.map((tokens: Token[], lineIndex) => (
          <span
            className="block whitespace-pre"
            key={`${fn.slug}-${lineIndex}`}
          >
            {tokens.map((token, tokenIndex) => (
              <span className={TOKEN_CLASS[token.kind]} key={tokenIndex}>
                {token.text}
              </span>
            ))}
          </span>
        ))}
      </code>
    </pre>
  </div>
);

const ToolSearch = ({
  fn,
  hitIsLatest,
  onOpen,
  showHit,
}: {
  fn: DemoFunction;
  hitIsLatest: boolean;
  onOpen: (slug: string) => void;
  showHit: boolean;
}) => (
  <div className="flex flex-col gap-1">
    <p className="font-mono text-[11px] text-zinc-500">functhis.search</p>
    <p className="text-[13px] leading-relaxed text-zinc-300">
      “{fn.searchQuery}”
    </p>
    {showHit ? (
      <button
        className={cn(
          'w-fit max-w-full cursor-pointer truncate text-left font-mono text-[12px] text-zinc-400 transition-colors duration-[120ms] hover:text-zinc-50',
          hitIsLatest ? 'ft-agent-beat' : undefined
        )}
        onClick={() => {
          onOpen(fn.slug);
        }}
        type="button"
      >
        → {fn.id}
      </button>
    ) : null}
  </div>
);

const ToolExecute = ({
  fn,
  logOpen,
  onToggleLog,
}: {
  fn: DemoFunction;
  logOpen: boolean;
  onToggleLog: () => void;
}) => (
  <div className="flex flex-col gap-1">
    <p className="font-mono text-[11px] text-zinc-500">functhis.execute</p>
    <p className="font-mono text-[12px] leading-relaxed break-words text-zinc-300">
      {fn.executeCall}
    </p>
    <div className="flex flex-wrap items-center gap-2">
      <p className="text-[13px] text-zinc-200">→ {fn.executeResult}</p>
      <span className="rounded-md bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
        {VERSION}
      </span>
      <button
        aria-expanded={logOpen}
        className="cursor-pointer rounded-md px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 transition-colors duration-[120ms] hover:bg-zinc-800 hover:text-zinc-300"
        onClick={onToggleLog}
        type="button"
      >
        Log
      </button>
    </div>
    {logOpen ? (
      <p className="font-mono text-[11px] text-zinc-500">
        {fn.logId}
        <span className="mx-2 text-zinc-700">·</span>
        {fn.logDuration}
        <span className="mx-2 text-zinc-700">·</span>
        {VERSION}
      </p>
    ) : null}
  </div>
);

const ApprovalCard = ({
  onApprove,
  onSkip,
}: {
  onApprove: () => void;
  onSkip: () => void;
}) => (
  <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
    <p className="font-mono text-[11px] text-zinc-500">Needs your call</p>
    <p className="mt-2 text-sm leading-relaxed font-medium tracking-[-0.01em] text-zinc-50">
      Send Anna a reminder for the two open invoices?
    </p>
    <p className="mt-2 text-[13px] leading-relaxed text-zinc-400">
      The agent pauses here. Sending mail is an external action.
    </p>
    <ul className="mt-4 flex flex-col gap-2">
      {INVOICES.map((invoice) => (
        <li
          className="grid grid-cols-[auto_1fr_auto] items-baseline gap-3 font-mono text-[12px]"
          key={invoice.id}
        >
          <span className="text-zinc-300">{invoice.id}</span>
          <span className="text-zinc-500">{invoice.due}</span>
          <span className="text-zinc-200 tabular-nums">{invoice.amount}</span>
        </li>
      ))}
    </ul>
    <div className="mt-5 flex items-center justify-end gap-2">
      <button
        className="h-[30px] cursor-pointer rounded-full px-3 text-xs font-medium text-zinc-400 transition-colors duration-[120ms] hover:text-zinc-200"
        onClick={onSkip}
        type="button"
      >
        Skip
      </button>
      <button
        className="h-[30px] cursor-pointer rounded-full bg-zinc-50 px-3 text-xs font-medium text-zinc-950 transition-colors duration-[120ms] hover:bg-zinc-200 active:scale-[0.96]"
        onClick={onApprove}
        type="button"
      >
        Approve
      </button>
    </div>
  </div>
);

const statusLabel = (beat: number, outcome: Outcome): string => {
  if (outcome === 'skipped') {
    return 'Paused';
  }
  if (outcome === 'sent') {
    return 'Done';
  }
  if (beat >= PAUSE_BEAT) {
    return 'Waiting on you';
  }
  return 'Running';
};

const liveLabel = (beat: number, outcome: Outcome): string => {
  if (outcome === 'skipped') {
    return 'Reminder not sent. The agent did not call send-reminder.';
  }
  if (outcome === 'sent') {
    return LIVE_FOR_BEAT[OUTCOME_BEAT];
  }
  return LIVE_FOR_BEAT[Math.min(beat, PAUSE_BEAT)] ?? '';
};

export const AgentRun = () => {
  const previewId = useId();
  const sectionRef = useRef<HTMLElement>(null);
  const playback = useAgentRunPlayback(sectionRef);
  const {
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
  } = playback;

  const preview = DEMO_FUNCTIONS.find((fn) => fn.slug === previewSlug) ?? null;

  return (
    <section
      className="scroll-mt-24 pt-16 md:pt-20"
      id="agent-run"
      ref={sectionRef}
    >
      <h2 className="text-4xl leading-tight font-semibold tracking-tight text-balance sm:text-[41px]">
        Your agent runs what you published
      </h2>
      <p className="mt-4 text-lg leading-relaxed text-zinc-400">
        Connect Codex or any MCP client. It searches, then executes. You write
        the Stripe and email code - Functhis publishes and runs it.
      </p>

      <nav aria-label="How the demo works" className="mt-10">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          {STEPS.map((step) => {
            const pressed = currentStep === step.id;
            return (
              <button
                aria-pressed={pressed}
                className={cn(
                  'cursor-pointer border-b pb-1 text-sm font-medium tracking-[-0.01em] transition-colors duration-[120ms]',
                  pressed
                    ? 'border-zinc-50 text-zinc-50'
                    : 'border-transparent text-zinc-500 hover:text-zinc-300'
                )}
                key={step.id}
                onClick={() => {
                  jumpToStep(step.id);
                }}
                type="button"
              >
                {step.label}
              </button>
            );
          })}
        </div>
      </nav>

      <div className={preview ? 'mt-8' : 'hidden'} id={previewId}>
        {preview ? <CodePreview fn={preview} /> : null}
      </div>

      <p aria-live="polite" className="sr-only">
        {liveLabel(beat, outcome)}
      </p>

      <div
        aria-label="Example of an agent calling Functhis"
        className="mt-8 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 text-left shadow-[0_8px_24px_rgba(0,0,0,0.28)]"
      >
        <div className="flex items-center gap-3 border-b border-zinc-800 px-4 py-3">
          <WindowDots />
          <p className="min-w-0 flex-1 truncate text-sm font-medium tracking-[-0.01em]">
            Acme invoices
          </p>
          <p className="shrink-0 font-mono text-[11px] text-zinc-500">
            {statusLabel(beat, outcome)}
          </p>
        </div>

        <div
          className="flex max-h-[28rem] min-h-[20rem] flex-col gap-5 overflow-y-auto px-5 py-6 sm:px-6"
          ref={transcriptRef}
        >
          <Beat
            isLatest={latestAt(0)}
            latestRef={beat === 0 ? latestRef : undefined}
            visible={beat >= 0}
          >
            <div className="flex flex-col items-end gap-1">
              <div className="max-w-[85%] rounded-xl rounded-br-sm bg-zinc-800 px-3.5 py-2.5">
                <p className="text-[13px] leading-relaxed text-zinc-50">
                  {USER_PROMPT}
                </p>
              </div>
            </div>
          </Beat>

          <div ref={beat === 0 && !thinkingReady ? latestRef : undefined}>
            <ThinkingReasoning
              key={thinkingKey}
              onDone={() => {
                setThinkingReady(true);
              }}
              skipAnimation={thinkingSkipAnimation}
            />
          </div>

          <Beat
            isLatest={latestAt(1)}
            latestRef={beat === 1 || beat === 2 ? latestRef : undefined}
            visible={beat >= 1 && thinkingReady}
          >
            <ToolSearch
              fn={FIND_OVERDUE}
              hitIsLatest={latestAt(2)}
              onOpen={openPreview}
              showHit={beat >= 2}
            />
          </Beat>

          <Beat
            isLatest={latestAt(3)}
            latestRef={beat === 3 ? latestRef : undefined}
            visible={beat >= 3 && thinkingReady}
          >
            <ToolExecute
              fn={FIND_OVERDUE}
              logOpen={openLog === FIND_OVERDUE.slug}
              onToggleLog={() => {
                setOpenLog((current) =>
                  current === FIND_OVERDUE.slug ? null : FIND_OVERDUE.slug
                );
              }}
            />
          </Beat>

          <Beat
            isLatest={latestAt(4)}
            latestRef={beat === 4 || beat === 5 ? latestRef : undefined}
            visible={beat >= 4 && thinkingReady}
          >
            <ToolSearch
              fn={SEND_REMINDER}
              hitIsLatest={latestAt(5)}
              onOpen={openPreview}
              showHit={beat >= 5}
            />
          </Beat>

          {showApproval ? (
            <div
              className={animateLatest ? 'ft-agent-beat' : undefined}
              ref={latestRef}
            >
              <ApprovalCard onApprove={handleApprove} onSkip={handleSkip} />
            </div>
          ) : null}

          {showSent ? (
            <div
              className={animateLatest ? 'ft-agent-beat' : undefined}
              ref={latestRef}
            >
              <ToolExecute
                fn={SEND_REMINDER}
                logOpen={openLog === SEND_REMINDER.slug}
                onToggleLog={() => {
                  setOpenLog((current) =>
                    current === SEND_REMINDER.slug ? null : SEND_REMINDER.slug
                  );
                }}
              />
            </div>
          ) : null}

          {showSkipped ? (
            <div className="flex flex-col items-start gap-3" ref={latestRef}>
              <p className="text-[13px] leading-relaxed text-zinc-400">
                Reminder not sent. The agent did not call send-reminder.
              </p>
              <button
                className="cursor-pointer text-sm font-medium text-zinc-300 transition-colors duration-[120ms] hover:text-zinc-50"
                onClick={handleReplay}
                type="button"
              >
                Replay
              </button>
            </div>
          ) : null}
        </div>

        <div className="border-t border-zinc-800 px-5 py-4 sm:px-6">
          <div className="flex items-end gap-3 rounded-2xl bg-zinc-800/60 px-3.5 py-2.5">
            <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-zinc-500">
              {USER_PROMPT}
            </p>
            <span
              aria-hidden="true"
              className="flex size-7 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-zinc-500"
            >
              <SendIcon />
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
