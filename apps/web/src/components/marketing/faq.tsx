'use client';

import { useState } from 'react';

const FAQS = [
  {
    answer:
      'The fastest way to turn a TypeScript function into a live tool. Deploy once; people open a URL, agents call search and execute.',
    question: 'What is Functhis?',
  },
  {
    answer:
      'Anything you already have as a typed function and need others to run: reports, transforms, PDF or presentation generators, narrow API wrappers, internal utilities.',
    question: 'What should I publish?',
  },
  {
    answer:
      'Any agent that can make HTTP requests or speak MCP. Cursor, Claude Code, Codex, Gemini, Copilot, or anything else. The MCP surface is search and execute.',
    question: 'What agents does this work with?',
  },
  {
    answer:
      'Yes, to keep a package. Sign in with GitHub on the console, then authorize the CLI with functhis login.',
    question: 'Do I need an account to deploy?',
  },
  {
    answer: 'Yes. Accounts are free for the public alpha.',
    question: 'Are accounts free?',
  },
  {
    answer:
      'Packages can be private, organization-only, or a public library. Private URLs are not listed. POST and MCP execute use the same access rules as the page.',
    question: 'Are Functhis packages public or private?',
  },
  {
    answer:
      'Yes. Create an organization, invite teammates with a link, and publish into that workspace. Members see those packages by default at URLs like @org/package.',
    question: 'Can I use Functhis with a team?',
  },
  {
    answer:
      'Install the CLI: npx functhis login, then npx functhis deploy. Connect MCP at https://mcp.functhis.now/mcp. Then search and execute.',
    question: 'I’m an agent. What should I do first?',
  },
] as const;

export const FaqList = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="scroll-mt-24 pt-[102px]" id="faq">
      <h2 className="text-4xl leading-tight font-semibold tracking-tight sm:text-[41px]">
        FAQ
      </h2>
      <div className="mt-10 divide-y divide-zinc-800">
        {FAQS.map((item, index) => {
          const open = openIndex === index;
          const panelId = `faq-${index}-panel`;
          return (
            <div key={item.question}>
              <h3>
                <button
                  aria-controls={panelId}
                  aria-expanded={open}
                  className="flex w-full cursor-pointer items-center justify-between gap-4 py-5 text-left text-lg font-semibold text-zinc-50"
                  onClick={() => {
                    setOpenIndex(open ? null : index);
                  }}
                  type="button"
                >
                  {item.question}
                  <span
                    aria-hidden="true"
                    className={`text-2xl leading-none font-normal text-zinc-400 transition-transform duration-[180ms] ease-out motion-reduce:transition-none ${open ? 'rotate-45' : ''}`}
                  >
                    +
                  </span>
                </button>
              </h3>
              <section
                aria-hidden={!open}
                className={`grid transition-[grid-template-rows] duration-[180ms] ease-out motion-reduce:transition-none ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
                id={panelId}
              >
                <div className="min-h-0 overflow-hidden">
                  <p
                    className={`pb-6 text-lg text-pretty text-zinc-400 transition-opacity duration-[180ms] ease-out motion-reduce:transition-none ${open ? 'opacity-100' : 'opacity-0'}`}
                  >
                    {item.answer}
                  </p>
                </div>
              </section>
            </div>
          );
        })}
      </div>
    </div>
  );
};
