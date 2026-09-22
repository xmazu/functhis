'use client';

import { AGENT_MARKS, AGENT_PROMPT, agentIconSrc } from '#/lib/agent-prompt';

const MARQUEE_COPIES = 2;

const copyForAgent = async (name: string) => {
  const text = `${AGENT_PROMPT}\n\nThe developer is using ${name}.`;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Clipboard can fail without a secure context; the hero button is the fallback.
  }
};

export const AgentMarquee = () => {
  const loop = Array.from({ length: MARQUEE_COPIES }, () => AGENT_MARKS).flat();

  return (
    <div className="mt-12 min-w-0">
      <p className="mb-4 text-xs font-semibold tracking-widest text-zinc-500 uppercase">
        Works with every agent
      </p>
      <div
        className="[scrollbar-width:none] overflow-x-auto overscroll-x-contain [&::-webkit-scrollbar]:hidden"
        style={{
          WebkitMaskImage:
            'linear-gradient(to right, transparent, black 10%, black 90%, transparent)',
          maskImage:
            'linear-gradient(to right, transparent, black 10%, black 90%, transparent)',
        }}
      >
        <div className="ft-marquee-track flex w-max items-center">
          {loop.map(({ icon, name }, index) => {
            const duplicate = index >= AGENT_MARKS.length;

            return (
              <button
                aria-hidden={duplicate}
                aria-label={`Copy setup prompt for ${name}`}
                className="mr-5 shrink-0 cursor-pointer touch-manipulation p-3"
                key={`${icon}-${index}`}
                onClick={() => {
                  void copyForAgent(name);
                }}
                tabIndex={duplicate ? -1 : 0}
                type="button"
              >
                <img
                  alt=""
                  className="invert-on-dark h-[23px] w-auto"
                  height={23}
                  src={agentIconSrc(icon)}
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
