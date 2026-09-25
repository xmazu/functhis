'use client';

import { useState } from 'react';

const FAQS = [
  {
    answer:
      'Functhis is a registry and managed runtime for TypeScript functions. You publish ordinary typed functions; Functhis gives them stable URLs, generated contracts, access rules, versions, and one MCP connection for discovery and execution.',
    question: 'What is Functhis?',
  },
  {
    answer:
      'No. Your agent still does the thinking. Functhis gives it dependable tools to call: functions you or your team published once and can reuse across conversations and compatible agents.',
    question: 'Does Functhis replace Claude, Cursor, Codex, or ChatGPT?',
  },
  {
    answer:
      'You keep the code in your project. The CLI discovers each default-exported function, reads its TypeScript signature and JSDoc, bundles the project, and publishes an immutable version. It then prints live pages and callable URLs for the functions it found.',
    question: 'What happens when I run functhis publish?',
  },
  {
    answer:
      'Small, focused capabilities with a typed input and a clear result: reports, data transforms, PDF or presentation generators, narrow API actions, and internal utilities. If it can run in the Cloudflare Workers runtime, it is a strong candidate.',
    question: 'What should I publish?',
  },
  {
    answer:
      'Functhis is the layer around the function. A serverless platform gives you compute; you still build routes, validation, auth, documentation, deployment, and agent integration. Functhis generates that product surface from the function contract.',
    question: 'How is this different from a serverless function or MCP server?',
  },
  {
    answer:
      'npm distributes source code that every consumer must install, configure, and run. Functhis distributes a running capability. Applications can call it over HTTP, and agents can find and execute it through MCP.',
    question: 'How is this different from publishing an npm package?',
  },
  {
    answer:
      'Any MCP-capable agent can use the shared search and execute tools. A published function is not locked to one chat host: connect another compatible agent to the same Functhis account and it can discover the same functions its access allows.',
    question: 'Which agents does it work with?',
  },
  {
    answer:
      'Packages can be private or shared with an organization. Only you and org members can open package pages in the browser. MCP execution uses the same access rules with a bearer token.',
    question: 'Can packages be private or shared with a team?',
  },
  {
    answer:
      'Today, Functhis runs TypeScript built for Cloudflare Workers APIs. It is designed for focused request-response tools, not arbitrary binaries, containers, Python, long-running jobs, or a general Linux sandbox.',
    question: 'What can’t I run on Functhis?',
  },
  {
    answer:
      'Yes. Sign in with GitHub, then authorize the CLI with npx functhis login. Accounts are free during the public alpha.',
    question: 'Do I need an account, and is it free?',
  },
  {
    answer:
      'Ask your coding agent to set up Functhis, or run npx functhis login followed by npx functhis publish in a TypeScript project. To use published functions from an agent, connect https://mcp.functhis.now/mcp once, then search and execute.',
    question: 'How do I get started?',
  },
] as const;

export const FaqList = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="scroll-mt-24 pt-[102px]" id="faq">
      <h2 className="text-4xl leading-tight font-semibold tracking-tight sm:text-[41px]">
        Questions before you deploy
      </h2>
      <p className="mt-4 text-lg leading-relaxed text-zinc-400">
        Straight answers about what Functhis is, what it replaces, and where it
        fits.
      </p>
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
